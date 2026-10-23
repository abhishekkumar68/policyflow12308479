# PolicyFlow API Examples

## 1. Successful Policy Request Intake

```bash
curl -X POST http://localhost:8000/api/policy-requests \
  -H "Content-Type: application/json" \
  -d '{
    "client_request_id": "AGT-2026-0001",
    "agent_id": "AGENT-17",
    "customer_name": "Sample Customer",
    "date_of_birth": "1998-04-10",
    "destination": "INTERNATIONAL",
    "trip_start": "2027-11-10",
    "trip_end": "2027-11-14",
    "plan_code": "PLUS",
    "sum_insured": 300000,
    "mock_scenario": "SUCCESS"
  }'
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Policy request created successfully",
  "data": {
    "id": 1,
    "client_request_id": "AGT-2026-0001",
    "agent_id": "AGENT-17",
    "customer_name": "Sample Customer",
    "date_of_birth": "1998-04-10",
    "destination": "INTERNATIONAL",
    "trip_start": "2027-11-10",
    "trip_end": "2027-11-14",
    "plan_code": "PLUS",
    "sum_insured": "300000.00",
    "premium": "225.00",
    "travel_days": 5,
    "status": "RECEIVED",
    "policy_number": null,
    "provider_reference": null,
    "issuance_attempts_count": 0,
    "created_at": "2026-10-23T16:30:00.000000Z",
    "updated_at": "2026-10-23T16:30:00.000000Z"
  },
  "premium_breakdown": {
    "base_rate": "20",
    "travel_days": 5,
    "age": 29,
    "age_multiplier": "1.00",
    "destination_multiplier": "1.80",
    "coverage_multiplier": "1.25"
  }
}
```

---

## 2. Validation Failure

```bash
curl -X POST http://localhost:8000/api/policy-requests \
  -H "Content-Type: application/json" \
  -d '{
    "client_request_id": "AGT-2026-0002",
    "agent_id": "AGENT-17",
    "customer_name": "Bad Request",
    "date_of_birth": "1998-04-10",
    "destination": "EUROPE",
    "trip_start": "2027-11-14",
    "trip_end": "2027-11-10",
    "plan_code": "GOLD",
    "sum_insured": 200000
  }'
```

**Expected Response (422 Unprocessable Entity):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "destination": ["Destination must be DOMESTIC or INTERNATIONAL."],
    "trip_end": ["Trip end date must be on or after the trip start date."],
    "plan_code": ["Plan code must be BASIC, PLUS, or PREMIUM."],
    "sum_insured": ["Sum insured must be 100000, 300000, or 500000."]
  }
}
```

---

## 3. Duplicate Intake (Idempotent)

```bash
# Submit the exact same request again
curl -X POST http://localhost:8000/api/policy-requests \
  -H "Content-Type: application/json" \
  -d '{
    "client_request_id": "AGT-2026-0001",
    "agent_id": "AGENT-17",
    "customer_name": "Sample Customer",
    "date_of_birth": "1998-04-10",
    "destination": "INTERNATIONAL",
    "trip_start": "2027-11-10",
    "trip_end": "2027-11-14",
    "plan_code": "PLUS",
    "sum_insured": 300000
  }'
```

**Expected Response (200 OK — not 201):**
```json
{
  "success": true,
  "message": "Existing policy request returned (duplicate submission)",
  "data": {
    "id": 1,
    "client_request_id": "AGT-2026-0001",
    "premium": "225.00",
    "status": "RECEIVED"
  },
  "is_duplicate": true
}
```

---

## 4. Submit for Issuance (Success)

```bash
curl -X POST http://localhost:8000/api/policy-requests/1/submit \
  -H "Content-Type: application/json"
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Policy issued successfully",
  "data": {
    "id": 1,
    "status": "ISSUED",
    "policy_number": "POL-ABCDE12345",
    "provider_reference": "PROV-XYZ12345"
  },
  "issuance_result": {
    "success": true,
    "message": "Policy issued successfully",
    "policy_number": "POL-ABCDE12345",
    "provider_reference": "PROV-XYZ12345"
  }
}
```

---

## 5. Timeout Reconciliation Flow

### Step 1: Create request with TIMEOUT_AFTER_ISSUE scenario

```bash
curl -X POST http://localhost:8000/api/policy-requests \
  -H "Content-Type: application/json" \
  -d '{
    "client_request_id": "AGT-2026-TIMEOUT-01",
    "agent_id": "AGENT-17",
    "customer_name": "Timeout Test",
    "date_of_birth": "1990-05-15",
    "destination": "INTERNATIONAL",
    "trip_start": "2027-12-01",
    "trip_end": "2027-12-10",
    "plan_code": "PREMIUM",
    "sum_insured": 500000,
    "mock_scenario": "TIMEOUT_AFTER_ISSUE"
  }'
```

### Step 2: Submit — will timeout

```bash
curl -X POST http://localhost:8000/api/policy-requests/2/submit
```

**Response: status becomes PENDING_CONFIRMATION, no policy_number**

### Step 3: Reconcile — recovers the policy

```bash
curl -X POST http://localhost:8000/api/policy-requests/2/reconcile
```

**Response: status becomes ISSUED, policy_number is recovered**

---

## 6. List with Filters

```bash
# List all requests
curl http://localhost:8000/api/policy-requests

# Filter by status
curl http://localhost:8000/api/policy-requests?status=ISSUED

# Search by customer name
curl http://localhost:8000/api/policy-requests?search=Sample

# Pagination
curl http://localhost:8000/api/policy-requests?per_page=5&page=2
```

---

## 7. Mock Insurer Callback

```bash
curl -X POST http://localhost:8000/api/mock-insurer/callback \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "EVT-CALLBACK-001",
    "event_type": "policy_issued",
    "policy_request_id": 1,
    "policy_number": "POL-CALLBACK-12345",
    "provider_reference": "PROV-CB-001"
  }'
```

---

## 8. Get Policy Details

```bash
curl http://localhost:8000/api/policy-requests/1
```
