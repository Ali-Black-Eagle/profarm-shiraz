import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import fs from 'fs';
import path from 'path';

// Store payment configuration safely outside source directory
const DATA_DIR = path.join(process.cwd(), '.data');
const JSON_BACKUP_PATH = path.join(DATA_DIR, 'payment-settings.json');

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز به تنظیمات درگاه' },
        { status: 403 }
      );
    }

    const settings = farmStore.getPaymentSettings();

    // Mask sensitive gateway secrets before returning to browser
    const maskedSettings = {
      ...settings,
      snapppay: {
        ...settings.snapppay,
        clientSecret: settings.snapppay?.clientSecret ? '••••••••••••••••' : '',
      },
    };

    return NextResponse.json({
      success: true,
      settings: maskedSettings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'خطا در بارگذاری تنظیمات درگاه' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: فقط ادمین امکان ویرایش تنظیمات را دارد.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // If clientSecret is masked placeholder, retain current secret
    const currentSettings = farmStore.getPaymentSettings();
    if (body.snapppay && body.snapppay.clientSecret === '••••••••••••••••') {
      body.snapppay.clientSecret = currentSettings.snapppay?.clientSecret || '';
    }

    // 1. Update in-memory & persisted farmStore
    const updated = farmStore.updatePaymentSettings(body);

    // 2. Sync with process.env
    if (updated.zarinpal?.merchantId !== undefined) {
      process.env.ZARINPAL_MERCHANT_ID = updated.zarinpal.merchantId;
    }
    if (updated.zarinpal?.sandbox !== undefined) {
      process.env.ZARINPAL_SANDBOX = String(updated.zarinpal.sandbox);
    }
    if (updated.snapppay?.clientId !== undefined) {
      process.env.SNAPPPAY_CLIENT_ID = updated.snapppay.clientId;
    }
    if (updated.snapppay?.clientSecret !== undefined && updated.snapppay.clientSecret !== '••••••••••••••••') {
      process.env.SNAPPPAY_CLIENT_SECRET = updated.snapppay.clientSecret;
    }
    if (updated.snapppay?.baseUrl !== undefined) {
      process.env.SNAPPPAY_BASE_URL = updated.snapppay.baseUrl;
    }

    // 3. Write snapshot in secure .data/ folder (outside src/)
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(JSON_BACKUP_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not write payment-settings.json snapshot:', e);
    }

    // Mask secrets in response
    const maskedUpdated = {
      ...updated,
      snapppay: {
        ...updated.snapppay,
        clientSecret: updated.snapppay?.clientSecret ? '••••••••••••••••' : '',
      },
    };

    return NextResponse.json({
      success: true,
      message: 'تنظیمات درگاه‌های پرداخت با موفقیت ذخیره و در سرور فعال شد.',
      settings: maskedUpdated,
    });
  } catch (error: any) {
    console.error('Error saving payment settings:', error);
    return NextResponse.json(
      { success: false, message: 'خطا در ذخیره‌سازی تنظیمات درگاه' },
      { status: 500 }
    );
  }
}
