import { NextResponse } from 'next/server';

/**
 * Intentional, user-facing business validation error (Persian message).
 * Only errors created with this class (or flagged with `businessError`) have their
 * message returned to the client. Every other exception is logged server-side and
 * replaced with a generic message, so raw `error.message` values never leak.
 */
export class BusinessError extends Error {
  readonly businessError = true;
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
  }
}

const GENERIC_MESSAGE = 'خطای داخلی سرور. لطفاً دوباره تلاش نمایید.';

export function apiErrorResponse(err: unknown, context: string, fallback = GENERIC_MESSAGE): NextResponse {
  const e = err as { businessError?: boolean; status?: number; message?: string } | null;
  if (e && e.businessError === true && typeof e.message === 'string') {
    return NextResponse.json(
      { success: false, message: e.message },
      { status: typeof e.status === 'number' ? e.status : 400 }
    );
  }
  console.error(`[API ${context}]`, err);
  return NextResponse.json({ success: false, message: fallback }, { status: 500 });
}
