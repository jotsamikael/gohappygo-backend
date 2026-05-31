import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { AirportsService } from 'src/app/gohappygobackend/services';
import { MatDialog } from '@angular/material/dialog';
import { AirportMapModalComponent } from './airport-map-modal/airport-map-modal.component';
import Swal from 'sweetalert2';

export interface Airport {
  id: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  isDeactivated: boolean;
  ident: string;
  type: string;
  name: string;
  latitudeDeg: string;
  longitudeDeg: string;
  elevationFt: number;
  continent: string;
  isoCountry: string;
  isoRegion: string;
  municipality: string;
  scheduledService: string;
  icaoCode: string;
  iataCode: string;
  gpsCode: string;
  localCode: string;
  homeLink: string;
  wikipediaLink: string;
  keywords: string;
}

export interface AirportFilters {
  page?: number;
  limit?: number;
  name?: string;
  municipality?: string;
  isoCountry?: string;
  iataCode?: string;
  icaoCode?: string;
  continent?: string;
  isoRegion?: string;
  type?: string;
  scheduledService?: 'yes' | 'no';
  orderBy?: 'iataCode:asc' | 'iataCode:desc' | 'createdAt:asc' | 'createdAt:desc' | 'name:asc' | 'name:desc' | 'municipality:asc' | 'municipality:desc' | 'isoCountry:asc' | 'isoCountry:desc' | 'icaoCode:asc' | 'icaoCode:desc' | 'continent:asc' | 'continent:desc';
}

@Component({
  selector: 'app-airport',
  templateUrl: './airport.component.html',
  styleUrls: ['./airport.component.scss']
})
export class AirportComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = ['ident', 'name', 'type', 'municipality', 'isoCountry', 'iataCode', 'icaoCode', 'scheduledService', 'actions'];
  dataSource: MatTableDataSource<Airport> = new MatTableDataSource<Airport>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: AirportFilters = {
    page: 1,
    limit: 10,
    scheduledService: 'yes', // Default to scheduled airports
    orderBy: 'name:asc' as const
  };
  
  // Search controls
  nameSearchControl = new FormControl('');
  municipalitySearchControl = new FormControl('');
  isoCountrySearchControl = new FormControl('');
  iataCodeSearchControl = new FormControl('');
  icaoCodeSearchControl = new FormControl('');
  continentSearchControl = new FormControl('');
  isoRegionSearchControl = new FormControl('');
  typeSearchControl = new FormControl('');
  scheduledServiceControl = new FormControl<'yes' | 'no'>('yes');

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private airportService: AirportsService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Airports Management', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadAirports();
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
        this.loadAirports();
      });

    // Municipality search
    this.municipalitySearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.municipality = value || undefined;
        this.filters.page = 1;
        this.loadAirports();
      });

    // ISO Country search
    this.isoCountrySearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.isoCountry = value || undefined;
        this.filters.page = 1;
        this.loadAirports();
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
        this.loadAirports();
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
        this.loadAirports();
      });

    // Continent search
    this.continentSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.continent = value || undefined;
        this.filters.page = 1;
        this.loadAirports();
      });

    // ISO Region search
    this.isoRegionSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.isoRegion = value || undefined;
        this.filters.page = 1;
        this.loadAirports();
      });

    // Type search
    this.typeSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.type = value || undefined;
        this.filters.page = 1;
        this.loadAirports();
      });

    this.scheduledServiceControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.scheduledService = (value as 'yes' | 'no') || 'yes';
        this.filters.page = 1;
        this.loadAirports();
      });
  }

  /**
   * Load airports data from API
   */
  loadAirports(): void {
    this.isLoading = true;
    
    // Now we can pass the filters directly since they match the API
    this.airportService.airportControllerFindAll(this.filters).subscribe({
      next: (response: any) => {
        console.log('Airports data:', response);
        
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
        console.error('Error loading airports:', error);
        this.notificationService.error('Failed to load airports data. Please try again.');
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
    this.loadAirports();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    if (event.direction) {
      // Map the field names to match the API expected values
      const fieldMapping: { [key: string]: string } = {
        'name': 'name',
        'municipality': 'municipality',
        'isoCountry': 'isoCountry',
        'iataCode': 'iataCode',
        'icaoCode': 'icaoCode',
        'continent': 'continent'
      };
      
      const apiField = fieldMapping[event.active] || event.active;
      this.filters.orderBy = `${apiField}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'name:asc';
    }
    this.loadAirports();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.nameSearchControl.setValue('');
    this.municipalitySearchControl.setValue('');
    this.isoCountrySearchControl.setValue('');
    this.iataCodeSearchControl.setValue('');
    this.icaoCodeSearchControl.setValue('');
    this.continentSearchControl.setValue('');
    this.isoRegionSearchControl.setValue('');
    this.typeSearchControl.setValue('');
    this.scheduledServiceControl.setValue('yes');
    
    this.filters = {
      page: 1,
      limit: this.pageSize,
      scheduledService: 'yes', // Reset to default
      orderBy: 'name:asc' as const
    };
    
    this.loadAirports();
  }

  /**
   * View airport details
   */
  onViewAirport(airport: Airport): void {
    console.log('View airport:', airport);
    this.notificationService.info(`Viewing details for ${airport.name}`);
  }

  /**
   * Toggle airport activation status
   */
  onToggleActivation(airport: Airport): void {
    const isActive = !airport.isDeactivated;
    const action = isActive ? 'deactivate' : 'activate';
    const icon = isActive ? 'warning' : 'question';
    const confirmColor = isActive ? '#f46a6a' : '#34c38f';

    Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Airport?`,
      html: `
        <div class="text-left">
          <p><strong>Airport:</strong> ${airport.name} (${airport.ident})</p>
          <p><strong>City:</strong> ${airport.municipality}, ${airport.isoCountry}</p>
          <p>Are you sure you want to <strong>${action}</strong> this airport?</p>
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
        return this.airportService.airportControllerToggleActivation({ id: airport.id }).toPromise();
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        this.notificationService.success(`${airport.name} ${action}d successfully`);
        this.loadAirports();
      }
    });
  }

  /**
   * Delete airport
   */
  onDeleteAirport(airport: Airport): void {
    const message = `Are you sure you want to delete ${airport.name}? This action cannot be undone!`;
    
    if (confirm(message)) {
      console.log('Delete airport:', airport);
      this.notificationService.success(`${airport.name} deleted successfully`);
      this.loadAirports(); // Refresh the list
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

  /**
   * Get coordinates for display
   */
  getCoordinates(airport: Airport): string {
    if (airport.latitudeDeg && airport.longitudeDeg) {
      return `${parseFloat(airport.latitudeDeg).toFixed(4)}, ${parseFloat(airport.longitudeDeg).toFixed(4)}`;
    }
    return 'N/A';
  }

  /**
   * Get elevation for display
   */
  getElevation(airport: Airport): string {
    if (airport.elevationFt) {
      return `${airport.elevationFt} ft`;
    }
    return 'N/A';
  }



onViewMap(): void {
  if (this.dataSource.data.length === 0) {
    this.notificationService.warning('No airports data available to display on map.');
    return;
  }

  const dialogRef = this.dialog.open(AirportMapModalComponent, {
    width: '90vw',
    height: '90vh',
    maxWidth: '1000px',
    maxHeight: '550px',
    data: { airports: this.dataSource.data },
    disableClose: false,
    panelClass: 'airport-map-modal-dialog'
  });

  dialogRef.afterClosed().subscribe(result => {
    console.log('Map modal closed');
  });
}
}