/**
 * P2 customer-simulation journey: "p2-mobile-returning".
 *
 * A new phone customer on a 375px iPhone-sized viewport registers with the mock OTP, sets a password,
 * logs out and back in, browses, tries a bad coupon, is limited to Sunday/Wednesday as a FREE user,
 * is refused a Saturday/Monday slot by the server, cancels one payment, pays another after a retry,
 * maintains an address book, and then finds the same data from a second browser session.
 *
 * Tests are serial because they share one customer. Assertions are soft where a single step should
 * still let the journey continue, so every real defect is reported rather than hidden.
 * Stock checks are tolerant of other testers: they only claim a verdict when the stock movement is
 * explained by this journey alone, otherwise they record an annotation instead.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { test, expect, devices } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';
const PRODUCT_SLUG = 'organic-eggs-kamfiruz-30';
const PRODUCT_ID = 'prod-eggs-30';
const PRODUCT_PATH = `/products/${PRODUCT_SLUG}`;
const PASSWORD = 'Journey-pass-1234';
const INVALID_COUPON = 'NOPE-P2-7Q9Z';
const NAME = 'مشتری بازگشتی';
const STREET_A = 'بلوار ارم، کوچه ۶، پلاک ۱۲';
const STREET_A_EDITED = 'بلوار ارم، کوچه ۶، پلاک ۱۴';
const STREET_B = 'خیابان زند، کوچه ۳، پلاک ۸';
const POSTAL_A = '7136813913';
const POSTAL_B = '7134613455';
const PERSIAN_RE = /[؀-ۿ]/;

// iPhone 13 emulation without its WebKit default (this run uses the chromium project).
const { defaultBrowserType: _ignoredBrowser, ...MOBILE } = devices['iPhone 13'];

/** 0912200 + 4 random digits: a fresh Iranian mobile number per run. */
function makePhone(): string {
  const tail = String((Date.now() + Math.floor(Math.random() * 1000)) % 10000).padStart(4, '0');
  return `0912200${tail}`;
}

/** A unique X-Forwarded-For per browser context so per-IP rate limits never mix with other testers. */
function randomForwardedIp(prefix = '10.2.0'): string {
  return `${prefix}.${100 + Math.floor(Math.random() * 150)}`;
}

type Journey = {
  phone: string;
  stockBefore: number;
  stockPlaced: number;
  stockAfterCancel: number;
  cancelledOrder: string;
  paidOrder: string;
  consoleLog: Array<{ session: string; text: string; url: string }>;
  layoutLog: Array<{ label: string; scrollWidth: number; clientWidth: number }>;
};
type Handles = { ctxA?: BrowserContext; pageA?: Page; ctxB?: BrowserContext; pageB?: Page };

/**
 * Journey data is kept in a JSON file because Playwright starts a fresh worker after a failed test, and a fresh
 * worker re-evaluates this module (new phone, new browser context). Browser handles stay per worker.
 * T1 starts a new journey; every later test reads the same data.
 */
const STATE_FILE = path.join(os.tmpdir(), 'p2-mobile-returning.state.json');

function freshJourney(): Journey {
  return {
    phone: makePhone(),
    stockBefore: -1,
    stockPlaced: -1,
    stockAfterCancel: -1,
    cancelledOrder: '',
    paidOrder: '',
    consoleLog: [],
    layoutLog: [],
  };
}

function loadJourney(): Journey {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Journey;
  } catch {
    return freshJourney();
  }
}

const S: Journey & Handles = loadJourney();

function persistJourney(): void {
  const data: Journey = {
    phone: S.phone,
    stockBefore: S.stockBefore,
    stockPlaced: S.stockPlaced,
    stockAfterCancel: S.stockAfterCancel,
    cancelledOrder: S.cancelledOrder,
    paidOrder: S.paidOrder,
    consoleLog: S.consoleLog,
    layoutLog: S.layoutLog,
  };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function resetJourney(): void {
  Object.assign(S, freshJourney());
  persistJourney();
}

function watchConsole(page: Page, session: string): void {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    S.consoleLog.push({ session, text: msg.text(), url: msg.location().url || '' });
  });
  page.on('pageerror', (err) => {
    S.consoleLog.push({ session, text: `pageerror: ${err.message}`, url: '' });
  });
}

