import { ApiProperty } from '@nestjs/swagger';

export class MeetingProofSignedUrlResponseDto {
  @ApiProperty({ example: 42 })
  requestId: number;

  @ApiProperty({ description: 'Short-lived signed URL for admin review' })
  signedUrl: string;

  @ApiProperty()
  expiresAt: Date;
}
