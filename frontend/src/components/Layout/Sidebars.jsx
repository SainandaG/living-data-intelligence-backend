import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Zap, Brain, Settings, Play, RefreshCw, Share2, Bot, X, HardDrive, Plus, LogOut, Shield, Fingerprint, Radio } from 'lucide-react';
import CollapsiblePanel from '../UI/CollapsiblePanel';
import { cn } from '../../utils/cn';
import AgentStatusPanel from '../Voice/AgentStatusPanel';
import FeatureGate from '../FeatureGate';

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

/* ── Connections popover ──────────────────────────────────────────────────── */
const ConnectionsPopover = ({ connections, activeId, onSelect, onAdd, onClose }) => (
    <motion.div
        initial={{ opacity: 0, x: -8, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -8, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-full top-0 ml-3.5 w-64 z-[6000] flex flex-col gap-3 p-4 rounded-2xl shadow-2xl"
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
                <div className="w-5 h-5 rounded-md flex items-center justify-center bg-cyan-500/20">
                    <HardDrive size={11} className="text-cyan-400" />
                </div>
                <span className="text-[11px] font-black text-white uppercase tracking-[0.15em]">Connections</span>
            </div>
            <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            >
                <X size={12} />
            </button>
        </div>

        {/* Connections List */}
        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {connections.length > 0 ? (
                connections.map(conn => (
                    <button
                        key={conn.id}
                        onClick={() => { onSelect(conn.id); onClose(); }}
                        className={cn(
                            "w-full flex flex-col items-start p-2.5 rounded-xl border transition-all text-left group",
                            conn.id === activeId
                                ? "bg-cyan-500/10 border-cyan-500/30 ring-1 ring-cyan-500/20"
                                : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/8"
                        )}
                    >
                        <div className="flex items-center justify-between w-full mb-1">
                            <span className={cn(
                                "text-[11px] font-bold",
                                conn.id === activeId ? "text-cyan-400" : "text-white"
                            )}>
                                {conn.database}
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 px-1.5 py-0.5 rounded bg-black/40">
                                {conn.type}
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono truncate w-full">
                            ID: {conn.id.substring(0, 12)}...
                        </div>
                        {conn.id === activeId && (
                            <div className="mt-1 flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                                <span className="text-[8px] font-bold text-cyan-500/80 uppercase tracking-widest">Active</span>
                            </div>
                        )}
                    </button>
                ))
            ) : (
                <div className="py-8 text-center">
                    <p className="text-[10px] text-slate-500 italic">No active connections</p>
                </div>
            )}
        </div>

        <RailSep />

        {/* Add Connection */}
        <button
            onClick={() => { onAdd(); onClose(); }}
            className="w-full py-2.5 rounded-xl text-[11px] font-bold text-white bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
        >
            <Plus size={14} />
            Add Connection
        </button>
    </motion.div>
);

/* ── Left sidebar ──────────────────────────────────────────────────────────── */
import { useAuthStore } from '../../stores/authStore';

const LeftSidebar = React.memo(({ actions }) => {
    const [showIntelMenu, setShowIntelMenu] = useState(false);
    const [showConnMenu, setShowConnMenu] = useState(false);
    const [isAgentHubOpen, setIsAgentHubOpen] = useState(false);
    const canDo = useAuthStore(state => state.canDo);

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
            <FeatureGate feature="connections">
                <RailButton
                    icon={Database}
                    label="Manage Connection"
                    hint="⌘L"
                    onClick={actions.loadSystem}
                />
            </FeatureGate>

            <FeatureGate feature="connections">
                <div className="relative w-full flex justify-center">
                    <RailButton
                        icon={HardDrive}
                        label="Switch Database"
                        accentColor="#22d3ee"
                        active={showConnMenu}
                        onClick={() => {
                            const next = !showConnMenu;
                            setShowConnMenu(next);
                            if (next) {
                                setShowIntelMenu(false);
                                window.dispatchEvent(new CustomEvent('toggle-agent-hub', { detail: { open: false } }));
                            }
                        }}
                    />
                    <AnimatePresence>
                        {showConnMenu && (
                            <ConnectionsPopover
                                connections={actions.activeConnections || []}
                                activeId={actions.connectionId}
                                onSelect={actions.switchConnection}
                                onAdd={actions.openConnectModal}
                                onClose={() => setShowConnMenu(false)}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </FeatureGate>

            <FeatureGate feature="view_lineage">
                <RailButton
                    icon={Share2}
                    label="Data Flow"
                    onClick={() => actions.navigateTo?.('dataflow')}
                />
            </FeatureGate>

            <FeatureGate feature="view_lineage">
                <RailButton
                    icon={Radio}
                    label="Traffic Intelligence"
                    accentColor="#ff6b35"
                    onClick={() => actions.openTrafficDashboard?.()}
                />
            </FeatureGate>

            <RailSep />

            {/* ── Intelligence ───────────────────────────── */}
            <FeatureGate feature="intel_hub">
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
            </FeatureGate>

            {/* ── Agent hub ──────────────────────────────── */}
            <FeatureGate feature="agent_state">
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
            </FeatureGate>

            <RailSep />

            {/* ── Simulation ─────────────────────────────── */}
            <FeatureGate feature="sim_start">
                <RailButton
                    icon={Play}
                    label="Run Simulation"
                    accentColor="#34d399"
                    onClick={() => { }}
                />
            </FeatureGate>

            {/* ── Spacer ─────────────────────────────────── */}
            <div className="flex-1" />

            {/* ── Settings (bottom) ──────────────────────── */}
            <RailSep />
            {canDo('admin') && (
                <>
                    <FeatureGate feature="rbac">
                        <RailButton
                            icon={Shield}
                            label="Security Matrix"
                            accentColor="#f43f5e"
                            onClick={() => actions.executeCommand?.('admin.rbac')}
                        />
                    </FeatureGate>
                    <FeatureGate feature="audit">
                        <RailButton
                            icon={Fingerprint}
                            label="Audit Logs"
                            accentColor="#f59e0b"
                            onClick={() => actions.executeCommand?.('admin.audit')}
                        />
                    </FeatureGate>
                </>
            )}
            <RailButton
                icon={Settings}
                label="Settings"
                onClick={() => { }}
            />
            <RailButton
                icon={LogOut}
                label="Logout"
                danger
                onClick={actions.logout}
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

const RightSidebar = React.memo(({ selectedNode, impactedNodes = [] }) => {
    return (
        <div className="flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar p-1">

            {/* PROPAGATION IMPACT */}
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

            {/* ENTITY DETAILS */}
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

export { LeftSidebar, RightSidebar };
