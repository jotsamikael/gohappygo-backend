import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  CountrySearchOption,
  findCountryByIso2,
  getCountrySearchOptions,
} from 'src/app/core/utils/phone-display.util';

@Component({
  selector: 'app-phone-search-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  template: `
    <div class="phone-search-field">
      <mat-form-field appearance="outline" class="country-field">
        <mat-label>Country</mat-label>
        <mat-select
          [formControl]="countryControl"
          panelClass="phone-country-panel"
          (selectionChange)="onCountrySelected($event.value)">
          <mat-select-trigger>
            <span class="country-trigger" *ngIf="selectedCountry; else allCountriesTrigger">
              <span class="country-flag">{{ selectedCountry.flag }}</span>
              <span class="country-dial">{{ selectedCountry.dialCode }}</span>
            </span>
            <ng-template #allCountriesTrigger>
              <span class="country-trigger">
                <span class="country-flag">🌍</span>
                <span class="country-dial">All</span>
              </span>
            </ng-template>
          </mat-select-trigger>

          <div class="country-search-box" (click)="$event.stopPropagation()">
            <input
              class="country-search-input"
              type="text"
              [formControl]="countryFilterControl"
              placeholder="Search country"
              (keydown)="$event.stopPropagation()">
          </div>

          <mat-option [value]="null">All countries</mat-option>
          <mat-option *ngFor="let country of filteredCountries" [value]="country.iso2">
            <span class="country-option">
              <span class="country-flag">{{ country.flag }}</span>
              <span class="country-name">{{ country.name }}</span>
              <span class="country-dial">{{ country.dialCode }}</span>
            </span>
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="number-field">
        <mat-label>{{ label }}</mat-label>
        <input
          matInput
          type="tel"
          [formControl]="numberControl"
          placeholder="Enter phone number"
          autocomplete="off">
        <mat-icon matSuffix>phone</mat-icon>
      </mat-form-field>
    </div>
  `,
  styles: [`
    .phone-search-field {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      width: 100%;
    }

    .country-field {
      width: 8.5rem;
      flex-shrink: 0;
    }

    .number-field {
      flex: 1;
      min-width: 0;
    }

    .country-trigger,
    .country-option {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
    }

    .country-flag {
      font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
      font-size: 1.1rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .country-dial {
      color: rgba(0, 0, 0, 0.7);
      font-size: 0.875rem;
      white-space: nowrap;
    }

    .country-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .country-option .country-dial {
      margin-left: auto;
      padding-left: 0.75rem;
    }

    .country-search-box {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 0.5rem 1rem;
      background: #fff;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .country-search-input {
      width: 100%;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      padding: 0.45rem 0.65rem;
      font-size: 0.875rem;
      outline: none;
    }

    .country-search-input:focus {
      border-color: #3f51b5;
    }
  `]
})
export class PhoneSearchFieldComponent implements OnInit {
  @Input({ required: true }) numberControl!: FormControl<string | null>;
  @Input() countryControl: FormControl<string | null> = new FormControl<string | null>(null);
  @Input() label = 'Phone number';
  @Output() countryChange = new EventEmitter<CountrySearchOption | null>();

  countryFilterControl = new FormControl('', { nonNullable: true });

  countries: CountrySearchOption[] = [];
  filteredCountries: CountrySearchOption[] = [];
  selectedCountry: CountrySearchOption | null = null;

  ngOnInit(): void {
    this.countries = getCountrySearchOptions();
    this.filteredCountries = this.countries;
    this.selectedCountry = findCountryByIso2(this.countryControl.value) ?? null;

    this.countryControl.valueChanges.subscribe((iso2) => {
      this.selectedCountry = iso2 ? findCountryByIso2(iso2) ?? null : null;
    });

    this.countryFilterControl.valueChanges.subscribe((term) => {
      const query = term.trim().toLowerCase();
      this.filteredCountries = !query
        ? this.countries
        : this.countries.filter((country) =>
            country.name.toLowerCase().includes(query) ||
            country.dialCode.includes(query) ||
            country.iso2.includes(query)
          );
    });
  }

  onCountrySelected(iso2: string | null): void {
    this.selectedCountry = iso2 ? findCountryByIso2(iso2) ?? null : null;
    this.countryChange.emit(this.selectedCountry);
  }
}
