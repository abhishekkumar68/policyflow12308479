import './bootstrap';
import '../css/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PolicyRequests from './pages/PolicyRequests';
import CreatePolicyRequest from './pages/CreatePolicyRequest';
import PolicyDetails from './pages/PolicyDetails';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="requests" element={<PolicyRequests />} />
                    <Route path="create" element={<CreatePolicyRequest />} />
                    <Route path="requests/:id" element={<PolicyDetails />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
