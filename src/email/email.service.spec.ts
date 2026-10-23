import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailTemplatesService } from './email-templates.service';

const request = jest.fn();
const post = jest.fn(() => ({ request }));

jest.mock('node-mailjet', () => ({
  __esModule: true,
  default: {
    apiConnect: jest.fn(() => ({ post })),
  },
}));

describe('EmailService (Mailjet)', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    request.mockResolvedValue({
      response: { status: 200 },
      body: {
        Messages: [
          {
            Status: 'success',
            To: [{ MessageID: 99, MessageUUID: 'uuid-1' }],
          },
        ],
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                MAILJET_API_KEY: 'public-key',
                MAILJET_API_SECRET: 'secret-key',
                EMAIL_FROM: 'noreply@gohappygo.fr',
                SUPPORT_EMAIL: 'support@gohappygo.fr',
              };
              return values[key];
            }),
          },
        },
        {
          provide: EmailTemplatesService,
          useValue: {
            getWelcomeTemplate: jest.fn().mockReturnValue('<p>welcome</p>'),
          },
        },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('sends HTML via Mailjet Send API v3.1', async () => {
    const sent = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(sent).toBe(true);
    expect(post).toHaveBeenCalledWith('send', { version: 'v3.1' });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        Messages: [
          expect.objectContaining({
            From: { Email: 'noreply@gohappygo.fr' },
            To: [{ Email: 'user@example.com' }],
            Subject: 'Hello',
            HTMLPart: '<p>Hi</p>',
          }),
        ],
      }),
    );
  });

  it('sends support mail from support@', async () => {
    await service.sendSupportEmail({
      to: 'user@example.com',
      subject: 'Re: ticket',
      html: '<p>help</p>',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        Messages: [
          expect.objectContaining({
            From: {
              Email: 'support@gohappygo.fr',
              Name: 'GoHappyGo Support',
            },
          }),
        ],
      }),
    );
  });
});
