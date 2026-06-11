import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { NotificationService } from 'src/app/core/services/notification.service';
import { UserProfileResponseDto } from 'src/app/gohappygobackend/models/user-profile-response-dto';
import {
  AuthService,
  DemandsService,
  RequestsService,
  ReviewsService,
  SupportsService,
  TransactionsService,
  TravelsService,
  UsersService,
} from 'src/app/gohappygobackend/services';
import { DemandResponseDto } from 'src/app/gohappygobackend/models/demand-response-dto';
import { TravelResponseDto } from 'src/app/gohappygobackend/models/travel-response-dto';
import { RequestResponseDto } from 'src/app/gohappygobackend/models/request-response-dto';
import {
  UserDetailsExportPayload,
  UserDetailsState,
  UserReviewRow,
  UserSupportRow,
  UserTransactionRow,
} from './user-details.model';
import { exportUserDetailsPdf } from './user-details-pdf.util';

const ACTIVITY_LIMIT = 100;

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss'],
})
export class UserDetailsComponent implements OnInit {
  breadCrumbItems: Array<{}> = [];
  userId!: number;
  isLoading = true;
  isExporting = false;

  profile: UserProfileResponseDto | null = null;
  accountStatus = 'Active';
  listMeta: UserDetailsState = {};

  demands: DemandResponseDto[] = [];
  travels: TravelResponseDto[] = [];
  requests: RequestResponseDto[] = [];
  transactions: UserTransactionRow[] = [];
  reviewsGiven: UserReviewRow[] = [];
  reviewsReceived: UserReviewRow[] = [];
  supportTickets: UserSupportRow[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private demandsService: DemandsService,
    private travelsService: TravelsService,
    private requestsService: RequestsService,
    private transactionsService: TransactionsService,
    private reviewsService: ReviewsService,
    private supportsService: SupportsService,
    private usersService: UsersService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    const navigationState = history.state as UserDetailsState | undefined;
    if (navigationState?.isDeactivated !== undefined) {
      this.listMeta = navigationState;
      this.accountStatus = navigationState.isDeactivated ? 'Deactivated' : 'Active';
    }

    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = Number(params.get('id'));
        if (!id || Number.isNaN(id)) {
          throw new Error('Invalid user id');
        }
        this.userId = id;
        return this.loadUserData(id);
      }),
      catchError((error) => {
        console.error('Failed to load user details:', error);
        this.notificationService.error('Unable to load user details.');
        this.router.navigate(['/backend/users']);
        throw error;
      }),
    ).subscribe({
      next: (data) => {
        this.applyLoadedData(data);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/backend/users']);
  }

  exportPdf(): void {
    if (!this.profile) {
      return;
    }

    this.isExporting = true;
    try {
      const payload: UserDetailsExportPayload = {
        profile: this.profile,
        accountStatus: this.accountStatus,
        demands: this.demands,
        travels: this.travels,
        requests: this.requests,
        transactions: this.transactions,
        reviewsGiven: this.reviewsGiven,
        reviewsReceived: this.reviewsReceived,
        supportTickets: this.supportTickets,
      };
      exportUserDetailsPdf(payload);
      this.notificationService.success('User data exported to PDF.');
    } catch (error) {
      console.error('PDF export failed:', error);
      this.notificationService.error('Failed to export PDF.');
    } finally {
      this.isExporting = false;
    }
  }

  formatDate(value: string | undefined | null): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString();
  }

  asText(value: unknown): string {
    if (value == null || value === '') {
      return '—';
    }
    if (typeof value === 'object') {
      return '—';
    }
    return String(value);
  }

  isStripeVerified(): boolean {
    const status = this.profile?.stripeAccountStatus;
    return status === 'active' || status === 'restricted';
  }

  formatRating(): string {
    if (this.listMeta.rating == null) {
      return '—';
    }
    return Number(this.listMeta.rating).toFixed(2);
  }

  private loadUserData(userId: number) {
    return this.authService.authControllerGetCurrentUser({ userId }).pipe(
      switchMap((profile) => {
        const email = this.asText(profile.email);
        return forkJoin({
          profile: of(profile),
          demands: this.fetchDemands(userId),
          travels: this.fetchTravels(userId),
          requestsAsRequester: this.fetchRequestsAsRequester(userId),
          requestsAsTraveler: email !== '—' ? this.fetchRequestsAsTraveler(email) : of([]),
          transactionsAsPayer: this.fetchTransactionsAsPayer(userId),
          transactionsAsPayee: this.fetchTransactionsAsPayee(userId),
          reviewsGiven: this.fetchReviewsGiven(userId),
          reviewsReceived: this.fetchReviewsReceived(userId),
          supportTickets: email !== '—' ? this.fetchSupportTickets(email) : of([]),
          listMeta: this.listMeta.isDeactivated !== undefined
            ? of(this.listMeta)
            : this.fetchListMeta(email),
        });
      }),
      map((result) => {
        const requestMap = new Map<number, RequestResponseDto>();
        [...result.requestsAsRequester, ...result.requestsAsTraveler].forEach((request) => {
          requestMap.set(request.id, request);
        });

        const transactionMap = new Map<number, UserTransactionRow>();
        result.transactionsAsPayer.forEach((tx) => {
          transactionMap.set(tx.id, { ...tx, role: 'Payer' });
        });
        result.transactionsAsPayee.forEach((tx) => {
          if (transactionMap.has(tx.id)) {
            transactionMap.set(tx.id, { ...tx, role: 'Payer & Payee' });
          } else {
            transactionMap.set(tx.id, { ...tx, role: 'Payee' });
          }
        });

        if (result.listMeta.isDeactivated !== undefined) {
          this.listMeta = result.listMeta;
          this.accountStatus = result.listMeta.isDeactivated ? 'Deactivated' : 'Active';
        }

        return {
          profile: result.profile,
          demands: result.demands,
          travels: result.travels,
          requests: Array.from(requestMap.values()),
          transactions: Array.from(transactionMap.values()),
          reviewsGiven: result.reviewsGiven,
          reviewsReceived: result.reviewsReceived,
          supportTickets: result.supportTickets,
        };
      }),
    );
  }

  private applyLoadedData(data: {
    profile: UserProfileResponseDto;
    demands: DemandResponseDto[];
    travels: TravelResponseDto[];
    requests: RequestResponseDto[];
    transactions: UserTransactionRow[];
    reviewsGiven: UserReviewRow[];
    reviewsReceived: UserReviewRow[];
    supportTickets: UserSupportRow[];
  }): void {
    this.profile = data.profile;
    this.demands = data.demands;
    this.travels = data.travels;
    this.requests = data.requests;
    this.transactions = data.transactions;
    this.reviewsGiven = data.reviewsGiven;
    this.reviewsReceived = data.reviewsReceived;
    this.supportTickets = data.supportTickets;

    const displayName = this.asText(data.profile.fullName);
    this.breadCrumbItems = [
      { label: 'Users', link: '/backend/users' },
      { label: displayName, active: true },
    ];
  }

  private fetchDemands(userId: number) {
    return this.demandsService.demandControllerGetDemands({
      userId,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => response?.items ?? []),
      catchError(() => of([])),
    );
  }

  private fetchTravels(userId: number) {
    return this.travelsService.travelControllerGetAll({
      userId,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => response?.items ?? []),
      catchError(() => of([])),
    );
  }

  private fetchRequestsAsRequester(userId: number) {
    return this.requestsService.requestControllerGetAllRequests({
      requesterId: userId,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => response?.items ?? []),
      catchError(() => of([])),
    );
  }

  private fetchRequestsAsTraveler(email: string) {
    return this.requestsService.requestControllerGetAllRequests({
      travelerEmail: email,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => response?.items ?? []),
      catchError(() => of([])),
    );
  }

  private fetchTransactionsAsPayer(userId: number) {
    return this.transactionsService.transactionControllerGetAllTransactions({
      payerId: userId,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => response?.items ?? []),
      catchError(() => of([])),
    );
  }

  private fetchTransactionsAsPayee(userId: number) {
    return this.transactionsService.transactionControllerGetAllTransactions({
      payeeId: userId,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => response?.items ?? []),
      catchError(() => of([])),
    );
  }

  private fetchReviewsGiven(userId: number) {
    return this.reviewsService.reviewControllerGetAllReviews({
      reviewerId: userId,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => this.mapReviews(response?.items ?? [], 'reviewee')),
      catchError(() => of([])),
    );
  }

  private fetchReviewsReceived(userId: number) {
    return this.reviewsService.reviewControllerGetAllReviews({
      revieweeId: userId,
      page: 1,
      limit: ACTIVITY_LIMIT,
      orderBy: 'createdAt:desc',
    }).pipe(
      map((response: any) => this.mapReviews(response?.items ?? [], 'reviewer')),
      catchError(() => of([])),
    );
  }

  private fetchSupportTickets(email: string) {
    return this.supportsService.supportControllerGetSupportRequests({
      email,
      page: 1,
      limit: ACTIVITY_LIMIT,
    }).pipe(
      map((response: any) => (response?.items ?? []).map((item: any) => ({
        id: item.id,
        category: item.category,
        status: item.status,
        subject: item.subject,
        createdAt: item.createdAt,
      })) as UserSupportRow[]),
      catchError(() => of([])),
    );
  }

  private fetchListMeta(email: string) {
    if (!email || email === '—') {
      return of({} as UserDetailsState);
    }

    return this.usersService.userControllerGetAllOperators({
      roleCode: 'USER',
      email,
      page: 1,
      limit: 1,
    }).pipe(
      map((response: any) => {
        const item = response?.items?.[0];
        if (!item) {
          return {} as UserDetailsState;
        }
        this.accountStatus = item.isDeactivated ? 'Deactivated' : 'Active';
        return {
          isDeactivated: item.isDeactivated,
          rating: item.rating,
          numberOfReviews: item.numberOfReviews,
        } as UserDetailsState;
      }),
      catchError(() => of({} as UserDetailsState)),
    );
  }

  private mapReviews(items: any[], counterpartyKey: 'reviewer' | 'reviewee'): UserReviewRow[] {
    return items.map((item) => {
      const counterparty = item[counterpartyKey];
      const name = counterparty
        ? `${counterparty.firstName ?? ''} ${counterparty.lastName ?? ''}`.trim()
        : undefined;
      return {
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        createdAt: item.createdAt,
        counterparty: name || counterparty?.email,
      };
    });
  }
}
