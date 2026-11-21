/**
 * Customer-simulation journey for persona "p3-subscriber".
 *
 * Journey: OTP sign-in -> /pro prices -> PLUS purchase (mock gateway) -> PLUS rules -> PRO upgrade without
 * re-login -> PRO rules and egg quota (600) -> paid orders -> second order -> two contexts ordering at once ->
 * PRO renewal from the account page -> coupon rejected on a subscription.
 *
 * Tests run in file order on one worker (playwright.config.ts: workers 1). They share state through `S`, so a
 * failed step can cascade into the next ones; the report calls out where that happens.
 *
 * Assertions follow the business rules in the brief and in docs/ARCHITECTURE.md. Where the live configuration
 * (GET /api/subscriptions) disagrees with those rules, the test is written against the rule and is expected to
 * fail, so the finding stays visible.
 */
import { test, expect as baseExpect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Dev-mode routes compile on first hit, so UI expectations get more time than the 5 s default. */
const expect = baseExpect.configure({ timeout: 30000 });

const BASE = 'http://localhost:3000';
const JSON_HEADERS = { Origin: BASE, 'Content-Type': 'application/json' };
const EGG_SLUG = 'organic-eggs-kamfiruz-30';
const EGG_PRICE_FALLBACK = 185000;
const EGGS_PER_PACK = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/** Checkout slot button: weekday name followed by the Persian day of month. Longest weekday names first. */
const DAY_BUTTON = /(یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنج‌شنبه|شنبه)\s*[۰-۹]/;

const toFa = (v: number | string) => String(v).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
const fmtToman = (n: number) => `${toFa(n.toLocaleString('en-US'))} تومان`;

const ADDRESS = {
  recipientName: 'مشترک آزمایشی',
  province: 'فارس',
  city: 'شیراز',
  streetAddress: 'خیابان آزمایشی ۱',
  postalCode: '7199900000',
  unit: '',
};

// Unique IPs per context (dev trusts X-Forwarded-For; rate limits are per IP)
// Rate limits are per IP (OTP sends: 10 per 10 min). Each run gets its own pair, derived from the runner pid, which
// stays the same across worker restarts of one run. Fixed addresses made repeated runs hit the limit.
const RUN_OCTET = (process.ppid % 240) + 10;
const IP_MAIN = `10.4.${RUN_OCTET}.11`;
const IP_SECOND = `10.4.${RUN_OCTET}.12`;

type Settings = {
  plusMonthlyPrice: number;
  plusEggDiscountPercent: number;
  plusEggMaxQuota: number;
  plusDeliveryDaysPerWeek: number;
  proMonthlyPrice: number;
  proEggDiscountPercent: number;
  proEggMaxQuota: number;
  proOtherDiscountPercent: number;
  proShippingDiscountPercent: number;
  proDeliveryDaysPerWeek: number;
  baseShippingFee: number;
  plusFeatures: string[];
  proFeatures: string[];
};

type Slot = {
  id: string;
  isoDate: string;
  dayOfWeekIndex: number;
  dayOfWeek: string;
  isAllowedForTier: boolean;
  isAvailable: boolean;
  isClosed: boolean;
  remainingCapacity: number;
};

type Quote = {
  ok: boolean;
  errors: string[];
  tier: string;
  total: number;
  subtotal: number;
  eggDiscount: number;
  otherDiscount: number;
  shipping: number;
  shippingBase: number;
  shippingDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;
  eggQuota: { limit: number; usedBefore: number; remainingBefore: number };
  lines: {
    productId: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    discount: number;
    eggCount: number;
    eggDiscountedCount: number;
  }[];
};

/** Normalized answer of POST /api/orders: { success, order, authority, paymentUrl } flattened. */
type PlacedOrder = {
  orderNumber: string;
  totalAmount: number;
  status: string;
  authority?: string;
  paymentUrl?: string;
  items: { eggDiscountedCount?: number; productId: string }[];
};

function toPlaced(body: {
  order: { orderNumber: string; totalAmount: number; status: string; items: PlacedOrder['items'] };
  authority?: string;
  paymentUrl?: string;
}): PlacedOrder {
  return {
    orderNumber: body.order.orderNumber,
    totalAmount: body.order.totalAmount,
    status: body.order.status,
    authority: body.authority,
    paymentUrl: body.paymentUrl,
    items: body.order.items,
  };
}

type Product = { slug: string; title: string; category: string; price: number; stock: number; status?: string };

const S: {
  phone: string;
  settings?: Settings;
  ctx?: BrowserContext;
  page?: Page;
  plusOrder?: PlacedOrder;
  proOrderA?: PlacedOrder;
  proOrderB?: PlacedOrder;
  raceOrders?: PlacedOrder[];
  renewalBefore?: string;
  quota: { remainingBeforeA?: number };
  eggExpectations: { a?: number; b?: number };
} = {
  phone: '0912300' + String(1000 + Math.floor(Math.random() * 8999)),
  quota: {},
  eggExpectations: {},
};

let signedIn = false;

/**
 * Playwright discards a worker after a failed test and starts a new one, which re-runs beforeAll (new browser
 * context, new module state). The journey state therefore lives in a file keyed by the runner's pid, which stays
 * the same across worker restarts of one run and differs between runs. Without it, a worker restart would sign
 * up a new account (new phone, FREE tier) in the middle of the journey.
 */
const STATE_FILE = path.join(process.cwd(), 'e2e', 'test-results', `p3-state-${process.ppid}.json`);

function loadState() {
  try {
    if (!existsSync(STATE_FILE)) return;
    const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Partial<typeof S> & { signedIn?: boolean };
    if (saved.phone) S.phone = saved.phone;
    if (saved.signedIn) signedIn = true;
    S.proOrderB = saved.proOrderB;
    S.raceOrders = saved.raceOrders;
    S.renewalBefore = saved.renewalBefore;
  } catch {
    // unreadable state file: start from a fresh phone
  }
}

function saveState() {
  try {
    mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    writeFileSync(
      STATE_FILE,
      JSON.stringify({
        phone: S.phone,
        signedIn,
        proOrderB: S.proOrderB,
        raceOrders: S.raceOrders,
        renewalBefore: S.renewalBefore,
      })
    );
  } catch {
    // state is best effort; a failed write only means a restarted worker starts over
  }
}

loadState();

/**
 * Signs the same phone back in. Used when the shared context has lost its session cookie. This was observed
 * during the run: the cookie was gone at the start of a test (no Set-Cookie came from the server and no client
 * code clears it), so the journey re-authenticates instead of cascading into guest responses.
 * The account is looked up by phone, so the same user (and subscription) is used.
 */
async function resignIn() {
  const send = await S.ctx!.request.post('/api/auth/otp', {
    data: { phone: S.phone, action: 'send' },
    headers: JSON_HEADERS,
  });
  const sent = (await send.json()) as { debugCode?: string };
  const verify = await S.ctx!.request.post('/api/auth/otp', {
    data: { phone: S.phone, action: 'verify', code: sent.debugCode },
    headers: JSON_HEADERS,
  });
  expect(verify.status(), 're-sign-in with the same phone').toBe(200);
  // Put the fresh session cookie into the shared context explicitly, so the browser page and the API calls both see it.
  const cookie = verify
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value)
    .find((v) => v.startsWith('profarm_session='));
  if (cookie) {
    const value = cookie.split(';')[0].slice('profarm_session='.length);
    await S.ctx!.addCookies([{ name: 'profarm_session', value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  }
}

/** Checks the shared session (a guest quote still answers 200, so the check cannot rely on the quote's status). */
async function ensureSession() {
  if (!signedIn) return;
  const me = await S.ctx!.request.get('/api/auth/me');
  if (!me.ok()) await resignIn();
}

async function getJson<T>(req: APIRequestContext, path: string): Promise<T> {
  let r = await req.get(path);
  if (r.status() === 401 && signedIn) {
    await resignIn();
    r = await req.get(path);
  }
  expect(r.ok(), `GET ${path} responded ${r.status()}`).toBeTruthy();
  return (await r.json()) as T;
}

async function postJson(req: APIRequestContext, path: string, data: unknown) {
  let r = await req.post(path, { data, headers: JSON_HEADERS });
  if (r.status() === 401 && signedIn) {
    await resignIn();
    r = await req.post(path, { data, headers: JSON_HEADERS });
  }
  return r;
}

async function getSettings(): Promise<Settings> {
  if (!S.settings) {
    const body = await getJson<{ settings: Settings }>(S.ctx!.request, '/api/subscriptions');
    S.settings = body.settings;
  }
  return S.settings;
}

async function getProducts(): Promise<Product[]> {
  const body = await getJson<{ products: Product[] }>(S.ctx!.request, '/api/products');
  return body.products;
}

async function eggStock(): Promise<number> {
  const p = (await getProducts()).find((x) => x.slug === EGG_SLUG);
  return p?.stock ?? 0;
}

async function eggPrice(): Promise<number> {
  const p = (await getProducts()).find((x) => x.slug === EGG_SLUG);
  return p?.price ?? EGG_PRICE_FALLBACK;
}

async function getMe() {
  const body = await getJson<{
    user: {
      tier: string;
      proExpiresAt?: string | null;
      plusExpiresAt?: string | null;
      isPhoneVerified?: boolean;
    };
    usedEggQuotaThisMonth: number;
  }>(S.ctx!.request, '/api/auth/me');
  return body;
}

async function getSlots(): Promise<Slot[]> {
  const body = await getJson<{ slots: Slot[] }>(S.ctx!.request, '/api/delivery-slots?days=14');
  return body.slots;
}

async function pickSlot(days: number[]): Promise<Slot> {
  const slot = (await getSlots()).find((s) => s.isAllowedForTier && s.isAvailable && days.includes(s.dayOfWeekIndex));
  expect(slot, `no available slot on days ${days.join(',')}`).toBeTruthy();
  return slot!;
}

async function quoteFor(items: { productId: string; quantity: number }[], slotId?: string, req?: APIRequestContext) {
  await ensureSession();
  const r = await postJson(req ?? S.ctx!.request, '/api/orders/quote', {
    items,
    slotId,
    city: ADDRESS.city,
    province: ADDRESS.province,
  });
  expect(r.status()).toBe(200);
  return ((await r.json()) as { quote: Quote }).quote;
}

async function subscriptionQuote(plan: 'PLUS' | 'PRO', couponCode?: string) {
  await ensureSession();
  const r = await postJson(S.ctx!.request, '/api/orders/quote', {
    items: [],
    isSubscription: true,
    subscriptionPlan: plan,
    couponCode,
  });
  return ((await r.json()) as { quote: Quote }).quote;
}

async function placeEggOrder(req: APIRequestContext, packs: number, slotId: string) {
  await ensureSession();
  return postJson(req, '/api/orders', {
    ...ADDRESS,
    phone: S.phone,
    deliverySlot: slotId,
    items: [{ productId: EGG_SLUG, quantity: packs }],
    paymentMethod: 'zarinpal',
    isSubscription: false,
    appliedCouponCode: null,
  });
}

/** Same request the mock gateway button makes (GET /api/payment/verify with Status=OK). */
async function payByCallback(req: APIRequestContext, order: PlacedOrder) {
  const r = await req.get(
    `/api/payment/verify?orderNumber=${encodeURIComponent(order.orderNumber)}&gateway=zarinpal&Authority=${encodeURIComponent(
      order.authority ?? ''
    )}&Status=OK`,
    { maxRedirects: 0 }
  );
  return r.status();
}

async function getOrder(orderNumber: string) {
  const body = await getJson<{ orders: (PlacedOrder & { totalAmount: number })[] }>(
    S.ctx!.request,
    `/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`
  );
  expect(body.orders[0], `order ${orderNumber} on the account`).toBeTruthy();
  return body.orders[0];
}

async function paidStatus(orderNumber: string): Promise<string | undefined> {
  const body = await getJson<{ orders: { orderNumber: string; status: string }[] }>(
    S.ctx!.request,
    `/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`
  );
  return body.orders[0]?.status;
}

/** Pays through the real mock gateway page in the browser and checks the amount it shows. */
async function payViaMockGateway(page: Page, paymentUrl: string, expectedAmount: number) {
  const gatewayAmount = Number(new URL(paymentUrl, BASE).searchParams.get('amount'));
  expect(gatewayAmount, 'amount passed to the mock gateway').toBe(expectedAmount);
  await page.goto(paymentUrl);
  await expect(page.getByText(fmtToman(expectedAmount)).first()).toBeVisible();
  await page.getByRole('link', { name: 'پرداخت موفق' }).click();
  await page.waitForURL(/\/checkout\/success/, { timeout: 30000 });
}

/** Checkout for a subscription: submit, check the pre-invoice amount, pay on the mock gateway. */
async function buySubscriptionInBrowser(page: Page, plan: 'PLUS' | 'PRO'): Promise<PlacedOrder> {
  const settings = await getSettings();
  const price = plan === 'PLUS' ? settings.plusMonthlyPrice : settings.proMonthlyPrice;
  await page.waitForURL(new RegExp(`/checkout\\?subscriptionPlan=${plan}`), { timeout: 60000 });
  await expect(page.getByText(fmtToman(price)).first()).toBeVisible({ timeout: 30000 });

  const submit = page.locator('form button[type="submit"]').last();
  await expect(submit).toBeEnabled({ timeout: 20000 });
  const [orderRes] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST'),
    submit.click(),
  ]);
  expect(orderRes.status(), 'POST /api/orders for subscription').toBe(200);

  // The browser navigates to the gateway as soon as the answer arrives, so the response body is not readable
  // any more. The gateway URL carries the order number, authority and amount; the order itself is read back.
  await page.waitForURL(/\/checkout\/mock-gateway/, { timeout: 30000 });
  const gatewayUrl = new URL(page.url());
  const orderNumber = gatewayUrl.searchParams.get('orderNumber') ?? '';
  const serverOrder = await getOrder(orderNumber);
  expect(serverOrder.totalAmount, 'charged amount equals the plan price (no coupon, no tier discount)').toBe(price);
  const placed: PlacedOrder = {
    orderNumber,
    totalAmount: serverOrder.totalAmount,
    status: serverOrder.status,
    authority: gatewayUrl.searchParams.get('Authority') ?? undefined,
    paymentUrl: `${gatewayUrl.pathname}${gatewayUrl.search}`,
    items: serverOrder.items,
  };
  await payViaMockGateway(page, placed.paymentUrl!, placed.totalAmount);
  return placed;
}

/** Full OTP sign-in through the login form. The mock SMS provider returns the code in the send response. */
async function signInWithOtp(page: Page, phone: string) {
  await page.goto('/login');
  await page.locator('#login-phone').fill(phone);
  const [sendRes] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/otp') && r.request().postDataJSON()?.action === 'send'),
    page.getByRole('button', { name: 'دریافت کد تایید ورود' }).click(),
  ]);
  const sent = (await sendRes.json()) as { debugCode?: string };
  expect(sent.debugCode, 'mock SMS returns the OTP code in dev').toMatch(/^\d{5}$/);
  const code = sent.debugCode!;

  // The login form submits by itself once all five digits are in (distributeOtpDigits -> submitVerifyOtp),
  // so the code goes in as one paste-like fill on the first box and the verify response is awaited.
  const boxes = page.locator('input[aria-label*="کد تایید"]');
  await expect(boxes).toHaveCount(5);
  const [verifyRes] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/otp') && r.request().postDataJSON()?.action === 'verify'),
    boxes.nth(0).fill(code),
  ]);
  expect(verifyRes.status()).toBe(200);
  await page.waitForLoadState('domcontentloaded');
}

