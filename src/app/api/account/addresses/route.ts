import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { apiErrorResponse } from '@/lib/api-errors';
import { isShirazAddress, isValidIranPhone, normalizePhoneNumber, toEnglishDigits } from '@/lib/formatters';
import type { Address } from '@/types';

export const dynamic = 'force-dynamic';

const MAX_ADDRESSES = 10;

const addressFields = z.object({
  recipientName: z.string().trim().min(2, 'نام گیرنده کوتاه است.').max(100),
  phone: z.string().trim().refine((v) => isValidIranPhone(v), 'شماره موبایل گیرنده نامعتبر است.'),
  province: z.string().trim().min(2, 'استان را وارد کنید.').max(50),
  city: z.string().trim().min(2, 'شهر را وارد کنید.').max(50),
  postalCode: z.string().trim().regex(/^\d{10}$/, 'کد پستی باید ۱۰ رقم باشد.'),
  streetAddress: z.string().trim().min(5, 'نشانی را کامل وارد کنید.').max(300),
  unit: z.string().trim().max(20).optional().nullable(),
  isDefault: z.boolean().optional(),
});

const createSchema = addressFields;
const updateSchema = addressFields.partial().extend({ id: z.string().trim().min(1).max(100) });

/** Persian/Arabic digits and separators are normalised before validation (phone, postal code). */
function cleanInput(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (typeof out.phone === 'string') out.phone = normalizePhoneNumber(toEnglishDigits(out.phone));
  if (typeof out.postalCode === 'string') out.postalCode = toEnglishDigits(out.postalCode).replace(/[\s-]/g, '');
  if (typeof out.unit === 'string' && out.unit.trim() === '') out.unit = null;
  return out;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message || 'اطلاعات نشانی نامعتبر است.';
}

function ownAddresses(userId: string): Address[] {
  const user = farmStore.getAllUsers().find((u) => u.id === userId);
  return Array.isArray(user?.addresses) ? [...(user?.addresses ?? [])] : [];
}

/** Keeps exactly one default: the given id wins, otherwise the current default, otherwise the first address. */
function normalizeDefaults(list: Address[], preferredId?: string): Address[] {
  if (list.length === 0) return list;
  const wanted = preferredId && list.some((a) => a.id === preferredId)
    ? preferredId
    : list.find((a) => a.isDefault)?.id ?? list[0].id;
  return list.map((a) => ({ ...a, isDefault: a.id === wanted }));
}

function save(userId: string, list: Address[]): Address[] {
  const user = farmStore.setUserAddresses(userId, list);
  return Array.isArray(user?.addresses) ? user.addresses : list;
}

/** GET /api/account/addresses: the caller's saved addresses (session required). */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
    }
    return NextResponse.json({ success: true, addresses: normalizeDefaults(ownAddresses(session.userId)) });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'account/addresses GET', 'خطا در دریافت نشانی‌ها');
  }
}

/** POST /api/account/addresses: add an address (max 10). The first address becomes the default. */
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'اطلاعات ارسالی نامعتبر است.' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(cleanInput(body));
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 });
    }

    const current = ownAddresses(session.userId);
    if (current.length >= MAX_ADDRESSES) {
      return NextResponse.json(
        { success: false, message: `حداکثر ${MAX_ADDRESSES} نشانی می‌توانید ذخیره کنید.` },
        { status: 409 }
      );
    }

    const data = parsed.data;
    const address: Address = {
      id: `addr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      userId: session.userId,
      recipientName: data.recipientName,
      phone: normalizePhoneNumber(data.phone),
      province: data.province,
      city: data.city,
      postalCode: data.postalCode,
      streetAddress: data.streetAddress,
      unit: data.unit ? data.unit : null,
      isShiraz: isShirazAddress(data.city, data.province),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    const list = [...current, address];
    const preferred = data.isDefault || current.length === 0 ? address.id : undefined;
    const addresses = save(session.userId, normalizeDefaults(list, preferred));
    const saved = addresses.find((a) => a.id === address.id) ?? address;

    return NextResponse.json({ success: true, address: saved, addresses }, { status: 201 });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'account/addresses POST', 'خطا در ذخیره نشانی');
  }
}

/** PATCH /api/account/addresses: body { id, ...fields }. Only the given fields change. */
export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'اطلاعات ارسالی نامعتبر است.' }, { status: 400 });
    }
    const parsed = updateSchema.safeParse(cleanInput(body));
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 });
    }

    const { id, ...changes } = parsed.data;
    const current = ownAddresses(session.userId);
    const target = current.find((a) => a.id === id);
    if (!target) {
      return NextResponse.json({ success: false, message: 'نشانی مورد نظر یافت نشد.' }, { status: 404 });
    }

    const updated: Address = {
      ...target,
      ...(changes.recipientName !== undefined && { recipientName: changes.recipientName }),
      ...(changes.phone !== undefined && { phone: normalizePhoneNumber(changes.phone) }),
      ...(changes.province !== undefined && { province: changes.province }),
      ...(changes.city !== undefined && { city: changes.city }),
      ...(changes.postalCode !== undefined && { postalCode: changes.postalCode }),
      ...(changes.streetAddress !== undefined && { streetAddress: changes.streetAddress }),
      ...(changes.unit !== undefined && { unit: changes.unit ? changes.unit : null }),
    };
    updated.isShiraz = isShirazAddress(updated.city, updated.province);

    const list = current.map((a) => (a.id === id ? updated : a));
    // isDefault: true makes this address the default. false on the current default is ignored (one default must remain).
    const preferred = changes.isDefault === true ? id : undefined;
    const addresses = save(session.userId, normalizeDefaults(list, preferred));
    const saved = addresses.find((a) => a.id === id) ?? updated;

    return NextResponse.json({ success: true, address: saved, addresses });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'account/addresses PATCH', 'خطا در ویرایش نشانی');
  }
}

/** DELETE /api/account/addresses?id=<id> (or body { id }). Deleting the default promotes the first remaining address. */
export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
    }

    let id = new URL(req.url).searchParams.get('id')?.trim() || '';
    if (!id) {
      const body = await req.json().catch(() => null);
      if (body && typeof body.id === 'string') id = body.id.trim();
    }
    if (!id) {
      return NextResponse.json({ success: false, message: 'شناسه نشانی الزامی است.' }, { status: 400 });
    }

    const current = ownAddresses(session.userId);
    if (!current.some((a) => a.id === id)) {
      return NextResponse.json({ success: false, message: 'نشانی مورد نظر یافت نشد.' }, { status: 404 });
    }

    const addresses = save(session.userId, normalizeDefaults(current.filter((a) => a.id !== id)));
    return NextResponse.json({ success: true, addresses });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'account/addresses DELETE', 'خطا در حذف نشانی');
  }
}
