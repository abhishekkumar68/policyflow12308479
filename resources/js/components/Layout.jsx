import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Search, Plus, Bell, Shield, ChevronRight } from 'lucide-react';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();

    // Map path to friendly breadcrumb
    const getBreadcrumb = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        if (path === '/requests') return 'Policy Requests';
        if (path === '/create') return 'Create Policy Request';
        if (path.startsWith('/requests/')) return `Policy Details`;
        return 'Overview';
    };

    return (
        <div className="flex min-h-screen bg-[#f8fafc]">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                            <Shield className="h-3.5 w-3.5 text-teal-600" />
                            Trippers Shield
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-800 font-medium">{getBreadcrumb()}</span>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-4">
                        {/* Search Input */}
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search requests, policies, customers..."
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        navigate(`/requests?search=${encodeURIComponent(e.target.value.trim())}`);
                                    }
                                }}
                            />
                        </div>

                        {/* New Request Button */}
                        <Link
                            to="/create"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span>New Request</span>
                        </Link>

                        {/* Bell Icon */}
                        <button 
                            type="button" 
                            className="relative p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Notifications"
                        >
                            <Bell className="h-4 w-4" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
                        </button>

                        {/* User Avatar */}
                        <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-2 ring-teal-500/20">
                            NS
                        </div>
                    </div>
                </header>

                {/* Body Content */}
                <main className="flex-1 p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
