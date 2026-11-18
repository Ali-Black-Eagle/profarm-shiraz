# p6-admin: admin-operator journey report

- Scope: admin UI and admin/storefront APIs on http://localhost:3000 (dev server, disposable data), desktop 1280px, mobile 375px for /admin and /admin/orders.
- Spec: `e2e/p6-admin.spec.ts` (16 tests, journey steps 1 to 12).
- Run: `npx playwright test e2e/p6-admin.spec.ts --reporter=list --output=e2e/test-results/p6`
- Result of the last full run: 14 of 16 tests passed. 2 tests failed, and each failure is an app bug (findings F1 and F2). Three soft assertions failed in total.
- Evidence: `e2e/test-results/p6/p6-results.json` (every assertion and observation with detail), `e2e/test-results/p6/p6-state.json` (run ids and created records), screenshots and error context for the two failed tests under `e2e/test-results/p6/`.
- No credentials appear in this report, the spec output, or the result files. The admin login is read from the project file at runtime.

## Findings

### F1. Legacy admin endpoint stores negative price and stock (HIGH)

- Steps: as an admin, `POST /api/admin` with `{ "action": "updateProduct", "payload": { "id": "<product id>", "updates": { "price": -5 } } }`. Then read the product through `GET /api/admin/products?q=<title>`. Repeat with `updates: { "stock": -3 }`.
- Expected: HTTP 400 with a Persian message, the same as `PATCH /api/admin/products` (`price` and `stock` must be >= 0). The product keeps its previous values.
- Actual: HTTP 200 `success` for both calls. Stored price is `-5`, stored stock is `-3`. The validated route rejects the same values correctly (`fیلد «stock»: موجودی نمی‌تواند کمتر از 0 باشد`).
- Evidence: notes `legacy POST /api/admin updateProduct with price -5` and `... stock -3` in `p6-results.json`. The probe ran only on this run's hidden test product, and the spec restored it.
- Suspected file: `src/app/api/admin/route.ts`, the `updateProduct` branch (around line 116). It passes `payload.updates` straight to `farmStore.updateProduct` with no zod schema. The validated counterpart is `productUpdateSchema` in `src/app/api/admin/products/route.ts`.
- Impact: any client or script that still uses the legacy action can put negative prices or stock into the storefront and into finance numbers.

### F2. Expired coupon is reported as `success: true` (LOW)

- Steps: customer calls `POST /api/coupons` with an expired code and a valid cart.
- Expected: `success: false` for a rejected code, matching the error message, so clients can rely on `success`.
- Actual: `{"success":true,"isValid":false,"valid":false,"message":"این کد تخفیف منقضی شده است.","discountAmount":0,...}`. The `valid` and `isValid` flags are correct, but `success` says the call worked. A client that checks only `success` would treat the code as applied.
- Note: the usage-limit rejection (`ظرفیت استفاده ... به اتمام رسیده است`) has the same shape.
- Suspected file: `src/app/api/coupons/route.ts`, the validate branch of `POST`.

### F3. Demoted admin still receives the admin shell; APIs are refused at once (LOW)

- Steps: promote a customer to ADMIN, log in, then demote through `PATCH /api/admin/users { role: "USER" }`. Immediately call `GET /api/admin/dashboard` and `GET /admin`.
- Verified: the admin API returns 403 at once, and a write through `PATCH /api/admin/orders` is refused. `GET /admin` returns 200 with the admin HTML shell. The page's client-side guard then shows the denial text (`دسترسی منحصراً ... ADMIN ...`) and no dashboard data.
- Cause: `src/proxy.ts` checks the role claim inside the signed session cookie. `requireAdmin` checks the stored role. The cookie role stays `ADMIN` until the cookie expires, so the page shell is served to a demoted account.
- Expected: the page request is also refused (redirect to /login), like the APIs.
- Suspected files: `src/proxy.ts` (the `/admin` branch) and `src/lib/admin-auth.ts`. The guard in `src/app/admin/layout.tsx` (fetch `/api/auth/me`) works.

### F4. Expired coupon still has `isActive: true` in admin data (LOW, API evidence only)

- Evidence: coupon `SHIRAZ1403` has `expiresAt: "1404-06-31"` and `isActive: true`. Public validation correctly rejects it as expired. The admin list has no expired status label. The `/admin/coupons` page did not show this row in my text check, so the UI behaviour is not confirmed.
- Expected: the admin status reflects the expiry date (for example "منقضی"), or an expired code is shown as inactive.
- Suspected files: `src/app/admin/coupons/page.tsx` (status and toggle, around lines 116 to 148) and `src/app/api/admin/coupons/route.ts`.

### F5. React warning on /admin/cms: uncontrolled input becomes controlled (LOW)

- Evidence: console error on `/admin/cms`: "A component is changing an uncontrolled input to be controlled ...". The page loads and the CMS round trip works.
- Suspected file: `src/app/admin/cms/page.tsx`, the inputs bound to `content.topBannerText`, `content.heroBadgeText` and similar (around lines 411 to 452). The value is `undefined` on the first render, so the input starts uncontrolled. Give these inputs a default string.

### F6. Seed subscription order shows `???` as customer name and `x` as street (LOW, data)

