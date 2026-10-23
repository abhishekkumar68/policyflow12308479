<?php

namespace Tests\Feature;

use Tests\TestCase;

class FrontendTest extends TestCase
{
    /**
     * Test that the SPA entry point loads successfully.
     */
    public function test_spa_entry_point_returns_ok(): void
    {
        $response = $this->get('/');
        $response->assertStatus(200);
        $response->assertSee('PolicyFlow');
        $response->assertSee('root');
    }

    /**
     * Test deep link routes return the SPA blade template.
     */
    public function test_deep_links_return_spa(): void
    {
        $response = $this->get('/requests');
        $response->assertStatus(200);

        $response = $this->get('/create');
        $response->assertStatus(200);

        $response = $this->get('/requests/1');
        $response->assertStatus(200);
    }
}
