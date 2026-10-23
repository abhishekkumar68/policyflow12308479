<?php

namespace App\Services;

use App\Models\PolicyRequest;
use Illuminate\Support\Str;

/**
 * A deterministic mock insurer for testing the issuance workflow.
 *
 * Simulates different provider scenarios:
 * - SUCCESS: Returns policy number immediately
 * - TEMPORARY_FAILURE: Returns a retriable error
 * - TIMEOUT_AFTER_ISSUE: Creates policy but simulates lost response
 * - DELAYED_CALLBACK: Returns pending, expects callback later
 * - DUPLICATE_CALLBACK: Same as SUCCESS (callback handling is tested separately)
 *
 * The mock stores issued policies in a simple in-memory/database approach
 * so reconciliation can look up whether a policy was actually issued.
 */
class MockInsurerService
{
    /**
     * Internal storage of policies the mock insurer has "issued".
     * In production this would be the real insurer's database.
     * We use Laravel's cache for simplicity in a single-server setup.
     */

    /**
     * Submit a policy request to the mock insurer.
     *
     * @param PolicyRequest $request  The policy request to submit
     * @param string $scenario        The mock scenario to simulate
     * @return array Response from the mock insurer
     */
    public function submitPolicy(PolicyRequest $request, string $scenario = 'SUCCESS'): array
    {
        $providerReference = 'PROV-' . strtoupper(Str::random(8));

        switch (strtoupper($scenario)) {
            case 'SUCCESS':
                return $this->handleSuccess($request, $providerReference);

            case 'TEMPORARY_FAILURE':
                return $this->handleTemporaryFailure($providerReference);

            case 'TIMEOUT_AFTER_ISSUE':
                return $this->handleTimeoutAfterIssue($request, $providerReference);

            case 'DELAYED_CALLBACK':
                return $this->handleDelayedCallback($request, $providerReference);

            case 'DUPLICATE_CALLBACK':
                // Same as SUCCESS — the duplicate handling is done in callback processing
                return $this->handleSuccess($request, $providerReference);

            default:
                return [
                    'outcome' => 'FAILURE',
                    'error' => "Unknown scenario: {$scenario}",
                    'provider_reference' => $providerReference,
                    'retriable' => false,
                ];
        }
    }

    /**
     * SUCCESS scenario: Insurer accepts and issues a policy immediately.
     */
    private function handleSuccess(PolicyRequest $request, string $providerReference): array
    {
        $policyNumber = 'POL-' . strtoupper(Str::random(10));

        // Store in mock provider's "database" so reconciliation can find it
        $this->storeIssuedPolicy($request->id, $policyNumber, $providerReference);

        return [
            'outcome' => 'SUCCESS',
            'policy_number' => $policyNumber,
            'provider_reference' => $providerReference,
            'message' => 'Policy issued successfully',
        ];
    }

    /**
     * TEMPORARY_FAILURE: Provider returns a retriable error.
     */
    private function handleTemporaryFailure(string $providerReference): array
    {
        return [
            'outcome' => 'FAILURE',
            'provider_reference' => $providerReference,
            'error' => 'Service temporarily unavailable. Please retry.',
            'retriable' => true,
        ];
    }

    /**
     * TIMEOUT_AFTER_ISSUE: Provider creates the policy but the response is "lost".
     * The policy IS created on the provider side, but we simulate a timeout.
     */
    private function handleTimeoutAfterIssue(PolicyRequest $request, string $providerReference): array
    {
        $policyNumber = 'POL-' . strtoupper(Str::random(10));

        // The insurer DID create the policy — store it so reconciliation can find it
        $this->storeIssuedPolicy($request->id, $policyNumber, $providerReference);

        // But the client gets a timeout response
        return [
            'outcome' => 'TIMEOUT',
            'provider_reference' => $providerReference,
            'error' => 'Gateway timeout — provider did not respond in time',
        ];
    }

    /**
     * DELAYED_CALLBACK: Provider returns "pending" and will send a callback later.
     */
    private function handleDelayedCallback(PolicyRequest $request, string $providerReference): array
    {
        $policyNumber = 'POL-' . strtoupper(Str::random(10));

        // Store for later callback simulation
        $this->storeIssuedPolicy($request->id, $policyNumber, $providerReference);

        return [
            'outcome' => 'PENDING',
            'provider_reference' => $providerReference,
            'message' => 'Request accepted. Confirmation will be sent via callback.',
        ];
    }

    /**
     * Check the provider's status for a given policy request.
     * This is the reconciliation endpoint.
     */
    public function checkStatus(PolicyRequest $request): array
    {
        $stored = $this->getIssuedPolicy($request->id);

        if ($stored) {
            return [
                'status' => 'ISSUED',
                'policy_number' => $stored['policy_number'],
                'provider_reference' => $stored['provider_reference'],
                'message' => 'Policy was issued by the provider',
            ];
        }

        return [
            'status' => 'NOT_FOUND',
            'message' => 'No policy found for this request at the provider',
        ];
    }

    /**
     * Store a policy in the mock provider's internal "database".
     * Uses Laravel's cache as a simple key-value store.
     */
    private function storeIssuedPolicy(int $requestId, string $policyNumber, string $providerReference): void
    {
        $key = "mock_insurer_policy_{$requestId}";
        cache()->put($key, [
            'policy_number' => $policyNumber,
            'provider_reference' => $providerReference,
            'issued_at' => now()->toISOString(),
        ], now()->addDay());
    }

    /**
     * Retrieve a policy from the mock provider's internal "database".
     */
    private function getIssuedPolicy(int $requestId): ?array
    {
        $key = "mock_insurer_policy_{$requestId}";
        return cache()->get($key);
    }

    /**
     * Generate a simulated callback payload for a request.
     * Used by the mock insurer callback simulation controls.
     */
    public function generateCallbackPayload(PolicyRequest $request, string $eventType = 'policy_issued'): array
    {
        $stored = $this->getIssuedPolicy($request->id);

        return [
            'event_id' => 'EVT-' . strtoupper(Str::random(10)),
            'event_type' => $eventType,
            'policy_request_id' => $request->id,
            'provider_reference' => $stored['provider_reference'] ?? $request->provider_reference,
            'policy_number' => $stored['policy_number'] ?? null,
            'timestamp' => now()->toISOString(),
        ];
    }
}
