import { AfterViewInit, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { ResolveRequestDto, SettleRequestDto } from 'src/app/gohappygobackend/models';
import { RequestsService } from 'src/app/gohappygobackend/services';

export interface Request {
  id: number;
  createdAt: string;
  updatedAt: string;
  demandId: number | null;
  travelId: number | null;
  requesterId: number;
  requestType: 'GoAndGo' | 'GoAndGive';
  packageDescription: string | null;
  weight: string | null;
  limitDate: string | null;
  currentStatusId: number;
  requester: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  images: Array<{
    fileUrl: string;
  }>;
  currentStatus: {
    status: string;
  };
  hasMeetingProof?: boolean;
  meetingProofUploadedAt?: string | null;
  travel: any | null;
  demand: any | null;
}

export interface RequestFilters {
  page?: number;
  limit?: number;
  id?: number;
  requesterId?: number;
  requesterEmail?: string;
  travelerEmail?: string;
  requestType?: 'GoAndGo' | 'GoAndGive';
  packageDescription?: string;
  limitDate?: string;
  status?: 'TO_CONFIRM' | 'AWAITING_DELIVER' | 'PROOF_ISSUE' | 'FINISHED';
  minWeight?: number;
  maxWeight?: number;
  orderBy?: 'createdAt:asc' | 'createdAt:desc' | 'limitDate:asc' | 'limitDate:desc' | 'weight:asc' | 'weight:desc';
}

@Component({
  selector: 'app-match',
  templateUrl: './match.component.html',
  styleUrls: ['./match.component.scss']
})
export class MatchComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;
  
  // Table properties
  displayedColumns: string[] = ['id', 'requester', 'travelOwner', 'departureAirport', 'weight', 'limitDate', 'status', 'travel', 'actions'];
  dataSource: MatTableDataSource<Request> = new MatTableDataSource<Request>([]);
 
  // Pagination properties
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
   
  // Loading state
  isLoading = false;
  
  // Filters
  filters: RequestFilters = {
    page: 1,
    limit: 10,
    
    orderBy: 'createdAt:desc' as const
  };
  
  // Search controls
  idControl = new FormControl<number | null>(null);
  requesterIdControl = new FormControl<number | null>(null);
  requesterEmailControl = new FormControl('');
  travelerEmailControl = new FormControl('');
  requestTypeControl = new FormControl<'GoAndGo' | 'GoAndGive' | null>(null);
  packageDescriptionControl = new FormControl('');
  limitDateControl = new FormControl('');
  statusControl = new FormControl<'TO_CONFIRM' | 'AWAITING_DELIVER' | 'PROOF_ISSUE' | 'FINISHED' | null>(null);
  minWeightControl = new FormControl<number | null>(null);
  maxWeightControl = new FormControl<number | null>(null);

  Math = Math;

  settleForm: FormGroup;
  resolveForm: FormGroup;
  selectedSettleRequest: Request | null = null;
  selectedResolveRequest: Request | null = null;
  isSettling = false;
  isResolving = false;
  settleActionOptions: Array<{
    value: SettleRequestDto['action'];
    label: string;
  }> = [
    { value: 'CANCEL_AND_REFUND', label: 'Cancel and refund' },
    { value: 'COMPLETE_AND_RELEASE_FUNDS', label: 'Complete and release funds' },
  ];

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild('settleModalTemplate') settleModalTemplate: TemplateRef<any>;
  @ViewChild('resolveModalTemplate') resolveModalTemplate: TemplateRef<any>;
  @ViewChild('selfieModalTemplate') selfieModalTemplate: TemplateRef<any>;

  private settleDialogRef: MatDialogRef<any> | null = null;
  private resolveDialogRef: MatDialogRef<any> | null = null;
  private selfieDialogRef: MatDialogRef<any> | null = null;

  selectedSelfieRequest: Request | null = null;
  selfieSignedUrl: string | null = null;
  selfieExpiresAt: string | null = null;
  isLoadingSelfie = false;
  selfieLoadError: string | null = null;

  constructor(
    private requestsService: RequestsService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    private formBuilder: FormBuilder,
  ) {
    this.settleForm = this.formBuilder.group({
      action: [null, Validators.required],
      note: ['', Validators.maxLength(500)],
    });

    this.resolveForm = this.formBuilder.group({
      note: ['', [Validators.required, Validators.maxLength(500)]],
    });
  }

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Tables' }, { label: 'Request Matches', active: true }];
    
    // Set up search debouncing
    this.setupSearchDebouncing();
    
    // Load initial data
    this.loadRequests();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Set up search debouncing for real-time filtering
   */
  private setupSearchDebouncing(): void {
    // ID search
    this.idControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.id = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Requester ID search
    this.requesterIdControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.requesterId = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Requester email search
    this.requesterEmailControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.requesterEmail = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Traveler email search
    this.travelerEmailControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.travelerEmail = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Package description search
    this.packageDescriptionControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.packageDescription = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Limit date search
    this.limitDateControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.limitDate = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Min weight
    this.minWeightControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.minWeight = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Max weight
    this.maxWeightControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.maxWeight = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Status
    this.statusControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.status = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });

    // Request type
    this.requestTypeControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.filters.requestType = value || undefined;
        this.filters.page = 1;
        this.loadRequests();
      });
  }

  /**
   * Load requests data from API
   */
  loadRequests(): void {
    this.isLoading = true;
    
    this.requestsService.requestControllerGetAllRequests(this.filters).subscribe({
      next: (response: any) => {
        console.log('Requests data:', response);
        
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
        console.error('Error loading requests:', error);
        this.notificationService.error('Failed to load requests data. Please try again.');
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
    this.loadRequests();
  }

  /**
   * Handle sorting changes
   */
  onSortChange(event: Sort): void {
    if (event.direction) {
      // Map the field names to match the API expected values
      const fieldMapping: { [key: string]: string } = {
        'createdAt': 'createdAt',
        'limitDate': 'limitDate',
        'weight': 'weight'
      };
      
      const apiField = fieldMapping[event.active] || event.active;
      this.filters.orderBy = `${apiField}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'createdAt:desc';
    }
    this.loadRequests();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.idControl.setValue(null);
    this.requesterIdControl.setValue(null);
    this.requesterEmailControl.setValue('');
    this.travelerEmailControl.setValue('');
    this.requestTypeControl.setValue(null);
    this.packageDescriptionControl.setValue('');
    this.limitDateControl.setValue('');
    this.statusControl.setValue(null);
    this.minWeightControl.setValue(null);
    this.maxWeightControl.setValue(null);
    
    this.filters = {
      page: 1,
      limit: this.pageSize,
      orderBy: 'createdAt:desc' as const
    };
    
    this.loadRequests();
  }

  /**
   * View request details
   */
  onViewRequest(request: Request): void {
    console.log('View request:', request);
    this.notificationService.info(`Viewing details for request #${request.id}`);
  }

  onSettleRequest(request: Request): void {
    this.selectedSettleRequest = request;
    this.settleForm.reset({
      action: null,
      note: '',
    });

    this.settleDialogRef = this.dialog.open(this.settleModalTemplate, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
    });

    this.settleDialogRef.afterClosed().subscribe(() => {
      this.selectedSettleRequest = null;
      this.isSettling = false;
      this.settleDialogRef = null;
    });
  }

  onResolveRequest(request: Request): void {
    this.selectedResolveRequest = request;
    this.resolveForm.reset({ note: '' });

    this.resolveDialogRef = this.dialog.open(this.resolveModalTemplate, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
    });

    this.resolveDialogRef.afterClosed().subscribe(() => {
      this.selectedResolveRequest = null;
      this.isResolving = false;
      this.resolveDialogRef = null;
    });
  }

  submitResolve(): void {
    if (!this.selectedResolveRequest || this.resolveForm.invalid) {
      this.resolveForm.markAllAsTouched();
      return;
    }

    const body: ResolveRequestDto = {
      note: this.resolveForm.value.note?.trim(),
    };

    this.isResolving = true;

    this.requestsService
      .requestControllerResolveRequest$Json({
        id: this.selectedResolveRequest.id,
        body,
      })
      .subscribe({
        next: (response) => {
          this.notificationService.success(
            response.message ||
              `Request #${this.selectedResolveRequest!.id} dispute resolved successfully`,
          );
          this.isResolving = false;
          this.resolveDialogRef?.close(true);
          this.loadRequests();
        },
        error: (error) => {
          console.error('Error resolving request dispute:', error);
          const message =
            error?.error?.message ||
            error?.message ||
            'Failed to resolve dispute. Please try again.';
          this.notificationService.error(message);
          this.isResolving = false;
        },
      });
  }

  submitSettle(): void {
    if (!this.selectedSettleRequest || this.settleForm.invalid) {
      this.settleForm.markAllAsTouched();
      return;
    }

    const body: SettleRequestDto = {
      action: this.settleForm.value.action,
      note: this.settleForm.value.note?.trim() || undefined,
    };

    this.isSettling = true;

    this.requestsService
      .requestControllerSettleRequest({
        id: this.selectedSettleRequest.id,
        body,
      })
      .subscribe({
        next: () => {
          this.notificationService.success(
            `Request #${this.selectedSettleRequest!.id} settled successfully`,
          );
          this.isSettling = false;
          this.settleDialogRef?.close(true);
          this.loadRequests();
        },
        error: (error) => {
          console.error('Error settling request:', error);
          const message =
            error?.error?.message ||
            error?.message ||
            'Failed to settle request. Please try again.';
          this.notificationService.error(message);
          this.isSettling = false;
        },
      });
  }

  onViewSelfie(request: Request): void {
    this.selectedSelfieRequest = request;
    this.selfieSignedUrl = null;
    this.selfieExpiresAt = null;
    this.selfieLoadError = null;
    this.isLoadingSelfie = true;

    this.selfieDialogRef = this.dialog.open(this.selfieModalTemplate, {
      width: '640px',
      maxWidth: '95vw',
    });

    this.selfieDialogRef.afterClosed().subscribe(() => {
      this.selectedSelfieRequest = null;
      this.selfieSignedUrl = null;
      this.selfieExpiresAt = null;
      this.selfieLoadError = null;
      this.isLoadingSelfie = false;
      this.selfieDialogRef = null;
    });

    this.requestsService
      .requestControllerGetMeetingProofSignedUrl({ id: request.id })
      .subscribe({
        next: (response) => {
          this.selfieSignedUrl = response.signedUrl;
          this.selfieExpiresAt = response.expiresAt;
          this.isLoadingSelfie = false;
        },
        error: (error) => {
          console.error('Error loading meeting proof:', error);
          this.selfieLoadError =
            error?.error?.message ||
            error?.message ||
            'Failed to load meeting proof selfie.';
          this.isLoadingSelfie = false;
        },
      });
  }

  /**
   * Accept request
   */
  onAcceptRequest(request: Request): void {
    const message = `Are you sure you want to accept request #${request.id}?`;
    
    if (confirm(message)) {
      console.log('Accept request:', request);
      this.notificationService.success(`Request #${request.id} accepted successfully`);
      this.loadRequests(); // Refresh the list
    }
  }

  /**
   * Reject request
   */
  onRejectRequest(request: Request): void {
    const message = `Are you sure you want to reject request #${request.id}?`;
    
    if (confirm(message)) {
      console.log('Reject request:', request);
      this.notificationService.success(`Request #${request.id} rejected successfully`);
      this.loadRequests(); // Refresh the list
    }
  }

  /**
   * Complete request
   */
  onCompleteRequest(request: Request): void {
    const message = `Are you sure you want to mark request #${request.id} as completed?`;
    
    if (confirm(message)) {
      console.log('Complete request:', request);
      this.notificationService.success(`Request #${request.id} marked as completed`);
      this.loadRequests(); // Refresh the list
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'negotiating':
      case 'to_confirm':
      case 'proof_issue':
        return 'badge-soft-warning';
      case 'accepted':
      case 'awaiting_deliver':
        return 'badge-soft-info';
      case 'in_transit':
        return 'badge-soft-primary';
      case 'completed':
      case 'finished':
        return 'badge-soft-success';
      case 'rejected':
      case 'cancelled':
      case 'proof_deadline_missed':
      case 'cancellation_disputed':
        return 'badge-soft-danger';
      case 'resolved':
        return 'badge-soft-success';
      case 'expired':
        return 'badge-soft-secondary';
      default:
        return 'badge-soft-secondary';
    }
  }

  /**
   * Get request type badge class
   */
  getRequestTypeBadgeClass(type: string): string {
    return type === 'GoAndGo' ? 'badge-primary' : 'badge-info';
  }

  /**
   * Format weight for display
   */
  formatWeight(weight: string | null): string {
    if (!weight) return 'N/A';
    return `${parseFloat(weight).toFixed(1)} kg`;
  }

  /**
   * Get requester display name
   */
  getRequesterName(requester: any): string {
    if (!requester) return '-';
    if (requester.firstName && requester.lastName) {
      return `${requester.firstName} ${requester.lastName}`;
    }
    return requester.fullName || requester.name || requester.email || `User #${requester.id}` || '-';
  }

  /**
   * Get travel display info
   */
  getTravelInfo(travel: any): string {
    if (!travel) return 'N/A';
    return `${travel.flightNumber} (${travel.description})`;
  }

  /**
   * Get human-readable status text
   */
  getStatusDisplayText(status: string): string {
    switch (status?.toLowerCase()) {
      case 'negotiating': return 'Negotiating';
      case 'to_confirm': return 'To Confirm';
      case 'accepted': return 'Accepted';
      case 'awaiting_deliver': return 'Awaiting Delivery';
      case 'in_transit': return 'In Transit';
      case 'completed': return 'Completed';
      case 'finished': return 'Finished';
      case 'rejected': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      case 'proof_issue': return 'Proof Issue';
      case 'proof_deadline_missed': return 'Proof Deadline Missed';
      case 'cancellation_disputed': return 'Cancellation Disputed';
      case 'resolved': return 'Resolved';
      case 'expired': return 'Expired';
      default: return status || '-';
    }
  }
}