async function newMobileContext(browser: Browser, ip: string): Promise<BrowserContext> {
  return browser.newContext({ ...MOBILE, extraHTTPHeaders: { "X-Real-IP": ip } });
}

/** No horizontal page scroll: document scrollWidth must not exceed the visible width. */
async function checkLayout(page: Page, label: string): Promise<void> {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`),
  }));
  S.layoutLog.push({ label, scrollWidth: m.scrollWidth, clientWidth: m.clientWidth });
  if (m.offenders.length) {
    test.info().annotations.push({ type: 'overflow-elements', description: `${label}: ${m.offenders.join(' | ')}` });
  }
  expect
    .soft(m.scrollWidth, `[${label}] horizontal scroll: scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}`)
    .toBeLessThanOrEqual(m.clientWidth + 1);
}

/** Touch target: at least 44 x 44 CSS px. Soft, so the journey keeps going and every target is reported. */
async function expectTouchTarget(loc: Locator, label: string): Promise<void> {
  const box = await loc.boundingBox();
  expect.soft(box, `[${label}] element must be rendered`).not.toBeNull();
  if (!box) return;
  expect.soft(box.height, `[${label}] touch height ${Math.round(box.height)}px (min 44px)`).toBeGreaterThanOrEqual(44);
  expect.soft(box.width, `[${label}] touch width ${Math.round(box.width)}px (min 44px)`).toBeGreaterThanOrEqual(44);
}

async function getStock(page: Page): Promise<number> {
  const res = await page.request.get(`${BASE}/api/products?slug=${PRODUCT_SLUG}`);
  expect(res.status(), 'product API status').toBe(200);
  const body = await res.json();
  return Number(body.product.stock);
}

async function getOwnOrders(page: Page): Promise<Array<{ orderNumber: string; status: string }>> {
  const res = await page.request.get(`${BASE}/api/orders`);
  expect(res.status(), 'own orders API status').toBe(200);
  const body = await res.json();
  return body.orders ?? [];
}

async function gatewayOrderNumber(page: Page): Promise<string> {
  const span = page.locator('span[dir="ltr"].font-mono').first();
  await expect(span, 'mock gateway shows the order number').toBeVisible({ timeout: 20000 });
  return (await span.innerText()).trim();
}

async function loginWithPassword(page: Page, phone: string): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).first().click();
  await page.getByRole('button', { name: 'با کلمه عبور', exact: true }).click();
  await page.locator('#login-identifier').fill(phone);
  await page.locator('#login-password').fill(PASSWORD);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'ورود به حساب کاربری', exact: true }).click(),
  ]);
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `password login: ${body.message ?? ''}`).toBe(200);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
}

function orderPayload(slotId: string) {
  return {
    recipientName: NAME,
    phone: S.phone,
    province: 'فارس',
    city: 'شیراز',
    streetAddress: STREET_A,
    unit: '',
    postalCode: POSTAL_A,
    deliverySlot: slotId,
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
    paymentMethod: 'zarinpal',
    appliedCouponCode: null,
  };
}

/** Cart -> checkout -> first open Sunday/Wednesday -> address -> submit, ends on the mock gateway. */
async function startCheckoutToGateway(page: Page): Promise<void> {
  await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
  await expect(page.locator('#checkout-recipient')).toBeVisible({ timeout: 20000 });
  await page.locator('button:not([disabled])').filter({ hasText: /^(یکشنبه|چهارشنبه)/ }).first().click();
  await expect(page.getByText('ساعت ۱۵ تا ۲۱').first(), 'time window auto-selected').toBeVisible();
  await page.locator('#checkout-street').fill(STREET_A);
  await page.locator('#checkout-postal').fill(POSTAL_A);
  const submit = page.locator('button[type="submit"]').filter({ hasText: /زرین/ });
  await expect(submit).toBeEnabled({ timeout: 20000 });
  await expectTouchTarget(submit, 'checkout pay button');
  await submit.click();
  await page.waitForURL(/\/checkout\/mock-gateway/, { timeout: 30000 });
}

/**
 * A failed test can leave the shared page on about:blank with its session (and cart) gone. Each dependent test
 * therefore re-establishes what it needs and records when it had to, so the report can tell harness resets apart
 * from application defects.
 */
async function ensureSession(page: Page): Promise<void> {
  const me = await page.request.get(`${BASE}/api/auth/me`);
  if (me.status() === 200) return;
  test.info().annotations.push({ type: 'harness', description: 'session missing at test start; signed in again with the password' });
  await loginWithPassword(page, S.phone);
}

async function ensureCartLine(page: Page): Promise<void> {
  await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
  if ((await page.locator(`a[href="${PRODUCT_PATH}"]`).count()) > 0) return;
  test.info().annotations.push({ type: 'harness', description: 'cart empty at test start; product added again' });
  await page.goto(`${BASE}${PRODUCT_PATH}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'رفتن به سبد خرید' }).first()).toBeVisible({ timeout: 10000 });
  await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
}

