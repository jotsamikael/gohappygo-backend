import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestEvent } from 'src/events/user-events.service';
import { CommonService } from 'src/common/service/common.service';
import { EMAIL_BRAND, WrapEmailLayoutOptions } from './email-brand.constants';
import {
  wrapEmailLayout,
  emailButton,
  emailPanel,
  emailHeading,
  emailCodeBlock,
  emailBadge,
} from './email-layout.util';

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);
  private readonly baseUrl: string;
  private readonly logoUrl: string;

  constructor(
    private readonly commonService: CommonService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    this.logoUrl =
      this.configService.get<string>('emailLogoUrl') ||
      this.configService.get<string>('EMAIL_LOGO_URL') ||
      process.env.EMAIL_LOGO_URL ||
      'https://res.cloudinary.com/dgdy4huuc/image/upload/v1787821581/gohappygo/gohappygo_cnmtop.png';
    if (!this.logoUrl) {
      this.logger.warn('EMAIL_LOGO_URL is not set — emails will show a text logo fallback');
    }
  }

  private wrapEmail(options: WrapEmailLayoutOptions): string {
    return wrapEmailLayout(
      { logoUrl: this.logoUrl, baseUrl: this.baseUrl },
      options,
    );
  }

  /** Resolve display name from public user, entity, or precomputed event field. */
  private resolveUserDisplayName(
    user: { username?: string | null; firstName?: string | null; lastName?: string | null; fullName?: string | null } | null | undefined,
    precomputedName?: string | null,
    fallback = 'Unknown',
  ): string {
    const preset = (precomputedName ?? '').trim();
    if (preset) {
      return preset;
    }
    return this.commonService.userGreetingName(user, fallback);
  }

  /** Escape HTML entities so dynamic content cannot break the email HTML. */
  private escapeHtml(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Calendar dates in emails: DD/MM/YYYY (day/month/year).
   * Uses UTC date parts so ISO timestamps stay consistent regardless of server locale.
   */
  private formatEmailDate(value: Date | string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Date-time in emails: DD/MM/YYYY HH:mm (24-hour, UTC).
   */
  private formatEmailDateTime(value: Date | string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const datePart = this.formatEmailDate(d);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${datePart} ${hh}:${mm}`;
  }

  /**
   * Prefer DD/MM/YYYY when the value parses as a date; otherwise HTML-escape the raw string.
   */
  private formatEmailDateFlexible(value: Date | string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) {
      const formatted = this.formatEmailDate(value);
      return formatted || this.escapeHtml(String(value));
    }
    const d = new Date(value as string | number);
    if (!Number.isNaN(d.getTime())) {
      return this.formatEmailDate(d);
    }
    return this.escapeHtml(String(value));
  }

  getWelcomeTemplate(userName: string): string {
    return this.wrapEmail({
      title: 'Welcome to GoHappyGo',
      headerTitle: 'Welcome to GoHappyGo!',
      headerVariant: 'success',
      ctaLabel: 'Go to Dashboard',
      ctaUrl: `${this.baseUrl}/profile/reservations`,
      footerNote: "If you didn't create this account, please ignore this email.",
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        <p>Welcome to GoHappyGo! Your account has been successfully created.</p>
        <p>We're excited to have you join our community of travelers.</p>
        <p>To get started:</p>
        <ul>
          <li>Complete your profile</li>
          <li>Verify your phone number</li>
          <li>Upload verification documents</li>
          <li>Start posting travels or demands</li>
        </ul>`,
    });
  }

  getPhoneVerificationTemplate(userName: string, verificationCode: string): string {
    return this.wrapEmail({
      title: 'Phone Verification - GoHappyGo',
      headerTitle: 'Phone Verification',
      headerVariant: 'info',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`)}
        <p>Please use the following verification code to verify your phone number:</p>
        ${emailCodeBlock(verificationCode)}
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>`,
    });
  }

  getVerificationDocumentsReceivedTemplate(userName: string): string {
    return this.wrapEmail({
      title: 'Documents Received - GoHappyGo',
      headerTitle: 'Documents Received',
      headerVariant: 'warning',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`)}
        <p>We have received your verification documents and they are now under review.</p>
        <p>Our team will review your documents within 24-48 hours and you will receive an email notification once the review is complete.</p>
        <p>Thank you for your patience!</p>`,
    });
  }

  getVerificationApprovedTemplate(userName: string): string {
    return this.wrapEmail({
      title: 'Account Verified - GoHappyGo',
      headerTitle: 'Account Verified!',
      headerVariant: 'success',
      ctaLabel: 'Start Using GoHappyGo',
      ctaUrl: `${this.baseUrl}/profile/reservations`,
      bodyHtml: `
        ${emailHeading(`Congratulations ${userName}!`, EMAIL_BRAND.headerText)}
        <p>Your account has been successfully verified. You can now:</p>
        <ul>
          <li>Post travel declarations</li>
          <li>Publish demands</li>
          <li>Make requests to other users</li>
          <li>Complete transactions</li>
        </ul>`,
    });
  }

  getVerificationRejectedTemplate(userName: string, reason: string): string {
    return this.wrapEmail({
      title: 'Verification Update - GoHappyGo',
      headerTitle: 'Verification Update',
      headerVariant: 'danger',
      ctaLabel: 'Resubmit Documents',
      ctaUrl: `${this.baseUrl}/verification`,
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`)}
        <p>We regret to inform you that your verification documents could not be approved at this time.</p>
        ${emailPanel(`<strong>Reason:</strong> ${reason}`)}
        <p>Please review the reason above and submit new documents that meet our requirements.</p>`,
    });
  }

  getTravelPublishedTemplate(userName: string, travelData: any): string {
    const departureAirport = typeof travelData.departureAirport === 'string'
      ? travelData.departureAirport
      : (travelData.departureAirport?.airportName ||
         travelData.departureAirport?.name ||
         'Unknown');
    const arrivalAirport = typeof travelData.arrivalAirport === 'string'
      ? travelData.arrivalAirport
      : (travelData.arrivalAirport?.airportName ||
         travelData.arrivalAirport?.name ||
         'Unknown');

    const flightRaw =
      travelData.flightNumber != null && travelData.flightNumber !== ''
        ? String(travelData.flightNumber).trim()
        : '';
    const flightDisplay = flightRaw.length > 0 ? flightRaw.toUpperCase() : 'Unknown';

    const travelDtRaw =
      travelData.departureDatetime ??
      travelData.travelDate ??
      null;
    const departureDate =
      travelDtRaw != null && travelDtRaw !== ''
        ? this.formatEmailDate(travelDtRaw) || 'Unknown'
        : 'Unknown';

    const weightAvailable = travelData.weightAvailable || 0;
    const pricePerKg = travelData.pricePerKg || 0;
    const currencySymbol = travelData.currencySymbol || travelData.currency?.symbol || '$';

    return this.wrapEmail({
      title: 'Travel Published - GoHappyGo',
      headerTitle: 'Travel Published Successfully!',
      headerVariant: 'success',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        <p>Your travel has been successfully published and is now visible to travelers.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Travel Details:</h3>
          <p><strong>Flight:</strong> ${flightDisplay}</p>
          <p><strong>From:</strong> ${departureAirport}</p>
          <p><strong>To:</strong> ${arrivalAirport}</p>
          <p><strong>Date:</strong> ${departureDate}</p>
          <p><strong>Available Weight:</strong> ${weightAvailable}kg</p>
          <p><strong>Price per kg:</strong> ${currencySymbol}${pricePerKg}</p>`)}
        <p>You will be notified when someone makes a request for your travel.</p>`,
    });
  }

  getDemandPublishedTemplate(userName: string, demandData: any): string {
    const originAirport = typeof demandData.departureAirport === 'string'
      ? demandData.departureAirport
      : (demandData.departureAirport?.name ||
         demandData.departureAirport?.airportName ||
         demandData.originAirport ||
         'Unknown');
    const destinationAirport = typeof demandData.arrivalAirport === 'string'
      ? demandData.arrivalAirport
      : (demandData.arrivalAirport?.name ||
         demandData.arrivalAirport?.airportName ||
         demandData.destinationAirport ||
         'Unknown');

    const deliveryDate = demandData.deliveryDate || demandData.travelDate;
    const formattedDate = deliveryDate ? (this.formatEmailDate(deliveryDate) || 'Unknown') : 'Unknown';

    const weight = demandData.weight || 0;
    const pricePerKg = demandData.pricePerKg || 0;
    const currencySymbol = demandData.currencySymbol || demandData.currency?.symbol || '$';

    return this.wrapEmail({
      title: 'Demand Published - GoHappyGo',
      headerTitle: 'Demand Published Successfully!',
      headerVariant: 'info',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`)}
        <p>Your demand has been successfully published and is now visible to potential travelers.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Demand Details:</h3>
          <p><strong>Description:</strong> ${demandData.title || demandData.description || 'Unknown'}</p>
          <p><strong>From:</strong> ${originAirport}</p>
          <p><strong>To:</strong> ${destinationAirport}</p>
          <p><strong>Travel Date:</strong> ${formattedDate}</p>
          <p><strong>Weight:</strong> ${weight}kg</p>
          <p><strong>Price per kg:</strong> ${currencySymbol}${pricePerKg}</p>`)}
        <p>You will be notified when someone offers to help with your request.</p>`,
    });
  }

  getRequestAcceptedTemplate(userName: string, requestData: any): string {
    return this.wrapEmail({
      title: 'Request Accepted - GoHappyGo',
      headerTitle: '🎉 Request Accepted!',
      headerVariant: 'success',
      ctaLabel: 'View Request Details',
      ctaUrl: `${this.baseUrl}/profile/travel-requests`,
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        ${requestData.isInstant
          ? `<p><strong>⚡ Instant Travel Purchase Confirmed!</strong></p><p>Your request for ${requestData.weight}kg has been automatically accepted and purchased in an instant travel. The travel process can now begin.</p>`
          : `<p>Great news! Your travel request has been accepted and is ready to proceed.</p>`}
        ${emailPanel(`
          <p><strong>✅ Status:</strong> ${emailBadge('ACCEPTED')}</p>
          <p>Your request is now confirmed and the process can begin.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${requestData.requestId}</p>
          <p><strong>Weight:</strong> ${requestData.weight}kg</p>
          ${requestData.limitDate ? `<p><strong>Request Deadline:</strong> ${this.formatEmailDate(requestData.limitDate)}</p>` : ''}`)}
        <p><strong>What happens next?</strong></p>
        <ul>
          <li>You can now communicate with the traveler through the platform</li>
          <li>Arrange the package handover details</li>
          <li>Track the progress in your dashboard</li>
          <li>Complete payment once request is confirmed</li>
        </ul>
        <p><em>Please keep in touch with the traveler to ensure smooth coordination.</em></p>`,
    });
  }

  getRequestAcceptedForOwnerTemplate(userName: string, requestData: any): string {
    return this.wrapEmail({
      title: 'Request Confirmation - GoHappyGo',
      headerTitle: '✅ Request Confirmed',
      headerVariant: 'info',
      ctaLabel: 'Manage Request',
      ctaUrl: `${this.baseUrl}/profile/travel-requests`,
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`)}
        ${requestData.isInstant
          ? `<p><strong>⚡ Instant Travel Purchase!</strong></p><p>${requestData.requesterName || 'A requester'} has purchased ${requestData.weight}kg in your instant travel. The request has been automatically accepted.</p>`
          : `<p>You have successfully accepted a request. The requester has been notified.</p>`}
        ${emailPanel(`
          <p><strong>✅ Status:</strong> ${emailBadge('ACCEPTED')}</p>
          <p>This request is now active and ready for coordination.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${requestData.requestId}</p>
          <p><strong>Weight:</strong> ${requestData.weight}kg</p>
          ${requestData.limitDate ? `<p><strong> Deadline:</strong> ${this.formatEmailDate(requestData.limitDate)}</p>` : ''}
          <p><strong>Accepted:</strong> ${this.formatEmailDateTime(requestData.timestamp)}</p>`)}
        <p><strong>Next Steps:</strong></p>
        <ul>
          <li>Contact the requester to arrange package pickup</li>
          <li>Confirm request details and timeline</li>
          <li>Coordinate the handover process</li>
          <li>Update request status as you progress</li>
        </ul>
        <p><em>Remember to maintain good communication with the requester throughout the process.</em></p>`,
    });
  }

  getTransactionCompletedTemplate(userName: string, transactionData: any): string {
    return this.wrapEmail({
      title: 'Transaction Completed - GoHappyGo',
      headerTitle: 'Transaction Completed!',
      headerVariant: 'success',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        <p>Your transaction has been successfully completed.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Transaction Details:</h3>
          <p><strong>Amount:</strong> $${transactionData.amount}</p>
          <p><strong>Status:</strong> ${transactionData.status}</p>
          <p><strong>Payment Method:</strong> ${transactionData.paymentMethod}</p>`)}
        <p>Thank you for using GoHappyGo!</p>`,
    });
  }

  getEmailVerificationTemplate(userName: string, verificationCode: string): string {
    return this.wrapEmail({
      title: 'Welcome to GoHappyGo - Email Verification',
      headerTitle: 'Welcome to GoHappyGo',
      headerSubtitle: 'Verify your email to complete registration',
      footerNote: 'This email was sent to you because you registered for a GoHappyGo account. If you have any questions, please contact our support team.',
      bodyHtml: `
        ${emailHeading(`Hello ${userName}`, EMAIL_BRAND.headerText)}
        <p>Please verify your email address using the code below:</p>
        ${emailCodeBlock(verificationCode)}
        ${emailPanel(`
          <h4 style="margin:0 0 8px;color:${EMAIL_BRAND.headerText};">How to verify</h4>
          <ol style="margin:0;padding-left:20px;">
            <li>Copy the verification code above</li>
            <li>Return to the GoHappyGo app or website</li>
            <li>Paste the code in the verification field</li>
            <li>Click "Verify Email" to complete your registration</li>
          </ol>`)}
        <p style="color:${EMAIL_BRAND.muted};font-size:14px;">
          <strong>Important:</strong> This code expires in 10 minutes.
        </p>
        <p style="color:${EMAIL_BRAND.muted};font-size:14px;">
          If you didn't create an account with GoHappyGo, please ignore this email.
        </p>`,
    });
  }

  getVerificationStatusTemplate(
    firstName: string,
    isApproved: boolean,
    reason?: string,
  ): string {
    const statusText = isApproved ? 'approved' : 'rejected';
    const statusIcon = isApproved ? '✅' : '❌';

    const rejectionContent = `
      ${emailPanel(`
        <h4 style="margin:0 0 8px;">What happens next?</h4>
        <ul style="margin:0;padding-left:20px;">
          <li>Your previous verification documents have been removed</li>
          <li>Please upload new, clear verification documents</li>
          <li>Ensure all documents are valid and clearly visible</li>
          <li>You can resubmit your verification at any time</li>
        </ul>`)}
      ${emailPanel(`
        <h4 style="margin:0 0 8px;">How to resubmit:</h4>
        <ol style="margin:0;padding-left:20px;">
          <li>Log into your GoHappyGo account</li>
          <li>Go to your profile settings</li>
          <li>Upload new verification documents (Selfie, ID Front, ID Back)</li>
          <li>Submit for review</li>
        </ol>`)}`;

    return this.wrapEmail({
      title: `Account Verification ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
      headerTitle: `${statusIcon} Account Verification ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
      headerVariant: isApproved ? 'success' : 'danger',
      bodyHtml: `
        <p>Dear ${firstName},</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Your account verification has been <strong>${statusText}</strong></h3>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}`)}
        ${isApproved
          ? `<p>🎉 Congratulations! Your account has been successfully verified. You can now access all features of GoHappyGo.</p>
             <p>If you have any questions, please don't hesitate to contact our support team.</p>`
          : rejectionContent}
        <p>Thank you for choosing GoHappyGo!</p>`,
    });
  }

  getRequestCreatedTemplate(userFirstName: string, event: RequestEvent): string {
    return this.wrapEmail({
      title: 'Request Created - GoHappyGo',
      headerTitle: 'Request Submitted Successfully!',
      headerVariant: 'success',
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`, EMAIL_BRAND.headerText)}
        <p>Your request has been successfully submitted and is now being reviewed.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Weight:</strong> ${event.weight}kg</p>`)}
        <p><strong>What happens next?</strong></p>
        <ul>
          <li>The travel/demand owner will review your request</li>
          <li>You'll receive a notification when they respond</li>
          <li>You can track your request status in your dashboard</li>
        </ul>
        <p>We'll keep you updated on any changes to your request status.</p>`,
    });
  }

  getRequestCreatedForOwnerTemplate(userFirstName: string, event: RequestEvent): string {
    return this.wrapEmail({
      title: 'New Request Received - GoHappyGo',
      headerTitle: 'New Request Received!',
      headerVariant: 'warning',
      ctaLabel: 'View Request in Dashboard',
      ctaUrl: `${this.baseUrl}/profile/reservations`,
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`, EMAIL_BRAND.headerText)}
        <p>You have received a new  request for your travel.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Requester Information:</h3>
          <p><strong>Name:</strong> ${event.userFirstName}</p>
          <p><strong>Email:</strong> ${event.userEmail}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Weight:</strong> ${event.weight}kg</p>
          <p><strong>Submitted:</strong> ${this.formatEmailDateTime(event.timestamp)}</p>`)}
        <p><strong>Next Steps:</strong></p>
        <ul>
          <li>Review the request details carefully</li>
          <li>Check if you can accommodate the package</li>
          <li>Respond to the requester through your dashboard</li>
          <li>Accept or decline the request</li>
        </ul>
        <p><em>Please respond to this request as soon as possible to maintain good service quality.</em></p>`,
    });
  }

  getRequestCompletedTemplate(userFirstName: string, event: RequestEvent): string {
    return this.wrapEmail({
      title: 'Request Completed - GoHappyGo',
      headerTitle: 'Request Completed!',
      headerVariant: 'success',
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`, EMAIL_BRAND.headerText)}
        <p>Excellent news! Your  request has been successfully completed.</p>
        ${emailPanel(`
          <p><strong>✅ Status:</strong> ${emailBadge('COMPLETED')}</p>
          <p>Your package has been delivered as requested.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Weight:</strong> ${event.weight}kg</p>
          <p><strong>Completed:</strong> ${this.formatEmailDateTime(event.timestamp)}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;text-align:center;">⭐ Rate Your Experience</h3>
          <p style="text-align:center;">Help us improve our service by rating your experience.</p>
          ${emailButton(`${this.baseUrl}/profile/reviews`, 'Rate', EMAIL_BRAND.blue)}`)}
        <p><strong>What's next?</strong></p>
        <ul>
          <li>Review and rate the  service</li>
          <li>Complete any final payments if needed</li>
          <li>Share your experience with other users</li>
          <li>Book your next request with GoHappyGo</li>
        </ul>
        ${emailButton(`${this.baseUrl}/profile/reservations`, 'View  Summary', EMAIL_BRAND.blue)}
        <p><em>Thank you for using GoHappyGo! We hope you had a great experience.</em></p>`,
    });
  }

  getRequestCancelledForOwnerTemplate(userFirstName: string, event: RequestEvent): string {
    return this.wrapEmail({
      title: 'Request Cancelled - GoHappyGo',
      headerTitle: 'Request Cancelled',
      headerVariant: 'danger',
      ctaLabel: 'View My Travels',
      ctaUrl: `${this.baseUrl}/profile/travels`,
      footerNote: 'Thank you for using GoHappyGo! If you have any questions, please contact our support team.',
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`)}
        <p>We're writing to inform you that a request on your travel has been cancelled.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Requester:</strong> ${event.requesterName || 'Unknown'}</p>
          <p><strong>Weight:</strong> ${event.weight ? event.weight + 'kg' : 'N/A'}</p>
          <p><strong>Cancelled:</strong> ${this.formatEmailDateTime(event.timestamp)}</p>
          <p><strong>Status:</strong> ${emailBadge('CANCELLED', EMAIL_BRAND.blue)}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">ℹ️ Important Information</h3>
          <p>The requester has cancelled their request. The weight capacity that was reserved for this request is now available again on your travel.</p>
          <p>You can continue to receive other requests for your travel/demand.</p>`)}
        <p><strong>What can you do?</strong></p>
        <ul>
          <li>Check your travel/demand status and available weight</li>
          <li>Wait for new requests from other users</li>
          <li>Contact support if you have any questions</li>
        </ul>`,
    });
  }

  getRequestCancelledTemplate(userFirstName: string, event: RequestEvent): string {
    return this.wrapEmail({
      title: 'Request Cancelled - GoHappyGo',
      headerTitle: 'Request Cancelled',
      headerVariant: 'danger',
      ctaLabel: 'Browse Available Travels',
      ctaUrl: `${this.baseUrl}/annonces`,
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`)}
        <p>We regret to inform you that your request has been cancelled.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Weight:</strong> ${event.weight ? event.weight + 'kg' : 'N/A'}</p>
          <p><strong>Cancelled:</strong> ${this.formatEmailDateTime(event.timestamp)}</p>
          <p><strong>Status:</strong> ${emailBadge('CANCELLED', EMAIL_BRAND.blue)}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">💰 Refund Information</h3>
          <p>If you had made a payment for this request, a full refund has been processed and will be credited back to your original payment method within 5-10 business days.</p>
          <p><strong>Note:</strong> You will receive a separate confirmation email once the refund is processed.</p>`)}
        <p><strong>What can you do?</strong></p>
        <ul>
          <li>Browse other available travels or demands</li>
          <li>Create a new request for a different travel</li>
          <li>Contact support if you have any questions</li>
        </ul>
        <p><em>We apologize for any inconvenience. If you have any questions, please don't hesitate to contact our support team.</em></p>`,
    });
  }

  /**
   * Template when a request could not be completed because payment could not be processed (e.g. when seller accepts).
   * Wording is softened (no "cancelled", "payment failed" in headings) to reduce Gmail filtering.
   */
  getRequestCancelledDueToPaymentFailureTemplate(userFirstName: string, event: RequestEvent, paymentErrorMessage: string): string {
    this.logger.log(
      `[Payment-failure template] Building: requestId=${event?.requestId ?? 'n/a'}, hasFirstName=${!!userFirstName}, hasMessage=${!!paymentErrorMessage}`,
    );
    const safeName = this.escapeHtml(userFirstName);
    const safeMessage = this.escapeHtml(paymentErrorMessage);
    const safeRequestId = this.escapeHtml(event.requestId);
    const safeRequestType = this.escapeHtml(event.requestType);
    const safeWeight = event.weight != null ? this.escapeHtml(String(event.weight)) + 'kg' : 'N/A';

    const html = this.wrapEmail({
      title: 'Your GoHappyGo request – action needed',
      headerTitle: 'Your GoHappyGo request – action needed',
      headerVariant: 'info',
      ctaLabel: 'Create a new request',
      ctaUrl: `${this.baseUrl}/annonces`,
      bodyHtml: `
        ${emailHeading(`Hello ${safeName},`)}
        <p>We were unable to complete your request because we could not process the payment when the traveler tried to accept it.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Details</h3>
          <p>${safeMessage}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request</h3>
          <p><strong>Request ID:</strong> #${safeRequestId}</p>
          <p><strong>Weight:</strong> ${safeWeight}</p>`)}
        <p><strong>Next steps</strong></p>
        <ul>
          <li>Update your payment method (for example, use a different card or ensure sufficient funds)</li>
          <li>Create a new request for the same or another trip</li>
          <li>Contact support if you need help</li>
        </ul>
        <p><em>No charge was made. You can submit a new request with an updated payment method when you are ready.</em></p>`,
    });
    this.logger.log(`[Payment-failure template] Built: htmlLength=${html.length}`);
    return html;
  }

  getRequestCompletedForOwnerTemplate(userFirstName: string, event: RequestEvent, fundStatus?: 'pending_funds' | 'pending_onboarding' | 'released'): string {
    const fundStatusPanel =
      fundStatus === 'pending_funds'
        ? emailPanel(
            `<p style="margin:0;"><strong>⏳ Payment Pending:</strong> Your payment is pending. Funds will be released once they become available in our Stripe account (typically within 1-2 business days). You will receive a notification email when the funds are released.</p>`,
          )
        : fundStatus === 'pending_onboarding'
          ? emailPanel(
              `<p style="margin:0;"><strong>📋 Onboarding Required:</strong> Your payment is pending. Please complete your Stripe onboarding to receive funds. Once you complete the onboarding process, your funds will be automatically released.</p>
               <p style="margin:10px 0 0 0;"><a href="${this.baseUrl}/stripe/onboarding" style="color:${EMAIL_BRAND.blue};text-decoration:underline;">Complete Stripe Onboarding →</a></p>`,
            )
          : `<p>Your earnings will be processed according to our payment schedule.</p>`;

    return this.wrapEmail({
      title: 'Request Successfully Completed - GoHappyGo',
      headerTitle: '✅ Request Completed Successfully!',
      headerVariant: 'info',
      ctaLabel: 'View Earnings',
      ctaUrl: `${this.baseUrl}/profile/reservations`,
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`)}
        <p>Congratulations! You have successfully completed a request.</p>
        ${emailPanel(`
          <p><strong>✅ Status:</strong> ${emailBadge('COMPLETED')}</p>
          <p>Great job on completing this request successfully!</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Client Information:</h3>
          <p><strong>Name:</strong> ${event.userFirstName}</p>
          <p><strong>Email:</strong> ${event.userEmail}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Weight:</strong> ${event.weight}kg</p>
          <p><strong>Completed:</strong> ${this.formatEmailDateTime(event.timestamp)}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;text-align:center;">Earnings Summary</h3>
          ${fundStatusPanel}`)}
        <p><strong>What's next?</strong></p>
        <ul>
          ${fundStatus === 'pending_funds' || fundStatus === 'pending_onboarding'
            ? `<li>Your earnings are secured and will be transferred once ${fundStatus === 'pending_funds' ? 'funds become available' : 'you complete onboarding'}</li>`
            : `<li>Your earnings will be processed and transferred</li>`}
          <li>You may receive a rating from the client</li>
          <li>Consider taking on more requests</li>
          <li>Build your reputation as a reliable traveler</li>
        </ul>
        <p><em>Thank you for being a trusted GoHappyGo traveler! Keep up the excellent work.</em></p>`,
    });
  }

  getKycStartedTemplate(userName: string, redirectUrl: string, sessionId: string): string {
    return this.wrapEmail({
      title: 'KYC Verification Started - GoHappyGo',
      headerTitle: '🔐 KYC Verification Started',
      headerVariant: 'info',
      ctaLabel: 'Complete KYC Verification',
      ctaUrl: redirectUrl,
      footerNote: 'This is an automated message. Please do not reply to this email.',
      bodyHtml: `
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Your KYC (Know Your Customer) verification process has been initiated successfully.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">What's next?</h3>
          <ul style="margin:0;padding-left:20px;">
            <li>Click the button below to complete your identity verification</li>
            <li>You'll need to provide a valid ID document and take a selfie</li>
            <li>The process usually takes 2-5 minutes to complete</li>
            <li>You'll receive an email notification once verification is complete</li>
          </ul>`)}
        <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
        <p>If you have any questions or need assistance, please contact our support team.</p>
        <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>`,
    });
  }

  getKycCompletedTemplate(
    userName: string,
    status: 'approved' | 'rejected' | 'failed',
    sessionId: string,
    reason?: string,
  ): string {
    const isApproved = status === 'approved';
    const statusText = isApproved ? 'Approved' : 'Not Approved';

    return this.wrapEmail({
      title: `KYC Verification ${statusText} - GoHappyGo`,
      headerTitle: `${isApproved ? '✅' : '❌'} KYC Verification ${statusText}`,
      headerVariant: isApproved ? 'success' : 'danger',
      footerNote: 'This is an automated message. Please do not reply to this email.',
      bodyHtml: `
        <p>Hello <strong>${userName}</strong>,</p>
        <p>${isApproved
          ? 'Congratulations! Your identity has been successfully verified.'
          : 'Unfortunately, your identity verification was not approved.'}</p>
        <p style="text-align:center;">${emailBadge(status.toUpperCase(), EMAIL_BRAND.blue)}</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Next Steps:</h3>
          <p>${isApproved
            ? 'You can now enjoy all features of the GoHappyGo platform, including creating travel announcements and requests.'
            : 'Please contact our support team for assistance or try the verification process again.'}</p>`)}
        ${!isApproved ? emailPanel(`
          <h3 style="margin:0 0 8px;">Common reasons for rejection:</h3>
          <ul style="margin:0;padding-left:20px;">
            <li>Document image quality is too low</li>
            <li>Document is expired or invalid</li>
            <li>Face doesn't match the document photo</li>
            <li>Document type is not supported</li>
          </ul>`) : ''}
        <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
        <p>If you have any questions or need assistance, please contact our support team.</p>
        <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>`,
    });
  }

  getSupportRequestReceivedTemplate(supportData: {
    requestId: number;
    email: string;
    message: string;
    category: string;
    requesterType: string;
  }): string {
    return this.wrapEmail({
      title: 'New Support Request Received',
      headerTitle: '🆘 New Support Request',
      headerVariant: 'warning',
      footerNote: 'GoHappyGo Support System - Internal Notification',
      bodyHtml: `
        <p>A new support request has been submitted and requires your attention.</p>
        ${emailPanel(`
          <p><strong>Request ID:</strong> #${supportData.requestId}</p>
          <p><strong>From:</strong> ${supportData.email}</p>
          <p><strong>Requester Type:</strong> ${supportData.requesterType}</p>
          <p><strong>Category:</strong> ${supportData.category}</p>`)}
        ${emailPanel(`
          <p><strong>Message:</strong></p>
          <p>${supportData.message}</p>`)}
        <p>Please log into the admin panel to respond to this request.</p>`,
    });
  }

  getSupportRequestConfirmationTemplate(supportData: {
    requestId: number;
    email: string;
    category: string;
  }): string {
    return this.wrapEmail({
      title: 'Support Request Received',
      headerTitle: '✅ Support Request Received',
      headerVariant: 'success',
      footerNote: 'This is an automated confirmation. Please do not reply to this email.',
      bodyHtml: `
        <p>Thank you for contacting GoHappyGo Support!</p>
        <p>We have received your support request and our team will review it shortly.</p>
        ${emailPanel(`
          <p><strong>Request ID:</strong> #${supportData.requestId}</p>
          <p><strong>Email:</strong> ${supportData.email}</p>
          <p><strong>Category:</strong> ${supportData.category}</p>`)}
        <p>You will receive a response via email as soon as one of our support team members reviews your request.</p>
        <p>For urgent matters, please contact us directly.</p>
        <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>`,
    });
  }

  getSupportResponseFromOperatorTemplate(supportData: {
    requestId: number;
    email: string;
    message: string;
    category: string;
  }): string {
    return this.wrapEmail({
      title: 'Response to Your Support Request',
      headerTitle: '💬 Response from GoHappyGo Support',
      headerVariant: 'info',
      ctaLabel: 'View Support Request',
      ctaUrl: `${this.baseUrl}/support/${supportData.requestId}`,
      footerNote: `GoHappyGo Support - ${supportData.email}`,
      bodyHtml: `
        <p>Hello,</p>
        <p>Our support team has responded to your request:</p>
        ${emailPanel(`
          <p><strong>Request ID:</strong> #${supportData.requestId}</p>
          <p><strong>Category:</strong> ${supportData.category}</p>`)}
        ${emailPanel(`
          <p><strong>Response from our team:</strong></p>
          <p>${supportData.message}</p>`)}
        <p>If you need further assistance, you can reply to this support request by logging into your account.</p>
        <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>`,
    });
  }

  getSupportReplyFromUserTemplate(supportData: {
    requestId: number;
    email: string;
    message: string;
    category: string;
  }): string {
    return this.wrapEmail({
      title: 'User Reply to Support Request',
      headerTitle: '↩️ User Reply Received',
      headerVariant: 'warning',
      footerNote: 'GoHappyGo Support System - Internal Notification',
      bodyHtml: `
        <p>A user has replied to support request #${supportData.requestId}.</p>
        ${emailPanel(`
          <p><strong>Request ID:</strong> #${supportData.requestId}</p>
          <p><strong>From:</strong> ${supportData.email}</p>
          <p><strong>Category:</strong> ${supportData.category}</p>`)}
        ${emailPanel(`
          <p><strong>User's reply:</strong></p>
          <p>${supportData.message}</p>`)}
        <p>Please log into the admin panel to respond.</p>`,
    });
  }

  getSupportRequestClosedTemplate(supportData: {
    requestId: number;
    email: string;
    category: string;
  }): string {
    return this.wrapEmail({
      title: 'Support Request Closed',
      headerTitle: '✓ Support Request Resolved',
      headerVariant: 'success',
      ctaLabel: 'Submit New Request',
      ctaUrl: `${this.baseUrl}/support/new`,
      footerNote: `GoHappyGo Support - ${supportData.email}`,
      bodyHtml: `
        <p>Hello,</p>
        <p>Your support request has been marked as resolved and closed.</p>
        ${emailPanel(`
          <p><strong>Request ID:</strong> #${supportData.requestId}</p>
          <p><strong>Category:</strong> ${supportData.category}</p>
          <p><strong>Status:</strong> CLOSED</p>`)}
        <p>If you need further assistance, please feel free to submit a new support request.</p>
        <p>Thank you for using GoHappyGo!</p>
        <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>`,
    });
  }

  /**
   * Get email template for alert matched notification
   */
  getAlertMatchedEmailTemplate(data: {
    userName: string;
    alertType: 'Demand' | 'Travel';
    departureAirport: string;
    arrivalAirport: string;
    flightNumber: string;
    travelDate: string;
    demandId?: number;
    travelId?: number;
  }): string {
    return this.wrapEmail({
      title: 'Alert Matched - GoHappyGo',
      headerTitle: '🔔 Alert Matched!',
      headerVariant: 'warning',
      ctaLabel: 'Browse Announcements',
      ctaUrl: `${this.baseUrl}/annonces`,
      footerNote: 'This is an automated notification from GoHappyGo. If you have any questions, please contact our support team.',
      bodyHtml: `
        ${emailHeading(`Hello ${data.userName},`, EMAIL_BRAND.headerText)}
        <p>Great news! A new <strong>${data.alertType}</strong> has been published that matches your alert criteria.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Matched ${data.alertType} Details:</h3>
          <p><strong>Route:</strong> ${data.departureAirport} → ${data.arrivalAirport}</p>
          <p><strong>Flight Number:</strong> ${String(data.flightNumber).toUpperCase()}</p>
          <p><strong>Travel Date:</strong> ${this.formatEmailDateFlexible(data.travelDate)}</p>`)}
        ${emailPanel(`
          <p><strong>✨ This ${data.alertType.toLowerCase()} matches your alert preferences!</strong></p>
          <p>Don't miss out - check it out now and see if it meets your needs.</p>`)}
        <p style="color:${EMAIL_BRAND.muted};font-size:14px;">
          If you're no longer interested in this type of alert, you can manage your alerts in your account settings.
        </p>`,
    });
  }

  /**
   * Get email template for alert creation confirmation
   */
  getAlertCreatedEmailTemplate(data: {
    userName: string;
    alertType: string;
    departureAirport: string;
    arrivalAirport: string;
    flightNumber?: string | null;
    travelDate?: string | null;
    alertId: number;
  }): string {
    const alertDetails = [
      `<p><strong>Route:</strong> ${data.departureAirport} → ${data.arrivalAirport}</p>`,
      `<p><strong>Alert Type:</strong> ${data.alertType}</p>`,
    ];

    if (data.flightNumber) {
      alertDetails.push(`<p><strong>Flight Number:</strong> ${String(data.flightNumber).toUpperCase()}</p>`);
    }

    if (data.travelDate) {
      alertDetails.push(`<p><strong>Travel Date:</strong> ${this.formatEmailDateFlexible(data.travelDate)}</p>`);
    }

    return this.wrapEmail({
      title: 'Alert Created - GoHappyGo',
      headerTitle: '✅ Alert Created Successfully!',
      headerVariant: 'success',
      ctaLabel: 'View My Alerts',
      ctaUrl: `${this.baseUrl}/profile/favorites`,
      footerNote: 'This is an automated confirmation from GoHappyGo. If you have any questions, please contact our support team.',
      bodyHtml: `
        ${emailHeading(`Hello ${data.userName},`, EMAIL_BRAND.headerText)}
        <p>Your alert has been created successfully. We'll notify you when a matching ${data.alertType.toLowerCase()} is published.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Alert Details:</h3>
          ${alertDetails.join('')}
          <p><strong>Alert ID:</strong> #${data.alertId}</p>`)}
        ${emailPanel(`
          <p><strong>📧 What happens next?</strong></p>
          <p>You'll receive an email notification whenever a ${data.alertType.toLowerCase()} matching your criteria is published on GoHappyGo.</p>`)}
        <p style="color:${EMAIL_BRAND.muted};font-size:14px;">
          You can manage or delete your alerts anytime from your account settings.
        </p>`,
    });
  }

  getRequestRejectedTemplate(userFirstName: string, event: RequestEvent): string {
    return this.wrapEmail({
      title: 'Request Rejected - GoHappyGo',
      headerTitle: 'Request Rejected',
      headerVariant: 'danger',
      ctaLabel: 'Browse Available Travels',
      ctaUrl: `${this.baseUrl}/annonces`,
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`)}
        <p>We regret to inform you that your request has been rejected by the travel/demand owner.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Weight:</strong> ${event.weight ? event.weight + 'kg' : 'N/A'}</p>
          <p><strong>Rejected:</strong> ${this.formatEmailDateTime(event.timestamp)}</p>
          <p><strong>Status:</strong> ${emailBadge('REJECTED', EMAIL_BRAND.blue)}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">ℹ️ Important Information</h3>
          <p>The travel/demand owner has decided not to accept your request at this time. This could be due to various reasons such as capacity constraints, scheduling conflicts, or other considerations.</p>
          <p><strong>Note:</strong> No payment was processed for this request, so no refund is necessary.</p>`)}
        <p><strong>What can you do?</strong></p>
        <ul>
          <li>Browse other available travels or demands</li>
          <li>Create a new request for a different travel</li>
          <li>Contact support if you have any questions</li>
        </ul>
        <p><em>We apologize for any inconvenience. If you have any questions, please don't hesitate to contact our support team.</em></p>`,
    });
  }

  getRequestRejectedForOwnerTemplate(userFirstName: string, event: RequestEvent): string {
    return this.wrapEmail({
      title: 'Request Rejected - GoHappyGo',
      headerTitle: 'Request Rejected',
      headerVariant: 'danger',
      ctaLabel: 'View My Travels',
      ctaUrl: `${this.baseUrl}/profile/travels`,
      footerNote: 'Thank you for using GoHappyGo! If you have any questions, please contact our support team.',
      bodyHtml: `
        ${emailHeading(`Hello ${userFirstName},`)}
        <p>This is a confirmation that you have rejected a request on your travel/demand.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${event.requestId}</p>
          <p><strong>Requester:</strong> ${event.requesterName || 'Unknown'}</p>
          <p><strong>Weight:</strong> ${event.weight ? event.weight + 'kg' : 'N/A'}</p>
          <p><strong>Rejected:</strong> ${this.formatEmailDateTime(event.timestamp)}</p>
          <p><strong>Status:</strong> ${emailBadge('REJECTED', EMAIL_BRAND.blue)}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">ℹ️ Important Information</h3>
          <p>You have successfully rejected this request. The weight capacity that was reserved for this request is now available again on your travel/demand.</p>
          <p>You can continue to receive other requests for your travel/demand.</p>`)}
        <p><strong>What can you do?</strong></p>
        <ul>
          <li>Check your travel/demand status and available weight</li>
          <li>Wait for new requests from other users</li>
          <li>Contact support if you have any questions</li>
        </ul>`,
    });
  }

  getContactAnnouncerTemplate(params: {
    recipientName: string;
    senderName: string;
    announcementType: 'travel' | 'demand';
    message: string;
    departureAirportName: string;
    arrivalAirportName: string;
    travelDate: Date | string | null | undefined;
  }): string {
    const {
      recipientName,
      senderName,
      announcementType,
      message,
      departureAirportName,
      arrivalAirportName,
      travelDate,
    } = params;

    const announcementLabel = announcementType === 'travel' ? 'Travel' : 'Demand';
    const formattedTravelDate = this.formatEmailDate(travelDate) || 'N/A';
    const safeMessage = this.escapeHtml(message).replace(/\n/g, '<br>');

    return this.wrapEmail({
      title: `You received an inquiry from ${this.escapeHtml(senderName)} - GoHappyGo`,
      headerTitle: `You received an inquiry from ${this.escapeHtml(senderName)}`,
      headerVariant: 'info',
      bodyHtml: `
        <p>Hello ${this.escapeHtml(recipientName)},</p>
        <p>A GoHappyGo member sent you a message about your ${announcementLabel.toLowerCase()} listing.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Message</h3>
          <p style="margin:0;">${safeMessage}</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">${announcementType === 'travel' ? 'Travel' : 'Demand'} details</h3>
          <p><strong>Departure airport:</strong> ${this.escapeHtml(departureAirportName)}</p>
          <p><strong>Arrival airport:</strong> ${this.escapeHtml(arrivalAirportName)}</p>
          <p><strong>Travel date:</strong> ${this.escapeHtml(formattedTravelDate)}</p>`)}
        <p>You can reply to this member from your GoHappyGo account.</p>`,
    });
  }

  getPublicMessageTemplate(
    recipientName: string,
    announcementType: string,
    departureAirport: string,
    arrivalAirport: string,
    flightNumber: string,
    pricePerKilo: string,
    message: string,
  ): string {
    return this.wrapEmail({
      title: `New Message About Your ${announcementType === 'travel' ? 'Travel' : 'Demand'} - GoHappyGo`,
      headerTitle: `📬 New Message About Your ${announcementType === 'travel' ? 'Travel' : 'Demand'}`,
      headerVariant: 'info',
      ctaLabel: 'View on GoHappyGo',
      ctaUrl: `${this.baseUrl}/profile/messages`,
      bodyHtml: `
        ${emailHeading(`Hello ${recipientName},`)}
        <p>You have received a new message regarding your ${announcementType} posting on GoHappyGo.</p>
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">${announcementType === 'travel' ? '✈️ Travel Details' : '📦 Demand Details'}</h3>
          <p><strong>Departure:</strong> ${departureAirport}</p>
          <p><strong>Arrival:</strong> ${arrivalAirport}</p>
          ${flightNumber ? `<p><strong>Flight Number:</strong> ${String(flightNumber).toUpperCase()}</p>` : ''}
          ${pricePerKilo ? `<p><strong>Price per Kilo:</strong> ${pricePerKilo}</p>` : ''}`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">💬 Message:</h3>
          <p>${message.replace(/\n/g, '<br>')}</p>`)}
        <p><strong>What's next?</strong></p>
        <ul>
          <li>Review the message and details above</li>
          <li>Reply to the sender by visiting your GoHappyGo dashboard</li>
          <li>Decide if you'd like to proceed with this opportunity</li>
        </ul>`,
    });
  }

  getPasswordResetTemplate(userName: string, resetCode: string): string {
    const resetUrl = `${this.baseUrl}/reset-password?code=${resetCode}`;

    return this.wrapEmail({
      title: 'Password Reset - GoHappyGo',
      headerTitle: '🔐 Password Reset Request',
      headerSubtitle: 'Reset your GoHappyGo account password',
      headerVariant: 'danger',
      ctaLabel: 'Reset Password',
      ctaUrl: resetUrl,
      bodyHtml: `
        ${emailHeading(`Hello ${userName}! 👋`, EMAIL_BRAND.headerText)}
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        ${emailPanel(`
          <p style="text-align:center;margin-bottom:16px;color:${EMAIL_BRAND.muted};">Or copy and paste this link into your browser:</p>
          <p style="word-break:break-all;text-align:center;color:${EMAIL_BRAND.muted};">${resetUrl}</p>`)}
        ${emailPanel(`
          <h4 style="margin:0 0 8px;">📋 How to reset your password:</h4>
          <ul style="margin:0;padding-left:20px;">
            <li>Click the "Reset Password" button above</li>
            <li>You'll be redirected to the password reset page</li>
            <li>Enter your new password</li>
            <li>Click "Reset Password" to complete the process</li>
          </ul>`)}
        ${emailPanel(`<strong>⏰ Important:</strong> This password reset link will expire in 10 minutes for security reasons.`)}
        ${emailPanel(`<strong>🔒 Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged. Never share this link with anyone.`)}
        <p style="text-align:center;color:${EMAIL_BRAND.muted};font-size:14px;">
          If you have any questions or need assistance, please contact our support team.
        </p>`,
    });
  }

  /**
   * Template for notifying seller when funds are released via cron job
   */
  getFundReleasedTemplate(userName: string, data: {
    transactionId: number;
    amount: number;
    currency: string;
    transferId: string;
    requestId: number;
  }): string {
    return this.wrapEmail({
      title: 'Funds Released - GoHappyGo',
      headerTitle: '💰 Funds Released!',
      headerVariant: 'success',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        <p>Great news! Your funds have been successfully released and transferred to your Stripe account.</p>
        ${emailPanel(`<p style="margin:0;"><strong>✅ Payment Status:</strong> Funds Released</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Transaction Details:</h3>
          <p><strong>Transaction ID:</strong> #${data.transactionId}</p>
          <p><strong>Request ID:</strong> #${data.requestId}</p>
          <p><strong>Amount:</strong> ${data.amount} ${data.currency.toUpperCase()}</p>
          <p><strong>Transfer ID:</strong> ${data.transferId}</p>
          <p><strong>Released:</strong> ${this.formatEmailDateTime(new Date())}</p>`)}
        <p><strong>What's next?</strong></p>
        <ul>
          <li>Funds are now available in your Stripe Connect account</li>
          <li>You can withdraw funds according to your Stripe payout schedule</li>
          <li>Check your Stripe dashboard for payout details</li>
        </ul>
        <p><em>Thank you for being a trusted GoHappyGo traveler!</em></p>`,
    });
  }

  /**
   * Template for seller to confirm cancellation request
   */
  getCancellationConfirmationRequestTemplate(userName: string, requestData: any, isReminder: boolean = false): string {
    const requestId = requestData.id || requestData.requestId || 'N/A';
    const requestType = requestData.requestType || 'N/A';
    const weight = requestData.weight != null ? `${requestData.weight}kg` : 'N/A';
    const requesterName = this.resolveUserDisplayName(requestData.requester, requestData.requesterName, 'the requester');
    const baseUrl = this.baseUrl;

    return this.wrapEmail({
      title: `${isReminder ? 'Reminder: ' : ''}Cancellation Confirmation Required - GoHappyGo`,
      headerTitle: `${isReminder ? '⏰ Reminder: ' : ''}Cancellation Confirmation Required`,
      headerVariant: 'warning',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        ${isReminder ? '<p><strong>This is a reminder.</strong> Please respond to the cancellation request below.</p>' : ''}
        <p>${requesterName} has requested to cancel their request. Since the travel date has passed, we need your confirmation to proceed.</p>
        ${emailPanel(`<p><strong>⚠️ Action Required:</strong> Please confirm whether the service was fulfilled or not.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${requestId}</p>
          <p><strong>Weight:</strong> ${weight}</p>`)}
        <p><strong>What happens next?</strong></p>
        <ul>
          <li><strong>If service was NOT fulfilled:</strong> Confirm cancellation to refund the buyer (platform fee will be deducted)</li>
          <li><strong>If service WAS fulfilled:</strong> Dispute the cancellation - our admin team will review</li>
        </ul>
        ${emailButton(`${baseUrl}/requests/${requestId}/confirm-cancellation`, 'Confirm Cancellation', EMAIL_BRAND.blue)}
        ${emailButton(`${baseUrl}/requests/${requestId}/dispute-cancellation`, 'Dispute (Service Fulfilled)', EMAIL_BRAND.blue)}
        <p><em>You have ${process.env.CANCELLATION_CONFIRMATION_DAYS || 7} days to respond. If no response is received, our admin team will be notified.</em></p>`,
    });
  }

  /**
   * Template when seller confirms cancellation
   */
  getCancellationConfirmedTemplate(userName: string, requestData: any): string {
    const requestId = requestData.id || requestData.requestId || 'N/A';
    const baseUrl = this.baseUrl;

    return this.wrapEmail({
      title: 'Cancellation Confirmed - GoHappyGo',
      headerTitle: '✅ Cancellation Confirmed',
      headerVariant: 'success',
      ctaLabel: 'View Requests',
      ctaUrl: `${baseUrl}/profile/travel-requests`,
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        <p>The seller has confirmed the cancellation of your request.</p>
        ${emailPanel(`<p><strong>Refund Processing:</strong> Your payment (minus platform fee) will be refunded to your original payment method within 5-10 business days.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${requestId}</p>`)}
        <p>You can create a new request when you're ready to try again.</p>`,
    });
  }

  /**
   * Template when seller disputes cancellation
   */
  getCancellationDisputedTemplate(userName: string, requestData: any): string {
    const requestId = requestData.id || requestData.requestId || 'N/A';
    const baseUrl = this.baseUrl;

    return this.wrapEmail({
      title: 'Cancellation Disputed - GoHappyGo',
      headerTitle: '⚠️ Cancellation Disputed',
      headerVariant: 'warning',
      ctaLabel: 'Contact Support',
      ctaUrl: `${baseUrl}/support`,
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        <p>The seller has disputed your cancellation request, claiming that the service was fulfilled.</p>
        ${emailPanel(`<p><strong>Admin Review:</strong> Our admin team will review this dispute and contact you within 2-3 business days.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${requestId}</p>`)}
        <p>If you have any evidence or additional information, please contact our support team.</p>`,
    });
  }

  /**
   * Daily admin digest: all requests still in PENDING_CANCELLATION_CONFIRMATION (sent only when non-empty).
   */
  getAdminCancellationPendingTemplate(adminName: string, requests: any[]): string {
    const baseUrl = this.baseUrl;
    const dayMs = 1000 * 60 * 60 * 24;
    const now = Date.now();
    const requestsList = requests.map(req => {
      const requestId = req.id || req.requestId || 'N/A';
      const requesterName = this.resolveUserDisplayName(req.requester, req.requesterName, 'Unknown');
      const requestedDate = req.cancellationRequestedAt
        ? (this.formatEmailDate(req.cancellationRequestedAt) || 'N/A')
        : 'N/A';
      let daysPendingLabel = 'N/A';
      if (req.cancellationRequestedAt) {
        const daysPending = Math.floor(
          (now - new Date(req.cancellationRequestedAt).getTime()) / dayMs,
        );
        daysPendingLabel = String(Math.max(0, daysPending));
      }
      return `<li>Request #${requestId} — Requester: ${requesterName} — Requested: ${requestedDate} — Days pending: ${daysPendingLabel}</li>`;
    }).join('');

    return this.wrapEmail({
      title: 'Daily summary: Pending cancellation confirmations - GoHappyGo',
      headerTitle: 'Pending cancellation confirmations (daily summary)',
      headerVariant: 'danger',
      ctaLabel: 'Review Requests',
      ctaUrl: `${baseUrl}/admin/requests/pending-cancellations`,
      bodyHtml: `
        ${emailHeading(`Hello ${adminName},`)}
        <p>There are <strong>${requests.length}</strong> request(s) waiting for the seller to confirm or dispute a post-travel cancellation. Unresponsive sellers are auto-cancelled in favour of the buyer after <strong>${process.env.CANCELLATION_CONFIRMATION_DAYS || 7}</strong> days.</p>
        ${emailPanel(`<p><strong>Note:</strong> Review as needed; this email is sent once per day only when at least one request is still in this state.</p>`)}
        <h3>Pending requests:</h3>
        <ul>${requestsList}</ul>`,
    });
  }

  /**
   * Template for admin notification when seller disputes cancellation
   */
  getAdminCancellationDisputedTemplate(adminName: string, requestData: any): string {
    const requestId = requestData.id || requestData.requestId || 'N/A';
    const requesterName = this.resolveUserDisplayName(requestData.requester, requestData.requesterName, 'Unknown');
    const sellerName = requestData.ownerName
      || this.resolveUserDisplayName(requestData.travel?.user, null, '')
      || this.resolveUserDisplayName(requestData.demand?.user, null, '')
      || 'Unknown';
    const baseUrl = this.baseUrl;

    return this.wrapEmail({
      title: 'Admin Alert: Cancellation Disputed - GoHappyGo',
      headerTitle: '⚠️ Cancellation Disputed - Admin Review Required',
      headerVariant: 'warning',
      ctaLabel: 'Review Request',
      ctaUrl: `${baseUrl}/admin/requests/${requestId}`,
      bodyHtml: `
        ${emailHeading(`Hello ${adminName},`, EMAIL_BRAND.headerText)}
        <p>A seller has disputed a cancellation request, claiming the service was fulfilled.</p>
        ${emailPanel(`<p><strong>Review Required:</strong> Please investigate this dispute and make a decision.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${requestId}</p>
          <p><strong>Requester:</strong> ${requesterName}</p>
          <p><strong>Seller:</strong> ${sellerName}</p>`)}`,
    });
  }

  /**
   * Template when request is auto-completed
   */
  getAutoCompletionNotificationTemplate(userName: string, requestData: any, isForOwner: boolean): string {
    const requestId = requestData.id || requestData.requestId || 'N/A';
    const requestType = requestData.requestType || 'N/A';
    const weight = requestData.weight != null ? `${requestData.weight}kg` : 'N/A';
    const autoCompleteDays = process.env.AUTO_COMPLETE_DAYS_AFTER_TRAVEL_DATE || 7;

    if (isForOwner) {
      return this.wrapEmail({
        title: 'Request Auto-Completed - GoHappyGo',
        headerTitle: '✅ Request Auto-Completed',
        headerVariant: 'success',
        bodyHtml: `
          ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
          <p>The request has been automatically completed by the system.</p>
          ${emailPanel(`<p><strong>Funds Released:</strong> Payment has been released to your Stripe Connect account.</p>`)}
          ${emailPanel(`
            <h3 style="margin:0 0 8px;">Request Details:</h3>
            <p><strong>Request ID:</strong> #${requestId}</p>
            <p><strong>Weight:</strong> ${weight}</p>`)}
          <p><em>The request was auto-completed because the buyer did not complete it within ${autoCompleteDays} days after the travel date.</em></p>`,
      });
    }

    return this.wrapEmail({
      title: 'Request Auto-Completed - GoHappyGo',
      headerTitle: '✅ Request Auto-Completed',
      headerVariant: 'success',
      bodyHtml: `
        ${emailHeading(`Hello ${userName},`, EMAIL_BRAND.headerText)}
        <p>Your request has been automatically completed by the system.</p>
        ${emailPanel(`<p><strong>Note:</strong> Since you did not complete the request within ${autoCompleteDays} days after the travel date, the system has automatically marked it as completed.</p>`)}
        ${emailPanel(`
          <h3 style="margin:0 0 8px;">Request Details:</h3>
          <p><strong>Request ID:</strong> #${requestId}</p>
          <p><strong>Weight:</strong> ${weight}</p>`)}
        <p>Payment has been released to the seller. If you have any concerns, please contact support.</p>`,
    });
  }

  getAccountDeletionConfirmationTemplate(user: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    fullName?: string | null;
  }): string {
    const userName = this.resolveUserDisplayName(user, null, 'there');

    return this.wrapEmail({
      title: 'Account Deleted - GoHappyGo',
      headerTitle: 'Account deleted',
      headerVariant: 'info',
      bodyHtml: `
        ${emailHeading(`Hello ${this.escapeHtml(userName)},`, EMAIL_BRAND.headerText)}
        <p>Your GoHappyGo account has been deleted and your personal data has been anonymized.</p>
        ${emailPanel(`
          <p><strong>What was removed:</strong> profile details, contact information, verification documents, device tokens, alerts, and bookmarks.</p>
          <p><strong>What we kept:</strong> transaction records, completed marketplace activity, and published listings (shown as belonging to a deleted user) as required for legal, accounting, and dispute resolution purposes.</p>
        `)}
        <p>If you did not request this deletion, please contact our support team immediately.</p>
        <p>Thank you for being part of GoHappyGo.</p>`,
    });
  }
}
