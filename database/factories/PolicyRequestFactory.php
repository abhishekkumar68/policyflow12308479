<?php

namespace Database\Factories;

use App\Models\PolicyRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

class PolicyRequestFactory extends Factory
{
    protected $model = PolicyRequest::class;

    public function definition(): array
    {
        $destinations = ['DOMESTIC', 'INTERNATIONAL'];
        $plans = ['BASIC', 'PLUS', 'PREMIUM'];
        $coverages = [100000, 300000, 500000];

        $tripStart = $this->faker->dateTimeBetween('+1 day', '+30 days');
        $tripEnd = (clone $tripStart)->modify('+' . rand(1, 14) . ' days');

        return [
            'client_request_id' => 'CR-' . $this->faker->unique()->numerify('####-####'),
            'agent_id' => 'AGT-' . $this->faker->numerify('####'),
            'customer_name' => $this->faker->name(),
            'date_of_birth' => $this->faker->dateTimeBetween('-70 years', '-18 years')->format('Y-m-d'),
            'destination' => $this->faker->randomElement($destinations),
            'trip_start' => $tripStart->format('Y-m-d'),
            'trip_end' => $tripEnd->format('Y-m-d'),
            'plan_code' => $this->faker->randomElement($plans),
            'sum_insured' => $this->faker->randomElement($coverages),
            'premium' => 0, // Will be calculated
            'travel_days' => 1,
            'status' => 'RECEIVED',
        ];
    }
}
