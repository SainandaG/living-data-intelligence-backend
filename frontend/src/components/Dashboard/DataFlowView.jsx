import React, { useEffect, useState } from 'react';
import { GitBranch, Database, ArrowRight, Zap } from 'lucide-react';

export default function DataFlowView({ connectionId }) {
    const [flowStats, setFlowStats] = useState(null);
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
                }
            } catch (err) {
                console.error('Failed to fetch flow stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFlowStats();
    }, [connectionId]);

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
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }) {
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
}

function FlowPattern({ title, description, active }) {
    return (
        <div className={`p-4 rounded-lg border ${active ? 'bg-[var(--primary-cyan)]/5 border-[var(--primary-cyan)]/30' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${active ? 'bg-[var(--primary-cyan)]' : 'bg-gray-500'}`}></div>
                <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] ml-4">{description}</p>
        </div>
    );
}
