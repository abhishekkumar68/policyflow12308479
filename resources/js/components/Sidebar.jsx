import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FileSpreadsheet, 
    FilePlus2, 
    FileCheck2, 
    ShieldCheck,
    UserCheck
} from 'lucide-react';

export default function Sidebar() {
    const navItems = [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/requests', label: 'Policy Requests', icon: FileSpreadsheet },
        { to: '/create', label: 'Create Request', icon: FilePlus2 },
    ];

    return (
        <aside className="w-64 bg-[#0a1224] text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800/80">
            {/* Brand Header */}
            <div className="p-6 pb-5 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                        <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
                    </div>
                    <div>
                        <div className="text-white font-bold text-lg tracking-tight leading-tight">PolicyFlow</div>
                        <div className="text-[10px] font-bold tracking-widest text-teal-400 uppercase">Trippers Shield</div>
                    </div>
                </div>
            </div>

            {/* Nav Links */}
            <div className="flex-1 px-3 py-6 space-y-6">
                <div>
                    <div className="px-3 mb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        Operations
                    </div>
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.exact}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                            isActive
                                                ? 'bg-[#0f766e] text-white shadow-sm font-semibold'
                                                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                                        }`
                                    }
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span>{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* User Footer Profile */}
            <div className="p-4 border-t border-slate-800/60">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="relative">
                        <div className="h-9 w-9 rounded-full bg-teal-900/60 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs">
                            NS
                        </div>
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0a1224]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">Neha Sharma</p>
                        <p className="text-[11px] text-slate-400 truncate">Ops Specialist</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
