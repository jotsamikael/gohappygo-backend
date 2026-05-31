import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DemandsService, TravelsService } from 'src/app/gohappygobackend/services';
import { DemandDetailResponseDto } from 'src/app/gohappygobackend/models/demand-detail-response-dto';
import { TravelDetailResponseDto } from 'src/app/gohappygobackend/models/travel-detail-response-dto';
import { DemandOrTravelResponseDto } from 'src/app/gohappygobackend/models/demand-or-travel-response-dto';

@Component({
  selector: 'app-listing-detail-modal',
  templateUrl: './listing-detail-modal.component.html',
  styles: [`
    .detail-section {
      margin-bottom: 1.25rem;
    }
    .detail-section:last-child {
      margin-bottom: 0;
    }
    .section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6c757d;
      margin-bottom: 0.5rem;
      padding-bottom: 0.375rem;
      border-bottom: 1px solid #e9ecef;
    }
    .detail-label {
      font-size: 0.8rem;
      color: #6c757d;
      margin-bottom: 0.1rem;
    }
    .detail-value {
      font-size: 0.9rem;
      font-weight: 500;
      color: #212529;
    }
    .airline-logo-md {
      width: 28px;
      height: 28px;
      object-fit: contain;
    }
    .user-avatar-md {
      width: 48px;
      height: 48px;
      object-fit: cover;
    }
    .avatar-placeholder-md {
      width: 48px;
      height: 48px;
      font-size: 1.1rem;
      font-weight: 600;
      background-color: #e9ecef;
      color: #6c757d;
    }
  `]
})
export class ListingDetailModalComponent implements OnInit {
  isLoading = false;
  demandDetail: DemandDetailResponseDto | null = null;
  travelDetail: TravelDetailResponseDto | null = null;
  error: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { item: DemandOrTravelResponseDto },
    private dialogRef: MatDialogRef<ListingDetailModalComponent>,
    private demandsService: DemandsService,
    private travelsService: TravelsService
  ) {}

  ngOnInit(): void {
    this.loadDetail();
  }

  private loadDetail(): void {
    this.isLoading = true;
    this.error = null;

    if (this.data.item.type === 'travel') {
      this.travelsService.travelControllerFindOne({ id: this.data.item.id }).subscribe({
        next: (detail) => {
          this.travelDetail = detail;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading travel detail:', err);
          this.error = 'Failed to load travel details.';
          this.isLoading = false;
        }
      });
    } else {
      this.demandsService.demandControllerGetDemandById({ id: this.data.item.id }).subscribe({
        next: (detail) => {
          this.demandDetail = detail;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading demand detail:', err);
          this.error = 'Failed to load demand details.';
          this.isLoading = false;
        }
      });
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  get isTravel(): boolean {
    return this.data.item.type === 'travel';
  }

  get itemTitle(): string {
    return this.isTravel ? 'Travel Details' : 'Demand Details';
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

  toNumber(value: any): number {
    return Number(value) || 0;
  }

  formatWeight(value: number | string | null | undefined, unit = 'kg'): string {
    const num = this.toNumber(value);
    return num ? num.toFixed(1) + ' ' + unit : '-';
  }

  formatPrice(value: number | string | null | undefined): string {
    const num = this.toNumber(value);
    return num ? '$' + num.toFixed(2) : '-';
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'badge-soft-success';
      case 'expired': return 'badge-soft-warning';
      case 'cancelled': return 'badge-soft-danger';
      case 'resolved': return 'badge-soft-info';
      default: return 'badge-soft-secondary';
    }
  }

  getUserInitial(name: string | undefined | null): string {
    return (name || '?').charAt(0).toUpperCase();
  }
}
