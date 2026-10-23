<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PolicyRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_request_id',
        'agent_id',
        'customer_name',
        'date_of_birth',
        'destination',
        'trip_start',
        'trip_end',
        'plan_code',
        'sum_insured',
        'premium',
        'travel_days',
        'status',
        'policy_number',
        'provider_reference',
        'issuance_attempts_count',
        'last_provider_response',
        'mock_scenario',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'trip_start' => 'date',
        'trip_end' => 'date',
        'premium' => 'decimal:2',
        'sum_insured' => 'decimal:2',
    ];

    /**
     * Get all issuance attempts for this policy request.
     */
    public function issuanceAttempts(): HasMany
    {
        return $this->hasMany(IssuanceAttempt::class);
    }

    /**
     * Get all provider events for this policy request.
     */
    public function providerEvents(): HasMany
    {
        return $this->hasMany(ProviderEvent::class);
    }

    /**
     * Get the state transition history for this policy request.
     */
    public function stateHistory(): HasMany
    {
        return $this->hasMany(PolicyStateHistory::class)->orderBy('transitioned_at', 'asc');
    }
}
