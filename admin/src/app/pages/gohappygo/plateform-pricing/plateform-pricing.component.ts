import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { PlatformPricingResponseDto, UpdatePlatformPricingDto, CreatePlatformPricingDto } from 'src/app/gohappygobackend/models';
import { PlatformPricingService } from 'src/app/gohappygobackend/services/platform-pricing.service';

export interface PlatformPricingFilters {
  page?: number;
  limit?: number;
  lowerBound?: number;
  upperBound?: number;
}

@Component({
  selector: 'app-plateform-pricing',
  templateUrl: './plateform-pricing.component.html',
  styleUrls: ['./plateform-pricing.component.scss']
})
export class PlateformPricingComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = [ 'lowerBound', 'upperBound', 'fee', 'createdAt', 'updatedAt', 'actions'];
  dataSource: MatTableDataSource<PlatformPricingResponseDto> = new MatTableDataSource<PlatformPricingResponseDto>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: PlatformPricingFilters = {
    page: 1,
    limit: 10
  };
  
  // Search controls
  lowerBoundSearchControl = new FormControl('');
  upperBoundSearchControl = new FormControl('');

  // Modal properties
  showModal = false;
  isEditMode = false;
  selectedPricing: PlatformPricingResponseDto | null = null;
  isSubmitting = false;

  // Form
  pricingForm: FormGroup;

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private platformPricingService: PlatformPricingService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Platform Pricing Management', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadPricing();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Initialize the pricing form
   */
  private initializeForm(): void {
    this.pricingForm = new FormGroup({
      lowerBound: new FormControl('', [Validators.required, Validators.min(0), Validators.max(150)]),
      upperBound: new FormControl('', [Validators.required, Validators.min(0), Validators.max(150)]),
      fee: new FormControl('', [Validators.required, Validators.min(0)])
    }, { validators: this.rangeValidator.bind(this) });
  }

  /**
   * Custom validator to ensure lowerBound < upperBound
   */
  private rangeValidator(form: FormGroup): { [key: string]: any } | null {
    const lowerBound = form.get('lowerBound')?.value;
    const upperBound = form.get('upperBound')?.value;
    
    if (lowerBound !== null && upperBound !== null && lowerBound >= upperBound) {
      return { invalidRange: true };
    }
    
    return null;
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // Lower bound search
    this.lowerBoundSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        const numValue = value ? parseFloat(value) : undefined;
        this.filters.lowerBound = numValue && !isNaN(numValue) ? numValue : undefined;
        this.filters.page = 1;
        this.loadPricing();
      });

    // Upper bound search
    this.upperBoundSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        const numValue = value ? parseFloat(value) : undefined;
        this.filters.upperBound = numValue && !isNaN(numValue) ? numValue : undefined;
        this.filters.page = 1;
        this.loadPricing();
      });
  }

  /**
   * Load platform pricing data from API
   */
  loadPricing(): void {
    this.isLoading = true;
    
    this.platformPricingService.platformPricingControllerFindAll(this.filters).subscribe({
      next: (response) => {
        if (response && response.data) {
          console.log('Full response:', response);
          
          // Ensure data is properly formatted
          const formattedData: PlatformPricingResponseDto[] = response.data.map((item) => ({
            id: item.id,
            publicId: item.publicId,
            lowerBound: typeof item.lowerBound === 'string' ? parseFloat(item.lowerBound) : item.lowerBound,
            upperBound: typeof item.upperBound === 'string' ? parseFloat(item.upperBound) : item.upperBound,
            fee: typeof item.fee === 'string' ? parseFloat(item.fee) : item.fee,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }));
          
          console.log('Formatted data:', formattedData);
          this.dataSource.data = formattedData;
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
        console.error('Error loading platform pricing:', error);
        this.notificationService.error('Failed to load platform pricing data. Please try again.');
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
    this.loadPricing();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    // Sorting is handled server-side by the API
    // If needed, you can add orderBy parameter to filters
    this.loadPricing();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.lowerBoundSearchControl.setValue('');
    this.upperBoundSearchControl.setValue('');
    
    this.filters = {
      page: 1,
      limit: this.pageSize
    };
    
    this.loadPricing();
  }

  /**
   * Open create pricing modal
   */
  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedPricing = null;
    this.pricingForm.reset();
    this.pricingForm.patchValue({
      lowerBound: '',
      upperBound: '',
      fee: ''
    });
    this.showModal = true;
  }

  /**
   * Open edit pricing modal
   */
  openEditModal(pricing: PlatformPricingResponseDto): void {
    this.isEditMode = true;
    this.selectedPricing = pricing;
    this.pricingForm.patchValue({
      lowerBound: pricing.lowerBound,
      upperBound: pricing.upperBound,
      fee: pricing.fee
    });
    this.showModal = true;
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.selectedPricing = null;
    this.pricingForm.reset();
  }

  /**
   * Submit pricing form
   */
  onSubmit(): void {
    if (this.pricingForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      const formData = this.pricingForm.value;

      // Validate range
      if (formData.lowerBound >= formData.upperBound) {
        this.notificationService.error('Lower bound must be less than upper bound');
        this.isSubmitting = false;
        return;
      }

      // Validate bounds are less than 151
      if (formData.lowerBound >= 151 || formData.upperBound >= 151) {
        this.notificationService.error('Lower bound and upper bound must be less than 151. Amounts >= 151 use a fixed 15% fee.');
        this.isSubmitting = false;
        return;
      }

      if (this.isEditMode && this.selectedPricing) {
        // Update pricing
        const updateDto: UpdatePlatformPricingDto = {
          lowerBound: formData.lowerBound,
          upperBound: formData.upperBound,
          fee: formData.fee
        };
        
        this.platformPricingService.platformPricingControllerUpdate({ 
          id: this.selectedPricing.id, 
          body: updateDto 
        }).subscribe({
          next: (response) => {
            this.notificationService.success('Platform pricing updated successfully');
            this.closeModal();
            this.loadPricing();
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Error updating platform pricing:', error);
            
            // Handle specific error cases
            if (error.status === 400) {
              const errorMessage = error.error?.message || 'Invalid platform pricing data provided';
              this.notificationService.error(errorMessage);
            } else if (error.status === 401) {
              this.notificationService.error('You are not authorized to update platform pricing');
            } else if (error.status === 403) {
              this.notificationService.error('You do not have permission to update platform pricing');
            } else if (error.status === 404) {
              this.notificationService.error('Platform pricing not found');
            } else {
              this.notificationService.error('Failed to update platform pricing. Please try again.');
            }
            
            this.isSubmitting = false;
          }
        });
      } else {
        // Create pricing
        const createDto: CreatePlatformPricingDto = {
          lowerBound: formData.lowerBound,
          upperBound: formData.upperBound,
          fee: formData.fee
        };
        
        this.platformPricingService.platformPricingControllerCreate({ body: createDto }).subscribe({
          next: (response) => {
            this.notificationService.success('Platform pricing created successfully');
            this.closeModal();
            this.loadPricing();
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Error creating platform pricing:', error);
            
            // Handle specific error cases
            if (error.status === 400) {
              const errorMessage = error.error?.message || 'Invalid platform pricing data provided';
              this.notificationService.error(errorMessage);
            } else if (error.status === 401) {
              this.notificationService.error('You are not authorized to create platform pricing');
            } else if (error.status === 403) {
              this.notificationService.error('You do not have permission to create platform pricing');
            } else {
              this.notificationService.error('Failed to create platform pricing. Please try again.');
            }
            
            this.isSubmitting = false;
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  /**
   * Delete platform pricing
   */
  onDeletePricing(pricing: PlatformPricingResponseDto): void {
    const message = `Are you sure you want to delete pricing tier (€${pricing.lowerBound} - €${pricing.upperBound})? This action cannot be undone!`;
    
    if (confirm(message)) {
      this.platformPricingService.platformPricingControllerRemove({ id: pricing.id }).subscribe({
        next: (response) => {
          this.notificationService.success('Platform pricing deleted successfully');
          this.loadPricing();
        },
        error: (error) => {
          console.error('Error deleting platform pricing:', error);
          
          // Handle specific error cases
          if (error.status === 404) {
            this.notificationService.error('Platform pricing not found');
          } else if (error.status === 401) {
            this.notificationService.error('You are not authorized to delete platform pricing');
          } else if (error.status === 403) {
            this.notificationService.error('You do not have permission to delete platform pricing');
          } else {
            this.notificationService.error('Failed to delete platform pricing. Please try again.');
          }
        }
      });
    }
  }

  /**
   * Mark all form fields as touched to show validation errors
   */
  private markFormGroupTouched(): void {
    Object.keys(this.pricingForm.controls).forEach(key => {
      const control = this.pricingForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number | string): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) {
      return '€0.00';
    }
    return `€${numAmount.toFixed(2)}`;
  }
}
