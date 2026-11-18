import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { normalizePhoneNumber } from '@/lib/formatters';
import { parseWith } from '@/lib/admin-api';
import {
  legacyUserSubscriptionSchema,
  siteContentPatchSchema,
  subscriptionSettingsPatchSchema,
} from '@/lib/settings-validation';
import { changeOrderStatus, listAdminOrders, serializeAdminOrder } from '@/lib/admin-orders';
import { PATCH as patchAdminProduct } from '@/app/api/admin/products/route';

/** A civil date written as YYYY-MM-DD that exists (no 2026-02-30). */
function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

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

    // Same data as GET /api/admin/orders (filters optional). Each order carries allowedNextStatuses.
    if (type === 'orders') {
      const date = searchParams.get('date') || undefined;
      if (date !== undefined && !isValidIsoDate(date)) {
        return NextResponse.json({ success: false, message: 'تاریخ فیلتر باید YYYY-MM-DD باشد.' }, { status: 400 });
      }
      const orders = listAdminOrders({
        status: searchParams.get('status') || undefined,
        date,
        q: searchParams.get('q') || undefined,
      }).map(serializeAdminOrder);
      return NextResponse.json({ success: true, orders });
    }

    if (type === 'subscriptionSettings') {
      const settings = farmStore.getSubscriptionSettings();
      return NextResponse.json({ success: true, settings });
    }

    if (type === 'siteContent') {
      const content = farmStore.getSiteContent();
      return NextResponse.json({ success: true, content });
    }

    if (type === 'dailyCapacities') {
      return NextResponse.json({ success: true, dailyCapacities: farmStore.getDailyCapacities() });
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
      // Shared path with /api/admin/orders: under the order lock, transition checked again inside it, SMS sent once.
      const outcome = await changeOrderStatus(orderId, status);
      if (!outcome.ok) {
        return NextResponse.json(
          { success: false, message: outcome.message },
          { status: outcome.reason === 'NOT_FOUND' ? 404 : 400 }
        );
      }
      return NextResponse.json({ success: true, order: outcome.order });
    }

    if (action === 'setDailyCapacity') {
      const { isoDate, maxOrders } = payload || {};
      if (!isValidIsoDate(isoDate)) {
        return NextResponse.json({ success: false, message: 'تاریخ روز تحویل نامعتبر است.' }, { status: 400 });
      }
      if (!Number.isInteger(maxOrders) || maxOrders < 0 || maxOrders > 1000) {
        return NextResponse.json(
          { success: false, message: 'ظرفیت روزانه باید عدد صحیح بین ۰ تا ۱۰۰۰ باشد.' },
          { status: 400 }
        );
      }
      farmStore.setDailyCapacity(isoDate, { maxCapacity: maxOrders });
      return NextResponse.json({ success: true, dailyCapacities: farmStore.getDailyCapacities() });
    }

    if (action === 'toggleDayClosed') {
      const { isoDate, closed } = payload || {};
      if (!isValidIsoDate(isoDate)) {
        return NextResponse.json({ success: false, message: 'تاریخ روز تحویل نامعتبر است.' }, { status: 400 });
      }
      if (typeof closed !== 'boolean') {
        return NextResponse.json({ success: false, message: 'وضعیت تعطیلی روز نامعتبر است.' }, { status: 400 });
      }
      farmStore.setDailyCapacity(isoDate, { isClosedManually: closed });
      return NextResponse.json({ success: true, dailyCapacities: farmStore.getDailyCapacities() });
    }

    if (action === 'updateProduct') {
      // Legacy action: forwarded to PATCH /api/admin/products so it gets the same zod whitelist and checks
      // (negative price or stock, unknown category, slug clashes) and the same 400 responses.
      const { id, updates } = payload || {};
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return NextResponse.json({ success: false, message: 'اطلاعات ویرایش کالا نامعتبر است.' }, { status: 400 });
      }
      const headers = new Headers(req.headers);
      headers.delete('content-length');
      headers.set('content-type', 'application/json');
      const forwarded = new NextRequest(req.url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...updates, id: typeof id === 'string' ? id : '' }),
      });
      return patchAdminProduct(forwarded);
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
      // Same rules as PATCH /api/admin/users: tier FREE | PLUS | PRO, months 1 to 24. Expiry is computed by setUserTier.
      const parsed = parseWith(legacyUserSubscriptionSchema, payload ?? {});
      if ('response' in parsed) return parsed.response;
      const { identifier, tier, months } = parsed.data;
      const cleanId = identifier.trim();
      const target = farmStore
        .getAllUsers()
        .find(
          (u) =>
            u.id === cleanId ||
            (u.phone && normalizePhoneNumber(u.phone) === normalizePhoneNumber(cleanId)) ||
            (u.email && u.email.toLowerCase() === cleanId.toLowerCase())
        );
      if (!target) {
        return NextResponse.json({ success: false, message: 'کاربر مورد نظر یافت نشد.' }, { status: 404 });
      }
      const updated = farmStore.setUserTier(target.id, tier, tier === 'FREE' ? 0 : months ?? 1);
      return NextResponse.json({ success: true, user: updated ? sanitizeUser(updated) : null });
    }

    if (action === 'resetSubscriptionSettings') {
      // Factory defaults, applied on the server. The client updates its view only from this answer.
      const settings = farmStore.resetSubscriptionSettings();
      return NextResponse.json({ success: true, settings, message: 'تنظیمات اشتراک به مقادیر اولیه بازگشت.' });
    }

    if (action === 'updateSubscriptionSettings') {
      const { settings: newSettings } = payload || {};
      if (newSettings && typeof newSettings === 'object') {
        const parsed = parseWith(subscriptionSettingsPatchSchema, newSettings);
        if ('response' in parsed) return parsed.response;
        const updated = farmStore.updateSubscriptionSettings(
          parsed.data as Parameters<typeof farmStore.updateSubscriptionSettings>[0]
        );
        return NextResponse.json({ success: true, settings: updated });
      }
      return NextResponse.json({ success: false, message: 'تنظیمات نامعتبر است.' }, { status: 400 });
    }

    if (action === 'updateSiteContent') {
      const { content: newContent } = payload || {};
      if (newContent && typeof newContent === 'object') {
        // Whitelisted keys, length limits and URL scheme policy (see settings-validation.ts)
        const parsed = parseWith(siteContentPatchSchema, newContent);
        if ('response' in parsed) return parsed.response;
        const updated = farmStore.updateSiteContent(parsed.data as Parameters<typeof farmStore.updateSiteContent>[0]);
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
