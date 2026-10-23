<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('issuance_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('policy_request_id')->constrained('policy_requests')->onDelete('cascade');

            $table->integer('attempt_number');
            $table->string('provider_reference')->nullable();
            $table->string('scenario')->nullable(); // Which mock scenario was used
            $table->enum('outcome', ['SUCCESS', 'FAILURE', 'TIMEOUT', 'PENDING'])->default('PENDING');
            $table->text('response_payload')->nullable(); // Raw provider response
            $table->text('error_message')->nullable();

            $table->timestamps();

            $table->index('policy_request_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('issuance_attempts');
    }
};
