import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CountrySearchOption, toPhoneSearchQuery } from 'src/app/core/utils/phone-display.util';
import { NotificationService } from 'src/app/core/services/notification.service';
import { UserListItemResponseDto } from 'src/app/gohappygobackend/models';
import { UsersService } from 'src/app/gohappygobackend/services';
import Swal from 'sweetalert2';
import { UserDetailsState } from './user-details/user-details.model';

export interface UserListFilters {
  page?: number;
  limit?: number;
  email?: string;
  phone?: string;
  isStripeVerified?: boolean;
  isVerified?: boolean;
  roleCode?: string;
  orderBy?: 'createdAt:desc' | 'createdAt:asc' | 'deliveryDate:asc' | 'deliveryDate:desc' | 'pricePerKg:asc' | 'pricePerKg:desc';
}

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  displayedColumns: string[] = ['fullName', 'email', 'phone', 'status', 'isVerified', 'isStripeVerified', 'rating', 'actions'];
  dataSource: MatTableDataSource<UserListItemResponseDto> = new MatTableDataSource<UserListItemResponseDto>([]);

  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  isLoading = false;

  filters: UserListFilters = {
    page: 1,
    limit: 10,
    roleCode: 'USER',
    orderBy: 'createdAt:desc' as const
  };

  emailSearchControl = new FormControl('');
  phoneSearchControl = new FormControl('');
  phoneCountryControl = new FormControl<string | null>(null);
  selectedPhoneDialCode: string | undefined;
  isVerifiedFilter = new FormControl<boolean | null>(null);
  isStripeVerifiedFilter = new FormControl<boolean | null>(null);

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private userService: UsersService,
    private notificationService: NotificationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Users Management', active: true }];
    this.setupSearchDebouncing();
    this.setupFilterControls();
    this.loadUsers();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadUsers(): void {
    this.isLoading = true;

    this.userService.userControllerGetAllOperators({
      ...this.filters,
      roleCode: 'USER',
    }).subscribe({
      next: (response: any) => {
        if (response?.items) {
          this.dataSource.data = response.items;
          this.totalItems = response.meta?.totalItems || 0;
          this.currentPage = response.meta?.currentPage || 1;
          this.pageSize = response.meta?.itemsPerPage || 10;
        } else {
          this.dataSource.data = [];
          this.totalItems = 0;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.notificationService.error('Failed to load users data. Please try again.');
        this.isLoading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.filters.page = event.pageIndex + 1;
    this.filters.limit = event.pageSize;
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }

  onSortChange(event: Sort): void {
    if (event.direction && event.active === 'createdAt') {
      this.filters.orderBy = `createdAt:${event.direction}` as 'createdAt:asc' | 'createdAt:desc';
    } else {
      this.filters.orderBy = 'createdAt:desc';
    }
    this.loadUsers();
  }

  applySearchFilters(): void {
    this.filters.page = 1;
    this.filters.email = this.emailSearchControl.value || undefined;
    this.filters.phone = this.buildPhoneSearchFilter();
    this.filters.isVerified = this.isVerifiedFilter.value ?? undefined;
    this.filters.isStripeVerified = this.isStripeVerifiedFilter.value ?? undefined;
    this.loadUsers();
  }

  clearFilters(): void {
    this.emailSearchControl.setValue('');
    this.phoneSearchControl.setValue('');
    this.phoneCountryControl.setValue(null);
    this.selectedPhoneDialCode = undefined;
    this.isVerifiedFilter.setValue(null);
    this.isStripeVerifiedFilter.setValue(null);

    this.filters = {
      page: 1,
      limit: this.pageSize,
      roleCode: 'USER',
      orderBy: 'createdAt:desc' as const
    };

    this.loadUsers();
  }

  formatRating(rating: number | null | undefined): string {
    if (rating == null || typeof rating !== 'number') {
      return '—';
    }
    return rating.toFixed(2);
  }

  onViewUser(user: UserListItemResponseDto): void {
    const state: UserDetailsState = {
      isDeactivated: user.isDeactivated,
      rating: typeof user.rating === 'number' ? user.rating : null,
      numberOfReviews: user.numberOfReviews,
    };

    this.router.navigate(['/backend/users', user.id], { state });
  }

  onDeactivateUser(user: UserListItemResponseDto): void {
    Swal.fire({
      title: 'Deactivate User?',
      text: `Are you sure you want to deactivate ${user.fullName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f46a6a',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, deactivate!',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.toggleUserActivation(user, true);
      }
    });
  }

  onActivateUser(user: UserListItemResponseDto): void {
    Swal.fire({
      title: 'Activate User?',
      text: `Are you sure you want to activate ${user.fullName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#34c38f',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, activate!',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.toggleUserActivation(user, false);
      }
    });
  }

  private setupSearchDebouncing(): void {
    this.emailSearchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(value => {
      this.filters.email = value || undefined;
      this.filters.roleCode = 'USER';
      this.filters.page = 1;
      this.loadUsers();
    });

    this.phoneSearchControl.valueChanges.pipe(
      debounceTime(500),
      map(() => this.buildPhoneSearchFilter()),
      distinctUntilChanged()
    ).subscribe(value => {
      this.filters.phone = value;
      this.filters.page = 1;
      this.loadUsers();
    });
  }

  private setupFilterControls(): void {
    this.isVerifiedFilter.valueChanges.subscribe(value => {
      this.filters.isVerified = value ?? undefined;
      this.filters.page = 1;
      this.loadUsers();
    });

    this.isStripeVerifiedFilter.valueChanges.subscribe(value => {
      this.filters.isStripeVerified = value ?? undefined;
      this.filters.page = 1;
      this.loadUsers();
    });
  }

  onPhoneCountryChange(country: CountrySearchOption | null): void {
    this.selectedPhoneDialCode = country?.dialCode;
    this.filters.phone = this.buildPhoneSearchFilter();
    this.filters.page = 1;
    this.loadUsers();
  }

  private buildPhoneSearchFilter(): string | undefined {
    return toPhoneSearchQuery(this.phoneSearchControl.value, this.selectedPhoneDialCode);
  }

  private toggleUserActivation(user: UserListItemResponseDto, isDeactivated: boolean): void {
    this.userService.userControllerToggleStaffActivation({
      id: user.id,
      body: { isDeactivated }
    }).subscribe({
      next: () => {
        const action = isDeactivated ? 'deactivated' : 'activated';
        Swal.fire({
          title: `${action.charAt(0).toUpperCase() + action.slice(1)}!`,
          text: `${user.fullName} has been ${action} successfully.`,
          icon: 'success',
          confirmButtonColor: '#34c38f'
        });
        this.loadUsers();
      },
      error: (error) => {
        console.error(`Error ${isDeactivated ? 'deactivating' : 'activating'} user:`, error);
        Swal.fire({
          title: 'Error!',
          text: `Failed to ${isDeactivated ? 'deactivate' : 'activate'} user. Please try again.`,
          icon: 'error',
          confirmButtonColor: '#f46a6a'
        });
      }
    });
  }
}
