import { AfterViewInit, Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CountrySearchOption, toPhoneSearchQuery } from 'src/app/core/utils/phone-display.util';
import { NotificationService } from 'src/app/core/services/notification.service';
import { UserListItemResponseDto } from 'src/app/gohappygobackend/models';
import { AuthService, UsersService } from 'src/app/gohappygobackend/services';
import Swal from 'sweetalert2';

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

interface VerificationUserSummary {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isVerified: boolean;
  createdAt: string;
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

  selectedUser: VerificationUserSummary | null = null;
  canBeApproved = false;
  selectedFile = '';
  selectedPurpose = '';
  isSubmitting = false;
  isDeletingFiles = false;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild('viewVerificationFilesModal') viewVerificationFilesModal: TemplateRef<any>;
  @ViewChild('imageModal') imageModal: TemplateRef<any>;

  private currentDialogRef: MatDialogRef<any> | null = null;

  verificationFiles: any[] = [];

  constructor(
    private userService: UsersService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
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

    const requestFilters: UserListFilters = {
      ...this.filters,
      roleCode: 'USER',
    };

    this.userService.userControllerGetAllOperators(requestFilters).subscribe({
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

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatRating(rating: number | null | undefined): string {
    if (rating == null || typeof rating !== 'number') {
      return '—';
    }
    return rating.toFixed(2);
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

  onDeleteUser(user: UserListItemResponseDto): void {
    Swal.fire({
      title: 'Delete User?',
      text: `Are you sure you want to permanently delete ${user.fullName}? This action cannot be undone!`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete permanently!',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary ms-2'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteUser(user);
      }
    });
  }

  onViewUser(user: UserListItemResponseDto): void {
    Swal.fire({
      title: user.fullName,
      html: `
        <div class="text-start">
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Phone:</strong> ${user.phone}</p>
          <p><strong>Role:</strong> ${user.role?.code || 'N/A'}</p>
          <p><strong>Verified:</strong> ${user.isVerified ? 'Yes' : 'No'}</p>
          <p><strong>Stripe Verified:</strong> ${user.isStripeVerified ? 'Yes' : 'No'}</p>
          <p><strong>Awaiting Verification:</strong> ${user.isAwaitingVerification ? 'Yes' : 'No'}</p>
          <p><strong>Rating:</strong> ${this.formatRating(typeof user.rating === 'number' ? user.rating : null)} (${user.numberOfReviews} reviews)</p>
          <p><strong>Status:</strong> ${user.isDeactivated ? 'Deactivated' : 'Active'}</p>
          <p><strong>Created:</strong> ${this.formatDate(user.createdAt)}</p>
        </div>
      `,
      icon: 'info',
      confirmButtonColor: '#556ee6',
      confirmButtonText: 'Close'
    });
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

  private deleteUser(user: UserListItemResponseDto): void {
    this.isLoading = true;

    Swal.fire({
      title: 'Deleting...',
      text: 'Please wait while we delete the user.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.userService.userControllerDeleteStaff({ id: user.id }).subscribe({
      next: () => {
        Swal.fire({
          title: 'Deleted!',
          text: `${user.fullName} has been deleted permanently.`,
          icon: 'success',
          confirmButtonColor: '#34c38f'
        });
        this.loadUsers();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to delete user. Please try again.',
          icon: 'error',
          confirmButtonColor: '#f46a6a'
        });
        this.isLoading = false;
      }
    });
  }

  async onReviewKYC(user: UserListItemResponseDto): Promise<void> {
    try {
      this.isSubmitting = true;

      this.authService.authControllerGetUserVerificationFiles({ userId: user.id }).subscribe({
        next: (response: any) => {
          this.selectedUser = response.user;
          this.verificationFiles = response.verificationFiles;
          this.canBeApproved = response.canBeApproved ?? false;

          const dialogRef = this.dialog.open(this.viewVerificationFilesModal, {
            disableClose: true
          });

          dialogRef.afterClosed().subscribe(() => {
            this.selectedUser = null;
            this.verificationFiles = [];
            this.canBeApproved = false;
          });

          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error loading verification files:', error);
          this.notificationService.error('Failed to load verification files');
          this.isSubmitting = false;
        }
      });
    } catch (error) {
      console.error('Error loading verification files:', error);
      this.notificationService.error('Failed to load verification files');
      this.isSubmitting = false;
    }
  }

  async approveVerification(approved: boolean): Promise<void> {
    if (!this.selectedUser) return;

    try {
      this.isSubmitting = true;

      if (approved) {
        const result = await Swal.fire({
          title: 'Approve User Verification?',
          text: `Are you sure you want to approve the verification for ${this.selectedUser.fullName}? This action is irreversible.`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#28a745',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes, approve!',
          cancelButtonText: 'Cancel',
          reverseButtons: true,
          customClass: {
            confirmButton: 'btn btn-success',
            cancelButton: 'btn btn-secondary ms-2'
          }
        });

        if (result.isConfirmed) {
          await this.submitVerificationDecision(approved);
        }
      } else {
        const result = await Swal.fire({
          title: 'Reject User Verification?',
          text: `Are you sure you want to reject the verification for ${this.selectedUser.fullName}?`,
          icon: 'warning',
          input: 'textarea',
          inputLabel: 'Reason for rejection *',
          inputPlaceholder: 'Enter the reason for rejection...',
          inputAttributes: {
            'aria-label': 'Reason for rejection',
            'aria-describedby': 'swal2-description',
            'required': 'true'
          },
          showCancelButton: true,
          confirmButtonColor: '#dc3545',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes, reject!',
          cancelButtonText: 'Cancel',
          reverseButtons: true,
          inputValidator: (value) => {
            if (!value || value.trim().length === 0) {
              return 'You need to provide a reason for rejection!';
            }
            if (value.length > 500) {
              return 'Reason cannot exceed 500 characters';
            }
            return null;
          },
          customClass: {
            confirmButton: 'btn btn-danger',
            cancelButton: 'btn btn-secondary ms-2'
          }
        });

        if (result.isConfirmed && result.value) {
          await this.submitVerificationDecision(approved, result.value.trim());
        }
      }
    } catch (error) {
      console.error('Error updating verification status:', error);
      this.notificationService.error('Failed to update verification status');
    } finally {
      this.isSubmitting = false;
    }
  }

  private async submitVerificationDecision(approved: boolean, reason?: string): Promise<void> {
    try {
      const requestBody = {
        approved,
        reason: reason || undefined
      };

      if (!approved) {
        this.isDeletingFiles = true;

        Swal.fire({
          title: 'Processing Rejection...',
          text: 'Deleting verification files and sending notification...',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
      }

      await this.authService.authControllerVerifyUserAccount({
        id: this.selectedUser!.id,
        body: requestBody
      }).toPromise();

      if (!approved) {
        Swal.close();
      }

      await Swal.fire({
        title: `${approved ? 'Approved' : 'Rejected'}!`,
        text: `User verification has been ${approved ? 'approved' : 'rejected'} successfully.${!approved ? ' Verification files have been deleted.' : ''}`,
        icon: 'success',
        confirmButtonColor: approved ? '#28a745' : '#dc3545',
        confirmButtonText: 'OK'
      });

      this.dialog.closeAll();
      this.loadUsers();
    } catch (error) {
      if (!approved) {
        Swal.close();
      }

      console.error('Error submitting verification decision:', error);
      throw error;
    } finally {
      this.isDeletingFiles = false;
    }
  }

  onApproveClick(): void {
    this.approveVerification(true);
  }

  onRejectClick(): void {
    this.approveVerification(false);
  }

  getFileIcon(purpose: string): string {
    switch (purpose) {
      case 'SELFIE': return 'face';
      case 'ID_FRONT': return 'credit_card';
      case 'ID_BACK': return 'credit_card';
      default: return 'description';
    }
  }

  getFilePurposeLabel(purpose: string): string {
    switch (purpose) {
      case 'SELFIE': return 'Selfie';
      case 'ID_FRONT': return 'ID Front';
      case 'ID_BACK': return 'ID Back';
      default: return purpose;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  openImageModal(imageUrl: string, purpose: string): void {
    this.selectedFile = imageUrl;
    this.selectedPurpose = purpose;
    const dialogRef = this.dialog.open(this.imageModal, {});
    dialogRef.afterClosed().subscribe(() => {
      this.selectedFile = '';
      this.selectedPurpose = '';
    });
  }
}
