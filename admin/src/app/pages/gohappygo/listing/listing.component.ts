import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CommonService } from 'src/app/core/services/common.service';
import { NotificationService } from 'src/app/core/services/notification.service';
import { DemandsAndTravelsService } from 'src/app/gohappygobackend/services';
import { DemandOrTravelResponseDto } from 'src/app/gohappygobackend/models/demand-or-travel-response-dto';
import { ListingDetailModalComponent } from './listing-detail-modal/listing-detail-modal.component';

export interface DemandTravelFilters {
  page?: number;
  limit?: number;
  flightNumber?: string;
  departureAirportIataCode?: string;
  arrivalAirportIataCode?: string;
  airlineIataCode?: string;
  travelDate?: string;
  minWeight?: number;
  maxWeight?: number;
  minPricePerKg?: number;
  maxPricePerKg?: number;
  status?: 'active' | 'expired' | 'cancelled' | 'resolved';
  type?: 'demand' | 'travel';
  isVerified?: boolean;
  orderBy?: 'createdAt:asc' | 'createdAt:desc' | 'travelDate:asc' | 'travelDate:desc' | 'description:asc' | 'description:desc' | 'flightNumber:asc' | 'flightNumber:desc' | 'pricePerKg:asc' | 'pricePerKg:desc' | 'weight:asc' | 'weight:desc';
}