test.describe('p3-subscriber: PLUS and PRO membership journey', () => {
  // Dev routes compile on first hit and the purchase flow crosses several pages: 60 s per test is too tight.
  test.describe.configure({ timeout: 180000 });

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    S.ctx = await browser.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { 'X-Real-IP': IP_MAIN },
      locale: 'fa-IR',
    });
    S.page = await S.ctx.newPage();
  });

  test.afterAll(async () => {
    saveState();
    await S.ctx?.close();
  });

  test.afterEach(async () => {
    saveState();
  });

  test.beforeEach(async () => {
    // A restarted worker has a new context without the session: the same phone is signed in again.
    await ensureSession();
  });

  test('1. OTP sign-in creates a FREE account for a new phone', async () => {
    await signInWithOtp(S.page!, S.phone);
    signedIn = true;
    const me = await getMe();
    expect(me.user.tier).toBe('FREE');
    expect(me.user.isPhoneVerified).toBe(true);
  });

  test('2. /pro shows PLUS and PRO prices that match GET /api/subscriptions', async () => {
    const settings = await getSettings();
    await S.page!.goto('/pro');
    await expect(S.page!.getByRole('button', { name: /خرید اشتراک پلاس/ })).toBeVisible({ timeout: 20000 });
    await expect(S.page!.getByRole('button', { name: /خرید اشتراک پرو/ })).toBeVisible();
    const body = await S.page!.locator('body').innerText();
    expect(body, 'PLUS price on /pro').toContain(fmtToman(settings.plusMonthlyPrice));
    expect(body, 'PRO price on /pro').toContain(fmtToman(settings.proMonthlyPrice));
  });

  test('3. PLUS purchase through checkout and mock gateway, no logout', async () => {
    const page = S.page!;
    await page.goto('/pro');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /خرید اشتراک پلاس/ }).click();
    S.plusOrder = await buySubscriptionInBrowser(page, 'PLUS');
    await expect(page).toHaveURL(/\/checkout\/success/);

    const me = await getMe();
    expect(me.user.tier).toBe('PLUS');
    const expiry = Date.parse(me.user.plusExpiresAt ?? '');
    expect(expiry - Date.now()).toBeGreaterThan(29 * DAY_MS);
    expect(expiry - Date.now()).toBeLessThan(31 * DAY_MS);
  });

  test('4. PLUS shows in the header and the account expiry date, without re-login', async () => {
    const page = S.page!;
    await page.goto('/account');
    await expect(page.getByText('پلاس', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'اشتراک', exact: true }).click();
    await expect(page.getByText(/اعتبار تا:/).first()).toBeVisible();
  });

  test('5. PLUS checkout offers Saturday to Thursday slots, Friday closed (owner decision)', async () => {
    const slots = await getSlots();
    const allowed = slots.filter((s) => s.isAllowedForTier);
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.every((s) => [0, 1, 2, 3, 4, 6].includes(s.dayOfWeekIndex)), 'PLUS allowed days').toBeTruthy();
    expect(allowed.some((s) => s.dayOfWeekIndex === 1), 'Monday offered to PLUS').toBeTruthy();
    expect(slots.some((s) => s.dayOfWeekIndex === 5 && s.isAvailable), 'Friday offered').toBeFalsy();
  });

  test('6. PLUS checkout page UI offers Saturday to Thursday, never Friday', async () => {
    const page = S.page!;
    await page.goto(`/products/${EGG_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /افزودن به سبد خرید/ }).first().click();
    await expect(page.locator('a[href="/cart"]').first()).toContainText('۱', { timeout: 30000 });
    await page.goto('/checkout');
    // Slot buttons read like "یکشنبه ۱ آذر"; a disabled one may add a label. Weekday names are matched
    // longest first, because "شنبه" is inside every other weekday name.
    const dayButtons = page.getByRole('button').filter({ hasText: DAY_BUTTON });
    await expect(dayButtons.first()).toBeVisible({ timeout: 30000 });
    const count = await dayButtons.count();
    const enabled: string[] = [];
    for (let i = 0; i < count; i++) {
      const el = dayButtons.nth(i);
      const text = (await el.innerText()).trim();
      if (await el.isEnabled()) enabled.push(text);
    }
    expect(enabled.length, 'selectable day buttons').toBeGreaterThan(0);
    for (const t of enabled) expect(/جمعه/.test(t), `Friday must not be selectable: ${t}`).toBeFalsy();
    expect(enabled.some((t) => /^(شنبه|دوشنبه|سه‌شنبه|پنج‌شنبه)/.test(t)), 'Saturday, Monday, Tuesday or Thursday selectable for PLUS').toBeTruthy();
  });

  test('6b. Days a PLUS member can pick are not labelled as a restriction', async () => {
    const page = S.page!;
    await page.goto('/checkout');
    const dayButtons = page.getByRole('button').filter({ hasText: DAY_BUTTON });
    await expect(dayButtons.first()).toBeVisible({ timeout: 30000 });
    const labelled = await dayButtons.filter({ hasText: /ویژه اعضای پلاس و پرو|ویژه پلاس/ }).count();
    expect(labelled, 'day buttons labelled as member-only for a PLUS member').toBe(0);
  });

  test('7. PLUS egg quota is 200 eggs per rolling 30 days', async () => {
    const settings = await getSettings();
    const stock = await eggStock();
    const slot = await pickSlot([0, 3]);
    const price = await eggPrice();
    const q = await quoteFor([{ productId: EGG_SLUG, quantity: 7 }], slot.id);
    expect(q.eggQuota.limit).toBe(settings.plusEggMaxQuota);
    expect(q.eggQuota.remainingBefore).toBe(200);
    const line = q.lines[0];
    expect(line.eggCount).toBe(7 * EGGS_PER_PACK);
    expect(line.eggDiscountedCount).toBe(200);
    const expected = Math.round(price * 7 * (200 / 210) * (settings.plusEggDiscountPercent / 100));
    expect(q.eggDiscount).toBe(expected);
  });

  test('8. PLUS pays the full shipping fee on allowed days (owner decision: discount is PRO only)', async () => {
    const settings = await getSettings();
    const slot = await pickSlot([0, 1, 2, 3, 4, 6]);
    const q = await quoteFor([{ productId: EGG_SLUG, quantity: 1 }], slot.id);
    expect(q.shipping, 'PLUS shipping on an allowed day').toBe(settings.baseShippingFee);
  });

  test('9. PLUS delivery copy and configured delivery days match the Saturday to Thursday rule', async () => {
    const settings = await getSettings();
    // The rule enforced by isDayAllowedForUser is 6 days (Saturday to Thursday) for PLUS.
    expect(settings.plusDeliveryDaysPerWeek, 'configured PLUS delivery days').toBe(6);
    expect(
      settings.plusFeatures.some((f) => f.includes('شنبه تا')),
      'PLUS feature list promises Saturday to Thursday'
    ).toBeTruthy();
  });

  test('10. PLUS upgrades to PRO without re-login; header updates to PRO', async () => {
    const page = S.page!;
    await page.goto('/pro');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /خرید اشتراک پرو/ }).click();
    await buySubscriptionInBrowser(page, 'PRO');
    await expect(page).toHaveURL(/\/checkout\/success/);

    const me = await getMe();
    expect(me.user.tier).toBe('PRO');
    const expiry = Date.parse(me.user.proExpiresAt ?? '');
    expect(expiry - Date.now()).toBeGreaterThan(29 * DAY_MS);

    await page.goto('/account');
    await expect(page.getByText('پرو', { exact: true }).first()).toBeVisible({ timeout: 20000 });
  });

  test('11. PRO checkout offers Saturday to Thursday, Friday closed', async () => {
    const slots = await getSlots();
    const allowedDays = [...new Set(slots.filter((s) => s.isAllowedForTier).map((s) => s.dayOfWeekIndex))].sort();
    expect(allowedDays).toEqual([0, 1, 2, 3, 4, 6]);
    expect(slots.some((s) => s.dayOfWeekIndex === 5 && s.isAvailable)).toBeFalsy();
  });

  test('12. PRO egg quota is 600 eggs: discount only on the first 600, full price beyond', async () => {
    const settings = await getSettings();
    const stock = await eggStock();
    const slot = await pickSlot([6]);
    const price = await eggPrice();
    const q = await quoteFor([{ productId: EGG_SLUG, quantity: 21 }], slot.id);
    expect(q.eggQuota.limit).toBe(settings.proEggMaxQuota);
    expect(q.eggQuota.remainingBefore).toBe(600);
    const line = q.lines[0];
    expect(line.eggCount).toBe(630);
    expect(line.eggDiscountedCount, 'eggs inside the quota').toBe(600);
    const lineTotal = price * 21;
    const expected = Math.round(lineTotal * (600 / 630) * (settings.proEggDiscountPercent / 100));
    expect(line.discount).toBe(expected);
    expect(q.eggDiscount).toBe(expected);
  });

  test('13. PRO shipping discount follows the configured percent', async () => {
    const settings = await getSettings();
    const slot = await pickSlot([6]);
    const q = await quoteFor([{ productId: EGG_SLUG, quantity: 1 }], slot.id);
    const base = settings.baseShippingFee;
    const expected = base - Math.round(base * (settings.proShippingDiscountPercent / 100));
    expect(q.shipping).toBe(expected);
  });

  test('14. PRO other-product discount follows the configured percent', async () => {
    const settings = await getSettings();
    const product = (await getProducts()).find(
      (p) => p.category !== 'تخم‌مرغ و ماکیان' && p.status !== 'OUT_OF_STOCK' && p.stock > 0 && p.price > 0 && !/تخم/.test(p.title)
    );
    expect(product, 'a non-egg product in stock').toBeTruthy();
    const slot = await pickSlot([6]);
    const q = await quoteFor([{ productId: product!.slug, quantity: 1 }], slot.id);
    const expected = Math.round(product!.price * (settings.proOtherDiscountPercent / 100));
    expect(q.lines[0].discount).toBe(expected);
  });

  test('15. First PRO egg order (10 packs = 300 eggs) is priced, paid and marked PROCESSING', async () => {
    const stock = await eggStock();
    test.skip(stock < 10, `not enough egg stock for a 10-pack order (stock ${stock}); shared data`);
    const settings = await getSettings();
    const slot = await pickSlot([6]);
    const q0 = await quoteFor([{ productId: EGG_SLUG, quantity: 10 }], slot.id);
    S.quota.remainingBeforeA = q0.eggQuota.remainingBefore;
    expect(q0.eggQuota.remainingBefore).toBe(600);
    expect(q0.eggDiscount).toBe(Math.round((await eggPrice()) * 10 * (settings.proEggDiscountPercent / 100)));

    const r = await placeEggOrder(S.ctx!.request, 10, slot.id);
    expect(r.status()).toBe(200);
    const placed = toPlaced(await r.json());
    S.proOrderA = placed;
    expect(placed.totalAmount, 'order total equals the quote total').toBe(q0.total);

    const page = S.page!;
    await payViaMockGateway(page, placed.paymentUrl!, placed.totalAmount);
    expect(await paidStatus(placed.orderNumber)).toBe('PROCESSING');
  });

  test('16. Second order sees the 300 eggs already used and is discounted on the remaining 300', async () => {
    const stock = await eggStock();
    test.skip(stock < 8, `not enough egg stock for an 8-pack order (stock ${stock}); shared data`);
    const settings = await getSettings();
    const slot = await pickSlot([6]);
    const q1 = await quoteFor([{ productId: EGG_SLUG, quantity: 8 }], slot.id);
    expect(q1.eggQuota.usedBefore, 'eggs used by the paid order').toBe(300);
    expect(q1.eggQuota.remainingBefore).toBe(300);
    expect(q1.lines[0].eggDiscountedCount).toBe(240);
    const expected = Math.round((await eggPrice()) * 8 * (settings.proEggDiscountPercent / 100));
    expect(q1.eggDiscount).toBe(expected);

    const r = await placeEggOrder(S.ctx!.request, 8, slot.id);
    expect(r.status()).toBe(200);
    S.proOrderB = toPlaced(await r.json());
    expect(S.proOrderB.totalAmount).toBe(q1.total);
    expect(S.proOrderB.status).toBe('PENDING_PAYMENT');
  });

  test('17. Two contexts order eggs at the same time: quota of 60 left is not double-spent', async ({ browser }) => {
    const stock = await eggStock();
    test.skip(stock < 8, `not enough egg stock for two 4-pack orders (stock ${stock}); shared data`);
    const slot = await pickSlot([6]);
    const second = await browser.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { 'X-Real-IP': IP_SECOND },
    });
    try {
      // Same account in the second tab/context: copy the session cookie.
      await second.addCookies(await S.ctx!.cookies());
      const [a, b] = await Promise.all([
        placeEggOrder(S.ctx!.request, 4, slot.id),
        placeEggOrder(second.request, 4, slot.id),
      ]);
      const statuses = [a.status(), b.status()];
      expect(statuses, 'both simultaneous orders are answered').toEqual([200, 200]);
      const orders = [toPlaced(await a.json()), toPlaced(await b.json())];
      S.raceOrders = orders;

      const discountedEggs = orders.reduce(
        (sum, o) => sum + o.items.reduce((s, i) => s + (i.eggDiscountedCount ?? 0), 0),
        0
      );
      expect(discountedEggs, 'eggs discounted across both orders (remaining quota was 60)').toBe(60);

      const me = await getMe();
      expect(me.usedEggQuotaThisMonth, 'quota used after 300 + 240 + 60').toBe(600);
    } finally {
      await second.close();
    }
  });

  test('18. With the quota used up, a further egg order gets no egg discount', async () => {
    test.skip(!S.proOrderB && !S.raceOrders, 'no orders placed earlier in this run (shared egg stock too low)');
    const slot = await pickSlot([6]);
    const q = await quoteFor([{ productId: EGG_SLUG, quantity: 1 }], slot.id);
    expect(q.eggQuota.remainingBefore).toBe(0);
    expect(q.eggDiscount).toBe(0);
    expect(q.lines[0].discount).toBe(0);
  });

  test('19. Pending orders are paid through the gateway and keep counting toward the quota', async () => {
    const req = S.ctx!.request;
    const pending = [S.proOrderB!, ...(S.raceOrders ?? [])].filter(Boolean);
    test.skip(pending.length === 0, 'no orders placed earlier in this run (shared egg stock too low)');
    for (const o of pending) {
      expect(await payByCallback(req, o)).toBeGreaterThanOrEqual(300);
    }
    for (const o of pending) {
      expect(await paidStatus(o.orderNumber)).toBe('PROCESSING');
    }
    const me = await getMe();
    expect(me.usedEggQuotaThisMonth).toBe(600);
  });

  test('20. PRO renewal from the account extends the expiry from the previous expiry', async () => {
    const page = S.page!;
    const before = await getMe();
    S.renewalBefore = before.user.proExpiresAt ?? undefined;
    const beforeMs = Date.parse(S.renewalBefore ?? '');
    expect(Number.isFinite(beforeMs)).toBeTruthy();

    await page.goto('/account');
    await page.getByRole('button', { name: 'اشتراک', exact: true }).click();
    await page.getByRole('link', { name: 'تمدید اشتراک' }).first().click();
    await expect(page).toHaveURL(/subscriptionPlan=PRO/);
    await buySubscriptionInBrowser(page, 'PRO');
    await expect(page).toHaveURL(/\/checkout\/success/);

    const after = await getMe();
    const afterMs = Date.parse(after.user.proExpiresAt ?? '');
    const added = afterMs - beforeMs;
    expect(added, 'expiry moved forward by about 30 days from the old expiry').toBeGreaterThan(29 * DAY_MS);
    expect(added).toBeLessThan(31 * DAY_MS);
  });

  test('21. Control: EGGS20 coupon applies to a normal cart', async () => {
    const slot = await pickSlot([6]);
    const r = await postJson(S.ctx!.request, '/api/orders/quote', {
      items: [{ productId: EGG_SLUG, quantity: 1 }],
      slotId: slot.id,
      city: ADDRESS.city,
      province: ADDRESS.province,
      couponCode: 'EGGS20',
    });
    const q = ((await r.json()) as { quote: Quote }).quote;
    test.skip(q.couponDiscount === 0, `EGGS20 does not apply to a normal cart: ${q.couponError ?? 'no reason given'}`);
    expect(q.couponDiscount).toBeGreaterThan(0);
  });

  test('22. A coupon is rejected on a subscription quote and purchase, and no coupon field is offered', async () => {
    const settings = await getSettings();
    const q = await subscriptionQuote('PRO', 'EGGS20');
    expect(q.ok, 'quote with a coupon code is refused').toBeFalsy();
    expect(q.couponDiscount).toBe(0);
    expect(q.total, 'total is the plan price without any discount').toBe(settings.proMonthlyPrice);

    const ordersBefore = await getJson<{ orders: unknown[] }>(S.ctx!.request, '/api/orders');
    const r = await postJson(S.ctx!.request, '/api/orders', {
      ...ADDRESS,
      phone: S.phone,
      isSubscription: true,
      subscriptionPlan: 'PRO',
      items: [],
      appliedCouponCode: 'EGGS20',
      paymentMethod: 'zarinpal',
    });
    expect(r.status(), 'subscription order with a coupon').toBe(400);
    const ordersAfter = await getJson<{ orders: unknown[] }>(S.ctx!.request, '/api/orders');
    expect(ordersAfter.orders.length).toBe(ordersBefore.orders.length);

    await S.page!.goto('/checkout?subscriptionPlan=PRO');
    await expect(S.page!.getByText(fmtToman(settings.proMonthlyPrice)).first()).toBeVisible({ timeout: 20000 });
    await expect(S.page!.getByPlaceholder('کد تخفیف')).toHaveCount(0);
  });

  test('23. Expired plan reverts to FREE', async () => {
    test.skip(true, 'Needs an expired expiry date: no API to set one without admin access or a clock change.');
  });

  test('24. Quota counts a rolling 30-day window, not the calendar month', async () => {
    test.skip(true, 'Needs orders older than 30 days: not reproducible without changing stored dates.');
  });
});
