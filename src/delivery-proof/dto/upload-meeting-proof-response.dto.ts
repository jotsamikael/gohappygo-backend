import { ApiProperty } from '@nestjs/swagger';

export class UploadMeetingProofResponseDto {
  @ApiProperty({ example: 42 })
  requestId: number;

  @ApiProperty({ example: true })
  hasMeetingProof: boolean;

  @ApiProperty()
  uploadedAt: Date;

  @ApiProperty({ example: 7 })
  uploadedByUserId: number;
}
