import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity, BarChart3, AlertTriangle, TrendingUp, GitBranch,
    Lightbulb, Zap, Layers, Wrench, Search, Play, StopCircle,
    DatabaseZap, Loader2, Brain, Bell,
} from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { AGENT_POLL_INTERVAL } from '../../config/timing';

import HealthDashboard from './HealthDashboard';
import PatternDashboard from './PatternDashboard';
import AnomalyDashboard from './AnomalyDashboard';
import PredictionDashboard from './PredictionDashboard';
import RootCauseDashboard from './RootCauseDashboard';
import RecommendationDashboard from './RecommendationDashboard';
import DeepStatusDashboard from './DeepStatusDashboard';
import OntologyExplorer from './OntologyExplorer';
import SemanticSearchDiscovery from './SemanticSearchDiscovery';
import AgentChat from '../../modules/intelligence/AgentConsole/AgentChat';
import DecisionBoard from '../../modules/intelligence/DecisionHub/DecisionBoard';

// Thin wrappers so components receive connectionId via the hub's prop
const AgentConsoleTab   = ({ connectionId }) => <div className="h-full"><AgentChat connectionId={connectionId} /></div>;
const DecisionHubTab    = ({ connectionId }) => <DecisionBoard connectionId={connectionId} />;

const TABS = [
    { id: 'agent',           label: 'APEX Agent',         short: 'Agent',     icon: Brain,          color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', component: AgentConsoleTab,        isNew: true, permission: 'apex_chat' },
    { id: 'decisions',       label: 'Decision Hub',       short: 'Decisions', icon: Bell,           color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  component: DecisionHubTab,         isNew: true, permission: 'list_decisions' },
    { id: 'health',          label: 'System Health',      short: 'Health',    icon: Activity,       color: '#10b981', bg: 'rgba(16,185,129,0.12)',  component: HealthDashboard, permission: 'health_overview' },
    { id: 'search',          label: 'Discovery Search',   short: 'Search',    icon: Search,         color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   component: SemanticSearchDiscovery, permission: 'semantic_search' },
    { id: 'ontology',        label: 'Ontology & Entities',short: 'Ontology',  icon: Layers,         color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  component: OntologyExplorer, permission: 'entity_mapping' },
    { id: 'deep-status',     label: 'Deep Diagnostics',   short: 'Diagnose',  icon: Zap,            color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  component: DeepStatusDashboard, permission: 'deep_status' },
    { id: 'patterns',        label: 'Behavior Patterns',  short: 'Patterns',  icon: BarChart3,      color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  component: PatternDashboard, permission: 'patterns' },
    { id: 'anomalies',       label: 'Risk Detection',     short: 'Risks',     icon: AlertTriangle,  color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   component: AnomalyDashboard, permission: 'anomalies' },
    { id: 'predictions',     label: 'Future Forecast',    short: 'Forecast',  icon: TrendingUp,     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  component: PredictionDashboard, permission: 'predictions' },
    { id: 'root-cause',      label: 'Impact Analysis',    short: 'Impact',    icon: GitBranch,      color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  component: RootCauseDashboard, permission: 'root_cause' },
    { id: 'recommendations', label: 'Action Plans',       short: 'Actions',   icon: Lightbulb,      color: '#f97316', bg: 'rgba(249,115,22,0.12)',  component: RecommendationDashboard, permission: 'recommendations' },
    { id: 'utils',           label: 'Platform Utils',     short: 'Utils',     icon: Wrench,         color: '#64748b', bg: 'rgba(100,116,139,0.12)', component: PlatformUtils, permission: 'admin' },
];

import { useAuthStore } from '../../stores/authStore';

export default function IntelligenceHub({ connectionId, selectedNode }) {
    const { canDo } = useAuthStore();
    
    // Filter tabs based on user permissions
    const authorizedTabs = React.useMemo(() => {
        return TABS.filter(tab => tab.permission ? canDo(tab.permission) : true);
    }, [canDo]);
    const [activeTab, setActiveTab] = useState(() => {
        const saved = window.lastIntelligenceTab;
        if (saved) {
            window.lastIntelligenceTab = null;
            const map = { anomalies: 'anomalies', patterns: 'patterns', predictions: 'predictions', root_cause: 'root-cause', recommendations: 'recommendations' };
            return map[saved] || 'health';
        }
        return localStorage.getItem('intelligence_active_tab') || 'health';
    });

    const [firstTable, setFirstTable] = React.useState(null);

    React.useEffect(() => {
        localStorage.setItem('intelligence_active_tab', activeTab);
    }, [activeTab]);

    React.useEffect(() => {
        if (!connectionId) return;
        apiClient.get(`/schema/${connectionId}`)
            .then(schema => {
                const tables = schema?.tables || schema?.nodes || [];
                if (tables.length > 0) {
                    const name = tables[0].name || tables[0].id;
                    if (name) setFirstTable(name);
                }
            })
            .catch(() => {});
    }, [connectionId]);

    const tableName = (selectedNode?.id && selectedNode.id !== 'hub') ? selectedNode.id : (firstTable || null);
    const activeTabConfig = authorizedTabs.find(t => t.id === activeTab);

    // If active tab is not authorized (or empty), fallback to first available
    React.useEffect(() => {
        if (!activeTabConfig && authorizedTabs.length > 0) {
            setActiveTab(authorizedTabs[0].id);
        }
    }, [activeTabConfig, authorizedTabs, setActiveTab]);

    if (!connectionId) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#080a0f]">
                <div className="text-center max-w-sm px-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="text-amber-400" size={28} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-3">No Active Connection</h2>
                    <p className="text-sm text-gray-500 leading-relaxed mb-6">
                        Connect a database to unlock real-time intelligence, anomaly detection, and predictive analytics.
                    </p>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-connection-modal'))}
                        className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-bold rounded-xl transition-all"
                    >
                        Connect Database
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#080a0f] overflow-hidden pointer-events-auto">

            {/* ── Header ── */}
            <div className="shrink-0 px-6 pt-5 pb-0 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: activeTabConfig?.bg, border: `1px solid ${activeTabConfig?.color}30` }}
                        >
                            {activeTabConfig && React.createElement(activeTabConfig.icon, {
                                size: 17, style: { color: activeTabConfig.color }
                            })}
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white leading-tight">AI Intelligence Hub</h1>
                            <p className="text-[11px] text-gray-500 leading-none mt-0.5">
                                {selectedNode?.id && selectedNode.id !== 'hub'
                                    ? <>Analyzing <span className="text-gray-300 font-medium">{selectedNode.name}</span></>
                                    : 'Global system insights and predictive monitoring'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-gray-500 uppercase tracking-widest">Live</span>
                    </div>
                </div>

                {/* ── Tab Bar ── */}
                <div className="flex items-center gap-1 overflow-x-auto pb-px" style={{ scrollbarWidth: 'none' }}>
                    {authorizedTabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="relative shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition-all rounded-t-lg"
                                style={{
                                    color: isActive ? tab.color : '#6b7280',
                                    background: isActive ? `${tab.color}0f` : 'transparent',
                                }}
                            >
                                <Icon size={13} />
                                <span>{tab.short}</span>
                                {tab.isNew && (
                                    <span className="text-[8px] font-bold px-1 py-px rounded bg-violet-500/30 text-violet-300 border border-violet-500/30 leading-none">NEW</span>
                                )}
                                {isActive && (
                                    <motion.div
                                        layoutId="tab-underline"
                                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                                        style={{ background: tab.color }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto">
                {(() => {
                    const tab = authorizedTabs.find(t => t.id === activeTab);
                    if (!tab) return (
                        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                            No authorized panels available.
                        </div>
                    );
                    const Component = tab.component;
                    return (
                        <Component
                            key={activeTab}
                            connectionId={connectionId}
                            tableName={tableName}
                            accentColor={tab.color}
                            setActiveTab={setActiveTab}
                        />
                    );
                })()}
            </div>
        </div>
    );
}

/* ── Platform Utils ── */
function PlatformUtils({ connectionId }) {
    const [simStatus, setSimStatus] = useState({ running: false, cycle: 0 });
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState(null);

    React.useEffect(() => {
        const check = async () => {
            try { setSimStatus(await apiClient.get('/simulation/status')); }
            catch (e) { logger.error('Sim check failed', e); }
        };
        check();
        // Only poll while simulation is running — stops when idle
        const t = setInterval(async () => {
            try {
                const s = await apiClient.get('/simulation/status');
                setSimStatus(s);
                if (!s.running) clearInterval(t);
            } catch (e) { logger.error('Sim check failed', e); }
        }, AGENT_POLL_INTERVAL);
        return () => clearInterval(t);
    }, []);

    const toggleSim = async () => {
        try {
            await apiClient.post(simStatus.running ? '/simulation/stop' : '/simulation/start');
            setSimStatus(await apiClient.get('/simulation/status'));
        } catch (e) { alert('Failed: ' + e.message); }
    };

    const handleSeed = async () => {
        if (!window.confirm('Seed the database with sample data?')) return;
        setSeeding(true); setSeedResult(null);
        try {
            const r = await apiClient.post('/seeder/seed', { connection_id: connectionId });
            setSeedResult(r.message);
        } catch (e) { setSeedResult('Error: ' + e.message); }
        finally { setSeeding(false); }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Platform Utilities</h2>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/15 rounded-xl">
                        <Activity size={18} className="text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">Data Simulator</p>
                        <p className="text-[11px] text-gray-500">Cycle #{simStatus.cycle} · {simStatus.running ? 'Running' : 'Idle'}</p>
                    </div>
                </div>
                <button
                    onClick={toggleSim}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                        ${simStatus.running
                            ? 'bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25'
                            : 'bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25'}`}
                >
                    {simStatus.running ? <><StopCircle size={13} /> Stop</> : <><Play size={13} /> Start</>}
                </button>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-500/15 rounded-xl">
                        <DatabaseZap size={18} className="text-amber-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">Database Seeder</p>
                        <p className="text-[11px] text-gray-500">Populate with demo data</p>
                    </div>
                </div>
                <button
                    onClick={handleSeed}
                    disabled={seeding}
                    className="w-full py-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-xl text-xs font-bold hover:bg-amber-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                    {seeding ? <><Loader2 size={13} className="animate-spin" /> Seeding…</> : <><Zap size={13} /> Trigger Seeder</>}
                </button>
                {seedResult && (
                    <p className={`mt-3 text-xs font-medium px-3 py-2 rounded-lg ${seedResult.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {seedResult}
                    </p>
                )}
            </div>
        </div>
    );
}
