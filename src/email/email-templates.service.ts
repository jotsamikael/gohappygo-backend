import { Injectable } from '@nestjs/common';
import { RequestEvent } from 'src/events/user-events.service';

@Injectable()
export class EmailTemplatesService {
 

  private readonly baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  getWelcomeTemplate(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to GoHappyGo!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Welcome to GoHappyGo! Your account has been successfully created.</p>
            <p>We're excited to have you join our community of travelers and package senders.</p>
            <p>To get started:</p>
            <ul>
              <li>Complete your profile</li>
              <li>Verify your phone number</li>
              <li>Upload verification documents</li>
              <li>Start posting travels or demands</li>
            </ul>
            <p style="text-align: center;">
              <a href="${this.baseUrl}/dashboard" class="button">Go to Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPhoneVerificationTemplate(userName: string, verificationCode: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Phone Verification - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .verification-code { font-size: 24px; font-weight: bold; text-align: center; padding: 20px; background: #e3f2fd; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Phone Verification</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Please use the following verification code to verify your phone number:</p>
            <div class="verification-code">${verificationCode}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVerificationDocumentsReceivedTemplate(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Documents Received - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Documents Received</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We have received your verification documents and they are now under review.</p>
            <p>Our team will review your documents within 24-48 hours and you will receive an email notification once the review is complete.</p>
            <p>Thank you for your patience!</p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVerificationApprovedTemplate(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Verified - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Verified!</h1>
          </div>
          <div class="content">
            <h2>Congratulations ${userName}!</h2>
            <p>Your account has been successfully verified. You can now:</p>
            <ul>
              <li>Post travel declarations</li>
              <li>Publish delivery demands</li>
              <li>Make requests to other users</li>
              <li>Complete transactions</li>
            </ul>
            <p style="text-align: center;">
              <a href="${this.baseUrl}/dashboard" class="button">Start Using GoHappyGo</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVerificationRejectedTemplate(userName: string, reason: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verification Update - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .reason { background: #ffebee; padding: 15px; border-left: 4px solid #f44336; margin: 20px 0; }
          .button { display: inline-block; padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verification Update</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We regret to inform you that your verification documents could not be approved at this time.</p>
            <div class="reason">
              <strong>Reason:</strong> ${reason}
            </div>
            <p>Please review the reason above and submit new documents that meet our requirements.</p>
            <p style="text-align: center;">
              <a href="${this.baseUrl}/verification" class="button">Resubmit Documents</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getTravelPublishedTemplate(userName: string, travelData: any): string {
    // Safely extract airport names
    // The event passes strings directly, but also handle if objects are passed
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
    
    // Safely format the date
    // The event uses travelDate, but also check for departureDatetime
    const departureDate = (travelData.travelDate || travelData.departureDatetime) ? 
      new Date(travelData.travelDate || travelData.departureDatetime).toLocaleDateString() : 
      'Unknown';
    
    // Safely get weight available and price
    const weightAvailable = travelData.weightAvailable || 0;
    const pricePerKg = travelData.pricePerKg || 0;
    // Get currency symbol from travelData, default to $ if not available
    const currencySymbol = travelData.currencySymbol || travelData.currency?.symbol || '$';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Travel Published - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .travel-details { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Travel Published Successfully!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Your travel has been successfully published and is now visible to potential package senders.</p>
            <div class="travel-details">
              <h3>Travel Details:</h3>
              <p><strong>Flight:</strong> ${travelData.flightNumber || 'Unknown'}</p>
              <p><strong>From:</strong> ${departureAirport}</p>
              <p><strong>To:</strong> ${arrivalAirport}</p>
              <p><strong>Date:</strong> ${departureDate}</p>
              <p><strong>Available Weight:</strong> ${weightAvailable}kg</p>
              <p><strong>Price per kg:</strong> ${currencySymbol}${pricePerKg}</p>
            </div>
            <p>You will be notified when someone makes a request for your travel.</p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getDemandPublishedTemplate(userName: string, demandData: any): string {
    // Safely extract airport names
    // The event passes departureAirport and arrivalAirport as strings (airport names)
    // But we also support the case where they might be objects with .name property
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
    
    // Safely format the date
    const deliveryDate = demandData.deliveryDate || demandData.travelDate;
    const formattedDate = deliveryDate ? 
      new Date(deliveryDate).toLocaleDateString() : 
      'Unknown';
    
    // Safely get weight and price
    const weight = demandData.weight || 0;
    const pricePerKg = demandData.pricePerKg || 0;
    // Get currency symbol from demandData, default to $ if not available
    const currencySymbol = demandData.currencySymbol || demandData.currency?.symbol || '$';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Demand Published - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .demand-details { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Demand Published Successfully!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Your delivery demand has been successfully published and is now visible to potential travelers.</p>
            <div class="demand-details">
              <h3>Demand Details:</h3>
              <p><strong>Description:</strong> ${demandData.title || demandData.description || 'Unknown'}</p>
              <p><strong>From:</strong> ${originAirport}</p>
              <p><strong>To:</strong> ${destinationAirport}</p>
              <p><strong>Travel Date:</strong> ${formattedDate}</p>
              <p><strong>Weight:</strong> ${weight}kg</p>
              <p><strong>Price per kg:</strong> ${currencySymbol}${pricePerKg}</p>
            </div>
            <p>You will be notified when someone offers to help with your delivery.</p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestAcceptedTemplate(userName: string, requestData: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Request Accepted - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .request-details { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .success-badge { background: #4CAF50; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
          .action-button { background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .highlight { background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Request Accepted!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            ${requestData.isInstant ? `<p><strong>⚡ Instant Travel Purchase Confirmed!</strong></p><p>Your request for ${requestData.weight}kg has been automatically accepted and purchased in an instant travel. The delivery process can now begin.</p>` : `<p>Great news! Your delivery request has been accepted and is ready to proceed.</p>`}
            
            <div class="highlight">
              <p><strong>✅ Status:</strong> <span class="success-badge">ACCEPTED</span></p>
              <p>Your request is now confirmed and the delivery process can begin.</p>
            </div>
            
            <div class="request-details">
              <h3>Request Details:</h3>
              <p><strong>Request ID:</strong> #${requestData.requestId}</p>
              <p><strong>Type:</strong> ${requestData.requestType}</p>
              <p><strong>Package Description:</strong> ${requestData.packageDescription || 'Not specified'}</p>
              <p><strong>Weight:</strong> ${requestData.weight}kg</p>
              ${requestData.limitDate ? `<p><strong>Delivery Deadline:</strong> ${new Date(requestData.limitDate).toLocaleDateString()}</p>` : ''}
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ul>
              <li>You can now communicate with the traveler through the platform</li>
              <li>Arrange the package handover details</li>
              <li>Track the delivery progress in your dashboard</li>
              <li>Complete payment once delivery is confirmed</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="#" class="action-button">View Request Details</a>
            </p>
            
            <p><em>Please keep in touch with the traveler to ensure smooth delivery coordination.</em></p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestAcceptedForOwnerTemplate(userName: string, requestData: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Request Confirmation - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .request-details { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .requester-info { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .success-badge { background: #4CAF50; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
          .action-button { background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .highlight { background: #d4edda; padding: 10px; border-radius: 5px; border-left: 4px solid #28a745; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Request Confirmed</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            ${requestData.isInstant ? `<p><strong>⚡ Instant Travel Purchase!</strong></p><p>${requestData.requesterName || 'A requester'} has purchased ${requestData.weight}kg in your instant travel. The request has been automatically accepted.</p>` : `<p>You have successfully accepted a delivery request. The requester has been notified.</p>`}
            
            <div class="highlight">
              <p><strong>✅ Status:</strong> <span class="success-badge">ACCEPTED</span></p>
              <p>This request is now active and ready for coordination.</p>
            </div>
            
            <div class="requester-info">
              <h3>Requester Information:</h3>
              <p><strong>Name:</strong> ${requestData.requesterName || requestData.userFirstName || 'Unknown'}</p>
              <p><strong>Email:</strong> ${requestData.userEmail || 'Not provided'}</p>
            </div>
            
            <div class="request-details">
              <h3>Request Details:</h3>
              <p><strong>Request ID:</strong> #${requestData.requestId}</p>
              <p><strong>Type:</strong> ${requestData.requestType}</p>
              <p><strong>Package Description:</strong> ${requestData.packageDescription || 'Not specified'}</p>
              <p><strong>Weight:</strong> ${requestData.weight}kg</p>
              ${requestData.limitDate ? `<p><strong>Delivery Deadline:</strong> ${new Date(requestData.limitDate).toLocaleDateString()}</p>` : ''}
              <p><strong>Accepted:</strong> ${new Date(requestData.timestamp).toLocaleString()}</p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Contact the requester to arrange package pickup</li>
              <li>Confirm delivery details and timeline</li>
              <li>Coordinate the handover process</li>
              <li>Update delivery status as you progress</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="#" class="action-button">Manage Request</a>
            </p>
            
            <p><em>Remember to maintain good communication with the requester throughout the delivery process.</em></p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getTransactionCompletedTemplate(userName: string, transactionData: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Transaction Completed - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .transaction-details { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Transaction Completed!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Your transaction has been successfully completed.</p>
            <div class="transaction-details">
              <h3>Transaction Details:</h3>
              <p><strong>Amount:</strong> $${transactionData.amount}</p>
              <p><strong>Status:</strong> ${transactionData.status}</p>
              <p><strong>Payment Method:</strong> ${transactionData.paymentMethod}</p>
            </div>
            <p>Thank you for using GoHappyGo!</p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getEmailVerificationTemplate(userName: string, verificationCode: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to GoHappyGo - Email Verification</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #4CAF50, #45a049); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 300;
          }
          .header p { 
            margin: 10px 0 0 0; 
            font-size: 16px; 
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px; 
            background: white;
          }
          .welcome-section {
            text-align: center;
            margin-bottom: 30px;
          }
          .welcome-section h2 {
            color: #4CAF50;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .welcome-section p {
            font-size: 16px;
            color: #666;
            margin-bottom: 20px;
          }
          .verification-section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            border-left: 4px solid #4CAF50;
            margin: 25px 0;
          }
          .verification-code { 
            font-size: 32px; 
            font-weight: bold; 
            text-align: center; 
            padding: 20px; 
            background: #e8f5e8; 
            margin: 20px 0; 
            border-radius: 8px;
            letter-spacing: 3px;
            color: #2e7d32;
            border: 2px dashed #4CAF50;
          }
          .instructions {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
          }
          .instructions h4 {
            margin: 0 0 10px 0;
            color: #856404;
          }
          .instructions ul {
            margin: 0;
            padding-left: 20px;
          }
          .instructions li {
            margin-bottom: 5px;
            color: #856404;
          }
          .cta-button {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            margin: 20px 0;
            transition: background-color 0.3s;
          }
          .cta-button:hover {
            background: #45a049;
          }
          .footer { 
            text-align: center; 
            padding: 30px 20px; 
            background: #f8f9fa;
            color: #666; 
            font-size: 14px;
            border-top: 1px solid #e9ecef;
          }
          .social-links {
            margin: 20px 0;
          }
          .social-links a {
            color: #4CAF50;
            text-decoration: none;
            margin: 0 10px;
          }
          .expiry-notice {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #0c5460;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to GoHappyGo!</h1>
            <p>Your journey to seamless package delivery starts here</p>
          </div>
          
          <div class="content">
            <div class="welcome-section">
              <h2>Hello ${userName}! 👋</h2>
              <p>We're thrilled to have you join the GoHappyGo community! You're just one step away from connecting with travelers and senders worldwide.</p>
            </div>

            <div class="verification-section">
              <h3 style="color: #4CAF50; margin-top: 0;">📧 Verify Your Email Address</h3>
              <p>To complete your registration and start using GoHappyGo, please verify your email address using the code below:</p>
              
            <div class="verification-code">${verificationCode}</div>
              
              <div class="instructions">
                <h4>🔐 How to verify:</h4>
                <ul>
                  <li>Copy the verification code above</li>
                  <li>Return to the GoHappyGo app or website</li>
                  <li>Paste the code in the verification field</li>
                  <li>Click "Verify Email" to complete your registration</li>
                </ul>
              </div>

              <div class="expiry-notice">
                <strong>⏰ Important:</strong> This verification code will expire in 10 minutes for security reasons.
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <h3 style="color: #4CAF50;">What's Next?</h3>
              <p>Once verified, you'll be able to:</p>
              <ul style="text-align: left; display: inline-block; color: #666;">
                <li>📦 Post delivery requests for your packages</li>
                <li>✈️ Offer extra luggage space for travelers</li>
                <li>🤝 Connect with trusted community members</li>
                <li>💰 Earn money by helping others with deliveries</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #666; font-size: 14px;">
                If you didn't create an account with GoHappyGo, please ignore this email. 
                Your account will not be activated without email verification.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <div class="social-links">
              <a href="#"> Download App</a>
              <a href="#">🌐 Visit Website</a>
              <a href="#">📞 Support</a>
            </div>
            <p><strong>GoHappyGo</strong> - Connecting travelers and senders worldwide</p>
            <p>© 2024 GoHappyGo. All rights reserved.</p>
            <p style="font-size: 12px; color: #999;">
              This email was sent to you because you registered for a GoHappyGo account. 
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Add this method to generate verification status email templates
  getVerificationStatusTemplate(
    firstName: string, 
    isApproved: boolean, 
    reason?: string
  ): string {
    const statusText = isApproved ? 'approved' : 'rejected';
    const statusColor = isApproved ? '#28a745' : '#dc3545';
    const statusIcon = isApproved ? '✅' : '❌';

    const rejectionContent = `
      <div class="alert alert-warning">
        <h4>What happens next?</h4>
        <ul>
          <li>Your previous verification documents have been removed</li>
          <li>Please upload new, clear verification documents</li>
          <li>Ensure all documents are valid and clearly visible</li>
          <li>You can resubmit your verification at any time</li>
        </ul>
      </div>
      
      <div class="alert alert-info">
        <h4>How to resubmit:</h4>
        <ol>
          <li>Log into your GoHappyGo account</li>
          <li>Go to your profile settings</li>
          <li>Upload new verification documents (Selfie, ID Front, ID Back)</li>
          <li>Submit for review</li>
        </ol>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Verification ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .status-box { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor}; }
          .footer { text-align: center; margin-top: 30px; color: #6c757d; font-size: 14px; }
          .alert { padding: 15px; margin: 15px 0; border-radius: 4px; }
          .alert-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
          .alert-info { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusIcon} Account Verification ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</h1>
          </div>
          
          <div class="content">
            <p>Dear ${firstName},</p>
            
            <div class="status-box">
              <h3>Your account verification has been <strong>${statusText}</strong></h3>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            </div>
            
            ${isApproved ? `
              <p>🎉 Congratulations! Your account has been successfully verified. You can now access all features of GoHappyGo.</p>
              <p>If you have any questions, please don't hesitate to contact our support team.</p>
            ` : rejectionContent}
            
            <p>Thank you for choosing GoHappyGo!</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from GoHappyGo. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestCreatedTemplate(userFirstName: string, event: RequestEvent): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Request Created - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .request-details { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Request Submitted Successfully!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userFirstName},</h2>
            <p>Your delivery request has been successfully submitted and is now being reviewed.</p>
            
            <div class="request-details">
              <h3>Request Details:</h3>
              <p><strong>Request ID:</strong> #${event.requestId}</p>
              <p><strong>Type:</strong> ${event.requestType}</p>
                      <p><strong>Weight:</strong> ${event.weight}kg</p>

            </div>
            
            <p><strong>What happens next?</strong></p>
            <ul>
              <li>The travel/demand owner will review your request</li>
              <li>You'll receive a notification when they respond</li>
              <li>You can track your request status in your dashboard</li>
            </ul>
            
            <p>We'll keep you updated on any changes to your request status.</p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestCreatedForOwnerTemplate(userFirstName: string, event: RequestEvent): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Request Received - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .request-details { background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .requester-info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .action-button { background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Request Received!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userFirstName},</h2>
            <p>You have received a new delivery request for your travel/demand.</p>
            
            <div class="requester-info">
              <h3>Requester Information:</h3>
              <p><strong>Name:</strong> ${event.userFirstName}</p>
              <p><strong>Email:</strong> ${event.userEmail}</p>
            </div>
            
            <div class="request-details">
              <h3>Request Details:</h3>
              <p><strong>Request ID:</strong> #${event.requestId}</p>
              <p><strong>Type:</strong> ${event.requestType}</p>
              <p><strong>Weight:</strong> ${event.weight}kg</p>

              <p><strong>Submitted:</strong> ${new Date(event.timestamp).toLocaleString()}</p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Review the request details carefully</li>
              <li>Check if you can accommodate the package</li>
              <li>Respond to the requester through your dashboard</li>
              <li>Accept or decline the request</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="#" class="action-button">View Request in Dashboard</a>
            </p>
            
            <p><em>Please respond to this request as soon as possible to maintain good service quality.</em></p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestCompletedTemplate(userFirstName: string, event: RequestEvent): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Delivery Completed - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .request-details { background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .completed-badge { background: #28a745; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
          .action-button { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .highlight { background: #d1ecf1; padding: 10px; border-radius: 5px; border-left: 4px solid #17a2b8; }
          .rating-section { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> Delivery Completed!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userFirstName},</h2>
            <p>Excellent news! Your delivery request has been successfully completed.</p>
            
            <div class="highlight">
              <p><strong>✅ Status:</strong> <span class="completed-badge">COMPLETED</span></p>
              <p>Your package has been delivered as requested.</p>
            </div>
            
            <div class="request-details">
              <h3>Delivery Details:</h3>
              <p><strong>Request ID:</strong> #${event.requestId}</p>
              <p><strong>Type:</strong> ${event.requestType}</p>
              <p><strong>Weight:</strong> ${event.weight}kg</p>

              <p><strong>Completed:</strong> ${new Date(event.timestamp).toLocaleString()}</p>
            </div>
            
            <div class="rating-section">
              <h3>⭐ Rate Your Experience</h3>
              <p>Help us improve our service by rating your delivery experience.</p>
              <p style="text-align: center;">
                <a href="#" class="action-button">Rate Delivery</a>
              </p>
            </div>
            
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Review and rate the delivery service</li>
              <li>Complete any final payments if needed</li>
              <li>Share your experience with other users</li>
              <li>Book your next delivery with GoHappyGo</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="#" class="action-button">View Delivery Summary</a>
            </p>
            
            <p><em>Thank you for using GoHappyGo! We hope you had a great experience.</em></p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestCancelledTemplate(userFirstName: string, event: RequestEvent): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Request Cancelled - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .request-details { background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .cancelled-badge { background: #dc3545; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
          .refund-info { background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8; }
          .action-button { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Request Cancelled</h1>
          </div>
          <div class="content">
            <h2>Hello ${userFirstName},</h2>
            <p>We regret to inform you that your delivery request has been cancelled.</p>
            
            <div class="request-details">
              <h3>Request Details:</h3>
              <p><strong>Request ID:</strong> #${event.requestId}</p>
              <p><strong>Type:</strong> ${event.requestType}</p>
              <p><strong>Weight:</strong> ${event.weight ? event.weight + 'kg' : 'N/A'}</p>
              <p><strong>Cancelled:</strong> ${new Date(event.timestamp).toLocaleString()}</p>
              <p><strong>Status:</strong> <span class="cancelled-badge">CANCELLED</span></p>
            </div>
            
            <div class="refund-info">
              <h3>💰 Refund Information</h3>
              <p>If you had made a payment for this request, a full refund has been processed and will be credited back to your original payment method within 5-10 business days.</p>
              <p><strong>Note:</strong> You will receive a separate confirmation email once the refund is processed.</p>
            </div>
            
            <p><strong>What can you do?</strong></p>
            <ul>
              <li>Browse other available travels or demands</li>
              <li>Create a new request for a different travel</li>
              <li>Contact support if you have any questions</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="${this.baseUrl}/requests" class="action-button">Browse Available Travels</a>
            </p>
            
            <p><em>We apologize for any inconvenience. If you have any questions, please don't hesitate to contact our support team.</em></p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRequestCompletedForOwnerTemplate(userFirstName: string, event: RequestEvent): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Delivery Successfully Completed - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .request-details { background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .requester-info { background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .completed-badge { background: #28a745; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
          .action-button { background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .highlight { background: #d1ecf1; padding: 10px; border-radius: 5px; border-left: 4px solid #17a2b8; }
          .earnings-section { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Delivery Completed Successfully!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userFirstName},</h2>
            <p>Congratulations! You have successfully completed a delivery request.</p>
            
            <div class="highlight">
              <p><strong>✅ Status:</strong> <span class="completed-badge">COMPLETED</span></p>
              <p>Great job on completing this delivery successfully!</p>
            </div>
            
            <div class="requester-info">
              <h3>Client Information:</h3>
              <p><strong>Name:</strong> ${event.userFirstName}</p>
              <p><strong>Email:</strong> ${event.userEmail}</p>
            </div>
            
            <div class="request-details">
              <h3>Delivery Details:</h3>
              <p><strong>Request ID:</strong> #${event.requestId}</p>
              <p><strong>Type:</strong> ${event.requestType}</p>
              <p><strong>Weight:</strong> ${event.weight}kg</p>
              <p><strong>Completed:</strong> ${new Date(event.timestamp).toLocaleString()}</p>
            </div>
            
            <div class="earnings-section">
              <h3> Earnings Summary</h3>
              <p>Your earnings will be processed according to our payment schedule.</p>
            </div>
            
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Your earnings will be processed and transferred</li>
              <li>You may receive a rating from the client</li>
              <li>Consider taking on more delivery requests</li>
              <li>Build your reputation as a reliable traveler</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="#" class="action-button">View Earnings</a>
            </p>
            
            <p><em>Thank you for being a trusted GoHappyGo traveler! Keep up the excellent work.</em></p>
          </div>
          <div class="footer">
            <p>© 2024 GoHappyGo. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getKycStartedTemplate(userName: string, redirectUrl: string, sessionId: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>KYC Verification Started - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          .button { 
            display: inline-block; 
            background-color: #007bff; 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
            font-weight: bold;
          }
          .info-box { 
            background: #e7f3ff; 
            border-left: 4px solid #007bff; 
            padding: 15px; 
            margin: 20px 0; 
          }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 KYC Verification Started</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>Your KYC (Know Your Customer) verification process has been initiated successfully.</p>
            
            <div class="info-box">
              <h3>What's next?</h3>
              <ul>
                <li>Click the button below to complete your identity verification</li>
                <li>You'll need to provide a valid ID document and take a selfie</li>
                <li>The process usually takes 2-5 minutes to complete</li>
                <li>You'll receive an email notification once verification is complete</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${redirectUrl}" class="button">Complete KYC Verification</a>
            </div>
            
            <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
            
            <p>If you have any questions or need assistance, please contact our support team.</p>
            
            <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getKycCompletedTemplate(
    userName: string, 
    status: 'approved' | 'rejected' | 'failed', 
    sessionId: string,
    reason?: string
  ): string {
    const isApproved = status === 'approved';
    const statusColor = isApproved ? '#28a745' : '#dc3545';
    const statusBg = isApproved ? '#d4edda' : '#f8d7da';
    const statusBorder = isApproved ? '#c3e6cb' : '#f5c6cb';
    const statusIcon = isApproved ? '✅' : '❌';
    const statusText = isApproved ? 'Approved' : 'Not Approved';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>KYC Verification ${statusText} - GoHappyGo</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { 
            background-color: ${statusBg}; 
            color: ${statusColor}; 
            padding: 20px; 
            text-align: center; 
            border-radius: 8px 8px 0 0;
            border: 1px solid ${statusBorder};
          }
          .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          .status-badge {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            color: white;
            background-color: ${statusColor};
            font-size: 16px;
          }
          .info-box { 
            background: ${statusBg}; 
            border-left: 4px solid ${statusColor}; 
            padding: 15px; 
            margin: 20px 0; 
          }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusIcon} KYC Verification ${statusText}</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>${isApproved 
              ? 'Congratulations! Your identity has been successfully verified.' 
              : 'Unfortunately, your identity verification was not approved.'}</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <span class="status-badge">${status.toUpperCase()}</span>
            </div>
            
            <div class="info-box">
              <h3>Next Steps:</h3>
              <p>${isApproved
                ? 'You can now enjoy all features of the GoHappyGo platform, including creating travel announcements and delivery requests.'
                : 'Please contact our support team for assistance or try the verification process again.'}</p>
            </div>
            
            ${!isApproved ? `
              <div class="info-box">
                <h3>Common reasons for rejection:</h3>
                <ul>
                  <li>Document image quality is too low</li>
                  <li>Document is expired or invalid</li>
                  <li>Face doesn't match the document photo</li>
                  <li>Document type is not supported</li>
                </ul>
              </div>
            ` : ''}
            
            <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
            
            <p>If you have any questions or need assistance, please contact our support team.</p>
            
            <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Support request notification to admin/operator
  getSupportRequestReceivedTemplate(supportData: {
    requestId: number;
    email: string;
    message: string;
    category: string;
    requesterType: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Support Request Received</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF5722; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FF5722; }
          .message-box { background: #fff3e0; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🆘 New Support Request</h1>
          </div>
          <div class="content">
            <p>A new support request has been submitted and requires your attention.</p>
            
            <div class="info-box">
              <p><strong>Request ID:</strong> #${supportData.requestId}</p>
              <p><strong>From:</strong> ${supportData.email}</p>
              <p><strong>Requester Type:</strong> ${supportData.requesterType}</p>
              <p><strong>Category:</strong> ${supportData.category}</p>
            </div>
            
            <div class="message-box">
              <p><strong>Message:</strong></p>
              <p>${supportData.message}</p>
            </div>
            
            <p>Please log into the admin panel to respond to this request.</p>
          </div>
          <div class="footer">
            <p>GoHappyGo Support System - Internal Notification</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Support request confirmation to requester
  getSupportRequestConfirmationTemplate(supportData: {
    requestId: number;
    email: string;
    category: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Support Request Received</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Support Request Received</h1>
          </div>
          <div class="content">
            <p>Thank you for contacting GoHappyGo Support!</p>
            
            <p>We have received your support request and our team will review it shortly.</p>
            
            <div class="info-box">
              <p><strong>Request ID:</strong> #${supportData.requestId}</p>
              <p><strong>Email:</strong> ${supportData.email}</p>
              <p><strong>Category:</strong> ${supportData.category}</p>
            </div>
            
            <p>You will receive a response via email as soon as one of our support team members reviews your request.</p>
            
            <p>For urgent matters, please contact us directly.</p>
            
            <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated confirmation. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Operator response notification to requester
  getSupportResponseFromOperatorTemplate(supportData: {
    requestId: number;
    email: string;
    message: string;
    category: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Response to Your Support Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196F3; }
          .message-box { background: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 Response from GoHappyGo Support</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            
            <p>Our support team has responded to your request:</p>
            
            <div class="info-box">
              <p><strong>Request ID:</strong> #${supportData.requestId}</p>
              <p><strong>Category:</strong> ${supportData.category}</p>
            </div>
            
            <div class="message-box">
              <p><strong>Response from our team:</strong></p>
              <p>${supportData.message}</p>
            </div>
            
            <p>If you need further assistance, you can reply to this support request by logging into your account.</p>
            
            <a href="${this.baseUrl}/support/${supportData.requestId}" class="button">View Support Request</a>
            
            <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>
          </div>
          <div class="footer">
            <p>GoHappyGo Support - ${supportData.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // User reply notification to operator
  getSupportReplyFromUserTemplate(supportData: {
    requestId: number;
    email: string;
    message: string;
    category: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>User Reply to Support Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FF9800; }
          .message-box { background: #fff3e0; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>↩️ User Reply Received</h1>
          </div>
          <div class="content">
            <p>A user has replied to support request #${supportData.requestId}.</p>
            
            <div class="info-box">
              <p><strong>Request ID:</strong> #${supportData.requestId}</p>
              <p><strong>From:</strong> ${supportData.email}</p>
              <p><strong>Category:</strong> ${supportData.category}</p>
            </div>
            
            <div class="message-box">
              <p><strong>User's reply:</strong></p>
              <p>${supportData.message}</p>
            </div>
            
            <p>Please log into the admin panel to respond.</p>
          </div>
          <div class="footer">
            <p>GoHappyGo Support System - Internal Notification</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Support request closed notification
  getSupportRequestClosedTemplate(supportData: {
    requestId: number;
    email: string;
    category: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Support Request Closed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Support Request Resolved</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            
            <p>Your support request has been marked as resolved and closed.</p>
            
            <div class="info-box">
              <p><strong>Request ID:</strong> #${supportData.requestId}</p>
              <p><strong>Category:</strong> ${supportData.category}</p>
              <p><strong>Status:</strong> CLOSED</p>
            </div>
            
            <p>If you need further assistance, please feel free to submit a new support request.</p>
            
            <a href="${this.baseUrl}/support/new" class="button">Submit New Request</a>
            
            <p>Thank you for using GoHappyGo!</p>
            
            <p>Best regards,<br><strong>The GoHappyGo Team</strong></p>
          </div>
          <div class="footer">
            <p>GoHappyGo Support - ${supportData.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
} 