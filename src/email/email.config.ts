import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.EMAIL_HOST || 'ssl0.ovh.net',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true',
  requireTLS: process.env.EMAIL_REQUIRE_TLS !== 'false',
  tls: {
    rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // This should be your host app password
  },
  archiveBcc: process.env.EMAIL_ARCHIVE_BCC || '',
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@gohappygo.fr',
}));