import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { iso2ToFlagEmoji, parsePhoneForDisplay, ParsedPhoneDisplay } from 'src/app/core/utils/phone-display.util';

@Component({
  selector: 'app-phone-table-cell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="phone-table-cell" *ngIf="parsed.raw; else emptyPhone">
      <span
        class="phone-flag"
        *ngIf="flagEmoji"
        [attr.title]="parsed.iso2?.toUpperCase()"
        [attr.aria-label]="parsed.iso2?.toUpperCase()">
        {{ flagEmoji }}
      </span>
      <span class="phone-number">{{ parsed.nationalNumber }}</span>
    </span>
    <ng-template #emptyPhone>
      <span class="text-muted">—</span>
    </ng-template>
  `,
  styles: [`
    .phone-table-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .phone-flag {
      font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .phone-number {
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class PhoneTableCellComponent implements OnChanges {
  @Input() phone: string | null | undefined;

  parsed: ParsedPhoneDisplay = { iso2: null, nationalNumber: '', raw: '' };
  flagEmoji = '';

  ngOnChanges(_changes: SimpleChanges): void {
    this.parsed = parsePhoneForDisplay(this.phone);
    this.flagEmoji = this.parsed.iso2 ? iso2ToFlagEmoji(this.parsed.iso2) : '';
  }
}
