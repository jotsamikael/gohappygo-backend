import {
  EMAIL_BRAND,
  EmailLayoutContext,
  WrapEmailLayoutOptions,
} from './email-brand.constants';

export function emailButton(
  href: string,
  label: string,
  color: string = EMAIL_BRAND.blue,
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
  backgroundColor: string = EMAIL_BRAND.panelBg,
): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:20px 0;background-color:${backgroundColor};border:1px solid ${EMAIL_BRAND.border};border-left:3px solid ${accentColor};border-radius:6px;">
      <tr>
        <td style="padding:16px 20px;font-family:Arial,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:${EMAIL_BRAND.text};">
          ${content}
        </td>
      </tr>
    </table>`;
}

export function emailHeading(text: string, color: string = EMAIL_BRAND.headerText): string {
  return `<h2 style="margin:0 0 12px;font-family:Arial,'Segoe UI',sans-serif;font-size:22px;font-weight:700;color:${color};">${text}</h2>`;
}

export function emailCodeBlock(code: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td align="center"
            style="padding:20px;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:4px;
                   color:${EMAIL_BRAND.headerText};background-color:${EMAIL_BRAND.codeBg};border:1px solid ${EMAIL_BRAND.border};border-radius:8px;">
          ${code}
        </td>
      </tr>
    </table>`;
}

export function emailBadge(text: string, color: string = EMAIL_BRAND.blue): string {
  return `<span style="display:inline-block;padding:4px 12px;background-color:${color};color:${EMAIL_BRAND.white};border-radius:999px;font-size:12px;font-weight:bold;">${text}</span>`;
}

function buildLogoBlock(ctx: EmailLayoutContext): string {
  const logoUrl = (ctx.logoUrl || '').trim();
  if (!logoUrl) {
    return `<p style="margin:0 0 16px;font-family:Arial,'Segoe UI',sans-serif;font-size:26px;font-weight:bold;color:${EMAIL_BRAND.headerText};">GoHappyGo</p>`;
  }

  const safeUrl = logoUrl.replace(/"/g, '&quot;');
  return `
    <a href="${ctx.baseUrl}" target="_blank" style="text-decoration:none;display:inline-block;margin:0 0 16px;">
      <img src="${safeUrl}"
           alt="GoHappyGo"
           width="220"
           style="display:block;margin:0 auto;max-width:220px;width:220px;height:auto;border:0;outline:none;-ms-interpolation-mode:bicubic;" />
    </a>`;
}

export function wrapEmailLayout(
  ctx: EmailLayoutContext,
  options: WrapEmailLayoutOptions,
): string {
  const year = new Date().getFullYear();
  const headerTitle = options.headerTitle ?? options.title;
  const preheader = options.preheader ?? '';
  const logoBlock = buildLogoBlock(ctx);

  const ctaBlock =
    options.ctaLabel && options.ctaUrl
      ? emailButton(options.ctaUrl, options.ctaLabel, EMAIL_BRAND.blue)
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
               style="max-width:600px;width:100%;background-color:${EMAIL_BRAND.white};border-radius:10px;overflow:hidden;border:1px solid ${EMAIL_BRAND.border};">
          <!-- Header -->
          <tr>
            <td align="center" bgcolor="${EMAIL_BRAND.white}"
                style="padding:32px 28px 24px;background-color:${EMAIL_BRAND.white};border-bottom:3px solid ${EMAIL_BRAND.blue};">
              ${logoBlock}
              <h1 style="margin:0;font-family:Arial,'Segoe UI',sans-serif;font-size:22px;font-weight:700;color:${EMAIL_BRAND.headerText};line-height:1.35;">
                ${headerTitle}
              </h1>
              ${options.headerSubtitle ? `<p style="margin:10px 0 0;font-size:15px;color:${EMAIL_BRAND.muted};line-height:1.5;">${options.headerSubtitle}</p>` : ''}
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
            <td style="padding:20px 28px 28px;border-top:1px solid ${EMAIL_BRAND.border};text-align:center;background-color:${EMAIL_BRAND.white};">
              <p style="margin:0 0 8px;font-size:13px;color:${EMAIL_BRAND.muted};">
                <a href="${ctx.baseUrl}" style="color:${EMAIL_BRAND.blue};text-decoration:none;font-weight:bold;">GoHappyGo</a>
                &mdash; Share your journey, multiply joy
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
