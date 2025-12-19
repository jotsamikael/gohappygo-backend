import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap } from 'rxjs/operators';
import { QueryFailedError } from 'typeorm';
/**
 * @jotsamikael 19/12/2025
 * Interceptor that retries database connections on failure
 * It is used to handle database connection errors and retries the request
 * It is used to handle database connection errors and retries the request
 * is used in the main.ts file to retry the request if the database connection fails
 */
@Injectable()
export class DbRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DbRetryInterceptor.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // Start with 1 second delay

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    return next.handle().pipe(
      retryWhen((errors) =>
        errors.pipe(
          mergeMap((error, attemptIndex) => {
            // Check if it's a database connection error
            const isConnectionError = this.isConnectionError(error);

            if (!isConnectionError || attemptIndex >= this.maxRetries) {
              // Not a connection error or max retries reached, throw error
              if (isConnectionError && attemptIndex >= this.maxRetries) {
                this.logger.error(
                  `❌ Max retries (${this.maxRetries}) reached for ${method} ${url}. Giving up.`,
                );
              }
              return throwError(() => error);
            }

            // Calculate exponential backoff delay
            const delay = this.retryDelay * Math.pow(2, attemptIndex);
            this.logger.warn(
              `🔄 Database connection error (${error.code || error.message}) on ${method} ${url}. ` +
                `Retrying (${attemptIndex + 1}/${this.maxRetries}) after ${delay}ms...`,
            );

            // Wait before retrying
            return timer(delay);
          }),
        ),
      ),
    );
  }

  /**
   * Check if the error is a database connection error that should be retried
   */
  private isConnectionError(error: any): boolean {
    // TypeORM QueryFailedError with connection issues
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError;
      if (driverError) {
        const errorCode = driverError.code || driverError.errno;
        const errorMessage = driverError.message || '';

        // MySQL connection error codes
        const connectionErrorCodes = [
          'ECONNRESET',
          'PROTOCOL_CONNECTION_LOST',
          'ETIMEDOUT',
          'ECONNREFUSED',
          'ENOTFOUND',
          'EHOSTUNREACH',
        ];

        // Check error code
        if (connectionErrorCodes.includes(errorCode)) {
          return true;
        }

        // Check error message for connection-related keywords
        const connectionErrorMessages = [
          'read ECONNRESET',
          'connection lost',
          'connection closed',
          'connection timeout',
          'lost connection',
          'server has gone away',
        ];

        if (
          connectionErrorMessages.some((msg) =>
            errorMessage.toLowerCase().includes(msg),
          )
        ) {
          return true;
        }
      }
    }

    // Direct error objects with connection error codes
    if (error.code && ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT'].includes(error.code)) {
      return true;
    }

    return false;
  }
}

