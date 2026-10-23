<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderEvent extends Model
{
    protected $fillable = [
        'policy_request_id',
        'provider_event_id',
        'event_type',
        'payload',
        'processed',
    ];

    protected $casts = [
        'processed' => 'boolean',
    ];

    /**
     * Get the policy request this event belongs to.
     */
    public function policyRequest(): BelongsTo
    {
        return $this->belongsTo(PolicyRequest::class);
    }
}
