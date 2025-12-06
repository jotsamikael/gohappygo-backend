import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for Onfido KYC start endpoint
 */
export class OnfidoStartResponseDto {
  @ApiProperty({ description: 'Onfido SDK token for client-side verification' })
  sdkToken: string;

  @ApiProperty({ description: 'Onfido workflow run ID' })
  workflowRunId: string;

  @ApiProperty({ description: 'Success message' })
  message: string;
}

/**
 * Response DTO for Onfido KYC status endpoint
 */
export class OnfidoStatusResponseDto {
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
 * Response DTO for Onfido webhook endpoint
 */
export class OnfidoWebhookResponseDto {
  @ApiProperty({ description: 'Whether webhook was processed successfully' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

/**
 * Response DTO for Onfido workflow run details
 */
export class OnfidoWorkflowRunDetailsResponseDto {
  @ApiProperty({ description: 'Onfido workflow run ID' })
  workflowRunId: string;

  @ApiProperty({ description: 'KYC status' })
  kycStatus: string;

  @ApiProperty({ description: 'Workflow run status from Onfido' })
  workflowRunStatus: string;

  @ApiProperty({ description: 'Applicant ID' })
  applicantId: string;
}

/**
 * DTO for Onfido applicant creation
 */
export class OnfidoApplicantDto {
  @ApiProperty({ description: 'First name' })
  first_name: string;

  @ApiProperty({ description: 'Last name' })
  last_name: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Phone number', required: false })
  phone_number?: string;
}

/**
 * DTO for Onfido workflow run creation
 */
export class OnfidoWorkflowRunDto {
  @ApiProperty({ description: 'Applicant ID' })
  applicant_id: string;

  @ApiProperty({ description: 'Workflow ID' })
  workflow_id: string;
}



/**
 * Request DTO for Onfido webhook endpoint
 */
export class OnfidoWebhookRequestDto {
  @ApiProperty({ 
    description: 'Webhook event type',
    example: 'workflow_run.completed'
  })
  event_type: string;

  @ApiProperty({ 
    description: 'Webhook resource data containing verification information',
    example: {
      id: 'workflow_run_123456789',
      status: 'completed',
      applicant_id: 'applicant_987654321',
      workflow_run_id: 'workflow_run_123456789',
      result: { outcome: 'clear' }
    }
  })
  resource: {
    id: string;
    status: string;
    applicant_id?: string;
    workflow_run_id?: string;
    result?: any;
  };

  @ApiProperty({ 
    description: 'Webhook timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  created_at: string;

  @ApiProperty({ 
    description: 'Webhook ID',
    example: 'webhook_123456789'
  })
  id: string;
}
