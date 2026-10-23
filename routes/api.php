<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PolicyRequestController;
use App\Http\Controllers\Api\MockInsurerCallbackController;

/*
|--------------------------------------------------------------------------
| PolicyFlow API Routes
|--------------------------------------------------------------------------
|
| These routes handle the policy request lifecycle:
| - Intake (create/list/show)
| - Issuance (submit to mock insurer)
| - Reconciliation (check provider status)
| - Mock insurer callbacks
|
*/

// Dashboard stats
Route::get('/dashboard/stats', [PolicyRequestController::class, 'dashboardStats']);

// Policy Requests CRUD
Route::get('/policy-requests', [PolicyRequestController::class, 'index']);
Route::post('/policy-requests', [PolicyRequestController::class, 'store']);
Route::get('/policy-requests/{id}', [PolicyRequestController::class, 'show']);

// Issuance workflow
Route::post('/policy-requests/{id}/submit', [PolicyRequestController::class, 'submit']);
Route::post('/policy-requests/{id}/reconcile', [PolicyRequestController::class, 'reconcile']);

// Mock insurer callback
Route::post('/mock-insurer/callback', [MockInsurerCallbackController::class, 'handleCallback']);
