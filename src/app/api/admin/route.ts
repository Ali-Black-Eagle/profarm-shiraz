import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: لطفا ابتدا وارد حساب مدیر شوید.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'users') {
      const users = farmStore.getAllUsers().map(sanitizeUser);
      return NextResponse.json({ success: true, users });
    }

    if (type === 'subscriptionSettings') {
      const settings = farmStore.getSubscriptionSettings();
      return NextResponse.json({ success: true, settings });
    }

    if (type === 'siteContent') {
      const content = farmStore.getSiteContent();
      return NextResponse.json({ success: true, content });
    }

    return NextResponse.json({ success: false, message: 'نوع داده درخواستی نامعتبر است.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'خطای سرور در بارگذاری داده‌ها' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: این عملیات منحصراً در اختیار مدیر ارشد سیستم است.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'updateOrderStatus') {
      const { orderId, status } = payload || {};
      const allowedStatuses = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ success: false, message: 'وضعیت سفارش نامعتبر است.' }, { status: 400 });
      }
      const updated = await farmStore.updateOrderStatus(orderId, status);
      return NextResponse.json({ success: true, order: updated });
    }

    if (action === 'updateProduct') {
      const { id, updates } = payload || {};
      const updated = farmStore.updateProduct(id, updates);
      return NextResponse.json({ success: true, product: updated });
    }

    if (action === 'toggleProUser') {
      const { phone, isPro, expiryDate } = payload || {};
      const updated = farmStore.toggleProMembership(phone, isPro, expiryDate);
      return NextResponse.json({ success: true, user: updated ? sanitizeUser(updated) : null });
    }

    if (action === 'updateUserRole') {
      const { identifier, role } = payload || {};
      if (role !== 'ADMIN' && role !== 'USER') {
        return NextResponse.json({ success: false, message: 'نقش کاربری نامعتبر است.' }, { status: 400 });
      }
      if (identifier === session.userId && role !== 'ADMIN') {
        return NextResponse.json({ success: false, message: 'مدیر سیستم نمی‌تواند سطح دسترسی حساب خود را عزل کند.' }, { status: 400 });
      }
      const updated = farmStore.updateUserRole(identifier, role);
      return NextResponse.json({ success: true, user: updated ? sanitizeUser(updated) : null });
    }

    if (action === 'updateUserSubscription') {
      const { identifier, tier, expiryDate } = payload;
      const updated = farmStore.updateUserSubscription(identifier, tier, expiryDate);
      return NextResponse.json({ success: true, user: updated ? sanitizeUser(updated) : null });
    }

    if (action === 'updateSubscriptionSettings') {
      const { settings: newSettings } = payload || {};
      if (newSettings && typeof newSettings === 'object') {
        const updated = farmStore.updateSubscriptionSettings(newSettings);
        return NextResponse.json({ success: true, settings: updated });
      }
      return NextResponse.json({ success: false, message: 'تنظیمات نامعتبر است.' }, { status: 400 });
    }

    if (action === 'updateSiteContent') {
      const { content: newContent } = payload || {};
      if (newContent && typeof newContent === 'object') {
        const updated = farmStore.updateSiteContent(newContent);
        return NextResponse.json({ success: true, content: updated });
      }
      return NextResponse.json({ success: false, message: 'محتوای ارسالی نامعتبر است.' }, { status: 400 });
    }

    if (action === 'resetSiteContent') {
      const reset = farmStore.resetSiteContent();
      return NextResponse.json({ success: true, content: reset });
    }

    return NextResponse.json({ success: false, message: 'عملیات نامعتبر' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'خطای سرور در انجام عملیات ادمین' },
      { status: 500 }
    );
  }
}
