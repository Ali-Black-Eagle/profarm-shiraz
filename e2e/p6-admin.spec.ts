/**
 * p6-admin: admin-operator journey on the local dev server (http://localhost:3000).
 *
 * Rules followed by this spec:
 * - Admin credentials are read at runtime from "admin userpass.txt". They are never logged, reported or written.
 * - Every request carries Origin and a distinct X-Forwarded-For (10.6.0.x) so rate limits do not interfere.
 * - Delivery days are closed only 12 to 14 days ahead, and are reopened in the same test.
 * - Subscription prices, payment and SMS settings are not changed. The SMS broadcast goes to the PRO segment only,
 *   and only when the configured provider is MOCK.
 * - Only products, coupons, orders, reviews, returns and accounts created by this run are changed. Nothing is deleted.
 * - The test product is hidden at the end (and again in afterAll as a safety net).
 *
 * State survives Playwright worker restarts (a failed test restarts the worker): shared data lives in
 * e2e/test-results/p6/p6-state.json and browser contexts are rebuilt from it on demand.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(ROOT, 'e2e', 'test-results', 'p6');
const STATE_FILE = path.join(OUT_DIR, 'p6-state.json');
const FA = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (s: string) => s.replace(/\d/g, (d) => FA[Number(d)]);
const priceForms = (n: number) => {
  const en = n.toLocaleString('en-US');
  return [en, toFa(en)];
};
const hdr = (n: number) => ({ Origin: BASE, 'X-Forwarded-For': `10.6.0.${n}` });
const newPhone = () => `0912600${1000 + Math.floor(Math.random() * 9000)}`;
const tehranToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tehran' });
const dayDiff = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(tehranToday() + 'T00:00:00Z')) / 864e5);
const ORDER_SEARCH = /جستجوی سفارش|جستجو با شماره/;

// ---------- shared data (persisted) and live browser objects (per worker) ----------
type Note = { step: string; ok: boolean; detail: string };
const S: Record<string, any> = { notes: [] as Note[], consoleByPage: {} as Record<string, string[]> };
const C: Record<string, any> = {}; // contexts and pages, rebuilt per worker

function loadState() {
  try {
    Object.assign(S, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch {
    /* fresh run */
  }
  S.notes = S.notes || [];
  S.consoleByPage = S.consoleByPage || {};
  S.run = S.run || Date.now().toString(36).toUpperCase().slice(-5);
}
function saveState() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(S, null, 2));
}

function check(step: string, ok: boolean, detail = '') {
  S.notes.push({ step, ok: !!ok, detail: String(detail).slice(0, 600) });
  expect.soft(!!ok, `${step}${detail ? ' :: ' + String(detail).slice(0, 300) : ''}`).toBe(true);
}
function info(step: string, detail: string) {
  S.notes.push({ step, ok: true, detail: String(detail).slice(0, 600) });
}

function readAdminCreds(): { phone: string; password: string } {
  const lines = fs.readFileSync(path.join(ROOT, 'admin userpass.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
  let phone = '';
  let password = '';
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const label = line.slice(0, i);
    const value = line.slice(i + 1).trim();
    if (label.includes('عبور')) password = value;
    else phone = value;
  }
  return { phone, password };
}

function watchConsole(page: Page, label: string) {
  S.consoleByPage[label] = S.consoleByPage[label] || [];
  page.on('console', (m) => {
    if (m.type() === 'error') S.consoleByPage[label].push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => S.consoleByPage[label].push('PAGEERROR ' + e.message.slice(0, 200)));
}

async function newCtx(browser: Browser, n: number): Promise<BrowserContext> {
  return browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 800 }, extraHTTPHeaders: hdr(n) });
}

async function call(ctx: BrowserContext, n: number, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, data?: unknown): Promise<{ status: number; body: any }> {
  const r = await ctx.request.fetch(BASE + url, { method, headers: hdr(n), data: data as any, failOnStatusCode: false });
  const text = await r.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  return { status: r.status(), body };
}

/** Customer session through the mock OTP (send, read the mock code from the send response, verify). */
async function otpLogin(ctx: BrowserContext, n: number, phone: string, name: string) {
  const send = await call(ctx, n, 'POST', '/api/auth/otp', { action: 'send', phone });
  const code = send.body?.debugCode;
  if (!code) return { ok: false, user: null as any, reason: `send ${send.status}, no debugCode` };
  const verify = await call(ctx, n, 'POST', '/api/auth/otp', { action: 'verify', phone, code, name });
  return { ok: verify.status === 200 && verify.body?.success === true, user: verify.body?.user, reason: verify.body?.message || String(verify.status) };
}

/** Test-only password for a dev test account, derived from its phone (never stored or reported). */
const pwFor = (phone: string) => `P6pw-${phone.slice(-4)}-x9`;

/**
 * A customer context for this run. The first time, the account logs in with the mock OTP and sets a password.
 * After a worker restart, the account logs in with that password, which avoids a second OTP send to the same phone
 * (the OTP send is rate limited per number).
 */
async function cust(key: string, ip: number, name: string): Promise<BrowserContext> {
  if (C[key]) return C[key];
  S[`${key}Phone`] = S[`${key}Phone`] || newPhone();
  const phone = S[`${key}Phone`];
  const ctx = await newCtx(C.browser, ip);
  let ok = false;
  let reason = '';
  if (S[`${key}Id`]) {
    const r = await call(ctx, ip, 'POST', '/api/auth/login', { identifier: phone, password: pwFor(phone) });
    ok = r.status === 200 && r.body?.success === true;
    reason = `password login ${r.status}`;
  }
  if (!ok) {
    const login = await otpLogin(ctx, ip, phone, name);
    ok = login.ok;
    reason = login.reason;
    if (login.user?.id) S[`${key}Id`] = login.user.id;
    if (ok) {
      const pw = await call(ctx, ip, 'POST', '/api/auth/me', { password: pwFor(phone) });
      check(`customer ${key} sets account password in profile`, pw.status === 200, `${pw.status} ${pw.body?.message || ''}`);
    }
  }
  check(`customer ${key} logged in (OTP first time, then password)`, ok, reason);
  C[key] = ctx;
  return ctx;
}

async function adminProductByTitle(title: string) {
  const r = await call(C.adminCtx, 1, 'GET', `/api/admin/products?q=${encodeURIComponent(title)}&pageSize=50`);
  return ((r.body?.products || []) as any[]).find((p) => p.title === title) || null;
}

async function publicProduct(id: string) {
  const r = await call(C.anonCtx, 50, 'GET', '/api/products?limit=200');
  return ((r.body?.products || []) as any[]).find((p) => p.id === id) || null;
}

async function pickFreeSlot(ctx: BrowserContext, n: number, minRemaining = 4) {
  const r = await call(ctx, n, 'GET', '/api/delivery-slots?days=14');
  const slots: any[] = r.body?.slots || [];
  return slots.find((s) => s.isAllowedForTier && !s.isClosed && s.remainingCapacity >= minRemaining) || null;
}

