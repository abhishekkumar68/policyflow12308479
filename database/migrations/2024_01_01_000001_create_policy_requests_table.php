<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('policy_requests', function (Blueprint $table) {
            $table->id();

            // Idempotency key: agent_id + client_request_id must be unique
            $table->string('client_request_id');
            $table->string('agent_id');

            // Customer details
            $table->string('customer_name');
            $table->date('date_of_birth');

            // Trip details
            $table->enum('destination', ['DOMESTIC', 'INTERNATIONAL']);
            $table->date('trip_start');
            $table->date('trip_end');

            // Insurance plan
            $table->enum('plan_code', ['BASIC', 'PLUS', 'PREMIUM']);
            $table->decimal('sum_insured', 12, 2); // e.g. 100000.00, 300000.00, 500000.00

            // Calculated premium — immutable snapshot
            $table->decimal('premium', 10, 2);
            $table->integer('travel_days');

            // Workflow state
            $table->enum('status', [
                'RECEIVED',
                'VALIDATED',
                'SUBMITTED',
                'PENDING_CONFIRMATION',
                'ISSUED',
                'FAILED',
                'NEEDS_RECONCILIATION',
            ])->default('RECEIVED');

            // Issuance details
            $table->string('policy_number')->nullable()->unique();
            $table->string('provider_reference')->nullable();
            $table->integer('issuance_attempts_count')->default(0);
            $table->text('last_provider_response')->nullable();

            // Mock insurer scenario (dev-only)
            $table->string('mock_scenario')->nullable();

            $table->timestamps();

            // Enforce uniqueness: same agent + same client request = same logical request
            $table->unique(['agent_id', 'client_request_id'], 'unique_agent_client_request');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_requests');
    }
};
