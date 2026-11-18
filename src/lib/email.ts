/**
 * ProFarm Shiraz Email Service
 * Supports live SMTP delivery via Nodemailer, fallback delivery when SMS fails,
 * admin broadcasts with HTML Persian branded templating, and mock/simulation mode.
 */

import 'server-only';
import { EmailMessageLog, EmailProviderSettings } from '@/types';
import { farmStore } from './db-store';

type EmailLogSubscriber = (log: EmailMessageLog) => void;
const emailSubscribers: EmailLogSubscriber[] = [];

export function subscribeEmailLogs(subscriber: EmailLogSubscriber) {
  emailSubscribers.push(subscriber);
}

export interface SendEmailOptions {
  to: string;
  recipientName?: string;
  subject: string;
  text?: string;
  html?: string;
  fallbackForSms?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  emailId?: string;
}

/**
 * Validates basic email address format
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(clean);
}

/**
 * Retrieves current active email provider settings
 */
export function getEffectiveEmailSettings(): EmailProviderSettings {
  try {
    if (farmStore && typeof farmStore.getEmailSettings === 'function') {
      return farmStore.getEmailSettings();
    }
  } catch {}

  return {
    isEnabled: true,
    provider: (process.env.EMAIL_PROVIDER as any) || (process.env.SMTP_HOST ? 'SMTP' : 'SMTP'),
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpSecure: process.env.SMTP_SECURE === 'true',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'info@profarm-shiraz.ir',
    fromName: process.env.SMTP_FROM_NAME || 'مزارع ارگانیک پروفارم شیراز',
  };
}

/**
 * Generates an elegant, responsive Persian branded HTML email template
 */
export function generateProFarmEmailHtml(options: {
  recipientName?: string;
  subject: string;
  content: string;
  footerNote?: string;
}): string {
  const name = options.recipientName ? `جناب/سرکار ${options.recipientName}` : 'مشتری گرامی';
  const formattedContent = options.content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.8; color: #2D3748; font-size: 14px;">${p}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#F9F8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; direction: rtl; text-align: right;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9F8F5; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #E6E1D5; overflow: hidden; box-shadow: 0 4px 20px rgba(44, 74, 46, 0.06);" cellspacing="0" cellpadding="0" border="0">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #2C4A2E; padding: 28px 30px; text-align: center; border-bottom: 3px solid #D4AF37;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">
                مزارع ارگانیک پروفارم شیراز
              </h1>
              <p style="margin: 6px 0 0 0; color: #D4AF37; font-size: 12px; font-weight: bold;">
                توزیع مستقیم فرآورده‌های تازه و سالم مزارع فارس
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 30px 25px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #2C4A2E; font-size: 16px; font-weight: bold;">
                سلام ${name}،
              </h2>
              
              <div style="background-color: #FAFAFA; border-right: 4px solid #2C4A2E; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                <h3 style="margin: 0; color: #1A202C; font-size: 15px; font-weight: 800;">
                  ${options.subject}
                </h3>
              </div>

              ${formattedContent}

              ${
                options.footerNote
                  ? `<div style="margin-top: 20px; padding: 12px; background-color: #FEF3C7; border-radius: 12px; border: 1px solid #FCD34D; font-size: 12px; color: #92400E;">
                      ${options.footerNote}
                    </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F7FAFC; padding: 20px 30px; border-top: 1px solid #EDF2F7; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #718096;">
                پروفارم شیراز | ارسال با زنجیره سرد پیک اختصاصی درب منزل در شیراز
              </p>
              <p style="margin: 0; font-size: 11px; color: #A0AEC0;">
                نشانی: شیراز، بلوار ارم | تلفن پشتیبانی: ۰۷۱۳۶۲۸۰۰۰۰
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Creates a Nodemailer transport instance dynamically from the given settings
 */
export async function createMailTransporter(settings: EmailProviderSettings) {
  const req = eval('require');
  const nodemailerModule = req('nodemailer');
  const nodemailer = nodemailerModule?.default || nodemailerModule;
  const isPort465 = Number(settings.smtpPort) === 465;
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort) || 587,
    secure: settings.smtpSecure !== undefined ? settings.smtpSecure : isPort465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    tls: {
      // Do not fail on self-signed certificates or proxy handshakes
      rejectUnauthorized: false,
    },
  });
}

/**
 * Sends a real or simulated email, records the log in farmStore, and notifies subscribers.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, recipientName, subject, text, html, fallbackForSms } = options;

  if (!isValidEmail(to)) {
    return {
      success: false,
      message: 'آدرس ایمیل گیرنده نامعتبر است.',
    };
  }

  const emailId = `eml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const content = text || subject;
  const fullHtml = html || generateProFarmEmailHtml({
    recipientName,
    subject,
    content,
    footerNote: fallbackForSms ? 'این پیام به دلیل اختلال موقت در سامانه پیامکی، از طریق ایمیل برای شما ارسال گردیده است.' : undefined,
  });

  const logEntry: EmailMessageLog = {
    id: emailId,
    to: to.trim().toLowerCase(),
    recipientName: recipientName || undefined,
    subject: subject.trim(),
    body: content,
    status: 'SENT',
    fallbackForSms: !!fallbackForSms,
    createdAt: new Date().toISOString(),
  };

  const settings = getEffectiveEmailSettings();
  const hasSmtpAuth = Boolean(
    settings.smtpHost &&
    settings.smtpUser &&
    settings.smtpPass &&
    settings.smtpPass.trim().length > 0
  );

  let realDispatchError: string | null = null;

  if (settings.isEnabled && settings.provider === 'SMTP' && hasSmtpAuth) {
    try {
      const transporter = await createMailTransporter(settings);
      const fromEmail = settings.fromEmail || settings.smtpUser;
      const fromName = settings.fromName || 'مزارع ارگانیک پروفارم شیراز';

      const sendInfo = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        replyTo: fromEmail,
        to: to.trim().toLowerCase(),
        subject: subject.trim(),
        text: content,
        html: fullHtml,
      });

      console.log(`[EMAIL LIVE SENT] To: ${to} | MessageId: ${sendInfo.messageId}`);
      logEntry.status = 'SENT';
    } catch (err: any) {
      console.error('[EMAIL LIVE DISPATCH ERROR]', err);
      realDispatchError = err.message || 'خطا در ارتباط با سرور SMTP';
      logEntry.status = 'FAILED';
    }
  } else {
    // Mock / Simulation mode (when SMTP is not configured or set to MOCK)
    console.log(`\n================== [PRO-FARM EMAIL SENT (MOCK/LOCAL LOG)] ==================`);
    console.log(`To: ${to} (${recipientName || 'کاربر'})`);
    console.log(`Subject: ${subject}`);
    if (fallbackForSms) console.log(`[Notice] Delivered as automatic fallback for SMS!`);
    console.log(`Content:\n${content}`);
    console.log(`Note: To send real emails, set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env or via Admin Panel.`);
    console.log(`===========================================================================\n`);
    logEntry.status = 'SENT';
  }

  // Save log to farmStore
  try {
    if (farmStore && typeof farmStore.addEmailLog === 'function') {
      farmStore.addEmailLog(logEntry);
    }
  } catch (e) {
    console.warn('[EmailService] Could not persist email log:', e);
  }

  // Notify subscribers
  for (const sub of emailSubscribers) {
    try {
      sub(logEntry);
    } catch (e) {
      console.warn('[EmailService] Could not trigger email subscriber:', e);
    }
  }

  if (realDispatchError) {
    return {
      success: false,
      message: `خطا در ارسال واقعی ایمیل: ${realDispatchError}`,
      emailId,
    };
  }

  return {
    success: true,
    message: hasSmtpAuth
      ? 'ایمیل با موفقیت از طریق سرور SMTP برای گیرنده ارسال شد.'
      : 'ایمیل با موفقیت ثبت شد (برای ارسال اینترنتی واقعی، اطلاعات سرور SMTP را وارد نمایید).',
    emailId,
  };
}

