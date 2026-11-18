# P4 report: restaurant buyer outside Shiraz (bulk and Shiraz rules)

- Persona: p4-bulk-outside-shiraz (restaurant buyer, Isfahan address, then Shiraz edge cases)
- Spec: `e2e/p4-bulk-outside-shiraz.spec.ts`
- Run: `npx playwright test e2e/p4-bulk-outside-shiraz.spec.ts --reporter=list --output=e2e/test-results/p4`
- Date: 2026-11-18, dev server at http://localhost:3000 (branch fix/full-audit)
- Result of the final run: 20 tests, 15 passed, 5 failed. The five failures are the findings below (F1, F2, F3, F4, F5). Nothing failed because of the harness.

## Summary of findings

| ID | Severity | Title |
|---|---|---|
| F1 | Medium | Shiraz hint is green for "شیراز" + province "تهران", while checkout is blocked |
| F2 | Medium | Valid Shiraz address spelled with Arabic ي gets the outside-Shiraz block card |
| F3 | Low | Bulk copy says "10 packages of ONE product"; the rule counts all products |
| F4 | Low | Whitespace-only bulk inquiry is accepted (HTTP 200) |
| F5 | Low | Empty /bulk form has no Persian validation (native browser bubbles only) |
| F6 | Medium | Bulk inquiry rate limit is keyed only by phone number (code finding, not exercised) |
| F7 | Low | BULK_MIN_* environment variables are never read |
| F8 | Low | Shiraz guard tells the customer to choose a "خرید عمده" option that checkout does not offer |
| F9 | Open | Shared test account lost its session once mid-suite (not reproduced) |
| F10 | Info | X-Forwarded-For is ignored in this dev setup, so rate-limit buckets are shared by all testers |

---

## F1: Shiraz hint shown for an address the server rejects

- **Severity:** Medium
- **Steps:** Log in. Add eggs and cheese (425,000 toman, 2 packages). On /checkout choose province "تهران" and type city "شیراز" (Persian ی). Wait for the quote.
- **Expected:** No green Shiraz hint. Checkout stays blocked with the outside-Shiraz message.
- **Actual:** The green card "نشانی در محدوده ارسال اختصاصی شیراز است" is visible together with the red error "خرده‌فروشی صرفاً مختص شهر شیراز است" and a disabled submit button. The two messages contradict each other. The server quote is `isShiraz: false, ok: false`.
- **Evidence:** Test C-06 (`'green Shiraz hint is shown although the server says the address is outside Shiraz'`, count 1, expected 0). Quote API returns `isShiraz: false` (Q-04 passes).
- **Suspected file:** `src/components/modules/ShirazGuardAlert.tsx` lines 27-28 decide "Shiraz" from the city string only and ignore the province. `src/app/checkout/page.tsx` lines 952-957 do not pass the province to the guard. The server rule is `isShirazAddress` in `src/lib/formatters.ts` lines 275-290.

## F2: Valid Shiraz address spelled with Arabic ي shows the block card

- **Severity:** Medium
- **Steps:** Province "فارس". City typed as "شيراز" with Arabic ي (U+064A). Two items.
- **Expected:** The address is Shiraz (the server accepts it) and no outside-Shiraz block is shown.
- **Actual:** The quote is correct: `isShiraz: true, ok: true`, courier fee charged (Q-05 and the UI amount both pass). The guard, however, shows the red card "امکان ثبت سفارش خرده‌فروشی خارج از شیراز وجود ندارد". The submit button stays enabled, so the customer sees a refusal for an order that goes through. This can make a Shiraz customer abandon the order.
- **Evidence:** Test C-07 (count of the outside-Shiraz text: 1, expected 0). Q-05 passes.
- **Impact not verified:** The order stores the city as typed (`address.city` = Arabic ي spelling). I did not check whether `/admin/manifest` groups by exact city text, so it may split these orders.
- **Suspected file:** `src/components/modules/ShirazGuardAlert.tsx` line 27-28 compares `city.trim()` with the Persian spelling and does not normalize. The server normalizes in `normalizePersianText` (`src/lib/formatters.ts` lines 263-272).

