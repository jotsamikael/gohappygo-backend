import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { CurrenciesService } from 'src/app/gohappygobackend/services';
import Swal from 'sweetalert2';

export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: string;
  isActive: boolean;
  country: string;
  createdAt: string;
  updatedAt: string;
  isDeactivated: boolean;
}

export interface CurrencyFilters {
  page?: number;
  limit?: number;
  code?: string;
  name?: string;
  country?: string;
  orderBy?: 'code:asc' | 'code:desc' | 'name:asc' | 'name:desc' | 'createdAt:asc' | 'createdAt:desc';
}

@Component({
  selector: 'app-currency',
  templateUrl: './currency.component.html',
  styleUrls: ['./currency.component.scss']
})
export class CurrencyComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = ['code', 'name', 'symbol', 'exchangeRate', 'country', 'status', 'actions'];
  dataSource: MatTableDataSource<Currency> = new MatTableDataSource<Currency>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: CurrencyFilters = {
    page: 1,
    limit: 10,
    orderBy: 'code:asc' as const
  };
  
  // Search controls
  codeSearchControl = new FormControl('');
  nameSearchControl = new FormControl('');
  countrySearchControl = new FormControl('');

  // Modal properties
  showModal = false;
  isEditMode = false;
  selectedCurrency: Currency | null = null;
  isSubmitting = false;

  // Form
  currencyForm: FormGroup;

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private currenciesService: CurrenciesService,
    private notificationService: NotificationService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Currency Management', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadCurrencies();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Add debugging
    console.log('Paginator:', this.paginator);
    console.log('Sort:', this.sort);
    console.log('DataSource after view init:', this.dataSource);
  }

  /**
   * Initialize the currency form
   */
  private initializeForm(): void {
    this.currencyForm = new FormGroup({
      code: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(3)]),
      name: new FormControl('', [Validators.required, Validators.minLength(2)]),
      symbol: new FormControl('', [Validators.required]),
      exchangeRate: new FormControl(1, [Validators.required, Validators.min(0)]),
      isActive: new FormControl(true),
      country: new FormControl('', [Validators.required])
    });
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // Code search
    this.codeSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.code = value || undefined;
        this.filters.page = 1;
        this.loadCurrencies();
      });

    // Name search
    this.nameSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.name = value || undefined;
        this.filters.page = 1;
        this.loadCurrencies();
      });

    // Country search
    this.countrySearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.country = value || undefined;
        this.filters.page = 1;
        this.loadCurrencies();
      });
  }

  /**
   * Load currencies data from API
   */
  loadCurrencies(): void {
    this.isLoading = true;
    
    console.log('Sending filters:', this.filters);
    
    this.currenciesService.currencyControllerFindAll$Response(this.filters).subscribe({
      next: (response: any) => {
        console.log('Full response:', response);
        console.log('Response body:', response.body);
        console.log('Response body type:', typeof response.body);
        
        // Parse the response body if it's a string
        let parsedBody = response.body;
        if (typeof response.body === 'string') {
          try {
            parsedBody = JSON.parse(response.body);
            console.log('Parsed body:', parsedBody);
          } catch (error) {
            console.error('Error parsing response body:', error);
            this.notificationService.error('Error parsing server response');
            this.isLoading = false;
            return;
          }
        }
        
        const items = parsedBody?.items;
        console.log('Items found:', items);
        console.log('Items length:', items?.length);
        
        if (items && Array.isArray(items)) {
          this.dataSource.data = items;
          console.log('DataSource data after assignment:', this.dataSource.data);
          
          this.totalItems = parsedBody.meta?.totalItems || items.length;
          this.currentPage = parsedBody.meta?.currentPage || 1;
          this.pageSize = parsedBody.meta?.itemsPerPage || 10;
        } else {
          console.log('No valid items found, setting empty array');
          this.dataSource.data = [];
          this.totalItems = 0;
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading currencies:', error);
        this.notificationService.error('Failed to load currencies data. Please try again.');
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
    this.loadCurrencies();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    if (event.direction && event.active && event.active !== 'country') {
      this.filters.orderBy = `${event.active}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'code:asc';
    }
    this.loadCurrencies();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.codeSearchControl.setValue('');
    this.nameSearchControl.setValue('');
    this.countrySearchControl.setValue('');
    
    this.filters = {
      page: 1,
      limit: this.pageSize,
      orderBy: 'code:asc' as const
    };
    
    this.loadCurrencies();
  }

  /**
   * Open create currency modal
   */
  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedCurrency = null;
    this.currencyForm.reset();
    this.currencyForm.patchValue({
      exchangeRate: 1,
      isActive: true
    });
    this.showModal = true;
  }

  /**
   * Open edit currency modal
   */
  openEditModal(currency: Currency): void {
    this.isEditMode = true;
    this.selectedCurrency = currency;
    this.currencyForm.patchValue({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchangeRate: parseFloat(currency.exchangeRate),
      isActive: currency.isActive,
      country: currency.country
    });
    this.showModal = true;
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.selectedCurrency = null;
    this.currencyForm.reset();
  }

  /**
   * Submit currency form
   */
  onSubmit(): void {
    if (this.currencyForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      const formData = this.currencyForm.value;
      console.log('formData', formData);

      if (this.isEditMode && this.selectedCurrency) {
        // Update currency
        this.currenciesService.currencyControllerUpdate({ id: this.selectedCurrency.id, body: formData }).subscribe({
          next: (response) => {
            this.notificationService.success('Currency updated successfully');
            this.closeModal();
            this.loadCurrencies();
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Error updating currency:', error);
            
            // Handle specific error cases
            if (error.status === 409) {
              const errorMessage = error.error?.message || 'Currency with this code already exists';
              this.notificationService.error(errorMessage);
            } else if (error.status === 400) {
              const errorMessage = error.error?.message || 'Invalid currency data provided';
              this.notificationService.error(errorMessage);
            } else if (error.status === 401) {
              this.notificationService.error('You are not authorized to update currencies');
            } else if (error.status === 403) {
              this.notificationService.error('You do not have permission to update currencies');
            } else if (error.status === 404) {
              this.notificationService.error('Currency not found');
            } else {
              this.notificationService.error('Failed to update currency. Please try again.');
            }
            
            this.isSubmitting = false;
          }
        });
      } else {
        // Create currency
        this.currenciesService.currencyControllerCreate({ body: formData }).subscribe({
          next: (response) => {
            this.notificationService.success('Currency created successfully');
            this.closeModal();
            this.loadCurrencies();
            this.isSubmitting = false;
          },
          error: (error) => {
            console.error('Error creating currency:', error);
            
            // Handle specific error cases
            if (error.status === 409) {
              const errorMessage = error.error?.message || 'Currency with this code already exists';
              this.notificationService.error(errorMessage);
            } else if (error.status === 400) {
              const errorMessage = error.error?.message || 'Invalid currency data provided';
              this.notificationService.error(errorMessage);
            } else if (error.status === 401) {
              this.notificationService.error('You are not authorized to create currencies');
            } else if (error.status === 403) {
              this.notificationService.error('You do not have permission to create currencies');
            } else {
              this.notificationService.error('Failed to create currency. Please try again.');
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
   * Delete currency
   */
  onDeleteCurrency(currency: Currency): void {
    const message = `Are you sure you want to delete ${currency.name} (${currency.code})? This action cannot be undone!`;
    
    if (confirm(message)) {
      this.currenciesService.currencyControllerRemove({id: currency.id}).subscribe({
        next: (response) => {
          this.notificationService.success(`${currency.name} deleted successfully`);
          this.loadCurrencies();
        },
        error: (error) => {
          console.error('Error deleting currency:', error);
          
          // Handle specific error cases
          if (error.status === 404) {
            this.notificationService.error('Currency not found');
          } else if (error.status === 401) {
            this.notificationService.error('You are not authorized to delete currencies');
          } else if (error.status === 403) {
            this.notificationService.error('You do not have permission to delete currencies');
          } else {
            this.notificationService.error('Failed to delete currency. Please try again.');
          }
        }
      });
    }
  }

  /**
   * Mark all form fields as touched to show validation errors
   */
  private markFormGroupTouched(): void {
    Object.keys(this.currencyForm.controls).forEach(key => {
      const control = this.currencyForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'badge-success' : 'badge-danger';
  }

  /**
   * Get status text
   */
  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  /**
   * Format exchange rate for display
   */
  formatExchangeRate(rate: string): string {
    return parseFloat(rate).toFixed(6);
  }

  /**
   * Toggle currency activation status
   */
  onToggleActivation(currency: Currency): void {
    const isActive = !currency.isDeactivated;
    const action = isActive ? 'deactivate' : 'activate';
    const icon = isActive ? 'warning' : 'question';
    const confirmColor = isActive ? '#f46a6a' : '#34c38f';

    Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Currency?`,
      html: `
        <div class="text-left">
          <p><strong>Currency:</strong> ${currency.name} (${currency.code})</p>
          <p><strong>Symbol:</strong> ${currency.symbol}</p>
          <p>Are you sure you want to <strong>${action}</strong> this currency?</p>
        </div>
      `,
      icon: icon as any,
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Yes, ${action}!`,
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      showLoaderOnConfirm: true,
      preConfirm: () => {
        return this.currenciesService.currencyControllerToggleActivation({ id: currency.id }).toPromise();
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        this.notificationService.success(`${currency.name} (${currency.code}) ${action}d successfully`);
        this.loadCurrencies();
      }
    });
  }
}