async function getAdminOrder(orderNumber: string) {
  const r = await call(C.adminCtx, 1, 'GET', `/api/admin/orders?q=${encodeURIComponent(orderNumber)}&pageSize=5`);
  return ((r.body?.orders || []) as any[]).find((o) => o.orderNumber === orderNumber) || null;
}

/** Pays an order on the dev mock gateway page (/checkout/mock-gateway, "پرداخت موفق"). */
async function payOnline(page: Page, paymentUrl: string) {
  await page.goto(BASE + paymentUrl, { waitUntil: 'domcontentloaded' });
  // The mock gateway renders the success choice as a link (<a href="/api/payment/verify?...&Status=OK">).
  const pay = page.getByRole('link', { name: /پرداخت موفق/ });
  await pay.waitFor({ state: 'visible', timeout: 20000 });
  await pay.click();
  await page.waitForURL(/checkout\/success|account|orders/, { timeout: 30000 }).catch(() => {});
  return page.url();
}

async function placeOrder(ctx: BrowserContext, n: number, phone: string, slotId: string, productId: string, coupon: string | null, qty: number) {
  return call(ctx, n, 'POST', '/api/orders', {
    recipientName: `مشتری P6 ${S.run}`,
    phone,
    province: 'فارس',
    city: 'شیراز',
    streetAddress: 'بلوار تست، پلاک ۱۲',
    postalCode: '7131234567',
    deliverySlot: slotId,
    items: [{ productId, quantity: qty }],
    appliedCouponCode: coupon,
    paymentMethod: 'zarinpal',
  });
}

async function setStatusUi(page: Page, orderNumber: string, status: string) {
  // Narrow the list to this order first (the list is paginated and shows 20 orders).
  await page.getByPlaceholder(ORDER_SEARCH).fill(orderNumber);
  await page.waitForTimeout(700);
  // The orders list renders a desktop and a mobile control for each order: use the visible one.
  const sel = page.getByLabel(`تغییر وضعیت سفارش ${orderNumber}`).filter({ visible: true }).first();
  await sel.waitFor({ state: 'visible', timeout: 15000 });
  const waiter = page.waitForResponse((r) => ['PATCH', 'POST'].includes(r.request().method()) && r.url().includes('/api/admin'), { timeout: 15000 });
  await sel.selectOption(status);
  // OUT_FOR_DELIVERY, DELIVERED and CANCELLED open an in-app confirmation first ("تغییر به ...").
  if (['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(status)) {
    const confirmBtn = page.getByRole('button', { name: /^تغییر به/ }).filter({ visible: true }).first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();
  }
  const resp = await waiter;
  return { status: resp.status(), body: await resp.json().catch(() => null) };
}

async function downloadFile(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), click()]);
  const file = await download.path();
  return { name: download.suggestedFilename(), bytes: fs.readFileSync(file) };
}

const hasBom = (b: Buffer) => b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;

test.setTimeout(240_000);

