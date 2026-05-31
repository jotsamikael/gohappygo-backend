import { Component , OnInit} from '@angular/core';
import { TokenRefreshSchedulerService } from './core/services/token-refresh-scheduler.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit  {

  constructor(private readonly tokenRefreshScheduler: TokenRefreshSchedulerService) {}

  ngOnInit() {
    // document.getElementsByTagName("html")[0].setAttribute("dir", "rtl");
  }
}
