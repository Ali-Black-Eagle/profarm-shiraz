'use client';

/**
 * Client-side plumbing for the admin panel. Every admin screen reads and writes through the server APIs
 * under /api/admin/** (and the few shared endpoints they use). Nothing here touches browser storage for data.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type AdminResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; message: string; status: number; data?: Record<string, unknown> };

const FALLBACK_BY_STATUS: Record<number, string> = {
  401: 'نشست مدیریت شما پایان یافته است. دوباره وارد شوید.',
  403: 'دسترسی شما برای این عملیات مجاز نیست.',
  404: 'مورد درخواستی یافت نشد.',
  409: 'تداخل در اطلاعات. صفحه را بروزرسانی کنید.',
  429: 'درخواست‌های زیادی ارسال شده است. کمی بعد دوباره تلاش کنید.',
};

export const NETWORK_ERROR_MESSAGE = 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';

/** JSON request to a same-origin admin endpoint. Never throws. */
export async function adminRequest<T = Record<string, unknown>>(
  url: string,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {}
): Promise<AdminResult<T>> {
  try {
    const hasBody = init.body !== undefined;
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
    });
    let json: Record<string, unknown> | null = null;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      json = null;
    }
    if (res.ok && json && json.success !== false) {
      return { ok: true, data: json as T, status: res.status };
    }
    const serverMessage = json && typeof json.message === 'string' ? json.message : '';
    return {
      ok: false,
      status: res.status,
      message: serverMessage || FALLBACK_BY_STATUS[res.status] || 'خطا در انجام عملیات. دوباره تلاش کنید.',
      data: json ?? undefined,
    };
  } catch {
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }
}

/** Builds a query string from defined, non-empty values. */
export function adminQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export interface AdminFetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Reloads the resource. Keeps the current data on screen until the new response arrives. */
  reload: () => Promise<void>;
  /** Local-only update, used after a server call succeeded or for a rollback. */
  setData: (updater: (prev: T | null) => T | null) => void;
}

/** Loads one admin resource. A stale response (after the url changed) is ignored. */
export function useAdminFetch<T>(url: string | null): AdminFetchState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    const id = ++requestSeq.current;
    setLoading(true);
    setError(null);
    const result = await adminRequest<T>(url);
    if (id !== requestSeq.current) return;
    if (result.ok) {
      setDataState(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  const setData = useCallback((updater: (prev: T | null) => T | null) => {
    setDataState((prev) => updater(prev));
  }, []);

  return { data, error, loading, reload: load, setData };
}

/** Pagination meta returned by the list endpoints. */
export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Previous / next controls for paginated lists. */
export function AdminPager({
  pagination,
  onPage,
  disabled,
}: {
  pagination: AdminPagination | null | undefined;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  const fa = (n: number) => n.toLocaleString('fa-IR');
  return (
    <nav aria-label="صفحه‌بندی" className="flex items-center justify-between gap-3 pt-3 text-xs font-bold text-gray-600">
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)}
        className="min-h-[44px] px-4 rounded-xl border border-farm-border bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        صفحه قبل
      </button>
      <span>
        صفحه {fa(page)} از {fa(totalPages)} ({fa(total)} مورد)
      </span>
      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="min-h-[44px] px-4 rounded-xl border border-farm-border bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        صفحه بعد
      </button>
    </nav>
  );
}

/** Loading, error (with retry) and empty states in one block. */
export function AdminStatus({
  loading,
  error,
  onRetry,
  isEmpty,
  emptyText = 'موردی برای نمایش وجود ندارد.',
  hasData,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyText?: string;
  hasData: boolean;
}) {
  if (!hasData && loading) {
    return (
      <div role="status" className="py-10 text-center text-xs font-bold text-gray-500">
        در حال بارگذاری...
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <span>{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] px-4 rounded-xl bg-rose-700 text-white cursor-pointer self-start sm:self-auto"
          >
            تلاش دوباره
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return <div className="py-10 text-center text-xs font-bold text-gray-500">{emptyText}</div>;
  }
  return null;
}

/** Cell value for CSV. Text that starts with a spreadsheet formula trigger is neutralised. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV text with a UTF-8 byte order mark (so Excel shows Persian correctly), CRLF line endings
 * and RFC 4180 quoting ("" inside quoted fields).
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Saves CSV text through a Blob download. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tehran calendar date (YYYY-MM-DD) for a Date. */
export function tehranIsoDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
