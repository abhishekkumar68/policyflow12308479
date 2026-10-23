<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreatePolicyRequest;
use App\Models\PolicyRequest;
use App\Services\PremiumCalculationService;
use App\Services\IssuanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

/**
 * Handles policy request CRUD operations and issuance workflow.
 * Thin controller — business logic lives in PremiumCalculationService and IssuanceService.
 */
class PolicyRequestController extends Controller
{
    private PremiumCalculationService $premiumService;
    private IssuanceService $issuanceService;

    public function __construct(
        PremiumCalculationService $premiumService,
        IssuanceService $issuanceService
    ) {
        $this->premiumService = $premiumService;
        $this->issuanceService = $issuanceService;
    }

    /**
     * POST /api/policy-requests
     *
     * Create a new policy request or safely return an existing one
     * if the same agent_id + client_request_id is submitted again.
     */
    public function store(CreatePolicyRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // Check for existing request with same agent_id + client_request_id
        $existing = PolicyRequest::where('agent_id', $validated['agent_id'])
            ->where('client_request_id', $validated['client_request_id'])
            ->first();

        if ($existing) {
            // Idempotent: return the existing request with HTTP 200
            return response()->json([
                'success' => true,
                'message' => 'Existing policy request returned (duplicate submission)',
                'data' => $this->formatPolicyResponse($existing),
                'is_duplicate' => true,
            ], 200);
        }

        // Calculate premium (immutable snapshot)
        $premiumResult = $this->premiumService->calculate(
            $validated['plan_code'],
            $validated['trip_start'],
            $validated['trip_end'],
            $validated['date_of_birth'],
            $validated['destination'],
            (int) $validated['sum_insured']
        );

        try {
            // Create within a transaction for safety
            $policyRequest = DB::transaction(function () use ($validated, $premiumResult) {
                $pr = PolicyRequest::create([
                    'client_request_id' => $validated['client_request_id'],
                    'agent_id' => $validated['agent_id'],
                    'customer_name' => $validated['customer_name'],
                    'date_of_birth' => $validated['date_of_birth'],
                    'destination' => $validated['destination'],
                    'trip_start' => $validated['trip_start'],
                    'trip_end' => $validated['trip_end'],
                    'plan_code' => $validated['plan_code'],
                    'sum_insured' => (int) $validated['sum_insured'],
                    'premium' => $premiumResult['premium'],
                    'travel_days' => $premiumResult['travel_days'],
                    'status' => 'RECEIVED',
                    'mock_scenario' => $validated['mock_scenario'] ?? null,
                ]);

                // Record initial state
                $pr->stateHistory()->create([
                    'from_state' => null,
                    'to_state' => 'RECEIVED',
                    'reason' => 'Policy request created',
                    'transitioned_at' => now(),
                ]);

                return $pr;
            });

            return response()->json([
                'success' => true,
                'message' => 'Policy request created successfully',
                'data' => $this->formatPolicyResponse($policyRequest),
                'premium_breakdown' => $premiumResult['breakdown'],
            ], 201);
        } catch (QueryException $e) {
            // Handle race condition: another concurrent request created it first
            if ($this->isDuplicateKeyError($e)) {
                $existing = PolicyRequest::where('agent_id', $validated['agent_id'])
                    ->where('client_request_id', $validated['client_request_id'])
                    ->firstOrFail();

                return response()->json([
                    'success' => true,
                    'message' => 'Existing policy request returned (concurrent duplicate)',
                    'data' => $this->formatPolicyResponse($existing),
                    'is_duplicate' => true,
                ], 200);
            }

            throw $e;
        }
    }

