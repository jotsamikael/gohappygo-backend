import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PhoneVerificationEntity } from './phone-verification.entity';
import { UserEntity } from '../user/user.entity';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class PhoneVerificationService {

  constructor(
    @InjectRepository(PhoneVerificationEntity)
    private phoneVerificationRepository: Repository<PhoneVerificationEntity>,
    private smsService: SmsService,
  ) {}

  async recordPhoneVerificationCode(user: UserEntity): Promise<{ code: string; expiresAt: Date }> {
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate previous codes for this user
    await this.invalidatePreviousCodes(user.id);

    // Save the verification code
    const phoneVerification = this.phoneVerificationRepository.create({
      code,
      expiresAt,
      user,
    });

    await this.phoneVerificationRepository.save(phoneVerification);

    // Send SMS (in simulation mode, this will just log)
    await this.smsService.sendVerificationCode(user.phone, code);

    return { code, expiresAt };
  }

  async verifyCode(code: string, foundUser: UserEntity): Promise<boolean> {
    const verification = await this.getLatestValidPhoneVerificationCode(foundUser);
    if(!verification){
      return false;
    }
    if(verification.code !== code){
      return false;
    }
    if(new Date() > verification.expiresAt){
      return false;
    }
    verification.validatedAt = new Date();
    await this.phoneVerificationRepository.save(verification);
    return true;

  }

 async getLatestValidPhoneVerificationCode(foundUser: UserEntity): Promise<PhoneVerificationEntity | null> {
    const verification = await this.phoneVerificationRepository.findOne({
      where: {
        user: { id: foundUser.id },
        validatedAt: IsNull() // Use IsNull() instead of null
      },
      relations: ['user']
    });
    return verification;
  }

  private async invalidatePreviousCodes(userId: number): Promise<void> {
    // Mark all previous unvalidated codes as expired by setting validatedAt
    await this.phoneVerificationRepository.update(
      { 
        user: { id: userId }, 
        validatedAt: IsNull() // Use IsNull() instead of null
      },
      { 
        validatedAt: new Date(0) // Set to epoch time to mark as "used"
      }
    );
  }
}