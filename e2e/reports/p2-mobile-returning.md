# P2 mobile returning customer journey: findings

Spec: `e2e/p2-mobile-returning.spec.ts`
Run: `npx playwright test e2e/p2-mobile-returning.spec.ts --reporter=list --output=e2e/test-results/p2`
Device: iPhone 13 emulation (375 x 812, touch), chromium project, dev server at http://localhost:3000.
Final run: **12 passed, 2 failed** (about 52 s). Both failures are product defects (F1, F2). The spec was not changed to hide them.

## Findings

### F1. High: OTP-only accounts cannot set a first password in account settings

- **Steps:** Register a new phone account through the OTP flow (`/login`, "ساخت حساب کاربری"). Open `/account`, open the "اطلاعات حساب" tab, enter a new password (8+ characters) in "کلمه عبور جدید", press "ذخیره تغییرات".
- **Expected:** The password is saved, because this account has no current password. Password login with phone and password then works.
- **Actual:** No request is sent. The page shows the alert "برای تغییر کلمه عبور، کلمه عبور فعلی را وارد کنید." (enter your current password). The "کلمه عبور فعلی" field cannot be filled because no password exists yet. Password login is therefore impossible for these customers. The spec used the server's own finish-registration path (`POST /api/auth/register` with a `phoneProof`) to keep the journey going, and that path worked.
- **Server side is fine:** `src/lib/db-store.ts` (about line 2714) only requires `currentPassword` when `user.password` already exists.
- **Suspected file:** `src/app/account/page.tsx`, around line 428: `if (newPasswordInput && !currentPasswordInput)` blocks the first-time case.
- **Evidence:** `e2e/test-results/p2/p2-mobile-returning-P2-mob-6e48b-sword-from-account-settings-chromium/error-context.md` (the alert text and "Received: null" are recorded there).

### F2. Medium: sticky add-to-cart bar touch targets below 44 px

- **Steps:** Open `/products/organic-eggs-kamfiruz-30` on the 375 px viewport and scroll down so the fixed bottom bar appears.
- **Expected:** The bar's "افزودن به سبد خرید" button and its quantity "+" / "-" buttons are at least 44 x 44 CSS px, per the project's mobile rule (ARCHITECTURE section 8).
- **Actual:** The sticky button is 32 px high. The quantity buttons are 28 x 28 px. The main add-to-cart button (72 px) and the account and checkout buttons (44 to 52 px) pass.
- **Suspected file:** `src/components/modules/ProductDetailClient.tsx`, sticky bar starting around line 1411 (`py-2 px-3.5 sm:py-2.5` button; `w-7 h-7` quantity buttons around lines 1440 and 1452).
- **Evidence:** `e2e/test-results/p2/p2-mobile-returning-P2-mob-10c18-main-and-sticky-add-to-cart-chromium/error-context.md`.

### F3. Low (observation, not a failure): search overlay has a hidden duplicate result link

- During T5, `page.locator('a[href="/products/organic-eggs-kamfiruz-30"]:visible')` matched the product link under the search overlay's backdrop, so a plain click timed out. The link inside the search dialog (`role=dialog` "جستجوی سریع محصولات") clicks and navigates correctly. The spec now targets the dialog link.
- The app behaves correctly for a user. This is a test-hygiene note only. Consider a single rendered result link per product, or `aria-hidden` on the non-visible copy.

## Checks that passed (Worked well)

- OTP registration on mobile with the mock code; the account page loads and the 5-digit code auto-submits.
- Password login after the account is given a password (via the server's finish-registration path); logout clears the session (`/api/auth/me` returns 401) and login restores it.
- Mobile menu opens (`aria-expanded` true) and closes.
- Quick search returns the egg product; the result opens the product page.
- Main add-to-cart works; the cart badge updates.
- Invalid coupon shows a Persian error ("کد تخفیف وارد شده معتبر نمی‌باشد.") and nothing is applied.
- FREE checkout: only Sunday and Wednesday day buttons are enabled; every other day is disabled, Friday is not offered.
- Server refuses a Saturday slot and a Monday slot for a FREE account (`POST /api/orders` returns 400 with a Persian message). Orders are not created.
- Order placed, then cancelled at the mock gateway: "پرداخت لغو شد..." message, order status CANCELLED, cart kept.
- Stock: 7 before placing, 6 while the order is pending, 7 after cancel. Released correctly. (Other testers may move stock; this run's values were consistent.)
- Pending order retry from the account ("پرداخت مجدد"): same order number, pays, status PROCESSING.
- Address book: add two, set default, edit, delete, reload. Data persists.
- Second browser context (different IP, password login) sees the same addresses (default flag included) and the same orders (CANCELLED and PROCESSING).
- No horizontal scroll (document scrollWidth <= clientWidth + 1) on all 17 pages visited.
- No unexpected console errors or page errors. The only console errors are the expected guest `401` for `/api/auth/me` on pages visited while logged out.

## Harness notes (not app defects)

- Playwright starts a fresh worker after a failed test. A fresh worker re-evaluates the spec, which gave a new phone number and an empty browser context. The journey state is now kept in a JSON file in the OS temp directory, and T1 starts a new journey. Each dependent test re-establishes its session (password login) and cart if needed, and records a `harness` annotation when it does.
- Before this fix, a failed test left the shared page on `about:blank` and dropped the session. Those cascades are no longer counted as app defects.
- Requests use `X-Real-IP` per context (as requested). Each context has its own IP to avoid per-IP rate limits.
- Test data created: several phone accounts `0912200XXXX`, one CANCELLED order and one PROCESSING order for the last phone (numbers are in the state file).
