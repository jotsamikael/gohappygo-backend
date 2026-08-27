import {
  EMAIL_BRAND,
  EmailHeaderVariant,
  EmailLayoutContext,
  WrapEmailLayoutOptions,
} from './email-brand.constants';

const HEADER_ACCENT: Record<EmailHeaderVariant, string> = {
  default: EMAIL_BRAND.blue,
  success: EMAIL_BRAND.green,
  warning: EMAIL_BRAND.orange,
  danger: EMAIL_BRAND.pink,
  info: EMAIL_BRAND.blue,
};

export function emailButton(
  href: string,
  label: string,
  color: string = EMAIL_BRAND.pink,
): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto;">
      <tr>
        <td align="center" bgcolor="${color}" style="border-radius:6px;background-color:${color};">
          <a href="${href}"
             target="_blank"
             style="display:inline-block;padding:12px 28px;font-family:Arial,'Segoe UI',sans-serif;font-size:16px;font-weight:bold;color:${EMAIL_BRAND.white};text-decoration:none;border-radius:6px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

export function emailPanel(
  content: string,
  accentColor: string = EMAIL_BRAND.blue,
  backgroundColor: string = EMAIL_BRAND.infoBg,
): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:20px 0;background-color:${backgroundColor};border-left:4px solid ${accentColor};border-radius:6px;">
      <tr>
        <td style="padding:16px 20px;font-family:Arial,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:${EMAIL_BRAND.text};">
          ${content}
        </td>
      </tr>
    </table>`;
}

export function emailHeading(text: string, color: string = EMAIL_BRAND.blue): string {
  return `<h2 style="margin:0 0 12px;font-family:Arial,'Segoe UI',sans-serif;font-size:22px;font-weight:700;color:${color};">${text}</h2>`;
}

export function emailCodeBlock(code: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td align="center"
            style="padding:20px;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:4px;
                   color:${EMAIL_BRAND.blue};background-color:${EMAIL_BRAND.infoBg};border:2px dashed ${EMAIL_BRAND.blue};border-radius:8px;">
          ${code}
        </td>
      </tr>
    </table>`;
}

export function emailBadge(text: string, color: string = EMAIL_BRAND.green): string {
  return `<span style="display:inline-block;padding:4px 12px;background-color:${color};color:${EMAIL_BRAND.white};border-radius:999px;font-size:12px;font-weight:bold;">${text}</span>`;
}

export function wrapEmailLayout(
  ctx: EmailLayoutContext,
  options: WrapEmailLayoutOptions,
): string {
  const year = new Date().getFullYear();
  const variant = options.headerVariant ?? 'default';
  const accent = HEADER_ACCENT[variant];
  const headerTitle = options.headerTitle ?? options.title;
  const preheader = options.preheader ?? '';
  const logoBlock = ctx.logoUrl
    ? `<img src="${ctx.logoUrl}" alt="GoHappyGo" width="200"
            style="display:block;margin:0 auto 16px;max-width:200px;height:auto;border:0;" />`
    : `<p style="margin:0;font-family:Arial,'Segoe UI',sans-serif;font-size:28px;font-weight:bold;color:${EMAIL_BRAND.white};">GoHappyGo</p>`;

  const ctaBlock =
    options.ctaLabel && options.ctaUrl
      ? emailButton(options.ctaUrl, options.ctaLabel, EMAIL_BRAND.pink)
      : '';

  const footerNote =
    options.footerNote ??
    'This is an automated message from GoHappyGo. Please do not reply to this email.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${options.title}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BRAND.background};font-family:Arial,'Segoe UI',sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_BRAND.background};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:${EMAIL_BRAND.white};border-radius:10px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <!-- Brand stripe -->
          <tr>
            <td style="height:4px;padding:0;font-size:0;line-height:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="25%" style="height:4px;background-color:${EMAIL_BRAND.green};"></td>
                  <td width="25%" style="height:4px;background-color:${EMAIL_BRAND.orange};"></td>
                  <td width="25%" style="height:4px;background-color:${EMAIL_BRAND.pink};"></td>
                  <td width="25%" style="height:4px;background-color:${EMAIL_BRAND.blue};"></td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Header -->
          <tr>
            <td align="center" bgcolor="${accent}"
                style="padding:28px 24px;background-color:${accent};">
              ${logoBlock}
              <h1 style="margin:0;font-family:Arial,'Segoe UI',sans-serif;font-size:22px;font-weight:600;color:${EMAIL_BRAND.white};line-height:1.3;">
                ${headerTitle}
              </h1>
              ${options.headerSubtitle ? `<p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.92);">${options.headerSubtitle}</p>` : ''}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;font-family:Arial,'Segoe UI',sans-serif;font-size:15px;line-height:1.65;color:${EMAIL_BRAND.text};">
              ${options.bodyHtml}
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid ${EMAIL_BRAND.border};text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:${EMAIL_BRAND.muted};">
                <a href="${ctx.baseUrl}" style="color:${EMAIL_BRAND.blue};text-decoration:none;font-weight:bold;">GoHappyGo</a>
                &mdash; Connecting travelers and senders worldwide
              </p>
              <p style="margin:0 0 8px;font-size:12px;color:${EMAIL_BRAND.lightMuted};">
                &copy; ${year} GoHappyGo. All rights reserved.
              </p>
              <p style="margin:0;font-size:11px;color:${EMAIL_BRAND.lightMuted};line-height:1.5;">
                ${footerNote}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
