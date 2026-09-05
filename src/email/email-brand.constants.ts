/** GoHappyGo brand palette for emails — keep usage restrained. */
export const EMAIL_BRAND = {
  green: '#8cc43f',
  orange: '#f8b016',
  pink: '#e70b8e',
  blue: '#076fbc',
  headerText: '#001536',
  text: '#333333',
  muted: '#666666',
  lightMuted: '#999999',
  background: '#f5f7fa',
  white: '#ffffff',
  border: '#e8ecf1',
  panelBg: '#f8f9fb',
  codeBg: '#f3f6f9',
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
  headerTitleColor?: string;
  headerVariant?: EmailHeaderVariant;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}
