import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for KYC start endpoint
 */
export class KycStartResponseDto {
  @ApiProperty({ description: 'URL to redirect user for KYC completion' })
  redirectUrl: string;

  @ApiProperty({ description: 'Didit session ID' })
  sessionId: string;

  @ApiProperty({ description: 'Success message' })
  message: string;
}

/**
 * Response DTO for KYC status endpoint
 */
export class KycStatusResponseDto {
  @ApiProperty({ 
    enum: ['uninitiated', 'pending', 'approved', 'rejected', 'failed'],
    description: 'Current KYC verification status'
  })
  kycStatus: 'uninitiated' | 'pending' | 'approved' | 'rejected' | 'failed';

  @ApiProperty({ 
    type: 'string', 
    format: 'date-time', 
    nullable: true,
    description: 'Last status update timestamp' 
  })
  kycUpdatedAt: Date | null;

  @ApiProperty({ 
    type: 'string', 
    nullable: true,
    description: 'KYC provider used' 
  })
  kycProvider: string | null;

  @ApiProperty({ description: 'Whether user is verified' })
  isVerified: boolean;
}

/**
 * Response DTO for webhook endpoint
 */
export class WebhookResponseDto {
  @ApiProperty({ description: 'Whether webhook was processed successfully' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;
}


export class KycSessionDetailsResponseDto {
  @ApiProperty({ description: 'Didit session ID' })
  sessionId: string;

  @ApiProperty({ description: 'KYC status' })
  kycStatus: string;
}




