import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { QuotesService } from 'src/app/gohappygobackend/services';
import Swal from 'sweetalert2';

export interface Quote {
  id: number;
  quote: string;
  author: string;
  fontFamily: string;
  fontSize: string;
  createdAt: string;
  updatedAt: string;
  isDeactivated: boolean;
}

export interface QuoteFilters {
  page?: number;
  limit?: number;
  quote?: string;
  author?: string;
  fontFamily?: string;
  fontSize?: number;
  orderBy?: 'createdAt:asc' | 'createdAt:desc' | 'fontFamily:asc' | 'fontFamily:desc' | 'fontSize:asc' | 'fontSize:desc';
}

@Component({
  selector: 'app-quotes',
  templateUrl: './quotes.component.html',
  styleUrls: ['./quotes.component.scss']
})
export class QuotesComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = ['quote', 'author', 'fontFamily', 'fontSize', 'createdAt', 'status', 'actions'];
  dataSource: MatTableDataSource<Quote> = new MatTableDataSource<Quote>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: QuoteFilters = {
    page: 1,
    limit: 10,
    orderBy: 'createdAt:desc' as const
  };
  
  // Search controls
  quoteSearchControl = new FormControl('');
  authorSearchControl = new FormControl('');
  fontFamilySearchControl = new FormControl('');
  fontSizeSearchControl = new FormControl('');

  // Modal properties
  showModal = false;
  isEditMode = false;
  isSaving = false;
  quoteForm: FormGroup;
  selectedQuote: Quote | null = null;
  showPreview = false;

  // Available fonts
  availableFonts = [
    'Sacramento',
    'Cinzel',
    'Playfair',
    'Sansita Swashed'
  ];

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private quotesService: QuotesService,
    private notificationService: NotificationService,
    private formBuilder: FormBuilder
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Management' }, { label: 'Quotes', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadQuotes();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Initialize quote form
   */
  private initializeForm(): void {
    this.quoteForm = this.formBuilder.group({
      quote: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      author: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      fontFamily: ['Sacramento', Validators.required],
      fontSize: ['16', [Validators.required, Validators.min(10), Validators.max(72)]]
    });
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // Quote search
    this.quoteSearchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.quote = value || undefined;
        this.filters.page = 1;
        this.loadQuotes();
      });

    // Author search
    this.authorSearchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.author = value || undefined;
        this.filters.page = 1;
        this.loadQuotes();
      });

    // Font family search
    this.fontFamilySearchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.fontFamily = value || undefined;
        this.filters.page = 1;
        this.loadQuotes();
      });

    // Font size search
    this.fontSizeSearchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.fontSize = value ? parseInt(value, 10) : undefined;
        this.filters.page = 1;
        this.loadQuotes();
      });
  }

  /**
   * Load quotes data from API
   */
  loadQuotes(): void {
    this.isLoading = true;
    
    this.quotesService.quoteControllerGetAllQuotes(this.filters).subscribe({
      next: (response: any) => {
        console.log('Quotes data:', response);
        
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
        console.error('Error loading quotes:', error);
        this.notificationService.error('Failed to load quotes data. Please try again.');
        this.isLoading = false;
      }
    });
  }

  /**
   * Open modal for creating new quote
   */
  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedQuote = null;
    this.quoteForm.reset({
      fontFamily: 'Sacramento',
      fontSize: '16'
    });
    this.showPreview = false;
    this.showModal = true;
  }

  /**
   * Open modal for editing quote
   */
  openEditModal(quote: Quote): void {
    this.isEditMode = true;
    this.selectedQuote = quote;
    this.quoteForm.patchValue({
      quote: quote.quote,
      author: quote.author,
      fontFamily: quote.fontFamily,
      fontSize: quote.fontSize.replace('px', '') // Remove 'px' suffix
    });
    this.showPreview = false;
    this.showModal = true;
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.showModal = false;
    this.showPreview = false;
    this.quoteForm.reset();
    this.selectedQuote = null;
  }

  /**
   * Toggle preview
   */
  togglePreview(): void {
    if (this.quoteForm.valid) {
      this.showPreview = !this.showPreview;
    } else {
      this.notificationService.warning('Please fill in all required fields before preview');
    }
  }

  /**
   * Get preview style
   */
  getPreviewStyle(): any {
    const formValue = this.quoteForm.value;
    return {
      fontFamily: formValue.fontFamily,
      fontSize: formValue.fontSize + 'px'
    };
  }

  /**
   * Save quote (create or update)
   */
  saveQuote(): void {
    if (this.quoteForm.invalid) {
      this.notificationService.warning('Please fill in all required fields');
      return;
    }

    this.isSaving = true;
    const quoteData = {
      ...this.quoteForm.value,
      fontSize: this.quoteForm.value.fontSize // Keep as string, backend expects string
    };

    if (this.isEditMode && this.selectedQuote) {
      // Update existing quote
      this.quotesService.quoteControllerUpdate({
        id: this.selectedQuote.id,
        body: quoteData
      }).subscribe({
        next: () => {
          this.notificationService.success('Quote updated successfully');
          this.closeModal();
          this.loadQuotes();
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error updating quote:', error);
          this.notificationService.error('Failed to update quote. Please try again.');
          this.isSaving = false;
        }
      });
    } else {
      // Create new quote
      this.quotesService.quoteControllerCreate({
        body: quoteData
      }).subscribe({
        next: () => {
          this.notificationService.success('Quote created successfully');
          this.closeModal();
          this.loadQuotes();
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error creating quote:', error);
          this.notificationService.error('Failed to create quote. Please try again.');
          this.isSaving = false;
        }
      });
    }
  }

  /**
   * Handle pagination changes
   */
  onPageChange(event: PageEvent): void {
    this.filters.page = event.pageIndex + 1;
    this.filters.limit = event.pageSize;
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadQuotes();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    if (event.direction && ['createdAt', 'fontFamily', 'fontSize'].includes(event.active)) {
      this.filters.orderBy = `${event.active}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'createdAt:desc';
    }
    this.loadQuotes();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.quoteSearchControl.setValue('');
    this.authorSearchControl.setValue('');
    this.fontFamilySearchControl.setValue('');
    this.fontSizeSearchControl.setValue('');
    
    this.filters = {
      page: 1,
      limit: this.pageSize,
      orderBy: 'createdAt:desc' as const
    };
    
    this.loadQuotes();
  }

  /**
   * View quote details
   */
  onViewQuote(quote: Quote): void {
    console.log('View quote:', quote);
    this.notificationService.info(`Viewing quote by ${quote.author}`);
  }

  /**
   * Edit quote
   */
  onEditQuote(quote: Quote): void {
    this.openEditModal(quote);
  }

  /**
   * Delete quote
   */
  onDeleteQuote(quote: Quote): void {
    const message = `Are you sure you want to delete this quote by ${quote.author}? This action cannot be undone!`;
    
    if (confirm(message)) {
      this.quotesService.quoteControllerRemove({ id: quote.id }).subscribe({
        next: () => {
          this.notificationService.success('Quote deleted successfully');
          this.loadQuotes();
        },
        error: (error) => {
          console.error('Error deleting quote:', error);
          this.notificationService.error('Failed to delete quote. Please try again.');
        }
      });
    }
  }

  /**
   * Toggle quote activation status
   */
  onToggleActivation(quote: Quote): void {
    const isActive = !quote.isDeactivated;
    const action = isActive ? 'deactivate' : 'activate';
    const icon = isActive ? 'warning' : 'question';
    const confirmColor = isActive ? '#f46a6a' : '#34c38f';

    Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Quote?`,
      html: `
        <div class="text-left">
          <p><strong>Quote:</strong> <em>"${quote.quote}"</em></p>
          <p><strong>Author:</strong> ${quote.author}</p>
          <p>Are you sure you want to <strong>${action}</strong> this quote?</p>
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
        return this.quotesService.quoteControllerToggleQuoteActivation({ id: quote.id }).toPromise();
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        this.notificationService.success(`Quote ${action}d successfully`);
        this.loadQuotes();
      }
    });
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(isDeactivated: boolean): string {
    return isDeactivated ? 'badge-danger' : 'badge-success';
  }

  /**
   * Get status text
   */
  getStatusText(isDeactivated: boolean): string {
    return isDeactivated ? 'Inactive' : 'Active';
  }

  /**
   * Truncate long quotes for table display
   */
  truncateText(text: string, maxLength: number = 80): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Convenience getter for form controls
  get f() { return this.quoteForm.controls; }
}
