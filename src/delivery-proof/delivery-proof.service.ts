import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserEventType } from 'src/events/event-types';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThanOrEqual } from 'typeorm';
import { DeliveyProofEntity } from './delivery-proof.entity';
import { RequestEntity } from 'src/request/request.entity';
import { UserEntity } from 'src/user/user.entity';
import { CloudinaryService } from 'src/file-upload/cloudinary/cloudinary.service';
import {
  CustomBadRequestException,
  CustomForbiddenException,
  CustomNotFoundException,
} from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { UploadMeetingProofResponseDto } from './dto/upload-meeting-proof-response.dto';
import { MeetingProofSignedUrlResponseDto } from './dto/meeting-proof-signed-url-response.dto';
import {
  getRequestTravelDateOnly,
  isWithinMeetingProofUploadWindow,
} from 'src/request/utils/request-date-policy';

@Injectable()
export class DeliveryProofService {
  private readonly logger = new Logger(DeliveryProofService.name);
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

  constructor(
    @InjectRepository(DeliveyProofEntity)
    private readonly deliveryProofRepository: Repository<DeliveyProofEntity>,
    @InjectRepository(RequestEntity)
    private readonly requestRepository: Repository<RequestEntity>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private validateFile(file: Express.Multer.File): void {
    if (!file?.buffer?.length) {
      throw new CustomBadRequestException('File is empty or corrupted', ErrorCode.FILE_EMPTY_OR_CORRUPTED);
    }
    if (file.size > this.MAX_FILE_SIZE) {
      throw new CustomBadRequestException(
        `File size cannot exceed ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
        ErrorCode.FILE_SIZE_EXCEEDED,
      );
    }
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new CustomBadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
      );
    }
  }

  private canBypassTravelDateRules(): boolean {
    return this.configService.get<string>('CAN_COMPLETE_TRAVEL_BEFORE_TRAVEL_DATE') === 'true';
  }

  private isRequestParty(request: RequestEntity, userId: number): boolean {
    const isRequester = request.requesterId === userId;
    const isTravelOwner = request.travel?.userId === userId;
    const isDemandOwner = request.demand?.userId === userId;
    return isRequester || isTravelOwner || isDemandOwner;
  }

  async hasMeetingProof(requestId: number): Promise<boolean> {
    const count = await this.deliveryProofRepository.count({ where: { requestId } });
    return count > 0;
  }

  async uploadMeetingProof(
    requestId: number,
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<UploadMeetingProofResponseDto> {
    this.validateFile(file);

    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['travel', 'demand', 'deliveryProof', 'currentStatus'],
    });

    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    if (request.currentStatus?.status !== 'ACCEPTED') {
      throw new CustomBadRequestException(
        'Meeting proof can only be uploaded for accepted requests',
        ErrorCode.REQUEST_NOT_IN_ACCEPTED_STATUS,
      );
    }

    if (request.deliveryProof) {
      throw new CustomBadRequestException(
        'Meeting proof already exists for this request',
        ErrorCode.MEETING_PROOF_ALREADY_EXISTS,
      );
    }

    if (!this.isRequestParty(request, user.id)) {
      throw new CustomForbiddenException(
        'Only the requester or travel/demand owner can upload meeting proof',
        ErrorCode.REQUEST_UNAUTHORIZED,
      );
    }

    const travelDate = getRequestTravelDateOnly(request);
    if (!travelDate) {
      throw new CustomBadRequestException(
        'Request has no travel date configured',
        ErrorCode.REQUEST_NOT_FOUND,
      );
    }

    const autoCompleteDays = this.configService.get<number>('AUTO_COMPLETE_DAYS_AFTER_TRAVEL_DATE', 7);
    const canBypass = this.canBypassTravelDateRules();

    if (!isWithinMeetingProofUploadWindow(travelDate, autoCompleteDays, canBypass)) {
      const travelDateOnly = travelDate;
      const today = new Date();
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (!canBypass && todayOnly < travelDateOnly) {
        throw new CustomBadRequestException(
          'Meeting proof cannot be uploaded before the travel date',
          ErrorCode.MEETING_PROOF_UPLOAD_TOO_EARLY,
        );
      }
      throw new CustomBadRequestException(
        'Meeting proof upload window has closed',
        ErrorCode.MEETING_PROOF_UPLOAD_WINDOW_CLOSED,
      );
    }

    const uploadResult = await this.cloudinaryService.uploadMeetingProofSelfie(file, requestId);
    const publicId = uploadResult.public_id;

    const proof = this.deliveryProofRepository.create({
      requestId,
      cloudinaryPublicId: publicId,
      uploadedByUserId: user.id,
      uploadedAt: new Date(),
    });

    const saved = await this.deliveryProofRepository.save(proof);

    this.logger.log(
      `Meeting proof uploaded for request ${requestId} by user ${user.id} (publicId=${publicId})`,
    );

    this.eventEmitter.emit(UserEventType.MEETING_PROOF_UPLOADED, {
      requestId,
      uploadedByUserId: user.id,
      timestamp: new Date(),
    });

    return {
      requestId,
      hasMeetingProof: true,
      uploadedAt: saved.uploadedAt,
      uploadedByUserId: saved.uploadedByUserId,
    };
  }

  async getSignedUrlForAdmin(
    requestId: number,
    adminUserId: number,
  ): Promise<MeetingProofSignedUrlResponseDto> {
    const proof = await this.deliveryProofRepository.findOne({ where: { requestId } });
    if (!proof) {
      throw new CustomNotFoundException('Meeting proof not found', ErrorCode.MEETING_PROOF_NOT_FOUND);
    }

    const { signedUrl, expiresAt } = this.cloudinaryService.getAuthenticatedSignedUrl(
      proof.cloudinaryPublicId,
      300,
    );

    this.logger.log(
      `Admin ${adminUserId} accessed meeting proof signed URL for request ${requestId}`,
    );

    return { requestId, signedUrl, expiresAt };
  }

  async purgeExpiredProofs(): Promise<{ deleted: number; errors: number }> {
    const retentionDays = this.configService.get<number>('SELFIE_RETENTION_DAYS', 70);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const expired = await this.deliveryProofRepository.find({
      where: { uploadedAt: LessThanOrEqual(cutoff) },
    });

    let deleted = 0;
    let errors = 0;

    for (const proof of expired) {
      try {
        await this.cloudinaryService.destroyMeetingProof(proof.cloudinaryPublicId);
        await this.deliveryProofRepository.remove(proof);
        deleted++;
        this.logger.log(`Purged expired meeting proof for request ${proof.requestId}`);
      } catch (err) {
        errors++;
        this.logger.error(
          `Failed to purge meeting proof for request ${proof.requestId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { deleted, errors };
  }
}
