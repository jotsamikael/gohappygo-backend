import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountLinkResponseDto {
  @ApiProperty({
    description: 'URL to redirect user to Stripe onboarding page',
    example: 'https://connect.stripe.com/setup/s/...',
  })
  url: string;
}