/**
 * Tests an SMTP configuration and optionally sends a live verification email
 */
export async function testSmtpConnection(
  settings: EmailProviderSettings,
  testRecipient?: string
): Promise<{ success: boolean; message: string; log?: string }> {
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    return {
      success: false,
      message: 'لطفاً هاست SMTP، نام کاربری و کلمه عبور (یا App Password) را تکمیل فرمایید.',
    };
  }

  try {
    const transporter = await createMailTransporter(settings);

    // 1. Handshake & Authentication verification
    await transporter.verify();

    // 2. Send live verification email if recipient is provided
    if (testRecipient && isValidEmail(testRecipient)) {
      const fromEmail = settings.fromEmail || settings.smtpUser;
      const fromName = settings.fromName || 'مزارع ارگانیک پروفارم شیراز';

      const htmlContent = generateProFarmEmailHtml({
        recipientName: 'مدیریت محترم مزارع پروفارم شیراز',
        subject: 'تست موفقیت‌آمیز اتصال وب‌سرویس ایمیل (SMTP)',
        content: `این ایمیل آزمایشی جهت تایید صحت ارسال واقعی ایمیل از سامانه مزارع ارگانیک پروفارم شیراز ارسال شده است.\n\nسرور هاست: ${settings.smtpHost}\nپورت ارتباطی: ${settings.smtpPort}\nنام کاربری: ${settings.smtpUser}\nایمیل فرستنده: ${fromEmail}\nزمان ارسال: ${new Date().toLocaleString('fa-IR')}\n\nاکنون تمامی اعلان‌ها، فاکتورها، کدهای تایید و پیام‌های جایگزین پیامک از این طریق برای کاربران ارسال خواهند شد.`,
      });

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: testRecipient.trim().toLowerCase(),
        subject: 'تست اتصال سامانه ارسال ایمیل مزارع پروفارم شیراز ✓',
        text: 'این یک ایمیل آزمایشی جهت تایید اتصال وب‌سرویس SMTP مزارع پروفارم شیراز است.',
        html: htmlContent,
      });

      return {
        success: true,
        message: `اتصال سرور SMTP تایید شد و ایمیل تستی با موفقیت به ${testRecipient} ارسال گردید. (شناسه پیام: ${info.messageId})`,
        log: `Success: MessageId=${info.messageId}`,
      };
    }

    return {
      success: true,
      message: 'اتصال به سرور SMTP و احراز هویت با موفقیت تایید شد.',
      log: 'Handshake and authentication OK',
    };
  } catch (err: any) {
    console.error('[testSmtpConnection Error]', err);
    let friendlyMessage = `خطا در ارتباط با سرور SMTP: ${err.message || 'نامشخص'}`;

    if (err.code === 'EAUTH' || err.responseCode === 535) {
      friendlyMessage = 'خطای نام کاربری یا رمز عبور (EAUTH). در صورت استفاده از جیمیل، باید از رمز عبور برنامه (App Password) ۱۶ رقمی استفاده کنید.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      friendlyMessage = `عدم امکان برقراری ارتباط با سرور ${settings.smtpHost} روی پورت ${settings.smtpPort}. پورت یا هاست را بررسی نمایید.`;
    }

    return {
      success: false,
      message: friendlyMessage,
      log: err.stack || err.toString(),
    };
  }
}
