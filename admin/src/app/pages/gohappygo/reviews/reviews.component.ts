import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { ReviewsService } from 'src/app/gohappygobackend/services';


export interface Review {
  id: number;
  reviewerId: number;
  revieweeId: number;
  requestId: number;
  rating: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  reviewer: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewee: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  reviewerEmail?: string;
  revieweeEmail?: string;
  rating?: number;
  comment?: string;
  orderBy?: 'createdAt:asc' | 'createdAt:desc' | 'rating:asc' | 'rating:desc' | 'id:asc' | 'id:desc';
}

@Component({
  selector: 'app-reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = ['id', 'reviewer', 'reviewee', 'rating', 'comment', 'requestId', 'createdAt', 'actions'];
  dataSource: MatTableDataSource<Review> = new MatTableDataSource<Review>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: ReviewFilters = {
    page: 1,
    limit: 10,
    orderBy: 'createdAt:desc' as const
  };
  
  // Search controls
  reviewerEmailControl = new FormControl('');
  revieweeEmailControl = new FormControl('');
  ratingSearchControl = new FormControl('');
  commentSearchControl = new FormControl('');

  // Modal properties
  showModerateModal = false;
  isModeratingLoading = false;
  moderateForm: FormGroup;
  selectedReview: Review | null = null;

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private reviewService: ReviewsService,
    private notificationService: NotificationService,
    private formBuilder: FormBuilder
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Management' }, { label: 'Reviews', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadReviews();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Initialize forms
   */
  private initializeForms(): void {
    this.moderateForm = this.formBuilder.group({
      comment: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2500)]]
    });
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // Reviewer email search
    this.reviewerEmailControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.reviewerEmail = value || undefined;
        this.filters.page = 1;
        this.loadReviews();
      });

    // Reviewee email search
    this.revieweeEmailControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.revieweeEmail = value || undefined;
        this.filters.page = 1;
        this.loadReviews();
      });

    // Rating search
    this.ratingSearchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.rating = value ? parseInt(value, 10) : undefined;
        this.filters.page = 1;
        this.loadReviews();
      });

    // Comment search
    this.commentSearchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.comment = value || undefined;
        this.filters.page = 1;
        this.loadReviews();
      });
  }

  /**
   * Load reviews data from API
   */
  loadReviews(): void {
    this.isLoading = true;
    
    this.reviewService.reviewControllerGetAllReviews$Response(this.filters).subscribe({
      next: (response: any) => {
        console.log('Reviews data:', response);
        
        // Access the data from response.body since we're using $Response
        const data = response.body;
        
        if (data && data.items) {
          this.dataSource.data = data.items;
          this.totalItems = data.meta?.totalItems || 0;
          this.currentPage = data.meta?.currentPage || 1;
          this.pageSize = data.meta?.itemsPerPage || 10;
        } else {
          this.dataSource.data = [];
          this.totalItems = 0;
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading reviews:', error);
        this.notificationService.error('Failed to load reviews data. Please try again.');
        this.isLoading = false;
      }
    });
  }

  /**
   * Open moderate modal
   */
  openModerateModal(review: Review): void {
    this.selectedReview = review;
    this.moderateForm.patchValue({
      comment: review.comment
    });
    this.showModerateModal = true;
  }

  /**
   * Close moderate modal
   */
  closeModerateModal(): void {
    this.showModerateModal = false;
    this.moderateForm.reset();
    this.selectedReview = null;
  }

  /**
   * Moderate review
   */
  moderateReview(): void {
    if (this.moderateForm.invalid || !this.selectedReview) {
      this.notificationService.warning('Please fill in all required fields');
      return;
    }

    this.isModeratingLoading = true;
    const moderateData = {
      comment: this.moderateForm.value.comment
    };

    this.reviewService.reviewControllerModerateReview({
      id: this.selectedReview.id,
      body: moderateData
    }).subscribe({
      next: (response: any) => {
        this.notificationService.success('Review moderated successfully');
        this.closeModerateModal();
        this.loadReviews();
        this.isModeratingLoading = false;
      },
      error: (error) => {
        console.error('Error moderating review:', error);
        this.notificationService.error('Failed to moderate review. Please try again.');
        this.isModeratingLoading = false;
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
    this.loadReviews();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    if (event.direction && ['createdAt', 'rating', 'id'].includes(event.active)) {
      this.filters.orderBy = `${event.active}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'createdAt:desc';
    }
    this.loadReviews();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.reviewerEmailControl.setValue('');
    this.revieweeEmailControl.setValue('');
    this.ratingSearchControl.setValue('');
    this.commentSearchControl.setValue('');
    
    this.filters = {
      page: 1,
      limit: this.pageSize,
      orderBy: 'createdAt:desc' as const
    };
    
    this.loadReviews();
  }

  /**
   * View review details
   */
  onViewReview(review: Review): void {
    console.log('View review:', review);
    this.notificationService.info(`Viewing review #${review.id}`);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Get user full name
   */
  getUserName(user: any): string {
    return user ? `${user.firstName} ${user.lastName}` : 'N/A';
  }

  /**
   * Get rating stars
   */
  getRatingStars(rating: string): string {
    const ratingValue = parseFloat(rating);
    const fullStars = Math.floor(ratingValue);
    const hasHalfStar = ratingValue % 1 !== 0;
    
    let stars = '⭐'.repeat(fullStars);
    if (hasHalfStar) {
      stars += '½';
    }
    return stars + ` (${rating})`;
  }

  /**
   * Truncate long comments for table display
   */
  truncateText(text: string, maxLength: number = 80): string {
    return text && text.length > maxLength ? text.substring(0, maxLength) + '...' : text || '';
  }

  // Convenience getter for form controls
  get mf() { return this.moderateForm.controls; }
}
