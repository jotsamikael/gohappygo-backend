import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthenticationService } from '../services/auth.service';
import { AuthStorageService } from '../services/auth-storage.service';
import { isAccessTokenExpired } from '../utils/jwt.util';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  constructor(
    private router: Router,
    private authenticationService: AuthenticationService,
    private authStorageService: AuthStorageService,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean | UrlTree | Observable<boolean | UrlTree> {
    const currentUser = this.authStorageService.getCurrentUser();
    const accessToken = this.authStorageService.getAccessToken();
    const refreshToken = this.authStorageService.getRefreshToken();

    if (currentUser && accessToken && !isAccessTokenExpired(accessToken)) {
      return true;
    }

    if (currentUser && refreshToken) {
      return this.authenticationService.refreshToken().pipe(
        map(() => true),
        catchError(() => of(this.redirectToLogin(state.url))),
      );
    }

    return this.redirectToLogin(state.url);
  }

  private redirectToLogin(returnUrl: string): UrlTree {
    return this.router.createUrlTree([''], {
      queryParams: { returnUrl },
    });
  }
}
