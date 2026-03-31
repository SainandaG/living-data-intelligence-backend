import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Zap, Brain, Activity, Settings, Play, RefreshCw, Share2, Bot, X } from 'lucide-react';
import CollapsiblePanel from '../UI/CollapsiblePanel';
import { cn } from '../../utils/cn';
import AgentStatusPanel from '../Voice/AgentStatusPanel';

/* ── Rail icon button ──────────────────────────────────────────────────────── */
const RailButton = React.memo(({
    icon: Icon,
    label,
    hint,
    onClick,
    active = false,
    badge,
    accentColor = 'var(--primary)',
    danger = false,
}) => {
    const baseAccent = danger ? '#ef4444' : accentColor;

    return (
        <div className="relative group flex items-center justify-center w-full">
            {/* Active indicator bar */}
            {active && (
                <motion.div
                    layoutId={`rail-active-${label}`}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ backgroundColor: baseAccent, boxShadow: `0 0 8px ${baseAccent}` }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
            )}

            <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={onClick}
                className={cn(
                    'relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors duration-200 outline-none',
                    active
                        ? 'text-black'
                        : danger
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-slate-500 hover:text-white hover:bg-white/8',
                )}
                style={active ? {
                    backgroundColor: `${baseAccent}22`,
                    color: baseAccent,
                    boxShadow: `0 0 0 1px ${baseAccent}30`,
                } : {}}
            >
                <Icon size={16} strokeWidth={2} />

                {/* Badge */}
                {badge > 0 && (
                    <span
                        className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-black text-black px-[3px] leading-none"
                        style={{ backgroundColor: baseAccent }}
                    >
                        {badge > 9 ? '9+' : badge}
                    </span>
                )}
            </motion.button>

            {/* Tooltip */}
            <div className="absolute left-full ml-3.5 z-[7000] pointer-events-none">
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                    <div className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl"
                        style={{
                            background: 'rgba(8, 14, 14, 0.96)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        <span className="text-[10px] font-bold text-white tracking-wide">{label}</span>
                        {hint && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/8 text-slate-500 font-mono tracking-wider">
                                {hint}
                            </span>
                        )}
                        {/* Arrow */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-[rgba(8,14,14,0.96)] mr-px" />
                    </div>
                </div>
            </div>
        </div>
    );
});

/* ── Rail separator ────────────────────────────────────────────────────────── */
const RailSep = () => (
    <div className="w-5 h-px bg-white/[0.06] mx-auto my-0.5" />
);

/* ── Intelligence popover ──────────────────────────────────────────────────── */
const IntelPopover = ({ actions, onClose }) => (
    <motion.div
        initial={{ opacity: 0, x: -8, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -8, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-full top-0 ml-3.5 w-64 z-[6000] flex flex-col gap-4 p-4 rounded-2xl shadow-2xl"
        style={{
            background: 'rgba(8, 14, 14, 0.95)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(28px)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
    >
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
                    <Brain size={11} className="text-white" />
                </div>
                <span className="text-[11px] font-black text-white uppercase tracking-[0.15em]">Neural Config</span>
            </div>
            <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            >
                <X size={12} />
            </button>
        </div>

        {/* Clustering mode */}
        <div className="space-y-2">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em]">Clustering Engine</div>
            <div className="flex rounded-xl p-1 gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {['heuristic', 'networkx'].map(mode => (
                    <button
                        key={mode}
                        onClick={() => actions.clusteringMethod !== mode && actions.toggleClusteringMethod?.()}
                        className={cn(
                            'flex-1 py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all duration-200',
                            actions.clusteringMethod === mode
                                ? mode === 'heuristic'
                                    ? 'bg-[var(--primary)] text-black shadow-lg'
                                    : 'bg-[var(--secondary)] text-white shadow-lg'
                                : 'text-slate-500 hover:text-white'
                        )}
                    >
                        {mode === 'heuristic' ? 'Heuristic' : 'NetworkX'}
                    </button>
                ))}
            </div>
        </div>

        {/* Optimizer toggle */}
        <button
            onClick={actions.toggleRL}
            className={cn(
                'w-full py-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-2',
                actions.rlActive
                    ? 'text-[var(--primary)] border-[var(--primary)]/30 shadow-[0_0_20px_rgba(13,231,242,0.12)]'
                    : 'text-slate-400 border-white/[0.07] hover:border-white/15 hover:text-white'
            )}
            style={actions.rlActive ? { background: 'rgba(13,231,242,0.08)' } : { background: 'rgba(255,255,255,0.03)' }}
        >
            <Zap size={13} />
            {actions.rlActive ? 'RL Optimizer · ON' : 'Enable RL Optimizer'}
        </button>

        {/* Recalculate gravity */}
        <button
            onClick={actions.recalculateGravity}
            className="w-full py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white border border-white/[0.07] hover:border-white/15 flex items-center justify-center gap-2 transition-all"
            style={{ background: 'rgba(255,255,255,0.03)' }}
        >
            <RefreshCw size={13} />
            Recalculate Gravity
        </button>
    </motion.div>
);

/* ── Left sidebar ──────────────────────────────────────────────────────────── */
const LeftSidebar = React.memo(({ actions }) => {
    const [showIntelMenu, setShowIntelMenu] = useState(false);
    const [isAgentHubOpen, setIsAgentHubOpen] = useState(false);

    React.useEffect(() => {
        const handleToggle = (e) => {
            if (e.detail && typeof e.detail.open === 'boolean') {
                setIsAgentHubOpen(e.detail.open);
            } else {
                setIsAgentHubOpen(prev => !prev);
            }
        };
        window.addEventListener('toggle-agent-hub', handleToggle);
        return () => window.removeEventListener('toggle-agent-hub', handleToggle);
    }, []);

    React.useEffect(() => {
        window.dispatchEvent(new CustomEvent('sidebar-panel-active', {
            detail: { active: showIntelMenu || isAgentHubOpen }
        }));
    }, [showIntelMenu, isAgentHubOpen]);

    return (
        <div className="flex flex-col items-center gap-1.5 w-full h-full">

            {/* ── Brand monogram ─────────────────────────── */}
            <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-1 shrink-0"
                style={{
                    background: 'linear-gradient(135deg, rgba(13,231,242,0.2) 0%, rgba(168,85,247,0.15) 100%)',
                    border: '1px solid rgba(13,231,242,0.2)',
                    boxShadow: '0 0 16px rgba(13,231,242,0.1)',
                }}
            >
                <span className="material-symbols-outlined text-[var(--primary)] text-[18px] select-none">hub</span>
            </div>

            <RailSep />

            {/* ── Primary actions ────────────────────────── */}
            <RailButton
                icon={Database}
                label="Load System"
                hint="⌘L"
                onClick={actions.loadSystem}
            />

            <RailButton
                icon={Share2}
                label="Data Flow"
                onClick={() => actions.navigateTo?.('dataflow')}
            />

            <RailSep />

            {/* ── Intelligence ───────────────────────────── */}
            <div className="relative w-full flex justify-center">
                <RailButton
                    icon={Brain}
                    label="Intelligence Core"
                    accentColor="var(--secondary)"
                    active={showIntelMenu}
                    onClick={() => {
                        const next = !showIntelMenu;
                        setShowIntelMenu(next);
                        if (next) window.dispatchEvent(new CustomEvent('toggle-agent-hub', { detail: { open: false } }));
                    }}
                />
                <AnimatePresence>
                    {showIntelMenu && (
                        <IntelPopover actions={actions} onClose={() => setShowIntelMenu(false)} />
                    )}
                </AnimatePresence>
            </div>

            {/* ── Agent hub ──────────────────────────────── */}
            <div className="relative w-full flex justify-center">
                <RailButton
                    icon={Bot}
                    label="Neural Agent Hub"
                    accentColor="#818cf8"
                    active={isAgentHubOpen}
                    badge={actions.activeAgentCount}
                    onClick={() => {
                        const next = !isAgentHubOpen;
                        window.dispatchEvent(new CustomEvent('toggle-agent-hub', { detail: { open: next } }));
                        if (next) setShowIntelMenu(false);
                    }}
                />
                <AgentStatusPanel />
            </div>

            <RailSep />

            {/* ── Simulation ─────────────────────────────── */}
            <RailButton
                icon={Play}
                label="Run Simulation"
                accentColor="#34d399"
                onClick={() => { }}
            />

            {/* ── Spacer ─────────────────────────────────── */}
            <div className="flex-1" />

            {/* ── Settings (bottom) ──────────────────────── */}
            <RailSep />
            <RailButton
                icon={Settings}
                label="Settings"
                onClick={() => { }}
            />
        </div>
    );
});

const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
};

