<?php

namespace App\Services;

use App\Models\PolicyRequest;
use App\Models\IssuanceAttempt;
use App\Models\PolicyStateHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Orchestrates the issuance workflow for policy requests.
 *
 * Manages state transitions, communicates with the mock insurer,
 * and ensures idempotent behavior (no duplicate policies).
 */
class IssuanceService
{
    /**
     * Allowed state transitions map.
     * Key = current state, Value = array of allowed next states.
     */
    private const ALLOWED_TRANSITIONS = [
        'RECEIVED'              => ['VALIDATED', 'FAILED'],
        'VALIDATED'             => ['SUBMITTED', 'FAILED'],
        'SUBMITTED'             => ['PENDING_CONFIRMATION', 'ISSUED', 'FAILED', 'NEEDS_RECONCILIATION'],
        'PENDING_CONFIRMATION'  => ['ISSUED', 'FAILED', 'NEEDS_RECONCILIATION'],
        'NEEDS_RECONCILIATION'  => ['ISSUED', 'FAILED'],
        'FAILED'                => ['SUBMITTED'], // Allow retry from FAILED
        // ISSUED is a terminal state — no further transitions allowed
    ];

    private MockInsurerService $mockInsurer;

    public function __construct(MockInsurerService $mockInsurer)
    {
        $this->mockInsurer = $mockInsurer;
    }

    /**
     * Submit a policy request for issuance.
     *
     * Validates the request is in a submittable state, sends to mock insurer,
     * and handles the response appropriately.
     */
    public function submit(PolicyRequest $policyRequest): array
    {
        // Don't resubmit if already issued
        if ($policyRequest->status === 'ISSUED') {
            return [
                'success' => true,
                'message' => 'Policy already issued',
                'policy_number' => $policyRequest->policy_number,
            ];
        }

        // Only allow submission from certain states
        $submittableStates = ['VALIDATED', 'FAILED', 'NEEDS_RECONCILIATION'];
        if (!in_array($policyRequest->status, $submittableStates)) {
            // If still RECEIVED, validate first
            if ($policyRequest->status === 'RECEIVED') {
                $this->transitionState($policyRequest, 'VALIDATED', 'Auto-validated on submission');
            } elseif ($policyRequest->status === 'SUBMITTED' || $policyRequest->status === 'PENDING_CONFIRMATION') {
                return [
                    'success' => false,
                    'message' => "Request is already {$policyRequest->status}. Use reconciliation to check status.",
                ];
            } else {
                return [
                    'success' => false,
                    'message' => "Cannot submit from state: {$policyRequest->status}",
                ];
            }
        }

        return DB::transaction(function () use ($policyRequest) {
            // Refresh with lock to prevent concurrent submissions
            $policyRequest = PolicyRequest::lockForUpdate()->find($policyRequest->id);

            // Double-check state after locking
            if ($policyRequest->status === 'ISSUED') {
                return [
                    'success' => true,
                    'message' => 'Policy already issued',
                    'policy_number' => $policyRequest->policy_number,
                ];
            }

            // Transition to SUBMITTED
            $this->transitionState($policyRequest, 'SUBMITTED', 'Submitting to insurer');

            // Increment attempt count
            $attemptNumber = $policyRequest->issuance_attempts_count + 1;
            $policyRequest->issuance_attempts_count = $attemptNumber;
            $policyRequest->save();

            // Call mock insurer
            $scenario = $policyRequest->mock_scenario ?? 'SUCCESS';
            $insurerResponse = $this->mockInsurer->submitPolicy($policyRequest, $scenario);

            // Record the issuance attempt
            IssuanceAttempt::create([
                'policy_request_id' => $policyRequest->id,
                'attempt_number' => $attemptNumber,
                'provider_reference' => $insurerResponse['provider_reference'] ?? null,
                'scenario' => $scenario,
                'outcome' => $insurerResponse['outcome'],
                'response_payload' => json_encode($insurerResponse),
                'error_message' => $insurerResponse['error'] ?? null,
            ]);

            // Update provider reference
            if (isset($insurerResponse['provider_reference'])) {
                $policyRequest->provider_reference = $insurerResponse['provider_reference'];
            }
            $policyRequest->last_provider_response = json_encode($insurerResponse);

            // Handle the response based on outcome
            return $this->handleInsurerResponse($policyRequest, $insurerResponse);
        });
    }

