# Round 1 results: customer-simulation findings

Branch: fix/full-audit. Dev server: http://localhost:3000 (test data, SMS mock, mock gateway).

## Verification

- `npx tsc --noEmit`: exit 0.
- Logic test (`scratchpad/logic-test.ts`, run with `npx tsx --conditions react-server`): 152 passed, 0 failed. PLUS slots now Saturday to Thursday; FREE stays Sunday and Wednesday; Friday closed.
- Source-level slot probe (`getAvailableSlotsForUser` on a scratch copy): PLUS allowed days 0,1,2,3,4,6; FREE allowed days 0,3.
- Persona run (full, before the final spec fixes): 133 passed, 7 failed, 3 skipped.
- Re-runs after the spec and client fixes: p4 19 passed, 1 failed (C-05).

## Per-spec status

| Spec | Result | Notes |
|---|---|---|
| p1 new visitor | 1/1 pass | |
| p2 mobile returning | 13 pass, 1 fail | T2 (first password from account settings) still fails; see below |
| p3 subscriber | 20 pass, 2 fail, 3 skip | 5 and 6b fail; 21, 23, 24 skipped (expired coupon / past dates needed) |
| p4 bulk outside Shiraz | 19 pass, 1 fail after re-run | C-05 fails: slot 2026-11-22 has 0 places left after repeated test orders |
| p5 adversarial | 67/67 pass | |
| p6 admin | 16/16 pass | Playwright output was reset by the re-run, so per-assertion JSON is gone |

## Remaining failures

1. **p3 test 5 (PLUS Monday offered) and 6b (PLUS day labels).** The source path returns the new rule (see probe above). The running dev server still answers `/api/delivery-slots` for the PLUS session with the FREE pattern (Saturday, Monday, Tuesday, Thursday disabled and labelled). The route's server bundle was compiled before the edits, so the running server needs a restart before this can be confirmed. Not restarted, per instruction.
2. **p2 T2 (first password from account settings).** The error context still shows the old account copy, which points to the same stale-bundle problem for `/account` and `/api/auth/me` (`hasPassword`). Needs a restart and a re-run.
3. **p4 C-05.** Data, not logic: Sunday 2026-11-22 has 0 remaining places in the dev store after repeated test orders. Capacity was not changed.

## Items fixed in this round

- H1 legacy `updateProduct` now forwards to `PATCH /api/admin/products` (same zod whitelist, 400 on negative price or stock).
- H2 `/api/auth/me` returns `hasPassword`; account settings show the current-password field only when it is set; first password works without it.
- H3 PLUS and PRO deliver Saturday to Thursday; FREE Sunday and Wednesday; labels "ویژه اعضای پلاس و پرو"; PLUS pays full shipping; copy in footer, cart, account, /pro, admin users, ARCHITECTURE §6.2 and §6.3, and `freeTierDeliveryDaysText` corrected.
- M1 guard uses `isShirazAddress(city, province)`; checkout passes the province; the guard no longer points to a missing "خرید عمده" option.
- M2 sticky add-to-cart and quantity buttons are 44px.
- M3 bulk inquiries: trimmed, whitespace refused, phone validated, IP limit (20 per 15 min) alongside phone (5 per 15 min); Persian field messages with `role="alert"`; `noValidate`.
- F7 `BULK_MIN_*` removed from `.env.example`; thresholds are constants.
- F3 bulk copy: "حداقل ۱۰ بسته (از هر محصولی) یا مبلغ ۵ میلیون تومان".
- L1 coupon POST `success` equals validity; admin coupons show "منقضی شده".
- L2 CMS inputs default to ''.
- L3 quantities must be JSON integers (checked in `quoteCart`, used by quote, coupon and order).
- L4 order numbers shown Latin with copy button (success, account, invoice); lookups normalize Persian and Arabic digits; slot label "ساعت ۱۵ تا ۲۱".
- L5 PRO members see "تمدید اشتراک پرو" on /pro and can renew when the plan is full.
- L6 admin layout denied state links to /account (the layout already blocked children).
- DATA: egg product `organic-eggs-kamfiruz-30` restocked to 500. `veggie-box-marvdasht-5kg` also matched the egg rule (title contains تخم‌مرغ) and was restocked to 500.

## Not committed

`AGENTS.md` (pre-existing Next.js generated block) is left out of this commit. `e2e/test-results`, `admin userpass.txt` and `.env` are not committed.
