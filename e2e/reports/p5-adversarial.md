# P5 adversarial report: local dev build (http://localhost:3000)

Scope: localhost dev build only, test data only (phones 0912500XXXX). The real admin phone (09170000000) was never used, and no wrong password was sent for it. Bursts stayed small. Each test sent 1-20 requests, and the suite made about 200 requests in total. No src/ files were edited and no server was started or stopped.

Suite: `e2e/p5-adversarial.spec.ts`. Run: `npx playwright test e2e/p5-adversarial.spec.ts --reporter=list --output=e2e/test-results/p5 --workers=1`.

Result: **67 tests, 66 pass, 1 fails.** The failing test is finding F1 (Low). No High or Medium vulnerability was reproduced.

Dev-only note: `PAYMENT_MOCK_GATEWAY` is active on this host (the mock authority tests ran, not skipped). The dev config also trusts `X-Forwarded-For` (`TRUST_PROXY_HEADERS=1`). The functional tests used a random XFF per request, so the per-IP limits did not affect them. The brute-force and coupon tests used one fixed XFF per burst.

---

## Findings

### F1. Quantity type coercion accepts "2" and true (Low, failing test 1.3)

- **Reproduction:** `POST /api/orders/quote` with `items: [{productId: "organic-eggs-kamfiruz-30", quantity: "2"}]` (and `quantity: true`), plus `city: "شیراز"`, `province: "فارس"`.
- **Expected:** 400. Quantities must be JSON integers.
- **Actual:** HTTP 200, `ok: true` for both `"2"` and `true`. `quoteCart` calls `Number(raw.quantity)` and then checks `Number.isSafeInteger`, so the coercion runs before the check. The order route uses the same `quoteCart`, so `POST /api/orders` takes the same path. The order route itself was not exercised with these values.
- **Impact:** Low. The price is still server-side and the stock check still applies. This is a loose input contract, not a pricing bypass.
- **Suspected file:** `src/lib/pricing.ts`, `quoteCart`: `const qty = Number(raw.quantity);`. Fix: require `typeof raw.quantity === 'number'` before the integer check.

### F2. Unverified account email reserves the address for everyone (Low)

- **Reproduction:** Customer A sets `email` through `POST /api/auth/me` to an address nobody owns. No verification is sent (test 3.7). Then a new registration with that same address is refused (test 3.8, `POST /api/auth/register`).
- **Expected:** An email should not block other registrations until it is verified, or the claim should be limited.
- **Actual:** Any logged-in user can reserve any unused address immediately. Other people cannot register with it. Attacker-controlled squatting is possible.
- **Suspected files:** `src/lib/db-store.ts`, `updateUserProfile` (`nextEmail` is stored with `isEmailVerified = false` but still counts for uniqueness), and the uniqueness check in `registerUser` / `completePhoneRegistration`.

### F3. OTP-only accounts can set a password without currentPassword (Low, by design)

- **Reproduction:** An account created by OTP has no password. `POST /api/auth/me` with `password` and no `currentPassword` succeeds (test 3.9 sets the first password this way).
- **Expected/Actual:** This is intentional in `updateUserProfile`. Once a password exists, the current one is required (test 3.9 confirms 403 without it). The risk is that a hijacked session can set a password on a passwordless account. Noted for awareness, not as a defect.

### F4. Development configuration exposes codes and mock payment (Informational)

- The OTP send response includes `debugCode` when `NODE_ENV !== 'production'` and the SMS provider is `MOCK` (`src/lib/sms.ts`, `canExposeDebugOtp`). Tests use it for login.
- The mock gateway (`src/lib/mock-gateway.ts`) is gated on `NODE_ENV === 'development'` and `PAYMENT_MOCK_GATEWAY === '1'`. Verify these are not set in production or staging.
- `TRUST_PROXY_HEADERS=1` makes the per-IP limits trivially rotatable. The per-phone limits still hold (test 3.1). This is expected in dev; production must not set this flag behind an untrusted path.

### Not exercised (needs admin tester or a DELIVERED order)

