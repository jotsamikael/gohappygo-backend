const nodeEnv = process.env.NODE_ENV || 'development';

export default () => ({
  appName: process.env.APP_NAME || 'GoHappyGo-API',
  emailLogoUrl: process.env.EMAIL_LOGO_URL || '',
  placeholderImageUrl: process.env.PLACEHOLDER_IMAGE_URL || '',
  logLevel: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
  sentryDsn: process.env.SENTRY_DSN || '',
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT || nodeEnv,
  sentryTracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
});