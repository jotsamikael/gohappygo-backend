import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet, { Client, LibraryResponse, SendEmailV3_1 } from 'node-mailjet';
import { EmailTemplatesService } from './email-templates.service';
import { RequestEvent } from 'src/events/user-events.service';

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
        'Mailjet credentials not configured (MAILJET_API_KEY / MAILJET_API_SECRET). Email sending will be skipped.',
      );
      return;
    }

    this.mailjet = Mailjet.apiConnect(apiKey, apiSecret);
    this.logger.log('Mailjet Send API client initialized');
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
        `[${logPrefix}] NOT CONFIGURED (set MAILJET_API_KEY and MAILJET_API_SECRET). Skipping. Subject: "${options.subject}", to: ${options.to}.`,
      );
      return false;
    }

    const from = this.parseFrom(options.from || this.defaultFrom());
    const to = this.toContacts(options.to);
    if (to.length === 0) {
      this.logger.error(`[${logPrefix}] Missing recipient for subject="${options.subject}"`);
      return false;
    }

    const bcc = this.toContacts(
      options.bcc || this.configService.get<string>('EMAIL_ARCHIVE_BCC') || undefined,
    );
    const htmlLength = typeof options.html === 'string' ? options.html.length : 0;
    this.logger.log(
      `[${logPrefix}] Sending: to=${to.map((c) => c.Email).join(',')}, subject="${options.subject}", htmlLength=${htmlLength}, from=${from.Email}`,
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
    const attachments = this.toAttachments(options.attachments);
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
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket|timeout|5\d\d/i.test(
        msg,
      );
      if (!isTransient) {
        this.logger.error(
          `[${logPrefix}] Send failed: to=${options.to}, subject="${options.subject}": ${msg}`,
          error instanceof Error ? error.stack : error,
        );
        return false;
      }
      this.logger.warn(`[${logPrefix}] Transient error, retrying once in 2s: ${msg}`);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        return await this.requestMailjet(body, options.subject, logPrefix);
      } catch (retryError) {
        this.logger.error(
          `[${logPrefix}] Send failed on retry: to=${options.to}, subject="${options.subject}"`,
          retryError instanceof Error ? retryError.stack : retryError,
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
    const result: LibraryResponse<SendEmailV3_1.Response> = await this.mailjet!
      .post('send', { version: 'v3.1' })
      .request(body);
    const message = result.body?.Messages?.[0];
    if (message?.Status === 'success') {
      const delivered = message.To?.[0];
      this.logger.log(
        `[${logPrefix}] Sent successfully: status=${message.Status}, messageId=${delivered?.MessageID}, messageUuid=${delivered?.MessageUUID}`,
      );
      return true;
    }
    this.logger.error(
      `[${logPrefix}] Mailjet did not accept message: subject="${subject}", status=${message?.Status}, errors=${JSON.stringify(message?.Errors)}`,
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

  async sendCancellationConfirmed(userEmail: string, userFirstName: string, requestData: any): Promise<boolean> {
    const html = this.emailTemplatesService.getCancellationConfirmedTemplate(userFirstName, requestData);
    return this.sendEmail({
      to: userEmail,
      subject: 'Cancellation Confirmed - GoHappyGo',
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