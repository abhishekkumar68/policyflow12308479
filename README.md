# PolicyFlow — Fault-Tolerant Insurance Issuance & Reconciliation Engine

> **Trippers Shield — Practical Software Engineering Assessment**  
> **Candidate Implementation for Laravel Software Developer Intern**

PolicyFlow is an internal operations dashboard and fault-tolerant insurance intake engine designed for travel insurance distributors. It ingests policy purchase requests from agents, validates and prices them using deterministic actuarial rules, orchestrates issuance with an upstream mock insurer, and handles failure modes—such as timeouts, duplicate submissions, and repeated callbacks—without duplicate policy issuance.

---

## 1. System Architecture

PolicyFlow follows a clean, single-responsibility architecture:

```
[ Agent / Browser UI ]
          │
          ▼
 [ REST API Endpoints ] (/api/policy-requests)
          │
          ├─► [ Form Request Validation ] (CreatePolicyRequest)
          │
          ├─► [ Actuarial Engine ] (PremiumCalculationService - bcmath safe)
          │
          ├─► [ Issuance Orchestrator ] (IssuanceService)
          │             │
          │             ├─► [ Local Mock Insurer ] (MockInsurerService)
          │             │
          │             └─► [ Audit Log ] (PolicyStateHistory)
          │
          ▼
   [ Relational Database ] (Unique Constraints: agent_id + client_request_id)
```

### Core Design Principles:
1. **Explainability First:** Clean, modern Laravel code free of heavy third-party state machines, microservices, or complex event-sourcing patterns.
2. **Database-Level Idempotency:** Uniqueness constraints enforced at both the database level (`unique(['agent_id', 'client_request_id'])`) and within transaction exception handlers.
3. **Two-Phase Idempotent Reconciliation:** A network timeout or HTTP 504 from an insurer never triggers a blind reissue. The request transitions into `PENDING_CONFIRMATION` or `NEEDS_RECONCILIATION`, allowing safe status queries to recover existing policies.
4. **Immutable Premium Snapshot:** Calculated once during intake and saved immutably. Never silently recalculated on retries or updates.

---

## 2. Technology Stack

- **Backend:** PHP 8.2+, Laravel 12 (or 11+ compatible), Eloquent ORM
- **Database:** SQLite (default for instant zero-dependency local runs) or MySQL 8+ / MariaDB 10.4+
- **Frontend:** React 19, React Router v7, Tailwind CSS v4, Lucide Icons, Axios, Vite
- **Testing:** PHPUnit 11 (39 automated tests, 129 assertions, 100% passing)

---

## 3. Database Schema & Entities

The relational schema is created via Laravel migrations:

### 1. `policy_requests`
Main entity holding traveler details, trip parameters, and policy status.
- `id` (BIGINT, Primary Key)
- `client_request_id` (VARCHAR) & `agent_id` (VARCHAR) -> **UNIQUE composite key**
- `customer_name` (VARCHAR), `date_of_birth` (DATE)
- `destination` (ENUM: `DOMESTIC`, `INTERNATIONAL`)
- `trip_start` (DATE), `trip_end` (DATE), `travel_days` (INT)
- `plan_code` (ENUM: `BASIC`, `PLUS`, `PREMIUM`)
- `sum_insured` (DECIMAL 12, 2)
- `premium` (DECIMAL 10, 2, Immutable snapshot)
- `status` (ENUM: `RECEIVED`, `VALIDATED`, `SUBMITTED`, `PENDING_CONFIRMATION`, `ISSUED`, `FAILED`, `NEEDS_RECONCILIATION`)
- `policy_number` (VARCHAR, UNIQUE, nullable)
- `provider_reference` (VARCHAR, nullable)
- `issuance_attempts_count` (INT, default 0)
- `last_provider_response` (TEXT, nullable)
- `mock_scenario` (VARCHAR, nullable)
- `timestamps`

### 2. `issuance_attempts`
Tracks every interaction attempt with downstream carriers.
- `id`, `policy_request_id` (Foreign Key), `attempt_number`, `provider_reference`, `scenario`, `outcome` (`SUCCESS`, `FAILURE`, `TIMEOUT`, `PENDING`), `response_payload`, `error_message`, `timestamps`.

### 3. `provider_events`
Stores inbound webhook callbacks and guarantees callback idempotency.
- `id`, `policy_request_id` (Foreign Key), `provider_event_id` (**UNIQUE**), `event_type`, `payload`, `processed` (BOOLEAN), `timestamps`.

