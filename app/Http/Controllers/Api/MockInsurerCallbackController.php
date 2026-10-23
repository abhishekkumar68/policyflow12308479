<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolicyRequest;
use App\Models\ProviderEvent;
use App\Services\IssuanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Handles mock insurer callbacks.
 * Processes provider events idempotently — duplicate events are accepted but not reprocessed.
 */
class MockInsurerCallbackController extends Controller
{
    private IssuanceService $issuanceService;

    public function __construct(IssuanceService $issuanceService)
    {
        $this->issuanceService = $issuanceService;
    }

    /**
     * POST /api/mock-insurer/callback
     *
     * Receive a simulated provider event (e.g., policy issued, policy failed).
     * Idempotent: the same event_id delivered multiple times is processed only once.
     */
    public function handleCallback(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_id' => 'required|string',
            'event_type' => 'required|string|in:policy_issued,policy_failed',
            'policy_request_id' => 'required|integer',
            'provider_reference' => 'nullable|string',
            'policy_number' => 'nullable|string',
        ]);

        // Find the policy request
        $policyRequest = PolicyRequest::find($validated['policy_request_id']);
        if (!$policyRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Policy request not found',
            ], 404);
        }

        // Check for duplicate event (idempotency)
        $existingEvent = ProviderEvent::where('provider_event_id', $validated['event_id'])->first();
        if ($existingEvent) {
            return response()->json([
                'success' => true,
                'message' => 'Event already processed (duplicate callback)',
                'is_duplicate' => true,
            ], 200);
        }

        return DB::transaction(function () use ($policyRequest, $validated) {
            // Lock the policy request to prevent concurrent processing
            $policyRequest = PolicyRequest::lockForUpdate()->find($policyRequest->id);

            // Double-check for duplicate event after lock
            $existingEvent = ProviderEvent::where('provider_event_id', $validated['event_id'])->first();
            if ($existingEvent) {
                return response()->json([
                    'success' => true,
                    'message' => 'Event already processed (duplicate callback)',
                    'is_duplicate' => true,
                ], 200);
            }

            // Record the provider event
            ProviderEvent::create([
                'policy_request_id' => $policyRequest->id,
                'provider_event_id' => $validated['event_id'],
                'event_type' => $validated['event_type'],
                'payload' => json_encode($validated),
                'processed' => true,
            ]);

            // Don't overwrite an already ISSUED policy
            if ($policyRequest->status === 'ISSUED') {
                return response()->json([
                    'success' => true,
                    'message' => 'Policy is already issued. Callback acknowledged but no changes made.',
                    'already_issued' => true,
                ], 200);
            }

            // Process the event based on type
            if ($validated['event_type'] === 'policy_issued') {
                // Assign policy number (only if not already assigned)
                if (!$policyRequest->policy_number && isset($validated['policy_number'])) {
                    $policyRequest->policy_number = $validated['policy_number'];
                }
                if (isset($validated['provider_reference'])) {
                    $policyRequest->provider_reference = $validated['provider_reference'];
                }
                $policyRequest->last_provider_response = json_encode($validated);
                $policyRequest->save();

                $this->issuanceService->transitionState(
                    $policyRequest,
                    'ISSUED',
                    'Provider callback confirmed issuance'
                );

                return response()->json([
                    'success' => true,
                    'message' => 'Callback processed — policy marked as issued',
                    'policy_number' => $policyRequest->policy_number,
                ], 200);
            }

            if ($validated['event_type'] === 'policy_failed') {
                $policyRequest->last_provider_response = json_encode($validated);
                $policyRequest->save();

                $this->issuanceService->transitionState(
                    $policyRequest,
                    'FAILED',
                    'Provider callback reported failure'
                );

                return response()->json([
                    'success' => true,
                    'message' => 'Callback processed — policy marked as failed',
                ], 200);
            }

            return response()->json([
                'success' => false,
                'message' => 'Unknown event type',
            ], 422);
        });
    }
}
