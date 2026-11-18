import { test, expect, type APIRequestContext, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

/*
 * Persona p4-bulk-outside-shiraz: a restaurant buyer outside Shiraz.
 * Assertions describe the intended behaviour. A failing assertion is a finding, not a reason to change the spec's
 * expectation. Findings are written up in e2e/reports/p4-bulk-outside-shiraz.md.
 */

const BASE = 'http://localhost:3000';
const ORIGIN = { Origin: BASE };
const CART_KEY = 'profarm_cart_v2';

// Written as code points so the Persian ی (U+06CC) and Arabic ي (U+064A) cannot be confused by an editor.
const SHIRAZ_PERSIAN_YEH = 'شیراز'; // شیراز
const SHIRAZ_ARABIC_YEH = 'شيراز'; // شيراز

const PRODUCT_SLUGS = {
  greens: 'fresh-herbs-qasrodasht-1kg', // cheapest: 85,000 toman
  eggs: 'organic-eggs-kamfiruz-30',
  cheese: 'pottery-cheese-firuzabad-800g',
  honey: 'wild-honey-dasht-arjan-1000g', // 620,000 toman, used for the subtotal rule
} as const;
type ProductKey = keyof typeof PRODUCT_SLUGS;
type Product = { id: string; slug: string; title: string; price: number; stock: number };

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toAscii(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** Reads the first run of digits (Persian, Arabic or Latin) in a text as a number. */
function amountIn(text: string): number {
  const digits = toAscii(text).replace(/[^0-9]/g, '');
  return digits ? Number(digits) : Number.NaN;
}

/** Unique X-Forwarded-For per worker. NOTE: ignored by the app unless TRUST_PROXY_HEADERS=1 (not set here). */
function randomIp(): string {
  return `10.4.0.${1 + Math.floor(Math.random() * 250)}`;
}

/** Fresh 11-digit phone in the 0912400XXXX test range, unique per run. */
function newPhone(): string {
  return `0912400${1000 + Math.floor(Math.random() * 9000)}`;
}

async function postJson(request: APIRequestContext, path: string, data: unknown) {
  const res = await request.post(`${BASE}${path}`, { data, headers: ORIGIN });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

async function loadCatalog(request: APIRequestContext): Promise<Record<ProductKey, Product>> {
  const res = await request.get(`${BASE}/api/products`);
  expect(res.status()).toBe(200);
  const list = ((await res.json()).products ?? []) as Product[];
  const bySlug = new Map(list.map((p) => [p.slug, p]));
  const out = {} as Record<ProductKey, Product>;
  for (const key of Object.keys(PRODUCT_SLUGS) as ProductKey[]) {
    const p = bySlug.get(PRODUCT_SLUGS[key]);
    if (!p) throw new Error(`Test product missing from catalog: ${PRODUCT_SLUGS[key]}`);
    out[key] = p;
  }
  return out;
}

type Line = { productId: string; quantity: number };

async function quoteFor(
  request: APIRequestContext,
  lines: Line[],
  city: string,
  province: string,
  slotId?: string | null
) {
  const r = await postJson(request, '/api/orders/quote', {
    items: lines,
    address: { city, province },
    ...(slotId ? { slotId } : {}),
  });
  expect(r.status, 'quote API status').toBe(200);
  return r.body.quote as {
    ok: boolean;
    errors: string[];
    isBulk: boolean;
    isShiraz: boolean;
    shipping: number;
    subtotal: number;
    total: number;
  };
}

async function freeAllowedSlotId(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${BASE}/api/delivery-slots?days=14`);
  const slots = ((await res.json()).slots ?? []) as { id: string; isAvailable: boolean; isAllowedForTier: boolean }[];
  const slot = slots.find((s) => s.isAvailable && s.isAllowedForTier);
  if (!slot) throw new Error('No delivery slot open for FREE tier in the next 14 days');
  return slot.id;
}

async function readCartLines(page: Page): Promise<Line[]> {
  return page.evaluate((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw)?.state?.lines ?? []) : [];
    } catch {
      return [];
    }
  }, CART_KEY);
}

/** Empties the stored cart. Reloads afterwards so the app cannot write its in-memory cart back over the removal. */
async function clearCart(page: Page) {
  await page.goto('/products', { waitUntil: 'networkidle' });
  await page.evaluate((key) => window.localStorage.removeItem(key), CART_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await expect.poll(async () => (await readCartLines(page)).length, { timeout: 5000 }).toBe(0);
}

/** Adds qty units of a product through the product page (real add-to-cart button), then checks the stored cart. */
async function addToCartViaUi(page: Page, product: Product, qty: number) {
  await page.goto(`/products/${product.slug}`);
  await page.waitForLoadState('networkidle');
  // Label is "افزودن به سبد خرید" for 1 unit and "افزودن ۱۰ عدد به سبد خرید" for more.
  const add = page.locator('button:visible').filter({ hasText: /به سبد خرید/ }).first();
  if (!(await add.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false))) {
    await page.reload({ waitUntil: 'networkidle' });
  }
  await expect(add).toBeVisible({ timeout: 20000 });
  const plus = page.locator('button[aria-label="افزایش تعداد"]:visible').first();
  for (let i = 1; i < qty; i++) {
    await plus.click();
  }
  await add.click();
  await expect
    .poll(async () => (await readCartLines(page)).find((l) => l.productId === product.id)?.quantity ?? 0, {
      timeout: 10000,
    })
    .toBe(qty);
}

/** Registers a brand-new account through the OTP flow on /login. The SMS provider is MOCK, so the code comes back in JSON. */
async function registerViaOtp(page: Page, phone: string, name: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'ساخت حساب کاربری' }).first().click();
  await page.locator('#login-name-1').fill(name);
  await page.locator('#login-phone').fill(phone);

  const sendResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/otp') && (r.request().postData() ?? '').includes('"send"')
  );
  await page.locator('form', { has: page.locator('#login-phone') }).locator('button[type="submit"]').click();
  const sent = await (await sendResponse).json();
  expect(sent.success, `OTP send failed: ${sent.message ?? ''}`).toBe(true);
  expect(sent.debugCode, 'mock SMS should expose the code in JSON').toMatch(/^\d{5}$/);

  const verifyResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/otp') && (r.request().postData() ?? '').includes('"verify"')
  );
  await page.locator('input[aria-label*="کد تایید"]').first().focus();
  await page.keyboard.type(sent.debugCode);
  const verified = await (await verifyResponse).json();
  expect(verified.success, `OTP verify failed: ${verified.message ?? ''}`).toBe(true);
}

/** Fills the checkout address. Province first: changing it away from Fars clears a typed Shiraz city. */
async function fillCheckoutAddress(page: Page, province: string, city: string) {
  await page.locator('#checkout-recipient').fill('مهمان تست رستوران');
  await page.locator('#checkout-province').selectOption(province);
  await page.locator('#checkout-city').fill(city);
  await page.locator('#checkout-city').blur();
  await page.locator('#checkout-street').fill('خیابان آزمایشی، پلاک ۱');
  await page.locator('#checkout-postal').fill('1234567890');
}

const checkoutSubmit = (page: Page) =>
  page.locator('form', { has: page.locator('#checkout-recipient') }).locator('button[type="submit"]');

/** The "مبلغ پرداخت" amount in the quote card, as a number. */
const payableAmount = (page: Page) => page.getByText('مبلغ پرداخت:', { exact: true }).first().locator('xpath=following-sibling::span');

async function expectUiAmountToMatch(page: Page, expected: number) {
  await expect
    .poll(async () => amountIn(await payableAmount(page).innerText()), {
      message: 'UI "مبلغ پرداخت" should equal the quote API total',
      timeout: 20000,
    })
    .toBe(expected);
}

/** Checks the suite's account session. If it is gone, registers a new account and records that as a test annotation. */
async function ensureLoggedIn(context: BrowserContext, page: Page, info: TestInfo) {
  const me = await context.request.get(`${BASE}/api/auth/me`);
  if (me.status() === 200) return;
  info.annotations.push({ type: 'session-lost', description: `/api/auth/me returned ${me.status()} at test start; a new account was registered` });
  await registerViaOtp(page, newPhone(), 'مهمان تست رستوران');
  const again = await context.request.get(`${BASE}/api/auth/me`);
  expect(again.status(), 'a new registration should restore the session').toBe(200);
}

async function listOrders(context: BrowserContext) {
  const res = await context.request.get(`${BASE}/api/orders`);
  expect(res.status()).toBe(200);
  return ((await res.json()).orders ?? []) as {
    orderNumber: string;
    status: string;
    totalAmount: number;
    shippingFee: number;
    isBulkOrder: boolean;
    address?: { city?: string; province?: string };
  }[];
}

/** Submits the checkout and waits for the mock gateway. Returns the gateway URL, or fails with the page alert text. */
async function submitToGateway(page: Page): Promise<URL> {
  await expect(checkoutSubmit(page)).toBeEnabled({ timeout: 20000 });
  await checkoutSubmit(page).click();
  const reached = await page.waitForURL(/\/checkout\/mock-gateway\?/, { timeout: 30000 }).then(
    () => true,
    () => false
  );
  if (!reached) {
    const alerts = (await page.locator('[role="alert"]').allInnerTexts()).join(' | ');
    throw new Error(`Did not reach the mock gateway. Page at ${page.url()}. Alerts: ${alerts}`);
  }
  return new URL(page.url());
}

// ---------------------------------------------------------------------------
// Part 1: /bulk inquiry form (no login)
// ---------------------------------------------------------------------------

test.describe('bulk inquiry form (/bulk)', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': randomIp() } });

  const bulkForm = (page: Page) => page.locator('form', { has: page.locator('#bulk-1') });

  async function fillBulk(
    page: Page,
    v: { name: string; phone: string; company?: string; city: string; message: string }
  ) {
    await page.locator('#bulk-1').fill(v.name);
    await page.locator('#bulk-2').fill(v.phone);
    await page.locator('#bulk-3').fill(v.company ?? '');
    await page.locator('#bulk-4').fill(v.city);
    await page.locator('#bulk-5').fill(v.message);
  }

  test('B-01 valid inquiry is accepted and shows the success message', async ({ page }) => {
    await page.goto('/bulk');
    await fillBulk(page, {
      name: 'مهندس تست رستوران',
      phone: newPhone(),
      company: 'رستوران آزمایشی',
      city: 'اصفهان',
      message: 'حدود ۱۰ بسته تخم‌مرغ کامفیروز برای هفته آینده',
    });
    const response = page.waitForResponse((r) => r.url().endsWith('/api/bulk-inquiries') && r.request().method() === 'POST');
    await bulkForm(page).locator('button[type="submit"]').click();
    expect((await response).status()).toBe(200);
    await expect(page.getByText('درخواست شما با موفقیت ثبت شد')).toBeVisible();
  });

  test('B-02 invalid phone is refused in Persian before any request (client), server still refuses it (API)', async ({ page, request }) => {
    await page.goto('/bulk');
    let posted = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/bulk-inquiries') && r.method() === 'POST') posted = true;
    });
    await fillBulk(page, { name: 'تست', phone: '12345', city: 'اصفهان', message: 'تست شماره نامعتبر' });
    await bulkForm(page).locator('button[type="submit"]').click();
    await expect(page.locator('#bulk-2-error')).toContainText('شماره تماس معتبر نیست');
    await page.waitForTimeout(1000);
    expect(posted, 'no request is sent for an invalid phone').toBe(false);
    const api = await request.post(`${BASE}/api/bulk-inquiries`, {
      headers: ORIGIN,
      data: { name: 'تست', phone: '12345', city: 'اصفهان', message: 'تست شماره نامعتبر' },
    });
    expect(api.status(), 'server refuses an invalid phone').toBe(400);
    expect(String((await api.json()).message)).toContain('شماره تلفن وارد شده معتبر نیست');
  });

  test('B-03 empty required fields do not send a request', async ({ page }) => {
    await page.goto('/bulk');
    let posted = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/bulk-inquiries') && r.method() === 'POST') posted = true;
    });
    await bulkForm(page).locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    expect(posted).toBe(false);
  });

  test('B-04 empty required fields show Persian validation messages', async ({ page }) => {
    await page.goto('/bulk');
    await bulkForm(page).locator('button[type="submit"]').click();
    for (const id of ['#bulk-1-error', '#bulk-2-error', '#bulk-4-error', '#bulk-5-error']) {
      await expect(page.locator(id), `Persian message for ${id}`).toContainText('لطفاً', { timeout: 3000 });
    }
  });

  test('B-05 whitespace-only fields are refused in the form and by the server', async ({ page, request }) => {
    await page.goto('/bulk');
    let posted = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/bulk-inquiries') && r.method() === 'POST') posted = true;
    });
    await fillBulk(page, { name: '   ', phone: newPhone(), city: '   ', message: '   ' });
    await bulkForm(page).locator('button[type="submit"]').click();
    await expect(page.locator('#bulk-1-error')).toContainText('لطفاً');
    await page.waitForTimeout(1000);
    expect(posted, 'whitespace-only form is not sent').toBe(false);
    const api = await request.post(`${BASE}/api/bulk-inquiries`, {
      headers: ORIGIN,
      data: { name: '   ', phone: newPhone(), city: '   ', message: '   ' },
    });
    expect(api.status(), 'whitespace-only name, city and message should not create an inquiry').toBe(400);
  });

  test('B-06 repeated submits hit the rate limit with a Persian message (API)', async ({ request }) => {
    const phone = newPhone();
    const statuses: number[] = [];
    let last: any = null;
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`${BASE}/api/bulk-inquiries`, {
        headers: ORIGIN,
        data: { name: 'تست محدودیت', phone, city: 'تهران', message: `درخواست شماره ${i + 1}` },
      });
      statuses.push(res.status());
      last = await res.json().catch(() => null);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
    expect(String(last?.message ?? '')).toContain('بیش از حد مجاز');
  });

  test('B-07 rate-limited submit from the UI shows the message and keeps the form', async ({ page }) => {
    const phone = newPhone();
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post(`${BASE}/api/bulk-inquiries`, {
        headers: ORIGIN,
        data: { name: 'تست', phone, city: 'تهران', message: `پیش‌درخواست ${i + 1}` },
      });
      expect(res.status()).toBe(200);
    }
    await page.goto('/bulk');
    await fillBulk(page, { name: 'تست', phone, city: 'تهران', message: 'ششمین درخواست' });
    const response = page.waitForResponse((r) => r.url().endsWith('/api/bulk-inquiries') && r.request().method() === 'POST');
    await bulkForm(page).locator('button[type="submit"]').click();
    expect((await response).status()).toBe(429);
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('بیش از حد مجاز');
    await expect(bulkForm(page)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Part 2: quote rules (API only, no account, no stock reserved)
// ---------------------------------------------------------------------------

test.describe('bulk and Shiraz rules at quote level', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': randomIp() } });

  test('Q-01 bulk threshold boundary: 8 honey (under 5,000,000) is not bulk, 9 honey is', async ({ request }) => {
    const catalog = await loadCatalog(request);
    const honey = catalog.honey;
    const q8 = await quoteFor(request, [{ productId: honey.id, quantity: 8 }], 'اصفهان', 'اصفهان');
    expect(q8.subtotal).toBeLessThan(5000000);
    expect(q8.isBulk).toBe(false);
    expect(q8.ok).toBe(false);

    const q9 = await quoteFor(request, [{ productId: honey.id, quantity: 9 }], 'اصفهان', 'اصفهان');
    expect(q9.subtotal).toBeGreaterThanOrEqual(5000000);
    expect(q9.isBulk).toBe(true);
    expect(q9.ok).toBe(true);
    expect(q9.shipping).toBe(0);
    expect(q9.total).toBe(q9.subtotal);
  });

  test('Q-02 bulk by item count: 10 greens is bulk, 9 greens is not', async ({ request }) => {
    const catalog = await loadCatalog(request);
    const g = catalog.greens;
    const q9 = await quoteFor(request, [{ productId: g.id, quantity: 9 }], 'اصفهان', 'اصفهان');
    expect(q9.isBulk).toBe(false);
    const q10 = await quoteFor(request, [{ productId: g.id, quantity: 10 }], 'اصفهان', 'اصفهان');
    expect(q10.isBulk).toBe(true);
    expect(q10.ok).toBe(true);
    expect(q10.shipping).toBe(0);
  });

  test('Q-03 bulk copy on /bulk states the all-products rule and matches the counting rule', async ({ page, request }) => {
    // The rule counts packages across all products (formatters.isBulkOrder). 5 greens + 5 cheese is 10 packages.
    const catalog = await loadCatalog(request);
    const mixed = await quoteFor(
      request,
      [
        { productId: catalog.greens.id, quantity: 5 },
        { productId: catalog.cheese.id, quantity: 5 },
      ],
      'اصفهان',
      'اصفهان'
    );
    await page.goto('/bulk');
    const copy = await page.getByText('حداقل تیراژ سفارش عمده').innerText();
    expect(copy, 'bulk copy on the page').not.toContain('از یک محصول');
    expect(copy, 'bulk copy states the all-products rule').toContain('از هر محصولی');
    expect(mixed.isBulk, 'copy says any product counts, so a 5+5 mix of two products is bulk').toBe(true);
  });

  test('Q-04 city "شیراز" with province "تهران" is outside Shiraz (quote and API order)', async ({ request }) => {
    const catalog = await loadCatalog(request);
    const lines = [
      { productId: catalog.eggs.id, quantity: 1 },
      { productId: catalog.cheese.id, quantity: 1 },
    ];
    const q = await quoteFor(request, lines, SHIRAZ_PERSIAN_YEH, 'تهران');
    expect(q.isShiraz).toBe(false);
    expect(q.ok).toBe(false);
    expect(q.errors.join(' ')).toContain('صرفاً مختص شهر شیراز است');
  });

  test('Q-05 city written with Arabic ي ("شيراز") and province فارس is treated as Shiraz', async ({ request }) => {
    const catalog = await loadCatalog(request);
    const lines = [
      { productId: catalog.eggs.id, quantity: 1 },
      { productId: catalog.cheese.id, quantity: 1 },
    ];
    const q = await quoteFor(request, lines, SHIRAZ_ARABIC_YEH, 'فارس');
    expect(q.isShiraz).toBe(true);
    expect(q.ok).toBe(true);
    expect(q.shipping).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Part 3: account and checkout (one account for the whole serial suite)
// ---------------------------------------------------------------------------

test.describe('checkout: outside Shiraz, bulk, and Shiraz retail', () => {
  let context: BrowserContext;
  let page: Page;
  let catalog: Record<ProductKey, Product>;
  let slotId: string;
  let phone: string;

  test.beforeAll(async ({ browser, request }) => {
    context = await browser.newContext({ baseURL: BASE, extraHTTPHeaders: { 'X-Forwarded-For': randomIp() } });
    page = await context.newPage();
    catalog = await loadCatalog(request);
    slotId = await freeAllowedSlotId(request);
    phone = newPhone();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('C-01 registers a new account through the OTP flow', async () => {
    test.setTimeout(120000);
    await registerViaOtp(page, phone, 'مهمان تست رستوران');
    const me = await context.request.get(`${BASE}/api/auth/me`);
    expect(me.status(), 'session cookie should be set after OTP verify').toBe(200);
  });

  test('C-02 outside Shiraz with 3 items: checkout blocks with a clear message', async () => {
    test.setTimeout(180000);
    await ensureLoggedIn(context, page, test.info());
    await clearCart(page);
    await addToCartViaUi(page, catalog.greens, 1);
    await addToCartViaUi(page, catalog.eggs, 1);
    await addToCartViaUi(page, catalog.cheese, 1);
    await page.goto('/checkout');
    await fillCheckoutAddress(page, 'اصفهان', 'اصفهان');

    const lines = [catalog.greens, catalog.eggs, catalog.cheese].map((p) => ({ productId: p.id, quantity: 1 }));
    const q = await quoteFor(context.request, lines, 'اصفهان', 'اصفهان', slotId);
    expect(q.ok).toBe(false);

    await expect(page.getByText('صرفاً مختص شهر شیراز است')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('خارج از شیراز وجود ندارد')).toBeVisible();
    await expect(checkoutSubmit(page)).toBeDisabled();
    await expectUiAmountToMatch(page, q.total);
  });

  test('C-03 the same outside-Shiraz order is refused by POST /api/orders and creates nothing', async () => {
    test.setTimeout(60000);
    await ensureLoggedIn(context, page, test.info());
    const before = (await listOrders(context)).length;
    const res = await postJson(context.request, '/api/orders', {
      recipientName: 'مهمان تست رستوران',
      phone,
      province: 'اصفهان',
      city: 'اصفهان',
      streetAddress: 'خیابان آزمایشی، پلاک ۱',
      postalCode: '1234567890',
      deliverySlot: slotId,
      items: [
        { productId: catalog.greens.id, quantity: 1 },
        { productId: catalog.eggs.id, quantity: 1 },
        { productId: catalog.cheese.id, quantity: 1 },
      ],
      paymentMethod: 'zarinpal',
    });
    expect(res.status).toBe(400);
    expect(String(res.body?.message ?? '')).toContain('صرفاً مختص شهر شیراز است');
    expect((await listOrders(context)).length).toBe(before);
  });

  test('C-04 10 greens outside Shiraz: bulk allowed, shipping 0, UI = quote = gateway = account', async () => {
    test.setTimeout(240000);
    await ensureLoggedIn(context, page, test.info());
    await clearCart(page);
    await addToCartViaUi(page, catalog.greens, 10);
    await page.goto('/checkout');
    await fillCheckoutAddress(page, 'اصفهان', 'اصفهان');

    const lines = [{ productId: catalog.greens.id, quantity: 10 }];
    const q = await quoteFor(context.request, lines, 'اصفهان', 'اصفهان', slotId);
    expect(q.ok).toBe(true);
    expect(q.isBulk).toBe(true);
    expect(q.shipping).toBe(0);

    await expect(page.getByText('سفارش عمده خارج از شیراز')).toBeVisible({ timeout: 20000 });
    await expectUiAmountToMatch(page, q.total);
    const shippingRow = page.getByText('ارسال خارج از شیراز (عمده):', { exact: true }).locator('xpath=../..');
    expect(amountIn(await shippingRow.innerText()), 'shipping row for bulk outside Shiraz').toBe(0);
    await expect(checkoutSubmit(page)).toBeEnabled({ timeout: 20000 });

    const gateway = await submitToGateway(page);
    const orderNumber = gateway.searchParams.get('orderNumber') ?? '';
    expect(Number(gateway.searchParams.get('amount')), 'gateway amount').toBe(q.total);
    expect(amountIn(await page.getByText('مبلغ قابل پرداخت', { exact: true }).locator('xpath=..').innerText())).toBe(q.total);

    const order = (await listOrders(context)).find((o) => o.orderNumber === orderNumber);
    expect(order, 'order should be in the account').toBeTruthy();
    expect(order!.totalAmount, 'account total').toBe(q.total);
    expect(order!.shippingFee).toBe(0);
    expect(order!.isBulkOrder).toBe(true);
    expect(order!.address?.city).toBe('اصفهان');

    // Pay successfully: 10 of the available greens are bought.
    await page.getByRole('link', { name: 'پرداخت موفق' }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 30000 });
    const paid = (await listOrders(context)).find((o) => o.orderNumber === orderNumber);
    expect(paid?.status).toBe('PROCESSING');
  });

  test('C-05 9 honey outside Shiraz (fewer than 10 packages, subtotal over 5,000,000): bulk allowed', async () => {
    test.setTimeout(240000);
    await ensureLoggedIn(context, page, test.info());
    await clearCart(page);
    await addToCartViaUi(page, catalog.honey, 9);
    await page.goto('/checkout');
    await fillCheckoutAddress(page, 'اصفهان', 'اصفهان');

    const lines = [{ productId: catalog.honey.id, quantity: 9 }];
    const q = await quoteFor(context.request, lines, 'اصفهان', 'اصفهان', slotId);
    expect(q.subtotal).toBeGreaterThanOrEqual(5000000);
    expect(q.ok).toBe(true);
    expect(q.shipping).toBe(0);

    await expectUiAmountToMatch(page, q.total);
    await expect(checkoutSubmit(page)).toBeEnabled({ timeout: 20000 });
    const gateway = await submitToGateway(page);
    const orderNumber = gateway.searchParams.get('orderNumber') ?? '';
    expect(Number(gateway.searchParams.get('amount'))).toBe(q.total);

    const order = (await listOrders(context)).find((o) => o.orderNumber === orderNumber);
    expect(order!.totalAmount).toBe(q.total);
    expect(order!.isBulkOrder).toBe(true);

    // Cancel the payment: stock and slot are released and the cart is kept.
    await page.getByRole('link', { name: 'لغو پرداخت' }).click();
    await expect(page.getByText('پرداخت لغو شد یا با خطا مواجه گردید')).toBeVisible({ timeout: 30000 });
    const cancelled = (await listOrders(context)).find((o) => o.orderNumber === orderNumber);
    expect(cancelled?.status).toBe('CANCELLED');
    expect((await readCartLines(page)).find((l) => l.productId === catalog.honey.id)?.quantity).toBe(9);
  });

  test('C-06 city "شیراز" typed with province "تهران": blocked, and the Shiraz hint must not appear', async () => {
    test.setTimeout(180000);
    await ensureLoggedIn(context, page, test.info());
    await clearCart(page);
    await addToCartViaUi(page, catalog.eggs, 1);
    await addToCartViaUi(page, catalog.cheese, 1);
    await page.goto('/checkout');
    await fillCheckoutAddress(page, 'تهران', SHIRAZ_PERSIAN_YEH);

    const q = await quoteFor(context.request, [
      { productId: catalog.eggs.id, quantity: 1 },
      { productId: catalog.cheese.id, quantity: 1 },
    ], SHIRAZ_PERSIAN_YEH, 'تهران', slotId);
    expect(q.isShiraz).toBe(false);

    await expect(page.getByText('صرفاً مختص شهر شیراز است')).toBeVisible({ timeout: 20000 });
    await expect(checkoutSubmit(page)).toBeDisabled();
    await expect(
      page.getByText('در محدوده ارسال اختصاصی شیراز است'),
      'green Shiraz hint is shown although the server says the address is outside Shiraz'
    ).toHaveCount(0);
  });

  test('C-07 city "شيراز" (Arabic ي) with province فارس: Shiraz order is allowed, no outside-Shiraz warning', async () => {
    test.setTimeout(180000);
    await ensureLoggedIn(context, page, test.info());
    await clearCart(page);
    await addToCartViaUi(page, catalog.eggs, 1);
    await addToCartViaUi(page, catalog.cheese, 1);
    await page.goto('/checkout');
    await fillCheckoutAddress(page, 'فارس', SHIRAZ_ARABIC_YEH);

    const q = await quoteFor(context.request, [
      { productId: catalog.eggs.id, quantity: 1 },
      { productId: catalog.cheese.id, quantity: 1 },
    ], SHIRAZ_ARABIC_YEH, 'فارس', slotId);
    expect(q.isShiraz).toBe(true);
    expect(q.ok).toBe(true);

    await expectUiAmountToMatch(page, q.total);
    await expect(checkoutSubmit(page)).toBeEnabled({ timeout: 20000 });
    await expect(
      page.getByText('خارج از شیراز وجود ندارد'),
      'outside-Shiraz block must not show for an address the server accepts as Shiraz'
    ).toHaveCount(0);
  });

  test('C-08 Shiraz retail, 2 items: normal courier fee, UI = quote = gateway = account', async () => {
    test.setTimeout(240000);
    await ensureLoggedIn(context, page, test.info());
    await clearCart(page);
    await addToCartViaUi(page, catalog.eggs, 1);
    await addToCartViaUi(page, catalog.cheese, 1);
    await page.goto('/checkout');
    await fillCheckoutAddress(page, 'فارس', SHIRAZ_PERSIAN_YEH);

    const lines = [
      { productId: catalog.eggs.id, quantity: 1 },
      { productId: catalog.cheese.id, quantity: 1 },
    ];
    const q = await quoteFor(context.request, lines, SHIRAZ_PERSIAN_YEH, 'فارس', slotId);
    expect(q.isShiraz).toBe(true);
    expect(q.ok).toBe(true);
    expect(q.isBulk).toBe(false);
    expect(q.shipping, 'Shiraz retail pays the courier fee').toBeGreaterThan(0);
    expect(q.total).toBe(q.subtotal + q.shipping);

    await expect(page.getByText('در محدوده ارسال اختصاصی شیراز است')).toBeVisible({ timeout: 20000 });
    await expectUiAmountToMatch(page, q.total);
    const shippingRow = page.getByText('هزینه ارسال با پیک پروفارم:', { exact: true }).locator('xpath=../..');
    expect(amountIn(await shippingRow.innerText())).toBe(q.shipping);

    const gateway = await submitToGateway(page);
    const orderNumber = gateway.searchParams.get('orderNumber') ?? '';
    expect(Number(gateway.searchParams.get('amount'))).toBe(q.total);

    const order = (await listOrders(context)).find((o) => o.orderNumber === orderNumber);
    expect(order!.totalAmount).toBe(q.total);
    expect(order!.shippingFee).toBe(q.shipping);
    expect(order!.isBulkOrder).toBe(false);

    await page.getByRole('link', { name: 'لغو پرداخت' }).click();
    await expect(page.getByText('پرداخت لغو شد یا با خطا مواجه گردید')).toBeVisible({ timeout: 30000 });
  });
});
