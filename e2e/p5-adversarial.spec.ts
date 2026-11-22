/**
 * P5 adversarial tests (local development build only, http://localhost:3000, test data only).
 *
 * Each test asserts the SAFE behaviour. A real vulnerability therefore makes the test fail, and
 * the failure is documented in e2e/reports/p5-adversarial.md. Tests never touch the real admin
 * account (09170000000) and never send wrong passwords for it. Test customers use 0912500XXXX numbers.
 *
 * Requests go through Playwright's APIRequestContext. Every call uses a fresh context, so the cookie
 * jar stays empty and the Cookie header is exactly what the test sends. Per-request X-Real-IP (the app reads only X-Real-IP, set by nginx; X-Forwarded-For is never trusted)
 * values are random (dev trusts X-Real-IP), except the brute-force tests, which use fixed IPs.
 */
import { test, expect, request, type Browser } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const PRODUCT_SLUG = 'organic-eggs-kamfiruz-30';
const COOKIE = 'profarm_session';

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
async function send(method: string, path: string, o: Opts = {}): Promise<Res> {
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
    const r = await ctx.fetch(BASE + path, { method, headers, data, maxRedirects: 0, failOnStatusCode: false });
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

/** Full OTP login for a test customer. Relies on the dev MOCK SMS provider returning debugCode. */
async function login(phone: string, ip: string) {
  const s = await send('POST', '/api/auth/otp', { body: { action: 'send', phone }, ip });
  expect(s.status, `OTP send for ${phone}: ${s.text}`).toBe(200);
  const code = s.json?.debugCode;
  expect(code, 'debugCode is exposed only by the dev MOCK SMS provider').toMatch(/^\d{6}$/);
  const v = await send('POST', '/api/auth/otp', { body: { action: 'verify', phone, code }, ip });
  expect(v.status, `OTP verify for ${phone}: ${v.text}`).toBe(200);
  const cookie = sessionFrom(v);
  expect(cookie).toBeTruthy();
  return { phone, ip, cookie: cookie as string, user: v.json.user, proof: v.json.phoneProof as string, code };
}

async function pickSlot(allowed: boolean, cookie?: string) {
  const s = await send('GET', '/api/delivery-slots?days=14', { cookie });
  expect(s.status).toBe(200);
  const slots: any[] = s.json.slots;
  const slot = slots.find((x) =>
    allowed ? x.isAllowedForTier === true && x.isAvailable === true && !x.isFull && !x.isClosed : x.isAllowedForTier === false && !x.isClosed
  );
  expect(slot, allowed ? 'an allowed open slot exists' : 'a tier-restricted slot exists').toBeTruthy();
  return slot.id as string;
}

function orderBody(phone: string, slotId: string | null, extra: Record<string, unknown> = {}) {
  return {
    recipientName: 'تست امنیتی',
    phone,
    province: 'فارس',
    city: 'شیراز',
    streetAddress: 'خیابان تست ۱۲ - داده آزمایشی',
    postalCode: '7131111111',
    deliverySlot: slotId,
    items: [{ productId: PRODUCT_SLUG, quantity: 1 }],
    paymentMethod: 'zarinpal',
    ...extra,
  };
}

const LEAK_PATTERN = /node_modules|\bat\s+\S+\s+\(|\.tsx?:\d+|Error:\s|stack trace|ECONNREFUSED|PrismaClient/i;

// ---------------------------------------------------------------------------
// Shared state across the serial suite (workers: 1)
// ---------------------------------------------------------------------------
// Playwright restarts the worker after a failing test, which drops module memory. The state therefore lives in a
// JSON file (e2e/test-results/p5-state.json). S is a proxy over that file, so tests read and write it like an object.
const STATE_FILE = path.join(__dirname, 'test-results', 'p5-state.json');
type State = {
  A?: Awaited<ReturnType<typeof login>>;
  B?: Awaited<ReturnType<typeof login>>;
  C?: Awaited<ReturnType<typeof login>>;
  order1?: any; // A's first order (T1.1)
  order1Authority?: string | null;
  orderB?: any;
  orderBAuthority?: string | null;
  mock?: boolean;
  aAddressId?: string;
  aEmail?: string;
  phones?: string[];
};
function readState(): State {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as State;
  } catch {
    return { mock: false, phones: [] };
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

const usedPhones = new Set<string>();
/** 0912500 + 4 random digits, unique within this process. Random suffix keeps reruns clear of stored accounts. */
function freshPhone(_n?: number): string {
  for (;;) {
    const p = `0912500${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    if (!usedPhones.has(p)) {
      usedPhones.add(p);
      return p;
    }
  }
}

// Plain describe (not serial): one worker runs tests in file order and keeps going after a failure, so each
// real finding is recorded without skipping the rest of the suite. Later tests depend on setup state.
test.describe('P5 adversarial: local dev build', () => {
  test('setup: customers A, B, C log in through OTP', async () => {
    const pa = freshPhone();
    const pb = freshPhone();
    const pc = freshPhone();
    writeState({ mock: false, phones: [pa, pb, pc] });
    S.A = await login(pa, randomIp());
    S.B = await login(pb, randomIp());
    S.C = await login(pc, randomIp());
    expect(S.A!.user.role).toBe('USER');
    expect(S.B!.user.role).toBe('USER');
  });

  // -------------------------------------------------------------------------
  // 1. Price tampering
  // -------------------------------------------------------------------------
  test('1.1 server ignores client price, total, discount and Shiraz flags', async () => {
    const slot = await pickSlot(true, S.A!.cookie);
    const body = orderBody(S.A!.phone, slot, {
      unitPrice: 1,
      total: 1,
      totalAmount: 1,
      price: 1,
      discountAmount: 999999999,
      isShiraz: true,
      isBulkOrder: true,
      items: [{ productId: PRODUCT_SLUG, quantity: 1, unitPrice: 1, totalPrice: 1, discountAmount: 999999 }],
    });
    const quote = await send('POST', '/api/orders/quote', {
      cookie: S.A!.cookie,
      body: { items: [{ productId: PRODUCT_SLUG, quantity: 1 }], city: 'شیراز', province: 'فارس', slotId: slot },
    });
    expect(quote.status).toBe(200);
    const serverTotal = (quote.json.quote ?? quote.json).total;

    const r = await send('POST', '/api/orders', { cookie: S.A!.cookie, body });
    expect(r.status, r.text).toBe(200);
    expect(r.json.order.totalAmount).toBe(serverTotal);
    expect(r.json.order.items[0].unitPrice).toBeGreaterThan(1);
    expect(serverTotal).toBeGreaterThan(1000);
    S.order1 = r.json.order;
    S.order1Authority = r.json.authority ?? null;
    S.mock = typeof r.json.authority === 'string' && r.json.authority.startsWith('MOCK-');
  });

  test('1.2 invalid quantities are rejected (quote endpoint, no order created)', async () => {
    const bad: unknown[] = [-1, 0, 1.5, 1e9, 1001, 'abc', null, '', 'NaN'];
    const accepted: unknown[] = [];
    for (const q of bad) {
      const r = await send('POST', '/api/orders/quote', {
        cookie: S.A!.cookie,
        body: { items: [{ productId: PRODUCT_SLUG, quantity: q }], city: 'شیراز', province: 'فارس' },
      });
      const ok = r.status === 200 && (r.json.quote ?? r.json).ok === true;
      if (ok) accepted.push(q);
    }
    expect(accepted, 'quantities accepted by quote').toEqual([]);
  });

  test('1.3 quantity type coercion: numeric string and boolean are not accepted as integers', async () => {
    // Number("2") and Number(true) pass through quoteCart's Number() coercion (pricing.ts). Recorded as Low.
    const coerced: unknown[] = [];
    for (const q of ['2', true]) {
      const r = await send('POST', '/api/orders/quote', {
        cookie: S.A!.cookie,
        body: { items: [{ productId: PRODUCT_SLUG, quantity: q }], city: 'شیراز', province: 'فارس' },
      });
      if (r.status === 200 && (r.json.quote ?? r.json).ok === true) coerced.push(q);
    }
    expect(coerced, 'non-number quantity types accepted').toEqual([]);
  });

  test('1.4 nonexistent productId is rejected at order creation', async () => {
    const slot = await pickSlot(true, S.A!.cookie);
    const r = await send('POST', '/api/orders', {
      cookie: S.A!.cookie,
      body: orderBody(S.A!.phone, slot, { items: [{ productId: 'no-such-product-xyz', quantity: 1 }] }),
    });
    expect(r.status).toBe(400);
    expect(r.json.success).toBe(false);
  });

  test('1.5 isShiraz:true does not override a non-Shiraz city', async () => {
    const slot = await pickSlot(true, S.A!.cookie);
    const r = await send('POST', '/api/orders', {
      cookie: S.A!.cookie,
      body: orderBody(S.A!.phone, slot, { city: 'اصفهان', province: 'اصفهان', isShiraz: true }),
    });
    expect(r.status, 'non-Shiraz, non-bulk order must be refused').toBe(400);
  });

  test('1.6 PRO-only slot day is refused for a FREE user', async () => {
    const slot = await pickSlot(false, S.A!.cookie);
    const r = await send('POST', '/api/orders', { cookie: S.A!.cookie, body: orderBody(S.A!.phone, slot) });
    expect(r.status).toBe(400);
    expect(r.json.success).toBe(false);
  });

  test('1.7 past slot id is refused', async () => {
    const r = await send('POST', '/api/orders', {
      cookie: S.A!.cookie,
      body: orderBody(S.A!.phone, '2020-01-05_15-21'),
    });
    expect(r.status).toBe(400);
  });

  test('1.8 malformed slot ids are refused', async () => {
    for (const slot of ['not-a-slot', '2026-13-45_15-21', "2026-11-22_15-21'--"]) {
      const r = await send('POST', '/api/orders', { cookie: S.A!.cookie, body: orderBody(S.A!.phone, slot) });
      expect(r.status, `slot ${slot}`).toBe(400);
    }
  });

  test('1.9 subscriptionPlan ULTRA is refused', async () => {
    const r = await send('POST', '/api/orders', {
      cookie: S.C!.cookie,
      body: { isSubscription: true, subscriptionPlan: 'ULTRA', paymentMethod: 'zarinpal' },
    });
    expect(r.status).toBe(400);
  });

  test('1.10 coupon on a subscription purchase is refused', async () => {
    const r = await send('POST', '/api/orders', {
      cookie: S.C!.cookie,
      body: { isSubscription: true, subscriptionPlan: 'PLUS', paymentMethod: 'zarinpal', appliedCouponCode: 'ANYCODE' },
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.json)).toContain('اشتراک');
  });

  // -------------------------------------------------------------------------
  // 2. IDOR
  // -------------------------------------------------------------------------
  test('2.1 user B cannot read user A order by orderNumber or in the list', async () => {
    expect(S.order1, 'order from 1.1 exists').toBeTruthy();
    const num = S.order1.orderNumber;
    const one = await send('GET', `/api/orders?orderNumber=${encodeURIComponent(num)}`, { cookie: S.B!.cookie });
    expect(one.status).toBe(404);
    expect(one.text).not.toContain(num);
    const byId = await send('GET', `/api/orders?orderNumber=${encodeURIComponent(S.order1.id)}`, { cookie: S.B!.cookie });
    expect(byId.status).toBe(404);
    const list = await send('GET', '/api/orders', { cookie: S.B!.cookie });
    expect(list.status).toBe(200);
    expect(list.text).not.toContain(num);
  });

  test('2.2 user B cannot retry payment on A order', async () => {
    const r = await send('POST', `/api/orders/${encodeURIComponent(S.order1.id)}/retry-payment`, { cookie: S.B!.cookie, body: {} });
    expect(r.status).toBe(404);
    expect(r.text).not.toContain('authority');
  });

  test('2.3 user B cannot open a return request for A order', async () => {
    const r = await send('POST', '/api/returns', {
      cookie: S.B!.cookie,
      body: { orderNumber: S.order1.orderNumber, productId: PRODUCT_SLUG, quantity: 1, reason: 'DAMAGED', description: 'x' },
    });
    expect([400, 404]).toContain(r.status);
    expect(r.json?.success).not.toBe(true);
  });

  test('2.4 user B cannot PATCH or DELETE an address of A', async () => {
    const add = await send('POST', '/api/account/addresses', {
      cookie: S.A!.cookie,
      body: {
        recipientName: 'آدرس تست',
        phone: S.A!.phone,
        province: 'فارس',
        city: 'شیراز',
        postalCode: '7131111111',
        streetAddress: 'خیابان داده آزمایشی ۵',
      },
    });
    expect(add.status).toBe(201);
    S.aAddressId = add.json.address.id;

    const patch = await send('PATCH', '/api/account/addresses', {
      cookie: S.B!.cookie,
      body: { id: S.aAddressId, city: 'تهران', province: 'تهران' },
    });
    expect(patch.status).toBe(404);
    const del = await send('DELETE', `/api/account/addresses?id=${encodeURIComponent(S.aAddressId!)}`, { cookie: S.B!.cookie });
    expect(del.status).toBe(404);

    const still = await send('GET', '/api/account/addresses', { cookie: S.A!.cookie });
    expect(still.json.addresses.find((a: any) => a.id === S.aAddressId)?.city).toBe('شیراز');
  });

  // -------------------------------------------------------------------------
  // 3. Auth
  // -------------------------------------------------------------------------
  test('3.1 OTP verify brute force: lockout after repeated wrong codes; real code blocked too', async () => {
    const phone = freshPhone();
    const ip = randomIp(); // one fixed IP for the whole burst; random per run so old windows do not matter
    const s = await send('POST', '/api/auth/otp', { body: { action: 'send', phone }, ip });
    expect(s.status).toBe(200);
    const real: string = s.json.debugCode;
    let success = 0;
    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const guess = String((Number(real) + 1 + i) % 1000000).padStart(6, '0');
      const v = await send('POST', '/api/auth/otp', { body: { action: 'verify', phone, code: guess }, ip });
      if (v.status === 200) success++;
      if (v.status === 429) saw429 = true;
    }
    expect(success).toBe(0);
    expect(saw429, 'per-phone verify limit (10 per 15 min) must trigger').toBe(true);
    const finalTry = await send('POST', '/api/auth/otp', { body: { action: 'verify', phone, code: real }, ip });
    expect(finalTry.status, 'real code must not work after lockout').not.toBe(200);
  });

  test('3.2 OTP send ignores a body-supplied fallbackEmail', async () => {
    const phone = freshPhone(5);
    const r = await send('POST', '/api/auth/otp', {
      body: { action: 'send', phone, fallbackEmail: 'p5-attacker@example.com', email: 'p5-attacker@example.com' },
      ip: '198.51.100.31',
    });
    expect(r.status).toBe(200);
    expect(r.text).not.toContain('p5-attacker');
    // Static check: the route reads only the account email (getUserByPhone(...).email); the body is never used.
  });

  test('3.3 register with phone but without phoneProof is refused', async () => {
    const r = await send('POST', '/api/auth/register', {
      body: { name: 'تست بدون تایید', email: 'p5-noproof@example.com', phone: freshPhone(6), password: 'Passw0rd-test' },
    });
    expect(r.status).toBe(400);
    expect(r.json.success).toBe(false);
  });

  test('3.4 register with a forged phoneProof is refused', async () => {
    const r = await send('POST', '/api/auth/register', {
      body: {
        name: 'تست جعل',
        email: 'p5-forged@example.com',
        phone: freshPhone(7),
        password: 'Passw0rd-test',
        phoneProof: 'pp.eyJwaG9uZSI6IjA5MTIiLCJwdXJwb3NlIjoicGhvbmUtcHJvb2YiLCJleHAiOjk5OTk5OTk5OTl9.AAAA',
      },
    });
    expect(r.status).toBe(400);
  });

  test("3.5 A's phoneProof cannot register a different phone (proof is bound to the phone)", async () => {
    const r = await send('POST', '/api/auth/register', {
      body: {
        name: 'تست پروف',
        email: 'p5-bind@example.com',
        phone: S.B!.phone,
        password: 'Passw0rd-test',
        phoneProof: S.A!.proof,
      },
    });
    expect(r.status).toBe(400);
  });

  test('3.6 mass assignment on profile: role, tier, phone and verification fields are ignored', async () => {
    const r = await send('POST', '/api/auth/me', {
      cookie: S.A!.cookie,
      body: {
        name: 'تست نام',
        role: 'ADMIN',
        tier: 'PRO',
        subscriptionTier: 'PRO',
        isProMember: true,
        isPhoneVerified: true,
        isEmailVerified: true,
        phone: '09120000001',
        userId: 'usr-someone-else',
        proExpiresAt: '2099-01-01T00:00:00.000Z',
      },
    });
    expect(r.status).toBe(200);
    const me = await send('GET', '/api/auth/me', { cookie: S.A!.cookie });
    expect(me.json.user.role).toBe('USER');
    expect(me.json.user.phone).toBe(S.A!.phone);
    expect(me.json.user.tier).not.toBe('PRO');
    expect(me.json.user.isProMember).toBe(false);
    expect(me.json.user.id).toBe(S.A!.user.id);
  });

  test('3.7 email is unique: B cannot take the email of A once A has verified it', async () => {
    S.aEmail = `p5-a-${Math.floor(Math.random() * 1e9)}@example.com`;
    // A's address is only pending until its code is entered (P7 email ownership)
    const set = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: { email: S.aEmail } });
    expect(set.status).toBe(200);
    const verify = await send('POST', '/api/auth/email/verify', { cookie: S.A!.cookie, body: { code: set.json.debugCode } });
    expect(verify.status).toBe(200);
    const steal = await send('POST', '/api/auth/me', { cookie: S.B!.cookie, body: { email: S.aEmail } });
    expect(steal.status).toBe(409);
  });

  test('3.8 register with the email of A (second account) is refused', async () => {
    const pg = freshPhone(8);
    const l = await login(pg, '198.51.100.41');
    const r = await send('POST', '/api/auth/register', {
      body: { name: 'تست ایمیل', email: S.aEmail, phone: pg, password: 'Passw0rd-test', phoneProof: l.proof },
    });
    expect([400, 409]).toContain(r.status);
    expect(r.json.success).toBe(false);
    // Without a code the account is not created; a code request for the verified address answers like a fresh
    // address (200) but issues no code, so nothing is reserved and no enumeration is possible
    const rc = await send('POST', '/api/auth/email/register-code', { body: { email: S.aEmail } });
    expect(rc.status).toBe(200);
    expect(rc.json.debugCode, 'no code is issued for a taken address').toBeUndefined();
  });

  test('3.9 password change needs currentPassword once a password exists', async () => {
    const set = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: { password: 'Initial-Pass-1' } });
    expect(set.status, 'first password set (no current password yet) is allowed').toBe(200);
    // A password change bumps the session version: the old cookie must stop working, and the response re-issues one.
    const oldCookie = S.A!.cookie;
    const fresh = sessionFrom(set);
    expect(fresh, 'password change re-issues the session cookie').toBeTruthy();
    const stale = await send('GET', '/api/auth/me', { cookie: oldCookie });
    expect(stale.status, 'cookie issued before the password change is rejected').toBe(401);
    // S persists to a file on top-level assignment only, so replace A as a whole.
    S.A = { ...S.A!, cookie: fresh as string };
    const noCur = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: { password: 'Changed-Pass-2' } });
    expect(noCur.status).toBe(403);
    const wrongCur = await send('POST', '/api/auth/me', {
      cookie: S.A!.cookie,
      body: { password: 'Changed-Pass-2', currentPassword: 'Wrong-Pass-9' },
    });
    expect(wrongCur.status).toBe(403);
  });

  test('3.10 tampered session cookie (role ADMIN in payload) is rejected', async () => {
    const [h, p, sig] = S.A!.cookie.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    const forged = Buffer.from(JSON.stringify({ ...payload, role: 'ADMIN' })).toString('base64url');
    const tampered = `${h}.${forged}.${sig}`;
    const admin = await send('GET', '/api/admin', { cookie: tampered });
    expect([401, 403]).toContain(admin.status);
    const me = await send('GET', '/api/auth/me', { cookie: tampered });
    expect(me.status).toBe(401);
  });

  test('3.11 alg:none token is rejected', async () => {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const payload = JSON.parse(Buffer.from(S.A!.cookie.split('.')[1], 'base64url').toString('utf8'));
    const none = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ ...payload, role: 'ADMIN' })}.`;
    const r = await send('GET', '/api/admin', { cookie: none });
    expect([401, 403]).toContain(r.status);
  });

  test('3.12 old session cookie is revoked after logout', async () => {
    const again = await login(S.phones![0], '198.51.100.51');
    const before = await send('GET', '/api/auth/me', { cookie: again.cookie });
    expect(before.status).toBe(200);
    const out = await send('POST', '/api/auth/logout', { cookie: again.cookie });
    expect(out.status).toBe(200);
    const after = await send('GET', '/api/auth/me', { cookie: again.cookie });
    expect(after.status, 'revoked cookie must no longer authenticate').toBe(401);
  });

  // -------------------------------------------------------------------------
  // 4. Payment
  // -------------------------------------------------------------------------
  test('4.1 forged MOCK authority with Status=OK does not pay the order', async () => {
    const o = S.order1;
    const fake = `MOCK-${o.orderNumber}-1700000000000-${'0'.repeat(64)}`;
    const r = await send('GET', `/api/payment/verify?orderNumber=${encodeURIComponent(o.orderNumber)}&Authority=${encodeURIComponent(fake)}&Status=OK&amount=1`, {
      origin: null,
    });
    expect(r.status).toBe(307);
    expect(r.location).toContain('error=invalid_payment_authority');
    const st = await send('GET', `/api/orders?orderNumber=${encodeURIComponent(o.orderNumber)}`, { cookie: S.A!.cookie });
    expect(st.json.order.status).toBe('PENDING_PAYMENT');
  });

  test('4.2 tampered HMAC on the real authority is rejected', async () => {
    test.skip(!S.mock || !S.order1Authority, 'needs the dev mock gateway (PAYMENT_MOCK_GATEWAY=1)');
    const a = S.order1Authority!;
    const flipped = a.slice(0, -1) + (a.endsWith('0') ? '1' : '0');
    const r = await send('GET', `/api/payment/verify?orderNumber=${encodeURIComponent(S.order1.orderNumber)}&Authority=${encodeURIComponent(flipped)}&Status=OK`, { origin: null });
    expect(r.location).toContain('error=invalid_payment_authority');
  });

  test('4.3 mockSuccess=true query parameter has no effect', async () => {
    const o = S.order1;
    const fake = `MOCK-${o.orderNumber}-1700000000001-${'a'.repeat(64)}`;
    const r = await send('GET', `/api/payment/verify?orderNumber=${encodeURIComponent(o.orderNumber)}&Authority=${encodeURIComponent(fake)}&Status=OK&mockSuccess=true`, { origin: null });
    expect(r.location ?? '').not.toContain('/checkout/success');
    expect(r.location).toContain('error=invalid_payment_authority');
  });

  test('4.4 authority of order A used with order B is rejected (cross-order)', async () => {
    test.skip(!S.mock || !S.order1Authority, 'needs the dev mock gateway');
    const b = await send('POST', '/api/orders', { cookie: S.B!.cookie, body: orderBody(S.B!.phone, await pickSlot(true, S.B!.cookie)) });
    expect(b.status, b.text).toBe(200);
    const r = await send('GET', `/api/payment/verify?orderNumber=${encodeURIComponent(b.json.order.orderNumber)}&Authority=${encodeURIComponent(S.order1Authority!)}&Status=OK`, { origin: null });
    expect(r.location).toContain('error=invalid_payment_authority');
    const st = await send('GET', `/api/orders?orderNumber=${encodeURIComponent(b.json.order.orderNumber)}`, { cookie: S.B!.cookie });
    expect(st.json.order.status).toBe('PENDING_PAYMENT');
    S.B = { ...S.B!, user: S.B!.user };
    (S as any).orderB = b.json.order;
    (S as any).orderBAuthority = b.json.authority;
  });

  test('4.5 legitimate callback pays once; replay does not change the order again', async () => {
    test.skip(!S.mock || !S.order1Authority, 'needs the dev mock gateway');
    const o = S.order1;
    const url = `/api/payment/verify?orderNumber=${encodeURIComponent(o.orderNumber)}&Authority=${encodeURIComponent(S.order1Authority!)}&Status=OK`;
    const first = await send('GET', url, { origin: null });
    expect(first.location).toContain('/checkout/success');
    const second = await send('GET', url, { origin: null });
    expect(second.location).toContain('/checkout/success');
    const st = await send('GET', `/api/orders?orderNumber=${encodeURIComponent(o.orderNumber)}`, { cookie: S.A!.cookie });
    expect(st.json.order.status).toBe('PROCESSING');
    expect(st.json.order.totalAmount).toBe(o.totalAmount);
  });

  test('4.6 a cancelled order cannot be paid through the callback', async () => {
    test.skip(!S.mock, 'needs the dev mock gateway');
    const slot = await pickSlot(true, S.A!.cookie);
    const created = await send('POST', '/api/orders', { cookie: S.A!.cookie, body: orderBody(S.A!.phone, slot) });
    expect(created.status, created.text).toBe(200);
    const on = created.json.order.orderNumber;
    const auth = created.json.authority as string;
    const cancel = await send('GET', `/api/payment/verify?orderNumber=${encodeURIComponent(on)}&Authority=${encodeURIComponent(auth)}&Status=NOK`, { origin: null });
    expect(cancel.location).toContain('payment_cancelled_or_failed');
    const late = await send('GET', `/api/payment/verify?orderNumber=${encodeURIComponent(on)}&Authority=${encodeURIComponent(auth)}&Status=OK`, { origin: null });
    expect(late.location ?? '').not.toContain('/checkout/success');
    const st = await send('GET', `/api/orders?orderNumber=${encodeURIComponent(on)}`, { cookie: S.A!.cookie });
    expect(st.json.order.status).toBe('CANCELLED');
  });

  test('4.7 retry-payment on another owner order is 404 (no authority leak)', async () => {
    const r = await send('POST', `/api/orders/${encodeURIComponent((S as any).orderB?.id ?? 'x')}/retry-payment`, { cookie: S.A!.cookie, body: {} });
    expect(r.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // 5. Coupons
  // -------------------------------------------------------------------------
  test('5.1 coupon validation is rate limited per IP (15 per 5 min)', async () => {
    const ip = randomIp(); // one fixed IP for the whole burst
    let first429 = -1;
    for (let i = 0; i < 20; i++) {
      const r = await send('POST', '/api/coupons', {
        body: { action: 'validate', code: `NOPE${i}${Date.now()}`, items: [{ productId: PRODUCT_SLUG, quantity: 1 }] },
        ip,
      });
      if (r.status === 429 && first429 < 0) first429 = i;
    }
    expect(first429, 'a 429 must appear within 20 attempts').toBeGreaterThanOrEqual(0);
    expect(first429, 'the first 15 attempts are allowed').toBeGreaterThanOrEqual(15);
  });

  test('5.2 coupon creation and percentage limits require admin (customer gets refused)', async () => {
    const r = await send('POST', '/api/coupons', {
      cookie: S.A!.cookie,
      body: { code: 'P5ADMIN', title: 'x', discountType: 'PERCENTAGE', discountValue: 150, targetType: 'ALL_PRODUCTS' },
    });
    expect([401, 403]).toContain(r.status);
    const check = await send('GET', '/api/coupons?code=P5ADMIN', {});
    expect(check.json?.coupon ?? null).toBeFalsy();
  });

  // -------------------------------------------------------------------------
  // 6. CSRF
  // -------------------------------------------------------------------------
  test('6.1 cross-site Origin on state-changing API is refused', async () => {
    const o = await send('POST', '/api/orders', { cookie: S.A!.cookie, origin: 'http://evil.example', body: {} });
    expect(o.status).toBe(403);
    const m = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, origin: 'http://evil.example', body: { name: 'csrf' } });
    expect(m.status).toBe(403);
    const sf = await send('POST', '/api/auth/me', {
      cookie: S.A!.cookie,
      headers: { 'Sec-Fetch-Site': 'cross-site' },
      body: { name: 'csrf' },
    });
    expect(sf.status).toBe(403);
  });

  test('6.2 state-changing API with no Origin, Referer or Fetch-Metadata is refused', async () => {
    const o = await send('POST', '/api/orders', { cookie: S.A!.cookie, origin: null, body: {} });
    expect(o.status).toBe(403);
    const m = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, origin: null, body: { name: 'csrf' } });
    expect(m.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 7. Admin surface as a customer
  // -------------------------------------------------------------------------
  const ADMIN_ROUTES = [
    '/api/admin',
    '/api/admin/categories',
    '/api/admin/coupons',
    '/api/admin/dashboard',
    '/api/admin/email',
    '/api/admin/email-settings',
    '/api/admin/email-settings/test',
    '/api/admin/finance',
    '/api/admin/manual-order',
    '/api/admin/orders',
    '/api/admin/payment-settings',
    '/api/admin/payment-settings/test',
    '/api/admin/products',
    '/api/admin/returns',
    '/api/admin/reviews',
    '/api/admin/sms-broadcast',
    '/api/admin/sms-settings',
    '/api/admin/sms-templates',
    '/api/admin/users',
  ];
  for (const route of ADMIN_ROUTES) {
    test(`7 customer cannot call ${route} (GET/POST/PUT/PATCH/DELETE)`, async () => {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        const r = await send(method, route, { cookie: S.A!.cookie, body: method === 'GET' || method === 'DELETE' ? undefined : {} });
        expect([401, 403, 405], `${method} ${route} -> ${r.status}`).toContain(r.status);
      }
    });
  }

  test('7.1 anonymous request to admin API is 401', async () => {
    const r = await send('GET', '/api/admin', {});
    expect(r.status).toBe(401);
  });

  test('7.2 /admin pages redirect to login without a loop', async () => {
    const r = await send('GET', '/admin', {});
    expect([302, 307]).toContain(r.status);
    expect(r.location).toContain('/login');
    const chain = await request.newContext();
    try {
      const final = await chain.fetch(BASE + '/admin', { maxRedirects: 5, failOnStatusCode: false });
      expect(new URL(final.url()).pathname).toBe('/login');
    } finally {
      await chain.dispose();
    }
    const adminLogin = await send('GET', '/admin/login', {});
    expect(adminLogin.location).toContain('/login');
  });

  test('7.3 customer session on /admin page is redirected to login', async () => {
    const r = await send('GET', '/admin', { cookie: S.A!.cookie });
    expect([302, 307]).toContain(r.status);
    expect(r.location).toContain('/login');
  });

  // -------------------------------------------------------------------------
  // 8. Information leaks and headers
  // -------------------------------------------------------------------------
  test('8.1 error responses contain no stack trace or internal detail', async () => {
    const probes = [
      send('POST', '/api/reviews', { cookie: S.A!.cookie, body: 'not-json{{' }),
      send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: '{bad' }),
      send('GET', '/api/products?limit=abc&category=%E0%A4%A', {}),
      send('POST', '/api/bulk-inquiries', { body: '[[' }),
      send('GET', '/api/orders?orderNumber=%00%ff', { cookie: S.A!.cookie }),
      send('POST', '/api/orders/quote', { body: '<<' }),
    ];
    for (const r of await Promise.all(probes)) {
      expect(r.text).not.toMatch(LEAK_PATTERN);
    }
  });

  test('8.2 /api/products never returns costPrice', async () => {
    const r = await send('GET', '/api/products', {});
    expect(r.status).toBe(200);
    expect(r.text).not.toContain('costPrice');
    const one = await send('GET', `/api/products?slug=${PRODUCT_SLUG}`, {});
    expect(one.text).not.toContain('costPrice');
  });

  test('8.3 public reviews show masked reviewer names only', async () => {
    const r = await send('GET', `/api/reviews?productSlug=${PRODUCT_SLUG}`, {});
    expect(r.status).toBe(200);
    for (const rv of r.json.reviews as any[]) {
      expect(rv.userName).not.toMatch(/@|\d{6,}/);
      expect(String(rv.userName).split(' ').length).toBeLessThanOrEqual(2);
      expect(Object.keys(rv)).not.toContain('userId');
      expect(Object.keys(rv)).not.toContain('phone');
    }
  });

  test('8.4 /api/auth/me does not return a password hash', async () => {
    const r = await send('GET', '/api/auth/me', { cookie: S.A!.cookie });
    expect(r.status).toBe(200);
    // Key check, not a substring check: "authProvider":"PASSWORD" is a legitimate value.
    expect(r.json.user).not.toHaveProperty('password');
    expect(r.json.user).not.toHaveProperty('passwordHash');
    expect(r.text).not.toMatch(/\$scrypt\$|"scrypt"|scrypt:/i);
  });

  test('8.5 response headers: no X-Powered-By, security headers present', async () => {
    const r = await send('GET', '/api/products', {});
    expect(r.headers['x-powered-by'], 'X-Powered-By must be disabled').toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    const framing = r.headers['x-frame-options'] ?? '';
    const csp = r.headers['content-security-policy'] ?? '';
    expect(framing !== '' || csp.includes('frame-ancestors'), 'clickjacking protection').toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. XSS (stored payloads; rendered on customer pages)
  // -------------------------------------------------------------------------
  test('9.1 stored script/img payloads in address and name are not executed on customer pages', async ({ browser }: { browser: Browser }) => {
    const payload = '<img src=x onerror=alert(1)>';
    const addr = await send('POST', '/api/account/addresses', {
      cookie: S.A!.cookie,
      body: {
        recipientName: '<script>alert(1)</script>',
        phone: S.A!.phone,
        province: 'فارس',
        city: 'شیراز',
        postalCode: '7131111111',
        streetAddress: `خیابان ${payload} تست`,
      },
    });
    expect(addr.status).toBe(201);
    const nm = await send('POST', '/api/auth/me', { cookie: S.A!.cookie, body: { name: `"><img src=x onerror=alert(2)>` } });
    expect(nm.status).toBe(200);

    const ctx = await browser.newContext({ baseURL: BASE });
    await ctx.addCookies([{ name: COOKIE, value: S.A!.cookie, url: BASE }]);
    const page = await ctx.newPage();
    const fired: string[] = [];
    page.on('dialog', (d) => {
      fired.push(d.message());
      void d.dismiss();
    });
    for (const path of ['/account', '/profile']) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const injected = await page.locator('img[src="x"]').count();
      expect(injected, `${path} renders an injected <img>`).toBe(0);
    }
    expect(fired, 'alert() fired on a customer page').toEqual([]);
    await ctx.close();
  });

  test('9.2 bulk inquiry accepts XSS payloads as data (rendering is checked by the admin tester)', async () => {
    const r = await send('POST', '/api/bulk-inquiries', {
      body: {
        name: '<script>alert(1)</script>',
        phone: freshPhone(9),
        companyName: '"><img src=x onerror=alert(1)>',
        city: 'شیراز',
        message: '<script>alert(1)</script> p5 test',
      },
      ip: '198.51.100.61',
    });
    // Storage of the raw payload is expected; the security property is that it is rendered escaped (admin page).
    expect([200, 201, 400]).toContain(r.status);
  });
});
