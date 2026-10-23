import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { 
    FileText, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    Plus, 
    SlidersHorizontal,
    Plane,
    Globe,
    ShieldCheck,
    ArrowRight,
    Loader2
} from 'lucide-react';

export default function Dashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({
        total_requests: 0,
        issued: 0,
        pending_confirmation: 0,
        failed: 0,
        received: 0,
        validated: 0,
        submitted: 0,
        needs_reconciliation: 0,
    });
    const [recentRequests, setRecentRequests] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await getDashboardStats();
            if (response.data && response.data.success) {
                setStats(response.data.stats);
                setRecentRequests(response.data.recent_requests || []);
            }
        } catch (err) {
            console.error('Failed to load dashboard stats:', err);
            setError('Could not connect to PolicyFlow API. Please ensure the backend server is running.');
        } finally {
            setLoading(false);
        }
    };

    const total = stats.total_requests || 0;

    const calcPercentage = (count) => {
        if (!total || total <= 0) return '0.0';
        return ((count / total) * 100).toFixed(1);
    };

    // All distinct lifecycle states mapping to reconcile with total requests
    const statusBreakdown = [
        { key: 'issued', label: 'Issued', count: stats.issued || 0, color: 'bg-emerald-500' },
        { key: 'pending_confirmation', label: 'Pending', count: stats.pending_confirmation || 0, color: 'bg-sky-500' },
        { key: 'needs_reconciliation', label: 'Needs Recon', count: stats.needs_reconciliation || 0, color: 'bg-amber-500' },
        { key: 'failed', label: 'Failed', count: stats.failed || 0, color: 'bg-rose-500' },
        { key: 'validated', label: 'Validated', count: stats.validated || 0, color: 'bg-blue-500' },
        { key: 'submitted', label: 'Submitted', count: stats.submitted || 0, color: 'bg-indigo-500' },
        { key: 'received', label: 'Received', count: stats.received || 0, color: 'bg-slate-400' },
    ];

    // Filter to states that currently have records, but always show Issued, Pending, Needs Recon, Failed, Validated if empty
    const visibleBreakdown = statusBreakdown.filter(item => item.count > 0 || ['issued', 'pending_confirmation', 'needs_reconciliation', 'failed', 'validated'].includes(item.key));

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Top Banner and Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-teal-600 tracking-wider uppercase mb-1">
                        <span>Triage &amp; Verification</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Live Ingestion Pipeline
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Policy Operations Dashboard</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Monitor policy requests, issuance status, and reconciliation alerts across active distribution channels.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button 
                        type="button"
                        onClick={() => navigate('/requests')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                        <span>Filter View</span>
                    </button>
                    <Link
                        to="/create"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        <span>New Policy Request</span>
                    </Link>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {error}
                </div>
            )}

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Requests */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Requests</span>
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                            <FileText className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                            {loading ? '-' : stats.total_requests.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">All time ingested</div>
                    </div>
                </div>

                {/* Issued */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issued</span>
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                            {loading ? '-' : stats.issued.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                            {calcPercentage(stats.issued)}% success rate
                        </div>
                    </div>
                </div>

                {/* Pending Confirmation */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Confirmation</span>
                        <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                            <Clock className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                            {loading ? '-' : stats.pending_confirmation.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-sky-600 font-medium mt-1">Awaiting provider callback</div>
                    </div>
                </div>

                {/* Failed */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Failed</span>
                        <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                            {loading ? '-' : stats.failed.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-rose-600 font-medium mt-1">Needs retry or triage</div>
                    </div>
                </div>
            </div>

            {/* Main Content Split: Recent Table (65%) + Status Summary & Assurance (35%) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Requests Table */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <h2 className="text-sm font-bold text-slate-800">Recent Policy Requests</h2>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                            ACTIVE
                        </span>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-5 py-3">Request ID</th>
                                    <th className="px-5 py-3">Customer</th>
                                    <th className="px-5 py-3">Destination</th>
                                    <th className="px-5 py-3">Plan</th>
                                    <th className="px-5 py-3">Premium (INR)</th>
                                    <th className="px-5 py-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-slate-400">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-teal-600" />
                                            Loading recent requests...
                                        </td>
                                    </tr>
                                ) : recentRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-slate-400">
                                            No policy requests found. Create your first request!
                                        </td>
                                    </tr>
                                ) : (
                                    recentRequests.map((req) => (
                                        <tr 
                                            key={req.id} 
                                            onClick={() => navigate(`/requests/${req.id}`)}
                                            className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                        >
                                            <td className="px-5 py-3.5 font-mono font-medium text-slate-900">
                                                {req.client_request_id || `REQ-${req.id}`}
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-slate-800">
                                                {req.customer_name}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-600">
                                                    {req.destination === 'INTERNATIONAL' ? (
                                                        <Globe className="h-3 w-3 text-indigo-500" />
                                                    ) : (
                                                        <Plane className="h-3 w-3 text-sky-500" />
                                                    )}
                                                    {req.destination === 'INTERNATIONAL' ? 'International' : 'Domestic'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-semibold text-slate-700">
                                                    {req.plan_code}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono font-semibold text-slate-800">
                                                ₹{parseFloat(req.premium).toFixed(2)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <StatusBadge status={req.status} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                        <span>Showing {recentRequests.length} of {stats.total_requests} policy requests</span>
                        <Link 
                            to="/requests"
                            className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                        >
                            <span>View all requests</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>

                {/* Right Side: Reconciled Status Summary & Idempotency Card */}
                <div className="space-y-6">
                    {/* Status Summary Card */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Status Summary</h3>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono">
                                Total: {stats.total_requests}
                            </span>
                        </div>

                        {/* Multi-segment Progress Bar reconciling to 100% */}
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex mb-5">
                            {total > 0 ? (
                                statusBreakdown.map((item) => {
                                    const widthPercent = (item.count / total) * 100;
                                    if (widthPercent <= 0) return null;
                                    return (
                                        <div
                                            key={item.key}
                                            style={{ width: `${widthPercent}%` }}
                                            className={`${item.color} h-full`}
                                            title={`${item.label}: ${item.count} (${widthPercent.toFixed(1)}%)`}
                                        ></div>
                                    );
                                })
                            ) : (
                                <div className="bg-slate-200 h-full w-full"></div>
                            )}
                        </div>

                        {/* Reconciled Breakdown List covering all existing states */}
                        <div className="space-y-2.5 text-xs">
                            {visibleBreakdown.map((item) => (
                                <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${item.color}`}></span>
                                        <span className="font-medium text-slate-700">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-800 font-mono">{item.count}</span>
                                        <span className="text-slate-400 font-mono text-[11px] w-12 text-right">
                                            {calcPercentage(item.count)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Idempotency Assurance Banner */}
                    <div className="bg-gradient-to-br from-teal-50/80 to-emerald-50/50 p-5 rounded-xl border border-teal-200/70">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-teal-100 text-teal-700 shrink-0 mt-0.5">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-teal-900 tracking-tight">Idempotency Assurance</h4>
                                <p className="text-[11px] text-teal-800/80 leading-relaxed mt-1">
                                    PolicyFlow validates duplicate intake and checks provider state before issuing policies, preventing duplicate debits and duplicate policy certificate binding.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
