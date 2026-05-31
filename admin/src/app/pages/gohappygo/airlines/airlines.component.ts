import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { AirlinesService } from 'src/app/gohappygobackend/services';
import Swal from 'sweetalert2';

export interface Airline {
  id: number;
  icaoCode: string;
  iataCode: string;
  name: string;
  logoUrl: string;
  prefix: string;
  fleetSize: number;
  destinationsCount: number;
  callsign: string;
  wikipediaUrl: string;
  createdAt: string;
  updatedAt: string;
  isDeactivated: boolean;
}

export interface AirlineFilters {
  page?: number;
  limit?: number;
  name?: string;
  iataCode?: string;
  icaoCode?: string;
  callsign?: string;
  orderBy?: 'name:asc' | 'name:desc' | 'iataCode:asc' | 'iataCode:desc' | 'icaoCode:asc' | 'icaoCode:desc' | 'createdAt:asc' | 'createdAt:desc';
}

@Component({
  selector: 'app-airlines',
  templateUrl: './airlines.component.html',
  styleUrls: ['./airlines.component.scss']
})
export class AirlinesComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = ['logo', 'name', 'iataCode', 'icaoCode', 'callsign', 'fleetSize', 'destinationsCount', 'status', 'actions'];
  dataSource: MatTableDataSource<Airline> = new MatTableDataSource<Airline>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: AirlineFilters = {
    page: 1,
    limit: 10,
    orderBy: 'name:asc' as const
  };
  
  // Search controls
  nameSearchControl = new FormControl('');
  iataCodeSearchControl = new FormControl('');
  icaoCodeSearchControl = new FormControl('');
  callsignSearchControl = new FormControl('');

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private airlineService: AirlinesService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Airlines Management', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadAirlines();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // Name search
    this.nameSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.name = value || undefined;
        this.filters.page = 1;
        this.loadAirlines();
      });

    // IATA code search
    this.iataCodeSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.iataCode = value || undefined;
        this.filters.page = 1;
        this.loadAirlines();
      });

    // ICAO code search
    this.icaoCodeSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.icaoCode = value || undefined;
        this.filters.page = 1;
        this.loadAirlines();
      });

    // Callsign search
    this.callsignSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.callsign = value || undefined;
        this.filters.page = 1;
        this.loadAirlines();
      });
  }

  /**
   * Load airlines data from API
   */
  loadAirlines(): void {
    this.isLoading = true;
    
    this.airlineService.airlineControllerGetAllAirlines(this.filters).subscribe({
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
        console.error('Error loading airlines:', error);
        this.notificationService.error('Failed to load airlines data. Please try again.');
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
    this.loadAirlines();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    if (event.direction && event.active !== 'callsign') {
      this.filters.orderBy = `${event.active}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'name:asc';
    }
    this.loadAirlines();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.nameSearchControl.setValue('');
    this.iataCodeSearchControl.setValue('');
    this.icaoCodeSearchControl.setValue('');
    this.callsignSearchControl.setValue('');
    
    this.filters = {
      page: 1,
      limit: this.pageSize,
      orderBy: 'name:asc' as const
    };
    
    this.loadAirlines();
  }

  /**
   * View airline details
   */
  onViewAirline(airline: Airline): void {
    console.log('View airline:', airline);
    this.notificationService.info(`Viewing details for ${airline.name}`);
  }

  /**
   * Toggle airline activation status
   */
  onToggleActivation(airline: Airline): void {
    const isActive = !airline.isDeactivated;
    const action = isActive ? 'deactivate' : 'activate';
    const icon = isActive ? 'warning' : 'question';
    const confirmColor = isActive ? '#f46a6a' : '#34c38f';

    Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Airline?`,
      html: `
        <div class="text-left">
          <p><strong>Airline:</strong> ${airline.name} (${airline.iataCode})</p>
          <p><strong>Callsign:</strong> ${airline.callsign}</p>
          <p>Are you sure you want to <strong>${action}</strong> this airline?</p>
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
        return this.airlineService.airlineControllerToggleActivation({ id: airline.id }).toPromise();
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        this.notificationService.success(`${airline.name} ${action}d successfully`);
        this.loadAirlines();
      }
    });
  }

  /**
   * Delete airline
   */
  onDeleteAirline(airline: Airline): void {
    const message = `Are you sure you want to delete ${airline.name}? This action cannot be undone!`;
    
    if (confirm(message)) {
      console.log('Delete airline:', airline);
      this.notificationService.success(`${airline.name} deleted successfully`);
      this.loadAirlines(); // Refresh the list
    }
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
}
