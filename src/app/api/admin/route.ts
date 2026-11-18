import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { normalizePhoneNumber } from '@/lib/formatters';
import { canTransition } from '@/lib/order-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

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
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'updateOrderStatus') {
      const { orderId, status } = payload || {};
      const allowedStatuses = ['PENDING_PAYMENT', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      if (!orderId || !allowedStatuses.includes(status)) {
        return NextResponse.json({ success: false, message: 'وضعیت یا شناسه سفارش نامعتبر است.' }, { status: 400 });
      }
      const existingOrder = farmStore.getOrderById(orderId);
      if (!existingOrder) {
        return NextResponse.json({ success: false, message: 'سفارش مورد نظر یافت نشد.' }, { status: 404 });
      }
      const transition = canTransition(existingOrder, status);
      if (!transition.allowed) {
        return NextResponse.json(
          { success: false, message: transition.reason || 'تغییر وضعیت سفارش مجاز نیست.' },
          { status: 400 }
        );
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
      const allUsers = farmStore.getAllUsers();
      const cleanId = String(identifier || '').trim();
      const targetUser = allUsers.find(
        (u) =>
          u.id === cleanId ||
          (u.phone && normalizePhoneNumber(u.phone) === normalizePhoneNumber(cleanId)) ||
          (u.email && u.email.toLowerCase() === cleanId.toLowerCase())
      );
      if (!targetUser) {
        return NextResponse.json({ success: false, message: 'کاربر مورد نظر یافت نشد.' }, { status: 404 });
      }
      const isSelf = targetUser.id === auth.user.id;
      if (isSelf && role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, message: 'مدیر سیستم نمی‌تواند سطح دسترسی حساب خود را عزل کند.' },
          { status: 400 }
        );
      }
      if (targetUser.role === 'ADMIN' && role !== 'ADMIN') {
        const remainingAdmins = allUsers.filter((u) => u.role === 'ADMIN' && u.id !== targetUser.id);
        if (remainingAdmins.length === 0) {
          return NextResponse.json(
            { success: false, message: 'امکان عزل آخرین مدیر فعال سیستم وجود ندارد.' },
            { status: 400 }
          );
        }
      }
      // Use the resolved account id, not the raw identifier typed by the admin (phone/email matching is above)
      const updated = farmStore.updateUserRole(targetUser.id, role);
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