    /**
     * Handle the mock insurer's response and transition to the appropriate state.
     */
    private function handleInsurerResponse(PolicyRequest $policyRequest, array $response): array
    {
        switch ($response['outcome']) {
            case 'SUCCESS':
                // Issue the policy
                $policyRequest->policy_number = $response['policy_number'];
                $policyRequest->save();
                $this->transitionState($policyRequest, 'ISSUED', 'Policy issued by insurer');
                return [
                    'success' => true,
                    'message' => 'Policy issued successfully',
                    'policy_number' => $response['policy_number'],
                    'provider_reference' => $response['provider_reference'],
                ];

            case 'FAILURE':
                $policyRequest->save();
                $this->transitionState($policyRequest, 'FAILED', $response['error'] ?? 'Provider returned failure');
                return [
                    'success' => false,
                    'message' => 'Issuance failed: ' . ($response['error'] ?? 'Unknown error'),
                    'retriable' => $response['retriable'] ?? false,
                ];

            case 'TIMEOUT':
                // Provider may or may not have issued — we don't know
                $policyRequest->save();
                $this->transitionState(
                    $policyRequest,
                    'PENDING_CONFIRMATION',
                    'Provider timeout — outcome uncertain'
                );
                return [
                    'success' => false,
                    'message' => 'Provider timed out. Use reconciliation to check status.',
                    'needs_reconciliation' => true,
                ];

            case 'PENDING':
                // Waiting for callback
                $policyRequest->save();
                $this->transitionState(
                    $policyRequest,
                    'PENDING_CONFIRMATION',
                    'Awaiting provider callback'
                );
                return [
                    'success' => false,
                    'message' => 'Awaiting provider confirmation via callback.',
                    'pending' => true,
                ];

            default:
                $policyRequest->save();
                $this->transitionState($policyRequest, 'FAILED', 'Unexpected provider response');
                return [
                    'success' => false,
                    'message' => 'Unexpected provider response',
                ];
        }
    }

    /**
     * Reconcile a request by checking the mock provider's status.
     * Used when the outcome is uncertain (timeout, pending confirmation).
     */
    public function reconcile(PolicyRequest $policyRequest): array
    {
        $reconcilableStates = ['PENDING_CONFIRMATION', 'NEEDS_RECONCILIATION', 'SUBMITTED'];

        if ($policyRequest->status === 'ISSUED') {
            return [
                'success' => true,
                'message' => 'Policy is already issued',
                'policy_number' => $policyRequest->policy_number,
            ];
        }

        if (!in_array($policyRequest->status, $reconcilableStates)) {
            return [
                'success' => false,
                'message' => "Cannot reconcile from state: {$policyRequest->status}",
            ];
        }

        return DB::transaction(function () use ($policyRequest) {
            $policyRequest = PolicyRequest::lockForUpdate()->find($policyRequest->id);

            // Check again after locking
            if ($policyRequest->status === 'ISSUED') {
                return [
                    'success' => true,
                    'message' => 'Policy is already issued',
                    'policy_number' => $policyRequest->policy_number,
                ];
            }

            // Query the mock provider for the current status
            $providerStatus = $this->mockInsurer->checkStatus($policyRequest);

            if ($providerStatus['status'] === 'ISSUED') {
                // Provider has issued the policy — recover it
                $policyRequest->policy_number = $providerStatus['policy_number'];
                $policyRequest->provider_reference = $providerStatus['provider_reference'] ?? $policyRequest->provider_reference;
                $policyRequest->last_provider_response = json_encode($providerStatus);
                $policyRequest->save();
                $this->transitionState($policyRequest, 'ISSUED', 'Reconciled — provider confirmed issuance');
                return [
                    'success' => true,
                    'message' => 'Policy was already issued by provider. Status recovered.',
                    'policy_number' => $providerStatus['policy_number'],
                ];
            } elseif ($providerStatus['status'] === 'NOT_FOUND') {
                // Provider has no record — safe to retry
                $policyRequest->last_provider_response = json_encode($providerStatus);
                $policyRequest->save();
                $this->transitionState($policyRequest, 'FAILED', 'Reconciled — provider has no record, safe to retry');
                return [
                    'success' => false,
                    'message' => 'Provider has no record of this request. Safe to re-submit.',
                    'retriable' => true,
                ];
            } else {
                // Still pending
                $policyRequest->last_provider_response = json_encode($providerStatus);
                $policyRequest->save();
                $this->transitionState($policyRequest, 'NEEDS_RECONCILIATION', 'Provider status still uncertain');
                return [
                    'success' => false,
                    'message' => 'Provider status is still uncertain. Try again later.',
                ];
            }
        });
    }

    /**
     * Transition a policy request to a new state.
     * Records the transition in the history table.
     * Rejects invalid state transitions.
     */
    public function transitionState(PolicyRequest $policyRequest, string $newState, string $reason = ''): void
    {
        $currentState = $policyRequest->status;

        // Validate the transition is allowed
        if (!$this->isTransitionAllowed($currentState, $newState)) {
            throw new \RuntimeException(
                "Invalid state transition: {$currentState} → {$newState}"
            );
        }

        // Record the transition
        PolicyStateHistory::create([
            'policy_request_id' => $policyRequest->id,
            'from_state' => $currentState,
            'to_state' => $newState,
            'reason' => $reason,
            'transitioned_at' => now(),
        ]);

        // Update the policy request status
        $policyRequest->status = $newState;
        $policyRequest->save();
    }

    /**
     * Check if a state transition is allowed.
     */
    public function isTransitionAllowed(string $fromState, string $toState): bool
    {
        // Same state — no-op is always allowed
        if ($fromState === $toState) {
            return true;
        }

        $allowedTargets = self::ALLOWED_TRANSITIONS[$fromState] ?? [];
        return in_array($toState, $allowedTargets);
    }
}
