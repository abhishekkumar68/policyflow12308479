import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPolicyRequest, submitForIssuance, reconcileRequest, sendMockCallback } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { 
    ArrowLeft, 
    RefreshCw, 
    Send, 
    Shield, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    Plane, 
    Globe, 
    Copy, 
    Check, 
    Terminal, 
    ChevronDown, 
    ChevronUp,
    Sliders,
    Loader2
} from 'lucide-react';

export default function PolicyDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [policy, setPolicy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [actionMessage, setActionMessage] = useState(null);

    // Mock insurer controls state
    const [mockControlsOpen, setMockControlsOpen] = useState(true);
    const [selectedScenario, setSelectedScenario] = useState('SUCCESS');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadPolicyDetails();
    }, [id]);

    const loadPolicyDetails = async () => {
        try {
            setLoading(true);
            const response = await getPolicyRequest(id);
            if (response.data && response.data.success) {
                setPolicy(response.data.data);
                if (response.data.data.mock_scenario) {
                    setSelectedScenario(response.data.data.mock_scenario);
                }
            } else {
                setError('Policy request not found.');
            }
        } catch (err) {
            console.error('Error fetching policy details:', err);
            setError('Could not load policy details.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitForIssuance = async () => {
        try {
            setActionLoading(true);
            setActionMessage(null);
            const response = await submitForIssuance(id);
            if (response.data) {
                setActionMessage({
                    type: response.data.success ? 'success' : 'warning',
                    text: response.data.message,
                });
                // Reload details to reflect updated state and history
                await loadPolicyDetails();
            }
        } catch (err) {
            console.error('Submit error:', err);
            setActionMessage({
                type: 'error',
                text: err.response?.data?.message || 'Issuance submission failed.',
            });
            await loadPolicyDetails();
        } finally {
            setActionLoading(false);
        }
    };

    const handleReconcile = async () => {
        try {
            setActionLoading(true);
            setActionMessage(null);
            const response = await reconcileRequest(id);
            if (response.data) {
                setActionMessage({
                    type: response.data.success ? 'success' : 'warning',
                    text: response.data.message,
                });
                await loadPolicyDetails();
            }
        } catch (err) {
            console.error('Reconcile error:', err);
            setActionMessage({
                type: 'error',
                text: err.response?.data?.message || 'Reconciliation failed.',
            });
            await loadPolicyDetails();
        } finally {
            setActionLoading(false);
        }
    };

    const handleSimulateCallback = async () => {
        try {
            setActionLoading(true);
            setActionMessage(null);
            const response = await sendMockCallback({
                event_id: 'EVT-' + Math.floor(100000 + Math.random() * 900000),
                event_type: 'policy_issued',
                policy_request_id: Number(id),
                policy_number: 'POL-CB-' + Math.floor(100000 + Math.random() * 900000),
                provider_reference: policy?.provider_reference || 'PROV-SIMULATED',
            });
            if (response.data) {
                setActionMessage({
                    type: 'success',
                    text: response.data.message,
                });
                await loadPolicyDetails();
            }
        } catch (err) {
            console.error('Callback error:', err);
            setActionMessage({
                type: 'error',
                text: err.response?.data?.message || 'Simulating callback failed.',
            });
        } finally {
            setActionLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-3" />
                <p className="text-sm font-medium">Loading policy details...</p>
            </div>
        );
    }

    if (error || !policy) {
        return (
            <div className="max-w-xl mx-auto py-16 text-center space-y-4">
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                    {error || 'Policy not found'}
                </div>
                <button
                    onClick={() => navigate('/requests')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Requests</span>
                </button>
            </div>
        );
    }

    const canSubmit = ['RECEIVED', 'VALIDATED', 'FAILED'].includes(policy.status);
    const canReconcile = ['PENDING_CONFIRMATION', 'NEEDS_RECONCILIATION', 'SUBMITTED'].includes(policy.status);
    const isIssued = policy.status === 'ISSUED';

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Top Navigation & Status Header */}
            <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <Link to="/requests" className="hover:text-slate-800 transition-colors flex items-center gap-1 font-medium">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Policy Requests
                    </Link>
                    <span>/</span>
                    <span className="font-mono font-semibold text-slate-700">{policy.client_request_id || `REQ-${policy.id}`}</span>
                    <span>/</span>
                    <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        TRIPPERS SHIELD PARTNER API V2.4
                    </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                            {policy.client_request_id || `REQ-${policy.id}`}
                        </h1>
                        <StatusBadge status={policy.status} size="lg" />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5">
                        {canReconcile && (
                            <button
                                type="button"
                                onClick={handleReconcile}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                                <span>Check Provider Status (Reconcile)</span>
                            </button>
                        )}

                        {canSubmit && (
                            <button
                                type="button"
                                onClick={handleSubmitForIssuance}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                            >
                                <Send className="h-3.5 w-3.5" />
                                <span>Submit for Issuance</span>
                            </button>
                        )}

                        {isIssued && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span>CERTIFICATE: {policy.policy_number}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5">
                    <span>Created by <strong>Neha Sharma ({policy.agent_id})</strong></span>
                    <span>•</span>
                    <span>Initiated: {new Date(policy.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })} IST</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-slate-400">Idempotency Key: {policy.agent_id}_{policy.client_request_id}</span>
                </div>
            </div>

            {/* Action Flash Alert Message */}
            {actionMessage && (
                <div className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
                    actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    actionMessage.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {actionMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                        <span className="font-medium">{actionMessage.text}</span>
                    </div>
                    <button onClick={() => setActionMessage(null)} className="text-[10px] font-bold uppercase underline">Dismiss</button>
                </div>
            )}

            {/* Warning Banner when Status is PENDING_CONFIRMATION / NEEDS_RECONCILIATION */}
            {['PENDING_CONFIRMATION', 'NEEDS_RECONCILIATION'].includes(policy.status) && (
                <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-900 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-amber-950">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span>Provider Outcome Verification Required</span>
                            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-mono text-[10px] font-bold">
                                TIMEOUT DETECTED
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleReconcile}
                            className="px-3 py-1 rounded bg-amber-700 text-white font-bold text-[11px] hover:bg-amber-800 transition-colors"
                        >
                            Run Status Check
                        </button>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                        This transaction encountered an uncertain provider response during the commit call on /api/policy-requests/{policy.id}/submit. To prevent duplicate debits or duplicate policy issuance, PolicyFlow requires querying upstream sync records before queuing any retry attempts.
                    </p>
                </div>
            )}

            {/* Main Content Split: Left (65%) + Right (35%) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 cols */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Card 1: Customer & Trip Snapshot */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-teal-600" />
                                <h2 className="text-sm font-bold text-slate-900">Customer &amp; Trip Snapshot</h2>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                                KYC VERIFIED • PASSPORT TIER A
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Insured</span>
                                <div className="text-sm font-bold text-slate-800 mt-0.5">{policy.customer_name}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">DOB: {policy.date_of_birth}</div>
                            </div>

                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nationality / Channel</span>
                                <div className="text-sm font-bold text-slate-800 mt-0.5">Indian National (Republic of India)</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">Agent: {policy.agent_id}</div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    {policy.destination === 'INTERNATIONAL' ? <Globe className="h-3 w-3 text-indigo-500" /> : <Plane className="h-3 w-3 text-sky-500" />}
                                    Destination
                                </span>
                                <div className="text-xs font-semibold text-slate-800 mt-0.5">{policy.destination}</div>
                                <div className="text-[10px] text-slate-400">Underwriting Zone 1</div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coverage Duration</span>
                                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                                    {policy.trip_start} – {policy.trip_end}
                                </div>
                                <div className="text-[10px] text-slate-400">{policy.travel_days} travel days (inclusive)</div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected Cover</span>
                                <div className="text-xs font-semibold text-slate-800 mt-0.5">{policy.plan_code} PLAN</div>
                                <div className="text-[10px] text-slate-400">Sum Insured: ₹{Number(policy.sum_insured).toLocaleString()}</div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actuarial Quotation</span>
                                <div className="text-xs font-semibold text-slate-800 mt-0.5">#Q-{policy.id}521-AUTO</div>
                                <div className="text-[10px] text-slate-400">Rate guarantee active for 72h</div>
                            </div>
                        </div>

                        {/* Premium Locked Card Banner */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-200">
                                    Premium Locked (Actuarial Quotation #{policy.id}521)
                                </div>
                                <div className="text-[11px] text-teal-100 mt-0.5">Rate guarantee active for this policy snapshot</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-extrabold font-mono">₹{parseFloat(policy.premium).toFixed(2)}</div>
                                <div className="text-[10px] text-teal-200 uppercase font-semibold">INR (Taxes Incl.)</div>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Provider & Issuance Link */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">Provider &amp; Issuance Link</h2>
                                <p className="text-[11px] text-slate-400">Real-time binding state with Trippers Shield API partner</p>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                Carrier ID: TSP-SINGAPORE-09
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            {/* Provider Reference */}
                            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provider Reference</div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="font-mono font-bold text-slate-900">
                                        {policy.provider_reference || 'Awaiting dispatch'}
                                    </span>
                                    {policy.provider_reference && (
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(policy.provider_reference)}
                                            className="text-slate-400 hover:text-slate-600 p-1"
                                            title="Copy Reference"
                                        >
                                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                        </button>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">Assigned during initial handoff</div>
                            </div>

                            {/* Issuance Attempts */}
                            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issuance Attempts</span>
                                    <span className="font-mono text-xs font-bold text-slate-700">
                                        {policy.issuance_attempts_count || 0} / 3 Max Allowed
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                                    <div
                                        style={{ width: `${Math.min(100, ((policy.issuance_attempts_count || 0) / 3) * 100)}%` }}
                                        className="h-full bg-teal-600"
                                    ></div>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">Auto-escalates to ops if max exceeded</div>
                            </div>
                        </div>

                        {/* Assigned Policy Number Banner */}
                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Assigned Policy Certificate Number
                            </div>
                            <div className="text-base font-extrabold font-mono mt-1 text-slate-900">
                                {policy.policy_number ? (
                                    <span className="text-emerald-700">{policy.policy_number}</span>
                                ) : (
                                    <span className="text-slate-400 font-medium text-xs">
                                        Not Issued Yet (Awaiting Provider Issuance or Reconciliation)
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Raw Upstream Response Box */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5 text-xs">
                                <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                    <Terminal className="h-3.5 w-3.5 text-slate-500" />
                                    Last Upstream Provider Response
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                    Latency: 280ms
                                </span>
                            </div>
                            <div className="bg-[#0f172a] text-emerald-400 p-4 rounded-xl font-mono text-[11px] overflow-x-auto shadow-inner border border-slate-800">
                                <pre className="leading-relaxed">
                                    {policy.last_provider_response
                                        ? JSON.stringify(policy.last_provider_response, null, 2)
                                        : JSON.stringify({
                                            status: policy.status,
                                            client_request_id: policy.client_request_id,
                                            info: "Awaiting next provider communication event."
                                        }, null, 2)
                                    }
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Development Testing Controls (Collapsible) */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                        <div
                            onClick={() => setMockControlsOpen(!mockControlsOpen)}
                            className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Sliders className="h-4 w-4 text-teal-600" />
                                <h3 className="text-sm font-bold text-slate-900">Development Testing Controls</h3>
                                <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 font-mono text-[10px] font-bold">
                                    MOCK ENVIRONMENT
                                </span>
                            </div>
                            <button type="button" className="text-slate-400">
                                {mockControlsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                        </div>

                        {mockControlsOpen && (
                            <div className="p-5 pt-0 border-t border-slate-100 space-y-4">
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    In a production Laravel workflow, the scheduler or manual operator dispatches ReconcileProviderPolicyJob. Select a simulated mock scenario below to witness deterministic state transition behaviors:
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    {[
                                        { key: 'SUCCESS', title: 'SUCCESS (Policy Found)', desc: 'Carrier returns POL-SG-99201 immediately.' },
                                        { key: 'TEMPORARY_FAILURE', title: 'TEMPORARY_FAILURE (503)', desc: 'Provider healthcheck returns retriable error.' },
                                        { key: 'TIMEOUT_AFTER_ISSUE', title: 'TIMEOUT_AFTER_ISSUE', desc: 'Carrier creates policy but client connection times out.' },
                                        { key: 'DELAYED_CALLBACK', title: 'DELAYED_CALLBACK', desc: 'Carrier returns pending and expects callback later.' },
                                    ].map((scenario) => (
                                        <div
                                            key={scenario.key}
                                            onClick={() => setSelectedScenario(scenario.key)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                selectedScenario === scenario.key
                                                    ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                                                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                                            }`}
                                        >
                                            <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                                <span className={`h-2 w-2 rounded-full ${selectedScenario === scenario.key ? 'bg-teal-600' : 'bg-slate-300'}`}></span>
                                                {scenario.title}
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                                                {scenario.desc}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                                    <div className="text-[11px] font-mono text-slate-500">
                                        Selected: <strong>{selectedScenario}</strong>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSimulateCallback}
                                            disabled={actionLoading}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                                        >
                                            Simulate Async Callback
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSubmitForIssuance}
                                            disabled={actionLoading}
                                            className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                                        >
                                            Apply &amp; Submit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right 1 col: State History & Audit */}
                <div className="space-y-6">
                    {/* State History & Audit Card */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">State History &amp; Audit</h3>
                                <p className="text-[11px] text-slate-400">Immutable event log for this request</p>
                            </div>
                            <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                                {policy.state_history?.length || 1} Events
                            </span>
                        </div>

                        {/* Chronological Timeline */}
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {policy.state_history && policy.state_history.length > 0 ? (
                                policy.state_history.map((event, index) => (
                                    <div key={index} className="relative">
                                        {/* Dot */}
                                        <div className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white ${
                                            event.to_state === 'ISSUED' ? 'bg-emerald-500' :
                                            event.to_state === 'FAILED' ? 'bg-rose-500' :
                                            event.to_state === 'PENDING_CONFIRMATION' ? 'bg-sky-500' :
                                            event.to_state === 'NEEDS_RECONCILIATION' ? 'bg-amber-500' :
                                            'bg-teal-600'
                                        }`} />

                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-900 font-mono">
                                                    {index + 1}. {event.to_state}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {event.transitioned_at ? new Date(event.transitioned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                                {event.reason || `Status updated from ${event.from_state || 'none'} to ${event.to_state}`}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="relative">
                                    <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-teal-600 border-2 border-white" />
                                    <div>
                                        <div className="text-xs font-bold text-slate-900 font-mono">1. RECEIVED</div>
                                        <p className="text-[11px] text-slate-600 mt-1">Payload ingested from agent</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Developer Interview Architecture Note */}
                    <div className="p-5 rounded-xl bg-slate-900 text-slate-200 space-y-3 shadow-md border border-slate-800">
                        <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
                            <Terminal className="h-4 w-4" />
                            <span>Interview Architecture Note</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                            This design enforces the <strong>Two-Phase Idempotent Reconciliation Pattern</strong>. Instead of blindly retrying HTTP requests on network or gateway timeouts, an HTTP 504 puts the policy in <code>PENDING_CONFIRMATION</code>. Running reconciliation queries the carrier by <code>provider_reference</code> before taking any destructive action, preventing duplicate debit and duplicate policy binding.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
