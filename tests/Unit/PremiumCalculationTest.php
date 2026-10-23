<?php

namespace Tests\Unit;

use App\Services\PremiumCalculationService;
use PHPUnit\Framework\TestCase;
use InvalidArgumentException;

/**
 * Unit tests for the PremiumCalculationService.
 * Tests the exact pricing rules from the assignment.
 */
class PremiumCalculationTest extends TestCase
{
    private PremiumCalculationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PremiumCalculationService();
    }

    /**
     * Test the official assignment example:
     * PLUS plan, 5 travel days, age 18-60 (1.00), INTERNATIONAL (1.80), ₹300,000 (1.25)
     * Expected: 20 × 5 × 1.00 × 1.80 × 1.25 = ₹225.00
     */
    public function test_assignment_example_premium(): void
    {
        $result = $this->service->calculate(
            'PLUS',
            '2026-11-10',
            '2026-11-14',
            '1998-04-10',    // Age ~28 on trip start → multiplier 1.00
            'INTERNATIONAL',
            300000
        );

        $this->assertEquals('225.00', $result['premium']);
        $this->assertEquals(5, $result['travel_days']);
        $this->assertEquals('1.00', $result['breakdown']['age_multiplier']);
        $this->assertEquals('1.80', $result['breakdown']['destination_multiplier']);
        $this->assertEquals('1.25', $result['breakdown']['coverage_multiplier']);
    }

    /**
     * Test BASIC plan with DOMESTIC destination and ₹100,000 coverage.
     * 1 day, age 25 → 12 × 1 × 1.00 × 1.00 × 1.00 = ₹12.00
     */
    public function test_basic_domestic_minimum(): void
    {
        $result = $this->service->calculate(
            'BASIC',
            '2026-12-01',
            '2026-12-01',
            '2001-01-01',
            'DOMESTIC',
            100000
        );

        $this->assertEquals('12.00', $result['premium']);
        $this->assertEquals(1, $result['travel_days']);
    }

    /**
     * Test PREMIUM plan with all maximum multipliers.
     * 10 days, age 75 (2.00), INTERNATIONAL (1.80), ₹500,000 (1.50)
     * 30 × 10 × 2.00 × 1.80 × 1.50 = ₹1620.00
     */
    public function test_premium_maximum_multipliers(): void
    {
        $result = $this->service->calculate(
            'PREMIUM',
            '2026-11-01',
            '2026-11-10',
            '1951-06-15',    // Age 75 on trip start → multiplier 2.00
            'INTERNATIONAL',
            500000
        );

        $this->assertEquals('1620.00', $result['premium']);
        $this->assertEquals(10, $result['travel_days']);
        $this->assertEquals('2.00', $result['breakdown']['age_multiplier']);
    }

    /**
     * Test age boundary: age exactly 17 → multiplier 1.10
     */
    public function test_age_boundary_17(): void
    {
        $result = $this->service->calculate(
            'BASIC',
            '2026-11-01',
            '2026-11-01',
            '2009-11-02',    // Will be 16 on 2026-11-01 → 0-17 bracket
            'DOMESTIC',
            100000
        );

        $this->assertEquals('1.10', $result['breakdown']['age_multiplier']);
        // 12 × 1 × 1.10 × 1.00 × 1.00 = 13.20
        $this->assertEquals('13.20', $result['premium']);
    }

    /**
     * Test age boundary: age exactly 18 → multiplier 1.00
     */
    public function test_age_boundary_18(): void
    {
        $result = $this->service->calculate(
            'BASIC',
            '2026-11-01',
            '2026-11-01',
            '2008-11-01',    // Exactly 18 on trip start
            'DOMESTIC',
            100000
        );

        $this->assertEquals('1.00', $result['breakdown']['age_multiplier']);
        $this->assertEquals('12.00', $result['premium']);
    }

    /**
     * Test age boundary: age exactly 60 → multiplier 1.00
     */
    public function test_age_boundary_60(): void
    {
        $result = $this->service->calculate(
            'BASIC',
            '2026-11-01',
            '2026-11-01',
            '1966-11-01',    // Exactly 60 on trip start
            'DOMESTIC',
            100000
        );

        $this->assertEquals('1.00', $result['breakdown']['age_multiplier']);
    }

    /**
     * Test age boundary: age exactly 61 → multiplier 1.50
     */
    public function test_age_boundary_61(): void
    {
        $result = $this->service->calculate(
            'BASIC',
            '2026-11-01',
            '2026-11-01',
            '1965-10-31',    // Will be 61 on 2026-11-01
            'DOMESTIC',
            100000
        );

        $this->assertEquals('1.50', $result['breakdown']['age_multiplier']);
        // 12 × 1 × 1.50 × 1.00 × 1.00 = 18.00
        $this->assertEquals('18.00', $result['premium']);
    }

    /**
     * Test age boundary: age exactly 70 → multiplier 1.50
     */
    public function test_age_boundary_70(): void
    {
        $result = $this->service->calculate(
            'BASIC',
            '2026-11-01',
            '2026-11-01',
            '1956-11-01',    // Exactly 70 on trip start
            'DOMESTIC',
            100000
        );

        $this->assertEquals('1.50', $result['breakdown']['age_multiplier']);
    }

    /**
     * Test age boundary: age exactly 71 → multiplier 2.00
     */
    public function test_age_boundary_71(): void
    {
        $result = $this->service->calculate(
            'BASIC',
            '2026-11-01',
            '2026-11-01',
            '1955-10-31',    // Will be 71 on 2026-11-01
            'DOMESTIC',
            100000
        );

        $this->assertEquals('2.00', $result['breakdown']['age_multiplier']);
        // 12 × 1 × 2.00 × 1.00 × 1.00 = 24.00
        $this->assertEquals('24.00', $result['premium']);
    }

    /**
     * Test inclusive travel days calculation.
     * Same start and end = 1 day.
     */
    public function test_same_day_trip_is_one_day(): void
    {
        $days = $this->service->calculateTravelDays('2026-11-01', '2026-11-01');
        $this->assertEquals(1, $days);
    }

    /**
     * Test inclusive travel days: Nov 10 to Nov 14 = 5 days.
     */
    public function test_five_day_trip(): void
    {
        $days = $this->service->calculateTravelDays('2026-11-10', '2026-11-14');
        $this->assertEquals(5, $days);
    }

    /**
     * Test all three plan codes produce different base rates.
     */
    public function test_all_plan_codes(): void
    {
        // Same inputs except plan_code
        $basic = $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 100000);
        $plus = $this->service->calculate('PLUS', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 100000);
        $premium = $this->service->calculate('PREMIUM', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 100000);

        $this->assertEquals('12.00', $basic['premium']);  // 12 × 1 × 1.00 × 1.00 × 1.00
        $this->assertEquals('20.00', $plus['premium']);   // 20 × 1 × 1.00 × 1.00 × 1.00
        $this->assertEquals('30.00', $premium['premium']); // 30 × 1 × 1.00 × 1.00 × 1.00
    }

    /**
     * Test INTERNATIONAL destination multiplier.
     */
    public function test_international_destination(): void
    {
        $domestic = $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 100000);
        $international = $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'INTERNATIONAL', 100000);

        // International should be 1.80x domestic
        $this->assertEquals('12.00', $domestic['premium']);
        $this->assertEquals('21.60', $international['premium']); // 12 × 1.80
    }

    /**
     * Test all coverage multipliers.
     */
    public function test_all_coverage_multipliers(): void
    {
        $c100k = $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 100000);
        $c300k = $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 300000);
        $c500k = $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 500000);

        $this->assertEquals('12.00', $c100k['premium']); // 12 × 1.00
        $this->assertEquals('15.00', $c300k['premium']); // 12 × 1.25
        $this->assertEquals('18.00', $c500k['premium']); // 12 × 1.50
    }

    /**
     * Test unsupported plan code throws exception.
     */
    public function test_unsupported_plan_code_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->calculate('GOLD', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 100000);
    }

    /**
     * Test unsupported destination throws exception.
     */
    public function test_unsupported_destination_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'EUROPE', 100000);
    }

    /**
     * Test unsupported sum insured throws exception.
     */
    public function test_unsupported_sum_insured_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->calculate('BASIC', '2026-12-01', '2026-12-01', '2000-01-01', 'DOMESTIC', 200000);
    }
}
