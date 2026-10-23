<?php

use Illuminate\Support\Facades\Route;

// All frontend routes handled by React SPA
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
