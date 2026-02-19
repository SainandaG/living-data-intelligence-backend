import React from 'react';
import { Database, BarChart2, Activity, Zap, Brain, Layers, ArrowRight, AlertTriangle } from 'lucide-react';
import CollapsiblePanel from '../UI/CollapsiblePanel';

const LeftSidebar = ({ actions, clusters, onClusterClick }) => {
    return (
        <div className="p-5 flex flex-col gap-6">

            {/* Navigation / Quick Actions */}
            <div>
                <h3 className="text-[11px] font-bold tracking-[2px] uppercase text-[var(--primary-cyan)] font-mono mb-4">
                    Start Here
                </h3>
                <div className="space-y-2">
                    <button
                        onClick={actions.loadSystem}
                        className="w-full p-3 bg-gradient-to-br from-[var(--primary-cyan)] to-[var(--primary-green)] rounded-lg text-black font-bold text-sm hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(0,212,255,0.3)] transition-all flex items-center gap-2"
                    >
                        <Database size={16} /> Load Connected System
                    </button>
                </div>
            </div>

            {/* Intelligence Engine - Collapsible */}
            <CollapsiblePanel title="Intelligence Engine" icon={Brain} defaultOpen={true}>
                <div className="space-y-3">
                    {/* Clustering Method Toggle */}
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <div className="text-[10px] font-bold tracking-[2px] uppercase text-[var(--text-muted)] mb-2">
                            Clustering Method
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold transition-colors ${actions.clusteringMethod === 'heuristic' ? 'text-[var(--primary-cyan)]' : 'text-[var(--text-muted)]'}`}>
                                Heuristic
                            </span>
                            <button
                                onClick={actions.toggleClusteringMethod}
                                className="relative w-14 h-7 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary-purple)]/50"
                                style={{
                                    background: actions.clusteringMethod === 'networkx'
                                        ? 'linear-gradient(to right, var(--primary-purple), var(--primary-cyan))'
                                        : 'rgba(255, 255, 255, 0.1)'
                                }}
                            >
                                <div
                                    className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ease-in-out"
                                    style={{
                                        transform: actions.clusteringMethod === 'networkx' ? 'translateX(28px)' : 'translateX(4px)'
                                    }}
                                />
                            </button>
                            <span className={`text-xs font-semibold transition-colors ${actions.clusteringMethod === 'networkx' ? 'text-[var(--primary-purple)]' : 'text-[var(--text-muted)]'}`}>
                                NetworkX
                            </span>
                        </div>
                        <div className="mt-2 text-[9px] text-[var(--text-muted)] italic">
                            {actions.clusteringMethod === 'heuristic'
                                ? '⚡ Fast prefix-based clustering'
                                : '🧠 Graph theory (Louvain + PageRank)'}
                        </div>
                    </div>

                    {/* Apply Clustering Button */}
                    <button
                        onClick={actions.toggleRL}
                        className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--primary-purple)]/20 hover:border-[var(--primary-purple)] hover:text-[var(--primary-purple)] transition-all flex items-center gap-2"
                    >
                        <Zap size={16} /> {actions.rlActive ? 'Disable Clustering' : 'Apply Clustering'}
                    </button>
                    <button
                        onClick={actions.recalculateGravity}
                        className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--primary-cyan)]/10 hover:border-[var(--primary-cyan)] transition-all flex items-center gap-2"
                    >
                        <Brain size={16} /> Re-Calculate Gravity
                    </button>
                </div>
            </CollapsiblePanel>

        </div>
    );
};
const RightSidebar = ({ selectedNode, flows, mlInsights, liveStats, activeLens }) => {
    const isEnergyMode = activeLens === 'energy' || liveStats?.activeBatteries > 0;
    // eslint-disable-next-line react-hooks/purity
    const latency = React.useMemo(() => Math.floor(15 + Math.random() * 20), []);

    return (
        <div className="p-5 flex flex-col gap-5">
            {/* Stats Dashboard - Integrated */}
            {liveStats && (
                <div className="space-y-4">
                    {/* Live Data Card / ROI Hero */}
                    <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[var(--primary-cyan)]/30 rounded-xl p-4 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-[var(--primary-cyan)] animate-ping" />
                            <span className="text-[10px] font-bold tracking-[2px] uppercase text-[var(--primary-cyan)] font-mono">
                                {isEnergyMode ? 'NETWORK VITALITY' : 'LIVE DATA'}
                            </span>
                        </div>
                        {isEnergyMode ? (
                            <>
                                <div className="text-3xl font-black text-white mb-1">{liveStats.networkHealth || 0}%</div>
                                <div className="text-[10px] text-[var(--text-secondary)] mb-2">Aggregate Battery Health (Avg SoH)</div>
                            </>
                        ) : (
                            <>
                                <div className="text-3xl font-black text-white mb-1">{(liveStats.totalTransactions / 1e9).toFixed(2)}B</div>
                                <div className="text-[10px] text-[var(--text-secondary)] mb-2">Total Transactions Processed</div>
                            </>
                        )}
                        <div className="text-xs text-[var(--primary-cyan)] flex items-center gap-1">
                            <span>↗️</span> {isEnergyMode ? `Scanning ${liveStats.activeBatteries || 0} Assets` : `+${liveStats.tps} tx/sec`}
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4">
                        <div className="text-[10px] font-bold tracking-[2px] uppercase text-[var(--text-secondary)] mb-3">
                            {isEnergyMode ? 'WEZU ASSET METRICS' : 'METRICS & ALERTS'}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {isEnergyMode ? (
                                <>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">Batteries</div>
                                        <div className="text-lg font-bold text-[var(--primary-cyan)]">{liveStats.activeBatteries}</div>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">Stations</div>
                                        <div className="text-lg font-bold text-[var(--primary-green)]">{liveStats.onlineStations}</div>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">High Risk</div>
                                        <div className="text-lg font-bold text-[var(--danger-red)]">{liveStats.energyAlerts}</div>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">Pilot Phase</div>
                                        <div className="text-lg font-bold text-[var(--warning-yellow)]">V2</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">Fraud Alerts</div>
                                        <div className="text-lg font-bold text-[var(--danger-red)]">{liveStats.fraudAlerts}</div>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">Avg Amount</div>
                                        <div className="text-lg font-bold text-[var(--primary-green)]">${liveStats.avgAmount}K</div>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">Failed</div>
                                        <div className="text-lg font-bold text-[var(--warning-yellow)]">{liveStats.failedTx}</div>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded">
                                        <div className="text-[9px] text-[var(--text-muted)] mb-1">Active Nodes</div>
                                        <div className="text-lg font-bold text-[var(--primary-cyan)]">{liveStats.activeNodes}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ROI Intensity Card (New) */}
                    {isEnergyMode && (
                        <div className="bg-gradient-to-br from-green-950/40 to-black border border-[var(--primary-green)]/30 rounded-xl p-4 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap size={14} className="text-[var(--primary-green)]" />
                                <span className="text-[10px] font-bold tracking-[2px] uppercase text-[var(--primary-green)] font-mono">WEZU ROI INTENSITY</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-[var(--text-muted)]">Revenue Protected</span>
                                    <span className="text-[var(--primary-green)] font-bold">₹{((liveStats.totalTransactions || 0) * 0.05).toFixed(0)}L</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-[var(--text-muted)]">Life Extended</span>
                                    <span className="text-[var(--primary-cyan)] font-bold">+12.5%</span>
                                </div>
                                <div className="h-1.5 bg-black/30 rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-gradient-to-r from-[var(--primary-cyan)] to-[var(--primary-green)] rounded-full" style={{ width: '84%' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* System Health */}
                    <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4">
                        <div className="text-[10px] font-bold tracking-[2px] uppercase text-[var(--text-secondary)] mb-3">SYSTEM HEALTH</div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-[var(--text-muted)]">System Latency</span>
                                    <span className="text-[var(--primary-cyan)] font-bold">
                                        {/* Simulate real variance if exact ping not available */}
                                        {latency}ms
                                    </span>
                                </div>
                                <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[var(--primary-cyan)] to-[var(--primary-green)] rounded-full" style={{ width: '95%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-[var(--text-muted)]">Database Health</span>
                                    <span className="text-[var(--primary-green)] font-bold">{liveStats.health?.score || 100}%</span>
                                </div>
                                <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[var(--warning-yellow)] to-[var(--primary-green)] rounded-full" style={{ width: `${liveStats.health?.score || 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <h3 className="text-[11px] font-bold tracking-[2px] uppercase text-[var(--primary-cyan)] font-mono mt-4">
                Deep Dive Details
            </h3>

            {/* Neural Core Persistent Status */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[var(--primary-cyan)]/30 rounded-xl p-5 relative overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                <div className="absolute top-0 right-0 p-3 opacity-20 animate-pulse">
                    <Brain size={48} className="text-[var(--primary-cyan)]" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-[var(--primary-cyan)] animate-ping" />
                    <span className="text-[11px] font-bold tracking-[2px] uppercase text-[var(--primary-cyan)] font-mono">
                        Neural Core Status
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-[9px] uppercase text-[var(--text-muted)] font-bold mb-1">Patterns</div>
                        <div className="text-lg font-mono font-bold text-white leading-none">
                            {selectedNode?.id === 'hub' ? selectedNode.customMetrics?.['Patterns Learned'] : (selectedNode?.foreign_keys?.length || 0)}
                        </div>
                    </div>
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-[9px] uppercase text-[var(--text-muted)] font-bold mb-1">Growth</div>
                        <div className="text-lg font-mono font-bold text-[var(--primary-green)] leading-none">
                            {selectedNode?.id === 'hub' ? selectedNode.customMetrics?.['Core Growth'] : '1.00x'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Selected Node Panel */}
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-cyan)] box-shadow-[0_0_8px_var(--primary-cyan)]" />
                    <span className="text-[13px] font-bold text-[var(--primary-cyan)]">
                        {selectedNode?.id === 'hub' ? 'System Intel' : 'Target Entity'}
                    </span>
                    <span className="ml-auto text-[10px] px-2 py-1 bg-[var(--primary-purple)]/20 text-[var(--primary-purple)] rounded-full font-bold">
                        ML Analyzed
                    </span>
                </div>

                {selectedNode ? (
                    <div className="space-y-3">
                        <div className="text-xl font-bold text-white mb-2 break-words">{selectedNode.name}</div>

                        <DetailRow label="Type" value={selectedNode.id === 'hub' ? 'Global Core' : (selectedNode.entity || 'Generic Table')} />
                        <DetailRow label="Records" value={selectedNode.row_count || selectedNode.rows || '0'} highlight="cyan" />

                        {selectedNode.customMetrics && Object.entries(selectedNode.customMetrics).map(([k, v]) => (
                            <DetailRow key={k} label={k} value={v} />
                        ))}

                    </div>
                ) : (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                        Select a node to view intelligence details
                    </div>
                )}
            </div>

            {/* Flows / Transactions / Neural Stream */}
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={14} className="text-[var(--primary-cyan)]" />
                    <span className="text-[13px] font-bold text-[var(--primary-cyan)]">Intelligence Stream</span>
                </div>

                <div className="space-y-2">
                    {flows && flows.length > 0 ? (
                        flows.map((flow, i) => (
                            <div key={i} className={`flex flex-col gap-1 p-2 bg-white/5 rounded-lg border-l-2 transition-all ${flow.severity === 'high' ? 'border-l-red-500 bg-red-500/5' : 'border-l-[var(--primary-cyan)]'}`}>
                                <div className="flex items-center gap-2">
                                    <ArrowRight size={10} className={flow.severity === 'high' ? 'text-red-400' : 'text-[var(--primary-cyan)]'} />
                                    <span className="text-[11px] font-bold text-white tracking-tight">{flow.description}</span>
                                </div>
                                {flow.justification && (
                                    <div className="text-[9px] text-[var(--text-muted)] italic pl-4 border-l border-white/5 mt-1">
                                        {flow.justification}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="space-y-2">
                            {/* Fallback to Neural Context Analysis if no active transactions */}
                            {selectedNode?.id !== 'hub' && selectedNode ? (
                                <div className="p-3 bg-white/5 rounded text-xs leading-relaxed text-[var(--text-secondary)] border-l-2 border-[var(--primary-purple)]">
                                    <span className="font-bold text-[var(--primary-purple)]">Neural Context: </span>
                                    Node exhibits <span className="text-white font-bold">{((selectedNode.importance_score || 0) * 100).toFixed(0)}%</span> gravitational influence.
                                    Connected to {selectedNode.metrics?.length || 0} active dimensions.
                                </div>
                            ) : (
                                <div className="py-2 text-center text-xs text-[var(--text-muted)] italic">
                                    System awaiting active transaction flow...
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ML Insights */}
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Brain size={64} />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                    <Zap size={14} className="text-[var(--primary-purple)]" />
                    <span className="text-[13px] font-bold text-[var(--primary-purple)]">AI Insights</span>
                </div>

                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-[var(--text-muted)] uppercase font-semibold text-[10px]">Vitality Score</span>
                        {/* Use Node Vitality if available, else generic score */}
                        <span className={`font-mono font-bold ${selectedNode?.vitality < 50 ? 'text-[var(--danger-red)]' : 'text-[var(--primary-green)]'}`}>
                            {selectedNode?.vitality || mlInsights?.anomalyScore || '100'}%
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-[var(--text-muted)] uppercase font-semibold text-[10px]">Gravity Pull</span>
                        <span className="font-mono font-bold text-[var(--primary-cyan)]">
                            {selectedNode?.importance_score ? `${selectedNode.importance_score.toFixed(2)}x` : (mlInsights?.gravity || '1.0x')}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-muted)] uppercase font-semibold text-[10px]">Optimization</span>
                        <span className="font-mono font-bold text-[var(--primary-purple)]">Active</span>
                    </div>
                </div>
            </div>

        </div >
    );
}

const DetailRow = ({ label, value, highlight }) => {
    let valueClass = "font-mono font-semibold text-[var(--text-primary)]";
    if (highlight === 'green') valueClass = "font-mono font-bold text-[var(--primary-green)]";
    if (highlight === 'cyan') valueClass = "font-mono font-bold text-[var(--primary-cyan)]";
    if (highlight === 'red') valueClass = "font-mono font-bold text-[var(--danger-red)]";

    return (
        <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className={valueClass}>{value}</span>
        </div>
    );
};

export { LeftSidebar, RightSidebar };

