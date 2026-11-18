import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Persona p1-new-visitor: first-time desktop visitor (1280px) doing a full guest -> register -> pay -> account journey.
// Real bugs are kept as failing soft assertions; every finding is also written to e2e/test-results/p1/findings.json.

const OUT_DIR = path.join(process.cwd(), 'e2e', 'test-results', 'p1');
const SHOT_DIR = path.join(OUT_DIR, 'shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const IP_LAST_OCTET = 1 + Math.floor(Math.random() * 240);
const PHONE = `0912100${String(1000 + Math.floor(Math.random() * 9000))}`;
const CUSTOMER_NAME = 'مسافر آزمایشی';
const ADDRESS = {
  city: 'شیراز',
  street: 'بلوار ارم، کوچه ۶، پلاک ۱۲',
  unit: '۳',
  postal: '7134713567',
};

test.use({
  viewport: { width: 1280, height: 900 },
  locale: 'fa-IR',
  // Dev server reads X-Real-IP; X-Forwarded-For's rightmost entry is overwritten by Next dev.
  extraHTTPHeaders: { 'X-Real-IP': `10.1.0.${IP_LAST_OCTET}` },
});

// ---------- helpers ----------

type Sev = 'blocker' | 'major' | 'minor' | 'info';
type Finding = {
  id: string;
  severity: Sev;
  title: string;
  stage: string;
  expected: string;
  actual: string;
  evidence: string[];
  suspectedFile: string;
};

const findings: Finding[] = [];
const passed: string[] = [];
const consoleIssues: { stage: string; text: string; url: string }[] = [];
const httpIssues: { stage: string; status: number; method: string; url: string }[] = [];
const requestFailures: { stage: string; url: string; error: string }[] = [];
const notes: Record<string, any> = {};
const S: Record<string, any> = {};
let stage = 'init';
let seq = 0;
let P!: Page;

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (s: string) => s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
const fmtToman = (n: number) => `${toFa(Math.round(n).toLocaleString('en-US'))} تومان`;
const toEn = (s: string) => s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
// Parses a Persian toman amount such as "۴۱۹,۰۰۰ تومان" into a number (0 when absent).
const toNumFa = (s: string) => Number(toEn(s).replace(/[^\d]/g, '')) || 0;
// Normalise Arabic yeh/kaf to Persian, strip ZWNJ, spaces and harakat so search matching can be compared.
const norm = (s: string) =>
  s
    .replace(/[‌‍\s]/g, '')
    .replace(/[ً-ٟ]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase();

async function shot(label: string): Promise<string> {
  // e2e/test-results is shared with other testers' runs, which clean it; recreate on demand.
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${label}.png`);
  try {
    await P.screenshot({ path: file, fullPage: true });
    return file;
  } catch {
    return '';
  }
}

async function record(sev: Sev, title: string, expected: string, actual: string, suspectedFile = '') {
  seq += 1;
  const id = `P1-${String(seq).padStart(2, '0')}`;
  const ev = sev === 'info' ? '' : await shot(id);
  findings.push({
    id,
    severity: sev,
    title,
    stage,
    expected,
    actual: actual.slice(0, 900),
    evidence: ev ? [ev] : [],
    suspectedFile,
  });
}

async function chk(cond: boolean, sev: Sev, title: string, expected: string, actual: string, suspectedFile = '') {
  if (cond) {
    passed.push(`[${stage}] ${title}`);
    return;
  }
  await record(sev, title, expected, actual, suspectedFile);
  expect.soft(cond, `${sev.toUpperCase()}: ${title}`).toBe(true);
}

// Written after every step so a timeout or crash still leaves the findings on disk.
function flush() {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, 'findings.json'),
      JSON.stringify({ findings, passed, consoleIssues, httpIssues, requestFailures, notes, state: { orderNumber: S.orderNumber, orderTotal: S.orderTotal, target: S.target?.slug } }, null, 2),
      'utf8'
    );
  } catch {
    /* best effort */
  }
}

async function step(name: string, fn: () => Promise<void>, fatal = false) {
  stage = name;
  console.log(`[P1] >>> ${name}`);
  try {
    await fn();
    passed.push(`[${name}] completed`);
    console.log(`[P1] <<< ${name} ok`);
  } catch (err) {
    console.log(`[P1] <<< ${name} FAILED: ${String((err as Error).message).split('\n')[0].slice(0, 200)}`);
    const msg = String((err as Error).message || err)
      .split('\n')
      .filter(Boolean)
      .slice(0, 3)
      .join(' | ')
      .slice(0, 700);
    await record(fatal ? 'blocker' : 'major', `Step did not complete: ${name}`, 'Step completes without error', msg);
    expect.soft(false, `Step did not complete: ${name}`).toBe(true);
    flush();
    if (fatal) throw err;
  }
  flush();
}

function monitor(page: Page) {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleIssues.push({ stage, text: m.text().slice(0, 300), url: page.url() });
  });
  page.on('pageerror', (e) => consoleIssues.push({ stage, text: `pageerror: ${e.message}`.slice(0, 300), url: page.url() }));
  page.on('crash', () => consoleIssues.push({ stage, text: 'RENDERER CRASH (page crashed event)', url: page.url() }));
  page.on('response', (r) => {
    const s = r.status();
    if (s < 400) return;
    // Expected: guests get 401 from /api/auth/me.
    if (s === 401 && r.url().includes('/api/auth/me')) return;
    httpIssues.push({ stage, status: s, method: r.request().method(), url: r.url() });
  });
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    if (err.includes('ERR_ABORTED')) return;
    requestFailures.push({ stage, url: r.url(), error: err });
  });
}

async function scrollAll() {
  await P.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await P.waitForTimeout(400);
}

async function health(label: string) {
  await scrollAll();
  const h = await P.evaluate(() => {
    const de = document.documentElement;
    const imgs = Array.from(document.images);
    const broken = imgs
      .filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src))
      .map((i) => i.currentSrc || i.src)
      .slice(0, 10);
    const body = document.body.innerText || '';
    const priceLines = body
      .split('\n')
      .filter((l) => l.includes('تومان') && /[0-9]/.test(l))
      .slice(0, 5);
    return {
      title: document.title,
      dir: de.dir,
      sw: de.scrollWidth,
      cw: de.clientWidth,
      broken,
      priceLines,
      imgCount: imgs.length,
    };
  });
  notes[`title:${label}`] = h.title;
  await chk(
    h.title.trim().length > 0 && !/Create Next App/i.test(h.title),
    'minor',
    `[${label}] document title is set`,
    'Non-empty Persian/brand page title',
    `title="${h.title}"`,
    'src/app/layout.tsx'
  );
  await chk(h.dir === 'rtl', 'minor', `[${label}] html dir is rtl`, 'dir="rtl"', `dir="${h.dir}"`, 'src/app/layout.tsx');
  await chk(
    h.sw <= h.cw + 1,
    'major',
    `[${label}] no horizontal overflow at 1280px`,
    'scrollWidth <= clientWidth',
    `scrollWidth=${h.sw} clientWidth=${h.cw}`,
    'src/app/globals.css'
  );
  await chk(
    h.broken.length === 0,
    'major',
    `[${label}] no broken images`,
    'All loaded images have naturalWidth > 0',
    h.broken.join(' , ') || 'none',
    'src/components/modules/ProductCard.tsx'
  );
  await chk(
    h.priceLines.length === 0,
    'minor',
    `[${label}] prices use Persian digits`,
    'Price lines contain no Latin digits',
    h.priceLines.join(' / ') || 'none',
    'src/lib/formatters.ts'
  );
}

async function textVisible(text: string, timeout = 5000): Promise<boolean> {
  return P.getByText(text).first().waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false
  );
}

// ---------- journey ----------

test('P1 new visitor: first-time desktop purchase journey', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);
  P = page;
  monitor(page);

  try {
    await step(
      '00 setup: pick an in-stock product from the API',
      async () => {
        const res = await page.request.get('/api/products');
        const body = await res.json();
        const products: any[] = body.products ?? [];
        const stockOf = (p: any) => Number(p.stock ?? p.stockQuantity ?? 0);
        const cands = products.filter((p) => stockOf(p) >= 3 && Number(p.price) > 0);
        const target = cands.find((p) => String(p.slug).startsWith('organic-eggs')) ?? cands[0];
        if (!target) throw new Error('No product with stock >= 3 is available right now');
        S.target = target;
        S.unitPrice = Number(target.price);
        notes.target = { slug: target.slug, title: target.title, price: target.price, stock: stockOf(target) };
        notes.phone = PHONE;
        notes.ip = `10.1.0.${IP_LAST_OCTET}`;
      },
      true
    );

    // ---- 01 home ----
    await step('01 home loads with products and categories', async () => {
      const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
      await chk(!!res && res.ok(), 'blocker', 'home returns 200', 'HTTP 200', String(res?.status()), 'src/app/page.tsx');
      await page.waitForSelector('a[href^="/products/"]', { timeout: 30000 });
      await health('home');
      const body = await page.innerText('body');
      await chk(
        /تخم|عسل|سبزیجات|لبنیات/.test(body),
        'major',
        'home shows category / product content',
        'Category or product names visible on home',
        body.slice(0, 200)
      );
    });

    // ---- 02 header search ----
    await step('02 header search with Persian and Arabic letter variants', async () => {
      // Search input may sit behind a toggle on some breakpoints; open it if hidden.
      let input = page.locator('input[placeholder^="جستجوی فرآورده"]:visible').first();
      if ((await input.count()) === 0) {
        await page.locator('button[aria-label*="جستجو"]:visible').first().click();
        input = page.locator('input[placeholder^="جستجوی فرآورده"]:visible').first();
      }
      await input.waitFor({ state: 'visible', timeout: 10000 });
      const queries = [
        { text: 'تخم', hint: 'egg' },
        { text: 'عسل', hint: 'honey' },
        { text: 'تخم مرغ', hint: 'space instead of ZWNJ' },
        { text: 'زيتون', hint: 'Arabic yeh' },
        { text: 'كنار', hint: 'Arabic kaf' },
      ];
      notes.search = {};
      for (const q of queries) {
        await input.fill(q.text);
        await page.waitForTimeout(900);
        let titles = await page.locator('header a[href^="/products/"]:visible').allInnerTexts();
        if (titles.length === 0) titles = await page.locator('[role="search"] ~ * a[href^="/products/"]:visible, a[href^="/products/"]:visible').allInnerTexts();
        titles = titles.map((t) => t.split('\n')[0].trim()).filter(Boolean);
        notes.search[q.text] = titles.slice(0, 6);
        await chk(
          titles.length > 0,
          'major',
          `search "${q.text}" (${q.hint}) returns results`,
          'At least one product in the dropdown',
          `0 results`,
          'src/components/modules/Header.tsx'
        );
        await chk(
          titles.some((t) => norm(t).includes(norm(q.text))),
          'minor',
          `search "${q.text}" (${q.hint}) matches a product title`,
          'A result title contains the normalised query',
          titles.join(' / ') || 'none',
          'src/components/modules/Header.tsx'
        );
      }
      await input.fill('');
      await page.keyboard.press('Escape');
    });

    // ---- 03 open a category ----
    await step('03 open category from catalog', async () => {
      await page.goto('/products', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('a[href^="/products/"]', { timeout: 30000 });
      await health('catalog');
      const cat = String(S.target.category);
      let catControl = page.locator('button:visible', { hasText: cat }).first();
      if ((await catControl.count()) === 0) catControl = page.locator('a:visible', { hasText: cat }).first();
      await chk(
        (await catControl.count()) > 0,
        'major',
        'catalog exposes a control for the product category',
        `Control labelled "${cat}"`,
        'not found',
        'src/components/modules/ProductsCatalogClient.tsx'
      );
      await catControl.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(600);
      const card = page.locator(`a[href="/products/${S.target.slug}"]:visible`).first();
      await chk(
        (await card.count()) > 0,
        'major',
        'category listing shows the chosen product',
        `Product card for ${S.target.slug}`,
        'not visible after category click',
        'src/components/modules/ProductsCatalogClient.tsx'
      );
      await health('category');
    });

    // ---- 04 product page ----
    await step('04 product page: gallery, specs, price', async () => {
      await page.locator(`a[href="/products/${S.target.slug}"]:visible`).first().click();
      await page.waitForURL(/\/products\/.+/, { timeout: 20000 });
      await page.waitForSelector('h1', { timeout: 20000 });
      await health('product');
      const h1 = (await page.locator('h1:visible').first().innerText()).trim();
      await chk(
        norm(h1).includes(norm(String(S.target.title)).slice(0, 12)),
        'major',
        'product h1 matches the product title',
        `h1 contains "${String(S.target.title).slice(0, 12)}"`,
        h1,
        'src/components/modules/ProductDetailClient.tsx'
      );
      const body = await page.innerText('body');
      const expectedPrice = fmtToman(S.unitPrice);
      await chk(
        body.includes(expectedPrice),
        'blocker',
        'product page shows the server price in Persian format',
        `"${expectedPrice}" visible`,
        `price text not found; lines with تومان: ${body.split('\n').filter((l) => l.includes('تومان')).slice(0, 4).join(' / ')}`,
        'src/components/modules/ProductDetailClient.tsx'
      );
      await chk(
        /مشخصات|ویژگی/.test(body),
        'minor',
        'product page has a specs section',
        'Section headed مشخصات or ویژگی',
        'not found',
        'src/components/modules/ProductDetailClient.tsx'
      );
      const imgs = await page.locator('main img:visible, img:visible').count();
      await chk(imgs >= 1, 'major', 'product gallery renders at least one image', '>= 1 visible image', String(imgs), 'src/components/modules/ProductDetailClient.tsx');
    });

    // ---- 05 add to cart qty 2 ----
    await step('05 add product to cart with qty 2', async () => {
      await page.locator('button[aria-label="افزایش تعداد"]:visible').first().click();
      const addBtn = page.locator('button:visible', { hasText: 'افزودن ۲ عدد به سبد خرید' }).first();
      await chk(
        (await addBtn.count()) > 0,
        'major',
        'add button reflects quantity 2',
        'Button "افزودن ۲ عدد به سبد خرید"',
        'not found after increment',
        'src/components/modules/ProductDetailClient.tsx'
      );
      await addBtn.click();
      const toast = await textVisible('با موفقیت به سبد خرید افزوده شد', 6000);
      await chk(toast, 'minor', 'add-to-cart shows confirmation toast', 'Toast "... با موفقیت به سبد خرید افزوده شد"', 'no toast seen', 'src/components/modules/ProductDetailClient.tsx');
    });

    // ---- 06 cart ----
    await step('06 cart: quantity changes and totals', async () => {
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      const title = String(S.target.title);
      const plus = page.locator(`button[aria-label="افزایش تعداد ${title}"]:visible`).first();
      await plus.waitFor({ state: 'visible', timeout: 20000 });
      await health('cart');
      const p = S.unitPrice;
      let body = await page.innerText('body');
      await chk(body.includes(fmtToman(p * 2)), 'blocker', 'cart line total for qty 2 is correct', `${fmtToman(p * 2)} visible`, `cart lines: ${body.split('\n').filter((l) => l.includes('تومان')).slice(0, 6).join(' / ')}`, 'src/app/cart/page.tsx');
      await plus.click();
      await page.waitForTimeout(500);
      body = await page.innerText('body');
      await chk(body.includes(fmtToman(p * 3)), 'major', 'increasing qty to 3 updates the line total', `${fmtToman(p * 3)} visible`, 'not found', 'src/app/cart/page.tsx');
      await page.locator(`button[aria-label="کاهش تعداد ${title}"]:visible`).first().click();
      await page.waitForTimeout(500);
      body = await page.innerText('body');
      await chk(body.includes(fmtToman(p * 2)), 'major', 'decreasing qty back to 2 restores the line total', `${fmtToman(p * 2)} visible`, 'not found', 'src/app/cart/page.tsx');
      notes.cartSummaryLines = body.split('\n').filter((l) => /جمع|مبلغ|تخفیف|حمل|کل/.test(l)).slice(0, 12);
    });

    // ---- 07 guest checkout -> login ----
    await step('07 guest checkout redirects to login', async () => {
      await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
      // The checkout summary shows the item subtotal (qty x unit price), not product names.
      // /checkout compiles on first hit in dev, so wait for the value rather than a fixed delay.
      await chk(await textVisible(fmtToman(S.unitPrice * 2), 25000), 'major', 'guest cart survives to checkout', `Item subtotal ${fmtToman(S.unitPrice * 2)} in checkout summary`, 'not found within 25s', 'src/app/checkout/page.tsx');
      const body = await page.innerText('body');
      const submit = page.locator('button[type="submit"]:visible').last();
      notes.guestSubmitText = (await submit.innerText().catch(() => '')).trim();
      await submit.click();
      await page.waitForURL(/\/login/, { timeout: 15000 });
      await chk(
        page.url().includes('redirect='),
        'major',
        'guest checkout redirects to login with a return path',
        'URL contains redirect=',
        page.url(),
        'src/app/checkout/page.tsx'
      );
    });

    // ---- 08 register via OTP ----
    await step(
      '08 register via OTP with name',
      async () => {
        await page.getByRole('button', { name: 'ساخت حساب کاربری', exact: true }).click();
        await page.locator('#login-name-1').fill(CUSTOMER_NAME);
        await page.locator('#login-phone').fill(PHONE);
        const [sendRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/auth/otp') && r.request().method() === 'POST'),
          page.getByRole('button', { name: 'دریافت کد و ساخت حساب کاربری', exact: true }).click(),
        ]);
        const sendBody: any = await sendRes.json().catch(() => ({}));
        notes.otpSend = { status: sendRes.status(), hasDebugCode: 'debugCode' in sendBody };
        const code = sendBody.debugCode;
        await chk(
          sendRes.ok() && typeof code === 'string' && /^\d{5}$/.test(code),
          'blocker',
          'OTP send returns a 5-digit code (mock SMS)',
          '200 with debugCode of 5 digits',
          `status=${sendRes.status()} body=${JSON.stringify(sendBody).slice(0, 200)}`,
          'src/app/api/auth/otp/route.ts'
        );
        if (typeof code !== 'string') throw new Error('OTP code not exposed; cannot continue registration');
        const boxes = page.locator('input[aria-label^="رقم"]');
        await boxes.first().waitFor({ state: 'visible', timeout: 10000 });
        // The OTP form auto-submits when the 5th digit is entered (login page submitVerifyOtp), so listen first.
        const verifyResp = page.waitForResponse((r) => r.url().includes('/api/auth/otp') && r.request().method() === 'POST', { timeout: 20000 });
        for (let i = 0; i < 5; i++) await boxes.nth(i).fill(code[i]);
        const verifyBtn = page.getByRole('button', { name: 'تکمیل ثبت‌نام و ورود به پروفارم', exact: true });
        if (await verifyBtn.isVisible().catch(() => false)) {
          await verifyBtn.click({ noWaitAfter: true, timeout: 5000 }).catch(() => undefined);
        }
        const verRes = await verifyResp;
        notes.otpAutoSubmit = 'verify request fired from OTP entry';
        await chk(verRes.ok(), 'blocker', 'OTP verify + registration succeeds', '200', `status=${verRes.status()}`, 'src/app/api/auth/otp/route.ts');
        await page.waitForURL(/\/checkout/, { timeout: 20000 });
        const me = await page.request.get('/api/auth/me');
        const meBody: any = await me.json().catch(() => ({}));
        notes.meAfterRegister = { status: me.status(), name: meBody?.user?.name, phone: meBody?.user?.phone, tier: meBody?.user?.tier ?? meBody?.user?.subscriptionTier };
        await chk(
          me.ok() && (meBody?.user?.name || '').includes('مسافر'),
          'major',
          'registered name is stored on the account',
          `/api/auth/me returns name containing "${CUSTOMER_NAME}"`,
          JSON.stringify(notes.meAfterRegister),
          'src/app/api/auth/otp/route.ts'
        );
      },
      true
    );

    // ---- 09 checkout: address, slot, pay ----
    await step('09 checkout: address, postal code, slot, pay with mock gateway', async () => {
      await page.waitForSelector('#checkout-recipient', { timeout: 20000 });
      await health('checkout');
      const recipient = page.locator('#checkout-recipient');
      if (!(await recipient.inputValue())) await recipient.fill(CUSTOMER_NAME);
      const province = page.locator('#checkout-province');
      if ((await province.count()) > 0) await province.selectOption('فارس').catch(() => undefined);
      const phoneField = page.locator('#checkout-phone');
      if (!(await phoneField.inputValue())) await phoneField.fill(PHONE);
      await page.locator('#checkout-city').fill(ADDRESS.city);
      await page.locator('#checkout-street').fill(ADDRESS.street);
      await page.locator('#checkout-unit').fill(ADDRESS.unit);
      await page.locator('#checkout-postal').fill(ADDRESS.postal);

      // Slot: pick the first enabled day (FREE users: Sunday or Wednesday), then the first open time window.
      const dayBtn = page
        .locator('button[type="button"]:visible:not([disabled])')
        .filter({ hasText: /یکشنبه|چهارشنبه/ })
        .first();
      if ((await dayBtn.count()) > 0) await dayBtn.click();
      await page.waitForTimeout(400);
      const slot = page.locator('div.border-2.cursor-pointer:visible').first();
      notes.slotFound = await slot.count();
      await chk(
        (await slot.count()) > 0,
        'blocker',
        'an open delivery slot can be selected for FREE user',
        'At least one available time window',
        'no selectable slot found',
        'src/components/modules/DeliverySlotPicker.tsx'
      );
      if ((await slot.count()) > 0) await slot.click();
      await page.waitForTimeout(300);

      await page.getByText('درگاه پرداخت زرین‌پال').first().click().catch(() => undefined);
      await page.waitForTimeout(300);
      // Amounts shown on the checkout summary before paying (used to compare with the gateway amount).
      // Wait for the quote to render (item subtotal) so the lines are not captured while the page is loading.
      await textVisible(fmtToman(S.unitPrice * 2), 25000);
      await page.waitForTimeout(800);
      const preLines = (await page.innerText('body')).split('\n').filter((l) => l.includes('تومان'));
      const submit = page.getByRole('button', { name: /پرداخت امن با درگاه زرین‌پال/ }).first();
      const orderResp = page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST', { timeout: 30000 });
      await submit.click({ noWaitAfter: true });
      const orderRes = await orderResp;
      // The app navigates to the gateway right after this POST, so the response body is not readable here.
      await chk(orderRes.ok(), 'blocker', 'order placement is accepted (HTTP 200)', '200', `status=${orderRes.status()}`, 'src/app/api/orders/route.ts');
      await page.waitForURL(/mock-gateway/, { timeout: 25000 });
      await page.getByRole('link', { name: 'پرداخت موفق' }).waitFor({ state: 'visible', timeout: 20000 });
      const gw = await page.innerText('body');
      const gwLine = gw.split('\n').find((l) => l.includes('تومان') && /[۰-۹]/.test(l)) ?? '';
      S.orderTotal = toNumFa(gwLine);
      S.gatewayOrderNumber = gw.match(/PRF-[A-Za-z0-9-]+/)?.[0] ?? '';
      notes.gateway = { gwLine, orderNo: S.gatewayOrderNumber, preLines: preLines.slice(0, 6) };
      await chk(
        preLines.some((l) => toNumFa(l) === S.orderTotal && S.orderTotal > 0),
        'blocker',
        'gateway amount equals the amount shown at checkout before paying',
        `checkout summary shows ${fmtToman(S.orderTotal)}`,
        `gateway: "${gwLine}"; checkout lines: ${preLines.slice(0, 6).join(' / ')}`,
        'src/app/checkout/mock-gateway/page.tsx'
      );
      await page.getByRole('link', { name: 'پرداخت موفق' }).click({ noWaitAfter: true });
      await page.waitForURL(/\/checkout\/success/, { timeout: 30000 });
      S.orderNumber = new URL(page.url()).searchParams.get('orderNumber') ?? S.gatewayOrderNumber;
      notes.orderNumber = { fromGateway: S.gatewayOrderNumber, fromSuccessUrl: S.orderNumber };
      await chk(
        !!S.gatewayOrderNumber && S.gatewayOrderNumber === S.orderNumber,
        'minor',
        'order number on gateway matches the success redirect',
        'Same PRF-... number',
        `gateway=${S.gatewayOrderNumber} success=${S.orderNumber}`,
        'src/app/api/payment/verify/route.ts'
      );
    });

    // ---- 10 success page ----
    await step('10 success page shows order and invoice action', async () => {
      await page.waitForLoadState('load');
      const orderNo = String(S.orderNumber);
      // The page renders the number with Persian digits, so compare after converting to Latin digits.
      await page.getByText(/PRF-/).first().waitFor({ state: 'visible', timeout: 25000 }).catch(() => undefined);
      await health('success');
      const body = await page.innerText('body');
      await chk(toEn(body).includes(orderNo), 'major', 'success page shows the order number', orderNo, 'not found (even after digit normalisation)', 'src/app/checkout/success/page.tsx');
      await chk(
        body.includes(orderNo),
        'minor',
        'order number on success page uses Latin digits like the account page',
        `"${orderNo}" with Latin digits`,
        `rendered with Persian digits: ${toFa(orderNo)}`,
        'src/app/checkout/success/page.tsx'
      );
      notes.successPageHasInvoiceButton = (await page.locator('button:visible, a:visible', { hasText: 'فاکتور' }).count()) > 0;
    });

    // ---- 11 account ----
    await step('11 account shows the order with status and total', async () => {
      await page.goto('/account?tab=orders', { waitUntil: 'domcontentloaded' });
      const orderNo = String(S.orderNumber);
      await page.getByText(orderNo).first().waitFor({ state: 'visible', timeout: 25000 });
      await health('account');
      const rows = await page.locator('article, li, tr, div').filter({ hasText: orderNo }).allInnerTexts();
      const row = rows.sort((a, b) => a.length - b.length)[0] ?? '';
      // The status badge sits outside the smallest element that holds the number, so check the page body too.
      const accountBody = await page.innerText('body');
      notes.accountRow = row.slice(0, 400);
      notes.accountStatusFound = accountBody.includes('در حال آماده‌سازی در مزرعه');
      await chk(
        row.includes(fmtToman(S.orderTotal)),
        'blocker',
        'account order total equals the amount charged',
        fmtToman(S.orderTotal),
        row.split('\n').filter((l) => l.includes('تومان')).join(' / ') || 'no total in row',
        'src/app/account/page.tsx'
      );
      await chk(
        accountBody.includes('در حال آماده‌سازی در مزرعه'),
        'major',
        'account order status is PROCESSING after successful payment',
        'وضعیت "در حال آماده‌سازی در مزرعه" (PROCESSING label in site-config)',
        row.split('\n').slice(0, 8).join(' | '),
        'src/lib/site-config.ts'
      );
    });

    // ---- 12 review attempt ----
    await step('12 review attempt on purchased product (before delivery)', async () => {
      console.log('[P1] review: goto product');
      await page.goto(`/products/${S.target.slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('h1', { timeout: 20000 });
      console.log('[P1] review: product loaded');
      // The review CTA lives inside the reviews tab, which is not open by default.
      await page.locator('button:visible', { hasText: 'دیدگاه‌ها و نظرات' }).first().click({ timeout: 8000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      const reviewBtn = page.locator('button:visible', { hasText: 'ثبت نظر برای این محصول' }).first();
      await reviewBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
      const reviewBtnCount = await reviewBtn.count();
      notes.reviewButtonCount = reviewBtnCount;
      if (reviewBtnCount > 0) {
        await reviewBtn.click({ timeout: 8000 }).catch((e) => { notes.reviewClickError = String(e.message).split('\n')[0].slice(0, 200); });
      }
      console.log('[P1] review: clicked');
      await page.waitForTimeout(1500);
      const dialog = page.getByRole('dialog', { name: 'ثبت دیدگاه' });
      const dialogOpen = (await dialog.count()) > 0 && (await dialog.first().isVisible({ timeout: 3000 }).catch(() => false));
      const body = await P.locator('body').innerText({ timeout: 10000 });
      console.log('[P1] review: dialogOpen=' + dialogOpen);
      const blockedMsg = body.match(/[^\n]*(?:تحویل|ابتدا وارد|خریداران)[^\n]*/g)?.slice(0, 3) ?? [];
      notes.review = { dialogOpen, blockedMsg };
      if (dialogOpen) {
        // The server decides eligibility on submit (403 until DELIVERED). Submitting a refused review writes nothing.
        await dialog.locator('textarea').first().fill('نظر آزمایشی P1 (انتظار تحویل سفارش)');
        const reviewResp = page.waitForResponse((r) => r.request().method() === 'POST' && /review/i.test(r.url()), { timeout: 15000 }).catch(() => null);
        await dialog.getByRole('button', { name: 'ثبت نهایی دیدگاه' }).click({ noWaitAfter: true, timeout: 8000 }).catch(() => undefined);
        const rr = await reviewResp;
        const status = rr ? rr.status() : 0;
        notes.reviewSubmit = { status, url: rr?.url() ?? '' };
        await page.waitForTimeout(1200);
        const afterBody = await P.locator('body').innerText({ timeout: 10000 });
        await chk(
          status === 403 || status === 401,
          'blocker',
          'review submission is refused before the order is DELIVERED',
          'Server returns 403 (not a delivered buyer) and the rule is explained',
          `review POST status=${status}; eligibility message shown=${/باید|تحویل|خریدار/.test(afterBody)}`,
          'src/app/api/reviews/route.ts'
        );
        await page.keyboard.press('Escape').catch(() => undefined);
      } else {
        await chk(
          blockedMsg.length > 0 || (await page.locator('button:visible', { hasText: 'ثبت نظر' }).count()) === 0,
          'info' as Sev,
          'review is blocked before delivery (recorded behaviour)',
          'Blocked with message',
          blockedMsg.join(' | ') || 'no dialog and no message',
          'src/components/modules/ProductDetailClient.tsx'
        );
      }
    });

    // ---- 13 logout ----
    await step('13 logout clears user session and guest cart', async () => {
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const logout = page.locator('button:visible', { hasText: 'خروج از حساب' }).first();
      if ((await logout.count()) === 0) throw new Error('No visible "خروج از حساب" control on /account');
      await logout.click();
      await page.waitForTimeout(1200);
      const me = await page.request.get('/api/auth/me');
      await chk(me.status() === 401, 'major', 'session is cleared after logout', '/api/auth/me returns 401', `status=${me.status()}`, 'src/app/api/auth/logout/route.ts');
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const body = await page.innerText('body');
      await chk(
        /سبد خرید شما خالی|سبد خرید خالی/.test(body) || !body.includes(String(S.target.title).slice(0, 10)),
        'minor',
        'cart is empty after a completed order and logout',
        'Empty-cart state',
        body.split('\n').slice(0, 12).join(' | '),
        'src/hooks/useCart.ts'
      );
      await health('after-logout');
    });
  } finally {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, 'findings.json'),
      JSON.stringify({ findings, passed, consoleIssues, httpIssues, requestFailures, notes, state: { orderNumber: S.orderNumber, orderTotal: S.orderTotal, target: S.target?.slug } }, null, 2),
      'utf8'
    );
  }
});