const RightSidebar = React.memo(({ selectedNode, impactedNodes = [], flows, mlInsights, liveStats, activeLens }) => {
    // Relaxed Conditions: Show if Lens is active OR if data is interesting
    const hasEnergyData = liveStats?.activeBatteries > 0;
    const hasSecurityRisks = liveStats?.anomalies?.length > 0 || (liveStats?.health?.score || 100) < 90;

    const showEnergy = activeLens === 'energy' || hasEnergyData;
    const showSecurity = activeLens === 'security' || hasSecurityRisks;

    return (
        <div className="flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar p-1">

            {/* 1. HERO STATS (Live Data) */}
            <div className="glass-panel rounded-xl p-4 shrink-0 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-30 group-hover:opacity-100 transition-opacity">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                    {activeLens === 'energy' ? 'Grid Load' : 'Total Transactions'}
                </div>
                <div className="text-2xl font-bold text-white font-mono flex items-baseline gap-2">
                    {activeLens === 'energy'
                        ? `${liveStats.networkHealth || 0}%`
                        : formatNumber(liveStats.totalTransactions)}
                    <span className="text-xs text-[var(--primary)] font-bold">
                        {activeLens === 'energy'
                            ? `${liveStats.activeBatteries || 0} batteries`
                            : `+${liveStats.tps || 0} tps`}
                    </span>
                </div>
            </div>

            {/* 2. SECURITY MATRIX (Always show if relevant) */}
            {(showSecurity || (liveStats?.health?.score && liveStats.health.score < 100)) && (
                <CollapsiblePanel title="SECURITY MATRIX" defaultOpen={showSecurity}>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                            <div className="text-[10px] text-red-300 uppercase">Anomalies</div>
                            <div className="text-xl font-bold text-red-400">{liveStats.anomalies?.length || 0}</div>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center">
                            <div className="text-[10px] text-orange-300 uppercase">Vuln. Score</div>
                            <div className="text-xl font-bold text-orange-400">
                                {liveStats.health ? (100 - liveStats.health.score) : 0}
                            </div>
                        </div>
                    </div>
                </CollapsiblePanel>
            )}

            {/* 3. PROPAGATION IMPACT (Strict Alignment) */}
            {impactedNodes.length > 0 && (
                <CollapsiblePanel title={`DOWNSTREAM IMPACT (${impactedNodes.length})`} defaultOpen={true}>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {impactedNodes.map((node, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-in fade-in slide-in-from-right-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></div>
                                    <span className="text-[10px] text-rose-200 font-bold truncate max-w-[140px] uppercase tracking-wider">
                                        {node.name}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                    Depth: {node.dependencyDepth || 1}
                                </span>
                            </div>
                        ))}
                    </div>
                </CollapsiblePanel>
            )}

            {/* 4. SYSTEM METRICS (Consolidated) */}
            <CollapsiblePanel title="SYSTEM METRICS" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-2">
                    {/* Always show Active Batteries + Stations since SoH is in the Health panel */}
                    <MetricCard label="Active Batteries" value={liveStats.activeBatteries || 0} icon="🔋" color="text-green-400" />
                    <MetricCard label="Stations" value={liveStats.onlineStations || 0} icon="🏪" color="text-blue-400" />
                    <MetricCard label="Energy Alerts" value={liveStats.energyAlerts || 0} icon="⚠️" color="text-orange-400" />
                </div>
                {/* Live Battery Telemetry Row */}
                {(liveStats.avgBatteryTemp || liveStats.avgBatteryVolt) && (
                    <div className="mt-2 grid grid-cols-3 gap-1">
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-center">
                            <div className="text-[9px] text-orange-300 uppercase">Temp</div>
                            <div className="text-sm font-bold text-orange-400">{liveStats.avgBatteryTemp?.toFixed(1) || '--'}°C</div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
                            <div className="text-[9px] text-blue-300 uppercase">Volt</div>
                            <div className="text-sm font-bold text-blue-400">{liveStats.avgBatteryVolt?.toFixed(1) || '--'}V</div>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-center">
                            <div className="text-[9px] text-yellow-300 uppercase">Curr</div>
                            <div className="text-sm font-bold text-yellow-400">{liveStats.avgBatteryCurr?.toFixed(1) || '--'}A</div>
                        </div>
                    </div>
                )}
            </CollapsiblePanel>

            {/* 4. SYSTEM HEALTH */}
            <CollapsiblePanel title="SYSTEM HEALTH" defaultOpen={true}>
                <div className="space-y-3">
                    <HealthBar
                        label="Health Score"
                        value={`${liveStats.health?.score || 100}/100`}
                        percent={liveStats.health?.score || 100}
                        color={liveStats.health?.score >= 85 ? 'bg-green-400' : liveStats.health?.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}
                    />
                    <HealthBar
                        label="Avg SoH"
                        value={`${liveStats.networkHealth || 0}%`}
                        percent={liveStats.networkHealth || 0}
                        color="bg-cyan-400"
                    />
                    <HealthBar
                        label="Cache Hit Rate"
                        value={`${liveStats.cacheHitRate?.toFixed(1) || 99}%`}
                        percent={liveStats.cacheHitRate || 99}
                        color="bg-purple-400"
                    />
                </div>
            </CollapsiblePanel>

            {/* 5. ROI INTENSITY (Show if Energy Data Exists) */}
            {(showEnergy || (liveStats?.activeBatteries > 0)) && (
                <CollapsiblePanel title="WEZU ROI INTENSITY" defaultOpen={showEnergy}>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Rev. Protected</span>
                            {/* ₹ per battery per day * active batteries, scaled to Lakhs */}
                            <span className="text-green-400 font-bold">₹{(((liveStats.activeBatteries || 0) * (liveStats.networkHealth || 0) * 0.012)).toFixed(1)}L</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Avg SoH</span>
                            <span className="text-cyan-400 font-bold">{liveStats.networkHealth || 0}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Fleet Status</span>
                            <span className={cn(
                                "font-bold",
                                (liveStats.networkHealth || 0) >= 90 ? 'text-green-400' :
                                    (liveStats.networkHealth || 0) >= 75 ? 'text-yellow-400' :
                                        'text-red-400'
                            )}>
                                {(liveStats.networkHealth || 0) >= 90 ? '✅ Optimal' :
                                    (liveStats.networkHealth || 0) >= 75 ? '⚠️ Monitor' :
                                        '🚨 Critical'}
                            </span>
                        </div>
                    </div>
                </CollapsiblePanel>
            )}

            {/* 6. SYSTEM LOG */}
            <div className="glass-panel rounded-xl flex flex-col overflow-hidden shrink-0 min-h-[200px]">
                <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">System Log</span>
                    <span className="text-[10px] text-slate-500 font-mono">LIVE</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar h-48">
                    {flows && flows.length > 0 ? (
                        flows.map((flow, i) => (
                            <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-right-2">
                                <div className={cn(
                                    "mt-0.5",
                                    flow.severity === 'high' ? 'text-red-400' : 'text-[var(--primary)]'
                                )}>
                                    <Activity size={12} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-slate-300 font-medium leading-snug">{flow.description}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-[10px] text-slate-500 text-center italic mt-4">System nominal. No critical events.</div>
                    )}
                </div>
            </div>

            {/* 7. ENTITY DETAILS */}
            {selectedNode && (
                <div className="glass-panel border-t border-[var(--primary)]/30 p-4 rounded-xl shrink-0 animate-in slide-in-from-bottom-2 mb-2">
                    <div className="text-[10px] text-[var(--primary)] font-bold uppercase mb-1">Active Selection</div>
                    <div className="text-lg font-bold text-white truncate">{selectedNode.name}</div>
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-slate-400">{selectedNode.entity || 'Node'}</span>
                        <span className="text-xs text-white bg-white/10 px-2 py-0.5 rounded">
                            {formatNumber(selectedNode.row_count || 0)} rows
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
});

// Helper Component for Metrics
const MetricCard = React.memo(({ label, value, icon, color }) => (
    <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex flex-col items-center justify-center hover:bg-white/10 transition-colors">
        <div className="text-lg mb-1">{icon}</div>
        <div className={cn("text-sm font-bold", color)}>{value}</div>
        <div className="text-[9px] text-slate-400 uppercase tracking-wide text-center">{label}</div>
    </div>
));

// Helper for Health Bars
const HealthBar = React.memo(({ label, value, percent, color }) => (
    <div>
        <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400 uppercase tracking-wider">{label}</span>
            <span className="text-white font-mono font-bold">{value}</span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${percent}%` }}></div>
        </div>
    </div>
));


export { LeftSidebar, RightSidebar };