- **Stored XSS in reviews:** Submitting a review requires a DELIVERED order, which the customer test flow cannot produce.
- **Stored XSS in bulk inquiries (9.2):** The payload is accepted (status 200, 201 or 400). The rendering on the admin page is not visible without admin credentials. Admin tester should confirm it is escaped.
- **Coupon above 100%** and **per-user coupon limit:** Coupon creation requires admin. Customers are refused (test 5.2), but the stored value and the per-user limit were not tested.
- **Partial check, 3.2 (fallbackEmail):** The response does not echo the body email and the send succeeds. The fact that the body value is never used for delivery was confirmed by reading `src/app/api/auth/otp/route.ts` (it calls `getUserByPhone(...).email` only), not by observing an email.

---

## Defended correctly (66 passing tests)

**Price tampering (1.1-1.10):** The server ignores client `unitPrice`, `total`, `totalAmount`, `price`, `discountAmount`, `isShiraz`, `isBulkOrder`. The order total equals the quote total (test 1.1). Quantities of -1, 0, 1.5, 1e9, 1001, "abc", null, "", "NaN" are refused (1.2). A nonexistent product is refused. A non-Shiraz city is refused even with `isShiraz:true`. A PRO-only day is refused for FREE. Past and malformed slot ids are refused. `ULTRA` and a coupon on a subscription are refused.

**IDOR (2.1-2.4):** User B gets 404 for A's order by number or id, and A's order is absent from B's list. Retry-payment on A's order gives 404. A return for A's order is refused. B cannot PATCH or DELETE A's address (404), and A's address is unchanged afterward.

**Auth (3.1-3.12):**
- OTP brute force: 3 guesses per code and 10 verify calls per phone per 15 minutes. A 429 appears within the burst. The real code is also refused after lockout.
- Register without phoneProof, with a forged proof, or with another phone's proof: all refused.
- Mass assignment on `/api/auth/me` (role, tier, subscriptionTier, isProMember, isPhoneVerified, isEmailVerified, phone, userId, proExpiresAt): ignored.
- Email takeover: B cannot set A's email (409).
- Password change requires currentPassword once a password exists.
- Tampered payload with `role: ADMIN` and `alg: none` tokens: rejected on `/api/admin` and `/api/auth/me`.
- Logout revokes the old cookie (401 afterward).

**Payment (4.1-4.7):**
- A forged MOCK authority with `Status=OK` does not pay the order. The order stays PENDING_PAYMENT.
- A tampered HMAC is refused.
- `mockSuccess=true` has no effect. The parameter is not read anywhere (`grep` confirmed).
- A's authority with B's order is refused (cross-order).
- A legitimate callback pays once. A replay redirects to success without changing the order.
- A cancelled order cannot be paid through the callback.
- Retry-payment on another owner's order is 404.

**Coupons (5.1-5.2):** Validation is rate-limited per IP (15 per 5 minutes). Coupon creation requires admin.

**CSRF (6.1-6.2):** Cross-site Origin, `Sec-Fetch-Site: cross-site`, and requests with no Origin, Referer or Fetch-Metadata are all refused with 403 on `/api/orders` and `/api/auth/me`.

**Admin surface (7, 7.1-7.3):** All 19 `/api/admin/*` route files return 401, 403 or 405 for GET, POST, PUT, PATCH and DELETE from a customer session. Anonymous admin API access is 401. `/admin` redirects to `/login` with no loop, and `/admin/login` redirects to `/login`. A customer on `/admin` is redirected to login.

**Information leaks (8.1-8.5):**
- Malformed requests return generic messages with no stack trace or `node_modules` paths.
- `/api/products` never includes `costPrice`.
- `/api/reviews` shows masked names only (no userId or phone).
- `/api/auth/me` has no `password` or `passwordHash` key and no scrypt hash.
- No `X-Powered-By`. `X-Content-Type-Options: nosniff` is present, and clickjacking protection (X-Frame-Options or CSP `frame-ancestors`) is present.

**XSS on customer pages (9.1):** A stored `<img onerror>` payload in an address and a name payload in the profile are not executed on `/account` or `/profile`. No dialog fired and no injected `<img>` appeared in the DOM.

**Credential files:** `admin userpass.txt` and `ProfarmAdmin.apk` exist in the project root but are git-ignored and untracked. Not read.

---

## Notes

- `e2e/test-results/p5-state.json` holds test session cookies and was deleted after the final run.
- The suite stores its shared state in that JSON file because Playwright restarts the worker after a failing test and drops in-memory state.
- Tests use Playwright's APIRequestContext, with a fresh context per call so the cookie jar is empty. Browser checks run in Chromium only for 9.1.
