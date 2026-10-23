<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PolicyRequest;
use App\Models\PolicyStateHistory;
use App\Services\PremiumCalculationService;

class PolicyRequestSeeder extends Seeder
{
    /**
     * Seed fictional policy requests for development.
     * Uses the same sample data visible in the UI design screenshots.
     */
    public function run(): void
    {
        $premiumService = new PremiumCalculationService();

        $requests = [
            [
                'client_request_id' => 'CR-2024-9842',
                'agent_id' => 'AGT-4092',
                'customer_name' => 'Ananya Iyer',
                'date_of_birth' => '1992-08-14',
                'destination' => 'DOMESTIC',
                'trip_start' => '2026-11-01',
                'trip_end' => '2026-11-15',
                'plan_code' => 'PLUS',
                'sum_insured' => 300000,
                'status' => 'ISSUED',
                'policy_number' => 'POL-TS-ABCDE12345',
                'provider_reference' => 'PROV-ABC12345',
            ],
            [
                'client_request_id' => 'CR-2024-9841',
                'agent_id' => 'AGT-4092',
                'customer_name' => 'Vikram Malhotra',
                'date_of_birth' => '1985-11-03',
                'destination' => 'INTERNATIONAL',
                'trip_start' => '2026-11-01',
                'trip_end' => '2026-11-15',
                'plan_code' => 'PREMIUM',
                'sum_insured' => 500000,
                'status' => 'PENDING_CONFIRMATION',
                'mock_scenario' => 'TIMEOUT_AFTER_ISSUE',
            ],
            [
                'client_request_id' => 'CR-2024-9840',
                'agent_id' => 'AGT-4092',
                'customer_name' => 'Pooja Verma',
                'date_of_birth' => '1999-02-27',
                'destination' => 'DOMESTIC',
                'trip_start' => '2026-11-10',
                'trip_end' => '2026-11-18',
                'plan_code' => 'BASIC',
                'sum_insured' => 100000,
                'status' => 'FAILED',
            ],
            [
                'client_request_id' => 'CR-2024-9839',
                'agent_id' => 'AGT-4092',
                'customer_name' => 'Rajesh Patel',
                'date_of_birth' => '1978-06-19',
                'destination' => 'INTERNATIONAL',
                'trip_start' => '2026-11-05',
                'trip_end' => '2026-11-20',
                'plan_code' => 'PLUS',
                'sum_insured' => 300000,
                'status' => 'NEEDS_RECONCILIATION',
            ],
            [
                'client_request_id' => 'CR-2024-9838',
                'agent_id' => 'AGT-4092',
                'customer_name' => 'Meera Nair',
                'date_of_birth' => '2001-01-12',
                'destination' => 'DOMESTIC',
                'trip_start' => '2026-11-01',
                'trip_end' => '2026-11-06',
                'plan_code' => 'BASIC',
                'sum_insured' => 100000,
                'status' => 'VALIDATED',
            ],
        ];

        foreach ($requests as $data) {
            // Calculate the premium
            $premiumResult = $premiumService->calculate(
                $data['plan_code'],
                $data['trip_start'],
                $data['trip_end'],
                $data['date_of_birth'],
                $data['destination'],
                $data['sum_insured']
            );

            $pr = PolicyRequest::create([
                'client_request_id' => $data['client_request_id'],
                'agent_id' => $data['agent_id'],
                'customer_name' => $data['customer_name'],
                'date_of_birth' => $data['date_of_birth'],
                'destination' => $data['destination'],
                'trip_start' => $data['trip_start'],
                'trip_end' => $data['trip_end'],
                'plan_code' => $data['plan_code'],
                'sum_insured' => $data['sum_insured'],
                'premium' => $premiumResult['premium'],
                'travel_days' => $premiumResult['travel_days'],
                'status' => $data['status'],
                'policy_number' => $data['policy_number'] ?? null,
                'provider_reference' => $data['provider_reference'] ?? null,
                'mock_scenario' => $data['mock_scenario'] ?? null,
            ]);

            // Create state history for seeded data
            PolicyStateHistory::create([
                'policy_request_id' => $pr->id,
                'from_state' => null,
                'to_state' => 'RECEIVED',
                'reason' => 'Policy request created (seeded)',
                'transitioned_at' => now()->subHours(rand(1, 48)),
            ]);

            if (in_array($data['status'], ['VALIDATED', 'SUBMITTED', 'PENDING_CONFIRMATION', 'ISSUED', 'FAILED', 'NEEDS_RECONCILIATION'])) {
                PolicyStateHistory::create([
                    'policy_request_id' => $pr->id,
                    'from_state' => 'RECEIVED',
                    'to_state' => 'VALIDATED',
                    'reason' => 'Auto-validated (seeded)',
                    'transitioned_at' => now()->subHours(rand(1, 24)),
                ]);
            }

            if (in_array($data['status'], ['SUBMITTED', 'PENDING_CONFIRMATION', 'ISSUED', 'FAILED', 'NEEDS_RECONCILIATION'])) {
                PolicyStateHistory::create([
                    'policy_request_id' => $pr->id,
                    'from_state' => 'VALIDATED',
                    'to_state' => 'SUBMITTED',
                    'reason' => 'Submitted to insurer (seeded)',
                    'transitioned_at' => now()->subHours(rand(1, 12)),
                ]);
            }

            if ($data['status'] !== 'RECEIVED' && $data['status'] !== 'VALIDATED' && $data['status'] !== 'SUBMITTED') {
                PolicyStateHistory::create([
                    'policy_request_id' => $pr->id,
                    'from_state' => 'SUBMITTED',
                    'to_state' => $data['status'],
                    'reason' => "Reached {$data['status']} (seeded)",
                    'transitioned_at' => now()->subMinutes(rand(1, 60)),
                ]);
            }
        }
    }
}