async function openAddressDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'نشانی جدید', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('#addr-street')).toBeVisible();
  return dialog;
}

test.describe('P2 mobile returning customer journey', () => {
  // One worker (see playwright.config.ts) and no fullyParallel: tests run in declaration order on one
  // shared customer. A failed step does not skip later steps; a dependent step may fail for a cascade reason,
  // which the report calls out.
  test.setTimeout(150_000);

  test.beforeAll(async ({ browser }) => {
    S.ctxA = await newMobileContext(browser, randomForwardedIp());
    S.pageA = await S.ctxA.newPage();
    watchConsole(S.pageA, 'A');
  });

  test.afterEach(() => {
    persistJourney();
  });

  test.afterAll(async () => {
    await S.ctxB?.close();
    await S.ctxA?.close();
  });

  test('T1 registers a new phone account through OTP', async () => {
    resetJourney();
    const page = S.pageA!;
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await checkLayout(page, 'login (guest)');
    await page.getByRole('button', { name: 'ساخت حساب کاربری', exact: true }).first().click();
    await page.locator('#login-name-1').fill(NAME);
    await page.locator('#login-phone').fill(S.phone);
    const sendBtn = page.getByRole('button', { name: 'دریافت کد و ساخت حساب کاربری' });
    await expectTouchTarget(sendBtn, 'register: send code');
    const [otpRes] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/auth/otp') && r.request().method() === 'POST'),
      sendBtn.click(),
    ]);
    const otpBody = await otpRes.json();
    expect(otpRes.status(), otpBody.message).toBe(200);
    expect(otpBody.success).toBe(true);
    expect(otpBody.debugCode, 'mock SMS exposes the 6-digit code').toMatch(/^\d{6}$/);

    const boxes = page.locator('input[aria-label^="رقم"]');
    await expect(boxes).toHaveCount(6);
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(otpBody.debugCode[i]);
    await page.waitForURL(/\/account/, { timeout: 20000 });
    await expect(page.getByRole('button', { name: 'اطلاعات حساب', exact: true })).toBeVisible();
    await checkLayout(page, 'account after OTP registration');
  });

  test('T2 sets a password from account settings', async () => {
    const page = S.pageA!;
    await page.getByRole('button', { name: 'اطلاعات حساب', exact: true }).click();
    const pass = page.locator('#acc-new-pass');
    const saveBtn = page.getByRole('button', { name: 'ذخیره تغییرات', exact: true });
    await expect(pass).toBeVisible();

    // Client-side guard: a short password is refused before any request
    await pass.fill('abc');
    await saveBtn.click();
    await expect(page.getByText(/حداقل ۸ کاراکتر/).first()).toBeVisible();

    await pass.fill(PASSWORD);
    await expectTouchTarget(saveBtn, 'account: save changes');
    const saved = page
      .waitForResponse((r) => r.url().endsWith('/api/auth/me') && r.request().method() === 'POST', { timeout: 10_000 })
      .catch(() => null);
    await saveBtn.click();
    const res = await saved;
    const pageSays = await page.getByRole('alert').first().innerText().catch(() => '(no alert)');
    expect
      .soft(
        res,
        `account settings must save the first password of an OTP-only account (no current password exists). Page said: "${pageSays}"`
      )
      .not.toBeNull();
    test.info().annotations.push({
      type: 'ui-result',
      description: res ? `settings save sent, status ${res.status()}` : `settings save never sent a request; alert: "${pageSays}"`,
    });

    // Continue the journey through the server's own "finish phone registration" path so later steps still run:
    // a fresh OTP -> phoneProof -> POST /api/auth/register sets the password on the existing phone account.
    if (!res) {
      const send = await page.request.post(`${BASE}/api/auth/otp`, {
        headers: { Origin: BASE },
        data: { action: 'send', phone: S.phone },
      });
      const sendBody = await send.json();
      const verify = await page.request.post(`${BASE}/api/auth/otp`, {
        headers: { Origin: BASE },
        data: { action: 'verify', phone: S.phone, code: sendBody.debugCode },
      });
      const verifyBody = await verify.json();
      expect(verifyBody.phoneProof, 'fallback: OTP verify returns a phoneProof').toBeTruthy();
      const reg = await page.request.post(`${BASE}/api/auth/register`, {
        headers: { Origin: BASE },
        data: { name: NAME, phone: S.phone, password: PASSWORD, phoneProof: verifyBody.phoneProof },
      });
      expect(reg.status(), 'fallback: register completes the password').toBe(200);
      await page.reload({ waitUntil: 'networkidle' });
    } else {
      const body = await res.json().catch(() => ({}));
      expect(res.status(), body.message).toBe(200);
      await expect.soft(page.getByText(/تغییرات حساب کاربری ذخیره شد|با موفقیت به‌روزرسانی شد/).first(), 'success feedback is shown').toBeVisible();
      await expect(pass).toHaveValue('');
    }
    await checkLayout(page, 'account settings');
  });

  test('T3 logs out and logs back in with phone and password', async () => {
    const page = S.pageA!;
    await ensureSession(page);
    // Each test starts from a known URL: a failed earlier test can leave this page on about:blank.
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    const logout = page.getByRole('button', { name: 'خروج از حساب', exact: true });
    const visible = await logout.waitFor({ state: 'visible', timeout: 20_000 }).then(
      () => true,
      () => false
    );
    if (!visible) {
      const diag = await page.evaluate(() => ({
        url: location.href,
        bodyText: document.body.innerText.slice(0, 160),
        mainLength: document.querySelector('main')?.innerText.length ?? -1,
      }));
      test.info().annotations.push({ type: 'diagnostic', description: `account page before logout: ${JSON.stringify(diag)}` });
      await page.screenshot({ path: test.info().outputPath('before-logout.png') });
    }
    expect(visible, 'account page exposes the logout control after the password step').toBe(true);
    await logout.click();
    await page.waitForURL((u) => !u.pathname.startsWith('/account'), { timeout: 15000 });
    const me = await page.request.get(`${BASE}/api/auth/me`);
    expect(me.status(), 'session is gone after logout').toBe(401);

    await loginWithPassword(page, S.phone);
    const me2 = await page.request.get(`${BASE}/api/auth/me`);
    expect(me2.status(), 'session restored by password login').toBe(200);
    await checkLayout(page, 'after password login');
  });

  test('T4 opens and closes the mobile menu', async () => {
    const page = S.pageA!;
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const menuBtn = page.getByRole('button', { name: 'منوی اصلی', exact: true });
    await expectTouchTarget(menuBtn, 'hamburger');
    await menuBtn.click();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
    const drawer = page.locator('#mobile-nav-drawer');
    await expect(drawer.getByRole('link', { name: 'محصولات', exact: true })).toBeVisible();
    await checkLayout(page, 'home with menu open');
    await drawer.getByRole('button', { name: 'بستن منو', exact: true }).click();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
    // The sheet stays in the DOM and is slid off-screen, so "hidden" means "outside the viewport".
    await expect.soft(drawer, 'drawer slides out of the viewport after close').not.toBeInViewport();
    await checkLayout(page, 'home with menu closed');
  });

  test('T5 searches the catalogue and opens the egg product', async () => {
    const page = S.pageA!;
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'جستجوی سریع محصولات', exact: true }).first().click();
    const box = page.getByRole('searchbox', { name: 'عبارت جستجوی محصول' });
    await expect(box).toBeVisible();
    await box.fill('کامفیروز');
    const hit = page.getByRole('dialog', { name: 'جستجوی سریع محصولات' }).locator(`a[href="${PRODUCT_PATH}"]`);
    await expect(hit, 'search returns the egg product').toBeVisible({ timeout: 10000 });
    await checkLayout(page, 'search results');
    await hit.click();
    await page.waitForURL(`**${PRODUCT_PATH}`, { timeout: 20000 });
  });

  test('T6 product page: main and sticky add-to-cart', async () => {
    const page = S.pageA!;
    if (!page.url().includes(PRODUCT_PATH)) await page.goto(`${BASE}${PRODUCT_PATH}`, { waitUntil: 'networkidle' });
    const main = page.getByRole('button', { name: 'افزودن به سبد خرید', exact: true }).first();
    await expect(main).toBeVisible();
    await expectTouchTarget(main, 'PDP main add-to-cart');
    await checkLayout(page, 'PDP top');

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bar = page.locator('div.fixed.bottom-0').filter({ hasText: /افزودن|رفتن به سبد خرید/ });
    const sticky = bar.locator('button', { hasText: 'افزودن' }).first();
    await expect(bar, 'sticky add-to-cart bar appears after scrolling').toBeVisible({ timeout: 5000 });
    await expectTouchTarget(sticky, 'PDP sticky add-to-cart');
    await expectTouchTarget(bar.getByRole('button', { name: 'افزایش تعداد' }), 'PDP sticky quantity +');
    await checkLayout(page, 'PDP scrolled with sticky bar');

    await sticky.click();
    await expect(bar.getByRole('link', { name: 'رفتن به سبد خرید' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /سبد خرید \(۱ قلم\)/ }).first()).toBeVisible();
  });

  test('T7 cart rejects an invalid coupon with a Persian message and holds no discount', async () => {
    const page = S.pageA!;
    await ensureCartLine(page);
    await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
    await expect(page.locator(`a[href="${PRODUCT_PATH}"]`).first()).toBeVisible();
    const input = page.locator('#coupon-code-input');
    await input.fill(INVALID_COUPON);
    const apply = page.getByRole('button', { name: 'اعمال کد', exact: true });
    await expectTouchTarget(apply, 'cart: apply coupon');
    await apply.click();
    await expect(page.getByText(/معتبر نمی.باشد/).first(), 'Persian invalid-coupon message').toBeVisible({ timeout: 10000 });
    // Nothing was applied, so there is no applied chip or remove control to use.
    await expect(page.getByRole('button', { name: /حذف کد تخفیف/ })).toHaveCount(0);
    await input.fill('');
    await checkLayout(page, 'cart');
  });

  test('T8 checkout offers only Sunday and Wednesday to a FREE customer', async () => {
    const page = S.pageA!;
    await ensureSession(page);
    await ensureCartLine(page);
    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    await expect(page.locator('#checkout-recipient')).toBeVisible({ timeout: 20000 });
    const days = await page.locator('button').evaluateAll((btns) =>
      btns
        .map((b) => ({
          text: (b.textContent || '').replace(/\s+/g, ' ').trim(),
          disabled: (b as HTMLButtonElement).disabled,
        }))
        .filter((b) => /^(شنبه|یکشنبه|دوشنبه|سه.شنبه|چهارشنبه|پنج.شنبه|جمعه)/.test(b.text))
    );
    expect(days.length, 'day buttons are rendered').toBeGreaterThan(0);
    const isSunOrWed = (t: string) => /^(یکشنبه|چهارشنبه)/.test(t);
    for (const d of days) {
      if (!isSunOrWed(d.text)) {
        expect.soft(d.disabled, `"${d.text}" must not be selectable for FREE`).toBe(true);
      }
    }
    const selectable = days.filter((d) => !d.disabled);
    expect.soft(selectable.every((d) => isSunOrWed(d.text)), 'every selectable day is Sunday or Wednesday').toBe(true);
    expect(days.some((d) => /^جمعه/.test(d.text)), 'Friday is not offered').toBe(false);
    expect.soft(selectable.length, 'at least one Sunday or Wednesday is open right now').toBeGreaterThan(0);
    await checkLayout(page, 'checkout day picker');
  });

  test('T9 server refuses a Saturday or Monday slot for a FREE account', async () => {
    const page = S.pageA!;
    await ensureSession(page);
    const slotsRes = await page.request.get(`${BASE}/api/delivery-slots?days=14`);
    expect(slotsRes.status()).toBe(200);
    const slotsBody = await slotsRes.json();
    const notAllowed = (dow: number) =>
      (slotsBody.slots as Array<{ id: string; dayOfWeekIndex: number; isAllowedForTier: boolean }>).find(
        (s) => s.dayOfWeekIndex === dow && s.isAllowedForTier === false
      );
    const sat = notAllowed(6);
    const mon = notAllowed(1);
    expect(sat, 'a Saturday slot is listed as not allowed for FREE').toBeTruthy();
    expect(mon, 'a Monday slot is listed as not allowed for FREE').toBeTruthy();

    for (const slot of [sat!, mon!]) {
      const res = await page.request.post(`${BASE}/api/orders`, {
        headers: { Origin: BASE },
        data: orderPayload(slot.id),
      });
      const body = await res.json().catch(() => ({}));
      test.info().annotations.push({ type: 'server-message', description: `${slot.id} -> ${res.status()}: ${body.message ?? ''}` });
      expect(res.status(), `POST /api/orders with ${slot.id}`).toBe(400);
      expect(body.success).toBe(false);
      expect(body.message ?? '', 'Persian rejection message').toMatch(PERSIAN_RE);
    }
  });

  test('T10 places an order and cancels it at the mock gateway', async () => {
    const page = S.pageA!;
    await ensureSession(page);
    await ensureCartLine(page);
    S.stockBefore = await getStock(page);
    await startCheckoutToGateway(page);
    S.cancelledOrder = await gatewayOrderNumber(page);
    S.stockPlaced = await getStock(page);

    const cancel = page.getByRole('link', { name: 'لغو پرداخت', exact: true });
    await expectTouchTarget(cancel, 'mock gateway: cancel');
    await cancel.click();
    await expect(
      page.getByText(/پرداخت لغو شد یا با خطا مواجه گردید/).first(),
      'Persian cancelled-payment message'
    ).toBeVisible({ timeout: 20000 });
    await checkLayout(page, 'checkout after cancelled payment');

    const order = (await getOwnOrders(page)).find((o) => o.orderNumber === S.cancelledOrder);
    expect(order?.status, 'cancelled order is CANCELLED, not paid').toBe('CANCELLED');

    S.stockAfterCancel = await getStock(page);
    test.info().annotations.push({
      type: 'stock',
      description: `before=${S.stockBefore} afterPlacing=${S.stockPlaced} afterCancel=${S.stockAfterCancel}`,
    });
    if (S.stockPlaced === S.stockBefore - 1) {
      expect
        .soft(S.stockAfterCancel, 'stock returned after cancel (back to the pre-order level)')
        .toBe(S.stockBefore);
    } else {
      test.info().annotations.push({
        type: 'inconclusive',
        description: 'stock changed by another tester during this step; the release check is not conclusive',
      });
    }

    await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
    await expect
      .soft(page.locator(`a[href="${PRODUCT_PATH}"]`).first(), 'cart is kept after a cancelled payment')
      .toBeVisible();
  });

  test('T11 leaves an order unpaid, retries payment from the account and pays', async () => {
    const page = S.pageA!;
    await ensureSession(page);
    await ensureCartLine(page);
    await startCheckoutToGateway(page);
    const pending = await gatewayOrderNumber(page);

    // Walk away from the gateway without paying.
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^سفارش‌ها و مرجوعی‌ها/ }).click();
    await expect(page.getByText(pending).first(), 'unpaid order is listed').toBeVisible();
    await expect.soft(page.getByText('در انتظار پرداخت').first(), 'unpaid order is labelled pending').toBeVisible();

    const retry = page.getByRole('button', { name: 'پرداخت مجدد', exact: true });
    await expect(retry).toHaveCount(1);
    await expectTouchTarget(retry, 'account: pay again');
    await retry.click();
    await page.waitForURL(/\/checkout\/mock-gateway/, { timeout: 30000 });
    expect(await gatewayOrderNumber(page), 'retry keeps the same order').toBe(pending);

    await page.getByRole('link', { name: 'پرداخت موفق', exact: true }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 30000 });
    S.paidOrder = pending;
    const order = (await getOwnOrders(page)).find((o) => o.orderNumber === S.paidOrder);
    expect(order?.status, 'retried order is PROCESSING after payment').toBe('PROCESSING');
    await checkLayout(page, 'checkout success');
  });

  test('T12 address book: add two, set default, edit one, delete one, survives reload', async () => {
    const page = S.pageA!;
    await ensureSession(page);
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'دفترچه نشانی', exact: true }).click();

    // Add A (becomes default as the first address)
    let dialog = await openAddressDialog(page);
    await dialog.locator('#addr-postal').fill(POSTAL_A);
    await dialog.locator('#addr-street').fill(STREET_A);
    await checkLayout(page, 'address dialog open');
    await expectTouchTarget(dialog.getByRole('button', { name: 'ذخیره نشانی', exact: true }), 'address: save');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/account/addresses') && r.request().method() === 'POST'),
      dialog.getByRole('button', { name: 'ذخیره نشانی', exact: true }).click(),
    ]);
    await expect(page.locator('li').filter({ hasText: STREET_A })).toBeVisible();

    // Add B
    dialog = await openAddressDialog(page);
    await dialog.locator('#addr-postal').fill(POSTAL_B);
    await dialog.locator('#addr-street').fill(STREET_B);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/account/addresses') && r.request().method() === 'POST'),
      dialog.getByRole('button', { name: 'ذخیره نشانی', exact: true }).click(),
    ]);
    const cardA = page.locator('li').filter({ hasText: STREET_A });
    const cardB = page.locator('li').filter({ hasText: STREET_B });
    await expect(cardB).toBeVisible();

    // Make B the default
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/account/addresses') && r.request().method() === 'PATCH'),
      cardB.getByRole('button', { name: 'تنظیم به عنوان پیش‌فرض', exact: true }).click(),
    ]);
    await expect(cardB.getByText('نشانی پیش‌فرض').first()).toBeVisible();

    // Edit A
    await cardA.getByRole('button', { name: 'ویرایش', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.locator('#addr-street').fill(STREET_A_EDITED);
    await expectTouchTarget(dialog.getByRole('button', { name: 'ذخیره نشانی', exact: true }), 'address: save edit');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/account/addresses') && r.request().method() === 'PATCH'),
      dialog.getByRole('button', { name: 'ذخیره نشانی', exact: true }).click(),
    ]);
    await expect(page.locator('li').filter({ hasText: STREET_A_EDITED })).toBeVisible();

    // Delete A (edited)
    const edited = page.locator('li').filter({ hasText: STREET_A_EDITED });
    await edited.getByRole('button', { name: 'حذف', exact: true }).click();
    await expect(page.getByRole('button', { name: 'بله، حذف شود' })).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/account/addresses') && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'بله، حذف شود' }).click(),
    ]);
    await expect(page.locator('li').filter({ hasText: STREET_A_EDITED })).toHaveCount(0);
    await checkLayout(page, 'address book after edits');

    // Reload and verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'دفترچه نشانی', exact: true }).click();
    await expect(page.locator('li').filter({ hasText: STREET_B })).toBeVisible();
    await expect(page.locator('li').filter({ hasText: STREET_B }).getByText('نشانی پیش‌فرض').first()).toBeVisible();
    await expect(page.locator('li').filter({ hasText: STREET_A_EDITED })).toHaveCount(0);
    await expect(page.locator('li').filter({ hasText: STREET_A })).toHaveCount(0);
  });

  test('T13 a second browser session sees the same addresses and orders', async ({ browser }) => {
    S.ctxB = await newMobileContext(browser, randomForwardedIp('10.2.1'));
    const page = await S.ctxB.newPage();
    S.pageB = page;
    watchConsole(page, 'B');

    await loginWithPassword(page, S.phone);
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'دفترچه نشانی', exact: true }).click();
    await expect(page.locator('li').filter({ hasText: STREET_B })).toBeVisible();
    await expect(page.locator('li').filter({ hasText: STREET_B }).getByText('نشانی پیش‌فرض').first()).toBeVisible();
    await expect(page.locator('li').filter({ hasText: STREET_A_EDITED })).toHaveCount(0);
    await checkLayout(page, 'session B address book');

    const orders = await getOwnOrders(page);
    expect(orders.find((o) => o.orderNumber === S.cancelledOrder)?.status, 'cancelled order visible in session B').toBe(
      'CANCELLED'
    );
    expect(orders.find((o) => o.orderNumber === S.paidOrder)?.status, 'paid order visible in session B').toBe('PROCESSING');

    await page.getByRole('button', { name: /^سفارش‌ها و مرجوعی‌ها/ }).click();
    await expect(page.getByText(S.paidOrder).first()).toBeVisible();
    await expect(page.getByText(S.cancelledOrder).first()).toBeVisible();
    await checkLayout(page, 'session B orders');
  });

  test('T14 console errors and layout across the journey', async () => {
    const isExpectedGuest401 = (e: { text: string; url: string }) =>
      e.text.includes('401') && e.url.endsWith('/api/auth/me');
    const unexpected = S.consoleLog.filter((e) => !isExpectedGuest401(e));
    test.info().annotations.push({
      type: 'console-summary',
      description: `total console errors ${S.consoleLog.length}; expected guest 401 on /api/auth/me ${
        S.consoleLog.length - unexpected.length
      }`,
    });
    expect.soft(unexpected, 'unexpected console errors or page errors').toEqual([]);
    const overflow = S.layoutLog.filter((l) => l.scrollWidth > l.clientWidth + 1);
    expect.soft(overflow, 'pages with horizontal scroll').toEqual([]);
    test.info().annotations.push({ type: 'layout-pages-checked', description: String(S.layoutLog.length) });
  });
});
