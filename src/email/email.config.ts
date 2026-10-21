import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  apiKey: process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC,
  apiSecret: process.env.MAILJET_API_SECRET || process.env.MJ_APIKEY_PRIVATE,
  sandbox: process.env.MAILJET_SANDBOX === 'true',
  archiveBcc: process.env.EMAIL_ARCHIVE_BCC || '',
  from: process.env.EMAIL_FROM || 'noreply@gohappygo.fr',
  supportFrom: process.env.SUPPORT_EMAIL || 'support@gohappygo.fr',
}));