@Component({
  selector: 'app-listing',
  templateUrl: './listing.component.html',
  styleUrls: ['./listing.component.scss']
})
export class ListingComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;

  // Table properties - using the generated DTO model
  displayedColumns: string[] = [
    'type', 'flightNumber', 'departureAirport', 'arrivalAirport',
    'deliveryDate', 'weight', 'pricePerKg', 'status', 'user', 'isVerified', 'actions'
  ];
  dataSource: MatTableDataSource<DemandOrTravelResponseDto> = new MatTableDataSource<DemandOrTravelResponseDto>([]);

  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];

  // Loading state
  isLoading = false;

  // Filters
  filters: DemandTravelFilters = {
    page: 1,
    limit: 10,
    orderBy: 'createdAt:desc' as const
  };

  // Form controls for filters
  flightNumberControl = new FormControl('');
  departureAirportIataControl = new FormControl('');
  arrivalAirportIataControl = new FormControl('');
  airlineIataControl = new FormControl('');
  statusControl = new FormControl<'active' | 'expired' | 'cancelled' | 'resolved' | null>(null);
  travelDateControl = new FormControl<Date | null>(null);
  typeControl = new FormControl<'demand' | 'travel' | null>(null);
  minWeightControl = new FormControl<number | null>(null);
  maxWeightControl = new FormControl<number | null>(null);
  minPricePerKgControl = new FormControl<number | null>(null);
  maxPricePerKgControl = new FormControl<number | null>(null);
  isVerifiedControl = new FormControl<boolean | null>(null);

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private demandsAndTravelsService: DemandsAndTravelsService,
    private commonService: CommonService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.breadCrumbItems = [
      { label: 'GoHappyGo' },
      { label: 'Demands & Travels', active: true }
    ];

    this.setupSearchDebouncing();
    this.loadDemandsAndTravels();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Reduce long text
   */
  limitLength(longText: string): string {
    return this.commonService.truncateText(longText, 40);
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // Flight number
    this.flightNumberControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.flightNumber = value || undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Departure airport IATA
    this.departureAirportIataControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.departureAirportIataCode = value ? value.toUpperCase() : undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Arrival airport IATA
    this.arrivalAirportIataControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.arrivalAirportIataCode = value ? value.toUpperCase() : undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Airline IATA
    this.airlineIataControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.airlineIataCode = value ? value.toUpperCase() : undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Status
    this.statusControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        this.filters.status = value || undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Travel date (handled separately via date picker change)
    // Type
    this.typeControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        this.filters.type = value || undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Min weight
    this.minWeightControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.minWeight = value ?? undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Max weight
    this.maxWeightControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.maxWeight = value ?? undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Min price per kg
    this.minPricePerKgControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.minPricePerKg = value ?? undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // Max price per kg
    this.maxPricePerKgControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.maxPricePerKg = value ?? undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });

    // isVerified
    this.isVerifiedControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        this.filters.isVerified = value ?? undefined;
        this.filters.page = 1;
        this.loadDemandsAndTravels();
      });
  }

  /**
   * Handle date change from the date picker
   */
  onDateChange(date: Date | null): void {
    if (date) {
      // Format as ISO date string (YYYY-MM-DD)
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      this.filters.travelDate = `${year}-${month}-${day}`;
    } else {
      this.filters.travelDate = undefined;
    }
    this.filters.page = 1;
    this.loadDemandsAndTravels();
  }

  /**
   * Load demands and travels data from API
   */
  loadDemandsAndTravels(): void {
    this.isLoading = true;

    this.demandsAndTravelsService.demandAndTravelControllerGetDemandsAndTravels(this.filters).subscribe({
      next: (response: any) => {
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
        console.error('Error loading demands and travels:', error);
        this.notificationService.error('Failed to load demands and travels data. Please try again.');
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
    this.loadDemandsAndTravels();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    if (event.direction) {
      const fieldMapping: { [key: string]: string } = {
        'createdAt': 'createdAt',
        'deliveryDate': 'travelDate',
        'description': 'description',
        'flightNumber': 'flightNumber',
        'pricePerKg': 'pricePerKg',
        'weight': 'weight'
      };

      const apiField = fieldMapping[event.active] || event.active;
      this.filters.orderBy = `${apiField}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'createdAt:desc';
    }
    this.filters.page = 1;
    this.loadDemandsAndTravels();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.flightNumberControl.setValue('');
    this.departureAirportIataControl.setValue('');
    this.arrivalAirportIataControl.setValue('');
    this.airlineIataControl.setValue('');
    this.statusControl.setValue(null);
    this.travelDateControl.setValue(null);
    this.typeControl.setValue(null);
    this.minWeightControl.setValue(null);
    this.maxWeightControl.setValue(null);
    this.minPricePerKgControl.setValue(null);
    this.maxPricePerKgControl.setValue(null);
    this.isVerifiedControl.setValue(null);

    this.filters = {
      page: 1,
      limit: this.pageSize,
      orderBy: 'createdAt:desc' as const
    };

    this.loadDemandsAndTravels();
  }

  /**
   * View item details - open detail modal
   */
  onViewItem(item: DemandOrTravelResponseDto): void {
    this.dialog.open(ListingDetailModalComponent, {
      width: '680px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { item }
    });
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'badge-soft-success';
      case 'expired':
        return 'badge-soft-warning';
      case 'cancelled':
        return 'badge-soft-danger';
      case 'resolved':
        return 'badge-soft-info';
      default:
        return 'badge-soft-secondary';
    }
  }

  /**
   * Get type badge class
   */
  getTypeBadgeClass(type: string): string {
    return type === 'demand' ? 'badge-soft-primary' : 'badge-soft-info';
  }

  /**
   * Get type display text
   */
  getTypeDisplayText(type: string): string {
    return type === 'demand' ? 'Demand' : 'Travel';
  }

  /**
   * Get weight display for an item
   */
  getWeightDisplay(item: DemandOrTravelResponseDto): string {
    if (item.type === 'demand' && item.weight !== undefined && item.weight !== null) {
      return `${Number(item.weight).toFixed(1)} kg`;
    }
    if (item.type === 'travel' && item.weightAvailable !== undefined && item.weightAvailable !== null) {
      return `${Number(item.weightAvailable).toFixed(1)} kg avail.`;
    }
    return '-';
  }

  /**
   * Format price for display
   */
  getPriceDisplay(item: DemandOrTravelResponseDto): string {
    if (item.pricePerKg === undefined || item.pricePerKg === null) return '-';
    const symbol = item.currency?.symbol || '$';
    return `${symbol}${Number(item.pricePerKg).toFixed(2)}/kg`;
  }

  /**
   * Get airport display string
   */
  getAirportDisplay(airport: any): string {
    if (!airport) return '-';
    const parts: string[] = [];
    if (airport.name) parts.push(airport.name);
    if (airport.municipality) parts.push(airport.municipality);
    if (airport.isoCountry) parts.push(airport.isoCountry);
    return parts.join(', ') || '-';
  }

  /**
   * Get user display name
   */
  getUserDisplayName(item: DemandOrTravelResponseDto): string {
    return item.user?.name || item.user?.fullName || `User #${item.userId}`;
  }
}
