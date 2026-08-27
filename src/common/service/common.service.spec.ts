import { CommonService } from './common.service';
import { AccountStatus, DELETED_USER_DISPLAY_NAME } from 'src/account-deletion/account-deletion.types';
import { UserEntity } from 'src/user/user.entity';

describe('CommonService anonymized user helpers', () => {
  const service = new CommonService();

  it('detects anonymized users by accountStatus or deletedAt', () => {
    expect(service.isAnonymizedUser({ accountStatus: AccountStatus.ANONYMIZED } as UserEntity)).toBe(true);
    expect(service.isAnonymizedUser({ deletedAt: new Date() } as UserEntity)).toBe(true);
    expect(service.isAnonymizedUser({ accountStatus: AccountStatus.ACTIVE } as UserEntity)).toBe(false);
  });

  it('returns deleted user placeholder without email or phone', () => {
    const placeholder = service.publicUserOrDeletedPlaceholder(null, 99);

    expect(placeholder).toEqual({
      id: 99,
      fullName: DELETED_USER_DISPLAY_NAME,
      profilePictureUrl: null,
      isVerified: false,
    });
  });

  it('redacts anonymized user profile fields', () => {
    const anonymized = service.publicUserOrDeletedPlaceholder({
      id: 5,
      publicId: 'usr_abc',
      firstName: 'Deleted',
      lastName: 'User',
      email: 'deleted+5+hash@anonymized.gohappygo.invalid',
      phone: 'deleted-5',
      accountStatus: AccountStatus.ANONYMIZED,
      deletedAt: new Date(),
      isVerified: true,
      profilePictureUrl: 'https://example.com/p.jpg',
    } as UserEntity);

    expect(anonymized?.fullName).toBe(DELETED_USER_DISPLAY_NAME);
    expect(anonymized?.profilePictureUrl).toBeNull();
    expect(anonymized?.isVerified).toBe(false);
    expect((anonymized as any).email).toBeUndefined();
    expect((anonymized as any).phone).toBeUndefined();
  });
});
