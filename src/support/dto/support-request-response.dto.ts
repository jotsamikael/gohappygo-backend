import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { SupportCategory, SupportRequesterType, SupportStatus } from '../entities/support-request.entity';
import { SupportLogResponseDto } from './support-log-response.dto';

export class SupportRequestResponseDto {
  @ApiProperty({ description: 'Support request ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Requester email' })
  @Expose()
  email: string;

  @ApiProperty({ description: 'Support request message' })
  @Expose()
  message: string;

  @ApiProperty({ description: 'Type of requester', enum: SupportRequesterType })
  @Expose()
  supportRequesterType: SupportRequesterType;

  @ApiProperty({ description: 'Support request status', enum: SupportStatus })
  @Expose()
  status: SupportStatus;

  @ApiProperty({ description: 'Support category', enum: SupportCategory })
  @Expose()
  supportCategory: SupportCategory;

  @ApiProperty({ description: 'Support logs', type: [SupportLogResponseDto] })
  @Expose()
  @Type(() => SupportLogResponseDto)
  logs: SupportLogResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Expose()
  updatedAt: Date;
}

