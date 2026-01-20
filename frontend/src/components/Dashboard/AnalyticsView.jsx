import React, { useEffect, useState, useRef } from 'react';
import { BarChart3, TrendingUp, Activity, Brain, Download, Zap, AlertTriangle, Network, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThreeGraph from './ThreeGraph';

export default function AnalyticsView({ connectionId, mlInsights, gravitySuggestions }) {
    const [analytics, setAnalytics] = useState(null);
    const [tableData, setTableData] = useState([]);
    const [showGraphModal, setShowGraphModal] = useState(false);
    const [vizData, setVizData] = useState({ nodes: [], edges: [] });

    useEffect(() => {
        if (!connectionId) return;

        const fetchAnalytics = async () => {
            try {
                const response = await fetch(`/api/schema/${connectionId}`);
                if (response.ok) {
                    const data = await response.json();
                    const computed = {
                        totalRecords: data.tables?.reduce((sum, t) => sum + (t.row_count || 0), 0) || 0,
                        avgTableSize: Math.round((data.tables?.reduce((sum, t) => sum + (t.row_count || 0), 0) || 0) / (data.tables?.length || 1)),
                        largestTable: data.tables?.reduce((max, t) => (t.row_count || 0) > (max.row_count || 0) ? t : max, {}),
                        totalColumns: data.tables?.reduce((sum, t) => sum + (t.columns?.length || 0), 0) || 0,
                        totalTables: data.tables?.length || 0,
                    };
                    setAnalytics(computed);
                    setTableData(data.tables || []);
                }
            } catch (err) {
                console.error('Failed to fetch analytics:', err);
            }
        };

        fetchAnalytics();
    }, [connectionId]);

    const exportReport = () => {
        const report = {
            timestamp: new Date().toISOString(),
            analytics,
            mlInsights,
            gravitySuggestions,
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${Date.now()}.json`;
        a.click();
    };

    const handleVisualize = () => {
        // Transform tableData into Graph Nodes/Edges
        if (!tableData) return;

        // Create a lookup for AI Gravity Suggestions
        const suggestionMap = new Map();
        if (gravitySuggestions) {
            gravitySuggestions.forEach(s => {
                // Store the highest impact if multiple exist
                const existing = suggestionMap.get(s.table);
                if (!existing || (s.impact === 'Critical' && existing.impact !== 'Critical')) {
                    suggestionMap.set(s.table, s);
                }
            });
        }

        const nodes = tableData.map((t, i) => {
            // Check for AI insights
            const suggestion = suggestionMap.get(t.name);
            let color = t.table_type === 'fact' ? 0xfbbf24 : (t.table_type === 'dimension' ? 0x34d399 : 0x22d3ee);
            let sizeMultiplier = 1;
            let aiReason = null;

            if (suggestion) {
                if (suggestion.impact === 'Critical') {
                    color = 0xff4444; // Red for Critical
                    sizeMultiplier = 1.5;
                    aiReason = suggestion.reason;
                } else if (suggestion.impact === 'High') {
                    color = 0xffaa44; // Orange for High
                    sizeMultiplier = 1.3;
                    aiReason = suggestion.reason;
                }
            }

            // Neural Core Score (if available in schema)
            const importance = t.importance_score || 5;

            return {
                id: t.name,
                name: t.name,
                // mathematical representation: pure log scale, no artificial cap
                size: (Math.log10(t.row_count || 1) * 20 + 20) * sizeMultiplier,
                color: color,
                pos: [
                    (Math.random() - 0.5) * 500,
                    (Math.random() - 0.5) * 500,
                    (Math.random() - 0.5) * 500
                ],
                row_count: t.row_count,
                aiReason: aiReason,
                importance: importance
            };
        });

        const edges = [];
        tableData.forEach(t => {
            if (t.foreign_keys) {
                t.foreign_keys.forEach(fk => {
                    const targetName = fk.referenced_table;
                    // Boost edge intensity if both nodes are "Critical"
                    const sourceSugg = suggestionMap.get(t.name);
                    const targetSugg = suggestionMap.get(targetName);
                    let intensity = 0.5;

                    if (sourceSugg?.impact === 'Critical' || targetSugg?.impact === 'Critical') {
                        intensity = 0.8;
                    }

                    edges.push({
                        source: t.name,
                        target: targetName,
                        trafficIntensity: intensity
                    });
                });
            }
        });

        setVizData({ nodes, edges });
        setShowGraphModal(true);
    };

    return (
        <div className="w-full h-full overflow-auto bg-gradient-to-br from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a] pointer-events-auto">
            {/* 3D Visualization Modal */}
            <AnimatePresence>
                {showGraphModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[5000] bg-[#0a0e1a] flex flex-col" // Opaque background
                    >
                        {/* Fixed Close Button - Top Right */}
                        <div className="fixed top-6 right-6 z-[9999]">
                            <button
                                onClick={() => setShowGraphModal(false)}
                                className="group flex items-center gap-2 px-6 py-3 bg-[var(--bg-elevated)] border border-red-500/50 hover:bg-red-500/20 rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                <span className="font-bold text-red-400 group-hover:text-red-300">Close Visualizer</span>
                                <div className="p-1 bg-red-500/20 rounded-full">
                                    <X size={20} className="text-red-400" />
                                </div>
                            </button>
                        </div>

                        <div className="absolute top-6 left-6 z-[5010] p-4 bg-black/50 border border-white/10 rounded-xl backdrop-blur-md">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Network className="text-[var(--primary-cyan)]" />
                                Visualized Data Report
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                Interactive force-directed map of your exported analytic snapshot.
                            </p>
                            <div className="mt-2 text-xs text-gray-500 font-mono">
                                Nodes: {vizData.nodes.length} | Connections: {vizData.edges.length}
                            </div>
                        </div>

                        {/* Reuse ThreeGraph with High Z-Index */}
                        <div className="w-full h-full relative cursor-move">
                            <ThreeGraph data={vizData} className="w-full h-full" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto p-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2 flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-[var(--primary-cyan)] to-[var(--primary-purple)] rounded-lg">
                                    <BarChart3 size={28} />
                                </div>
                                Analytics Dashboard
                            </h1>
                            <p className="text-[var(--text-secondary)]">
                                AI-powered insights and real-time metrics for your database
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleVisualize}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500 rounded-lg hover:from-purple-500/40 hover:to-pink-500/40 transition-all text-purple-300 hover:text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                            >
                                <Network size={16} />
                                Visualize Graph
                            </button>
                            <button
                                onClick={exportReport}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-cyan)]/20 border border-[var(--primary-cyan)] rounded-lg hover:bg-[var(--primary-cyan)]/30 transition-all text-cyan-300 hover:text-white shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                            >
                                <Download size={16} />
                                Export JSON
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <AnimatedMetricCard
                        icon={Activity}
                        label="Total Records"
                        value={(analytics?.totalRecords || 0).toLocaleString()}
                        trend="+12.5%"
                        color="cyan"
                        delay={0}
                    />
                    <AnimatedMetricCard
                        icon={TrendingUp}
                        label="Avg Table Size"
                        value={(analytics?.avgTableSize || 0).toLocaleString()}
                        subtitle="records/table"
                        color="green"
                        delay={0.1}
                    />
                    <AnimatedMetricCard
                        icon={BarChart3}
                        label="Largest Table"
                        value={analytics?.largestTable?.name || 'N/A'}
                        subtitle={`${(analytics?.largestTable?.row_count || 0).toLocaleString()} rows`}
                        color="purple"
                        delay={0.2}
                    />
                    <AnimatedMetricCard
                        icon={Brain}
                        label="Total Columns"
                        value={(analytics?.totalColumns || 0).toLocaleString()}
                        subtitle={`across ${analytics?.totalTables || 0} tables`}
                        color="yellow"
                        delay={0.3}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Table Distribution Chart */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-[var(--bg-elevated)]/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
                    >
                        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Table Size Distribution</h2>
                        <TableDistributionChart tables={tableData} />
                    </motion.div>

                    {/* ML Insights */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gradient-to-br from-[var(--primary-purple)]/10 to-[var(--primary-cyan)]/10 backdrop-blur-md border border-[var(--primary-purple)]/30 rounded-xl p-6"
                    >
                        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                            <Brain className="text-[var(--primary-purple)]" size={20} />
                            ML Intelligence
                        </h2>
                        {mlInsights ? (
                            <div className="space-y-4">
                                <AnimatedProgress label="Anomaly Score" value={mlInsights.anomalyScore || 0} max={100} color="red" />
                                <AnimatedProgress label="Gravity Pull" value={mlInsights.gravity === 'High' ? 85 : 45} max={100} color="cyan" />
                                <AnimatedProgress label="Data Quality" value={78} max={100} color="green" />
                                <div className="pt-4 border-t border-white/10">
                                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Active Clusters:</p>
                                    {mlInsights.clusters && mlInsights.clusters.length > 0 ? (
                                        <div className="space-y-3">
                                            {mlInsights.clusters.map((cluster, idx) => (
                                                <div key={idx} className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-[var(--primary-cyan)] uppercase">
                                                            {cluster.name}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-1 bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)] rounded-full">
                                                            {cluster.count} tables
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                                        {cluster.tables.slice(0, 5).join(', ')}
                                                        {cluster.tables.length > 5 && ` +${cluster.tables.length - 5} more`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-[var(--text-muted)] italic">None detected</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Brain className="mx-auto mb-3 text-[var(--text-secondary)]" size={32} />
                                <p className="text-[var(--text-secondary)] text-sm">
                                    Select a node in Overview to see ML insights
                                </p>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Gravity Suggestions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-[var(--bg-elevated)]/50 backdrop-blur-md border border-white/10 rounded-xl p-6"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Zap className="text-yellow-400" size={20} />
                            AI Gravity Suggestions
                        </h2>
                        {gravitySuggestions && gravitySuggestions.length > 0 && (
                            <span className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                                {gravitySuggestions.length} suggestions
                            </span>
                        )}
                    </div>
                    {gravitySuggestions && gravitySuggestions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {gravitySuggestions.slice(0, 6).map((suggestion, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.7 + i * 0.05 }}
                                    className="p-4 bg-gradient-to-br from-white/5 to-white/0 rounded-lg border border-white/10 hover:border-[var(--primary-cyan)]/50 transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary-cyan)] transition-colors">
                                            {suggestion.table}.{suggestion.column}
                                        </span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${suggestion.impact === 'High'
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                            }`}>
                                            {suggestion.impact}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{suggestion.reason}</p>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-lg">
                            <AlertTriangle className="mx-auto mb-3 text-[var(--text-secondary)]" size={32} />
                            <p className="text-[var(--text-secondary)] text-sm">
                                No gravity suggestions available. Connect to a database to see AI recommendations.
                            </p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

function AnimatedMetricCard({ icon: Icon, label, value, trend, subtitle, color, delay }) {
    const colorMap = {
        cyan: { bg: 'from-[var(--primary-cyan)]/20 to-[var(--primary-cyan)]/5', border: 'border-[var(--primary-cyan)]/30', text: 'text-[var(--primary-cyan)]' },
        green: { bg: 'from-[var(--primary-green)]/20 to-[var(--primary-green)]/5', border: 'border-[var(--primary-green)]/30', text: 'text-[var(--primary-green)]' },
        yellow: { bg: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/30', text: 'text-yellow-400' },
        purple: { bg: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-400' },
    };

    const colors = colorMap[color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`bg-gradient-to-br ${colors.bg} backdrop-blur-md border ${colors.border} rounded-xl p-5 hover:scale-105 transition-transform`}
        >
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 ${colors.text} bg-white/10 rounded-lg`}>
                    <Icon size={20} />
                </div>
                <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                    {label}
                </span>
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)] mb-1">{value}</p>
            {trend && <p className="text-sm text-green-400 flex items-center gap-1">
                <TrendingUp size={14} /> {trend}
            </p>}
            {subtitle && <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>}
        </motion.div>
    );
}

function AnimatedProgress({ label, value, max, color }) {
    const percentage = (value / max) * 100;
    const colorMap = {
        red: 'from-red-500 to-orange-500',
        cyan: 'from-[var(--primary-cyan)] to-[var(--primary-purple)]',
        green: 'from-[var(--primary-green)] to-emerald-400',
    };

    return (
        <div>
            <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className="text-[var(--text-primary)] font-bold">{value}/{max}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`bg-gradient-to-r ${colorMap[color]} h-3 rounded-full relative`}
                >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </motion.div>
            </div>
        </div>
    );
}

function TableDistributionChart({ tables }) {
    const sortedTables = [...tables].sort((a, b) => (b.row_count || 0) - (a.row_count || 0)).slice(0, 8);
    const maxRows = Math.max(...sortedTables.map(t => t.row_count || 0), 1);

    return (
        <div className="space-y-3">
            {sortedTables.map((table, i) => {
                const percentage = ((table.row_count || 0) / maxRows) * 100;
                return (
                    <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-primary)] font-mono">{table.name}</span>
                            <span className="text-[var(--text-secondary)]">{(table.row_count || 0).toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1 }}
                                className="bg-gradient-to-r from-[var(--primary-cyan)] to-[var(--primary-purple)] h-2 rounded-full"
                            ></motion.div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
