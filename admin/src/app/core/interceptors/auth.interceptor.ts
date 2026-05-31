import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthenticationService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  private readonly publicAuthEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh-token',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-phone',
    '/api/auth/upload-verification',
  ];

  constructor(
    private authService: AuthenticationService,
    private notificationService: NotificationService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isPublicAuthRequest(request.url)) {
      const token = this.authService.getAccessToken();
      if (token) {
        request = this.addToken(request, token);
      }
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && this.shouldAttemptRefresh(request.url)) {
          return this.handle401Error(request, next);
        }

        return throwError(() => error);
      })
    );
  }

  private isPublicAuthRequest(url: string): boolean {
    return this.publicAuthEndpoints.some((endpoint) => url.includes(endpoint));
  }

  private shouldAttemptRefresh(url: string): boolean {
    return !this.isPublicAuthRequest(url);
  }

  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const refreshToken = this.authService.getRefreshToken();
    if (!refreshToken) {
      this.forceLogout();
      return throwError(() => new Error('No refresh token available'));
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap((response) => {
          const newAccessToken = response.access_token;
          if (!newAccessToken) {
            throw new Error('Refresh response missing access_token');
          }

          this.isRefreshing = false;
          this.refreshTokenSubject.next(newAccessToken);
          return next.handle(this.addToken(request, newAccessToken));
        }),
        catchError((error) => {
          this.isRefreshing = false;
          this.refreshTokenSubject = new BehaviorSubject<string | null>(null);
          this.forceLogout();
          return throwError(() => error);
        })
      );
    }

    return this.refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next.handle(this.addToken(request, token)))
    );
  }

  private forceLogout(): void {
    this.authService.logout();
    this.notificationService.error('Session expired. Please login again.');
  }
}
