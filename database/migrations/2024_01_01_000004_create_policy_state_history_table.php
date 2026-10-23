<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('policy_state_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('policy_request_id')->constrained('policy_requests')->onDelete('cascade');

            $table->string('from_state')->nullable(); // null for initial state
            $table->string('to_state');
            $table->string('reason')->nullable(); // Why this transition happened
            $table->text('metadata')->nullable(); // Additional context (JSON)

            $table->timestamp('transitioned_at');

            $table->index('policy_request_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_state_history');
    }
};
