import React, { useState } from 'react';
import { Database, Zap, Brain, Activity, ArrowRight, Settings, Play, RefreshCw, BarChart2, Terminal as TerminalIcon, Share2, Bot } from 'lucide-react';
import CollapsiblePanel from '../UI/CollapsiblePanel';
import { cn } from '../../utils/cn';

// Helper for Icon Button with Tooltip
const IconButton = React.memo(({ icon: Icon, label, onClick, active, color = "text-slate-400" }) => (
    <div className="relative group flex items-center justify-center">
        <button
            onClick={onClick}
            className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200",
                active ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30' : `hover:bg-white/5 hover:text-white ${color}`
            )}
        >
            <Icon size={20} />
        </button>
        {/* Tooltip */}
        <div className="absolute left-full ml-4 px-2 py-1 bg-black/90 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 backdrop-blur-md">
            {label}
        </div>
    </div>
));

const LeftSidebar = React.memo(({ actions, activeLens }) => {
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

    // Global state sync for exclusivity with graph HUDs
    React.useEffect(() => {
        window.dispatchEvent(new CustomEvent('sidebar-panel-active', { 
            detail: { active: showIntelMenu || isAgentHubOpen } 
        }));
    }, [showIntelMenu, isAgentHubOpen]);

    return (
        <>
            {/* Primary Actions */}
            <IconButton
                icon={Database}
                label="Load System"
                onClick={actions.loadSystem}
            />

            <IconButton
                icon={Share2}
                label="Data Flow"
                onClick={() => actions.navigateTo('dataflow')}
            />

            {/* Intelligence Menu Trigger */}
            <div className="relative">
                <IconButton
                    icon={Brain}
                    label="Intelligence Core"
                    active={showIntelMenu}
                    color="text-[var(--secondary)]"
                    onClick={() => {
                        const newState = !showIntelMenu;
                        setShowIntelMenu(newState);
                        // If opening Intel Menu, explicitly close Agent Hub
                        if (newState) {
                            window.dispatchEvent(new CustomEvent('toggle-agent-hub', { detail: { open: false } }));
                        }
                    }}
                />

                {/* Popover Menu for Intelligence Controls */}
                {showIntelMenu && (
                    <div className="absolute left-full top-0 ml-4 w-64 glass-panel p-4 rounded-xl z-[6000] flex flex-col gap-4 animate-in fade-in slide-in-from-left-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                            <h4 className="text-xs font-bold text-[var(--secondary)] uppercase tracking-widest">
                                Neural Config
                            </h4>
                            <button onClick={() => setShowIntelMenu(false)} className="text-slate-500 hover:text-white">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Clustering Mode</div>
                            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                                <button
                                    onClick={() => actions.clusteringMethod !== 'heuristic' && actions.toggleClusteringMethod()}
                                    className={cn(
                                        "flex-1 py-1.5 text-[10px] font-bold rounded",
                                        actions.clusteringMethod === 'heuristic' ? 'bg-[var(--primary)] text-black' : 'text-slate-400 hover:text-white'
                                    )}
                                >
                                    Heuristic
                                </button>
                                <button
                                    onClick={() => actions.clusteringMethod !== 'networkx' && actions.toggleClusteringMethod()}
                                    className={cn(
                                        "flex-1 py-1.5 text-[10px] font-bold rounded",
                                        actions.clusteringMethod === 'networkx' ? 'bg-[var(--secondary)] text-white' : 'text-slate-400 hover:text-white'
                                    )}
                                >
                                    NetworkX
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={actions.toggleRL}
                            className={cn(
                                "w-full py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2",
                                actions.rlActive ? 'bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/50' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                            )}
                        >
                            <Zap size={14} />
                            {actions.rlActive ? 'Optimizer: ON' : 'Enable Optimizer'}
                        </button>

                        <button
                            onClick={actions.recalculateGravity}
                            className="w-full py-2 rounded-lg text-xs font-bold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} />
                            Recalculate Gravity
                        </button>
                    </div>
                )}
            </div>

            <IconButton
                icon={TerminalIcon}
                label="System Console"
                onClick={() => { }}
            />

            <IconButton
                icon={Bot}
                label="Neural Agent HUB"
                onClick={() => {
                    const newState = !isAgentHubOpen;
                    window.dispatchEvent(new CustomEvent('toggle-agent-hub', { detail: { open: newState } }));
                    // If opening Agent Hub, explicitly close Intel Menu
                    if (newState) {
                        setShowIntelMenu(false);
                    }
                }}
                color="text-indigo-400"
                active={isAgentHubOpen}
            />

            <div className="my-2 w-8 h-px bg-white/10"></div>

            <IconButton
                icon={Play}
                label="Run Simulation"
                onClick={() => { }}
                color="text-green-400"
            />
        </>
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
                    {/* Always show Active Batteries + SoH since this is WEZU */}
                    <MetricCard label="Active Batteries" value={liveStats.activeBatteries || 0} icon="🔋" color="text-green-400" />
                    <MetricCard label="Net SoH" value={`${liveStats.networkHealth || 0}%`} icon="⚡" color="text-yellow-400" />
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
