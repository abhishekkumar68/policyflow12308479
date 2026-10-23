<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class CreatePolicyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // No auth required per assignment
    }

    public function rules(): array
    {
        return [
            'client_request_id' => 'required|string|max:255',
            'agent_id'          => 'required|string|max:255',
            'customer_name'     => 'required|string|max:255',
            'date_of_birth'     => 'required|date|before:today',
            'destination'       => 'required|string|in:DOMESTIC,INTERNATIONAL',
            'trip_start'        => 'required|date|after_or_equal:today',
            'trip_end'          => 'required|date|after_or_equal:trip_start',
            'plan_code'         => 'required|string|in:BASIC,PLUS,PREMIUM',
            'sum_insured'       => 'required|numeric|in:100000,300000,500000',
            'mock_scenario'     => 'nullable|string|in:SUCCESS,TEMPORARY_FAILURE,TIMEOUT_AFTER_ISSUE,DELAYED_CALLBACK,DUPLICATE_CALLBACK',
        ];
    }

    public function messages(): array
    {
        return [
            'destination.in'  => 'Destination must be DOMESTIC or INTERNATIONAL.',
            'plan_code.in'    => 'Plan code must be BASIC, PLUS, or PREMIUM.',
            'sum_insured.in'  => 'Sum insured must be 100000, 300000, or 500000.',
            'trip_end.after_or_equal' => 'Trip end date must be on or after the trip start date.',
            'date_of_birth.before'    => 'Date of birth must be in the past.',
        ];
    }

    /**
     * Return JSON validation errors (not redirect) for API requests.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422)
        );
    }
}
