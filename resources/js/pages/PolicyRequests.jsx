import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getPolicyRequests } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { 
    Search, 
    Plus, 
    Download, 
    RotateCcw, 
    Plane, 
    Globe, 
    ChevronLeft, 
    ChevronRight, 
    Eye,
    Loader2
} from 'lucide-react';

export default function PolicyRequests() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [requests, setRequests] = useState([]);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
        from: 0,
        to: 0,
    });
    const [loading, setLoading] = useState(true);
    const [csvError, setCsvError] = useState(null);

    const activeStatus = searchParams.get('status') || 'ALL';
    const searchQuery = searchParams.get('search') || '';
    const currentPage = parseInt(searchParams.get('page') || '1', 10);

    const [searchInput, setSearchInput] = useState(searchQuery);

    const statusTabs = [
        { key: 'ALL', label: 'All' },
        { key: 'RECEIVED', label: 'Received' },
        { key: 'VALIDATED', label: 'Validated' },
        { key: 'SUBMITTED', label: 'Submitted' },
        { key: 'PENDING_CONFIRMATION', label: 'Pending Confirmation' },
        { key: 'ISSUED', label: 'Issued' },
        { key: 'FAILED', label: 'Failed' },
        { key: 'NEEDS_RECONCILIATION', label: 'Needs Reconciliation' },
    ];

    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    useEffect(() => {
        loadRequests();
    }, [activeStatus, searchQuery, currentPage]);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const params = {
                page: currentPage,
                per_page: 10,
            };
            if (activeStatus && activeStatus !== 'ALL') {
                params.status = activeStatus;
            }
            if (searchQuery) {
                params.search = searchQuery;
            }

            const response = await getPolicyRequests(params);
            if (response.data && response.data.success) {
                setRequests(response.data.data || []);
                if (response.data.pagination) {
                    setPagination(response.data.pagination);
                }
            }
        } catch (err) {
            console.error('Failed to load requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (key) => {
        const next = new URLSearchParams(searchParams);
        if (key === 'ALL') {
            next.delete('status');
        } else {
            next.set('status', key);
        }
        next.set('page', '1');
        setSearchParams(next);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        const next = new URLSearchParams(searchParams);
        if (searchInput.trim()) {
            next.set('search', searchInput.trim());
        } else {
            next.delete('search');
        }
        next.set('page', '1');
        setSearchParams(next);
    };

    const handleReset = () => {
        setSearchInput('');
        setSearchParams({});
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.last_page) {
            const next = new URLSearchParams(searchParams);
            next.set('page', newPage.toString());
            setSearchParams(next);
        }
    };

    const exportToCSV = () => {
        setCsvError(null);
        if (!requests || requests.length === 0) {
            setCsvError('No policy requests available to export for the current filter.');
            setTimeout(() => setCsvError(null), 4000);
            return;
        }

        const headers = ['Request ID', 'Agent ID', 'Customer Name', 'DOB', 'Destination', 'Plan', 'Sum Insured', 'Premium', 'Status', 'Policy Number', 'Created At'];
        const rows = requests.map(r => [
            r.client_request_id || `REQ-${r.id}`,
            r.agent_id || '',
            r.customer_name || '',
            r.date_of_birth || '',
            r.destination || '',
            r.plan_code || '',
            r.sum_insured || '',
            r.premium || '',
            r.status || '',
            r.policy_number || '',
            r.created_at || '',
        ]);

        const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `policyflow-export-${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="text-[11px] font-bold text-teal-600 tracking-wider uppercase mb-1">
                        POLICY LIFE-CYCLE INVENTORY
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Policy Requests</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Search, filter, and inspect travel insurance policy intake records and issuance state history.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={exportToCSV}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                        title="Export current table view to CSV"
                    >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>Export CSV</span>
                    </button>
                    <Link
                        to="/create"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Create Request</span>
                    </Link>
                </div>
            </div>

            {csvError && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between shadow-xs">
                    <span>{csvError}</span>
                    <button type="button" onClick={() => setCsvError(null)} className="text-amber-700 font-bold ml-2">&times;</button>
                </div>
            )}

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
                {/* Search Row */}
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by Request ID or Customer Name..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
                            Showing <strong className="text-slate-800">{requests.length}</strong> of {pagination.total} requests
                        </span>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset</span>
                        </button>
                    </div>
                </form>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-3">
                    {statusTabs.map((tab) => {
                        const isSelected = activeStatus === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => handleTabChange(tab.key)}
                                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                    isSelected
                                        ? 'bg-slate-900 text-white font-semibold shadow-xs'
                                        : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="px-5 py-3.5">Request ID</th>
                                <th className="px-5 py-3.5">Customer &amp; Contact</th>
                                <th className="px-5 py-3.5">Destination</th>
                                <th className="px-5 py-3.5">Plan</th>
                                <th className="px-5 py-3.5">Premium</th>
                                <th className="px-5 py-3.5">Lifecycle Status</th>
                                <th className="px-5 py-3.5">Last Updated</th>
                                <th className="px-5 py-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="py-16 text-center text-slate-400">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-600" />
                                        Filtering policy requests...
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-16 text-center text-slate-400">
                                        No policy requests match your active filters.
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => (
                                    <tr
                                        key={req.id}
                                        onClick={() => navigate(`/requests/${req.id}`)}
                                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 rounded-full ${
                                                    req.status === 'ISSUED' ? 'bg-emerald-500' :
                                                    req.status === 'FAILED' ? 'bg-rose-500' :
                                                    req.status === 'PENDING_CONFIRMATION' ? 'bg-sky-500' :
                                                    req.status === 'NEEDS_RECONCILIATION' ? 'bg-amber-500' :
                                                    'bg-blue-500'
                                                }`}></span>
                                                <span className="font-mono font-semibold text-slate-900">
                                                    {req.client_request_id || `REQ-${req.id}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="font-semibold text-slate-900">{req.customer_name}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                DOB: {req.date_of_birth} • Agent: {req.agent_id}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-700">
                                                {req.destination === 'INTERNATIONAL' ? (
                                                    <Globe className="h-3 w-3 text-indigo-500" />
                                                ) : (
                                                    <Plane className="h-3 w-3 text-sky-500" />
                                                )}
                                                {req.destination}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[11px] text-slate-700">
                                                {req.plan_code}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 font-mono font-bold text-slate-900">
                                            ₹{parseFloat(req.premium).toFixed(2)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <StatusBadge status={req.status} />
                                        </td>
                                        <td className="px-5 py-4 text-[11px] text-slate-500 font-mono">
                                            {req.updated_at ? new Date(req.updated_at).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '-'}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/requests/${req.id}`);
                                                }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 group-hover:bg-teal-600 group-hover:text-white font-semibold text-xs transition-colors"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                <span>View</span>
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div>
                        Showing <strong>{pagination.from || 0}</strong> to <strong>{pagination.to || 0}</strong> of <strong>{pagination.total}</strong> entries
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => handlePageChange(pagination.current_page - 1)}
                            disabled={pagination.current_page <= 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map((page) => {
                            if (
                                page === 1 || 
                                page === pagination.last_page || 
                                (page >= pagination.current_page - 1 && page <= pagination.current_page + 1)
                            ) {
                                return (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => handlePageChange(page)}
                                        className={`h-8 w-8 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                                            pagination.current_page === page
                                                ? 'bg-[#0f766e] text-white'
                                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                );
                            } else if (
                                page === pagination.current_page - 2 || 
                                page === pagination.current_page + 2
                            ) {
                                return <span key={page} className="px-1 text-slate-400">...</span>;
                            }
                            return null;
                        })}

                        <button
                            type="button"
                            onClick={() => handlePageChange(pagination.current_page + 1)}
                            disabled={pagination.current_page >= pagination.last_page}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
