<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('provider_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('policy_request_id')->constrained('policy_requests')->onDelete('cascade');

            // Provider event ID must be unique to prevent duplicate processing
            $table->string('provider_event_id')->unique();

            $table->string('event_type'); // e.g. 'policy_issued', 'policy_failed'
            $table->text('payload')->nullable();
            $table->boolean('processed')->default(false);

            $table->timestamps();

            $table->index('policy_request_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('provider_events');
    }
};
