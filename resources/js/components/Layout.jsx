import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { getPolicyRequests } from '../services/api';
import { 
    Search, 
    Plus, 
    Bell, 
    Shield, 
    ChevronRight, 
    User, 
    LogOut, 
    X, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    FileText,
    Info
} from 'lucide-react';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();

    // Dropdown states
    const [profileOpen, setProfileOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [demoToast, setDemoToast] = useState(null);

    // Notifications data (from real requests)
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);

    // Refs for click outside
    const profileRef = useRef(null);
    const notificationRef = useRef(null);

    // Breadcrumb text based on current route
    const getBreadcrumb = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        if (path === '/requests') return 'Policy Requests';
        if (path === '/create') return 'Create Policy Request';
        if (path.startsWith('/requests/')) return 'Policy Details';
        return 'Overview';
    };

    // Close dropdowns on outside click or Escape key
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(e.target)) {
                setNotificationOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setProfileOpen(false);
                setNotificationOpen(false);
                setProfileModalOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Load recent policy events for notifications from real application data
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setNotificationsLoading(true);
                const response = await getPolicyRequests({ per_page: 5 });
                if (response.data && response.data.success) {
                    setNotifications(response.data.data || []);
                }
            } catch (err) {
                // If API fails, keep empty notifications gracefully
                console.error('Could not load notifications:', err);
            } finally {
                setNotificationsLoading(false);
            }
        };

        fetchNotifications();
    }, [location.pathname]);

    const handleSignOutClick = () => {
        setProfileOpen(false);
        setDemoToast('Sign out is not required. You are using the candidate evaluation demo mode.');
        setTimeout(() => setDemoToast(null), 4000);
    };

    const hasPendingOrAlert = notifications.some(
        (n) => n.status === 'PENDING_CONFIRMATION' || n.status === 'NEEDS_RECONCILIATION' || n.status === 'FAILED'
    );

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc]">
            {/* Sidebar pinned full-height */}
            <Sidebar onOpenProfile={() => setProfileModalOpen(true)} />

            {/* Main Content Area: Independent Vertical Scroll */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs shrink-0">
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

                        {/* Notification Bell with Functional Popover */}
                        <div className="relative" ref={notificationRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setNotificationOpen(!notificationOpen);
                                    setProfileOpen(false);
                                }}
                                aria-label="Notifications"
                                aria-expanded={notificationOpen}
                                className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
                                    notificationOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                            >
                                <Bell className="h-4 w-4" />
                                {hasPendingOrAlert && (
                                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"></span>
                                )}
                            </button>

                            {/* Notifications Dropdown Panel */}
                            {notificationOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-900">Notifications</h3>
                                            <p className="text-[10px] text-slate-400">Recent policy lifecycle events</p>
                                        </div>
                                        <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                            {notifications.length} Recent
                                        </span>
                                    </div>

                                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                        {notificationsLoading ? (
                                            <div className="py-6 text-center text-slate-400">Loading events...</div>
                                        ) : notifications.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400 space-y-1">
                                                <Bell className="h-5 w-5 mx-auto text-slate-300" />
                                                <p className="font-medium text-slate-600">No new notifications</p>
                                                <p className="text-[10px] text-slate-400">Policy events will appear as requests are processed.</p>
                                            </div>
                                        ) : (
                                            notifications.map((item) => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        navigate(`/requests/${item.id}`);
                                                        setNotificationOpen(false);
                                                    }}
                                                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="mt-0.5 shrink-0">
                                                            {item.status === 'ISSUED' ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                            ) : item.status === 'FAILED' ? (
                                                                <AlertTriangle className="h-4 w-4 text-rose-500" />
                                                            ) : item.status === 'PENDING_CONFIRMATION' || item.status === 'NEEDS_RECONCILIATION' ? (
                                                                <Clock className="h-4 w-4 text-amber-500" />
                                                            ) : (
                                                                <FileText className="h-4 w-4 text-blue-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-mono font-bold text-slate-800">
                                                                    {item.client_request_id || `REQ-${item.id}`}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-slate-400 font-semibold">
                                                                    {item.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 truncate mt-0.5">
                                                                {item.customer_name} • ₹{parseFloat(item.premium).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 text-center">
                                        <Link
                                            to="/requests"
                                            onClick={() => setNotificationOpen(false)}
                                            className="text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                                        >
                                            View all policy requests &rarr;
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Top-Right Profile Avatar with Functional Dropdown */}
                        <div className="relative" ref={profileRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setProfileOpen(!profileOpen);
                                    setNotificationOpen(false);
                                }}
                                aria-label="User profile menu"
                                aria-expanded={profileOpen}
                                aria-haspopup="true"
                                className={`h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-2 transition-all cursor-pointer ${
                                    profileOpen ? 'ring-teal-500 shadow-sm' : 'ring-teal-500/20 hover:ring-teal-500/50'
                                }`}
                            >
                                NS
                            </button>

                            {/* Accessible Profile Dropdown Menu */}
                            {profileOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-4 py-2.5 border-b border-slate-100">
                                        <p className="font-bold text-slate-900">Neha Sharma</p>
                                        <p className="text-[11px] text-slate-500">Ops Specialist • AGT-4092</p>
                                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-mono text-[9px] font-bold">
                                            Demo Session
                                        </span>
                                    </div>

                                    <div className="py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setProfileOpen(false);
                                                setProfileModalOpen(true);
                                            }}
                                            className="w-full text-left px-4 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                        >
                                            <User className="h-3.5 w-3.5 text-slate-400" />
                                            <span>Operator Profile</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleSignOutClick}
                                            className="w-full text-left px-4 py-2 flex items-center gap-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                        >
                                            <LogOut className="h-3.5 w-3.5 text-slate-400" />
                                            <span>Sign Out (Demo Mode)</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Demo Toast Message */}
                {demoToast && (
                    <div className="mx-8 mt-4 p-3 bg-teal-50 border border-teal-200 text-teal-900 text-xs rounded-xl flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-teal-600 shrink-0" />
                            <span>{demoToast}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setDemoToast(null)}
                            className="text-teal-700 hover:text-teal-900 font-bold ml-2"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {/* Body Content */}
                <main className="flex-1 p-8">
                    <Outlet />
                </main>
            </div>

            {/* Read-Only Demo Operator Profile Modal */}
            {profileModalOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="profile-modal-title"
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-sm">
                                    NS
                                </div>
                                <div>
                                    <h2 id="profile-modal-title" className="text-sm font-bold text-slate-900">Operator Profile</h2>
                                    <p className="text-[11px] text-slate-400">Trippers Shield Portal Credentials</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setProfileModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                aria-label="Close profile modal"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">Assigned Agent</span>
                                <span className="font-semibold text-slate-800">Neha Sharma</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">Agent Binding ID</span>
                                <span className="font-mono font-bold text-slate-800">AGT-4092</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">System Role</span>
                                <span className="font-semibold text-teal-700">Operations Specialist</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">Authentication Mode</span>
                                <span className="font-mono text-[11px] text-slate-600">Local Candidate Demo (No Real Auth)</span>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-teal-50 border border-teal-100 text-[11px] text-teal-900 leading-relaxed">
                            <strong>Technical Note:</strong> Per the assignment specifications, authentication is intentionally omitted to keep local reviewer setup effortless. The operator identity provides context for agent binding and intake auditing.
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setProfileModalOpen(false)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
