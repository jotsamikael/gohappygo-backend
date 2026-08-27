export enum AccountStatus {
  ACTIVE = 'active',
  ANONYMIZED = 'anonymized',
  DELETION_PENDING = 'deletion_pending',
}

export const DELETED_USER_DISPLAY_NAME = 'Deleted user';

export const DATA_CATEGORIES_REMOVED = [
  'profile_identity',
  'contact_details',
  'authentication_credentials',
  'kyc_documents',
  'profile_picture',
  'device_tokens',
  'alerts',
  'bookmarks',
  'verification_codes',
  'password_reset_tokens',
  'message_content',
  'firebase_auth',
] as const;

export const DATA_CATEGORIES_RETAINED = [
  'transactions',
  'requests',
  'reviews',
  'published_listings',
  'delivery_proof_metadata',
  'stripe_account_references',
  'support_tickets_redacted',
] as const;

export type DataCategoryRemoved = (typeof DATA_CATEGORIES_REMOVED)[number];
export type DataCategoryRetained = (typeof DATA_CATEGORIES_RETAINED)[number];

export interface DeletionResult {
  message: string;
  deletedAt: Date;
  dataCategoriesRemoved: DataCategoryRemoved[];
  dataCategoriesRetained: DataCategoryRetained[];
}

export interface DeleteAccountOptions {
  reason?: string;
  confirmEmail?: string;
  requestIp?: string;
  appVersion?: string;
}
