import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum KycClient {
  WEB = 'web',
  MOBILE = 'mobile',
}

export class StartKycQueryDto {
  @ApiPropertyOptional({
    enum: KycClient,
    default: KycClient.WEB,
    description: 'Client platform starting KYC (controls Didit callback / user return URL)',
  })
  @IsOptional()
  @IsEnum(KycClient)
  client?: KycClient = KycClient.WEB;
}
