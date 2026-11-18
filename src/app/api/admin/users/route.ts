import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { intField, jsonError, jsonOk, pageParams, paginate, parseWith, readObjectBody, textField } from '@/lib/admin-api';
import { normalizePhoneNumber, toEnglishDigits } from '@/lib/formatters';
import { normalizeSearchText } from '@/lib/public-api';
import { getEffectiveTier } from '@/lib/subscription';
import type { User } from '@/types';

export const dynamic = 'force-dynamic';

/** Account as the admin list shows it: never the password hash. effectiveTier is the plan that applies right now. */
function adminUserView(user: User, nowMs: number) {
  const { password: _password, ...safe } = user;
  return { ...safe, effectiveTier: getEffectiveTier(user, nowMs) };
}

const patchSchema = z
  .object({
    id: textField(200, 'شناسه کاربر'),
    role: z.enum(['USER', 'ADMIN'], { error: 'نقش کاربری نامعتبر است' }).optional(),
    tier: z.enum(['FREE', 'PLUS', 'PRO'], { error: 'سطح اشتراک نامعتبر است' }).optional(),
    months: intField(1, 24, 'مدت اشتراک').optional(),
  })
  .refine((v) => v.role !== undefined || v.tier !== undefined, 'حداقل تغییر نقش یا سطح اشتراک لازم است.')
  .refine((v) => v.months === undefined || v.tier === 'PLUS' || v.tier === 'PRO', 'مدت اشتراک فقط برای پلاس یا پرو معتبر است.');

/** GET ?q= (name, phone, email or username), &page=, &pageSize= (default 20, max 100). Never returns password hashes. */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const rawQuery = (searchParams.get('q') || '').trim();
    const digits = toEnglishDigits(rawQuery).replace(/\s+/g, '');
    const text = normalizeSearchText(rawQuery);
    const now = Date.now();

    let list = farmStore.getAllUsers();
    if (rawQuery) {
      list = list.filter((u) => {
        if (/^\d{3,}$/.test(digits) && normalizePhoneNumber(u.phone || '').includes(digits)) return true;
        return [u.name, u.email, u.username, u.id]
          .some((value) => normalizeSearchText(String(value || '')).includes(text));
      });
    }
    list = [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const { page, pageSize } = pageParams(searchParams, { pageSize: 20, maxPageSize: 100 });
    const { items, pagination } = paginate(list, page, pageSize);
    return jsonOk({ users: items.map((u) => adminUserView(u, now)), pagination });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/users GET', 'خطا در دریافت فهرست کاربران');
  }
}

/**
 * PATCH { id, role?, tier?, months? }
 * - role: a demoted admin loses access at once (requireAdmin reads the stored role). An admin cannot demote
 *   themselves, and the last active admin cannot be demoted.
 * - tier: FREE clears both plans. PLUS or PRO extends that plan by months (1 to 24, default 1).
 *   The subscription SMS is sent only when the effective tier changes.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(patchSchema, body ?? {});
    if ('response' in parsed) return parsed.response;
    const { id, role, tier, months } = parsed.data;

    const all = farmStore.getAllUsers();
    const target = all.find((u) => u.id === id);
    if (!target) return jsonError(404, 'کاربر مورد نظر یافت نشد.');

    if (role !== undefined) {
      if (target.id === auth.user.id && role !== 'ADMIN') {
        return jsonError(400, 'مدیر سیستم نمی‌تواند سطح دسترسی حساب خود را عزل کند.');
      }
      if (target.role === 'ADMIN' && role !== 'ADMIN') {
        const remainingAdmins = all.filter((u) => u.role === 'ADMIN' && u.id !== target.id);
        if (remainingAdmins.length === 0) {
          return jsonError(400, 'امکان عزل آخرین مدیر فعال سیستم وجود ندارد.');
        }
      }
      farmStore.updateUserRole(target.id, role);
    }

    if (tier !== undefined) {
      farmStore.setUserTier(target.id, tier, tier === 'FREE' ? 0 : months ?? 1);
    }

    const updated = farmStore.getAllUsers().find((u) => u.id === target.id);
    if (!updated) return jsonError(404, 'کاربر مورد نظر یافت نشد.');
    return jsonOk({ user: adminUserView(updated, Date.now()) });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/users PATCH', 'خطا در بروزرسانی کاربر');
  }
}
