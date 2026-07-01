import { ConfigService } from '@nestjs/config';
import { KycClient } from './dto/start-kyc-query.dto';

export function resolveKycReturnUrl(
  configService: ConfigService,
  client: KycClient,
): string {
  const frontendUrl =
    configService.get<string>('PUBLIC_APP_URL') ||
    configService.get<string>('FRONTEND_URL') ||
    'https://gohappygo.netlify.app';

  if (client === KycClient.MOBILE) {
    return (
      configService.get<string>('KYC_RETURN_URL_MOBILE') ||
      'https://gohappygo.fr/connect/kyc/return'
    );
  }

  return (
    configService.get<string>('KYC_RETURN_URL_WEB') ||
    configService.get<string>('KYC_RETURN_URL') ||
    `${frontendUrl}/kyc/return?completed=1`
  );
}
