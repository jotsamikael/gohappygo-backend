import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountDeletionService } from './account-deletion.service';
import { UserEntity } from 'src/user/user.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { RequestEntity } from 'src/request/request.entity';
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import { AlertEntity } from 'src/alert/entities/alert.entity';
import { MessageEntity } from 'src/message/message.entity';
import { EmailVerificationEntity } from 'src/email-verification/email-verification.entity';
import { PhoneVerificationEntity } from 'src/phone-verification/phone-verification.entity';
import { PasswordResetEntity } from 'src/password-reset/password-reset.entity';
import { NotificationEntity } from 'src/notification/entities/notification.entity';
import { SupportRequestEntity } from 'src/support/entities/support-request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { AccountDeletionAuditEntity } from './account-deletion-audit.entity';
import { DemandService } from 'src/demand/demand.service';
import { TravelService } from 'src/travel/travel.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FirebaseAuthService } from 'src/firebase/firebase-auth.service';
import { DeviceTokenService } from 'src/notification/device-token.service';
import { EmailService } from 'src/email/email.service';
import { EmailTemplatesService } from 'src/email/email-templates.service';
import { AccountStatus, DATA_CATEGORIES_REMOVED, DATA_CATEGORIES_RETAINED } from './account-deletion.types';
import { CustomBadRequestException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { Brackets } from 'typeorm';

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;

  const mockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
  };

  const usersRepository = {
    update: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
  };

  const auditRepository = {
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
  };

  const baseUser: UserEntity = {
    id: 42,
    email: 'user@example.com',
    phone: '+33600000000',
    firstName: 'Jane',
    lastName: 'Doe',
    password: 'hash',
    roleId: 1,
    accountStatus: AccountStatus.ACTIVE,
  } as UserEntity;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionService,
        { provide: getRepositoryToken(UserEntity), useValue: usersRepository },
        { provide: getRepositoryToken(DemandEntity), useValue: { createQueryBuilder: () => ({ ...mockQueryBuilder, getMany: jest.fn().mockResolvedValue([]) }) } },
        { provide: getRepositoryToken(TravelEntity), useValue: { createQueryBuilder: () => ({ ...mockQueryBuilder, getMany: jest.fn().mockResolvedValue([]) }) } },
        { provide: getRepositoryToken(RequestEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(BookmarkEntity), useValue: { delete: jest.fn() } },
        { provide: getRepositoryToken(AlertEntity), useValue: { softDelete: jest.fn() } },
        { provide: getRepositoryToken(MessageEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(EmailVerificationEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(PhoneVerificationEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(PasswordResetEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(NotificationEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(SupportRequestEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(TransactionEntity), useValue: { createQueryBuilder: () => mockQueryBuilder } },
        { provide: getRepositoryToken(AccountDeletionAuditEntity), useValue: auditRepository },
        { provide: DemandService, useValue: { cancelDemand: jest.fn() } },
        { provide: TravelService, useValue: { cancelTravel: jest.fn() } },
        { provide: FileUploadService, useValue: { deleteUserVerificationFiles: jest.fn(), deleteUserProfilePicture: jest.fn() } },
        { provide: FirebaseAuthService, useValue: { deleteFirebaseUser: jest.fn() } },
        { provide: DeviceTokenService, useValue: { deleteAllForUser: jest.fn() } },
        { provide: EmailService, useValue: { sendEmail: jest.fn() } },
        { provide: EmailTemplatesService, useValue: { getAccountDeletionConfirmationTemplate: jest.fn().mockReturnValue('<html></html>') } },
      ],
    }).compile();

    service = module.get(AccountDeletionService);
  });

  it('anonymizes account and returns GDPR transparency payload', async () => {
    const result = await service.anonymizeAndCloseAccount(baseUser);

    expect(result.message).toContain('anonymized');
    expect(result.dataCategoriesRemoved).toEqual([...DATA_CATEGORIES_REMOVED]);
    expect(result.dataCategoriesRetained).toEqual([...DATA_CATEGORIES_RETAINED]);
    expect(usersRepository.update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        firstName: 'Deleted',
        lastName: 'User',
        accountStatus: AccountStatus.ANONYMIZED,
        email: expect.stringContaining('@anonymized.gohappygo.invalid'),
        phone: 'deleted-42',
        firebaseUid: undefined,
      }),
    );
    expect(usersRepository.softDelete).toHaveBeenCalledWith(42);
    expect(auditRepository.save).toHaveBeenCalled();
  });

  it('blocks deletion when confirmEmail does not match', async () => {
    await expect(
      service.anonymizeAndCloseAccount(baseUser, { confirmEmail: 'wrong@example.com' }),
    ).rejects.toBeInstanceOf(CustomBadRequestException);
  });

  it('blocks deletion when active accepted request exists', async () => {
    mockQueryBuilder.getCount.mockResolvedValueOnce(1);

    await expect(service.anonymizeAndCloseAccount(baseUser)).rejects.toBeInstanceOf(CustomBadRequestException);
  });

  it('groups user involvement with status filter for active-request precheck', async () => {
    await service.anonymizeAndCloseAccount(baseUser);

    expect(mockQueryBuilder.where.mock.calls[0][0]).toBeInstanceOf(Brackets);

    const blockedStatusFilter = mockQueryBuilder.andWhere.mock.calls.find(
      (call) => call[0] === 'status.status IN (:...blocked)',
    );
    expect(blockedStatusFilter?.[1]).toEqual({
      blocked: ['ACCEPTED', 'NEGOTIATING'],
    });

    const disputedStatusFilter = mockQueryBuilder.andWhere.mock.calls.find(
      (call) => call[0] === 'status.status = :disputedStatus',
    );
    expect(disputedStatusFilter?.[1]).toEqual({
      disputedStatus: 'CANCELLATION_DISPUTED',
    });
  });

  it('blocks deletion when a cancellation dispute is open', async () => {
    mockQueryBuilder.getCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(service.anonymizeAndCloseAccount(baseUser)).rejects.toMatchObject({
      errorCode: ErrorCode.ACCOUNT_DELETION_CANCELLATION_DISPUTED,
    });
  });

  it('blocks deletion when account is already anonymized', async () => {
    await expect(
      service.anonymizeAndCloseAccount({
        ...baseUser,
        accountStatus: AccountStatus.ANONYMIZED,
        deletedAt: new Date(),
      } as UserEntity),
    ).rejects.toBeInstanceOf(CustomBadRequestException);
  });

  it('skips already cancelled future listings when closing an account', async () => {
    const demandGetMany = jest.fn().mockResolvedValue([]);
    const travelGetMany = jest.fn().mockResolvedValue([]);
    const demandCancel = jest.fn();
    const travelCancel = jest.fn();

    const demandRepository = {
      createQueryBuilder: jest.fn(() => ({
        ...mockQueryBuilder,
        getMany: demandGetMany,
      })),
    };
    const travelRepository = {
      createQueryBuilder: jest.fn(() => ({
        ...mockQueryBuilder,
        getMany: travelGetMany,
      })),
    };

    (service as any).demandRepository = demandRepository;
    (service as any).travelRepository = travelRepository;
    (service as any).demandService = { cancelDemand: demandCancel };
    (service as any).travelService = { cancelTravel: travelCancel };

    await service.anonymizeAndCloseAccount(baseUser);

    const demandStatusFilter = mockQueryBuilder.andWhere.mock.calls.find(
      (call) => call[0] === 'd.status != :cancelled',
    );
    const travelStatusFilter = mockQueryBuilder.andWhere.mock.calls.find(
      (call) => call[0] === 't.status != :cancelled',
    );

    expect(demandStatusFilter?.[1]).toEqual({ cancelled: 'cancelled' });
    expect(travelStatusFilter?.[1]).toEqual({ cancelled: 'cancelled' });
    expect(demandCancel).not.toHaveBeenCalled();
    expect(travelCancel).not.toHaveBeenCalled();
  });

  it('deletes linked Firebase user when firebaseUid is present', async () => {
    const firebaseAuthService = (service as any).firebaseAuthService as { deleteFirebaseUser: jest.Mock };

    await service.anonymizeAndCloseAccount({
      ...baseUser,
      firebaseUid: 'firebase-uid-123',
    } as UserEntity);

    expect(firebaseAuthService.deleteFirebaseUser).toHaveBeenCalledWith('firebase-uid-123');
  });
});
