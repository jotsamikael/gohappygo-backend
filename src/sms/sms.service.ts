import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    try {
      // TODO: Integrate with actual SMS provider (Twilio, AWS SNS, etc.)
      // For now, we'll just log the SMS
      this.logger.log(`SMS sent to ${phoneNumber}: Your GoHappyGo verification code is ${code}`);
      
      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
      return false;
    }
  }

  async sendWelcomeMessage(phoneNumber: string, userName: string): Promise<boolean> {
    try {
      this.logger.log(`Welcome SMS sent to ${phoneNumber}: Welcome to GoHappyGo, ${userName}!`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome SMS to ${phoneNumber}:`, error);
      return false;
    }
  }
}