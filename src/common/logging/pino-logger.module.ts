import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';

type RequestWithUser = IncomingMessage & {
  id?: string;
  user?: { id?: number };
};

function incomingRequestId(req: IncomingMessage): string | undefined {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && header[0]?.trim()) {
    return header[0].trim();
  }
  return undefined;
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
        const isPretty = nodeEnv !== 'production' && nodeEnv !== 'test';

        return {
          pinoHttp: {
            level: configService.get<string>('logLevel') || 'info',
            autoLogging: true,
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const requestId = incomingRequestId(req) || randomUUID();
              res.setHeader('X-Request-Id', requestId);
              return requestId;
            },
            customProps: (req: RequestWithUser) => ({
              userId: req.user?.id ?? null,
            }),
            serializers: {
              req: (req: RequestWithUser) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              remove: true,
            },
            ...(isPretty
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      translateTime: 'SYS:standard',
                      singleLine: false,
                    },
                  },
                }
              : {}),
          },
        };
      },
    }),
  ],
})
export class PinoLoggerModule {}
