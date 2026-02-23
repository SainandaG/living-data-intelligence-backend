import React, { useState } from 'react';
import { Database, Zap, Brain, Activity, ArrowRight, Settings, Play, RefreshCw, BarChart2, Terminal as TerminalIcon, Share2 } from 'lucide-react';
import CollapsiblePanel from '../UI/CollapsiblePanel';

// Helper for Icon Button with Tooltip
const IconButton = ({ icon: Icon, label, onClick, active, color = "text-slate-400" }) => (
    <div className="relative group flex items-center justify-center">
        <button
            onClick={onClick}
            className={`
                w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200
                ${active ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30' : `hover:bg-white/5 hover:text-white ${color}`}
            `}
        >
            <Icon size={20} />
        </button>
        {/* Tooltip */}
        <div className="absolute left-full ml-4 px-2 py-1 bg-black/90 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 backdrop-blur-md">
            {label}
        </div>
    </div>
);

const LeftSidebar = ({ actions, activeLens }) => {
    const [showIntelMenu, setShowIntelMenu] = useState(false);

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
                    onClick={() => setShowIntelMenu(!showIntelMenu)}
                />

                {/* Popover Menu for Intelligence Controls */}
                {showIntelMenu && (
                    <div className="absolute left-full top-0 ml-4 w-64 glass-panel p-4 rounded-xl z-[100] flex flex-col gap-4 animate-in fade-in slide-in-from-left-4">
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
                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded ${actions.clusteringMethod === 'heuristic' ? 'bg-[var(--primary)] text-black' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Heuristic
                                </button>
                                <button
                                    onClick={() => actions.clusteringMethod !== 'networkx' && actions.toggleClusteringMethod()}
                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded ${actions.clusteringMethod === 'networkx' ? 'bg-[var(--secondary)] text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    NetworkX
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={actions.toggleRL}
                            className={`
                                w-full py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2
                                ${actions.rlActive ? 'bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/50' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}
                            `}
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

            <div className="my-2 w-8 h-px bg-white/10"></div>

            <IconButton
                icon={Play}
                label="Run Simulation"
                onClick={() => { }}
                color="text-green-400"
            />
        </>
    );
};

const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
};

const RightSidebar = ({ selectedNode, impactedNodes = [], flows, mlInsights, liveStats, activeLens }) => {
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
                    {activeLens === 'energy' ? '42%' : formatNumber(liveStats.totalTransactions)}
                    <span className="text-xs text-[var(--primary)] font-bold">
                        {activeLens === 'energy' ? '+2%' : `+${liveStats.tps} tps`}
                    </span>
                </div>
            </div>

            {/* 2. SECURITY MATRIX (Always show if relevant) */}
            {(showSecurity || true) && ( // Force show for now based on user feedback "metrics are hidden"
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
                    {/* Always show Core Banking Metrics */}
                    <MetricCard label="Fraud Alerts" value={liveStats.fraudAlerts} icon="⚠️" color="text-orange-400" />
                    <MetricCard label="Avg Amount" value={`$${liveStats.avgAmount}K`} icon="💰" color="text-emerald-400" />

                    {/* Show Energy Metrics if data exists, otherwise standard stats */}
                    {hasEnergyData ? (
                        <>
                            <MetricCard label="Active Batteries" value={liveStats.activeBatteries} icon="🔋" color="text-green-400" />
                            <MetricCard label="Net Health" value={`${liveStats.networkHealth}%`} icon="⚡" color="text-yellow-400" />
                        </>
                    ) : (
                        <>
                            <MetricCard label="Failed Tx" value={liveStats.failedTx} icon="❌" color="text-red-400" />
                            <MetricCard label="Active Nodes" value={liveStats.activeNodes} icon="🔗" color="text-blue-400" />
                        </>
                    )}
                </div>
            </CollapsiblePanel>

            {/* 4. SYSTEM HEALTH */}
            <CollapsiblePanel title="SYSTEM HEALTH" defaultOpen={true}>
                <div className="space-y-3">
                    <HealthBar label="API Response" value="18ms" percent={95} color="bg-cyan-400" />
                    <HealthBar label="Database Load" value={`${liveStats.health?.score || 100}%`} percent={liveStats.health?.score || 100} color="bg-yellow-400" />
                    <HealthBar label="Throughput" value="92%" percent={92} color="bg-cyan-400" />
                </div>
            </CollapsiblePanel>

            {/* 5. ROI INTENSITY (Show if Energy Data Exists) */}
            {(showEnergy || true) && ( // Force open as well for visibility per request
                <CollapsiblePanel title="WEZU ROI INTENSITY" defaultOpen={showEnergy}>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Rev. Protected</span>
                            <span className="text-green-400 font-bold">₹{((liveStats.totalTransactions || 0) * 0.05).toFixed(0)}L</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Life Extended</span>
                            <span className="text-cyan-400 font-bold">+12% (180d)</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Pilot Roadmap</span>
                            <span className="text-amber-400 font-bold">Phase 2: Kinetic</span>
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
                                <div className={`mt-0.5 ${flow.severity === 'high' ? 'text-red-400' : 'text-[var(--primary)]'}`}>
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
};

// Helper Component for Metrics
const MetricCard = ({ label, value, icon, color }) => (
    <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex flex-col items-center justify-center hover:bg-white/10 transition-colors">
        <div className="text-lg mb-1">{icon}</div>
        <div className={`text-sm font-bold ${color}`}>{value}</div>
        <div className="text-[9px] text-slate-400 uppercase tracking-wide text-center">{label}</div>
    </div>
);

// Helper for Health Bars
const HealthBar = ({ label, value, percent, color }) => (
    <div>
        <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400 uppercase tracking-wider">{label}</span>
            <span className="text-white font-mono font-bold">{value}</span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
        </div>
    </div>
);


export { LeftSidebar, RightSidebar };
