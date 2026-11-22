/**
 * P7 email ownership (local dev build only, http://localhost:3000, test data only).
 *
 * An email counts only after its owner enters the 6-digit code sent to it. Covered here:
 * - a profile email stays pending until its code is entered, and pending does not reserve the address
 * - a verified address cannot be taken by another account (409), while an unverified one can
 * - a code is bound to the account that asked for it, and five wrong attempts discard it
 * - email registration needs a code; the code is single-use; email login works afterwards
 * - the account settings page and the login page work end to end (UI)
 *
 * The dev server must run with the MOCK email provider (no SMTP credentials) so the code is returned as
 * debugCode, the same way the MOCK SMS provider returns its code. Requests use per-request X-Real-IP values.
 */
import { test, expect, request, type Browser } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const COOKIE = 'profarm_session';
const PASSWORD = 'P7-pass-1234';

type Opts = {
  cookie?: string;
  body?: unknown;
  ip?: string;
  headers?: Record<string, string>;
  origin?: string | null; // null = send no Origin header
};
type Res = { status: number; text: string; json: any; headers: Record<string, string>; location: string | null };

function randomIp(): string {
  return `198.51.100.${1 + Math.floor(Math.random() * 240)}`;
}

/** One request with an empty cookie jar. The Origin header is sent unless origin === null. */
async function send(method: string, urlPath: string, o: Opts = {}): Promise<Res> {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const headers: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.origin !== null) headers['Origin'] = o.origin ?? BASE;
    if (o.cookie) headers['Cookie'] = `${COOKIE}=${o.cookie}`;
    headers['X-Real-IP'] = o.ip ?? randomIp();
    let data: string | undefined;
    if (o.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      data = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
    }
    const r = await ctx.fetch(BASE + urlPath, { method, headers, data, maxRedirects: 0, failOnStatusCode: false });
    const text = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const h = r.headers();
    return { status: r.status(), text, json, headers: h, location: h['location'] ?? null };
  } finally {
    await ctx.dispose();
  }
}

function sessionFrom(res: Res): string | null {
  const m = new RegExp(`${COOKIE}=([^;\\s,]+)`).exec(res.headers['set-cookie'] ?? '');
  return m ? m[1] : null;
}

/** Full OTP login for a test customer (the dev MOCK SMS provider returns debugCode). */
async function login(phone: string, ip: string) {
  const s = await send('POST', '/api/auth/otp', { body: { action: 'send', phone }, ip });
  expect(s.status, `OTP send for ${phone}: ${s.text}`).toBe(200);
  const code = s.json?.debugCode;
  expect(code, 'debugCode is exposed only by the dev MOCK SMS provider').toMatch(/^\d{6}$/);
  const v = await send('POST', '/api/auth/otp', { body: { action: 'verify', phone, code }, ip });
  expect(v.status, `OTP verify for ${phone}: ${v.text}`).toBe(200);
  const cookie = sessionFrom(v);
  expect(cookie).toBeTruthy();
  return { phone, ip, cookie: cookie as string, user: v.json.user };
}

/** A code that is guaranteed to differ from `real`. */
function wrongCodeFor(real: string, step = 1): string {
  return String((Number(real) + step) % 1000000).padStart(6, '0');
}

const usedPhones = new Set<string>();
/** 0912700 + 4 random digits, unique within this process. */
function freshPhone(): string {
  for (;;) {
    const p = `0912700${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    if (!usedPhones.has(p)) {
      usedPhones.add(p);
      return p;
    }
  }
}

function randomEmail(tag: string): string {
  return `p7-${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;
}

// ---------------------------------------------------------------------------
// Shared state across the serial suite (workers: 1). Playwright restarts the worker after a failing test,
// so the state lives in a JSON file (e2e/test-results/p7-state.json) and S is a proxy over that file.
// ---------------------------------------------------------------------------
const STATE_FILE = path.join(__dirname, 'test-results', 'p7-state.json');
type Account = Awaited<ReturnType<typeof login>>;
type State = {
  A?: Account;
  B?: Account;
  C?: Account;
  xEmail?: string; // verified by B
  zEmail?: string; // A's pending address in the wrong-code test
  wEmail?: string; // code-binding test
  regEmail?: string; // email registration (API)
  regCookie?: string;
  uiEmail?: string; // account settings UI
  loginUiEmail?: string; // email registration through the login page
};
function readState(): State {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as State;
  } catch {
    return {};
  }
}
function writeState(s: State): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s));
}
const S = new Proxy({} as State, {
  get: (_t, k: string) => readState()[k as keyof State],
  set: (_t, k: string, v) => {
    const s = readState();
    (s as any)[k] = v;
    writeState(s);
    return true;
  },
}) as State;