## F3: Bulk copy contradicts the bulk rule

- **Severity:** Low
- **Steps:** Open /bulk and read "حداقل تیراژ سفارش عمده". Quote 5 greens + 5 cheese (10 packages across two products) for an Isfahan address.
- **Expected:** Copy and rule agree. If the copy is right, a 5+5 mix is not bulk.
- **Actual:** The copy says "حداقل ۱۰ بسته از یک محصول" (minimum 10 packages of one product). The quote returns `isBulk: true, ok: true`, so the rule counts packages across all products.
- **Evidence:** Test Q-03 (copy shown in the failure: "حداقل تیراژ سفارش عمده: حداقل ۱۰ بسته از یک محصول").
- **Suspected file:** `src/lib/site-config.ts` line 38 (`bulkThresholdLabel`). It is shown on `src/components/modules/BulkInquiryForm.tsx` line 196 and in `src/app/cart/page.tsx` line 266. The rule is `isBulkOrder` in `src/lib/formatters.ts` lines 254-261.

## F4: Whitespace-only bulk inquiry is accepted

- **Severity:** Low
- **Steps:** /bulk. Fill name, city and message with spaces only and a valid phone. Submit.
- **Expected:** HTTP 400 with a Persian validation message.
- **Actual:** HTTP 200. The inquiry is stored with a blank name, city and message. The browser's `required` check passes on spaces too.
- **Evidence:** Test B-05 (`Expected: 400, Received: 200`). One blank inquiry now exists in the dev store.
- **Suspected file:** `src/app/api/bulk-inquiries/route.ts` line 39 checks the raw strings (`!name || !city || !message`) before the `.trim()` calls further down.

## F5: Empty /bulk form has no Persian validation

- **Severity:** Low
- **Steps:** /bulk. Submit with every field empty.
- **Expected:** Persian validation messages (for example "لطفاً نام و نام خانوادگی..." ).
- **Actual:** No request is sent (correct), but the only feedback is the browser's native `required` bubble, in the browser's language. The server's Persian message "لطفاً تمام فیلدهای الزامی را تکمیل نمایید." is never shown in the UI.
- **Evidence:** B-03 passes (no request sent). B-04 fails (no `role="alert"` with "لطفاً").
- **Suspected file:** `src/components/modules/BulkInquiryForm.tsx` lines 95, 112, 144, 159 (`required` attributes, no custom validation).

## F6: Bulk inquiry rate limit is keyed only by phone number

- **Severity:** Medium (code finding, not exercised)
- **Observed:** The per-phone limit works. Six submits give five successes and then a 429 with a Persian message (B-06), and the UI shows the message and keeps the form (B-07).
- **Concern:** The key is `inquiry:${cleanPhone || ip}` with 5 per 900 seconds. There is no per-IP limit. A client can rotate phone numbers and send unlimited inquiries to the wholesale desk. I did not test the bypass, to avoid flooding the dev store.
- **Suspected file:** `src/app/api/bulk-inquiries/route.ts` line 56.

## F7: BULK_MIN_* environment variables are never read

- **Severity:** Low
- **Detail:** `.env.example` lines 80-81 and the local `.env` define `BULK_MIN_TOTAL_PRICE` and `BULK_MIN_ITEM_COUNT`. No code reads them. The thresholds are hard-coded in `src/lib/formatters.ts` lines 248-249 and as defaults in `ShirazGuardAlert` (`minBulkQuantity = 10`, `minBulkPrice = 5000000`). Changing the environment variables has no effect.
- **Evidence:** `grep` for both names in `src` finds nothing outside `.env.example`.

## F8: Guard refers to a "خرید عمده" option that does not exist

