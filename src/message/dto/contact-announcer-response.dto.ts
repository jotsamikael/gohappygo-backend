import { ApiProperty } from '@nestjs/swagger';

export class ContactAnnouncerResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the inquiry email was sent successfully',
  })
  success: boolean;

  @ApiProperty({
    example: 'Your message was sent to the announcement creator.',
    description: 'Success message',
  })
  message: string;
}
