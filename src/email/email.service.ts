import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MailjetModule = require('node-mailjet');
import type { Client, LibraryResponse, SendEmailV3_1 } from 'node-mailjet';
import { EmailTemplatesService } from './email-templates.service';
import { RequestEvent, TravelEvent } from 'src/events/user-events.service';

type MailjetConnect = {
  apiConnect: (apiKey: string, apiSecret: string) => Client;
};

/** node-mailjet is CJS (`module.exports = Mailjet`). ESM default import compiles to missing `.default`. */
function getMailjetSdk(): MailjetConnect {
  const mod = MailjetModule as unknown as MailjetConnect & { default?: MailjetConnect };
  return mod.default ?? mod;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

type MailjetContact = { Email: string; Name?: string };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private mailjet: Client | null = null;

  constructor(
    private configService: ConfigService,
    private emailTemplatesService: EmailTemplatesService,
  ) {
    this.initializeMailjet();
  }

  private initializeMailjet(): void {
    const apiKey =
      this.configService.get<string>('MAILJET_API_KEY') ||
      this.configService.get<string>('MJ_APIKEY_PUBLIC');
    const apiSecret =
      this.configService.get<string>('MAILJET_API_SECRET') ||
      this.configService.get<string>('MJ_APIKEY_PRIVATE');

    if (!apiKey || !apiSecret) {
      this.logger.warn(
        '[Mailjet] Client NOT initialized: MAILJET_API_KEY / MAILJET_API_SECRET missing. Outbound mail will be skipped.',
      );
      return;
    }

    try {
      this.mailjet = getMailjetSdk().apiConnect(apiKey, apiSecret);
      this.logger.log(
        `[Mailjet] Client initialized: keyPrefix=${apiKey.slice(0, 6)}…, sandbox=${this.isSandbox()}`,
      );
    } catch (error) {
      this.mailjet = null;
      this.logger.error(
        `[Mailjet] Client init failed (API will still boot; outbound mail skipped): ${this.formatMailjetError(error)}`,
      );
    }
  }

  private formatMailjetError(error: unknown): string {
    const err = error as {
      message?: string;
      ErrorMessage?: string;
      statusCode?: number;
      status?: number;
      code?: string;
      errno?: string;
      response?: { status?: number; statusText?: string; data?: unknown };
    };
    const httpStatus =
      err?.statusCode ?? err?.status ?? err?.response?.status;
    const body = err?.response?.data
      ? JSON.stringify(err.response.data)
      : undefined;
    return [
      `message=${err?.message ?? String(error)}`,
      err?.ErrorMessage ? `ErrorMessage=${err.ErrorMessage}` : null,
      httpStatus !== undefined ? `httpStatus=${httpStatus}` : null,
      err?.code ? `code=${err.code}` : null,
      err?.errno ? `errno=${err.errno}` : null,
      err?.response?.statusText ? `statusText=${err.response.statusText}` : null,
      body ? `body=${body}` : null,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private parseFrom(from: string): MailjetContact {
    const angled = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (angled) {
      const name = angled[1].trim();
      return name
        ? { Email: angled[2].trim(), Name: name }
        : { Email: angled[2].trim() };
    }
    return { Email: from.trim() };
  }

  private toContacts(value?: string | string[]): MailjetContact[] {
    if (!value) {
      return [];
    }
    const list = Array.isArray(value) ? value : [value];
    return list
      .map((entry) => entry?.trim())
      .filter((entry): entry is string => !!entry)
      .map((entry) => this.parseFrom(entry));
  }

  private toAttachments(
    attachments?: EmailOptions['attachments'],
  ): SendEmailV3_1.Attachment[] | undefined {
    if (!attachments?.length) {
      return undefined;
    }
    return attachments.map((file) => ({
      Filename: file.filename,
      ContentType: file.contentType || 'application/octet-stream',
      Base64Content: Buffer.isBuffer(file.content)
        ? file.content.toString('base64')
        : Buffer.from(file.content, 'utf8').toString('base64'),
    }));
  }

  private isSandbox(): boolean {
    return this.configService.get<string>('MAILJET_SANDBOX') === 'true';
  }

  private defaultFrom(): string {
    return (
      this.configService.get<string>('EMAIL_FROM') ||
      'noreply@gohappygo.fr'
    );
  }

  private async dispatchMailjet(
    options: EmailOptions,
    logPrefix: string,
  ): Promise<boolean> {
    if (!this.mailjet) {
      this.logger.warn(
        `[Mailjet][${logPrefix}] SKIPPED: client not initialized (MAILJET_API_KEY / MAILJET_API_SECRET). Mailjet never received this send. subject="${options.subject}", to=${options.to}.`,
      );
      return false;
    }

    const from = this.parseFrom(options.from || this.defaultFrom());
    const to = this.toContacts(options.to);
    if (to.length === 0) {
      this.logger.error(
        `[Mailjet][${logPrefix}] SKIPPED: missing recipient. Mailjet never received this send. subject="${options.subject}"`,
      );
      return false;
    }

    const bcc = this.toContacts(
      options.bcc || this.configService.get<string>('EMAIL_ARCHIVE_BCC') || undefined,
    );
    const attachments = this.toAttachments(options.attachments);
    const htmlLength = typeof options.html === 'string' ? options.html.length : 0;
    this.logger.log(
      `[Mailjet][${logPrefix}] Preparing send: provider=mailjet, endpoint=POST /v3.1/send, sandbox=${this.isSandbox()}, from=${from.Email}, to=${to.map((c) => c.Email).join(',')}, bcc=${bcc.map((c) => c.Email).join(',') || '(none)'}, subject="${options.subject}", htmlLength=${htmlLength}, attachments=${attachments?.length ?? 0}`,
    );

    const message: SendEmailV3_1.Message = {
      From: from,
      To: to,
      Subject: options.subject,
      HTMLPart: options.html,
      TextPart: options.text,
    };
    if (bcc.length) {
      message.Bcc = bcc;
    }
    if (attachments) {
      message.Attachments = attachments;
    }

    const body: SendEmailV3_1.Body = {
      SandboxMode: this.isSandbox(),
      Messages: [message],
    };

    try {
      return await this.requestMailjet(body, options.subject, logPrefix);
    } catch (error) {
      const details = this.formatMailjetError(error);
      const isTransient = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket|timeout|5\d\d/i.test(
        details,
      );
      if (!isTransient) {
        this.logger.error(
          `[Mailjet][${logPrefix}] HTTP call failed before/without a success payload (Mailjet may not have accepted the message): to=${options.to}, subject="${options.subject}", ${details}`,
        );
        return false;
      }
      this.logger.warn(
        `[Mailjet][${logPrefix}] Transient HTTP error, retrying once in 2s: ${details}`,
      );
      await new Promise((r) => setTimeout(r, 2000));
      try {
        return await this.requestMailjet(body, options.subject, logPrefix);
      } catch (retryError) {
        this.logger.error(
          `[Mailjet][${logPrefix}] HTTP call failed on retry (Mailjet did not confirm receipt): to=${options.to}, subject="${options.subject}", ${this.formatMailjetError(retryError)}`,
        );
        return false;
      }
    }
  }

  private async requestMailjet(
    body: SendEmailV3_1.Body,
    subject: string,
    logPrefix: string,
  ): Promise<boolean> {
    const started = Date.now();
    this.logger.log(
      `[Mailjet][${logPrefix}] Calling Mailjet now: POST https://api.mailjet.com/v3.1/send subject="${subject}"`,
    );
    const result: LibraryResponse<SendEmailV3_1.Response> = await this.mailjet!
      .post('send', { version: 'v3.1' })
      .request(body);
    const elapsedMs = Date.now() - started;
    const httpStatus = result.response?.status;
    const message = result.body?.Messages?.[0];
    const delivered = message?.To?.[0];

    this.logger.log(
      `[Mailjet][${logPrefix}] Mailjet HTTP response received: httpStatus=${httpStatus}, elapsedMs=${elapsedMs}, payloadStatus=${message?.Status ?? 'missing'}, messageId=${delivered?.MessageID ?? 'n/a'}, messageUuid=${delivered?.MessageUUID ?? 'n/a'}, messageHref=${delivered?.MessageHref ?? 'n/a'}`,
    );

    const httpOk = httpStatus == null || (httpStatus >= 200 && httpStatus < 300);
    if (httpOk && message?.Status === 'success') {
      const sandboxNote = this.isSandbox()
        ? ' SANDBOX MODE: Mailjet accepted the payload but will not deliver to the inbox.'
        : '';
      this.logger.log(
        `[Mailjet][${logPrefix}] Mailjet ACCEPTED the send. Look up messageId=${delivered?.MessageID} in the Mailjet dashboard (Delivered/Bounced/Blocked).${sandboxNote}`,
      );
      return true;
    }

    this.logger.error(
      `[Mailjet][${logPrefix}] Mailjet responded but DID NOT accept the message: subject="${subject}", httpStatus=${httpStatus}, payloadStatus=${message?.Status}, errors=${JSON.stringify(message?.Errors)}, raw=${JSON.stringify(result.body)}`,
    );
    return false;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    return this.dispatchMailjet(options, 'Email');
  }

  /**
   * Send from support@gohappygo.fr via the same Mailjet account.
   */
  async sendSupportEmail(options: EmailOptions): Promise<boolean> {
    const supportEmail =
      this.configService.get<string>('SUPPORT_EMAIL') || 'support@gohappygo.fr';
    return this.dispatchMailjet(
      {
        ...options,
        from: options.from || `"GoHappyGo Support" <${supportEmail}>`,
      },
      'Support Email',
    );
  }

  /**
   * Send a response to a support request from the support email address.
   */
  async respondToSupportRequest(
    userEmail: string,
    subject: string,
    htmlContent: string,
  ): Promise<boolean> {
    return this.sendSupportEmail({
      to: userEmail,
      subject,
      html: htmlContent,
    });
  }

  // Convenience methods for common emails
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    const html = this.emailTemplatesService.getWelcomeTemplate(userName);
    return this.sendEmail({
      to: userEmail,
      subject: 'Welcome to GoHappyGo!',
      html,
    });
  }

  async sendPhoneVerificationEmail(userEmail: string, userName: string, verificationCode: string): Promise<boolean> {
    const html = this.emailTemplatesService.getPhoneVerificationTemplate(userName, verificationCode);
    return this.sendEmail({
      to: userEmail,
      subject: 'Verify Your Phone Number - GoHappyGo',
      html,
    });
  }

  async sendVerificationDocumentsReceived(userEmail: string, userName: string): Promise<boolean> {
    const html = this.emailTemplatesService.getVerificationDocumentsReceivedTemplate(userName);
    return this.sendEmail({
      to: userEmail,
      subject: 'Verification Documents Received - GoHappyGo',
      html,
    });
  }

  async sendVerificationApproved(userEmail: string, userName: string): Promise<boolean> {
    const html = this.emailTemplatesService.getVerificationApprovedTemplate(userName);
    return this.sendEmail({
      to: userEmail,
      subject: 'Account Verified - GoHappyGo',
      html,
    });
  }

  async sendVerificationRejected(userEmail: string, userName: string, reason: string): Promise<boolean> {
    const html = this.emailTemplatesService.getVerificationRejectedTemplate(userName, reason);
    return this.sendEmail({
      to: userEmail,
      subject: 'Verification Update - GoHappyGo',
      html,
    });
  }

  async sendTravelPublishedConfirmation(userEmail: string, userName: string, travelData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getTravelPublishedTemplate(userName, travelData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Travel Published Successfully - GoHappyGo',
      html,
    });
  }

  async sendTravelCancelledConfirmation(
    userEmail: string,
    userName: string,
    event: TravelEvent,
  ): Promise<boolean> {
    const html = this.emailTemplatesService.getTravelCancelledTemplate(userName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Travel Cancelled - GoHappyGo',
      html,
    });
  }

  async sendDemandPublishedConfirmation(userEmail: string, userName: string, demandData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getDemandPublishedTemplate(userName, demandData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Demand Published Successfully - GoHappyGo',
      html,
    });
  }

  async sendRequestAccepted(userEmail: string, userName: string, requestData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getRequestAcceptedTemplate(userName, requestData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Accepted - GoHappyGo',
      html,
    });
  }

  async sendRequestAcceptedForOwner(userEmail: string, userName: string, requestData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getRequestAcceptedForOwnerTemplate(userName, requestData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Confirmation - GoHappyGo',
      html,
    });
  }

  async sendTransactionCompleted(userEmail: string, userName: string, transactionData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getTransactionCompletedTemplate(userName, transactionData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Transaction Completed - GoHappyGo',
      html,
    });
  }

  sendRequestCreatedConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestCreatedTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Created - GoHappyGo',
      html,
    });
  }

  sendRequestCreatedForOwnerConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestCreatedForOwnerTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Created - GoHappyGo',
      html,
    });
  }

  sendRequestAcceptedConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestAcceptedTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Accepted - GoHappyGo',
      html,
    });
  }

  sendRequestAcceptedForOwnerConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestAcceptedForOwnerTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Accepted - GoHappyGo',
      html,
    });
  }


  sendRequestCompletedConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestCompletedTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Completed Successfully - GoHappyGo',
      html,
    });
  }
  async sendRequestCancelledDueToListingWithdrawalConfirmation(
    userEmail: string,
    userFirstName: string,
    event: RequestEvent,
  ): Promise<boolean> {
    const html = this.emailTemplatesService.getRequestCancelledDueToListingWithdrawalTemplate(
      userFirstName,
      event,
    );
    return this.sendEmail({
      to: userEmail,
      subject: 'Travel Cancelled — Full Refund Initiated - GoHappyGo',
      html,
    });
  }

  sendRequestCancelledConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestCancelledTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Cancelled - GoHappyGo',
      html,
    });
  }

  async sendRequestCancelledDueToPaymentFailureConfirmation(
    userEmail: string,
    userFirstName: string,
    event: RequestEvent,
    paymentErrorMessage: string,
  ): Promise<boolean> {
    this.logger.log(
      `[Payment-failure email] Building and sending: to=${userEmail}, requestId=${event.requestId}, hasHtmlInputs=${!!userFirstName && !!paymentErrorMessage}`,
    );
    let html: string;
    try {
      html = this.emailTemplatesService.getRequestCancelledDueToPaymentFailureTemplate(
        userFirstName,
        event,
        paymentErrorMessage,
      );
      this.logger.log(`[Payment-failure email] Template built: htmlLength=${html?.length ?? 0}`);
    } catch (err) {
      this.logger.error(
        `[Payment-failure email] Template build failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return false;
    }
    if (!html || html.length === 0) {
      this.logger.warn('[Payment-failure email] Template returned empty html');
      return false;
    }
    const result = await this.sendEmail({
      to: userEmail,
      subject: 'Your GoHappyGo request – action needed',
      html,
    });
    this.logger.log(`[Payment-failure email] sendEmail result: ${result}`);
    return result;
  }

  sendRequestCancelledForOwnerConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestCancelledForOwnerTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Cancelled on Your Travel/Demand - GoHappyGo',
      html,
    });
  }

  sendRequestRejectedConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestRejectedTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Rejected - GoHappyGo',
      html,
    });
  }

  sendRequestRejectedForOwnerConfirmation(userEmail: string, userFirstName: string, event: RequestEvent) {
    const html = this.emailTemplatesService.getRequestRejectedForOwnerTemplate(userFirstName, event);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Rejected - GoHappyGo',
      html,
    });
  }

  sendRequestCompletedForOwnerConfirmation(userEmail: string, userFirstName: string, event: RequestEvent, fundStatus?: 'pending_funds' | 'pending_onboarding' | 'released') {
    const html = this.emailTemplatesService.getRequestCompletedForOwnerTemplate(userFirstName, event, fundStatus);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Completed Successfully - GoHappyGo',
      html,
    });
  }

  async sendCancellationConfirmationRequest(userEmail: string, userFirstName: string, requestData: any, isReminder: boolean = false): Promise<boolean> {
    const html = this.emailTemplatesService.getCancellationConfirmationRequestTemplate(userFirstName, requestData, isReminder);
    return this.sendEmail({
      to: userEmail,
      subject: isReminder ? 'Reminder: Cancellation Confirmation Required - GoHappyGo' : 'Cancellation Confirmation Required - GoHappyGo',
      html,
    });
  }

  async sendCancellationPending(userEmail: string, userFirstName: string, requestData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getCancellationPendingTemplate(userFirstName, requestData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Cancellation Submitted — Awaiting Seller - GoHappyGo',
      html,
    });
  }

  async sendCancellationConfirmed(userEmail: string, userFirstName: string, requestData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getCancellationConfirmedTemplate(userFirstName, requestData);
    const isAutoSeller =
      requestData.isForOwner && requestData.cancellationConfirmedBy === 'auto';
    const isAutoBuyer =
      !requestData.isForOwner && requestData.cancellationConfirmedBy === 'auto';
    let subject = 'Cancellation Confirmed - GoHappyGo';
    if (isAutoSeller) {
      subject = 'Request Auto-Cancelled (No Response) - GoHappyGo';
    } else if (isAutoBuyer) {
      subject = 'Cancellation Automatically Approved - GoHappyGo';
    }
    return this.sendEmail({
      to: userEmail,
      subject,
      html,
    });
  }

  async sendDisputeResolved(
    userEmail: string,
    userFirstName: string,
    requestData: RequestEvent,
    isForOwner: boolean,
  ): Promise<boolean> {
    const html = this.emailTemplatesService.getDisputeResolvedTemplate(userFirstName, requestData, isForOwner);
    return this.sendEmail({
      to: userEmail,
      subject: 'Cancellation Dispute Resolved - GoHappyGo',
      html,
    });
  }

  async sendCancellationDisputed(userEmail: string, userFirstName: string, requestData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getCancellationDisputedTemplate(userFirstName, requestData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Cancellation Disputed - GoHappyGo',
      html,
    });
  }

  async sendAdminCancellationPending(adminEmail: string, adminFirstName: string, requests: any[]): Promise<boolean> {
    const html = this.emailTemplatesService.getAdminCancellationPendingTemplate(adminFirstName, requests);
    return this.sendEmail({
      to: adminEmail,
      subject: `Daily summary: ${requests.length} pending cancellation confirmation(s) - GoHappyGo`,
      html,
    });
  }

  async sendAdminCancellationDisputed(adminEmail: string, adminFirstName: string, requestData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getAdminCancellationDisputedTemplate(adminFirstName, requestData);
    return this.sendEmail({
      to: adminEmail,
      subject: 'Admin Alert: Cancellation Disputed - GoHappyGo',
      html,
    });
  }

  async sendAutoCompletionNotification(userEmail: string, userFirstName: string, requestData: any, isForOwner: boolean): Promise<boolean> {
    const html = this.emailTemplatesService.getAutoCompletionNotificationTemplate(userFirstName, requestData, isForOwner);
    return this.sendEmail({
      to: userEmail,
      subject: 'Request Auto-Completed - GoHappyGo',
      html,
    });
  }
 
}