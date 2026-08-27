import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
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

@Injectable()
export class EmailService {
 
 
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null;
  private supportTransporter: nodemailer.Transporter | null;

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return undefined;
  }

  constructor(
    private configService: ConfigService,
    private emailTemplatesService: EmailTemplatesService,
  ) {
    this.initializeTransporter();
    this.initializeSupportTransporter();
  }

  private initializeTransporter(): void {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPass = this.configService.get<string>('EMAIL_PASSWORD');

    // Skip email setup if no credentials provided
    if (!emailUser || !emailPass) {
      this.logger.warn('Email credentials not configured. Email sending will be skipped.');
      this.logger.warn(`EMAIL_USER: ${emailUser ? 'Set' : 'Not Set'}`);
      this.logger.warn(`EMAIL_PASSWORD: ${emailPass ? 'Set' : 'Not Set'}`);
      return;
    }

    const host = this.configService.get<string>('EMAIL_HOST');
    const portValue = this.configService.get<string | number>('EMAIL_PORT');
    const port = typeof portValue === 'number' ? portValue : parseInt(portValue ?? '587', 10);
    const secureEnv = this.configService.get<boolean | string>('EMAIL_SECURE');
    const secure = this.parseBoolean(secureEnv) ?? port === 465;
    const rejectUnauthorizedEnv = this.configService.get<boolean | string>('EMAIL_TLS_REJECT_UNAUTHORIZED');
    const rejectUnauthorized = this.parseBoolean(rejectUnauthorizedEnv);
    const requireTlsEnv = this.configService.get<boolean | string>('EMAIL_REQUIRE_TLS');
    const requireTLS = this.parseBoolean(requireTlsEnv) ?? port === 587;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // SMTP 587 uses STARTTLS upgrade (secure must be false at connection start).
      secure,
      requireTLS,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        // For self-signed certs before LE is active, set EMAIL_TLS_REJECT_UNAUTHORIZED=false.
        rejectUnauthorized: rejectUnauthorized ?? true,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    this.logger.log(
      `Email transporter created: host=${host}, port=${port}, secure=${secure}, requireTLS=${requireTLS}, rejectUnauthorized=${rejectUnauthorized ?? true}`,
    );

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('Email server connection failed:', error);
      } else {
        this.logger.log('Email server is ready to send messages');
      }
    });
  }

  private initializeSupportTransporter(): void {
    const supportEmail = this.configService.get<string>('SUPPORT_EMAIL_USER');
    const supportPass = this.configService.get<string>('SUPPORT_EMAIL_PASSWORD');

    if (!supportEmail || !supportPass) {
      this.logger.warn(
        'Support email credentials (SUPPORT_EMAIL_USER / SUPPORT_EMAIL_PASSWORD) not configured. Support emails will fallback to primary transporter.',
      );
      this.supportTransporter = null;
      return;
    }

    const host =
      this.configService.get<string>('SUPPORT_EMAIL_HOST') ||
      this.configService.get<string>('EMAIL_HOST');
    const portValue =
      this.configService.get<string | number>('SUPPORT_EMAIL_PORT') ||
      this.configService.get<string | number>('EMAIL_PORT');
    const port = typeof portValue === 'number' ? portValue : parseInt(portValue ?? '587', 10);
    const secureEnv = this.configService.get<boolean | string>('EMAIL_SECURE');
    const secure = this.parseBoolean(secureEnv) ?? port === 465;
    const rejectUnauthorizedEnv = this.configService.get<boolean | string>('EMAIL_TLS_REJECT_UNAUTHORIZED');
    const rejectUnauthorized = this.parseBoolean(rejectUnauthorizedEnv);
    const requireTlsEnv = this.configService.get<boolean | string>('EMAIL_REQUIRE_TLS');
    const requireTLS = this.parseBoolean(requireTlsEnv) ?? port === 587;

    this.supportTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: {
        user: supportEmail,
        pass: supportPass,
      },
      tls: {
        rejectUnauthorized: rejectUnauthorized ?? true,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    this.logger.log(
      `Support email transporter created: host=${host}, port=${port}, secure=${secure}, requireTLS=${requireTLS}, rejectUnauthorized=${rejectUnauthorized ?? true}, user=${supportEmail}`,
    );
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `[Email] NOT CONFIGURED (set EMAIL_USER and EMAIL_PASSWORD). Skipping. Subject: "${options.subject}", to: ${options.to}. This is likely why payment-failure email is not received.`,
      );
      return false;
    }

    const mailOptions = {
      from: options.from || this.configService.get<string>('EMAIL_FROM') || this.configService.get<string>('EMAIL_USER'),
      to: options.to,
      bcc: options.bcc || this.configService.get<string>('EMAIL_ARCHIVE_BCC') || undefined,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    };
    const htmlLength = typeof options.html === 'string' ? options.html.length : 0;
    this.logger.log(
      `[Email] Sending: to=${options.to}, subject="${options.subject}", htmlLength=${htmlLength}, from=${mailOptions.from ?? '(default)'}`,
    );

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`[Email] Sent successfully: messageId=${info.messageId}`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient =
        /socket disconnected|ECONNRESET|ETIMEDOUT|ECONNREFUSED|TLS|connection/i.test(msg);
      if (isTransient) {
        this.logger.warn(
          `[Email] Transient error, retrying once in 2s: ${msg}`,
        );
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const info = await this.transporter.sendMail(mailOptions);
          this.logger.log(`[Email] Sent successfully on retry: messageId=${info.messageId}`);
          return true;
        } catch (retryError) {
          this.logger.error(
            `[Email] Send failed on retry: to=${options.to}, subject="${options.subject}"`,
            retryError instanceof Error ? retryError.stack : retryError,
          );
          return false;
        }
      }
      this.logger.error(
        `[Email] Send failed: to=${options.to}, subject="${options.subject}"`,
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }

  /**
   * Send an email using the support transporter (support@gohappygo.fr).
   * Requires SUPPORT_EMAIL_USER and SUPPORT_EMAIL_PASSWORD to be configured.
   * If the support transporter is not configured, it falls back to the primary
   * transporter with a message indicating it's from support (though the envelope
   * sender will still be the primary email address).
   */
  async sendSupportEmail(options: EmailOptions): Promise<boolean> {
    const supportEmail =
      this.configService.get<string>('SUPPORT_EMAIL') || 'support@gohappygo.fr';

    if (!this.supportTransporter) {
      this.logger.warn(
        'Support email transporter not configured. Falling back to primary email transporter to send support response.',
      );
      return this.sendEmail({
        ...options,
        from: options.from || `"GoHappyGo Support" <${supportEmail}>`,
      });
    }

    const mailOptions = {
      from: options.from || `"GoHappyGo Support" <${supportEmail}>`,
      replyTo: supportEmail,
      to: options.to,
      bcc: options.bcc || this.configService.get<string>('EMAIL_ARCHIVE_BCC') || undefined,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    };

    try {
      const info = await this.supportTransporter.sendMail(mailOptions);
      this.logger.log(
        `[Support Email] Sent successfully: messageId=${info.messageId}, from=${supportEmail}`,
      );
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[Support Email] Failed to send via support transporter: to=${options.to}, subject="${options.subject}", error=${msg}`,
      );
      // Log the failure clearly but do NOT fallback to primary transporter
      // because Mailcow will reject the sender address "support@gohappygo.fr"
      // when authenticated as "noreply@gohappygo.fr".
      this.logger.error(
        `[Support Email] Support email delivery FAILED. The support transporter could not send to ${options.to}. Check the TLS configuration and ensure the support mailbox exists in Mailcow.`,
      );
      return false;
    }
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