test.describe('p6-admin journey', () => {
  test.beforeAll(async ({ browser }) => {
    loadState();
    C.browser = browser;
    const creds = readAdminCreds();
    C.adminCtx = await newCtx(browser, 1);
    C.adminPage = await C.adminCtx.newPage();
    watchConsole(C.adminPage, 'admin-ui');
    C.adminPage.on('dialog', (d: any) => d.accept());
    C.anonCtx = await newCtx(browser, 50);
    C.anonPage = await C.anonCtx.newPage();
    watchConsole(C.anonPage, 'storefront');
    // Logged in on every worker start (a new browser context has no cookies).
    await C.adminPage.goto(BASE + '/login');
    await C.adminPage.getByRole('button', { name: /با کلمه عبور/ }).first().click();
    await C.adminPage.locator('#login-identifier').fill(creds.phone);
    await C.adminPage.locator('#login-password').fill(creds.password);
    const loginWaiter = C.adminPage.waitForResponse((r: any) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
    await C.adminPage.getByRole('button', { name: 'ورود به حساب کاربری' }).click();
    const loginResp = await loginWaiter;
    check('admin login via /login form (password tab)', loginResp.status() === 200, `status ${loginResp.status()}`);
    const me = await call(C.adminCtx, 1, 'GET', '/api/auth/me');
    S.adminUserId = me.body?.user?.id;
    check('logged-in account has ADMIN role', me.body?.user?.role === 'ADMIN');
    S.adminLoggedIn = true;
    saveState();
  });

  test.afterEach(async () => {
    saveState();
  });

  test.afterAll(async () => {
    // Safety net: the test product must stay hidden.
    if (S.productId && C.adminCtx) {
      await call(C.adminCtx, 1, 'POST', '/api/admin/products?action=status', { id: S.productId, isAvailable: false }).catch(() => {});
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const summary = {
      run: S.run,
      notes: S.notes,
      consoleByPage: S.consoleByPage,
      state: {
        productId: S.productId,
        productSlug: S.productSlug,
        existingProductId: S.existingProductId,
        existingProductSlug: S.existingProductSlug,
        validCouponCode: S.validCouponCode,
        expiredCouponCode: S.expiredCouponCode,
        order1Number: S.order1Number,
        order2Number: S.order2Number,
        manualOrderNumber: S.manualOrderNumber,
        closeDate: S.closeDate,
        returnId: S.returnId,
        reviewId: S.reviewId,
      },
    };
    fs.writeFileSync(path.join(OUT_DIR, 'p6-results.json'), JSON.stringify(summary, null, 2));
    saveState();
    for (const k of Object.keys(C)) {
      if (k === 'browser') continue;
      await C[k]?.close?.().catch(() => {});
    }
  });

  // ---------------------------------------------------------------- 1
  test('1. dashboard loads real numbers', async () => {
    const page = C.adminPage;
    await page.goto(BASE + '/admin');
    await page.waitForLoadState('networkidle');
    const body = await page.innerText('body');
    check('dashboard UI renders (title present)', body.includes('داشبورد و آمار کلی'));
    check('dashboard UI: no NaN/undefined/[object Object]', !/NaN|undefined|\[object Object\]/.test(body));
    check('dashboard UI: no visit counter label', !/بازدید/.test(body));
    const dash = await call(C.adminCtx, 1, 'GET', '/api/admin/dashboard');
    check('dashboard API 200', dash.status === 200, String(dash.status));
    const d = dash.body || {};
    check('dashboard API numeric revenueToday and revenueMonth', typeof d.revenueToday === 'number' && typeof d.revenueMonth === 'number', JSON.stringify({ revenueToday: d.revenueToday, revenueMonth: d.revenueMonth }));
    check('dashboard API has no visit counter field', !/visit|pageview|بازدید/i.test(JSON.stringify(d)));
    const m = body.match(/سفارش‌های امروز:\s*([۰-۹0-9]+)/);
    info('dashboard UI: today orders label', m ? m[0] : 'label not found');
    info('dashboard API: ordersByStatus', JSON.stringify(d.ordersByStatus || {}));
  });

  // ---------------------------------------------------------------- 2
  test('2a. create product in admin UI', async () => {
    const page = C.adminPage;
    S.productTitle = `P6 Test Honey ${S.run}`;
    await page.goto(BASE + '/admin/products');
    await page.getByRole('button', { name: 'افزودن محصول جدید به انبار' }).click();
    await page.locator('#prod-1').fill(S.productTitle);
    await page.locator('#prod-3').fill('150000');
    await page.locator('#prod-4').fill('100000');
    await page.locator('#prod-5').fill('50');
    await page.getByLabel('دسته‌بندی محصول').selectOption({ label: 'عسل و فرآورده‌های طبیعی' });
    if (await page.locator('#prod-8').count()) await page.locator('#prod-8').fill('توضیحات آزمایشی P6 برای بررسی نمایش کالا در فروشگاه.');
    const waiter = page.waitForResponse((r: any) => r.url().includes('/api/admin/products') && r.request().method() === 'POST', { timeout: 20000 });
    await page.getByRole('button', { name: 'ثبت قطعی در انبار شیراز' }).click();
    const resp = await waiter;
    const body = await resp.json().catch(() => ({} as any));
    check('product create returns 201', resp.status() === 201, `status ${resp.status()} ${body?.message || ''}`);
    const found = await adminProductByTitle(S.productTitle);
    check('new product in admin API with price 150000 and stock 50', !!found && found.price === 150000 && found.stock === 50, JSON.stringify({ price: found?.price, stock: found?.stock }));
    S.productId = found?.id || body?.product?.id;
    S.productSlug = found?.slug || body?.product?.slug;
    check('product id and slug known', !!S.productId && !!S.productSlug);
  });

  test('2b. storefront shows product; price edit reflected in storefront and quote', async () => {
    const page = C.adminPage;
    await page.goto(BASE + '/admin/products');
    const title = page.getByText(S.productTitle).filter({ visible: true }).first();
    await title.waitFor({ timeout: 15000 });
    const row = title.locator('xpath=ancestor::*[.//button[@title="ویرایش"]][1]');
    await row.getByRole('button', { name: 'ویرایش' }).filter({ visible: true }).first().click();
    await page.locator('#prod-3').fill('160000');
    const waiter = page.waitForResponse((r: any) => r.url().includes('/api/admin/products') && r.request().method() === 'PATCH', { timeout: 20000 });
    await page.getByRole('button', { name: 'ذخیره تغییرات محصول' }).click();
    const resp = await waiter;
    check('product price edit (PATCH) 200', resp.status() === 200, String(resp.status()));
    await page.keyboard.press('Escape').catch(() => {});
    const after = await adminProductByTitle(S.productTitle);
    check('admin API shows price 160000 after edit', after?.price === 160000, String(after?.price));

    const anon = C.anonPage;
    await anon.goto(BASE + `/products/${S.productSlug}`);
    await anon.waitForLoadState('networkidle');
    const text = await anon.innerText('body');
    check('storefront product page shows product title', text.includes(S.productTitle));
    check('storefront product page shows new price', priceForms(160000).some((p) => text.includes(p)));
    check('storefront product page has no old price', !priceForms(150000).some((p) => text.includes(p)));
    const q = await call(C.anonCtx, 50, 'POST', '/api/orders/quote', { items: [{ productId: S.productId, quantity: 1 }], city: 'شیراز', province: 'فارس' });
    const qs = JSON.stringify(q.body);
    check('quote (guest) prices at 160000, not 150000', qs.includes('160000') && !qs.includes('150000'), qs.slice(0, 160));
  });

  test('2c. hide product; negative price/stock rejected with Persian message', async () => {
    const hide = await call(C.adminCtx, 1, 'POST', '/api/admin/products?action=status', { id: S.productId, isAvailable: false });
    check('hide product via status endpoint', hide.status === 200 && hide.body?.product?.isAvailable === false, `${hide.status} ${hide.body?.message || ''}`);
    check('hidden product absent from storefront list', !(await publicProduct(S.productId)));
    const detail = await C.anonCtx.request.get(BASE + `/products/${S.productSlug}`, { failOnStatusCode: false });
    const detailText = await detail.text();
    check('hidden product detail page does not show the product', !detailText.includes(S.productTitle), `status ${detail.status()}`);

    const neg1 = await call(C.adminCtx, 1, 'PATCH', '/api/admin/products', { id: S.productId, price: -1 });
    check('negative price rejected (PATCH) with Persian message', neg1.status === 400 && /[؀-ۿ]/.test(neg1.body?.message || ''), `${neg1.status} ${neg1.body?.message || ''}`);
    const neg2 = await call(C.adminCtx, 1, 'PATCH', '/api/admin/products', { id: S.productId, stock: -3 });
    check('negative stock rejected (PATCH) with Persian message', neg2.status === 400 && /[؀-ۿ]/.test(neg2.body?.message || ''), `${neg2.status} ${neg2.body?.message || ''}`);
    const neg3 = await call(C.adminCtx, 1, 'POST', '/api/admin/products', { title: `P6 neg ${S.run}`, category: 'عسل و فرآورده‌های طبیعی', price: -10, costPrice: 1, stock: 1 });
    check('negative price rejected (create) with Persian message', neg3.status === 400 && /[؀-ۿ]/.test(neg3.body?.message || ''), `${neg3.status} ${neg3.body?.message || ''}`);

    // Legacy endpoint POST /api/admin {action:'updateProduct'} takes unvalidated updates. Probe on OUR product only.
    const legacy = await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'updateProduct', payload: { id: S.productId, updates: { price: -5 } } });
    const afterLegacy = await adminProductByTitle(S.productTitle);
    info('legacy POST /api/admin updateProduct with price -5', `http ${legacy.status}; stored price afterwards ${afterLegacy?.price}`);
    check('legacy updateProduct does not store a negative price', afterLegacy?.price !== -5, `stored ${afterLegacy?.price}`);
    const legacyStock = await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'updateProduct', payload: { id: S.productId, updates: { stock: -3 } } });
    const afterLegacyStock = await adminProductByTitle(S.productTitle);
    info('legacy POST /api/admin updateProduct with stock -3', `http ${legacyStock.status}; stored stock afterwards ${afterLegacyStock?.stock}`);
    check('legacy updateProduct does not store a negative stock', afterLegacyStock?.stock !== -3, `stored ${afterLegacyStock?.stock}`);
    await call(C.adminCtx, 1, 'PATCH', '/api/admin/products', { id: S.productId, price: 160000, stock: 50, isAvailable: false });
    const restored = await adminProductByTitle(S.productTitle);
    check('test product restored (160000, stock 50) and still hidden', restored?.price === 160000 && restored?.stock === 50 && restored?.isAvailable === false, JSON.stringify({ price: restored?.price, stock: restored?.stock, isAvailable: restored?.isAvailable }));

    // UI attempt with a negative price (the input may be blocked by the browser before the request).
    const page = C.adminPage;
    await page.goto(BASE + '/admin/products');
    const title = page.getByText(S.productTitle).filter({ visible: true }).first();
    await title.waitFor({ timeout: 15000 });
    await title.locator('xpath=ancestor::*[.//button[@title="ویرایش"]][1]').getByRole('button', { name: 'ویرایش' }).filter({ visible: true }).first().click();
    await page.locator('#prod-3').fill('-7');
    const putWaiter = page.waitForResponse((r: any) => r.url().includes('/api/admin/products') && r.request().method() === 'PATCH', { timeout: 5000 }).catch(() => null);
    await page.getByRole('button', { name: 'ذخیره تغییرات محصول' }).click();
    const putResp = await putWaiter;
    await page.waitForTimeout(800);
    const browserInvalid = await page.locator('#prod-3').evaluate((el: HTMLInputElement) => !el.checkValidity()).catch(() => false);
    const persianMsg = await page.getByText(/نمی‌تواند|نامعتبر|منفی|باید/).filter({ visible: true }).count();
    info('UI negative price feedback', `browserInvalid=${browserInvalid}; persianMessages=${persianMsg}; apiStatus=${putResp ? putResp.status() : 'no request'}`);
    check('UI negative price is blocked or reported', browserInvalid || persianMsg > 0 || (!!putResp && putResp.status() === 400), `apiStatus=${putResp ? putResp.status() : 'none'}`);
    await page.keyboard.press('Escape').catch(() => {});
    const stillOk = await adminProductByTitle(S.productTitle);
    check('UI negative price was not stored', stillOk?.price === 160000, String(stillOk?.price));
  });

  // ---------------------------------------------------------------- 3
  test('3. coupons: valid 10% applies, expired coupon rejected for a new customer', async () => {
    S.validCouponCode = `P6-VALID-${S.run}`;
    S.expiredCouponCode = `P6-OLD-${S.run}`;
    const v = await call(C.adminCtx, 1, 'POST', '/api/admin/coupons', {
      code: S.validCouponCode,
      title: `P6 تست ۱۰٪ ${S.run}`,
      targetType: 'ALL_PRODUCTS',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      usageLimit: 2,
      expiresAt: '2027-12-29',
    });
    check('valid coupon created (10%, usage limit 2, future expiry)', v.status === 201 || v.status === 200, `${v.status} ${v.body?.message || ''}`);
    const e = await call(C.adminCtx, 1, 'POST', '/api/admin/coupons', {
      code: S.expiredCouponCode,
      title: `P6 منقضی ${S.run}`,
      targetType: 'ALL_PRODUCTS',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      usageLimit: 5,
      expiresAt: '2025-01-01',
    });
    check('expired coupon created (expiry in the past)', e.status === 201 || e.status === 200, `${e.status} ${e.body?.message || ''}`);

    const list = await call(C.anonCtx, 50, 'GET', '/api/products?limit=200');
    const existing = ((list.body?.products || []) as any[]).find((p) => p.isAvailable !== false && p.stock >= 8 && p.price > 0 && p.id !== S.productId);
    check('existing visible product with stock >= 8 for customer tests', !!existing);
    S.existingProductId = existing?.id;
    S.existingProductSlug = existing?.slug;

    const c1 = await cust('c1', 20, `مشتری P6 یک ${S.run}`);
    const valid = await call(c1, 20, 'POST', '/api/coupons', { code: S.validCouponCode, items: [{ productId: S.existingProductId, quantity: 2 }], address: { city: 'شیراز', province: 'فارس' } });
    check('valid coupon accepted in customer cart (valid=true)', valid.body?.valid === true && (valid.body?.discountAmount || 0) > 0, JSON.stringify(valid.body).slice(0, 220));
    const expired = await call(c1, 20, 'POST', '/api/coupons', { code: S.expiredCouponCode, items: [{ productId: S.existingProductId, quantity: 2 }], address: { city: 'شیراز', province: 'فارس' } });
    check('expired coupon rejected in customer cart (valid=false)', expired.body?.valid === false && typeof expired.body?.message === 'string', JSON.stringify(expired.body).slice(0, 220));
    check('expired coupon rejection uses success:false', expired.body?.success === false, `success=${expired.body?.success}`);
    info('coupon rejection messages', `expired: ${expired.body?.message || '-'}`);

    const cpage = await c1.newPage();
    watchConsole(cpage, 'customer-1-cart');
    await cpage.goto(BASE + '/cart');
    await cpage.waitForLoadState('networkidle');
    check('customer cart page renders without error boundary', !/Application error|Something went wrong/i.test(await cpage.innerText('body')));
    await cpage.close();
  });

  // ---------------------------------------------------------------- 4
  test('4a. customer order paid through the mock gateway; coupon applied', async () => {
    const c1 = await cust('c1', 20, `مشتری P6 یک ${S.run}`);
    const slot = await pickFreeSlot(c1, 20);
    check('a bookable free-tier slot exists within 14 days', !!slot, slot ? slot.id : 'none');
    S.slotId = slot?.id;
    S.slotIsoDate = slot?.isoDate;
    S.slotShort = slot?.shortDate;
    S.stockBeforeOrder1 = (await publicProduct(S.existingProductId))?.stock;
    const created = await placeOrder(c1, 20, S.c1Phone, S.slotId, S.existingProductId, S.validCouponCode, 2);
    check('order POST accepted (zarinpal)', created.status === 200 || created.status === 201, `${created.status} ${created.body?.message || ''}`);
    const orderNumber = created.body?.order?.orderNumber;
    S.order1Number = orderNumber;
    check('order1 applied the valid coupon with a discount', created.body?.order?.couponCode === S.validCouponCode && (created.body?.order?.couponDiscountAmount || 0) > 0, JSON.stringify({ code: created.body?.order?.couponCode, disc: created.body?.order?.couponDiscountAmount, total: created.body?.order?.totalAmount }));
    if (!created.body?.paymentUrl) {
      check('order1 has a mock gateway payment URL', false, `no paymentUrl; ${JSON.stringify(created.body).slice(0, 200)}`);
      return;
    }
    S.order1Total = created.body?.order?.totalAmount;
    const payPage = await c1.newPage();
    watchConsole(payPage, 'customer-1-pay');
    const landed = await payOnline(payPage, created.body.paymentUrl);
    await payPage.close();
    check('mock gateway success lands on success/account page', /checkout\/success|account|orders/.test(landed), landed);
    const mine = await call(c1, 20, 'GET', `/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`);
    const o = mine.body?.order;
    check('order1 is PROCESSING with a successful payment', o?.status === 'PROCESSING' && o?.payment?.status === 'SUCCESS', JSON.stringify({ status: o?.status, pay: o?.payment?.status }));
    S.stockAfterOrder1 = (await publicProduct(S.existingProductId))?.stock;
    info('existing product stock before order1 / after order1', `${S.stockBeforeOrder1} -> ${S.stockAfterOrder1}`);
  });

  test('4b. admin moves order1 through statuses; customer sees each step; order2 cancelled by admin restores stock and coupon use', async () => {
    const c1 = await cust('c1', 20, `مشتری P6 یک ${S.run}`);
    const page = C.adminPage;
    await page.goto(BASE + '/admin/orders');
    await page.getByPlaceholder(ORDER_SEARCH).fill(S.order1Number);
    await page.waitForTimeout(800);
    const current = await getAdminOrder(S.order1Number);
    check('order1 visible in admin orders list', !!current);
    check('order1 is PROCESSING before the moves', current?.status === 'PROCESSING', current?.status);
    const sel = page.getByLabel(`تغییر وضعیت سفارش ${S.order1Number}`).filter({ visible: true }).first();
    await sel.waitFor({ state: 'visible', timeout: 15000 });
    const values: string[] = await sel.locator('option').evaluateAll((opts: any[]) => opts.map((o) => o.value));
    const expectedSet = [current?.status, ...(current?.allowedNextStatuses || [])].sort();
    check('status dropdown offers only the current and allowed next statuses', JSON.stringify([...values].sort()) === JSON.stringify(expectedSet), `dropdown=${values.join(',')} allowed=${(current?.allowedNextStatuses || []).join(',')}`);
    check('dropdown does not offer PENDING_PAYMENT for a paid order', !values.includes('PENDING_PAYMENT'));

    const s1 = await setStatusUi(page, S.order1Number, 'OUT_FOR_DELIVERY');
    check('admin UI PROCESSING -> OUT_FOR_DELIVERY succeeded', s1.status === 200, `${s1.status} ${s1.body?.message || ''}`);
    await page.waitForTimeout(500);
    const s2 = await setStatusUi(page, S.order1Number, 'DELIVERED');
    check('admin UI OUT_FOR_DELIVERY -> DELIVERED succeeded', s2.status === 200, `${s2.status} ${s2.body?.message || ''}`);
    const done = await getAdminOrder(S.order1Number);
    check('order1 is DELIVERED', done?.status === 'DELIVERED', done?.status);

    const cpage = await c1.newPage();
    watchConsole(cpage, 'customer-1-account');
    await cpage.goto(BASE + '/account');
    await cpage.waitForLoadState('networkidle');
    // Order history lives in the "سفارش‌ها و مرجوعی‌ها" tab of the account page.
    await cpage.getByRole('button', { name: /سفارش‌ها و مرجوعی‌ها/ }).filter({ visible: true }).first().click();
    await cpage.waitForTimeout(800);
    check('customer account orders tab lists order1', (await cpage.innerText('body')).includes(S.order1Number));
    const mine = await call(c1, 20, 'GET', `/api/orders?orderNumber=${encodeURIComponent(S.order1Number)}`);
    check('customer API shows order1 DELIVERED', mine.body?.order?.status === 'DELIVERED', mine.body?.order?.status);
    await cpage.close();

    // ---- order2: paid, then cancelled by admin
    const stockBeforeOrder2 = (await publicProduct(S.existingProductId))?.stock;
    const created2 = await placeOrder(c1, 20, S.c1Phone, S.slotId, S.existingProductId, S.validCouponCode, 1);
    S.order2Number = created2.body?.order?.orderNumber;
    check('order2 created', !!S.order2Number, `${created2.status} ${created2.body?.message || ''}`);
    if (created2.body?.paymentUrl) {
      const pp = await c1.newPage();
      await payOnline(pp, created2.body.paymentUrl);
      await pp.close();
    }
    const paid2 = await getAdminOrder(S.order2Number);
    check('order2 is PROCESSING after payment', paid2?.status === 'PROCESSING', paid2?.status);
    const usageAfterPaid = (await call(C.adminCtx, 1, 'GET', '/api/admin/coupons')).body?.coupons?.find((c: any) => c.code === S.validCouponCode)?.usageCount;
    info('coupon usageCount after order2 paid', String(usageAfterPaid));
    const c3 = await cust('c3', 22, `مشتری P6 سه ${S.run}`);
    const c3Limit = await call(c3, 22, 'POST', '/api/coupons', { code: S.validCouponCode, items: [{ productId: S.existingProductId, quantity: 1 }], address: { city: 'شیراز', province: 'فارس' } });
    info('coupon at usage limit: new customer validation', JSON.stringify(c3Limit.body).slice(0, 180));
    check('coupon at usage limit (2 of 2) is rejected for a new customer', c3Limit.body?.valid === false, JSON.stringify({ valid: c3Limit.body?.valid, msg: c3Limit.body?.message }));

    const cancelled = await setStatusUi(page, S.order2Number, 'CANCELLED');
    check('admin cancels order2 from the dropdown', cancelled.status === 200, `${cancelled.status} ${cancelled.body?.message || ''}`);
    const stockAfterCancel = (await publicProduct(S.existingProductId))?.stock;
    check('cancel restores stock of order2', stockAfterCancel === stockBeforeOrder2, `before=${stockBeforeOrder2} afterPaid=${S.stockAfterOrder1} afterCancel=${stockAfterCancel}`);
    const usageAfterCancel = (await call(C.adminCtx, 1, 'GET', '/api/admin/coupons')).body?.coupons?.find((c: any) => c.code === S.validCouponCode)?.usageCount;
    check('cancel returns the coupon use (usageCount -1)', usageAfterCancel === (usageAfterPaid ?? 0) - 1, `afterPaid=${usageAfterPaid} afterCancel=${usageAfterCancel}`);
    const c3Again = await call(c3, 22, 'POST', '/api/coupons', { code: S.validCouponCode, items: [{ productId: S.existingProductId, quantity: 1 }], address: { city: 'شیراز', province: 'فارس' } });
    check('coupon usable again after the cancel', c3Again.body?.valid === true, JSON.stringify({ valid: c3Again.body?.valid, msg: c3Again.body?.message }));
  });

  // ---------------------------------------------------------------- 5
  test('5. manual cash-on-delivery order created by admin', async () => {
    S.manualPhone = newPhone();
    const r = await call(C.adminCtx, 1, 'POST', '/api/admin/manual-order', {
      customer: { name: `مشتری "دستی" P6 ${S.run}`, phone: S.manualPhone },
      address: { city: 'شیراز', province: 'فارس', streetAddress: 'خیابان "تست" ۵', postalCode: '7131234567' },
      items: [{ productId: S.existingProductId, quantity: 1 }],
      slotId: S.slotId,
      paymentMethod: 'cash',
    });
    check('manual COD order created (201)', r.status === 201, `${r.status} ${r.body?.message || ''}`);
    S.manualOrderNumber = r.body?.order?.orderNumber;
    check('manual order is PENDING_PAYMENT (COD)', r.body?.order?.status === 'PENDING_PAYMENT', r.body?.order?.status);
    check('manual order source is ADMIN_MANUAL', r.body?.order?.source === 'ADMIN_MANUAL', r.body?.order?.source);
    const page = C.adminPage;
    await page.goto(BASE + '/admin/orders');
    await page.getByPlaceholder(ORDER_SEARCH).fill(S.manualOrderNumber || 'none');
    await page.waitForTimeout(800);
    check('manual order appears in admin orders list', (await page.getByLabel(`تغییر وضعیت سفارش ${S.manualOrderNumber}`).count()) > 0);
    info('manual order list: visible status controls', String(await page.getByLabel(`تغییر وضعیت سفارش ${S.manualOrderNumber}`).filter({ visible: true }).count()));
    await page.getByPlaceholder(ORDER_SEARCH).fill('');
  });

  // ---------------------------------------------------------------- 6
  test('6. manifest: orders listed, CSV export (BOM, Persian, escaped quotes), capacity close and reopen', async () => {
    const page = C.adminPage;
    await page.goto(BASE + '/admin/manifest');
    await page.waitForLoadState('networkidle');
    const body = await page.innerText('body');
    check('manifest lists the manual COD customer (name with quotes)', body.includes('مشتری "دستی"'), 'name search');
    check('manifest renders without error boundary', !/Application error|Something went wrong/i.test(body));
    // Day filter as the manifest uses it (status=DELIVERABLE and the slot date).
    const byDay = await call(C.adminCtx, 1, 'GET', `/api/admin/orders?status=DELIVERABLE&date=${S.slotIsoDate}&pageSize=100`);
    const dayNumbers = ((byDay.body?.orders || []) as any[]).map((o) => o.orderNumber);
    check('slot-date filter lists order1 (delivered) and the manual COD order', dayNumbers.includes(S.order1Number) && dayNumbers.includes(S.manualOrderNumber), `day ${S.slotIsoDate}: ${dayNumbers.length} orders`);
    check('slot-date filter excludes cancelled order2', !dayNumbers.includes(S.order2Number));
    // UI: open the capacity panel and pick the day card, if the card is present.
    const capToggle = page.getByRole('button', { name: /مدیریت ظرفیت روزها/ }).filter({ visible: true }).first();
    if (await capToggle.count()) await capToggle.click().catch(() => {});
    const dayCard = page.getByRole('button', { name: new RegExp(S.slotShort || 'NO_SUCH_DAY') }).filter({ visible: true }).first();
    if (S.slotShort && (await dayCard.count())) {
      await dayCard.click().catch(() => {});
      await page.waitForTimeout(800);
      const filtered = await page.innerText('body');
      check('manifest UI day filter shows the manual COD customer', filtered.includes('مشتری "دستی"'));
      await page.getByRole('button', { name: /حذف فیلتر روز/ }).filter({ visible: true }).first().click().catch(() => {});
      await page.waitForTimeout(500);
    } else {
      info('manifest UI day card', `not found for ${S.slotShort || '-'}; slot-date filter checked via API`);
    }
    const exported = await downloadFile(page, () => page.getByRole('button', { name: /خروجی اکسل/ }).click());
    check('manifest CSV has UTF-8 BOM', hasBom(exported.bytes), exported.name);
    const text = exported.bytes.toString('utf8');
    check('manifest CSV contains readable Persian', /[؀-ۿ]{3,}/.test(text));
    check('manifest CSV escapes double quotes ("" inside a quoted field)', text.includes('""دستی""'), text.includes('دستی') ? 'name present' : 'name absent');
    info('manifest CSV file name', exported.name);

    // Capacity: close a delivery day 12 to 14 days ahead (never sooner, Friday excluded), then reopen it.
    const anon = await call(C.anonCtx, 50, 'GET', '/api/delivery-slots?days=14');
    const cands = ((anon.body?.slots || []) as any[]).filter((s) => {
      const d = dayDiff(s.isoDate);
      return d >= 12 && d <= 14 && s.dayOfWeekIndex !== 5;
    });
    const target = cands[cands.length - 1];
    check('a delivery day 12-14 days ahead exists for the closure test', !!target, JSON.stringify(cands.map((c) => c.isoDate)));
    if (!target) return;
    S.closeDate = target.isoDate;
    const closedSlotId = target.id;
    const originalMax = target.maxCapacity;
    const closeRes = await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'toggleDayClosed', payload: { isoDate: S.closeDate, closed: true } });
    check('admin closes the day (toggleDayClosed)', closeRes.status === 200 && closeRes.body?.success === true, String(closeRes.status));
    const closedView = ((await call(C.anonCtx, 50, 'GET', '/api/delivery-slots?days=14')).body?.slots || []).find((s: any) => s.isoDate === S.closeDate);
    check('customer GET /api/delivery-slots shows the day closed', closedView?.isClosed === true, JSON.stringify({ isClosed: closedView?.isClosed }));
    const c1 = await cust('c1', 20, `مشتری P6 یک ${S.run}`);
    const tryBook = await placeOrder(c1, 20, S.c1Phone, closedSlotId, S.existingProductId, null, 1);
    info('booking into the closed day', `${tryBook.status} ${tryBook.body?.message || ''}`);
    check('booking into a closed day is refused', tryBook.status >= 400, `${tryBook.status} ${tryBook.body?.message || ''}`);
    const cap = await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'setDailyCapacity', payload: { isoDate: S.closeDate, maxOrders: originalMax + 1 } });
    check('admin sets capacity for that day', cap.status === 200 && cap.body?.success === true, String(cap.status));
    await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'setDailyCapacity', payload: { isoDate: S.closeDate, maxOrders: originalMax } });
    const reopen = await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'toggleDayClosed', payload: { isoDate: S.closeDate, closed: false } });
    check('admin reopens the day', reopen.status === 200, String(reopen.status));
    const openView = ((await call(C.anonCtx, 50, 'GET', '/api/delivery-slots?days=14')).body?.slots || []).find((s: any) => s.isoDate === S.closeDate);
    check('customer GET /api/delivery-slots shows the day open again', openView?.isClosed === false, JSON.stringify({ isClosed: openView?.isClosed, max: openView?.maxCapacity }));
    S.closeDate = undefined; // leave no closure behind
  });

  // ---------------------------------------------------------------- 7
  test('7. finance: today includes paid orders, excludes cancelled/unpaid; CSV export', async () => {
    const fin = await call(C.adminCtx, 1, 'GET', `/api/admin/finance?period=day&date=${tehranToday()}`);
    check('finance day report 200', fin.status === 200, String(fin.status));
    const summary = fin.body?.summary || {};
    const records: any[] = fin.body?.records || [];
    const sumNet = records.reduce((acc, r) => acc + Number(r.netPayableAmount || 0), 0);
    check('finance includes paid order1', records.some((r) => r.orderNumber === S.order1Number), String(S.order1Number));
    check('finance excludes cancelled order2', !records.some((r) => r.orderNumber === S.order2Number), String(S.order2Number));
    check('finance excludes unpaid manual COD order (not delivered)', !records.some((r) => r.orderNumber === S.manualOrderNumber), String(S.manualOrderNumber));
    check('finance netRevenue equals sum of its records (netPayableAmount)', summary.netRevenue === sumNet, `summary=${summary.netRevenue} records=${sumNet}`);
    const unpaidSeen = records.filter((r) => r.paymentStatus !== 'SUCCESS' || r.orderStatus === 'CANCELLED' || r.orderStatus === 'PENDING_PAYMENT').length;
    check('no unpaid or cancelled record in the finance list', unpaidSeen === 0, `${unpaidSeen} such records`);
    const page = C.adminPage;
    await page.goto(BASE + '/admin/finance');
    await page.waitForLoadState('networkidle');
    check('finance page renders revenue text', (await page.innerText('body')).includes('فروش'));
    const exported = await downloadFile(page, () => page.getByRole('button', { name: /دانلود فایل اکسل/ }).click());
    check('finance CSV has UTF-8 BOM', hasBom(exported.bytes), exported.name);
    check('finance CSV has Persian headers', exported.bytes.toString('utf8').includes('شماره سفارش'));
  });

  // ---------------------------------------------------------------- 8
  test('8. CMS: change a home-page text, see it on storefront, restore original', async () => {
    const got = await call(C.adminCtx, 1, 'GET', '/api/admin?type=siteContent');
    const content = got.body?.content ?? got.body?.siteContent ?? got.body;
    const original = content?.heroBadgeText;
    check('siteContent has heroBadgeText', typeof original === 'string' && original.length > 0, typeof original);
    const marker = `P6 تست ${S.run}`;
    const up = await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'updateSiteContent', payload: { content: { ...content, heroBadgeText: marker } } });
    check('CMS update accepted', up.status === 200 && up.body?.success === true, String(up.status));
    const pub = await call(C.anonCtx, 50, 'GET', '/api/site-content');
    check('public site-content returns the new text', JSON.stringify(pub.body).includes(marker));
    await C.anonPage.goto(BASE + '/');
    await C.anonPage.waitForLoadState('networkidle');
    check('storefront home shows the new text', (await C.anonPage.innerText('body')).includes(marker));
    const restore = await call(C.adminCtx, 1, 'POST', '/api/admin', { action: 'updateSiteContent', payload: { content: { ...content, heroBadgeText: original } } });
    check('CMS original text restored', restore.status === 200);
    const back = await call(C.anonCtx, 50, 'GET', '/api/site-content');
    check('public site-content back to the original', !JSON.stringify(back.body).includes(marker));
    await C.adminPage.goto(BASE + '/admin/cms');
    await C.adminPage.waitForLoadState('networkidle');
    check('CMS page renders without error boundary', !/Application error/i.test(await C.adminPage.innerText('body')));
  });

  // ---------------------------------------------------------------- 9
  test('9a. review: customer submits after delivery, admin approves and replies', async () => {
    const c1 = await cust('c1', 20, `مشتری P6 یک ${S.run}`);
    const comment = `تست بررسی خودکار P6 ${S.run} کیفیت عالی`;
    const r = await call(c1, 20, 'POST', '/api/reviews', { productSlug: S.existingProductSlug, rating: 5, title: 'P6', comment, isRecommended: true });
    check('customer review accepted for a delivered order', r.status === 200 || r.status === 201, `${r.status} ${r.body?.message || ''}`);
    const pend = await call(C.adminCtx, 1, 'GET', '/api/admin/reviews?status=PENDING&pageSize=50');
    const rv = ((pend.body?.reviews || []) as any[]).find((x) => x.comment === comment);
    check('review appears in admin pending list', !!rv, `pending=${(pend.body?.reviews || []).length}`);
    S.reviewId = rv?.id;
    const ap = await call(C.adminCtx, 1, 'PATCH', '/api/admin/reviews', { id: S.reviewId, status: 'APPROVED', adminReply: `پاسخ مدیریت P6 ${S.run}` });
    check('admin approves review with a reply', ap.status === 200, `${ap.status} ${ap.body?.message || ''}`);
    await C.anonPage.goto(BASE + `/products/${S.existingProductSlug}`);
    await C.anonPage.waitForLoadState('networkidle');
    // Approved reviews sit in the "دیدگاه‌ها و نظرات" tab of the product page.
    await C.anonPage.getByRole('button', { name: /دیدگاه‌ها و نظرات|نظرات \(/ }).filter({ visible: true }).first().click();
    await C.anonPage.waitForTimeout(800);
    const t = await C.anonPage.innerText('body');
    const pubReviews = await call(C.anonCtx, 50, 'GET', `/api/reviews?productSlug=${encodeURIComponent(S.existingProductSlug)}`);
    info('public reviews API for product', JSON.stringify(pubReviews.body).slice(0, 200));
    check('product page shows the approved review', t.includes(comment.slice(0, 30)));
    check('product page shows the admin reply', t.includes(`پاسخ مدیریت P6 ${S.run}`));
    const rp = await C.adminPage.goto(BASE + '/admin/reviews');
    check('admin reviews page loads', !!rp && rp.status() < 400);
  });

  test('9b. return: request, approve, refund <= paid; over-limit refund rejected', async () => {
    const c1 = await cust('c1', 20, `مشتری P6 یک ${S.run}`);
    const detail = await call(c1, 20, 'GET', `/api/orders?orderNumber=${encodeURIComponent(S.order1Number)}`);
    const line = detail.body?.order?.items?.[0];
    const paid = detail.body?.order?.totalAmount;
    const rq = await call(c1, 20, 'POST', '/api/returns', { orderNumber: S.order1Number, reason: 'DAMAGE', description: `تست P6 ${S.run}`, items: [{ productId: S.existingProductId, quantity: 1 }] });
    check('customer return request accepted for the delivered order', rq.status === 200 || rq.status === 201, `${rq.status} ${rq.body?.message || ''}`);
    const list = await call(C.adminCtx, 1, 'GET', '/api/admin/returns?status=PENDING');
    const ret = ((list.body?.returns || []) as any[]).find((r) => r.orderNumber === S.order1Number);
    S.returnId = ret?.id;
    check('return request visible to admin', !!ret);
    const ap = await call(C.adminCtx, 1, 'PATCH', '/api/admin/returns', { id: S.returnId, status: 'APPROVED', adminNote: 'تایید آزمایشی P6' });
    check('admin approves the return', ap.status === 200, `${ap.status} ${ap.body?.message || ''}`);
    const over = await call(C.adminCtx, 1, 'PATCH', '/api/admin/returns', { id: S.returnId, status: 'REFUNDED', refundAmount: (paid || 0) + 1000 });
    check('over-limit refund rejected', over.status >= 400, `${over.status} ${over.body?.message || ''}`);
    const refundAmount = Math.min(paid || 0, line?.totalPrice || paid || 0);
    const ok = await call(C.adminCtx, 1, 'PATCH', '/api/admin/returns', { id: S.returnId, status: 'REFUNDED', refundAmount, adminNote: 'عودت آزمایشی P6' });
    check('refund with amount <= paid accepted', ok.status === 200, `${ok.status} ${ok.body?.message || ''} amount=${refundAmount} paid=${paid}`);
    const fin = ((await call(C.adminCtx, 1, 'GET', '/api/admin/returns?status=REFUNDED')).body?.returns || []).find((r: any) => r.id === S.returnId);
    check('return shows REFUNDED with the refund amount', fin?.status === 'REFUNDED' && fin?.refundAmount === refundAmount, JSON.stringify({ s: fin?.status, a: fin?.refundAmount }));
  });

  // ---------------------------------------------------------------- 10
  test('10. users: promote a new customer to ADMIN, they log in, then demote and access is refused', async () => {
    await cust('c2', 21, `مدیر آزمایشی P6 ${S.run}`);
    const password = pwFor(S.c2Phone);
    const promote = await call(C.adminCtx, 1, 'PATCH', '/api/admin/users', { id: S.c2Id, role: 'ADMIN' });
    check('admin promotes account to ADMIN', promote.status === 200, `${promote.status} ${promote.body?.message || ''}`);

    C.c2Admin = await newCtx(C.browser, 23);
    const p2 = await C.c2Admin.newPage();
    watchConsole(p2, 'promoted-admin-ui');
    await p2.goto(BASE + '/login');
    await p2.getByRole('button', { name: /با کلمه عبور/ }).first().click();
    await p2.locator('#login-identifier').fill(S.c2Phone);
    await p2.locator('#login-password').fill(password);
    const lw = p2.waitForResponse((r: any) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
    await p2.getByRole('button', { name: 'ورود به حساب کاربری' }).click();
    check('promoted account logs in with its password', (await lw).status() === 200);
    await p2.goto(BASE + '/admin');
    await p2.waitForLoadState('networkidle');
    check('promoted account can open /admin', (await p2.innerText('body')).includes('داشبورد و آمار کلی'));
    const apiOk = await call(C.c2Admin, 23, 'GET', '/api/admin/dashboard');
    check('promoted account can call an admin API', apiOk.status === 200, String(apiOk.status));

    const demote = await call(C.adminCtx, 1, 'PATCH', '/api/admin/users', { id: S.c2Id, role: 'USER' });
    check('admin demotes the account back to USER', demote.status === 200, `${demote.status} ${demote.body?.message || ''}`);
    const refused = await call(C.c2Admin, 23, 'GET', '/api/admin/dashboard');
    check('demoted account refused on its next admin API call (403)', refused.status === 403, String(refused.status));
    const refusedWrite = await call(C.c2Admin, 23, 'PATCH', '/api/admin/orders', { orderId: S.order1Number, status: 'CANCELLED' });
    check('demoted account cannot change an order (refused)', refusedWrite.status === 403 || refusedWrite.status === 401, String(refusedWrite.status));
    const pageReq = await C.c2Admin.request.get(BASE + '/admin', { maxRedirects: 0, failOnStatusCode: false });
    info('demoted account: GET /admin (no redirect followed) status', String(pageReq.status()));
    await p2.goto(BASE + '/admin');
    await p2.waitForLoadState('networkidle');
    const body2 = await p2.innerText('body');
    info('demoted account: /admin page text (first 160 chars)', body2.replace(/\s+/g, ' ').slice(0, 160));
    check('demoted account no longer sees the admin dashboard', !body2.includes('داشبورد و آمار کلی'), p2.url());
    const selfDemote = await call(C.adminCtx, 1, 'PATCH', '/api/admin/users', { id: S.adminUserId, role: 'USER' });
    check('main admin cannot demote self', selfDemote.status === 400, `${selfDemote.status} ${selfDemote.body?.message || ''}`);
  });

  // ---------------------------------------------------------------- 11
  test('11. SMS broadcast with confirmation (MOCK) and bulk inquiry status change', async () => {
    const sms = await call(C.adminCtx, 1, 'GET', '/api/admin/sms-settings');
    const provider = sms.body?.settings?.provider ?? sms.body?.provider;
    info('SMS provider (settings)', String(provider));
    const noConfirm = await call(C.adminCtx, 1, 'POST', '/api/admin/sms-broadcast', { segment: 'PRO', message: 'P6 test' });
    check('broadcast without explicit confirm is refused', noConfirm.status === 400, `${noConfirm.status} ${noConfirm.body?.message || ''}`);
    const count = await call(C.adminCtx, 1, 'GET', '/api/admin/sms-broadcast?segment=PRO');
    info('PRO segment recipientCount', String(count.body?.recipientCount));
    if (provider !== 'MOCK') {
      check('SMS provider is MOCK, so no real SMS is sent', false, String(provider));
    } else {
      const send = await call(C.adminCtx, 1, 'POST', '/api/admin/sms-broadcast', { segment: 'PRO', message: `پیام آزمایشی P6 ${S.run} - لطفاً نادیده بگیرید`, confirm: true });
      const res = send.body?.broadcast ?? send.body ?? {};
      const sent = Number(res.sentCount);
      const failed = Number(res.failedCount);
      const recipients = Number(res.recipientCount);
      check('broadcast to PRO (small segment) returns counts', (send.status === 200 || send.status === 201) && Number.isFinite(sent), `${send.status} ${send.body?.message || ''}`);
      info('SMS broadcast result (MOCK)', JSON.stringify({ recipientCount: recipients, sentCount: sent, failedCount: failed }));
      check('SMS sent + failed equals recipients', sent + failed === recipients, `sent=${sent} failed=${failed} recipients=${recipients}`);
    }

    const message = `استعلام آزمایشی P6 ${S.run}`;
    const bi = await C.anonCtx.request.fetch(BASE + '/api/bulk-inquiries', {
      method: 'POST',
      headers: hdr(50),
      data: { name: `P6 ${S.run}`, phone: newPhone(), city: 'شیراز', message },
      failOnStatusCode: false,
    });
    check('bulk inquiry submitted (guest)', bi.status() === 200 || bi.status() === 201, String(bi.status()));
    const list = await call(C.adminCtx, 1, 'GET', '/api/bulk-inquiries');
    const mine = ((list.body?.inquiries || []) as any[]).find((x) => x.message === message);
    check('bulk inquiry listed for admin', !!mine);
    await C.adminPage.goto(BASE + '/admin/bulk');
    await C.adminPage.waitForLoadState('networkidle');
    check('bulk page lists the inquiry', (await C.adminPage.innerText('body')).includes(`P6 ${S.run}`));
    const st = await call(C.adminCtx, 1, 'PATCH', '/api/bulk-inquiries', { id: mine?.id, status: 'REVIEWED' });
    check('bulk inquiry status change to REVIEWED', st.status === 200, `${st.status} ${st.body?.message || ''}`);
    const st2 = await call(C.adminCtx, 1, 'PATCH', '/api/bulk-inquiries', { id: mine?.id, status: 'COMPLETED' });
    check('bulk inquiry status change to COMPLETED', st2.status === 200, `${st2.status} ${st2.body?.message || ''}`);
  });

  // ---------------------------------------------------------------- 12
  test('12. admin pages: console errors, error states, mobile 375px overflow', async () => {
    const paths = ['/admin', '/admin/products', '/admin/orders', '/admin/manifest', '/admin/coupons', '/admin/cms', '/admin/finance', '/admin/payment', '/admin/returns', '/admin/reviews', '/admin/sms', '/admin/subscriptions', '/admin/users', '/admin/bulk'];
    const page = C.adminPage;
    for (const p of paths) {
      const errs: string[] = [];
      const onErr = (m: any) => {
        if (m.type() === 'error') errs.push(m.text().slice(0, 160));
      };
      const onPageErr = (e: Error) => errs.push('PAGEERROR ' + e.message.slice(0, 160));
      page.on('console', onErr);
      page.on('pageerror', onPageErr);
      const res = await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => null);
      page.off('console', onErr);
      page.off('pageerror', onPageErr);
      const body = await page.innerText('body').catch(() => '');
      const broken = /Application error|Something went wrong|Unhandled Runtime Error/i.test(body);
      check(`${p} loads without error boundary`, !!res && res.status() < 400 && !broken, `status ${res?.status()}`);
      info(`${p} console errors`, errs.length ? errs.slice(0, 3).join(' | ') : 'none');
    }
    for (const p of ['/admin', '/admin/orders']) {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${p} at 375px has no horizontal page overflow`, overflow <= 0, `overflow ${overflow}px`);
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  });
});
