import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { EmailVerificationEntity } from './email-verification.entity';
import { UserEntity } from 'src/user/user.entity';

@Injectable()
export class EmailVerificationService {
  
  constructor(
    @InjectRepository(EmailVerificationEntity)
    private emailVerificationRepository: Repository<EmailVerificationEntity>,
  ) {}

  async recordEmailVerification(
    user: UserEntity,
    verificationCode: string,
  ): Promise<EmailVerificationEntity> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 minutes

    const newVerification = this.emailVerificationRepository.create({
      code: verificationCode,
      expiresAt,
      user,
    });

    const emailVerificationRecord = await this.emailVerificationRepository.save(newVerification);
    return emailVerificationRecord;
  }

  async getLatestValidEmailVerificationCode(user: UserEntity): Promise<EmailVerificationEntity | null> {
    const latestVerification = await this.emailVerificationRepository.findOne({
      where: {
        user: { id: user.id },
        expiresAt: MoreThan(new Date()),
        validatedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    return latestVerification;
  }

  async setValidatedDate(verification: EmailVerificationEntity) {
    verification.validatedAt = new Date();
    await this.emailVerificationRepository.save(verification);
  }
}