### 4. `policy_state_history`
Immutable audit log recording every lifecycle state transition.
- `id`, `policy_request_id` (Foreign Key), `from_state`, `to_state`, `reason`, `transitioned_at`.

---

## 4. Actuarial Premium Calculation Rules

The pricing logic is encapsulated in `App\Services\PremiumCalculationService` using BCMath decimal-safe arithmetic:

$$\text{premium} = \text{daily\_base\_rate} \times \text{inclusive\_travel\_days} \times \text{age\_multiplier} \times \text{destination\_multiplier} \times \text{coverage\_multiplier}$$

### Pricing Matrix
| Dimension | Value / Multiplier |
|---|---|
| **Base Rate / Day** | `BASIC` = ₹12.00, `PLUS` = ₹20.00, `PREMIUM` = ₹30.00 |
| **Age Bracket (Trip Start)** | 0–17: 1.10x; 18–60: 1.00x; 61–70: 1.50x; 71+: 2.00x |
| **Destination** | `DOMESTIC` = 1.00x; `INTERNATIONAL` = 1.80x |
| **Sum Insured** | ₹100,000 = 1.00x; ₹300,000 = 1.25x; ₹500,000 = 1.50x |
| **Travel Days** | $\text{trip\_end} - \text{trip\_start} + 1$ (Inclusive, minimum 1) |

### Verified Official Example:
- **Plan:** `PLUS` (₹20/day)
- **Trip:** 2026-11-10 to 2026-11-14 (5 days)
- **DOB:** 1998-04-10 (Age 28 on trip start $\rightarrow$ 1.00x)
- **Destination:** `INTERNATIONAL` (1.80x)
- **Sum Insured:** ₹300,000 (1.25x)
- **Calculation:** $20 \times 5 \times 1.00 \times 1.80 \times 1.25 = \mathbf{₹225.00}$ (Verified in test `test_assignment_example_premium`)

---

## 5. Reliability & Fault-Tolerance Scenarios

PolicyFlow specifically implements and verifies four critical reliability scenarios:

### Case A: Duplicate Intake Idempotency (Assignment Mandatory Case)
- **Problem:** Agents retry network calls or send near-simultaneous duplicate payloads with the same `(agent_id, client_request_id)`.
- **Handling:**
  1. PolicyFlow inspects existing records. If present, it safely returns **HTTP 200** with the original record.
  2. To eliminate concurrent race conditions, the database enforces a `UNIQUE(agent_id, client_request_id)` composite index.
  3. If a race occurs, the transaction catches the duplicate key exception and returns the already-created record.
  4. No duplicate policy can ever be created or billed.
  - **Automated Test:** `test_duplicate_intake_returns_existing_request`

### Case B: Timeout After Issue & Reconciliation (Assignment Mandatory Case)
- **Problem:** Insurer generates a policy certificate, but the HTTP connection drops or times out (504 Gateway Timeout). Blindly retrying would cause double issuance and duplicate debit.
- **Handling:**
  1. The client call marks the request as `PENDING_CONFIRMATION` with reason `"Provider timeout — outcome uncertain"`.
  2. The operator or background job triggers `POST /api/policy-requests/{id}/reconcile`.
  3. The reconciler queries the mock carrier's internal status store using the request ID.
  4. If the policy was created, it recovers the original certificate number and updates status to `ISSUED`.
  - **Automated Test:** `test_timeout_after_issue_reconciliation`

### Case C: Duplicate Callback Protection
- Inbound webhook events are validated against the `provider_events` table by unique `provider_event_id`.
- Repeated deliveries of the same event ID return **HTTP 200** and are marked `is_duplicate: true` without double-mutating state.
- If a policy is already `ISSUED`, callbacks cannot revert or overwrite the certificate number.
- **Automated Test:** `test_repeated_callback_cannot_overwrite_issued`, `test_duplicate_callback_processed_once`

### Case D: Retry After Temporary Failure
- When the carrier returns a transient 503 error, the state transitions to `FAILED` with retry eligibility flag `retriable: true`.
- Subsequent submission resumes issuance without modifying the locked quote premium.
- **Automated Test:** `test_temporary_failure_allows_retry`

---

