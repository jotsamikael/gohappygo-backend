import { config as loadEnv } from 'dotenv';
import * as Sentry from '@sentry/nestjs';

loadEnv({ path: `.env.${process.env.NODE_ENV}` });
loadEnv({ path: '.env' });

const dsn = (process.env.SENTRY_DSN || '').trim();

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  sendDefaultPii: false,
});
