import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Observable } from 'rxjs';

@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      id?: string;
      user?: { id?: number };
    }>();

    Sentry.getCurrentScope().setTag('requestId', request?.id ? String(request.id) : 'unknown');
    if (request?.user?.id != null) {
      Sentry.setUser({ id: String(request.user.id) });
    } else {
      Sentry.setUser(null);
    }

    return next.handle();
  }
}
