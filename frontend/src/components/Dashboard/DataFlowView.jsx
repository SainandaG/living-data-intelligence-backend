import React, { useEffect, useState } from 'react';

import { GitBranch, Database, ArrowRight, Zap, Search, Layers, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// [PHASE 3] Optimization: Memoize to prevent re-renders
const DataFlowView = React.memo(({ connectionId }) => {
    const [flowStats, setFlowStats] = useState(null);
    const [allTables, setAllTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [hierarchyData, setHierarchyData] = useState(null);
    const [flowVolume, setFlowVolume] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!connectionId) return;

        const fetchFlowStats = async () => {
            try {
                const response = await fetch(`/api/schema/${connectionId}`);
                if (response.ok) {
                    const data = await response.json();
                    // Calculate flow statistics
                    const stats = {
                        totalTables: data.tables?.length || 0,
                        totalRelationships: data.relationships?.length || 0,
                        factTables: data.tables?.filter(t => t.table_type === 'fact').length || 0,
                        dimensionTables: data.tables?.filter(t => t.table_type === 'dimension').length || 0,
                    };
                    setFlowStats(stats);
                    setAllTables(data.tables || []);
                }
            } catch (err) {
                console.error('Failed to fetch flow stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFlowStats();
    }, [connectionId]);

    // Fetch Hierarchy & Flow when table selected
    useEffect(() => {
        if (!connectionId || !selectedTable) return;

        const fetchDeepData = async () => {
            setHierarchyData(null);
            setFlowVolume(null);
            try {
                // 1. Structure
                const hRes = await fetch(`/api/hierarchy/${connectionId}/table/${selectedTable}`);
                if (hRes.ok) setHierarchyData(await hRes.json());

                // 2. Flow Volume
                const fRes = await fetch(`/api/hierarchy/${connectionId}/table/${selectedTable}/flow`);
                if (fRes.ok) {
                    const fData = await fRes.json();
                    // Sum volume for a simple stat
                    const totalVol = fData.flow_data?.reduce((acc, curr) => acc + curr.volume, 0) || 0;
                    setFlowVolume(totalVol);
                }
            } catch (e) {
                console.error("Inspector fetch failed", e);
            }
        };
        fetchDeepData();
    }, [connectionId, selectedTable]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-[var(--text-secondary)]">Loading data flow analysis...</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full p-8 overflow-auto pointer-events-auto">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2 flex items-center gap-3">
                    <GitBranch className="text-[var(--primary-cyan)]" size={28} />
                    System-Wide Data Flow Analysis
                </h1>
                <p className="text-[var(--text-secondary)] mb-8">
                    Comprehensive view of data movement and relationships across your entire database
                </p>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={Database}
                        label="Total Tables"
                        value={flowStats?.totalTables || 0}
                        color="cyan"
                    />
                    <StatCard
                        icon={ArrowRight}
                        label="Relationships"
                        value={flowStats?.totalRelationships || 0}
                        color="green"
                    />
                    <StatCard
                        icon={Zap}
                        label="Fact Tables"
                        value={flowStats?.factTables || 0}
                        color="yellow"
                    />
                    <StatCard
                        icon={Database}
                        label="Dimension Tables"
                        value={flowStats?.dimensionTables || 0}
                        color="purple"
                    />
                </div>

                {/* Flow Patterns */}
                <div className="bg-[var(--bg-elevated)] border border-white/10 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Data Flow Patterns</h2>
                    <div className="space-y-3">
                        <FlowPattern
                            title="Hub-and-Spoke Model"
                            description="Neural Core connects to all tables, enabling centralized intelligence"
                            active={true}
                        />
                        <FlowPattern
                            title="Star Schema Detection"
                            description={`${flowStats?.factTables || 0} fact tables surrounded by ${flowStats?.dimensionTables || 0} dimensions`}
                            active={flowStats?.factTables > 0}
                        />
                        <FlowPattern
                            title="Relationship Discovery"
                            description="AI-powered inference finds hidden connections between tables"
                            active={true}
                        />
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-[var(--primary-cyan)]/10 border border-[var(--primary-cyan)]/30 rounded-lg p-6">
                    <h3 className="text-[var(--primary-cyan)] font-bold mb-2">How to Use</h3>
                    <ul className="text-[var(--text-secondary)] text-sm space-y-2">
                        <li>• Click any node in the Overview to see its specific data flow</li>
                        <li>• Hover over nodes to see table details and record counts</li>
                        <li>• Click nodes in drill-down to view actual record data</li>
                        <li>• Use breadcrumbs to navigate back to overview</li>
                    </ul>
                </div>
            </div>

            {/* HIERARCHY INSPECTOR PANEL */}
            <div className="max-w-6xl mx-auto mt-8 border-t border-white/10 pt-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Search size={20} className="text-[var(--primary-cyan)]" />
                        Deep Flow Inspector
                    </h2>

                    {/* Table Selector */}
                    <div className="relative">
                        <select
                            className="bg-black/50 border border-white/20 text-white text-sm rounded-lg px-4 py-2 appearance-none pr-8 focus:outline-none focus:border-[var(--primary-cyan)] min-w-[200px]"
                            onChange={(e) => setSelectedTable(e.target.value)}
                            value={selectedTable || ""}
                        >
                            <option value="">Select a Table to Inspect...</option>
                            {allTables.map(t => (
                                <option key={t.name} value={t.name}>{t.name} ({t.table_type})</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                            ▼
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {selectedTable && hierarchyData ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            key={selectedTable}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                            {/* Structure Column */}
                            <div className="bg-[var(--bg-elevated)] border border-white/10 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Layers size={14} /> Structure
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {hierarchyData.children?.filter(c => c.type === 'column').map(col => (
                                        <div key={col.name} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded border border-white/5">
                                            <span className="text-white font-mono">{col.name}</span>
                                            <span className="text-slate-500">{col.data_type}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Relationships Column */}
                            <div className="bg-[var(--bg-elevated)] border border-white/10 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <GitBranch size={14} /> Connections
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {hierarchyData.children?.filter(c => c.type === 'related_table').map(rel => (
                                        <div key={rel.name} className="flex items-center gap-2 text-xs p-2 bg-indigo-500/10 border border-indigo-500/20 rounded">
                                            <ArrowRight size={12} className="text-indigo-400" />
                                            <span className="text-indigo-200 font-mono">{rel.name}</span>
                                        </div>
                                    ))}
                                    {(!hierarchyData.children?.some(c => c.type === 'related_table')) && (
                                        <p className="text-xs text-slate-500 italic">No direct foreign key relationships detected.</p>
                                    )}
                                </div>
                            </div>

                            {/* Flow Activity Column */}
                            <div className="bg-[var(--bg-elevated)] border border-white/10 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Activity size={14} /> 24h Flow Volume
                                </h3>
                                <div className="flex flex-col items-center justify-center h-[200px]">
                                    {flowVolume !== null ? (
                                        <>
                                            <div className="text-5xl font-bold text-emerald-400 font-mono mb-2">
                                                {flowVolume.toLocaleString()}
                                            </div>
                                            <span className="text-xs text-emerald-400/70 uppercase tracking-widest">Records / Transactions</span>
                                            <div className="mt-6 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 animate-pulse w-2/3"></div>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-xs text-slate-500">Checking flow history...</p>
                                    )}
                                </div>
                            </div>

                        </motion.div>
                    ) : selectedTable ? (
                        <div className="w-full py-12 flex items-center justify-center">
                            <div className="animate-spin h-8 w-8 border-2 border-[var(--primary-cyan)] border-t-transparent rounded-full"></div>
                        </div>
                    ) : (
                        <div className="w-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl text-white/30">
                            <Search size={32} className="mb-2 opacity-50" />
                            <p>Select a table to inspect hierarchy and flow data</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});

export default DataFlowView;

const StatCard = React.memo(function StatCard({ icon: Icon, label, value, color }) {
    const colorMap = {
        cyan: 'var(--primary-cyan)',
        green: 'var(--primary-green)',
        yellow: '#fbbf24',
        purple: '#a855f7',
    };

    return (
        <div className="bg-[var(--bg-elevated)] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
                <Icon size={20} style={{ color: colorMap[color] }} />
                <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">
                    {label}
                </span>
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
    );
});

const FlowPattern = React.memo(function FlowPattern({ title, description, active }) {
    return (
        <div className={`p-4 rounded-lg border ${active ? 'bg-[var(--primary-cyan)]/5 border-[var(--primary-cyan)]/30' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${active ? 'bg-[var(--primary-cyan)]' : 'bg-gray-500'}`}></div>
                <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] ml-4">{description}</p>
        </div>
    );
});
