import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum OnboardingClient {
  WEB = 'web',
  MOBILE = 'mobile',
}

export class GetOnboardingLinkQueryDto {
  @ApiPropertyOptional({
    enum: OnboardingClient,
    default: OnboardingClient.WEB,
    description: 'Client platform that started onboarding (controls Stripe return/refresh URLs)',
  })
  @IsOptional()
  @IsEnum(OnboardingClient)
  client?: OnboardingClient = OnboardingClient.WEB;
}
