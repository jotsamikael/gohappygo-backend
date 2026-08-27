/** GoHappyGo brand palette (logo colors). */
export const EMAIL_BRAND = {
  green: '#8cc43f',
  orange: '#f8b016',
  pink: '#e70b8e',
  blue: '#076fbc',
  text: '#333333',
  muted: '#666666',
  lightMuted: '#999999',
  background: '#f5f7fa',
  white: '#ffffff',
  border: '#e8ecf1',
  successBg: '#f3f9e8',
  warningBg: '#fff8e8',
  dangerBg: '#fde8f3',
  infoBg: '#e8f4fc',
} as const;

export type EmailHeaderVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface EmailLayoutContext {
  logoUrl: string;
  baseUrl: string;
}

export interface WrapEmailLayoutOptions {
  title: string;
  preheader?: string;
  bodyHtml: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerVariant?: EmailHeaderVariant;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}
