import React from 'react';

export default function StatusBadge({ status, size = 'sm' }) {
    const config = {
        RECEIVED: {
            bg: 'bg-slate-100',
            text: 'text-slate-700',
            border: 'border-slate-200',
            dot: 'bg-slate-400',
            label: 'RECEIVED',
        },
        VALIDATED: {
            bg: 'bg-blue-50',
            text: 'text-blue-700',
            border: 'border-blue-200',
            dot: 'bg-blue-500',
            label: 'VALIDATED',
        },
        SUBMITTED: {
            bg: 'bg-indigo-50',
            text: 'text-indigo-700',
            border: 'border-indigo-200',
            dot: 'bg-indigo-500',
            label: 'SUBMITTED',
        },
        PENDING_CONFIRMATION: {
            bg: 'bg-sky-50',
            text: 'text-sky-700',
            border: 'border-sky-200',
            dot: 'bg-sky-500',
            label: 'PENDING_CONFIRMATION',
        },
        ISSUED: {
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
            label: 'ISSUED',
        },
        FAILED: {
            bg: 'bg-rose-50',
            text: 'text-rose-700',
            border: 'border-rose-200',
            dot: 'bg-rose-500',
            label: 'FAILED',
        },
        NEEDS_RECONCILIATION: {
            bg: 'bg-amber-50',
            text: 'text-amber-800',
            border: 'border-amber-200',
            dot: 'bg-amber-500',
            label: 'NEEDS_RECONCILIATION',
        },
    };

    const current = config[status] || {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
        label: status || 'UNKNOWN',
    };

    const sizeClasses = size === 'lg' 
        ? 'px-3 py-1 text-xs font-semibold' 
        : 'px-2.5 py-0.5 text-[11px] font-semibold';

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeClasses} tracking-wide font-mono`}>
            <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`}></span>
            {current.label}
        </span>
    );
}