    /**
     * GET /api/policy-requests/{id}
     *
     * Retrieve a single policy request with full details and audit history.
     */
    public function show(int $id): JsonResponse
    {
        $policyRequest = PolicyRequest::with(['stateHistory', 'issuanceAttempts', 'providerEvents'])
            ->find($id);

        if (!$policyRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Policy request not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatPolicyResponse($policyRequest, true),
        ]);
    }

    /**
     * GET /api/policy-requests
     *
     * List all policy requests with optional status filter and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PolicyRequest::query();

        // Status filter
        if ($request->has('status') && $request->status !== '' && $request->status !== 'ALL') {
            $query->where('status', $request->status);
        }

        // Search by request ID or customer name
        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('client_request_id', 'like', "%{$search}%")
                  ->orWhere('customer_name', 'like', "%{$search}%")
                  ->orWhere('id', 'like', "%{$search}%");
            });
        }

        // Order by most recent first
        $query->orderBy('created_at', 'desc');

        // Paginate
        $perPage = min($request->get('per_page', 15), 100);
        $policyRequests = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $policyRequests->getCollection()->map(function ($pr) {
                return $this->formatPolicyResponse($pr);
            }),
            'pagination' => [
                'current_page' => $policyRequests->currentPage(),
                'last_page' => $policyRequests->lastPage(),
                'per_page' => $policyRequests->perPage(),
                'total' => $policyRequests->total(),
                'from' => $policyRequests->firstItem(),
                'to' => $policyRequests->lastItem(),
            ],
        ]);
    }

    /**
     * POST /api/policy-requests/{id}/submit
     *
     * Submit a policy request for issuance to the mock insurer.
     */
    public function submit(int $id): JsonResponse
    {
        $policyRequest = PolicyRequest::find($id);

        if (!$policyRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Policy request not found',
            ], 404);
        }

        try {
            $result = $this->issuanceService->submit($policyRequest);

            $statusCode = $result['success'] ? 200 : 422;

            return response()->json([
                'success' => $result['success'],
                'message' => $result['message'],
                'data' => $this->formatPolicyResponse($policyRequest->fresh(['stateHistory', 'issuanceAttempts'])),
                'issuance_result' => $result,
            ], $statusCode);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * POST /api/policy-requests/{id}/reconcile
     *
     * Check provider status and reconcile an uncertain policy request.
     */
    public function reconcile(int $id): JsonResponse
    {
        $policyRequest = PolicyRequest::find($id);

        if (!$policyRequest) {
            return response()->json([
                'success' => false,
                'message' => 'Policy request not found',
            ], 404);
        }

        try {
            $result = $this->issuanceService->reconcile($policyRequest);

            return response()->json([
                'success' => $result['success'],
                'message' => $result['message'],
                'data' => $this->formatPolicyResponse($policyRequest->fresh(['stateHistory', 'issuanceAttempts'])),
                'reconciliation_result' => $result,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * GET /api/dashboard/stats
     *
     * Get dashboard statistics.
     */
    public function dashboardStats(): JsonResponse
    {
        $stats = [
            'total_requests' => PolicyRequest::count(),
            'issued' => PolicyRequest::where('status', 'ISSUED')->count(),
            'pending_confirmation' => PolicyRequest::where('status', 'PENDING_CONFIRMATION')->count(),
            'failed' => PolicyRequest::where('status', 'FAILED')->count(),
            'received' => PolicyRequest::where('status', 'RECEIVED')->count(),
            'validated' => PolicyRequest::where('status', 'VALIDATED')->count(),
            'submitted' => PolicyRequest::where('status', 'SUBMITTED')->count(),
            'needs_reconciliation' => PolicyRequest::where('status', 'NEEDS_RECONCILIATION')->count(),
        ];

        $recentRequests = PolicyRequest::orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($pr) {
                return $this->formatPolicyResponse($pr);
            });

        return response()->json([
            'success' => true,
            'stats' => $stats,
            'recent_requests' => $recentRequests,
        ]);
    }

    /**
     * Format a policy request for API response.
     */
    private function formatPolicyResponse(PolicyRequest $pr, bool $includeDetails = false): array
    {
        $response = [
            'id' => $pr->id,
            'client_request_id' => $pr->client_request_id,
            'agent_id' => $pr->agent_id,
            'customer_name' => $pr->customer_name,
            'date_of_birth' => $pr->date_of_birth?->format('Y-m-d'),
            'destination' => $pr->destination,
            'trip_start' => $pr->trip_start?->format('Y-m-d'),
            'trip_end' => $pr->trip_end?->format('Y-m-d'),
            'plan_code' => $pr->plan_code,
            'sum_insured' => $pr->sum_insured,
            'premium' => $pr->premium,
            'travel_days' => $pr->travel_days,
            'status' => $pr->status,
            'policy_number' => $pr->policy_number,
            'provider_reference' => $pr->provider_reference,
            'issuance_attempts_count' => $pr->issuance_attempts_count,
            'created_at' => $pr->created_at?->toISOString(),
            'updated_at' => $pr->updated_at?->toISOString(),
        ];

        if ($includeDetails) {
            $response['last_provider_response'] = $pr->last_provider_response
                ? json_decode($pr->last_provider_response, true)
                : null;
            $response['mock_scenario'] = $pr->mock_scenario;
            $response['state_history'] = $pr->stateHistory->map(function ($h) {
                return [
                    'from_state' => $h->from_state,
                    'to_state' => $h->to_state,
                    'reason' => $h->reason,
                    'transitioned_at' => $h->transitioned_at?->toISOString(),
                ];
            });
            $response['issuance_attempts'] = $pr->issuanceAttempts->map(function ($a) {
                return [
                    'attempt_number' => $a->attempt_number,
                    'provider_reference' => $a->provider_reference,
                    'scenario' => $a->scenario,
                    'outcome' => $a->outcome,
                    'error_message' => $a->error_message,
                    'created_at' => $a->created_at?->toISOString(),
                ];
            });
        }

        return $response;
    }

    /**
     * Check if a QueryException is a duplicate key violation.
     */
    private function isDuplicateKeyError(QueryException $e): bool
    {
        // SQLite: UNIQUE constraint failed
        // MySQL: Duplicate entry (error code 23000)
        $code = $e->getCode();
        return $code === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint failed');
    }
}
