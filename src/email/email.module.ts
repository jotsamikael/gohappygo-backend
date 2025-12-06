import { Module } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';

@Module({
    imports: [ConfigModule],
    providers: [EmailService, EmailTemplatesService],
    exports: [EmailService, EmailTemplatesService],
  })
export class EmailModule {}
