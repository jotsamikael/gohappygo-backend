import { ArgumentsHost, Catch, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';

type RequestWithContext = {
  id?: string;
  user?: { id?: number };
};

function resolveHttpStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  constructor(@Optional() httpAdapterHost?: HttpAdapterHost) {
    super(httpAdapterHost?.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const status = resolveHttpStatus(exception);

    if (status >= 500) {
      const request = host.switchToHttp().getRequest<RequestWithContext>();
      Sentry.withScope((scope) => {
        if (request?.id) {
          scope.setTag('requestId', String(request.id));
        }
        if (request?.user?.id != null) {
          scope.setTag('userId', String(request.user.id));
        }
        Sentry.captureException(exception);
      });
    }

    super.catch(exception, host);
  }
}
