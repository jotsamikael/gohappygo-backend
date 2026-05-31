import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CalendarComponent } from './calendar/calendar.component';
import { ChatComponent } from './chat/chat.component';
import { DefaultComponent } from './dashboards/default/default.component';
import { ProfileComponent } from './common/profile/profile.component';
import { StaffComponent } from './gohappygo/staff/staff.component';
import { UserComponent } from './gohappygo/user/user.component';
import { AirlinesComponent } from './gohappygo/airlines/airlines.component';
import { MatchComponent } from './gohappygo/match/match.component';
import { ListingComponent } from './gohappygo/listing/listing.component';
import { AirportComponent } from './gohappygo/airport/airport.component';
import { QuotesComponent } from './gohappygo/quotes/quotes.component';
import { CurrencyComponent } from './gohappygo/currency/currency.component';
import { ReviewsComponent } from './gohappygo/reviews/reviews.component';
import { PlateformPricingComponent } from './gohappygo/plateform-pricing/plateform-pricing.component';
import { SupportComponent } from './gohappygo/support/support.component';
import { TransactionComponent } from './gohappygo/transaction/transaction.component';
import { OverviewComponent } from './gohappygo/overview/overview.component';


const routes: Routes = [
  // { path: '', redirectTo: 'dashboard' },
  { path: 'backend', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DefaultComponent },


 //core
 { path: 'overview', component:OverviewComponent },
 { path: 'staff', component: StaffComponent },
 { path: 'users', component: UserComponent },
 { path: 'airlines', component: AirlinesComponent },
 { path: 'airports', component: AirportComponent },
 { path: 'quotes-management', component: QuotesComponent },

 { path: 'listing', component: ListingComponent },
 { path: 'match', component: MatchComponent },
 { path: 'transactions', component: TransactionComponent },
 { path: 'currency-management', component: CurrencyComponent },
{path: 'reviews', component: ReviewsComponent},
{path: 'platform-pricing', component: PlateformPricingComponent},
{path: 'support-management', component: SupportComponent},

 //common
 { path: 'profile', component: ProfileComponent },




  { path: 'calendar', component: CalendarComponent },
  { path: 'chat', component: ChatComponent },
  { path: 'dashboards', loadChildren: () => import('./dashboards/dashboards.module').then(m => m.DashboardsModule) },
  { path: 'email', loadChildren: () => import('./email/email.module').then(m => m.EmailModule) },
  { path: 'invoices', loadChildren: () => import('./invoices/invoices.module').then(m => m.InvoicesModule) },
  { path: 'tasks', loadChildren: () => import('./tasks/tasks.module').then(m => m.TasksModule) },
  { path: 'contacts', loadChildren: () => import('./contacts/contacts.module').then(m => m.ContactsModule) },
  { path: 'blog', loadChildren: () => import('./blog/blog.module').then(m => m.BlogModule) },
  { path: 'pages', loadChildren: () => import('./utility/utility.module').then(m => m.UtilityModule) },
  { path: 'ui', loadChildren: () => import('./ui/ui.module').then(m => m.UiModule) },
  { path: 'form', loadChildren: () => import('./form/form.module').then(m => m.FormModule) },
  { path: 'tables', loadChildren: () => import('./tables/tables.module').then(m => m.TablesModule) },
  { path: 'icons', loadChildren: () => import('./icons/icons.module').then(m => m.IconsModule) },
  { path: 'charts', loadChildren: () => import('./chart/chart.module').then(m => m.ChartModule) },
  { path: 'maps', loadChildren: () => import('./maps/maps.module').then(m => m.MapsModule) },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PagesRoutingModule { }