- **Severity:** Low
- **Detail:** The guard card says "انتخاب گزینه «خرید عمده» و ثبت حداقل ۱۰ بسته محصول" (`ShirazGuardAlert.tsx` line 91). Its only button, which would enable bulk mode, renders only when `onEnableBulkMode` is passed. Checkout does not pass it (`src/app/checkout/page.tsx` lines 952-957). The only actionable link is to /bulk. The instruction points at a control that is not there.
- **Evidence:** Code reading; the guard's bulk-mode button never renders on checkout.

## F9: Shared account session returned 401 mid-suite (open)

- **Severity:** Open, not reproduced
- **Observed:** In run 4, `/api/auth/me` returned 401 for the suite's account between C-03 (where `POST /api/orders` still returned the expected 400, so the session was valid) and C-05.
- **Checked:** An API-level probe (OTP login, then three page loads and `/api/auth/me`) kept the session valid. Logout is only called from user-menu buttons, not by the test. I did not find the cause. The dev server had been up since 09:28, before my runs.
- **Harness response:** Each checkout test now calls `ensureLoggedIn`, which registers a new account if the session is gone and adds a `session-lost` annotation. The list reporter does not print annotations, so I could not confirm whether it fired in the final run.

## F10: X-Forwarded-For is ignored in this environment (information)

- **Detail:** `getSecureClientIp` reads forwarded headers only when `TRUST_PROXY_HEADERS=1` (`src/lib/formatters.ts` lines 297-303). The local `.env` does not set it. The brief assumed the dev server trusts `X-Forwarded-For`; it does not. The spec still sends a unique header, which has no effect. All local testers therefore share one IP bucket for OTP sends (10 per 10 minutes) and for quotes (60 per 5 minutes).

---

## Test-harness notes (not application bugs)

- Next's route announcer also has `role="alert"`, so alert selectors exclude `#__next-route-announcer__`.
- The add-to-cart label changes with quantity ("افزودن به سبد خرید" for one, "افزودن ۱۰ عدد به سبد خرید" for more).
- Clearing the cart needs a reload afterwards. Otherwise the app writes its in-memory cart back over the removal.

## Side effects in the dev data

- One successful order of 10 greens to Isfahan (850,000 toman, shipping 0, status PROCESSING). Greens stock went from 60 to 50.
- Honey (9), eggs+cheese (Shiraz retail) and the other cancelled checkouts were cancelled through the mock gateway.
- Each run creates one new customer account through the OTP flow.
- Each full run adds about 12 bulk inquiries (B-01: 1, B-05: 1 blank, B-06 and B-07: 5 each). Across the five runs so far that is roughly 60 test inquiries, five of them blank.
- Accidental: early in the session I ran `pkill -f "playwright test"` to stop a stale run. That pattern matches every Playwright process on this machine, so it may also have stopped another tester's run. I did not check.

## Worked well

- Outside-Shiraz retail is refused by the server (POST /api/orders returns 400 and no order is created) (C-03).
- Bulk thresholds are exact at the boundaries: 8 honey (4,960,000 toman, 8 packages) is refused; 9 honey (5,580,000 toman) is bulk. 9 greens is not bulk; 10 is (Q-01, Q-02).
- Outside-Shiraz bulk orders carry shipping 0, and the payable amount on checkout, the quote API, the mock gateway and the account total are all equal (C-04, C-05).
- Cancelling the payment keeps the cart and cancels the order (C-05, C-08).
- Shiraz retail shows the courier fee, and the amount charged matches the quote (C-08).
- The server accepts Arabic ي in "شيراز" and rejects "شیراز" with Tehran as province (Q-04, Q-05).
- OTP account creation works with the mock SMS and returns the code in JSON (C-01).
- /bulk shows the success message, the Persian invalid-phone message and the Persian rate-limit message, and keeps the form on a 429 (B-01, B-02, B-06, B-07).
