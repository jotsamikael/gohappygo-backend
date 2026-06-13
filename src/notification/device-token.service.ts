import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDeviceTokenEntity } from './entities/user-device-token.entity';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { RegisterDeviceTokenResponseDto } from './dto/register-device-token-response.dto';

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectRepository(UserDeviceTokenEntity)
    private readonly deviceTokenRepository: Repository<UserDeviceTokenEntity>,
  ) {}

  async register(userId: number, dto: RegisterDeviceTokenDto): Promise<RegisterDeviceTokenResponseDto> {
    const now = new Date();
    const existing = await this.deviceTokenRepository.findOne({
      where: { fcmToken: dto.fcmToken },
    });

    if (existing) {
      existing.userId = userId;
      existing.platform = dto.platform;
      existing.deviceId = dto.deviceId ?? null;
      existing.lastUsedAt = now;
      const updated = await this.deviceTokenRepository.save(existing);
      return { success: true, registeredAt: updated.lastUsedAt };
    }

    const created = this.deviceTokenRepository.create({
      userId,
      fcmToken: dto.fcmToken,
      platform: dto.platform,
      deviceId: dto.deviceId ?? null,
      lastUsedAt: now,
    });
    const saved = await this.deviceTokenRepository.save(created);
    return { success: true, registeredAt: saved.lastUsedAt };
  }

  async unregister(userId: number, fcmToken: string): Promise<void> {
    const existing = await this.deviceTokenRepository.findOne({
      where: { fcmToken, userId },
    });

    if (existing) {
      await this.deviceTokenRepository.remove(existing);
    }
  }

  async getTokensForUser(userId: number): Promise<string[]> {
    const rows = await this.deviceTokenRepository.find({
      where: { userId },
      select: ['fcmToken'],
    });
    return rows.map((row) => row.fcmToken);
  }

  async deleteTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      return;
    }

    await this.deviceTokenRepository
      .createQueryBuilder()
      .delete()
      .from(UserDeviceTokenEntity)
      .where('fcmToken IN (:...tokens)', { tokens })
      .execute();
  }
}
