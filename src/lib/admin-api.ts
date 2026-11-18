/**
 * Small shared helpers for the admin route handlers (src/app/api/admin/**).
 * Every handler still calls requireAdmin(req) first; these helpers only shape requests and responses.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toEnglishDigits } from './formatters';

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

export function jsonOk(body: Record<string, unknown> = {}, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...body }, { status });
}

/** The JSON body as a plain object, or null when the body is missing, not JSON, or an array. */
export async function readObjectBody(req: Request): Promise<Record<string, unknown> | null> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

/** Persian, field-named message for the first validation issue. */
export function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue.path.join('.');
  return field ? `فیلد «${field}»: ${issue.message}` : issue.message;
}

/** Parses a value with a zod schema. On failure returns a ready 400 response instead of throwing. */
export function parseWith<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown
): { data: z.output<T> } | { response: NextResponse } {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { response: jsonError(400, zodMessage(parsed.error)) };
  }
  return { data: parsed.data };
}

/** Numbers from JSON numbers or numeric strings (Persian digits accepted). Empty string counts as missing. */
export function normalizeNumeric(value: unknown): unknown {
  if (typeof value === 'string') {
    const english = toEnglishDigits(value.trim());
    if (english === '') return undefined;
    return Number(english);
  }
  return value;
}

/** Integer in [min, max] (numbers or numeric strings). */
export function intField(min: number, max: number, label = 'عدد') {
  return z.preprocess(
    normalizeNumeric,
    z
      .number({ error: (iss) => (iss.code === 'invalid_type' ? (iss.input === undefined ? 'الزامی است' : `${label} باید عدد باشد`) : undefined) })
      .int(`${label} باید عدد صحیح باشد`)
      .min(min, `${label} نمی‌تواند کمتر از ${min} باشد`)
      .max(max, `${label} نمی‌تواند بیشتر از ${max} باشد`)
  );
}

/** Non-empty trimmed string with a length cap. */
export function textField(max: number, label = 'متن') {
  return z
    .string({ error: (iss) => (iss.code === 'invalid_type' ? (iss.input === undefined ? 'الزامی است' : `${label} باید متن باشد`) : undefined) })
    .trim()
    .min(1, `${label} نمی‌تواند خالی باشد`)
    .max(max, `${label} نمی‌تواند بیشتر از ${max} نویسه باشد`);
}

export function pageParams(
  searchParams: URLSearchParams,
  defaults: { pageSize: number; maxPageSize: number }
): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const requested = Math.floor(Number(searchParams.get('pageSize')) || defaults.pageSize);
  const pageSize = Math.min(defaults.maxPageSize, Math.max(1, requested));
  return { page, pageSize };
}

export function paginate<T>(list: T[], page: number, pageSize: number) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  return {
    items: list.slice((current - 1) * pageSize, current * pageSize),
    pagination: { page: current, pageSize, total, totalPages },
  };
}

/** A civil date written YYYY-MM-DD that exists (no 2026-02-30). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
