# P1 New Visitor - Customer Simulation Report

**Persona:** first-time desktop visitor, 1280px, Persian locale, guest.
**Journey:** home -> header search (Persian and Arabic letter variants) -> category -> product -> add 2 to cart -> cart -> guest checkout (redirect to login) -> register via OTP with name -> address in Shiraz, postal code -> FREE-user slot -> mock gateway pay -> success page -> account order -> review attempt -> logout.

**Spec:** `e2e/p1-new-visitor.spec.ts` (one serial test, 13 steps).
**Last run (run 11):** all 13 steps completed. 97 checks passed, 1 failed (minor). The test is marked failed only because of the minor finding below.
**Findings JSON:** `e2e/test-results/p1/findings.json`.
**Run output:** `C:\Users\nekba\AppData\Local\Temp\claude\8d9cb21cbe87527b\803ef807-3c28-48e5-afd7-de734adaedd9\scratchpad\p1-run11.log`.

## Findings

### P1-01 (minor): order number on the success page uses Persian digits

- **Steps:** complete a mock-gateway payment, land on `/checkout/success`.
- **Expected:** the order number is shown the same way as on the account page and in the gateway URL, `PRF-1405-XXXXXXXX-XXXXXX` with Latin digits.
- **Actual:** the invoice card renders it as `PRF-۱۴۰۵-MWM۴۶HNC-۸۰۶۷۰۰` (Persian digits). It also wraps across two lines in its box. The account page and the success URL use Latin digits. A customer who copies the number into order tracking could hit a mismatch. Not tested: whether the tracking lookup accepts Persian digits.
- **Evidence:** `C:\Users\nekba\Desktop\Gemini profarm\e2e\test-results\p1\shots\P1-01.png` (this folder is overwritten on each run).
- **Suspected file:** `src/app/checkout/success/page.tsx` (order number passed through a Persian-digit formatter).

### P1-02 (info, UX): slot time label has nested parentheses

- **Actual:** the success page shows `بازه تحویل: یکشنبه ۱۴۰۵/۰۹/۰۱ (۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب))`, with nested brackets and an awkward wrap. Seen in the same screenshot as P1-01.
- **Suspected file:** the slot `timeWindow` label, most likely `src/lib/jalali.ts` or `src/components/modules/DeliverySlotPicker.tsx`.

### Expected console noise (not a defect)

- Every guest page logs "Failed to load resource: 401" from `/api/auth/me` (12 in the run). The spec excludes these from HTTP failures. No other console errors, page errors, 4xx/5xx responses or failed requests occurred.

## Verified behaviour (passes)

- **Home:** title set, `dir="rtl"`, no horizontal overflow at 1280px, no broken images, prices in Persian digits.
- **Search:** `تخم`, `عسل`, `تخم مرغ` (space, no ZWNJ), `زيتون` with Arabic yeh and `كنار` with Arabic kaf all return results that match the product titles.
- **Catalog and product:** category control works. Product page shows the server price in Persian format (`۱۸۵,۰۰۰ تومان`), has a gallery image and a specs section.
- **Cart:** add-to-cart toast shows. Cart line total for qty 2 is correct (370,000). Qty 3 and back to 2 update the total.
- **Guest checkout:** cart survives to checkout. Submit redirects to `/login?redirect=...`.
- **Registration:** OTP send returns a 5-digit code (mock SMS). Verify creates the account with the entered name. `/api/auth/me` returns the name, FREE tier.
- **Checkout:** postal code, province, city and address fields accept input. A Sunday slot is selected for a FREE user. Order POST returns 200.
- **Money:** items 370,000 + shipping 49,000 = 419,000. The amount on the gateway matches the amount shown on checkout before paying.
- **Gateway and redirect:** the order number on the gateway page matches the success-redirect `orderNumber`.
- **Account:** shows the order with Persian date, total 419,000 and status "در حال آماده‌سازی در مزرعه" (PROCESSING).
- **Review:** the form opens for a signed-in buyer. Submit returns 403 from `/api/reviews` (refused before delivery).
- **Logout:** `/api/auth/me` returns 401 afterwards. The cart is empty after the completed order.

## Harness issues (fixed in the spec, not app bugs)

- The OTP form auto-submits when the 5th digit is entered, so the verify button is gone by the time the spec clicks it. The spec now listens for the response first.
- The app redirects to the gateway right after the order POST, so the response body cannot be read. The spec now takes the order number from the gateway page and the success URL.
- Clicks that trigger a navigation hung until timeout. Fixed with `noWaitAfter` and separate response waits.
- `e2e/test-results` is shared with other testers' runs, and their cleanup deleted this run's output. The spec now recreates its output directory and writes `findings.json` after every step.
- The dev server reads `X-Real-IP` (per the coordinator). The spec uses it.

## Worked well

- Search handles ZWNJ-less and Arabic-letter queries.
- Persian digits and comma separators are consistent across product, cart and checkout.
- Totals match from cart to checkout to gateway to account.
- The OTP flow works end to end with a clear message.
- Review submission is blocked server-side before delivery.
- Logout clears the session.

## Not verified

- Order tracking with Persian-digit numbers.
- Admin status changes (DELIVERED), so the review step only covers the "not yet delivered" branch.
- Mobile layout (desktop only).
- Coupons and the Snapp Pay path.
