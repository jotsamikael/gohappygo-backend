/** Paired title/body copy for FCM push — keep buyer (requester) vs seller (owner) perspectives aligned. */
export interface NotificationPushCopy {
  title: string;
  body: string;
}

export const NotificationPushMessages = {
  requestSubmittedForSeller: {
    title: 'New Request Received',
    body: 'A buyer submitted a new request on your listing.',
  },
  requestAcceptedForSeller: {
    title: 'You Accepted a Request',
    body: 'You confirmed the booking.',
  },
  requestAcceptedForBuyer: {
    title: 'Request Accepted',
    body: 'Your request was accepted by the seller.',
  },
  requestCancelledForBuyer: {
    title: 'Request Cancelled',
    body: 'Your request was cancelled.',
  },
  requestCancelledDueToTravelListingForBuyer: {
    title: 'Travel Cancelled',
    body: 'The traveler cancelled their trip. Your request was cancelled and a full refund is being processed.',
  },
  requestCancelledForSeller: {
    title: 'Request Cancelled',
    body: 'The buyer cancelled their request.',
  },
  requestCancelledPaymentFailureForBuyer: {
    title: 'Request Cancelled',
    body: 'Your request was cancelled because payment could not be processed.',
  },
  requestCancelledPaymentFailureForSeller: {
    title: 'Request Cancelled',
    body: 'A request on your listing was cancelled due to a payment issue.',
  },
  requestRejectedForBuyer: {
    title: 'Request Rejected',
    body: 'Your request was rejected by the seller.',
  },
  requestRejectedForSeller: {
    title: 'You Rejected a Request',
    body: 'You declined the buyer\'s request.',
  },
  requestCompletedForSeller: {
    title: 'Booking Completed',
    body: 'The booking with the buyer is complete.',
  },
  requestCompletedForBuyer: {
    title: 'Booking Completed',
    body: 'Your booking is complete.',
  },
  reviewReceived: {
    title: 'New Review Received',
    body: 'You received a new review.',
  },
  demandPublished: {
    title: 'Demand Published Successfully',
    body: 'Your demand is now live.',
  },
  travelPublished: {
    title: 'Travel Published Successfully',
    body: 'Your travel is now live.',
  },
  travelCancelled: {
    title: 'Travel Cancelled',
    body: 'Your travel listing has been cancelled.',
  },
  travelCancelledWithRequests: {
    title: 'Travel Cancelled',
    body: 'Your travel was cancelled. Active buyer requests were cancelled and refunds were initiated.',
  },
  demandMatched: {
    title: 'New Demand Matches Your Alert',
    body: 'A new demand matches your alert.',
  },
  travelMatched: {
    title: 'New Travel Matches Your Alert',
    body: 'A new travel matches your alert.',
  },
  accountVerified: {
    title: 'Account Verified',
    body: 'Your account has been verified.',
  },
  verificationDocumentsReceived: {
    title: 'Verification Documents Received',
    body: 'We received your verification documents.',
  },
  paymentReceived: {
    title: 'Payment Received',
    body: 'You received a payment.',
  },
  alertCreated: {
    title: 'Alert Created Successfully',
    body: 'Your alert was created successfully.',
  },
  messageReceived: {
    title: 'New Message',
    body: 'You have a new message about your booking.',
  },
  cancellationConfirmationRequiredForSeller: {
    title: 'Action required: cancellation',
    body: 'A buyer requested to cancel after travel. Confirm or dispute in the app.',
  },
  cancellationPendingForBuyer: {
    title: 'Cancellation submitted',
    body: 'Waiting for the seller to confirm your post-travel cancellation.',
  },
  cancellationConfirmedForBuyer: {
    title: 'Cancellation confirmed',
    body: 'Your cancellation was approved. Refund processing has started.',
  },
  cancellationAutoConfirmedForBuyer: {
    title: 'Cancellation automatically approved',
    body: 'The seller did not respond in time. Your refund is being processed.',
  },
  cancellationAutoConfirmedForSeller: {
    title: 'Request auto-cancelled',
    body: 'A cancellation was auto-approved after no response. The buyer is being refunded.',
  },
  cancellationDisputedForBuyer: {
    title: 'Cancellation disputed',
    body: 'The seller disputed your cancellation. Our team will review.',
  },
} as const satisfies Record<string, NotificationPushCopy>;
