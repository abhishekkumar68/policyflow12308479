# AI Usage Disclosure — PolicyFlow

**Candidate Assignment:** Trippers Shield Software Developer Intern  
**Project:** PolicyFlow (Fault-Tolerant Insurance Issuance & Reconciliation Engine)  
**Date:** October 2026  

---

## 1. Tools Used
- **Google Antigravity (Advanced Agentic Pair-Programming Assistant)**: Used for scaffolding project structure, designing React UI components based on Stitch reference screenshots, implementing API controllers, and writing test suites.
- **Claude & Gemini Models (DeepMind / Anthropic)**: Used for automated code generation, refactoring, and verifying business logic.

---

## 2. Concrete Ways AI Assisted

1. **Deterministic Actuarial Calculation & Multiplier Matrix:**
   - AI helped write and unit-test the `PremiumCalculationService` ensuring exact compliance with the formula:
     $$\text{premium} = \text{base\_daily\_rate} \times \text{travel\_days} \times \text{age\_multiplier} \times \text{destination\_multiplier} \times \text{coverage\_multiplier}$$
   - Formulated 17 independent unit tests covering inclusive day math, boundary ages (17, 18, 60, 61, 70, 71), all plans, and verified the assignment example ($20 \times 5 \times 1.00 \times 1.80 \times 1.25 = ₹225.00$).

2. **Idempotency & Concurrent Duplicate Handling:**
   - AI helped structure the composite unique key `(agent_id, client_request_id)` at the database migration level and wrap intake within transaction-safe exception handling so concurrent duplicate submissions safely return HTTP 200 without creating secondary records.

3. **Stitch UI Pixel-Accurate Implementation:**
   - Assisted in generating the Navy/Teal React dashboard, life-cycle requests table, interactive quoting wizard with live reactive formula preview, and mock carrier controls matching the provided UI design.

---

## 3. Incomplete / Incorrect Suggestions Encountered & Resolved

1. **Vite React Plugin Compatibility Conflict:**
   - *Issue Encountered:* During frontend dependency installation, npm initially installed `@vitejs/plugin-react@^6.1.2`, which attempted to import Vite internal subpaths (`./internal`) expecting Vite 8. This caused the Vite 7 build to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
   - *Resolution:* Identified the peer-dependency mismatch, downgraded the plugin to `@vitejs/plugin-react@^4.3.4` (which natively supports Vite 7), and verified clean compilation via `npm run build`.

2. **BCMath Rounding Edge Case:**
   - *Issue Encountered:* Standard PHP floating point arithmetic (`(float) $rate * $days`) produces IEEE 754 precision artifacts (e.g. `224.9999999999`). Early AI snippets suggested basic `round()`.
   - *Resolution:* Replaced all floating-point math with `bcmul()` and `bcadd()` string arithmetic with scale 4, followed by clean decimal rounding to 2 decimal places to ensure monetary safety.

---

## 4. Verification and Testing Methodology

- **Automated PHPUnit Test Suite:**
  - Ran 39 automated tests with 129 assertions:
    - 17 unit tests for actuarial rules, boundary ages, and invalid payload rejection.
    - 18 feature tests for API intake, duplicate idempotency (Reliability Case A), timeout-after-issuance reconciliation (Reliability Case B), callback idempotency, and pagination.
    - 2 feature tests validating React SPA routing and deep links.
- **Manual Verification:**
  - Seeded sample data (`php artisan db:seed`) and verified dashboard stats, search filters, interactive live quoting calculations, and mock provider controls in the UI.
- **Code Readability Check:**
  - Kept services small and single-purpose (`PremiumCalculationService`, `IssuanceService`, `MockInsurerService`). No unneeded microservices, Redis, or heavy state machine libraries. The candidate can confidently explain every controller, model, and service in a live technical interview.
