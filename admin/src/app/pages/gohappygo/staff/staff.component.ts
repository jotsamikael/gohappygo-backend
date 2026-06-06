import { Component, OnInit, ViewChild, TemplateRef, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { ToastrService } from 'ngx-toastr';
import { finalize, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { CountrySearchOption, toPhoneSearchQuery } from 'src/app/core/utils/phone-display.util';
import { GlobalFormBuilder } from 'src/app/core/globalFormBuilder';
import { CommonService } from 'src/app/core/services/common.service';
import { NotificationService } from 'src/app/core/services/notification.service';
import { UserResponseDto } from 'src/app/gohappygobackend/models';
import { UsersService, RoleService } from 'src/app/gohappygobackend/services';
import Swal from 'sweetalert2';
import {
  CountryISO,
  SearchCountryField,
  PhoneNumberFormat
} from 'ngx-intl-tel-input-gg';




// Update the StaffFilters interface to match the API types
export interface StaffFilters {
  page?: number;
  limit?: number;
  email?: string;
  phone?: string;
  isVerified?: boolean;
  roleCode?: string;
  orderBy?: 'createdAt:desc' | 'createdAt:asc' | 'deliveryDate:asc' | 'deliveryDate:desc' | 'pricePerKg:asc' | 'pricePerKg:desc';
}

@Component({
  selector: 'app-staff',
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.scss']
})
export class StaffComponent implements OnInit {
  SearchCountryField = SearchCountryField;
  CountryISO = CountryISO;
  PhoneNumberFormat = PhoneNumberFormat;

  preferredCountries: CountryISO[] = [
    CountryISO.Cameroon,
    CountryISO.France,
    CountryISO.UnitedStates
  ];
  
  // Country code options for dropdown
  countryOptions = [
    { code: '+237', name: 'Cameroon', flag: '🇨🇲' },
    { code: '+1', name: 'United States', flag: '🇺🇸' },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+33', name: 'France', flag: '🇫🇷' },
    { code: '+49', name: 'Germany', flag: '🇩🇪' },
    { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
    { code: '+225', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
    { code: '+221', name: 'Senegal', flag: '🇸🇳' },
    { code: '+233', name: 'Ghana', flag: '🇬🇭' },
    { code: '+256', name: 'Uganda', flag: '🇺🇬' },
    { code: '+254', name: 'Kenya', flag: '🇰🇪' },
    { code: '+255', name: 'Tanzania', flag: '🇹🇿' },
    { code: '+250', name: 'Rwanda', flag: '🇷🇼' },
    { code: '+27', name: 'South Africa', flag: '🇿🇦' },
    { code: '+212', name: 'Morocco', flag: '🇲🇦' },
    { code: '+216', name: 'Tunisia', flag: '🇹🇳' },
    { code: '+213', name: 'Algeria', flag: '🇩🇿' },
    { code: '+86', name: 'China', flag: '🇨🇳' },
    { code: '+91', name: 'India', flag: '🇮🇳' },
    { code: '+55', name: 'Brazil', flag: '🇧🇷' },
    { code: '+81', name: 'Japan', flag: '🇯🇵' },
    { code: '+82', name: 'South Korea', flag: '🇰🇷' },
    { code: '+61', name: 'Australia', flag: '🇦🇺' },
    { code: '+7', name: 'Russia', flag: '🇷🇺' },
    { code: '+34', name: 'Spain', flag: '🇪🇸' },
    { code: '+39', name: 'Italy', flag: '🇮🇹' },
    { code: '+351', name: 'Portugal', flag: '🇵🇹' },
    { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
    { code: '+32', name: 'Belgium', flag: '🇧🇪' },
    { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
    { code: '+46', name: 'Sweden', flag: '🇸🇪' },
    { code: '+47', name: 'Norway', flag: '🇳🇴' },
    { code: '+45', name: 'Denmark', flag: '🇩🇰' },
    { code: '+358', name: 'Finland', flag: '🇫🇮' },
    { code: '+48', name: 'Poland', flag: '🇵🇱' },
    { code: '+420', name: 'Czech Republic', flag: '🇨🇿' },
    { code: '+36', name: 'Hungary', flag: '🇭🇺' },
    { code: '+40', name: 'Romania', flag: '🇷🇴' },
    { code: '+30', name: 'Greece', flag: '🇬🇷' },
    { code: '+90', name: 'Turkey', flag: '🇹🇷' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', name: 'UAE', flag: '🇦🇪' },
    { code: '+974', name: 'Qatar', flag: '🇶🇦' },
    { code: '+965', name: 'Kuwait', flag: '🇰🇼' },
    { code: '+20', name: 'Egypt', flag: '🇪🇬' },
    { code: '+972', name: 'Israel', flag: '🇮🇱' },
    { code: '+52', name: 'Mexico', flag: '🇲🇽' },
    { code: '+54', name: 'Argentina', flag: '🇦🇷' },
    { code: '+56', name: 'Chile', flag: '🇨🇱' },
    { code: '+57', name: 'Colombia', flag: '🇨🇴' },
    { code: '+51', name: 'Peru', flag: '🇵🇪' },
    { code: '+63', name: 'Philippines', flag: '🇵🇭' },
    { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
    { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '+65', name: 'Singapore', flag: '🇸🇬' },
    { code: '+66', name: 'Thailand', flag: '🇹🇭' },
    { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  ];
  
  // For mat-tel-input
  separateDialCode = true;
  
  breadCrumbItems: Array<{}>;
  // Table properties
  displayedColumns: string[] = ['fullName', 'email','phone', 'role', 'status','isVerified', 'actions'];
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
    roleCode: 'OPERATOR',
    orderBy: 'createdAt:desc' as const
  };
  
  // Search controls
  emailSearchControl = new FormControl('');
  phoneSearchControl = new FormControl('');
  phoneCountryControl = new FormControl<string | null>(null);
  selectedPhoneDialCode: string | undefined;
  
  // Filter controls
  isVerifiedFilter = new FormControl<boolean | null>(null);
  roleFilter = new FormControl<string | null>(null);

    /** ISO 3166-1 alpha-2 codes — shown at top of mat-tel-input country list. */
    readonly phonePreferredCountries: string[] = ['cm', 'fr', 'us', 'gb'];

  
  // Role options (you can fetch this from your backend)
  roleOptions = [];

  Math = Math;

  // Modal properties
  staffForm: FormGroup;
  selectedUser: UserResponseDto | null = null;
  isSubmitting = false;
  isEditMode = false;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild('modalTemplate') modalTemplate: TemplateRef<any>;

  private currentDialogRef: MatDialogRef<any> | null = null;

 constructor(
   private userService: UsersService,
   private userRoleService: RoleService,
   private globalFormBuilder: GlobalFormBuilder, 
     private notificationService: NotificationService,
     private dialog: MatDialog,
     private fb: FormBuilder,
     private commonService: CommonService
 ){
  this.staffForm = this.globalFormBuilder.staffForm()

 }



  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Staff Management', active: true }];
  this.staffForm = this.globalFormBuilder.staffForm()

 // Set up search debouncing
 this.setupSearchDebouncing();
    
 // Load initial data
 this.loadStaff();

 //load user roles
 this.loadUserRoles()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

 

  /**
   * Load staff data from API
   */
  loadStaff(): void {
    this.isLoading = true;
    
    this.userService.userControllerGetAllOperators(this.filters).subscribe({
      next: (response: any) => {
        console.log('Staff data:', response);
        
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
        console.error('Error loading staff:', error);
        this.notificationService.error('Failed to load staff data. Please try again.');
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
      const excludedRoles = ['USER']; // Add more roles to exclude if needed
      this.roleOptions = response.items.filter((role: any) => 
        !excludedRoles.includes(role.code.toUpperCase())
      );
      console.log(this.roleOptions)
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
    this.loadStaff();
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
    this.loadStaff();
  }

  /**
   * Apply filters
   */
  applyFilters(): void {
    this.filters.email = this.emailSearchControl.value || undefined;
    this.filters.phone = this.buildPhoneSearchFilter();
    this.filters.isVerified = this.isVerifiedFilter.value ?? undefined;
    this.filters.roleCode = this.roleFilter.value || undefined;
    this.filters.page = 1;
    this.loadStaff();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.emailSearchControl.setValue('');
    this.phoneSearchControl.setValue('');
    this.phoneCountryControl.setValue(null);
    this.selectedPhoneDialCode = undefined;
    this.isVerifiedFilter.setValue(null);
    this.roleFilter.setValue(null);
    
    this.filters = {
      page: 1,
      roleCode: 'OPERATOR',
      limit: this.pageSize,
      orderBy: 'createdAt:desc'
    };
    
    this.loadStaff();
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
        this.filters.page = 1; // Reset to first page
        this.loadStaff();
      });
  
      // Phone search debouncing
      this.phoneSearchControl.valueChanges.pipe(
        debounceTime(500),
        map(() => this.buildPhoneSearchFilter()),
        distinctUntilChanged()
      ).subscribe(value => {
        this.filters.phone = value;
        this.filters.page = 1;
        this.loadStaff();
      });
    }

  onPhoneCountryChange(country: CountrySearchOption | null): void {
    this.selectedPhoneDialCode = country?.dialCode;
    this.filters.phone = this.buildPhoneSearchFilter();
    this.filters.page = 1;
    this.loadStaff();
  }

  private buildPhoneSearchFilter(): string | undefined {
    return toPhoneSearchQuery(this.phoneSearchControl.value, this.selectedPhoneDialCode);
  }

     /**
   * Open create modal
   */
  onCreateStaff(): void {
    this.isEditMode = false;
    this.selectedUser = null;
    this.commonService.resetForm(this.staffForm)
    
    this.currentDialogRef = this.dialog.open(this.modalTemplate, {
      width: '600px',
      maxWidth: '90vw',
      disableClose: true,
      data: { mode: 'create' }
    });

    this.currentDialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Refresh the table')
        this.loadStaff(); 
      }
      this.currentDialogRef = null;
    });
  }



  /**
   * Open edit modal
   */
  onEditStaff(user: UserResponseDto): void {
    this.isEditMode = true;
    this.selectedUser = user;
    this.populateEditForm(user);
    
    this.currentDialogRef = this.dialog.open(this.modalTemplate, {
      width: '600px',
      maxWidth: '90vw',
      disableClose: true,
      data: { mode: 'edit', user }
    });

    this.currentDialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Refresh the table')
        this.loadStaff(); 
      }
      this.currentDialogRef = null;
    });
  }





/**
 * Populate the form with user data
 */
private populateEditForm(user: UserResponseDto): void {
  this.staffForm.patchValue({
    firstName: user.fullName,
    lastName: user.fullName,
    email: user.email,
    phone: user.phone,
    roleId: user.role?.id,
    isVerified: user.isVerified,
    isPhoneVerified: user.isPhoneVerified
  });
}

/**
 * Submit the form (create or update)
 */
onSubmitForm(): void {
  if (this.staffForm.invalid) {
    return;
  }
  console.log("edit mode")

  this.isSubmitting = true;
  //deactivate form
  this.commonService.disableForm(this.staffForm)
  const formData = {
    email: this.staffForm.value.email,
    firstName: this.staffForm.value.firstName,
    lastName: this.staffForm.value.lastName,
    phoneNumber: this.staffForm.value.phone,
    roleId: this.staffForm.value.roleId
  }

  if (this.isEditMode && this.selectedUser) {
    // Update existing user
    this.userService.userControllerUpdateStaff({
      idUser: this.selectedUser.id, 
      body: formData 
    }).subscribe({
      next: (response) => {
        console.log("edit", response)
        this.notificationService.success('Staff member updated successfully!');
        this.isSubmitting = false;
        this.commonService.enableForm(this.staffForm)
        
        // Close the specific dialog with success result
        if (this.currentDialogRef) {
          this.currentDialogRef.close(true);
        }
      },
      error: (error) => {
        console.error('Error updating staff:', error);
        this.notificationService.error('Failed to update staff member. Please try again.');
        this.isSubmitting = false;
        this.commonService.enableForm(this.staffForm)
      }
    });
  } else {
    // Create new user
    this.userService.userControllerCreateStaff({
      body: formData
    }).subscribe({
      next: (response) => {
        this.notificationService.success('Staff member created successfully!');
        this.isSubmitting = false;
        this.commonService.enableForm(this.staffForm)
        
        // Close the specific dialog with success result
        if (this.currentDialogRef) {
          this.currentDialogRef.close(true);
        }
      },
      error: (error) => {
        console.error('Error creating staff:', error);
        this.notificationService.error('Failed to create staff member. Please try again.');
        this.isSubmitting = false;
        this.commonService.enableForm(this.staffForm)
      }
    });
  }
}



/**
 * Get modal title based on mode
 */
getModalTitle(): string {
  return this.isEditMode ? 'Edit Staff Member' : 'Create New Staff Member';
}

/**
 * Get submit button text based on mode
 */
getSubmitButtonText(): string {
  return this.isEditMode ? 'Update Staff' : 'Create Staff';
}

  /**
   * Deactivate staff member with confirmation
   */
  onDeactivateStaff(staff: UserResponseDto): void {
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
   * Activate staff member with confirmation
   */
  onActivateStaff(staff: UserResponseDto): void {
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
  onDeleteStaff(staff: UserResponseDto): void {
    Swal.fire({
      title: 'Delete Staff Member?',
      text: `Are you sure you want to permanently delete ${staff.fullName}? This action cannot be undone!`,
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
        this.deleteStaff(staff);
      }
    });
  }

  /**
   * View staff member details
   */
  onViewStaff(staff: UserResponseDto): void {
    Swal.fire({
      title: `${staff.fullName}`,
      html: `
        <div class="text-start">
          <p><strong>Email:</strong> ${staff.email}</p>
          <p><strong>Phone:</strong> ${staff.phone}</p>
          <p><strong>Role:</strong> ${staff.role?.code || 'N/A'}</p>
          <p><strong>Verified:</strong> ${staff.isVerified ? 'Yes' : 'No'}</p>
          <p><strong>Phone Verified:</strong> ${staff.isPhoneVerified ? 'Yes' : 'No'}</p>
          <p><strong>Status:</strong> ${staff.isDeactivated ? 'Deactivated' : 'Active'}</p>
          <p><strong>Created:</strong> ${this.formatDate(staff.createdAt)}</p>
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
        this.loadStaff();
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
  private deleteStaff(staff: UserResponseDto): void {
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
        this.loadStaff(); // Refresh the table
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
}

