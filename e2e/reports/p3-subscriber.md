# p3-subscriber: PLUS and PRO membership journey

Spec: `e2e/p3-subscriber.spec.ts` (24 tests, one worker, dev server at http://localhost:3000).
Last full run: **14 passed, 3 failed, 8 skipped** (`e2e/test-results/p3`).

The three failures are business-rule findings, not spec errors. Skips are explained under "Not exercised" and "Blocked".

---

## Findings

### F1. PLUS members are promised 6 delivery days a week, but can only order on Sunday and Wednesday
- **Severity:** High (consumer-facing promise that the system does not keep)
- **Steps:** Sign in as a new customer, buy PLUS, open `/pro` and `/account` (subscription tab), read the PLUS plan. Open checkout as a PLUS member and read the slot picker. Call `GET /api/subscriptions`.
- **Expected:** PLUS delivery is Sunday and Wednesday only (brief and ARCHITECTURE.md §6.3). Configured `plusDeliveryDaysPerWeek` is 2, and no PLUS feature claims Saturday to Thursday.
- **Actual:** Configured `plusDeliveryDaysPerWeek` = 6. The PLUS feature list says "تحویل ۶ روز در هفته (شنبه تا پنج‌شنبه)". The account plan card says "تحویل ۶ روز در هفته". The checkout only enables Sunday and Wednesday for PLUS. The mismatch is visible to the customer.
- **Evidence:** test "9. PLUS delivery copy…" fails with `Expected 2, Received 6`.
- **Suspected files:** `src/lib/store-defaults.ts` (DEFAULT_SUBSCRIPTION_SETTINGS: `plusDeliveryDaysPerWeek`, `plusFeatures`); `src/lib/jalali.ts` (`isDayAllowedForUser`, the Sun/Wed rule); `src/app/account/page.tsx` ~line 803 (plan card).

### F2. PLUS shipping is not free on allowed days
- **Severity:** Medium (documented benefit not delivered)
- **Steps:** PLUS member, quote 1 egg pack for a Sunday slot.
- **Expected:** `shipping = 0` (brief and ARCHITECTURE.md §6.3: "ارسال رایگان در روزهای منتخب").
- **Actual:** `shipping = 49000`. The checkout summary shows "هزینه ارسال با پیک پروفارم: ۴۹,۰۰۰ تومان". PLUS copy does not mention shipping, so either the rule or the docs need fixing.
- **Evidence:** test "8. PLUS shipping is free…" fails with `Expected 0, Received 49000`.
- **Suspected file:** `src/lib/formatters.ts` `calculateCartDiscounts` (shipping discount only for PRO, `shipPct` set only in the PRO branch, ~lines 187–192 and 224).

### F3. Day buttons a PLUS member cannot pick are labelled "ویژه پلاس"
- **Severity:** Low (misleading label)
- **Steps:** PLUS member, open `/checkout` with one egg pack in the cart.
- **Expected:** Disabled days are not labelled as a PLUS perk.
- **Actual:** 8 disabled buttons (Saturday, Monday, Tuesday, Thursday, twice each) show "ویژه پلاس". The label reads as something PLUS gets, yet those days are closed to PLUS.
- **Evidence:** test "6b. Days a PLUS member cannot pick…" fails with `Expected 0, Received 8`.
- **Suspected file:** `src/components/modules/DeliverySlotPicker.tsx` ~line 212 (label shown when `!isAllowed`).

### F4. ARCHITECTURE.md says PRO shipping is free; the configuration and UI say 20%
- **Severity:** Low (documentation)
- **Expected (docs):** ARCHITECTURE.md §6.2 "ارسال کاملاً رایگان در تمام ۶ روز کاری".
- **Actual:** `proShippingDiscountPercent = 20`; the PRO feature list says "۲۰٪ تخفیف … هزینه ارسال". Shipping is 39,200 on 49,000 base. The spec asserts the configured 20%, which passes (test 13).
- **Suspected files:** `ARCHITECTURE.md` §6.2, `src/lib/store-defaults.ts`.

### F5. A current PRO member cannot renew from `/pro`
- **Severity:** Low (UX; renewal itself works)
- **Steps:** PRO member opens `/pro`.
- **Actual:** The PRO button reads "اشتراک پرو فعال است ✓" and is disabled. Renewal is only offered on `/account` ("تمدید اشتراک"). That path works: test "20. PRO renewal…" passes, with expiry moved forward 30 days from the previous expiry.
- **Suspected file:** `src/components/modules/ProMembershipClient.tsx` ~lines 338–345.

### F6 (unverified). Pending orders may not count toward the quota
- **Severity:** Unknown until re-run (possible High if confirmed)
- **Observed:** In an earlier run, the paid order (300 eggs) and two pending orders (240 eggs, then 60 eggs from two simultaneous contexts) all passed their own checks. The server reported `usedEggQuotaThisMonth = 600`. The next quote then reported 300 used, not 600. That run also had a worker restart between those steps, so the cause is unclear.
- **Needed:** Re-run tests 15 to 19 with egg stock available and check whether the 600 total holds.

---

## What worked

- OTP sign-in with the mock SMS code; the account is FREE and phone-verified.
- `/pro` shows the PLUS and PRO prices from `GET /api/subscriptions` (`۱۴۹,۰۰۰ تومان`, `۳۲۹,۰۰۰ تومان`).
- PLUS purchase through checkout and the mock gateway: the charged amount equals the plan price and the gateway amount parameter. The account shows PLUS in the header and "اعتبار تا" on `/account`, without re-login. Expiry is about 30 days out.
- PLUS slots: only Sunday and Wednesday are allowed; Friday is never offered.
- PLUS egg quota: 7 packs (210 eggs) give 200 eggs at 5%, the exact discount expected.
- Upgrade PLUS to PRO without re-login: `/api/auth/me` returns PRO and the header shows "پرو".
- PRO slots: Saturday to Thursday, Friday closed.
- PRO egg quota: 21 packs (630 eggs) give exactly 600 discounted eggs and the discount on those 600 only (370,000 toman).
- PRO shipping equals the configured 20%; the 5% other-product discount applies.
- Coupon `EGGS20` (a valid code) is rejected on a subscription quote and on a subscription order (400, no order created). No coupon field is shown on the subscription checkout.
- Renewal from `/account` extends the expiry from the previous expiry.

## Not exercised

- **Test 23 (expired plan reverts to FREE):** needs an expiry in the past. No API sets one without admin access or a clock change.
- **Test 24 (rolling 30-day window):** needs orders older than 30 days.

## Blocked

- **Egg stock:** the only egg SKU (`organic-eggs-kamfiruz-30`) fell from 41 to 6 units across the shared testers and our own runs. Order-level tests 15 to 17 (paid order, second order, two-context race) are skipped in the final run, and so is test 18 (no orders placed). Test 19 is skipped for the same reason.
- **Test 21 (EGGS20 control):** skipped, because the code is expired (`"این کد تخفیف منقضی شده است."`). The subscription rejection in test 22 still stands.

## Harness notes

- Playwright restarts the worker after a failed test. Each restart re-runs `beforeAll`: a new context and a new random phone. The spec therefore keeps its state in `e2e/test-results/p3-state-<runner pid>.json` and signs the same phone back in when the session is missing.
- Rate limits are per IP (OTP sends: 10 per 10 min). Each run uses its own pair `10.4.x.11` and `10.4.x.12`, passed as `X-Real-IP` per the coordinator's note.
- Test timeout is 180 s; dev routes compile on first hit.
- Nothing is committed.
