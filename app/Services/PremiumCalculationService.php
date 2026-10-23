<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * Calculates travel insurance premiums using the assignment's exact pricing rules.
 *
 * Formula: premium = daily_base_rate × travel_days × age_multiplier × destination_multiplier × coverage_multiplier
 *
 * All arithmetic uses bcmath for decimal safety.
 */
class PremiumCalculationService
{
    // Daily base rates by plan code (in INR)
    private const BASE_RATES = [
        'BASIC'   => '12',
        'PLUS'    => '20',
        'PREMIUM' => '30',
    ];

    // Destination multipliers
    private const DESTINATION_MULTIPLIERS = [
        'DOMESTIC'      => '1.00',
        'INTERNATIONAL' => '1.80',
    ];

    // Coverage multipliers by sum_insured value
    private const COVERAGE_MULTIPLIERS = [
        '100000' => '1.00',
        '300000' => '1.25',
        '500000' => '1.50',
    ];

    /**
     * Calculate the premium for a policy request.
     *
     * @param string $planCode      BASIC, PLUS, or PREMIUM
     * @param string $tripStart     Trip start date (Y-m-d)
     * @param string $tripEnd       Trip end date (Y-m-d)
     * @param string $dateOfBirth   Customer date of birth (Y-m-d)
     * @param string $destination   DOMESTIC or INTERNATIONAL
     * @param int|float $sumInsured Coverage amount (100000, 300000, or 500000)
     * @return array ['premium' => string, 'travel_days' => int, 'breakdown' => [...]]
     */
    public function calculate(
        string $planCode,
        string $tripStart,
        string $tripEnd,
        string $dateOfBirth,
        string $destination,
        int|float $sumInsured
    ): array {
        // Validate inputs
        $this->validatePlanCode($planCode);
        $this->validateDestination($destination);
        $this->validateSumInsured($sumInsured);

        // Calculate travel days (inclusive: end - start + 1, minimum 1)
        $travelDays = $this->calculateTravelDays($tripStart, $tripEnd);

        // Calculate age on trip start date
        $age = $this->calculateAge($dateOfBirth, $tripStart);

        // Get multipliers
        $baseRate = self::BASE_RATES[$planCode];
        $ageMultiplier = $this->getAgeMultiplier($age);
        $destinationMultiplier = self::DESTINATION_MULTIPLIERS[$destination];
        $coverageMultiplier = self::COVERAGE_MULTIPLIERS[(string)(int)$sumInsured];

        // Calculate premium using bcmath for decimal safety
        // premium = base_rate × travel_days × age_multiplier × destination_multiplier × coverage_multiplier
        $premium = bcmul($baseRate, (string)$travelDays, 4);
        $premium = bcmul($premium, $ageMultiplier, 4);
        $premium = bcmul($premium, $destinationMultiplier, 4);
        $premium = bcmul($premium, $coverageMultiplier, 4);

        // Round to 2 decimal places
        $premium = $this->roundToTwoDecimals($premium);

        return [
            'premium' => $premium,
            'travel_days' => $travelDays,
            'breakdown' => [
                'base_rate' => $baseRate,
                'travel_days' => $travelDays,
                'age' => $age,
                'age_multiplier' => $ageMultiplier,
                'destination_multiplier' => $destinationMultiplier,
                'coverage_multiplier' => $coverageMultiplier,
            ],
        ];
    }

    /**
     * Calculate inclusive travel days between two dates.
     * Minimum is 1 day (same start and end date).
     */
    public function calculateTravelDays(string $tripStart, string $tripEnd): int
    {
        $start = new \DateTime($tripStart);
        $end = new \DateTime($tripEnd);
        $diff = $start->diff($end)->days;

        return max(1, $diff + 1); // inclusive count
    }

    /**
     * Calculate a person's age in years on a given date.
     */
    public function calculateAge(string $dateOfBirth, string $onDate): int
    {
        $birth = new \DateTime($dateOfBirth);
        $target = new \DateTime($onDate);

        return $birth->diff($target)->y;
    }

    /**
     * Get the age multiplier based on age brackets.
     * 0–17: 1.10, 18–60: 1.00, 61–70: 1.50, 71+: 2.00
     */
    public function getAgeMultiplier(int $age): string
    {
        if ($age <= 17) return '1.10';
        if ($age <= 60) return '1.00';
        if ($age <= 70) return '1.50';
        return '2.00';
    }

    /**
     * Round a bcmath string to exactly 2 decimal places.
     */
    private function roundToTwoDecimals(string $value): string
    {
        // Add 0.005 and truncate to 2 decimals for standard rounding
        // bcmath truncates by default, so we add half a cent first
        $rounded = bcadd($value, '0.005', 2);

        // Edge case: if the 3rd decimal is exactly 5 and the 4th+ are 0,
        // standard bcadd already handles this correctly
        return $rounded;
    }

    private function validatePlanCode(string $planCode): void
    {
        if (!isset(self::BASE_RATES[$planCode])) {
            throw new InvalidArgumentException(
                "Unsupported plan code: {$planCode}. Supported: BASIC, PLUS, PREMIUM"
            );
        }
    }

    private function validateDestination(string $destination): void
    {
        if (!isset(self::DESTINATION_MULTIPLIERS[$destination])) {
            throw new InvalidArgumentException(
                "Unsupported destination: {$destination}. Supported: DOMESTIC, INTERNATIONAL"
            );
        }
    }

    private function validateSumInsured(int|float $sumInsured): void
    {
        $key = (string)(int)$sumInsured;
        if (!isset(self::COVERAGE_MULTIPLIERS[$key])) {
            throw new InvalidArgumentException(
                "Unsupported sum insured: {$sumInsured}. Supported: 100000, 300000, 500000"
            );
        }
    }

    /**
     * Get all supported plan codes.
     */
    public static function supportedPlans(): array
    {
        return array_keys(self::BASE_RATES);
    }

    /**
     * Get all supported destinations.
     */
    public static function supportedDestinations(): array
    {
        return array_keys(self::DESTINATION_MULTIPLIERS);
    }

    /**
     * Get all supported sum insured values.
     */
    public static function supportedSumInsured(): array
    {
        return [100000, 300000, 500000];
    }
}
