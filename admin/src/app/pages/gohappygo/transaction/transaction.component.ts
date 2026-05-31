import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from 'src/app/core/services/notification.service';
import { TransactionsService } from 'src/app/gohappygobackend/services';
import { TransactionResponseDto } from 'src/app/gohappygobackend/models/transaction-response-dto';

export interface TransactionFilters {
  page?: number;
  limit?: number;
  payerEmail?: string;
  payeeEmail?: string;
  minAmount?: number;
  maxAmount?: number;
  date?: string;
  status?: 'pending' | 'paid' | 'awaiting_transfer' | 'awaiting_available_funds' | 'refunded' | 'cancelled';
  orderBy?: 'createdAt:asc' | 'createdAt:desc' | 'convertedAmount:asc' | 'convertedAmount:desc';
}

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent implements OnInit, AfterViewInit {
  breadCrumbItems: Array<{}>;

  // Table properties
  displayedColumns: string[] = [
    'id', 'payer', 'payee', 'amount', 'currency',
    'status', 'date'
  ];
  dataSource: MatTableDataSource<TransactionResponseDto> = new MatTableDataSource<TransactionResponseDto>([]);

  // Pagination
  totalItems = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];

  // Loading
  isLoading = false;

  // Filters
  filters: TransactionFilters = {
    page: 1,
    limit: 10,
    orderBy: 'createdAt:desc' as const
  };

  // Form controls
  payerEmailControl = new FormControl('');
  payeeEmailControl = new FormControl('');
  minAmountControl = new FormControl<number | null>(null);
  maxAmountControl = new FormControl<number | null>(null);
  dateControl = new FormControl<Date | null>(null);
  statusControl = new FormControl<'pending' | 'paid' | 'awaiting_transfer' | 'awaiting_available_funds' | 'refunded' | 'cancelled' | null>(null);

  Math = Math;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private transactionService: TransactionsService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.breadCrumbItems = [
      { label: 'GoHappyGo' },
      { label: 'Transactions', active: true }
    ];

    this.setupSearchDebouncing();
    this.loadTransactions();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private setupSearchDebouncing(): void {
    this.payerEmailControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.payerEmail = value || undefined;
        this.filters.page = 1;
        this.loadTransactions();
      });

    this.payeeEmailControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.payeeEmail = value || undefined;
        this.filters.page = 1;
        this.loadTransactions();
      });

    this.minAmountControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.minAmount = value ?? undefined;
        this.filters.page = 1;
        this.loadTransactions();
      });

    this.maxAmountControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        this.filters.maxAmount = value ?? undefined;
        this.filters.page = 1;
        this.loadTransactions();
      });

    this.statusControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        this.filters.status = value || undefined;
        this.filters.page = 1;
        this.loadTransactions();
      });
  }

  onDateChange(date: Date | null): void {
    if (date) {
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      this.filters.date = `${year}-${month}-${day}`;
    } else {
      this.filters.date = undefined;
    }
    this.filters.page = 1;
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.isLoading = true;

    this.transactionService.transactionControllerGetAllTransactions(this.filters).subscribe({
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
        console.error('Error loading transactions:', error);
        this.notificationService.error('Failed to load transactions. Please try again.');
        this.isLoading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.filters.page = event.pageIndex + 1;
    this.filters.limit = event.pageSize;
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadTransactions();
  }

  onSortChange(event: Sort): void {
    if (event.direction) {
      const fieldMapping: { [key: string]: string } = {
        'createdAt': 'createdAt',
        'amount': 'convertedAmount'
      };
      const apiField = fieldMapping[event.active] || event.active;
      this.filters.orderBy = `${apiField}:${event.direction}` as any;
    } else {
      this.filters.orderBy = 'createdAt:desc';
    }
    this.filters.page = 1;
    this.loadTransactions();
  }

  clearFilters(): void {
    this.payerEmailControl.setValue('');
    this.payeeEmailControl.setValue('');
    this.minAmountControl.setValue(null);
    this.maxAmountControl.setValue(null);
    this.dateControl.setValue(null);
    this.statusControl.setValue(null);

    this.filters = {
      page: 1,
      limit: this.pageSize,
      orderBy: 'createdAt:desc' as const
    };

    this.loadTransactions();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatAmount(item: TransactionResponseDto): string {
    const amount = Number(item.convertedAmount ?? item.amount ?? 0);
    const code = item.currencyCode || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${code}`;
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'badge-soft-warning';
      case 'paid':
        return 'badge-soft-success';
      case 'awaiting_transfer':
        return 'badge-soft-info';
      case 'awaiting_available_funds':
        return 'badge-soft-secondary';
      case 'refunded':
        return 'badge-soft-primary';
      case 'cancelled':
        return 'badge-soft-danger';
      default:
        return 'badge-soft-secondary';
    }
  }

  getStatusDisplayText(status: string): string {
    switch (status?.toLowerCase()) {
      case 'awaiting_transfer':
        return 'Awaiting Transfer';
      case 'awaiting_available_funds':
        return 'Awaiting Funds';
      default:
        return status ? status.charAt(0).toUpperCase() + status.slice(1) : '-';
    }
  }

  getUserDisplay(user: any): string {
    if (!user) return '-';
    return user.name || user.fullName || user.email || `User #${user.id}` || '-';
  }

  getUserEmail(user: any): string {
    if (!user) return '';
    return user.email || '';
  }
}
