import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
constructor(private configService: ConfigService){

}


  getHello(): string {
    const appName = this.configService.get<string>('APP_NAME','defaultValue')
    console.log(appName,'appName')
    return `App name is: ${appName}`;
  }
}
