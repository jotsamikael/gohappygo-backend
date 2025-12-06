import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CommonService } from 'src/common/service/common.service';
import { UserEntity } from 'src/user/user.entity';
import { SupportLogResponseDto } from './dto/support-log-response.dto';
import { SupportRequestResponseDto } from './dto/support-request-response.dto';
import { SupportLogEntity } from './entities/support-log.entity';
import { SupportRequestEntity } from './entities/support-request.entity';

@Injectable()
export class SupportMapper {
  constructor(private readonly commonService: CommonService) {}

  toSupportRequestResponse(
    supportRequest: SupportRequestEntity,
    users?: Map<number, UserEntity>
  ): SupportRequestResponseDto {
    const dto = plainToInstance(SupportRequestResponseDto, supportRequest, {
      excludeExtraneousValues: true,
    });

    // Map logs with user information
    if (supportRequest.logs && supportRequest.logs.length > 0) {
      dto.logs = supportRequest.logs.map(log => this.toSupportLogResponse(log, users));
    } else {
      dto.logs = [];
    }

    return dto;
  }

  toSupportLogResponse(
    log: SupportLogEntity,
    users?: Map<number, UserEntity>
  ): SupportLogResponseDto {
    const dto = plainToInstance(SupportLogResponseDto, log, {
      excludeExtraneousValues: true,
    });

    // Add user full name if available
    if (log.userId && users && users.has(log.userId)) {
      const user = users.get(log.userId);
      if (user) {
        dto.userFullName = this.commonService.formatFullName(
          user.firstName,
          user.lastName
        );
      } else {
        dto.userFullName = null;
      }
    } else {
      dto.userFullName = null;
    }

    return dto;
  }

  toSupportRequestResponseList(
    supportRequests: SupportRequestEntity[],
    users?: Map<number, UserEntity>
  ): SupportRequestResponseDto[] {
    return supportRequests.map(request =>
      this.toSupportRequestResponse(request, users)
    );
  }
}
