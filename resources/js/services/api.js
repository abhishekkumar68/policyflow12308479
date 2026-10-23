import axios from 'axios';

/**
 * Centralized API client for PolicyFlow.
 * All API calls go through this module.
 */
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');

// Policy Requests
export const getPolicyRequests = (params = {}) => api.get('/policy-requests', { params });
export const getPolicyRequest = (id) => api.get(`/policy-requests/${id}`);
export const createPolicyRequest = (data) => api.post('/policy-requests', data);

// Issuance
export const submitForIssuance = (id) => api.post(`/policy-requests/${id}/submit`);
export const reconcileRequest = (id) => api.post(`/policy-requests/${id}/reconcile`);

// Mock Insurer Callback
export const sendMockCallback = (data) => api.post('/mock-insurer/callback', data);

export default api;
