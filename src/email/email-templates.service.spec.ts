import { ConfigService } from '@nestjs/config';
import { EmailTemplatesService } from './email-templates.service';
import { CommonService } from 'src/common/service/common.service';

describe('EmailTemplatesService alert dates', () => {
  let service: EmailTemplatesService;

  beforeEach(() => {
    service = new EmailTemplatesService(
      { userGreetingName: () => 'Patrick' } as unknown as CommonService,
      { get: () => undefined } as unknown as ConfigService,
    );
  });

  const createdHtml = (travelDate: Date | string) =>
    service.getAlertCreatedEmailTemplate({
      userName: 'Patrick',
      alertType: 'TRAVEL',
      departureAirport: 'Aerie Airport',
      arrivalAirport: 'Turner Field',
      flightNumber: 'AF123',
      travelDate,
      alertId: 38,
    });

  it('keeps YYYY-MM-DD as the same calendar day', () => {
    expect(createdHtml('2026-11-11')).toContain('Travel Date:</strong> 11/11/2026');
  });

  it('keeps ISO travelDateTime calendar day', () => {
    expect(createdHtml('2026-11-11T10:00:00Z')).toContain(
      'Travel Date:</strong> 11/11/2026',
    );
  });

  it('keeps UTC-midnight Date as the same calendar day', () => {
    expect(createdHtml(new Date('2026-11-11T00:00:00.000Z'))).toContain(
      'Travel Date:</strong> 11/11/2026',
    );
  });

  it('keeps local-midnight DATE values without shifting back a day', () => {
    expect(createdHtml(new Date(2026, 10, 11))).toContain(
      'Travel Date:</strong> 11/11/2026',
    );
  });
});
