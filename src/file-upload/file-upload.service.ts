import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CloudinaryService } from './cloudinary/cloudinary.service';
import { UserEntity } from 'src/user/user.entity';
import { File } from './entities/file.entity';
import { UploadedFileEntity } from 'src/uploaded-file/uploaded-file.entity';
import { FilePurpose } from 'src/uploaded-file/uploaded-file-purpose.enum';
import { TravelEntity } from 'src/travel/travel.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { RequestEntity } from 'src/request/request.entity';
import { CustomBadRequestException, CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

@Injectable()
export class FileUploadService {

    private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

    constructor(
        @InjectRepository(UploadedFileEntity)
        private readonly uploadedFileRepository: Repository<UploadedFileEntity>,
        private readonly cloudinaryService: CloudinaryService
    ){}

    private validateFile(file: Express.Multer.File): void {
        // Validate file size
        if (file.size > this.MAX_FILE_SIZE) {
            throw new CustomBadRequestException(`File size cannot exceed ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`, ErrorCode.FILE_SIZE_EXCEEDED);
        }

        // Validate file type
        if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            throw new CustomBadRequestException('Only JPEG, PNG, and WebP images are allowed', ErrorCode.FILE_TYPE_NOT_ALLOWED);
        }

        // Validate file exists
        if (!file.buffer || file.buffer.length === 0) {
            throw new CustomBadRequestException('File is empty or corrupted', ErrorCode.FILE_EMPTY_OR_CORRUPTED);
        }
    }

    async uploadFile(
        file: Express.Multer.File, 
        purpose: FilePurpose, 
        user: UserEntity,
        travel?: TravelEntity,
        demand?: DemandEntity,
        request?: RequestEntity
    ): Promise<UploadedFileEntity>{
        // Validate the file
        this.validateFile(file);

        const cloudinaryResponse = await this.cloudinaryService.uploadFile(file);

        const newlyCreatedFile = this.uploadedFileRepository.create({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            purpose: purpose,
            publicId: cloudinaryResponse?.public_id,
            fileUrl: cloudinaryResponse?.secure_url,
            user: user,
            travel: travel,
            demand: demand,
        });

        return this.uploadedFileRepository.save(newlyCreatedFile);
    }

    async uploadMultipleFiles(
        files: Express.Multer.File[],
        purposes: FilePurpose[],
        user: UserEntity,
        travel?: TravelEntity,
        demand?: DemandEntity,
        request?: RequestEntity
    ): Promise<UploadedFileEntity[]> {
        if (files.length !== purposes.length) {
            throw new CustomBadRequestException('Number of files must match number of purposes', ErrorCode.FILE_MISMATCHED_NUMBERS_OF_FILES_AND_PURPOSES);
        }

        const uploadPromises = files.map((file, index) => 
            this.uploadFile(file, purposes[index], user, travel, demand, request)
        );

        return Promise.all(uploadPromises);
    }

    async findAll(): Promise<UploadedFileEntity[]>{
        return this.uploadedFileRepository.find({
            relations:['user'],
            order:{uploadedAt: 'DESC'}
        })
    }

    async remove(id: number): Promise<void>{
        const fileToBeDeleted = await this.uploadedFileRepository.findOne({
            where: { id }
        })

        if(!fileToBeDeleted){
            throw new CustomNotFoundException(`File with ID ${id} not found!`, ErrorCode.FILE_NOT_FOUND);
        }

        //delete from cloudinary
        await this.cloudinaryService.deleteFile(fileToBeDeleted.publicId);

        //delete from db
        await this.uploadedFileRepository.remove(fileToBeDeleted)
    }

    async getUserVerificationFiles(userId: number): Promise<any[]> {
        const files = await this.uploadedFileRepository.find({
            where: {
                user: { id: userId },
                purpose: In([FilePurpose.SELFIE, FilePurpose.ID_FRONT, FilePurpose.ID_BACK])
            },
            order: {
                uploadedAt: 'ASC'
            }
        });

        return files.map(file => ({
            id: file.id,
            originalName: file.originalName,
            url: file.fileUrl,
            purpose: FilePurpose[file.purpose], // Convert number to enum string
            uploadedAt: file.uploadedAt,
            size: file.size
        }));
    }

    async getDemandImages(demandId: number): Promise<UploadedFileEntity[]> {
        return this.uploadedFileRepository.find({
            where: {
                demandId: demandId,
                purpose: In([FilePurpose.DEMAND_IMAGE_1, FilePurpose.DEMAND_IMAGE_2])
            },
            order: {
                purpose: 'ASC'
            }
        });
    }

    async getTravelImages(travelId: number): Promise<UploadedFileEntity[]> {
        return this.uploadedFileRepository.find({
            where: {
                travelId: travelId,
                purpose: In([FilePurpose.TRAVEL_IMAGE_1, FilePurpose.TRAVEL_IMAGE_2])
            },
            order: {
                purpose: 'ASC'
            }
        });
    }

  
}
