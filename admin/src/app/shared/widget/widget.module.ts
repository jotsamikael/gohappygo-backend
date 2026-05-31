import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ModalModule } from 'ngx-bootstrap/modal';

import { StatComponent } from './stat/stat.component';

@NgModule({
  declarations: [StatComponent],
  imports: [
    CommonModule,
    ModalModule.forRoot()
  ],
  exports: [StatComponent]
})
export class WidgetModule { }
