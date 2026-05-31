import { AfterViewInit, Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { FormControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { GlobalFormBuilder } from 'src/app/core/globalFormBuilder';
import { NotificationService } from 'src/app/core/services/notification.service';
import { UploadedFileResponseDto, UserResponseDto } from 'src/app/gohappygobackend/models';
import { AuthService, RoleService, UsersService } from 'src/app/gohappygobackend/services';
import { CommonService } from 'src/app/core/services/common.service';
import Swal from 'sweetalert2';

// Update the StaffFilters interface to match the API types
export interface StaffFilters {
  page?: number;
  limit?: number;
  email?: string;
  phone?: string;
  isPhoneVerified?: boolean;
  isVerified?: boolean;
  roleId?: number;
  orderBy?: 'createdAt:desc' | 'createdAt:asc' | 'deliveryDate:asc' | 'deliveryDate:desc' | 'pricePerKg:asc' | 'pricePerKg:desc';
}
@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  // Table properties
  displayedColumns: string[] = ['username', 'email','phone', 'status','isVerified', 'isPhoneVerified', 'actions'];
  dataSource: MatTableDataSource<UserResponseDto> = new MatTableDataSource<UserResponseDto>([]);
 
   // Pagination properties
   totalItems = 0;
   currentPage = 1;
   pageSize = 10;
   pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: StaffFilters = {
    page: 1,
    limit: 10,
    roleId:2,
    orderBy: 'createdAt:desc' as const
  };
  
  // Search controls
  emailSearchControl = new FormControl('');
  phoneSearchControl = new FormControl('');
  
  // Filter controls
  isVerifiedFilter = new FormControl<boolean | null>(null);
  isPhoneVerifiedFilter = new FormControl<boolean | null>(null);
  roleFilter = new FormControl<number | null>(null);
  
  // Role options (you can fetch this from your backend)
  roleOptions = [];

  Math = Math;

  selectedUser: UserResponseDto | null = null;
  selectedFile = ""
  selectedPurpose = ""
  isSubmitting = false;
  isEditMode = false;
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
   private userRoleService: RoleService,
   private globalFormBuilder: GlobalFormBuilder, 
     private notificationService: NotificationService,
     private dialog: MatDialog,
     private fb: FormBuilder,
     private commonService: CommonService
 ){

 }


 
 ngOnInit(): void {
  this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Users Management', active: true }];

// Set up search debouncing
this.setupSearchDebouncing();
  
// Load initial data
this.loadUsers();

//load user roles
this.loadUserRoles()
}

ngAfterViewInit() {
  this.dataSource.paginator = this.paginator;
  this.dataSource.sort = this.sort;
}

applyFilters(event: Event) {
  const filterValue = (event.target as HTMLInputElement).value;
  this.dataSource.filter = filterValue.trim().toLowerCase();

  if (this.dataSource.paginator) {
    this.dataSource.paginator.firstPage();
  }
}



/**
 * Load staff data from API
 */
loadUsers(): void {
  this.isLoading = true;
  
  // Always ensure roleId=2 is set for users (not staff)
  const requestFilters = {
    ...this.filters,
    roleId: 2 // Always force roleId=2 for users
  };
  
  this.userService.userControllerGetAllOperators(requestFilters).subscribe({
    next: (response: any) => {
      
      // Handle the actual response structure: {items: Array, meta: Object}
      if (response && response.items) {
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

  /**
 * Load user roles data from API
 */

loadUserRoles(): void {
  const requestParams = {
    page:1,
    limit:10 as number,
    code:''
  }
  this.userRoleService.roleControllerGetAllRoles(requestParams).subscribe({
    next: (response: any) => {
      console.log("user roles", response.items);
    // Filter out multiple roles
    const excludedRoles = ['ADMIN', 'OPERATOR']; // Add more roles to exclude if needed
    this.roleOptions = response.items.filter((role: any) => 
      !excludedRoles.includes(role.code.toUpperCase())
    );
    },
    error: (error) => {
      console.error('Error loading user roles:', error);
      this.notificationService.error('Failed to load user roles. Please try again.');
    }
  });
}

/**
 * Handle pagination changes
 */
onPageChange(event: PageEvent): void {
  this.filters.page = event.pageIndex + 1;
  this.filters.limit = event.pageSize;
  this.currentPage = event.pageIndex + 1;
  this.pageSize = event.pageSize;
  this.loadUsers(); // This will automatically include roleId=2
}

/**
 * Handle sorting changes
 */
onSortChange(event: Sort): void {
  if (event.direction && event.active === 'createdAt') {
    this.filters.orderBy = `createdAt:${event.direction}` as 'createdAt:asc' | 'createdAt:desc';
  } else {
    this.filters.orderBy = 'createdAt:desc';
  }
  this.loadUsers(); // This will automatically include roleId=2
}

/**
 * Apply search filters
 */
applySearchFilters(): void {
  this.filters.page = 1; // Reset to first page
  this.filters.email = this.emailSearchControl.value || undefined;
  this.filters.phone = this.phoneSearchControl.value || undefined;
  this.filters.isVerified = this.isVerifiedFilter.value;
  this.filters.isPhoneVerified = this.isPhoneVerifiedFilter.value;
  // Note: roleId is not included here as it's always forced to 2 in loadUsers()
  
  this.loadUsers(); // This will automatically include roleId=2
}

/**
 * Clear all filters
 */
clearFilters(): void {
  this.emailSearchControl.setValue('');
  this.phoneSearchControl.setValue('');
  this.isVerifiedFilter.setValue(null);
  this.isPhoneVerifiedFilter.setValue(null);
  
  this.filters = {
    page: 1,
    limit: this.pageSize,
    roleId: 2, // Always maintain roleId=2
    orderBy: 'createdAt:desc' as const
  };
  
  this.loadUsers();
}


/**
 * Format date for display
 */
formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}



  /**
 * Set up search input debouncing
 */
  private setupSearchDebouncing(): void {
    // Email search debouncing
    this.emailSearchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(value => {
      this.filters.email = value || undefined;
      this.filters.roleId = 2
      this.filters.page = 1; // Reset to first page
      this.loadUsers();
    });

    // Phone search debouncing
    this.phoneSearchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(value => {
      this.filters.phone = value || undefined;
      this.filters.page = 1; // Reset to first page
      this.loadUsers();
    });
  }





/**
* Get modal title based on mode
*/
getModalTitle(): string {
return this.isEditMode ? 'Edit Staff Member' : 'Create New Staff Member';
}


/**
 * Deactivate user member with confirmation
 */
onDeactivateUser(staff: UserResponseDto): void {
  Swal.fire({
    title: 'Deactivate Staff Member?',
    text: `Are you sure you want to deactivate ${staff.fullName}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f46a6a',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Yes, deactivate!',
    cancelButtonText: 'Cancel',
    reverseButtons: true
  }).then((result) => {
    if (result.isConfirmed) {
      this.toggleStaffActivation(staff, true);
    }
  });
}

/**
 * Activate user member with confirmation
 */
onActivateUser(staff: UserResponseDto): void {
  Swal.fire({
    title: 'Activate Staff Member?',
    text: `Are you sure you want to activate ${staff.fullName}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#34c38f',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Yes, activate!',
    cancelButtonText: 'Cancel',
    reverseButtons: true
  }).then((result) => {
    if (result.isConfirmed) {
      this.toggleStaffActivation(staff, false);
    }
  });
}

/**
 * Delete staff member with confirmation
 */
onDeleteUser(user: UserResponseDto): void {
  Swal.fire({
    title: 'Delete User ?',
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

/**
 * View staff member details
 */
onViewStaff(user: UserResponseDto): void {
  Swal.fire({
    title: `${user.fullName}`,
    html: `
      <div class="text-start">
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Phone:</strong> ${user.phone}</p>
        <p><strong>Role:</strong> ${user.role?.code || 'N/A'}</p>
        <p><strong>Verified:</strong> ${user.isVerified ? 'Yes' : 'No'}</p>
        <p><strong>Phone Verified:</strong> ${user.isPhoneVerified ? 'Yes' : 'No'}</p>
        <p><strong>Status:</strong> ${user.isDeactivated ? 'Deactivated' : 'Active'}</p>
        <p><strong>Created:</strong> ${this.formatDate(user.createdAt)}</p>
      </div>
    `,
    icon: 'info',
    confirmButtonColor: '#556ee6',
    confirmButtonText: 'Close'
  });
}

/**
 * Execute deactivate staff API call
 */
private toggleStaffActivation(staff: UserResponseDto, isDeactivated: boolean): void {
  this.userService.userControllerToggleStaffActivation({
    id: staff.id,
    body: { isDeactivated }
  }).subscribe({
      next: (response) => {
        const action = isDeactivated ? 'deactivated' : 'activated';
        Swal.fire({
          title: `${action.charAt(0).toUpperCase() + action.slice(1)}!`,
          text: `${staff.fullName} has been ${action} successfully.`,
          icon: 'success',
          confirmButtonColor: '#34c38f'
        });
        this.loadUsers();
      },
    error: (error) => {
      console.error(`Error ${isDeactivated ? 'deactivating' : 'activating'} staff:`, error);
      Swal.fire({
        title: 'Error!',
        text: `Failed to ${isDeactivated ? 'deactivate' : 'activate'} staff member. Please try again.`,
        icon: 'error',
        confirmButtonColor: '#f46a6a'
      });
    }
  });
}

/**
 * Execute delete staff API call
 */
private deleteUser(staff: UserResponseDto): void {
  this.isLoading = true;
  
  // Show loading state
  Swal.fire({
    title: 'Deleting...',
    text: 'Please wait while we delete the staff member.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  // Call your API to delete the staff member
  this.userService.userControllerDeleteStaff({
    id: staff.id
  }).subscribe({
      next: (response) => {
        Swal.fire({
          title: 'Deleted!',
          text: `${staff.fullName} has been deleted permanently.`,
          icon: 'success',
          confirmButtonColor: '#34c38f'
        });
        this.loadUsers(); // Refresh the table
        this.isLoading = false;
      },
    error: (error) => {
      console.error('Error deleting staff:', error);
      Swal.fire({
        title: 'Error!',
        text: 'Failed to delete staff member. Please try again.',
        icon: 'error',
        confirmButtonColor: '#f46a6a'
      });
      this.isLoading = false;
    }
  });
}

// Add method to view verification files
async onReviewKYC(user: any): Promise<void> {
  try {
    this.isSubmitting = true;
    
    // Call the API to get verification files
    this.authService.authControllerGetUserVerificationFiles({userId: user.id}).subscribe({
      next: (response: any) => {
        console.log('Verification files response:', response);
        
        // Store the data in component properties
        this.selectedUser = response.user;
        this.verificationFiles = response.verificationFiles;
        
        // Open the modal AFTER data is loaded
        const dialogRef = this.dialog.open(this.viewVerificationFilesModal, {
          disableClose: true
          // Remove data property, use component properties instead
        });

        dialogRef.afterClosed().subscribe(() => {
          this.selectedUser = null;
          this.verificationFiles = [];
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

// Update the approveVerification method with enhanced SweetAlert flows
async approveVerification(approved: boolean): Promise<void> {
  if (!this.selectedUser) return;
  
  try {
    this.isSubmitting = true;
    
    if (approved) {
      // Approval flow - confirmation only
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
      // Rejection flow - requires reason
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

// Add a separate method to submit the verification decision
private async submitVerificationDecision(approved: boolean, reason?: string): Promise<void> {
  try {
    const requestBody = {
      approved,
      reason: reason || undefined
    };

    // Show loading state for rejection (file deletion)
    if (!approved) {
      this.isDeletingFiles = true;
      
      // Show loading message
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
    
    // Close loading dialog
    if (!approved) {
      Swal.close();
    }
    
    // Show success message
    await Swal.fire({
      title: `${approved ? 'Approved' : 'Rejected'}!`,
      text: `User verification has been ${approved ? 'approved' : 'rejected'} successfully.${!approved ? ' Verification files have been deleted.' : ''}`,
      icon: 'success',
      confirmButtonColor: approved ? '#28a745' : '#dc3545',
      confirmButtonText: 'OK'
    });
    
    // Close all modals and refresh data
    this.dialog.closeAll();
    this.loadUsers();
    
  } catch (error) {
    // Close loading dialog if open
    if (!approved) {
      Swal.close();
    }
    
    console.error('Error submitting verification decision:', error);
    throw error; // Re-throw to be caught by the calling method
  } finally {
    this.isDeletingFiles = false;
  }
}

// Add method to handle approval button click
onApproveClick(): void {
  this.approveVerification(true);
}

// Add method to handle rejection button click
onRejectClick(): void {
  this.approveVerification(false);
}

// Add these helper methods
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
      this.selectedFile = imageUrl
    this.selectedPurpose = purpose
  const dialogRef = this.dialog.open(this.imageModal, {
    
  });
  dialogRef.afterClosed().subscribe(() => {
    this.selectedFile = "";
    this.selectedPurpose = "";
  });
}


}
