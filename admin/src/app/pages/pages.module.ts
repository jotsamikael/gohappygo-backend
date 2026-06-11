import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { TabsModule } from 'ngx-bootstrap/tabs';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { ModalModule } from 'ngx-bootstrap/modal';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { CollapseModule } from 'ngx-bootstrap/collapse';

import { NgApexchartsModule } from 'ng-apexcharts';
import { FullCalendarModule } from '@fullcalendar/angular';
import { SimplebarAngularModule } from 'simplebar-angular';
import { LightboxModule } from 'ngx-lightbox';

import { WidgetModule } from '../shared/widget/widget.module';
import { UIModule } from '../shared/ui/ui.module';

// Emoji Picker
import { PickerModule } from '@ctrl/ngx-emoji-mart';

import { PagesRoutingModule } from './pages-routing.module';

import { DashboardsModule } from './dashboards/dashboards.module';
import { EmailModule } from './email/email.module';
import { InvoicesModule } from './invoices/invoices.module';
import { TasksModule } from './tasks/tasks.module';
import { ContactsModule } from './contacts/contacts.module';
import { BlogModule } from "./blog/blog.module";
import { UtilityModule } from './utility/utility.module';
import { UiModule } from './ui/ui.module';
import { FormModule } from './form/form.module';
import { TablesModule } from './tables/tables.module';
import { IconsModule } from './icons/icons.module';
import { ChartModule } from './chart/chart.module';
import { CalendarComponent } from './calendar/calendar.component';
import { MapsModule } from './maps/maps.module';
import { ChatComponent } from './chat/chat.component';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input-gg';
import { PhoneTableDisplayPipe } from 'src/app/core/pipes/phone-table-display.pipe';
import { PhoneTableCellComponent } from 'src/app/core/components/phone-table-cell/phone-table-cell.component';
import { PhoneSearchFieldComponent } from 'src/app/core/components/phone-search-field/phone-search-field.component';

import { AccordionModule } from 'ngx-bootstrap/accordion';
import { MatTableExporterModule } from 'mat-table-exporter';
import { MatFormFieldModule } from '@angular/material/form-field';
import { HelpSupportInquiryComponent } from './common/help-support-inquiry/help-support-inquiry.component';

import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { StaffComponent } from './gohappygo/staff/staff.component';
import { UserComponent } from './gohappygo/user/user.component';
import { UserDetailsComponent } from './gohappygo/user/user-details/user-details.component';
import { TransactionComponent } from './gohappygo/transaction/transaction.component';
import { AirlinesComponent } from './gohappygo/airlines/airlines.component';
import { ProfileComponent } from './gohappygo/profile/profile.component';
import { AirportComponent } from './gohappygo/airport/airport.component';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { AirportMapModalComponent } from './gohappygo/airport/airport-map-modal/airport-map-modal.component';
import { ListingComponent } from './gohappygo/listing/listing.component';
import { ListingDetailModalComponent } from './gohappygo/listing/listing-detail-modal/listing-detail-modal.component';
import { MatchComponent } from './gohappygo/match/match.component';
import { QuotesComponent } from './gohappygo/quotes/quotes.component';
import { CurrencyComponent } from './gohappygo/currency/currency.component';
import { ReviewsComponent } from './gohappygo/reviews/reviews.component';
import { PlateformPricingComponent } from './gohappygo/plateform-pricing/plateform-pricing.component';
import { SupportComponent } from './gohappygo/support/support.component';
import { OverviewComponent } from './gohappygo/overview/overview.component';

@NgModule({
  declarations: [StaffComponent, UserComponent, UserDetailsComponent, MatchComponent, ListingComponent, ListingDetailModalComponent, AirportMapModalComponent, CalendarComponent, ChatComponent, HelpSupportInquiryComponent,
     TransactionComponent, AirlinesComponent, ProfileComponent, AirportComponent, QuotesComponent, CurrencyComponent, ReviewsComponent, PlateformPricingComponent, SupportComponent, OverviewComponent],
  imports: [
     // Required by ngx-bootstrap dropdown
     BsDropdownModule.forRoot(),
  // Phone input module
  NgxIntlTelInputModule,

    LeafletModule,
    CKEditorModule,
    MatFormFieldModule,
  MatInputModule,
  MatChipsModule,
  MatAutocompleteModule,
  MatIconModule,
    MatTableExporterModule,
    AccordionModule,
    MatAutocompleteModule,
    MatBadgeModule,
    MatBottomSheetModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatStepperModule,
    MatDatepickerModule,
    MatDialogModule,
    MatDividerModule,
    MatExpansionModule,
    MatGridListModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatRippleModule,
    MatSelectModule,
    MatSidenavModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
    MatTreeModule, 
    CommonModule,
    FormsModule,
    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    PagesRoutingModule,
    NgApexchartsModule,
    ReactiveFormsModule,
    DashboardsModule,
    EmailModule,
    InvoicesModule,
    UIModule,
    TasksModule,
    ContactsModule,
    BlogModule,
    UtilityModule,
    UiModule,
    FormModule,
    TablesModule,
    IconsModule,
    ChartModule,
    WidgetModule,
    MapsModule,
    FullCalendarModule,
    TabsModule.forRoot(),
    TooltipModule.forRoot(),
    CollapseModule.forRoot(),
    SimplebarAngularModule,
    LightboxModule,
    PickerModule,
    NgxIntlTelInputModule,
    PhoneTableDisplayPipe,
    PhoneTableCellComponent,
    PhoneSearchFieldComponent
  ],
})
export class PagesModule { }
