<?php

namespace Tests\Feature;

use App\Models\PolicyRequest;
use App\Models\ProviderEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for the PolicyFlow API.
 * Tests intake, validation, duplicate handling, issuance, and reliability scenarios.
 */
class PolicyRequestApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Valid request payload for reuse across tests.
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'client_request_id' => 'AGT-2026-0001',
            'agent_id' => 'AGENT-17',
            'customer_name' => 'Sample Customer',
            'date_of_birth' => '1998-04-10',
            'destination' => 'INTERNATIONAL',
            'trip_start' => '2027-11-10',
            'trip_end' => '2027-11-14',
            'plan_code' => 'PLUS',
            'sum_insured' => 300000,
        ], $overrides);
    }

    // =========================================================================
    // INTAKE TESTS
    // =========================================================================

    /**
     * Test 1: Valid intake creates a request with correct premium.
     * Assignment example: PLUS, 5 days, age 1.00, INTL 1.80, 300k 1.25 = ₹225.00
     */
    public function test_valid_intake_creates_request_with_correct_premium(): void
    {
        $response = $this->postJson('/api/policy-requests', $this->validPayload());

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'plan_code' => 'PLUS',
                    'destination' => 'INTERNATIONAL',
                    'premium' => '225.00',
                    'travel_days' => 5,
                    'status' => 'RECEIVED',
                ],
            ]);

        $this->assertDatabaseHas('policy_requests', [
            'client_request_id' => 'AGT-2026-0001',
            'agent_id' => 'AGENT-17',
            'premium' => 225.00,
            'status' => 'RECEIVED',
        ]);
    }

    /**
     * Test 2: Invalid trip dates are rejected (end before start).
     */
    public function test_invalid_trip_dates_rejected(): void
    {
        $response = $this->postJson('/api/policy-requests', $this->validPayload([
            'trip_start' => '2027-11-14',
            'trip_end' => '2027-11-10',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['trip_end']);
    }

    /**
     * Test 3: Unsupported plan code is rejected.
     */
    public function test_unsupported_plan_rejected(): void
    {
        $response = $this->postJson('/api/policy-requests', $this->validPayload([
            'plan_code' => 'GOLD',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['plan_code']);
    }

    /**
     * Test: Unsupported destination is rejected.
     */
    public function test_unsupported_destination_rejected(): void
    {
        $response = $this->postJson('/api/policy-requests', $this->validPayload([
            'destination' => 'EUROPE',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['destination']);
    }

    /**
     * Test: Unsupported sum insured is rejected.
     */
    public function test_unsupported_sum_insured_rejected(): void
    {
        $response = $this->postJson('/api/policy-requests', $this->validPayload([
            'sum_insured' => 200000,
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['sum_insured']);
    }

    /**
     * Test: Missing required fields are rejected.
     */
    public function test_missing_required_fields_rejected(): void
    {
        $response = $this->postJson('/api/policy-requests', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors([
                'client_request_id',
                'agent_id',
                'customer_name',
                'date_of_birth',
                'destination',
                'trip_start',
                'trip_end',
                'plan_code',
                'sum_insured',
            ]);
    }

    // =========================================================================
    // DUPLICATE INTAKE TESTS (Reliability Case A)
    // =========================================================================

    /**
     * Test 4: Duplicate intake does NOT create a second logical request.
     */
    public function test_duplicate_intake_returns_existing_request(): void
    {
        $payload = $this->validPayload();

        // First submission — should create
        $first = $this->postJson('/api/policy-requests', $payload);
        $first->assertStatus(201);
        $firstId = $first->json('data.id');

        // Second submission with same agent_id + client_request_id — should return existing
        $second = $this->postJson('/api/policy-requests', $payload);
        $second->assertStatus(200)
            ->assertJson([
                'success' => true,
                'is_duplicate' => true,
                'data' => [
                    'id' => $firstId,
                ],
            ]);

        // Only one record in database
        $this->assertEquals(1, PolicyRequest::count());
    }

    /**
     * Test: Different agent_id with same client_request_id creates a NEW request.
     */
    public function test_different_agent_creates_new_request(): void
    {
        $this->postJson('/api/policy-requests', $this->validPayload());
        $this->postJson('/api/policy-requests', $this->validPayload([
            'agent_id' => 'AGENT-99',
        ]));

        $this->assertEquals(2, PolicyRequest::count());
    }

    // =========================================================================
    // ISSUANCE TESTS
    // =========================================================================

    /**
     * Test 5: Successful issuance assigns exactly one policy number.
     */
    public function test_successful_issuance_assigns_policy_number(): void
    {
        // Create a request
        $create = $this->postJson('/api/policy-requests', $this->validPayload([
            'mock_scenario' => 'SUCCESS',
        ]));
        $create->assertStatus(201);
        $id = $create->json('data.id');

        // Submit for issuance
        $submit = $this->postJson("/api/policy-requests/{$id}/submit");
        $submit->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Verify policy number was assigned
        $policyRequest = PolicyRequest::find($id);
        $this->assertNotNull($policyRequest->policy_number);
        $this->assertEquals('ISSUED', $policyRequest->status);

        // Submit again — should return the same policy number, not create a new one
        $resubmit = $this->postJson("/api/policy-requests/{$id}/submit");
        $resubmit->assertJson([
            'success' => true,
            'issuance_result' => [
                'policy_number' => $policyRequest->policy_number,
            ],
        ]);

        // Still exactly one policy number
        $this->assertEquals(
            $policyRequest->policy_number,
            PolicyRequest::find($id)->policy_number
        );
    }

    // =========================================================================
    // RELIABILITY CASE B: TIMEOUT AFTER ISSUE + RECONCILIATION
    // =========================================================================

    /**
     * Test 7: Timeout after successful issuance, then reconciliation recovers the policy.
     */
    public function test_timeout_after_issue_reconciliation(): void
    {
        // Create a request with TIMEOUT_AFTER_ISSUE scenario
        $create = $this->postJson('/api/policy-requests', $this->validPayload([
            'mock_scenario' => 'TIMEOUT_AFTER_ISSUE',
        ]));
        $id = $create->json('data.id');

        // Submit — should timeout (provider issued but response lost)
        $submit = $this->postJson("/api/policy-requests/{$id}/submit");

        // Request should be in PENDING_CONFIRMATION state
        $pr = PolicyRequest::find($id);
        $this->assertEquals('PENDING_CONFIRMATION', $pr->status);
        $this->assertNull($pr->policy_number); // No policy number yet (response was "lost")

        // Reconcile — check provider status
        $reconcile = $this->postJson("/api/policy-requests/{$id}/reconcile");
        $reconcile->assertJson([
            'success' => true,
            'reconciliation_result' => [
                'success' => true,
            ],
        ]);

        // Now the policy should be ISSUED with the recovered policy number
        $pr->refresh();
        $this->assertEquals('ISSUED', $pr->status);
        $this->assertNotNull($pr->policy_number);
    }

    // =========================================================================
    // CALLBACK IDEMPOTENCY TESTS
    // =========================================================================

    /**
     * Test 8: Repeated callback cannot overwrite an ISSUED state.
     */
    public function test_repeated_callback_cannot_overwrite_issued(): void
    {
        // Create and issue a policy
        $create = $this->postJson('/api/policy-requests', $this->validPayload([
            'mock_scenario' => 'SUCCESS',
        ]));
        $id = $create->json('data.id');

        $this->postJson("/api/policy-requests/{$id}/submit");

        $pr = PolicyRequest::find($id);
        $this->assertEquals('ISSUED', $pr->status);
        $originalPolicyNumber = $pr->policy_number;

        // Send a callback trying to change the policy number
        $callback = $this->postJson('/api/mock-insurer/callback', [
            'event_id' => 'EVT-DUPLICATE-001',
            'event_type' => 'policy_issued',
            'policy_request_id' => $id,
            'policy_number' => 'POL-DIFFERENT-99999',
            'provider_reference' => 'PROV-OTHER',
        ]);

        $callback->assertStatus(200)
            ->assertJson([
                'success' => true,
                'already_issued' => true,
            ]);

        // Policy number should NOT have changed
        $pr->refresh();
        $this->assertEquals($originalPolicyNumber, $pr->policy_number);
        $this->assertEquals('ISSUED', $pr->status);
    }

    /**
     * Test: Duplicate callback (same event_id) is processed only once.
     */
    public function test_duplicate_callback_processed_once(): void
    {
        // Create a request in PENDING_CONFIRMATION state
        $create = $this->postJson('/api/policy-requests', $this->validPayload([
            'mock_scenario' => 'DELAYED_CALLBACK',
        ]));
        $id = $create->json('data.id');
        $this->postJson("/api/policy-requests/{$id}/submit");

        $callbackPayload = [
            'event_id' => 'EVT-CALLBACK-001',
            'event_type' => 'policy_issued',
            'policy_request_id' => $id,
            'policy_number' => 'POL-CALLBACK-12345',
            'provider_reference' => 'PROV-CB-001',
        ];

        // First callback — should process
        $first = $this->postJson('/api/mock-insurer/callback', $callbackPayload);
        $first->assertStatus(200);

        // Second callback with SAME event_id — should be detected as duplicate
        $second = $this->postJson('/api/mock-insurer/callback', $callbackPayload);
        $second->assertStatus(200)
            ->assertJson([
                'is_duplicate' => true,
            ]);

        // Only one provider event recorded
        $this->assertEquals(1, ProviderEvent::where('provider_event_id', 'EVT-CALLBACK-001')->count());
    }

    // =========================================================================
    // STATE TRANSITION TESTS
    // =========================================================================

    /**
     * Test 9: Invalid state transitions are rejected.
     */
    public function test_issued_policy_cannot_be_resubmitted_to_submitted(): void
    {
        // Create and issue a policy
        $create = $this->postJson('/api/policy-requests', $this->validPayload([
            'mock_scenario' => 'SUCCESS',
        ]));
        $id = $create->json('data.id');
        $this->postJson("/api/policy-requests/{$id}/submit");

        $pr = PolicyRequest::find($id);
        $this->assertEquals('ISSUED', $pr->status);

        // Trying to submit again should return success (already issued) not create a new submission
        $response = $this->postJson("/api/policy-requests/{$id}/submit");
        $response->assertJson(['success' => true]);

        // Status should still be ISSUED
        $pr->refresh();
        $this->assertEquals('ISSUED', $pr->status);
    }

    // =========================================================================
    // LISTING AND PAGINATION TESTS
    // =========================================================================

    /**
     * Test 10: Policy listing with filters and pagination.
     */
    public function test_policy_listing_with_filters(): void
    {
        // Create multiple requests
        $this->postJson('/api/policy-requests', $this->validPayload());
        $this->postJson('/api/policy-requests', $this->validPayload([
            'client_request_id' => 'AGT-2026-0002',
            'mock_scenario' => 'SUCCESS',
        ]));
        $this->postJson('/api/policy-requests', $this->validPayload([
            'client_request_id' => 'AGT-2026-0003',
        ]));

        // Issue the second one
        $this->postJson('/api/policy-requests/2/submit');

        // List all
        $all = $this->getJson('/api/policy-requests');
        $all->assertStatus(200)
            ->assertJsonPath('pagination.total', 3);

        // Filter by ISSUED status
        $issued = $this->getJson('/api/policy-requests?status=ISSUED');
        $issued->assertStatus(200)
            ->assertJsonPath('pagination.total', 1);

        // Filter by RECEIVED status
        $received = $this->getJson('/api/policy-requests?status=RECEIVED');
        $received->assertStatus(200)
            ->assertJsonPath('pagination.total', 2);

        // Search by customer name
        $search = $this->getJson('/api/policy-requests?search=Sample');
        $search->assertStatus(200)
            ->assertJsonPath('pagination.total', 3);
    }

    /**
     * Test: Pagination works correctly.
     */
    public function test_pagination(): void
    {
        // Create 5 requests
        for ($i = 1; $i <= 5; $i++) {
            $this->postJson('/api/policy-requests', $this->validPayload([
                'client_request_id' => "AGT-2026-{$i}",
            ]));
        }

        // Request page 1 with 2 per page
        $page1 = $this->getJson('/api/policy-requests?per_page=2&page=1');
        $page1->assertStatus(200)
            ->assertJsonPath('pagination.total', 5)
            ->assertJsonPath('pagination.per_page', 2)
            ->assertJsonPath('pagination.last_page', 3);

        $this->assertCount(2, $page1->json('data'));
    }

    /**
     * Test: Show endpoint returns full details with state history.
     */
    public function test_show_returns_details_with_history(): void
    {
        $create = $this->postJson('/api/policy-requests', $this->validPayload());
        $id = $create->json('data.id');

        $show = $this->getJson("/api/policy-requests/{$id}");
        $show->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'client_request_id',
                    'customer_name',
                    'premium',
                    'status',
                    'state_history',
                    'issuance_attempts',
                ],
            ]);
    }

    /**
     * Test: Temporary failure allows retry.
     */
    public function test_temporary_failure_allows_retry(): void
    {
        $create = $this->postJson('/api/policy-requests', $this->validPayload([
            'mock_scenario' => 'TEMPORARY_FAILURE',
        ]));
        $id = $create->json('data.id');

        // First submit — should fail
        $submit1 = $this->postJson("/api/policy-requests/{$id}/submit");
        $pr = PolicyRequest::find($id);
        $this->assertEquals('FAILED', $pr->status);

        // Change scenario to SUCCESS and retry
        $pr->mock_scenario = 'SUCCESS';
        $pr->save();

        $submit2 = $this->postJson("/api/policy-requests/{$id}/submit");
        $submit2->assertJson(['success' => true]);

        $pr->refresh();
        $this->assertEquals('ISSUED', $pr->status);
        $this->assertNotNull($pr->policy_number);
    }

    /**
     * Test: Dashboard stats endpoint works.
     */
    public function test_dashboard_stats(): void
    {
        $this->postJson('/api/policy-requests', $this->validPayload());

        $stats = $this->getJson('/api/dashboard/stats');
        $stats->assertStatus(200)
            ->assertJsonStructure([
                'stats' => [
                    'total_requests',
                    'issued',
                    'pending_confirmation',
                    'failed',
                ],
                'recent_requests',
            ]);
    }
}
