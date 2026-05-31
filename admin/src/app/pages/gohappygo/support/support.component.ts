import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild, NgZone } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { 
  SupportRequestResponseDto, 
  SupportCategory, 
  SupportRequesterType,
  RespondSupportRequestDto 
} from 'src/app/gohappygobackend/models';
import { SupportsService } from 'src/app/gohappygobackend/services/supports.service';

export interface SupportRequestFilters {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'RESOLVING' | 'CLOSED';
  category?: SupportCategory;
  requesterType?: SupportRequesterType;
  email?: string;
}

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = ['id', 'email', 'status', 'category', 'requesterType', 'createdAt', 'actions'];
  dataSource: MatTableDataSource<SupportRequestResponseDto> = new MatTableDataSource<SupportRequestResponseDto>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: SupportRequestFilters = {
    page: 1,
    limit: 10
  };
  
  // Filter controls
  statusFilterControl = new FormControl('');
  categoryFilterControl = new FormControl('');
  requesterTypeFilterControl = new FormControl('');
  emailSearchControl = new FormControl('');

  // Modal properties
  showDetailModal = false;
  showRespondModal = false;
  selectedRequest: SupportRequestResponseDto | null = null;
  isSubmitting = false;

  // Computed property for backdrop visibility
  get showBackdrop(): boolean {
    return this.showDetailModal || this.showRespondModal;
  }

  // Form for responding
  respondForm: FormGroup;

  // Enums for dropdowns
  statusOptions: Array<{value: string, label: string}> = [
    { value: '', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'RESOLVING', label: 'Resolving' },
    { value: 'CLOSED', label: 'Closed' }
  ];

  categoryOptions: Array<{value: SupportCategory | '', label: string}> = [
    { value: '', label: 'All Categories' },
    { value: SupportCategory.Technical, label: 'Technical' },
    { value: SupportCategory.Billing, label: 'Billing' },
    { value: SupportCategory.Financial, label: 'Financial' },
    { value: SupportCategory.Informational, label: 'Informational' },
    { value: SupportCategory.General, label: 'General' },
    { value: SupportCategory.Other, label: 'Other' }
  ];

  requesterTypeOptions: Array<{value: SupportRequesterType | '', label: string}> = [
    { value: '', label: 'All Types' },
    { value: SupportRequesterType.Visitor, label: 'Visitor' },
    { value: SupportRequesterType.User, label: 'User' }
  ];

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private supportsService: SupportsService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Support' }, { label: 'Support Requests Management', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadSupportRequests();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Initialize the respond form
   */
  private initializeForm(): void {
    this.respondForm = new FormGroup({
      message: new FormControl('', [Validators.required, Validators.minLength(10)])
    });
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // Email search
    this.emailSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.email = value || undefined;
        this.filters.page = 1;
        this.loadSupportRequests();
      });

    // Status filter
    this.statusFilterControl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(value => {
          this.filters.status = value as 'PENDING' | 'RESOLVING' | 'CLOSED';
        this.filters.page = 1;
        this.loadSupportRequests();
      });

    // Category filter
    this.categoryFilterControl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(value => {
        this.filters.category = value as SupportCategory;
        this.filters.page = 1;
        this.loadSupportRequests();
      });

    // Requester type filter
    this.requesterTypeFilterControl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(value => {
        this.filters.requesterType = value as SupportRequesterType;
        this.filters.page = 1;
        this.loadSupportRequests();
      });
  }

  /**
   * Load support requests from API
   */
  loadSupportRequests(): void {
    this.isLoading = true;
    
    this.supportsService.supportControllerGetSupportRequests(this.filters).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.dataSource.data = response.data;
          this.totalItems = response.total || 0;
          this.currentPage = response.page || 1;
          this.pageSize = response.limit || 10;
          
          // Force change detection
          this.cdr.detectChanges();
        } else {
          this.dataSource.data = [];
          this.totalItems = 0;
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading support requests:', error);
        this.notificationService.error('Failed to load support requests. Please try again.');
        this.isLoading = false;
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
    this.loadSupportRequests();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    // Sorting is handled server-side by the API
    this.loadSupportRequests();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.statusFilterControl.setValue('');
    this.categoryFilterControl.setValue('');
    this.requesterTypeFilterControl.setValue('');
    this.emailSearchControl.setValue('');
    
    this.filters = {
      page: 1,
      limit: this.pageSize
    };
    
    this.loadSupportRequests();
  }

  /**
   * Open detail modal to view support request
   */
  openDetailModal(request: SupportRequestResponseDto): void {
    // Fetch full details with logs
    this.supportsService.supportControllerGetSupportRequestById({ id: request.id }).subscribe({
      next: (response) => {
        this.selectedRequest = response;
        this.showDetailModal = true;
        // Prevent body scroll when modal is open
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading support request details:', error);
        this.notificationService.error('Failed to load support request details.');
      }
    });
  }

  /**
   * Close detail modal
   */
  closeDetailModal(): void {
    if (!this.showDetailModal) return; // Prevent double-closing
    
    this.ngZone.run(() => {
      this.showDetailModal = false;
      this.selectedRequest = null;
      // Remove any body classes that might be causing overlay
      if (!this.showRespondModal) {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
      }
      // Force immediate change detection
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  /**
   * Open respond modal
   */
  openRespondModal(request: SupportRequestResponseDto): void {
    // Close detail modal if open
    if (this.showDetailModal) {
      this.showDetailModal = false;
    }
    this.selectedRequest = request;
    this.respondForm.reset();
    this.showRespondModal = true;
    // Prevent body scroll when modal is open
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    this.cdr.detectChanges();
  }

  /**
   * Handle backdrop click
   */
  handleBackdropClick(): void {
    if (this.showRespondModal) {
      this.closeRespondModal();
    } else if (this.showDetailModal) {
      this.closeDetailModal();
    }
  }

  /**
   * Close respond modal
   */
  closeRespondModal(): void {
    if (!this.showRespondModal) return; // Prevent double-closing
    
    this.ngZone.run(() => {
      this.showRespondModal = false;
      this.selectedRequest = null;
      this.respondForm.reset();
      // Remove any body classes that might be causing overlay
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      // Force immediate change detection
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  /**
   * Submit response to support request
   */
  onSubmitResponse(): void {
    if (this.respondForm.valid && !this.isSubmitting && this.selectedRequest) {
      this.isSubmitting = true;
      const formData = this.respondForm.value;

      const respondDto: RespondSupportRequestDto = {
        message: formData.message
      };

      this.supportsService.supportControllerRespondToSupportRequest({
        id: this.selectedRequest.id,
        body: respondDto
      }).subscribe({
        next: (response) => {
          this.notificationService.success('Response sent successfully');
          this.ngZone.run(() => {
            this.showRespondModal = false;
            this.selectedRequest = null;
            this.respondForm.reset();
            this.isSubmitting = false;
            // Remove body classes
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            this.cdr.detectChanges();
            this.loadSupportRequests();
          });
        },
        error: (error) => {
          console.error('Error responding to support request:', error);
          
          if (error.status === 400) {
            const errorMessage = error.error?.message || 'Invalid response data provided';
            this.notificationService.error(errorMessage);
          } else if (error.status === 401) {
            this.notificationService.error('You are not authorized to respond to support requests');
          } else if (error.status === 403) {
            this.notificationService.error('You do not have permission to respond to support requests');
          } else if (error.status === 404) {
            this.notificationService.error('Support request not found');
          } else {
            this.notificationService.error('Failed to send response. Please try again.');
          }
          
          this.isSubmitting = false;
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  /**
   * Close support request
   */
  onCloseRequest(request: SupportRequestResponseDto): void {
    const message = `Are you sure you want to close support request #${request.id}? This action cannot be undone!`;
    
    if (confirm(message)) {
      this.supportsService.supportControllerCloseSupportRequest({ id: request.id }).subscribe({
        next: (response) => {
          this.notificationService.success('Support request closed successfully');
          this.loadSupportRequests();
          if (this.selectedRequest && this.selectedRequest.id === request.id) {
            this.selectedRequest = response;
          }
        },
        error: (error) => {
          console.error('Error closing support request:', error);
          
          if (error.status === 404) {
            this.notificationService.error('Support request not found');
          } else if (error.status === 401) {
            this.notificationService.error('You are not authorized to close support requests');
          } else if (error.status === 403) {
            this.notificationService.error('You do not have permission to close support requests');
          } else {
            this.notificationService.error('Failed to close support request. Please try again.');
          }
        }
      });
    }
  }

  /**
   * Mark all form fields as touched to show validation errors
   */
  private markFormGroupTouched(): void {
    Object.keys(this.respondForm.controls).forEach(key => {
      const control = this.respondForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'badge-warning';
      case 'RESOLVING':
        return 'badge-info';
      case 'CLOSED':
        return 'badge-success';
      default:
        return 'badge-secondary';
    }
  }

  /**
   * Get category badge class
   */
  getCategoryBadgeClass(category: string): string {
    switch (category) {
      case 'TECHNICAL':
        return 'badge-primary';
      case 'BILLING':
        return 'badge-danger';
      case 'FINANCIAL':
        return 'badge-warning';
      case 'INFORMATIONAL':
        return 'badge-info';
      case 'GENERAL':
        return 'badge-secondary';
      default:
        return 'badge-dark';
    }
  }
}
