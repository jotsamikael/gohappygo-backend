import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { SentryExceptionFilter } from './sentry-exception.filter';
import * as Sentry from '@sentry/nestjs';
import { CustomBadRequestException } from '../exception/custom-exceptions';

jest.mock('@sentry/nestjs', () => ({
  withScope: jest.fn((callback: (scope: { setTag: jest.Mock }) => void) => {
    callback({ setTag: jest.fn() });
  }),
  captureException: jest.fn(),
}));

describe('SentryExceptionFilter', () => {
  const filter = new SentryExceptionFilter();
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-1', user: { id: 188 } }),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not report expected 400 errors to Sentry', () => {
    const exception = new CustomBadRequestException(
      'Account cannot be deleted while a request is in ACCEPTED or NEGOTIATING status.',
      'REQUEST_IN_ACCEPTED_OR_NEGOCIATING_STATUS',
    );

    filter.catch(exception, host);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(BaseExceptionFilter.prototype.catch).toHaveBeenCalled();
  });

  it('does not report generic BadRequestException to Sentry', () => {
    filter.catch(new BadRequestException('validation failed'), host);

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports unexpected 500-class errors to Sentry', () => {
    filter.catch(new Error('NotificationEntity does not have delete date columns.'), host);

    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
