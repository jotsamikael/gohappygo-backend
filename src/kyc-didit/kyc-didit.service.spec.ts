import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import * as crypto from 'crypto';
import { KycDiditService } from './kyc-didit.service';
import { UserEntity } from '../user/user.entity';
import { UserEventsService } from '../events/user-events.service';
import { KycClient } from './dto/start-kyc-query.dto';
import { ErrorCode } from '../common/exception/error-codes';

const SECRET = 'webhook-secret';
const now = () => Math.floor(Date.now() / 1000);

function hmacHex(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex');
}

describe('KycDiditService', () => {
  let service: KycDiditService;
  const users = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const http = {
    get: jest.fn(),
    post: jest.fn(),
  };
  const userEvents = {
    emitKycStarted: jest.fn(),
    emitKycCompleted: jest.fn(),
  };

  const pendingUser = {
    id: 145,
    email: 'patrickolongo@gmail.com',
    phone: '+33612345678',
    firstName: 'Patrick',
    lastName: 'Olongo',
    isVerified: false,
    kycStatus: 'pending',
    kycReference: '4b191f96-8d14-411e-95d6-fd859aeebf3d',
    kycProvider: 'didit',
  } as UserEntity;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycDiditService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                DIDIT_API_KEY: 'api-key',
                DIDIT_BASE_URL: 'https://verification.didit.me',
                DIDIT_WEBHOOK_SECRET_KEY: SECRET,
                DIDIT_WORKFLOW_ID: 'workflow-id',
                KYC_RETURN_URL_WEB: 'https://gohappygo.netlify.app/kyc/return?completed=1',
              };
              return values[key];
            }),
          },
        },
        { provide: HttpService, useValue: http },
        { provide: getRepositoryToken(UserEntity), useValue: users },
        { provide: UserEventsService, useValue: userEvents },
      ],
    }).compile();

    service = module.get(KycDiditService);
  });

  describe('mapDiditStatus', () => {
    it('maps Didit v3 labels', () => {
      expect(service.mapDiditStatus('Approved')).toBe('approved');
      expect(service.mapDiditStatus('Declined')).toBe('rejected');
      expect(service.mapDiditStatus('In Progress')).toBe('pending');
      expect(service.mapDiditStatus('Not Started')).toBe('pending');
      expect(service.mapDiditStatus('In Review')).toBe('in_review');
      expect(service.mapDiditStatus('Abandoned')).toBe('failed');
      expect(service.mapDiditStatus('Kyc Expired')).toBe('failed');
    });
  });

  describe('handleWebhook', () => {
    it('sets isVerified from vendor_data when kycReference does not match', async () => {
      users.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(pendingUser);

      const event = {
        webhook_type: 'status.updated',
        timestamp: now(),
        session_id: 'ef1abe2e-a339-4170-a320-8327f0354053',
        status: 'Approved',
        vendor_data: '145',
      };
      const rawBody = JSON.stringify(event);

      await service.handleWebhook(rawBody, {
        'x-timestamp': String(event.timestamp),
        'x-signature': hmacHex(rawBody),
      });

      expect(users.update).toHaveBeenCalledWith(
        145,
        expect.objectContaining({
          kycStatus: 'approved',
          isVerified: true,
          kycReference: 'ef1abe2e-a339-4170-a320-8327f0354053',
        }),
      );
    });

    it('persists in_review without verifying the user', async () => {
      users.findOne.mockResolvedValueOnce(pendingUser);

      const event = {
        webhook_type: 'data.updated',
        timestamp: now(),
        session_id: pendingUser.kycReference,
        status: 'In Review',
        vendor_data: '145',
      };
      const rawBody = JSON.stringify(event);

      await service.handleWebhook(rawBody, {
        'x-timestamp': String(event.timestamp),
        'x-signature': hmacHex(rawBody),
      });

      expect(users.update).toHaveBeenCalledWith(
        145,
        expect.objectContaining({
          kycStatus: 'in_review',
          isVerified: false,
          kycReference: pendingUser.kycReference,
        }),
      );
    });

    it('rejects an invalid signature', async () => {
      await expect(
        service.handleWebhook(JSON.stringify({ status: 'Approved' }), {
          'x-signature': 'deadbeef',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.update).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('syncs Approved Didit sessions instead of creating a new one', async () => {
      http.get.mockReturnValue(
        of({
          data: {
            session_id: pendingUser.kycReference,
            status: 'Approved',
            url: 'https://verify.didit.me/session/old',
          },
        }),
      );

      const result = await service.start(pendingUser, KycClient.WEB);

      expect(http.post).not.toHaveBeenCalled();
      expect(users.update).toHaveBeenCalledWith(
        145,
        expect.objectContaining({
          kycStatus: 'approved',
          isVerified: true,
          kycReference: pendingUser.kycReference,
        }),
      );
      expect(result.sessionId).toBe(pendingUser.kycReference);
      expect(result.message).toBe('KYC is already approved.');
    });

    it('does not create a new session when Didit is In Review', async () => {
      http.get.mockReturnValue(
        of({
          data: {
            session_id: pendingUser.kycReference,
            status: 'In Review',
            url: 'https://verify.didit.me/session/old',
          },
        }),
      );

      await expect(service.start(pendingUser, KycClient.WEB)).rejects.toMatchObject({
        errorCode: ErrorCode.KYC_UNDER_REVIEW,
      });
      expect(http.post).not.toHaveBeenCalled();
      expect(users.update).toHaveBeenCalledWith(
        145,
        expect.objectContaining({
          kycStatus: 'in_review',
          isVerified: false,
        }),
      );
    });
  });
});