- Evidence: order `PRF-1405-MWLV66FZ-767096` (subscription, `isSubscription: true`) has `address.recipientName: "???"` and `address.streetAddress: "x"`. The admin dashboard, orders list and manifest show these values as they are.
- Cause not confirmed in code. It looks like seed or test data in the disposable copy, not a logic path. Check the seed before treating it as a bug.

### Observations (not failures)

- O1. The UI negative-price attempt (price `-7` in the edit modal) sent no request. A Persian message element matched, but I did not capture its text. The stored price stayed unchanged. Re-check the message text by eye.
- O2. The manifest day card for the slot date was not found in the capacity panel, so the UI day filter was not exercised. The same filter (`status=DELIVERABLE&date=`) was checked through the API: order 1 (delivered) and the manual COD order are listed, the cancelled order is not.

## Worked well

- Admin login through the real `/login` form (password tab). Dashboard numbers render (revenue, orders by status) with no NaN or visit counters. The admin API returns numeric values.
- Products: create in the admin modal (201, visible in the admin list), price edit in the modal (storefront product page and guest quote show 160,000, not 150,000). Hiding removes the product from the storefront list and the detail page returns 404. Negative price and negative stock on create and on PATCH are rejected with Persian messages.
- Coupons: 10% coupon with usage limit 2 applies to a customer cart (`valid: true`, discount computed, order created with the discount). The expired coupon is rejected for a new customer. At the usage limit (2 of 2) a new customer is refused. After an admin cancel the count drops back and the coupon works again.
- Orders: the status dropdown offers only the current and allowed next statuses (PENDING_PAYMENT is not offered after payment). The in-app confirmation appears for OUT_FOR_DELIVERY, DELIVERED and CANCELLED. Stock and coupon use are restored on cancel. The customer account (orders tab) and the customer API show each status.
- Mock gateway: payment through `/checkout/mock-gateway` ("پرداخت موفق") moves the order to PROCESSING with payment SUCCESS and redirects to `/checkout/success`.
- Manual COD order from the admin API: PENDING_PAYMENT, source ADMIN_MANUAL, and it appears in the admin list and the manifest.
- Manifest CSV: UTF-8 BOM, readable Persian, quoted names with escaped double quotes (`""دستی""`).
- Capacity: a day 14 days ahead is closed (`isClosed: true` for customers), a booking into it is refused with a Persian message, capacity is changed and restored, the day is reopened (`isClosed: false`). Nothing was closed within 7 days.
- Finance (day report for today): the paid order is included, the cancelled order is excluded, and the unpaid COD order is excluded. `netRevenue` equals the sum of `netPayableAmount` over the records (4,700,500 in the last run). The CSV has a BOM and Persian headers.
- CMS: the home-page text changes, the public site-content API and the storefront show it, and the original text is restored.
- Reviews: a customer review for a delivered order is accepted (201, pending), the admin approves it with a reply, and the product page shows the review and the official reply in the reviews tab.
- Returns: request for the delivered order, admin approval, refund at or below the paid amount (REFUNDED), and an over-limit refund (paid + 1,000) is rejected.
- Users: a new customer is promoted, logs in with a password, opens /admin and calls admin APIs. After demotion the admin API returns 403 at once. Self-demotion of the main admin is refused (400).
- SMS: without `confirm: true` the broadcast is refused (400). The PRO segment (5 recipients) got a MOCK broadcast with sent 5, failed 0. The provider is MOCK.
- Bulk inquiries: a guest inquiry appears in the admin list and the status changes to REVIEWED and COMPLETED.
- Admin pages (/admin, /products, /orders, /manifest, /coupons, /cms, /finance, /payment, /returns, /reviews, /sms, /subscriptions, /users, /bulk): all return 200 with no error boundary and no console errors, except F5 on /admin/cms.
- Mobile 375px: no horizontal overflow on /admin or /admin/orders.
- Legacy `updateUserRole` (in `POST /api/admin`) has the same guards as the new users route: no self-demotion and no removal of the last admin.

## Coverage notes

- UI-driven: admin login, product create and edit (modal), order status changes (dropdown and confirm), manifest CSV export, finance CSV export, bulk inquiry list, every admin page load and console check, the 375px overflow checks, and the customer mock payment page.
- API-driven, with the UI page checked afterwards: coupon create, manual COD order, return approval and refund, review approval and reply, user promotion and demotion, CMS save, SMS broadcast, capacity and day closure, hide product.
- Not exercised in the UI: the coupon create modal, the manual-order modal, the returns and reviews approval buttons, the SMS composer and its confirm dialog, the capacity panel day cards (F-O2), and cart or checkout coupon entry (the cart page renders, but the coupon was applied through the API).

## Data left behind (dev copy)

- Products: seven `P6 Test Honey …` products from the runs, all hidden. Nothing deleted.
- Coupons: 14 `P6-VALID-…` and `P6-OLD-…` codes, all deactivated at the end of the session.
- Orders: a few paid and cancelled test orders for this run's customers. Unpaid ones expire on their own.
- Reviews: one approved review with an admin reply on `organic-eggs-kamfiruz-30` (visible to storefront visitors on this dev copy).
- Accounts: test customers with `0912600xxxx` numbers. One was promoted to ADMIN and then demoted back to USER.
- SMS: several MOCK broadcasts to the PRO segment (5 recipients each run, no real SMS).
- CMS: the home-page badge text is restored to its original value.
