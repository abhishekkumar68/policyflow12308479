import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPolicyRequest } from '../services/api';
import { 
    User, 
    Calendar, 
    Send, 
    Plane, 
    Globe, 
    Info, 
    Check, 
    AlertCircle,
    Loader2
} from 'lucide-react';

export default function CreatePolicyRequest() {
    const navigate = useNavigate();

    // Default dates: tomorrow and +10 days
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 11);

    const formatDateInput = (d) => d.toISOString().split('T')[0];
    const generateId = () => 'CR-2024-' + Math.floor(1000 + Math.random() * 9000);

    const [formData, setFormData] = useState({
        client_request_id: generateId(),
        agent_id: 'AGT-4092',
        customer_name: 'Rohan Deshmukh',
        date_of_birth: '1986-06-15',
        destination: 'INTERNATIONAL',
        trip_start: formatDateInput(tomorrow),
        trip_end: formatDateInput(futureDate),
        plan_code: 'PLUS',
        sum_insured: 300000,
        mock_scenario: 'SUCCESS',
    });

    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState(null);

    // Handle trip start change ensuring trip_end >= trip_start
    const handleTripStartChange = (newStart) => {
        let updatedEnd = formData.trip_end;
        if (updatedEnd && updatedEnd < newStart) {
            updatedEnd = newStart;
        }
        setFormData({
            ...formData,
            trip_start: newStart,
            trip_end: updatedEnd,
        });
    };

    // Live Actuarial Calculations strictly matching the assignment pricing rules
    const calculations = useMemo(() => {
        // Daily Base Rates
        const baseRates = { BASIC: 12, PLUS: 20, PREMIUM: 30 };
        const baseRate = baseRates[formData.plan_code] || 20;

        // Inclusive travel days: trip_end - trip_start + 1 (minimum 1)
        let travelDays = 1;
        if (formData.trip_start && formData.trip_end) {
            const start = new Date(formData.trip_start);
            const end = new Date(formData.trip_end);
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            travelDays = Math.max(1, diffDays + 1);
        }

        // Age calculation on trip start date
        let age = 30;
        let ageMultiplier = 1.00;
        if (formData.date_of_birth && formData.trip_start) {
            const dob = new Date(formData.date_of_birth);
            const start = new Date(formData.trip_start);
            let diffYears = start.getFullYear() - dob.getFullYear();
            const m = start.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && start.getDate() < dob.getDate())) {
                diffYears--;
            }
            age = Math.max(0, diffYears);

            // Assignment age brackets on trip start:
            // 0–17: 1.10; 18–60: 1.00; 61–70: 1.50; 71+: 2.00
            if (age <= 17) ageMultiplier = 1.10;
            else if (age <= 60) ageMultiplier = 1.00;
            else if (age <= 70) ageMultiplier = 1.50;
            else ageMultiplier = 2.00;
        }

        // Destination multiplier: DOMESTIC = 1.00, INTERNATIONAL = 1.80
        const destMultiplier = formData.destination === 'INTERNATIONAL' ? 1.80 : 1.00;

        // Coverage multiplier: 100,000 = 1.00, 300,000 = 1.25, 500,000 = 1.50
        const coverageMultipliers = { 100000: 1.00, 300000: 1.25, 500000: 1.50 };
        const coverageMultiplier = coverageMultipliers[Number(formData.sum_insured)] || 1.00;

        // Base cost subtotal
        const baseSubtotal = baseRate * travelDays;

        // Final formula: base_rate × travel_days × age_multiplier × destination_multiplier × coverage_multiplier
        const exactPremium = baseRate * travelDays * ageMultiplier * destMultiplier * coverageMultiplier;
        const totalPremium = Math.round(exactPremium * 100) / 100;

        return {
            baseRate,
            travelDays,
            age,
            ageMultiplier: ageMultiplier.toFixed(2),
            destMultiplier: destMultiplier.toFixed(2),
            coverageMultiplier: coverageMultiplier.toFixed(2),
            baseSubtotal,
            totalPremium: totalPremium.toFixed(2),
        };
    }, [formData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});
        setServerError(null);

        try {
            const payload = {
                ...formData,
                sum_insured: Number(formData.sum_insured),
            };
            const response = await createPolicyRequest(payload);
            if (response.data && response.data.success) {
                const newId = response.data.data.id;
                navigate(`/requests/${newId}`);
            }
        } catch (err) {
            console.error('Submission failed:', err);
            if (err.response && err.response.data && err.response.data.errors) {
                setErrors(err.response.data.errors);
            } else if (err.response && err.response.data && err.response.data.message) {
                setServerError(err.response.data.message);
            } else {
                setServerError('An unexpected error occurred while communicating with the server.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Top Breadcrumb & Header */}
            <div>
                <div className="text-[11px] font-bold text-teal-600 tracking-wider uppercase mb-1">
                    POLICIES &gt; INTAKE FORM
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Policy Request</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                    Submit a new travel insurance policy request and calculate the estimated premium according to official pricing rules.
                </p>
            </div>

            {serverError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    <span>{serverError}</span>
                </div>
            )}

            {/* Split Grid */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Sections (Left 2 cols) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Section A: Customer Details */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-5">
                        <div className="pb-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                                A
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">Customer Details</h2>
                                <p className="text-[11px] text-slate-400">Primary insured traveler &amp; agent binding info</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Client Request ID *
                                </label>
                                <input
                                    type="text"
                                    value={formData.client_request_id}
                                    onChange={(e) => setFormData({ ...formData, client_request_id: e.target.value })}
                                    className={`w-full px-3 py-2 bg-slate-50 border ${errors.client_request_id ? 'border-rose-400' : 'border-slate-200'} rounded-lg text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500`}
                                    required
                                />
                                {errors.client_request_id && (
                                    <p className="text-[11px] text-rose-600 mt-1">{errors.client_request_id[0]}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Assigned Agent ID *
                                </label>
                                <input
                                    type="text"
                                    value={formData.agent_id}
                                    onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                                    className={`w-full px-3 py-2 bg-slate-50 border ${errors.agent_id ? 'border-rose-400' : 'border-slate-200'} rounded-lg text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500`}
                                    required
                                />
                                {errors.agent_id && (
                                    <p className="text-[11px] text-rose-600 mt-1">{errors.agent_id[0]}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Customer Full Name *
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        placeholder="e.g. Rohan Deshmukh"
                                        className={`w-full pl-9 pr-3 py-2 bg-slate-50 border ${errors.customer_name ? 'border-rose-400' : 'border-slate-200'} rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500`}
                                        required
                                    />
                                </div>
                                {errors.customer_name && (
                                    <p className="text-[11px] text-rose-600 mt-1">{errors.customer_name[0]}</p>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                        Date of Birth *
                                    </label>
                                    <span className="text-[11px] font-mono text-teal-600 font-semibold">
                                        Age: {calculations.age} yrs • {calculations.ageMultiplier}x
                                    </span>
                                </div>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="date"
                                        value={formData.date_of_birth}
                                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                        className={`w-full pl-9 pr-3 py-2 bg-slate-50 border ${errors.date_of_birth ? 'border-rose-400' : 'border-slate-200'} rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500`}
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Multipliers: 0-17: 1.10x, 18-60: 1.00x, 61-70: 1.50x, 71+: 2.00x
                                </p>
                                {errors.date_of_birth && (
                                    <p className="text-[11px] text-rose-600 mt-1">{errors.date_of_birth[0]}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section B: Trip Details */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-5">
                        <div className="pb-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                                B
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">Trip Details</h2>
                                <p className="text-[11px] text-slate-400">Destination corridor and inclusive travel dates</p>
                            </div>
                        </div>

                        {/* Destination Corridor Selector */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Travel Destination Corridor
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div
                                    onClick={() => setFormData({ ...formData, destination: 'DOMESTIC' })}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                                        formData.destination === 'DOMESTIC'
                                            ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg ${formData.destination === 'DOMESTIC' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        <Plane className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">Domestic</span>
                                            {formData.destination === 'DOMESTIC' && (
                                                <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-700 text-[10px] font-bold">Selected</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">Domestic Travel</div>
                                        <div className="text-[10px] font-mono text-slate-400 mt-1">1.00x Multiplier</div>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setFormData({ ...formData, destination: 'INTERNATIONAL' })}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                                        formData.destination === 'INTERNATIONAL'
                                            ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg ${formData.destination === 'INTERNATIONAL' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        <Globe className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">International</span>
                                            {formData.destination === 'INTERNATIONAL' && (
                                                <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-700 text-[10px] font-bold">Selected</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">Overseas Travel</div>
                                        <div className="text-[10px] font-mono text-slate-400 mt-1">1.80x Multiplier</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trip Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Trip Start Date *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="date"
                                        value={formData.trip_start}
                                        onChange={(e) => handleTripStartChange(e.target.value)}
                                        className={`w-full pl-9 pr-3 py-2 bg-slate-50 border ${errors.trip_start ? 'border-rose-400' : 'border-slate-200'} rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500`}
                                        required
                                    />
                                </div>
                                {errors.trip_start && (
                                    <p className="text-[11px] text-rose-600 mt-1">{errors.trip_start[0]}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Trip End Date *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="date"
                                        value={formData.trip_end}
                                        min={formData.trip_start}
                                        onChange={(e) => setFormData({ ...formData, trip_end: e.target.value })}
                                        className={`w-full pl-9 pr-3 py-2 bg-slate-50 border ${errors.trip_end ? 'border-rose-400' : 'border-slate-200'} rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500`}
                                        required
                                    />
                                </div>
                                {errors.trip_end && (
                                    <p className="text-[11px] text-rose-600 mt-1">{errors.trip_end[0]}</p>
                                )}
                            </div>
                        </div>

                        {/* Inclusive Travel Days Pill */}
                        <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-200/60 flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {calculations.travelDays}
                            </div>
                            <div className="text-xs">
                                <span className="font-bold text-teal-900">{calculations.travelDays} Travel Days</span>
                                <span className="text-teal-700 text-[11px] ml-2">Inclusive: trip_end &minus; trip_start + 1 (minimum 1 day).</span>
                            </div>
                        </div>
                    </div>

                    {/* Section C: Insurance Plan */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-5">
                        <div className="pb-3 border-b border-slate-100 flex items-center gap-3">
                            <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                                C
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">Insurance Plan &amp; Coverage</h2>
                                <p className="text-[11px] text-slate-400">Plan tier and sum insured limit</p>
                            </div>
                        </div>

                        {/* Daily Coverage Tier */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Select Daily Plan Tier
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* BASIC */}
                                <div
                                    onClick={() => setFormData({ ...formData, plan_code: 'BASIC' })}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                                        formData.plan_code === 'BASIC'
                                            ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                                    }`}
                                >
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">TIER 01</div>
                                        <div className="text-sm font-bold text-slate-900 mt-0.5">BASIC</div>
                                        <div className="text-base font-extrabold text-teal-700 font-mono mt-2">
                                            ₹12 <span className="text-xs font-normal text-slate-500">/ day</span>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200/60">
                                        Base Daily Rate: ₹12.00
                                    </div>
                                </div>

                                {/* PLUS */}
                                <div
                                    onClick={() => setFormData({ ...formData, plan_code: 'PLUS' })}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative ${
                                        formData.plan_code === 'PLUS'
                                            ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                                    }`}
                                >
                                    <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-teal-600 text-white text-[9px] font-bold uppercase tracking-wider">
                                        Popular
                                    </span>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">TIER 02</div>
                                        <div className="text-sm font-bold text-slate-900 mt-0.5">PLUS</div>
                                        <div className="text-base font-extrabold text-teal-700 font-mono mt-2">
                                            ₹20 <span className="text-xs font-normal text-slate-500">/ day</span>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200/60">
                                        Base Daily Rate: ₹20.00
                                    </div>
                                </div>

                                {/* PREMIUM */}
                                <div
                                    onClick={() => setFormData({ ...formData, plan_code: 'PREMIUM' })}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                                        formData.plan_code === 'PREMIUM'
                                            ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                                    }`}
                                >
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">TIER 03</div>
                                        <div className="text-sm font-bold text-slate-900 mt-0.5">PREMIUM</div>
                                        <div className="text-base font-extrabold text-teal-700 font-mono mt-2">
                                            ₹30 <span className="text-xs font-normal text-slate-500">/ day</span>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200/60">
                                        Base Daily Rate: ₹30.00
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sum Insured Limit */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Sum Insured Limit
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { value: 100000, label: '₹100,000', factor: '1.00x Coverage Multiplier' },
                                    { value: 300000, label: '₹300,000', factor: '1.25x Coverage Multiplier' },
                                    { value: 500000, label: '₹500,000', factor: '1.50x Coverage Multiplier' },
                                ].map((item) => (
                                    <div
                                        key={item.value}
                                        onClick={() => setFormData({ ...formData, sum_insured: item.value })}
                                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                                            Number(formData.sum_insured) === item.value
                                                ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                                                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                                        }`}
                                    >
                                        <div className="text-sm font-bold text-slate-900 font-mono">{item.label}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">{item.factor}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => navigate('/requests')}
                            className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Creating Request...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="h-3.5 w-3.5" />
                                    <span>Create Policy Request</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Actuarial Quoting Panel (Right 1 col) */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-6 sticky top-24">
                        <div>
                            <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Actuarial Breakdown</div>
                            <div className="flex items-center justify-between mt-1">
                                <h3 className="text-base font-bold text-slate-900">Estimated Premium</h3>
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-slate-700">INR (₹)</span>
                            </div>
                        </div>

                        {/* Breakdown line items */}
                        <div className="space-y-3 text-xs border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between text-slate-600">
                                <span>Selected Plan</span>
                                <span className="font-semibold text-slate-800">{formData.plan_code} (₹{calculations.baseRate}.00 / day)</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600">
                                <span>Travel Duration</span>
                                <span className="font-semibold text-slate-800">{calculations.travelDays} days (inclusive)</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600">
                                <span>Base Cost Subtotal</span>
                                <span className="font-mono font-semibold text-slate-800">
                                    ₹{calculations.baseSubtotal}.00 ({calculations.travelDays} × ₹{calculations.baseRate})
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600">
                                <span>Age Multiplier</span>
                                <span className="font-mono font-semibold text-slate-800">
                                    {calculations.ageMultiplier}x (Age {calculations.age})
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600">
                                <span>Destination Multiplier</span>
                                <span className="font-mono font-semibold text-slate-800">
                                    {calculations.destMultiplier}x ({formData.destination})
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600">
                                <span>Coverage Multiplier</span>
                                <span className="font-mono font-semibold text-slate-800">
                                    {calculations.coverageMultiplier}x (₹{Number(formData.sum_insured).toLocaleString()})
                                </span>
                            </div>
                        </div>

                        {/* Active Formula Box */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Formula</div>
                            <div className="text-xs font-mono font-medium text-slate-700 mt-1">
                                {calculations.travelDays} days × ₹{calculations.baseRate} × {calculations.ageMultiplier} × {calculations.destMultiplier} × {calculations.coverageMultiplier}
                            </div>
                        </div>

                        {/* Total Premium Card */}
                        <div className="p-5 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-800 text-white shadow-md">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-teal-200">
                                Estimated Total Premium
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl font-extrabold font-mono tracking-tight">₹{calculations.totalPremium}</span>
                                <span className="text-xs text-teal-200 uppercase font-bold">INR</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-teal-100 mt-2 font-medium">
                                <Check className="h-3.5 w-3.5 text-teal-300" />
                                <span>Calculated per assignment pricing rules</span>
                            </div>
                        </div>

                        {/* Underwriting Guide */}
                        <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-100 text-sky-900 text-xs flex items-start gap-2.5">
                            <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold text-[11px]">Pricing Note:</span>
                                <p className="text-[11px] text-sky-800/90 mt-0.5 leading-relaxed">
                                    The backend PremiumCalculationService calculates and locks the immutable premium snapshot upon request submission.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
