import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthStorageService } from './auth-storage.service';
import { AuthenticationService } from './auth.service';
import { isAccessTokenExpired, msUntilRefresh } from '../utils/jwt.util';

/**
 * Proactively refreshes the access token shortly before it expires.
 * Re-schedules whenever the stored user/session changes (login, refresh, logout).
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshSchedulerService implements OnDestroy {
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private userSubscription?: Subscription;
  private isRefreshing = false;

  constructor(
    private readonly authStorageService: AuthStorageService,
    private readonly authenticationService: AuthenticationService,
  ) {
    this.userSubscription = this.authStorageService.currentUser$.subscribe((user) => {
      if (user) {
        this.scheduleNextRefresh();
      } else {
        this.clearScheduledRefresh();
      }
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.clearScheduledRefresh();
  }

  /** Reschedule after login or successful refresh. */
  scheduleNextRefresh(): void {
    this.clearScheduledRefresh();

    const accessToken = this.authStorageService.getAccessToken();
    const refreshToken = this.authStorageService.getRefreshToken();
    if (!accessToken || !refreshToken) {
      return;
    }

    if (isAccessTokenExpired(accessToken)) {
      this.runRefresh();
      return;
    }

    const delay = msUntilRefresh(accessToken);
    if (delay == null) {
      return;
    }

    this.refreshTimer = setTimeout(() => this.runRefresh(), delay);
  }

  private runRefresh(): void {
    if (this.isRefreshing || !this.authStorageService.getRefreshToken()) {
      return;
    }

    this.isRefreshing = true;
    this.authenticationService.refreshToken().subscribe({
      next: () => {
        this.isRefreshing = false;
        this.scheduleNextRefresh();
      },
      error: () => {
        this.isRefreshing = false;
      },
    });
  }

  private clearScheduledRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}
