import { ApiProperty } from '@nestjs/swagger';

export class SendPublicMessageResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the message was sent successfully'
  })
  success: boolean;

  @ApiProperty({
    example: 'Message sent successfully. The announcement owner will receive an email with your message.',
    description: 'Success message'
  })
  message: string;
}
