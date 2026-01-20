import React, { useEffect, useState } from 'react';
import { Brain, Activity, Zap, Info, Play, ChartBarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function IntelligencePanel({ connectionId, tableName, onSimulate }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                setLoading(true);
                setError(null);
                console.log(`[IntelligencePanel] Fetching analysis for ${connectionId}/${tableName}`);
                const response = await fetch(`/api/evolution/analysis/table/${connectionId}/${tableName}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                console.log('[IntelligencePanel] Analysis data:', data);
                setAnalysis(data);
            } catch (err) {
                console.error('[IntelligencePanel] Analysis fetch error:', err);
                setError(err.message);
                // Set fallback data so panel still renders
                setAnalysis({
                    table_name: tableName,
                    metrics: {
                        gravity: 1.5,
                        vitality: 50.0,
                        entropy: 0.1234,
                        hub_score: 0.5,
                        in_degree: 0,
                        out_degree: 0,
                        row_count: 0
                    },
                    proofs: {
                        gravity: "G = σ(log10(N) + C_s - 3.0) = 1.50",
                        vitality: "V = min(100, 20log10(N) + 5G) = 50.0%",
                        entropy: "H(x) = -Σ P(x)log2 P(x) = 0.1234"
                    },
                    narrative: `Analyzing node '${tableName}'... Neural Core is computing structural metrics.`
                });
            } finally {
                setLoading(false);
            }
        };

        if (connectionId && tableName) {
            fetchAnalysis();
        }
    }, [connectionId, tableName]);

    if (loading) {
        return (
            <div className="p-4 flex flex-col gap-3 animate-pulse">
                <div className="h-4 bg-white/5 rounded w-3/4"></div>
                <div className="h-20 bg-white/5 rounded w-full"></div>
                <div className="h-4 bg-white/5 rounded w-1/2"></div>
            </div>
        );
    }

    // Always render even if no data
    const metrics = analysis?.metrics || { gravity: 1.0, vitality: 50, entropy: 0, hub_score: 0, in_degree: 0, out_degree: 0, row_count: 0 };
    const proofs = analysis?.proofs || { gravity: "Loading...", vitality: "Loading...", entropy: "Loading..." };
    const narrative = analysis?.narrative || "Initializing intelligence analysis...";

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-4"
        >
            {error && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
                    <p className="text-yellow-400 text-xs">⚠️ Using fallback data: {error}</p>
                </div>
            )}

            <div className="bg-[var(--primary-cyan)]/10 border border-[var(--primary-cyan)]/20 p-4 rounded-xl">
                <h3 className="text-[var(--primary-cyan)] font-mono text-xs uppercase mb-3 flex items-center gap-2">
                    <Brain size={14} />
                    AI Structural Narrative
                </h3>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed italic">
                    "{narrative}"
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <MetricBox
                    icon={<Zap size={14} />}
                    label="Vitality"
                    value={`${metrics.vitality.toFixed(1)}%`}
                    color="text-green-400"
                />
                <MetricBox
                    icon={<Activity size={14} />}
                    label="Entropy"
                    value={metrics.entropy.toFixed(4)}
                    color="text-purple-400"
                />
            </div>

            <div className="space-y-3">
                <h3 className="text-[var(--text-secondary)] font-mono text-[10px] uppercase tracking-wider mb-2">Mathematical Blueprints</h3>
                {Object.entries(proofs).map(([key, proof]) => (
                    <div key={key} className="bg-black/40 border border-white/5 p-3 rounded-lg">
                        <p className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase">{key} proof</p>
                        <code className="text-xs font-mono text-[var(--primary-cyan)] block overflow-x-auto whitespace-nowrap">
                            {proof}
                        </code>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

function MetricBox({ icon, label, value, color }) {
    return (
        <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-1">
                {icon}
                <span className="text-[10px] uppercase font-mono">{label}</span>
            </div>
            <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
        </div>
    );
}
