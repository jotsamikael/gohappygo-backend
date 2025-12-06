// Define event types for better type safety
export enum UserEventType {
    // Authentication Events
    USER_REGISTERED = 'user.registered',
    USER_LOGGED_IN = 'user.logged_in',
    USER_LOGGED_OUT = 'user.logged_out',
    PASSWORD_CHANGED = 'user.password_changed',
    
    // Verification Events
    PHONE_VERIFICATION_REQUESTED = 'user.phone_verification_requested',
    PHONE_VERIFIED = 'user.phone_verified',
    EMAIL_VERIFIED = 'user.email_verified',
    VERIFICATION_DOCUMENTS_UPLOADED = 'user.verification_documents_uploaded',
    VERIFICATION_APPROVED = 'user.verification_approved',
    VERIFICATION_REJECTED = 'user.verification_rejected',
    
    // KYC Events (New)
    KYC_STARTED = 'kyc.started',
    KYC_COMPLETED = 'kyc.completed',
    
    // Profile Events
    PROFILE_UPDATED = 'user.profile_updated',
    PROFILE_PICTURE_UPLOADED = 'user.profile_picture_uploaded',
    
    // Travel & Demand Events
    TRAVEL_PUBLISHED = 'travel.published',
    TRAVEL_UPDATED = 'travel.updated',
    TRAVEL_CANCELLED = 'travel.cancelled',
    DEMAND_PUBLISHED = 'demand.published',
    DEMAND_UPDATED = 'demand.updated',
    DEMAND_CANCELLED = 'demand.cancelled',
    
    // Request Events
    REQUEST_CREATED = 'request.created',
    REQUEST_ACCEPTED = 'request.accepted',
    REQUEST_COMPLETED = 'request.completed',
    REQUEST_CANCELLED = 'request.cancelled',
    
    // Transaction Events
    TRANSACTION_CREATED = 'transaction.created',
    TRANSACTION_COMPLETED = 'transaction.completed',
    TRANSACTION_FAILED = 'transaction.failed',
    
    // Communication Events
    MESSAGE_SENT = 'message.sent',
    MESSAGE_READ = 'message.read',
    
    // Review Events
    REVIEW_POSTED = 'review.posted',
    REVIEW_UPDATED = 'review.updated',
    
    // Security Events
    SUSPICIOUS_ACTIVITY = 'user.suspicious_activity',
    ACCOUNT_LOCKED = 'user.account_locked',
    ACCOUNT_UNLOCKED = 'user.account_unlocked',
  }