const SETTINGS_EMAIL_HEADING = 'section[aria-labelledby="acc-email-heading"]';

test.describe('P7 email ownership: local dev build', () => {
  test('setup: customers A and B log in through OTP', async () => {
    writeState({});
    S.A = await login(freshPhone(), randomIp());
    S.B = await login(freshPhone(), randomIp());
    expect(S.A!.user.role).toBe('USER');
    expect(S.B!.user.role).toBe('USER');
  });

  test('1. a new profile email is pending, not stored, and sends a code', async () => {
    S.xEmail = randomEmail('x');
    const set = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: { email: S.xEmail } });
    expect(set.status, set.text).toBe(200);
    expect(set.json.emailCodeSent).toBe(true);
    expect(set.json.debugCode, 'debugCode in the dev MOCK email mode').toMatch(/^\d{6}$/);

    const me = await send('GET', '/api/auth/me', { cookie: S.A!.cookie });
    expect(me.json.user.email ?? null, 'the address is not stored before its code is entered').toBeNull();
    expect(me.json.user.pendingEmail).toBe(S.xEmail);
    expect(me.json.user.isEmailVerified).not.toBe(true);
  });

  test('2. another account claims the same address and verifies it (A pending does not block)', async () => {
    const set = await send('POST', '/api/auth/me', { cookie: S.B!.cookie, body: { email: S.xEmail } });
    expect(set.status, `pending does not reserve the address: ${set.text}`).toBe(200);
    const v = await send('POST', '/api/auth/email/verify', { cookie: S.B!.cookie, body: { code: set.json.debugCode } });
    expect(v.status, v.text).toBe(200);

    const me = await send('GET', '/api/auth/me', { cookie: S.B!.cookie });
    expect(me.json.user.email).toBe(S.xEmail);
    expect(me.json.user.isEmailVerified).toBe(true);
    expect(me.json.user.pendingEmail ?? null).toBeNull();
  });

  test('3. the first owner cannot verify the same address now (409)', async () => {
    // B's request replaced the code that A received, so A asks again (its new code is bound to A)
    const again = await send('POST', '/api/auth/email/resend', { cookie: S.A!.cookie });
    expect(again.status, again.text).toBe(200);
    const v = await send('POST', '/api/auth/email/verify', { cookie: S.A!.cookie, body: { code: again.json.debugCode } });
    expect(v.status, v.text).toBe(409);
    expect(v.json.success).toBe(false);
    const me = await send('GET', '/api/auth/me', { cookie: S.A!.cookie });
    expect(me.json.user.email ?? null).toBeNull();
  });

  test('4. five wrong codes discard the code', async () => {
    S.zEmail = randomEmail('z');
    const set = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: { email: S.zEmail } });
    expect(set.status, set.text).toBe(200);
    const real: string = set.json.debugCode;
    expect(real).toMatch(/^\d{6}$/);

    for (let i = 1; i <= 5; i++) {
      const bad = await send('POST', '/api/auth/email/verify', {
        cookie: S.A!.cookie,
        body: { code: wrongCodeFor(real, i) },
      });
      expect(bad.status, `attempt ${i}: ${bad.text}`).toBe(400);
      if (i < 5) expect(bad.json.message).toContain('تلاش باقی‌مانده');
      else expect(bad.json.message).toContain('بیش از حد مجاز');
    }
    const late = await send('POST', '/api/auth/email/verify', { cookie: S.A!.cookie, body: { code: real } });
    expect(late.status, 'the real code no longer works after five wrong attempts').toBe(400);
    const me = await send('GET', '/api/auth/me', { cookie: S.A!.cookie });
    expect(me.json.user.pendingEmail).toBe(S.zEmail);
  });

  test('5. a code is bound to the account that requested it', async () => {
    S.wEmail = randomEmail('w');
    const a = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: { email: S.wEmail } });
    expect(a.status).toBe(200);
    // B asks for the same pending address. The code for (change, W) now belongs to B's request.
    const b = await send('POST', '/api/auth/me', { cookie: S.B!.cookie, body: { email: S.wEmail } });
    expect(b.status).toBe(200);
    // A presents B's code: it must be refused because the code is bound to B's account.
    const steal = await send('POST', '/api/auth/email/verify', { cookie: S.A!.cookie, body: { code: b.json.debugCode } });
    expect(steal.status, steal.text).toBe(400);
    expect(steal.json.message).toContain('این حساب');
  });

  test('6. email registration without a code is refused (400)', async () => {
    S.regEmail = randomEmail('reg');
    const r = await send('POST', '/api/auth/register', {
      body: { name: 'تست ثبت‌نام ایمیلی', email: S.regEmail, password: PASSWORD },
    });
    expect(r.status).toBe(400);
    expect(r.json.success).toBe(false);
    expect(r.json.message).toContain('کد');
  });

  test('7. email registration with the code creates a verified account; the code is single-use', async () => {
    const rc = await send('POST', '/api/auth/email/register-code', { body: { email: S.regEmail } });
    expect(rc.status, rc.text).toBe(200);
    const real: string = rc.json.debugCode;
    expect(real).toMatch(/^\d{6}$/);

    const wrong = await send('POST', '/api/auth/register', {
      body: { name: 'تست ثبت‌نام ایمیلی', email: S.regEmail, password: PASSWORD, emailCode: wrongCodeFor(real, 3) },
    });
    expect(wrong.status).toBe(400);

    const ok = await send('POST', '/api/auth/register', {
      body: { name: 'تست ثبت‌نام ایمیلی', email: S.regEmail, password: PASSWORD, emailCode: real },
    });
    expect(ok.status, ok.text).toBe(200);
    expect(ok.json.user.email).toBe(S.regEmail);
    expect(ok.json.user.isEmailVerified).toBe(true);
    const cookie = sessionFrom(ok);
    expect(cookie).toBeTruthy();
    S.regCookie = cookie as string;

    const reuse = await send('POST', '/api/auth/register', {
      body: { name: 'کپی', email: S.regEmail, password: PASSWORD, emailCode: real },
    });
    expect([400, 409]).toContain(reuse.status);
    expect(reuse.json.success).toBe(false);
  });

  test('8. email login works for the verified address', async () => {
    const r = await send('POST', '/api/auth/login', { body: { identifier: S.regEmail, password: PASSWORD } });
    expect(r.status, r.text).toBe(200);
    expect(r.json.user.email).toBe(S.regEmail);
  });

  test('9. the code request for an address a verified account holds answers like a fresh one, but sends nothing', async () => {
    // Enumeration: the answer is the same 200 as for a free address, and no code is issued or reserved
    const rc = await send('POST', '/api/auth/email/register-code', { body: { email: S.xEmail } });
    expect(rc.status).toBe(200);
    expect(rc.json.success).toBe(true);
    expect(rc.json.debugCode, 'no code is issued for a taken address').toBeUndefined();
    // Registration with that address still fails: there is no valid code for it
    const reg = await send('POST', '/api/auth/register', {
      body: { name: 'تست آدرس تصاحب‌شده', email: S.xEmail, password: PASSWORD, emailCode: '123456' },
    });
    expect(reg.status).toBeGreaterThanOrEqual(400);
    expect(reg.json.success).toBe(false);
  });

  test('10. removing the email needs no code and clears the pending address', async () => {
    const r = await send('POST', '/api/auth/me', { cookie: S.B!.cookie, body: { email: '' } });
    expect(r.status, r.text).toBe(200);
    const me = await send('GET', '/api/auth/me', { cookie: S.B!.cookie });
    expect(me.json.user.email ?? null).toBeNull();
    expect(me.json.user.isEmailVerified).not.toBe(true);
    expect(me.json.user.pendingEmail ?? null).toBeNull();
  });

  // -------------------------------------------------------------------------
  // UI: account settings
  // -------------------------------------------------------------------------
  test('11. account settings: send code, see the pending badge, enter the code, see the verified badge', async ({ browser }: { browser: Browser }) => {
    const c = await login(freshPhone(), randomIp());
    S.C = c;
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Real-IP': randomIp() } });
    try {
      await ctx.addCookies([{ name: COOKIE, value: c.cookie, url: BASE }]);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/account?tab=settings`, { waitUntil: 'domcontentloaded' });
      const section = page.locator(SETTINGS_EMAIL_HEADING);
      await expect(section.getByLabel('افزودن ایمیل')).toBeVisible({ timeout: 30000 });

      // Phone-sized layout has no horizontal scroll
      await page.setViewportSize({ width: 375, height: 812 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'no horizontal page scroll at 375px').toBeLessThanOrEqual(0);
      await page.setViewportSize({ width: 1280, height: 800 });

      S.uiEmail = randomEmail('ui');
      await section.getByLabel('افزودن ایمیل').fill(S.uiEmail);
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/auth/me') && r.request().method() === 'POST'),
        section.getByRole('button', { name: 'ارسال کد تایید' }).click(),
      ]);
      const body = await resp.json();
      expect(body.emailCodeSent).toBe(true);
      await expect(section.getByText('کد تایید به ایمیل جدید ارسال شد.')).toBeVisible();
      await expect(section.getByText('در انتظار تایید', { exact: true })).toBeVisible();
      await expect(section.getByText(S.uiEmail!)).toBeVisible();
      await expect(section.getByRole('button', { name: /ارسال مجدد/ })).toBeDisabled();

      const codeInput = section.getByLabel('کد تایید ۶ رقمی ارسال‌شده به ایمیل جدید');
      await expect(codeInput).toBeVisible();
      await codeInput.fill(body.debugCode);
      await section.getByRole('button', { name: 'تایید', exact: true }).click();

      await expect(section.getByText('تایید شده', { exact: false }).first()).toBeVisible({ timeout: 15000 });
      await expect(section.getByText('در انتظار تایید', { exact: true })).toHaveCount(0);
      await expect(section.getByText(S.uiEmail!)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  // -------------------------------------------------------------------------
  // UI: login page email registration (code step, then password)
  // -------------------------------------------------------------------------
  test('12. login page: email registration asks for a code first, then creates the account', async ({ browser }: { browser: Browser }) => {
    S.loginUiEmail = randomEmail('login-ui');
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Real-IP': randomIp() } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login?mode=register`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'با کلمه عبور', exact: true }).click();
      await page.locator('#login-name-2').fill('ثبت نام ایمیلی');
      await page.locator('#login-email').fill(S.loginUiEmail!);
      await expect(page.locator('#login-password'), 'the password is asked only after the code step').toHaveCount(0);

      const [codeResp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/auth/email/register-code') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'دریافت کد تایید ایمیل' }).click(),
      ]);
      const codeBody = await codeResp.json();
      expect(codeBody.success).toBe(true);
      await expect(page.locator('#login-email-code')).toBeVisible();
      await expect(page.locator('#login-email')).toHaveAttribute('readonly', '');

      await page.locator('#login-email-code').fill(codeBody.debugCode);
      await page.locator('#login-password').fill(PASSWORD);
      await page.getByRole('button', { name: 'ثبت‌نام و ایجاد حساب کاربری' }).click();
      await page.waitForURL(/\/account/, { timeout: 30000 });

      const cookies = await ctx.cookies();
      const session = cookies.find((c) => c.name === COOKIE)?.value;
      expect(session, 'session cookie set by registration').toBeTruthy();
      const me = await send('GET', '/api/auth/me', { cookie: session });
      expect(me.json.user.email).toBe(S.loginUiEmail);
      expect(me.json.user.isEmailVerified).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test('13. login page: the verified email and password sign in', async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Real-IP': randomIp() } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'با کلمه عبور', exact: true }).click();
      await page.locator('#login-identifier').fill(S.loginUiEmail!);
      await page.locator('#login-password').fill(PASSWORD);
      await page.getByRole('button', { name: 'ورود به حساب کاربری' }).click();
      await page.waitForURL(/\/account/, { timeout: 30000 });
    } finally {
      await ctx.close();
    }
  });
});
