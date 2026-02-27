import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { PasswordResetEntity } from './password-reset.entity';
import { UserEntity } from 'src/user/user.entity';

@Injectable()
export class PasswordResetService {
  
  constructor(
    @InjectRepository(PasswordResetEntity)
    private passwordResetRepository: Repository<PasswordResetEntity>,
  ) {}

  async recordPasswordReset(
    user: UserEntity,
    resetCode: string,
  ): Promise<PasswordResetEntity> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 minutes

    const newReset = this.passwordResetRepository.create({
      code: resetCode,
      expiresAt,
      user,
    });

    const passwordResetRecord = await this.passwordResetRepository.save(newReset);
    return passwordResetRecord;
  }

  async getLatestValidResetCode(user: UserEntity): Promise<PasswordResetEntity | null> {
    const latestReset = await this.passwordResetRepository.findOne({
      where: {
        user: { id: user.id },
        expiresAt: MoreThan(new Date()),
        usedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    return latestReset;
  }

  async getResetCodeByCode(code: string): Promise<PasswordResetEntity | null> {
    const reset = await this.passwordResetRepository.findOne({
      where: {
        code,
        expiresAt: MoreThan(new Date()),
        usedAt: IsNull(),
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return reset;
  }

  async markAsUsed(reset: PasswordResetEntity) {
    reset.usedAt = new Date();
    await this.passwordResetRepository.save(reset);
  }

  async invalidatePreviousCodes(userId: number): Promise<void> {
    // Mark all previous unused codes as used by setting usedAt to current time
    await this.passwordResetRepository.update(
      { 
        user: { id: userId }, 
        usedAt: IsNull()
      },
      { 
        usedAt: new Date() // Mark as used with current timestamp
      }
    );
  }
}
