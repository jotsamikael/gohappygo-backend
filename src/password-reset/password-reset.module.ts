import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetEntity } from './password-reset.entity';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PasswordResetEntity]),
  ],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
