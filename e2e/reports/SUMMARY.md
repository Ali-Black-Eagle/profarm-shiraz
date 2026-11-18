# Full audit: summary

**Branch:** `fix/full-audit`, 20 commits on top of `da5301a`, nothing pushed.

## Final state
| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | passes, no warnings |
| Logic test (pricing, coupons, slots, transitions, subscriptions, returns) | 152 / 152 |
| Playwright e2e (6 customer/admin personas, `npx playwright test`) | 140 passed, 3 skipped, 0 failed |
| Horizontal overflow at 320/375/768/1280 px | 56 / 56 |
| API smoke tests (public + customer, admin) | 60 / 60, 154 / 154 |
| Real `.data/profarm_store.json` | unchanged; all tests ran on copies |

The 3 skipped tests need the clock moved forward (subscription expiry, the rolling 30-day egg quota) or more egg stock than the test data has.

## What was fixed (by phase)
1. **Critical security**
   - OTP account takeover through an attacker-chosen email.
   - The `mockSuccess` payment bypass, replaced by a dev-only HMAC-signed mock gateway.
   - The hard-coded admin password.
   - Unverified phone pre-claim, and order and profile data leaks.
   - Every admin API now re-checks the role stored on the account.
   - Secrets are masked and outbound hosts allowlisted.
   - Raw errors are no longer returned, and requests with no origin are refused (CSRF).
2. **Data layer**
   - Users no longer split into copies after a restart, and every collection is saved, with atomic writes.
   - The Postgres mirror runs one sync at a time and only adds records missing from the JSON file.
3. **Business logic**
   - One server pricing function (`quoteCart`) used for both the quote and the charge.
   - Coupons: expiry, limits and per-user limits, counted only on payment and given back on cancel.
   - Order status rules, with stock, slot and coupon released on cancel.
   - Delivery slots in Tehran time, with server-side capacity and closed days.
   - Subscription expiry and renewal.
   - Egg quota counted per account.
   - Payment verify is idempotent and handles late payments safely.
4. **Server APIs** replacing browser localStorage, for the catalog, CMS, slots, addresses, reviews, returns, retry payment, and every admin resource including finance and the dashboard.
5. **Storefront and admin** now read and write only through the server, and `db-store` is `server-only`.
   - SEO: canonicals, metadata, robots, icons, one product JSON-LD, real 404s.
   - Accessibility: labels, 44px touch targets, aria attributes, dialogs.
6. **Customer simulation fixes**
   - OTP-only users can now set a first password.
   - The Shiraz checkout notice matches the server.
   - Bulk inquiry validation.
   - The legacy admin `updateProduct` action is validated.
   - Order numbers show in Latin digits.
   - Egg detection no longer matches "veggie".
   - Delivery days per the owner's decision.
7. **Final security review**
   - Client IP comes only from nginx's `X-Real-IP`.
   - Registration and login have rate limits and input-length caps.
   - Order emails are HTML-escaped and sent only to verified addresses.
   - Gateway calls time out.
   - A session version invalidates admin and `/me` sessions after a password change.

## Owner decisions applied
- **Delivery:**
  - FREE customers: Sunday and Wednesday.
  - PLUS and PRO: Saturday to Thursday.
  - Friday: closed for everyone.
- **Shipping:** PLUS pays the full fee and PRO gets 20% off, as configured. `ARCHITECTURE.md` was updated to match.

## Before going to production
- **Admin password:** change `ADMIN_PASSWORD` in `.env` and the password in `admin userpass.txt`. It is still the old hard-coded value, which is now rejected in production.
- **Behind nginx:** set `TRUST_PROXY_HEADERS=1` and use the updated `deploy/nginx.conf`. Behind a CDN, also set `TRUSTED_CDN` and configure nginx's real-IP module.
- **Leave these unset:** `PAYMENT_MOCK_GATEWAY` and `SMS_PROVIDER=MOCK`. Both are refused outside development anyway.
- **Stored free-tier text:** `freeTierDeliveryDaysText` reads «شنبه، دوشنبه و چهارشنبه». Correct it to «یکشنبه و چهارشنبه» in /admin/subscriptions.

## Still open
- ~~**zod:** below 4.6.6, high advisory.~~ Resolved: upgraded to 4.6.7 (merged from `chore/zod-v4`); `npm audit` reports 0 vulnerabilities and the full suite still passes.
- ~~**Unverified email claim.**~~ Resolved: emails are reserved only after a 6-digit code is entered (profile change and email sign-up). Codes are never logged or stored in plain text.
- ~~**Session version coverage.**~~ Resolved: every customer route goes through `requireUser`/`getOptionalUser`, so a password change logs out old sessions everywhere.
- **CSP:** production no longer allows `unsafe-eval`; `unsafe-inline` remains (Next.js needs it without nonces).
- ~~**COD stock hold.**~~ Resolved: unconfirmed cash-on-delivery orders are cancelled after `codConfirmationHours` (default 48), with at most 3 open per account and per phone.
- **OTP codes** are still 5 digits (attempts are capped).
- **Postgres mode:** run `npx prisma db push` once to add `isEmailVerified`, `pendingEmail` and `sessionVersion` to the `User` table.
- **Verification codes** live in memory: lost on restart and not shared across several server instances.
- **Untested here:**
  - Live ZarinPal/SnappPay, real SMS and SMTP.
  - The Postgres mirror running live.
  - The manifest's over-2,000-orders warning.
- **`scratch/`** (untracked, gitignored) holds old scripts that import the now server-only store. Delete it if unused.

Per-persona details: `p1-new-visitor.md` to `p6-admin.md` and `round1-results.md` in this folder.
