import { ConfigService } from '@nestjs/config';
import { OnboardingClient } from './dto/get-onboarding-link-query.dto';

export interface StripeOnboardingUrls {
  returnUrl: string;
  refreshUrl: string;
}

export function resolveStripeOnboardingUrls(
  configService: ConfigService,
  client: OnboardingClient,
): StripeOnboardingUrls {
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') || 'https://gohappygo.netlify.app';

  if (client === OnboardingClient.MOBILE) {
    return {
      returnUrl:
        configService.get<string>('STRIPE_RETURN_URL_MOBILE') ||
        'https://gohappygo.fr/connect/stripe/return',
      refreshUrl:
        configService.get<string>('STRIPE_REFRESH_URL_MOBILE') ||
        'https://gohappygo.fr/connect/stripe/refresh',
    };
  }

  return {
    returnUrl:
      configService.get<string>('STRIPE_RETURN_URL_WEB') ||
      `${frontendUrl}/stripe-onboarding?completed=1`,
    refreshUrl:
      configService.get<string>('STRIPE_REFRESH_URL_WEB') ||
      `${frontendUrl}/settings/payments?refresh=true`,
  };
}