## 6. API Reference

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/api/dashboard/stats` | Operational telemetry and summary statistics | 200 OK |
| `GET` | `/api/policy-requests` | List requests with pagination and status filters | 200 OK |
| `POST` | `/api/policy-requests` | Create request or safely return existing duplicate | 201 Created / 200 OK |
| `GET` | `/api/policy-requests/{id}` | Retrieve request details, history, and raw response | 200 OK / 404 |
| `POST` | `/api/policy-requests/{id}/submit` | Dispatch policy to carrier for binding | 200 OK / 422 |
| `POST` | `/api/policy-requests/{id}/reconcile` | Verify carrier binding status after timeout | 200 OK / 422 |
| `POST` | `/api/mock-insurer/callback` | Ingest asynchronous carrier webhook event | 200 OK |

*Detailed request and response JSON fixtures are provided in [`examples/api-examples.md`](examples/api-examples.md).*

---

## 7. Local Setup & Execution Instructions

### Prerequisites
- **PHP:** 8.2 or newer with `bcmath`, `pdo_sqlite` or `pdo_mysql` extensions enabled
- **Composer:** 2.x
- **Node.js:** 18+ or 22+ with `npm`

### Step 1: Clone and Install Dependencies
```bash
git clone <repo-url>
cd PolicyFlow

# Install PHP dependencies
composer install

# Install Frontend dependencies
npm install --legacy-peer-deps
```

### Step 2: Environment Configuration
```bash
# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate
```

### Step 3: Run Database Migrations and Seed Sample Data
By default, PolicyFlow uses SQLite for immediate zero-config execution:
```bash
# Run migrations
php artisan migrate

# Seed rich fictional data matching the Stitch design
php artisan db:seed
```

*(Optional: To use MySQL / MariaDB instead, update `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_DATABASE=policyflow` in `.env` and run `php artisan migrate --seed`)*.

### Step 4: Build Frontend Assets
```bash
npm run build
```

### Step 5: Start the Application Server
```bash
php artisan serve
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser to explore the Operations Portal.

---

## 8. Running Automated Tests

Run the full PHPUnit test suite with:
```bash
php artisan test
```

### Verified Test Results:
```text
   PASS  Tests\Unit\ExampleTest
  ✓ that true is true

   PASS  Tests\Unit\PremiumCalculationTest
  ✓ assignment example premium
  ✓ basic domestic minimum
  ✓ premium maximum multipliers
  ✓ age boundary 17
  ✓ age boundary 18
  ✓ age boundary 60
  ✓ age boundary 61
  ✓ age boundary 70
  ✓ age boundary 71
  ✓ same day trip is one day
  ✓ five day trip
  ✓ all plan codes
  ✓ international destination
  ✓ all coverage multipliers
  ✓ unsupported plan code rejected
  ✓ unsupported destination rejected
  ✓ unsupported sum insured rejected

   PASS  Tests\Feature\ExampleTest
  ✓ the application returns a successful response

   PASS  Tests\Feature\FrontendTest
  ✓ spa entry point returns ok
  ✓ deep links return spa

   PASS  Tests\Feature\PolicyRequestApiTest
  ✓ valid intake creates request with correct premium
  ✓ invalid trip dates rejected
  ✓ unsupported plan rejected
  ✓ unsupported destination rejected
  ✓ unsupported sum insured rejected
  ✓ missing required fields rejected
  ✓ duplicate intake returns existing request
  ✓ different agent creates new request
  ✓ successful issuance assigns policy number
  ✓ timeout after issue reconciliation
  ✓ repeated callback cannot overwrite issued
  ✓ duplicate callback processed once
  ✓ issued policy cannot be resubmitted to submitted
  ✓ policy listing with filters
  ✓ pagination
  ✓ show returns details with history
  ✓ temporary failure allows retry
  ✓ dashboard stats

  Tests:    39 passed (129 assertions)
  Duration: 1.25s
```

---

## 9. Assumptions and Known Limitations

1. **Local Deterministic Insurer:** The mock insurer stores issued policies in the application cache to simulate the carrier database. In a real multi-datacenter insurer environment, reconciliation queries would target an external partner SOAP/REST API.
2. **Synchronous Execution:** Redis and background queue workers were intentionally avoided to keep the application easy to inspect, run, and explain without Docker or daemon dependencies.
3. **Authentication:** Per assignment instructions, no user authentication system is enforced. An operations specialist context (`Neha Sharma (AGT-4092)`) is represented for UI fidelity.
