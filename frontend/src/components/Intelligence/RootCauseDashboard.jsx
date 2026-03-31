import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import { GitBranch, Box, Share2, ArrowDown, Info } from 'lucide-react';
import { SectionHeader, Loading, ErrorCard } from './HealthDashboard';
import { logger } from '../../utils/logger';

const COLOR = '#a855f7';

export default function RootCauseDashboard({ connectionId, tableName, accentColor }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const color = accentColor || COLOR;

    useEffect(() => {
        if (!tableName) return;
        let cancelled = false;
        (async () => {
            try {
                setError(null);
                setLoading(true);
                const res = await apiClient.get(`/intelligence/root-cause/${connectionId}/${tableName}`);
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setError(e.message);
                logger.error('Root cause failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [connectionId, tableName]);

    if (!tableName) return <Loading label="Resolving table…" color={color} />;
    if (loading)   return <Loading label="Tracing dependency impact…" color={color} />;
    if (error)     return <ErrorCard message={error} />;

    const impactPath = data?.impact_path ?? [];
    const riskScore  = data?.risk_score ?? 0;
    const riskCol    = riskScore > 70 ? '#f43f5e' : riskScore > 40 ? '#f59e0b' : '#10b981';

    return (
        <div className="p-6 space-y-4 max-w-4xl mx-auto">
            {/* Header + risk score */}
            <div className="flex items-start justify-between gap-4">
                <SectionHeader icon={GitBranch} color={color} title="Impact Analysis" subtitle={`Dependency propagation · ${tableName}`} />
                <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Impact Score</p>
                    <p className="text-4xl font-black tabular-nums" style={{ color: riskCol }}>{riskScore}</p>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                <p className="text-sm text-gray-300 leading-relaxed font-medium">
                    {data?.summary || 'Analyzing propagation paths…'}
                </p>
            </div>

            {/* Visual dependency chain */}
            <div className="space-y-0">
                {/* Source node */}
                <div className="flex flex-col items-center">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="w-full max-w-xs p-4 rounded-2xl border-2 flex items-center gap-3"
                        style={{ background: `${color}10`, borderColor: `${color}50` }}
                    >
                        <div className="p-2 rounded-xl" style={{ background: `${color}20` }}>
                            <Box size={20} style={{ color }} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>Source</p>
                            <p className="text-sm font-bold text-white">{tableName}</p>
                        </div>
                        <div className="ml-auto">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                                style={{ background: `${riskCol}18`, color: riskCol }}>
                                Risk {riskScore}
                            </span>
                        </div>
                    </motion.div>

                    {impactPath.length > 0 && (
                        <div className="flex flex-col items-center py-2 gap-1">
                            <motion.div
                                animate={{ y: [0, 4, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            >
                                <ArrowDown size={18} style={{ color }} />
                            </motion.div>
                        </div>
                    )}
                </div>

                {/* Affected nodes grid */}
                {impactPath.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {impactPath.map((item, i) => {
                            const sevCol = item.severity === 'high' ? '#f43f5e' : item.severity === 'medium' ? '#f59e0b' : '#64748b';
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.08 }}
                                    className="bg-white/[0.03] border border-white/[0.07] hover:border-purple-500/25 rounded-xl p-4 flex items-center gap-3 transition-all"
                                >
                                    <div className="p-2 rounded-lg bg-white/[0.05] shrink-0">
                                        <Share2 size={14} className="text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{item.table}</p>
                                        <p className="text-[11px] text-gray-500 truncate">{item.reason}</p>
                                    </div>
                                    <div className="w-1 h-8 rounded-full shrink-0" style={{ background: sevCol }} />
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-10 bg-white/[0.02] border border-dashed border-white/[0.07] rounded-xl">
                        <Info size={24} className="text-gray-600 mb-2" />
                        <p className="text-xs text-gray-500">No cascading dependencies detected</p>
                    </div>
                )}
            </div>

            {/* Footer note */}
            <div className="flex items-center gap-3 p-4 bg-white/[0.02] border rounded-xl"
                style={{ borderColor: `${color}18` }}>
                <GitBranch size={13} style={{ color }} className="shrink-0" />
                <p className="text-[11px] text-gray-500">
                    Dependency mapping is based on foreign key constraints and query join frequency detected by Neural Core.
                </p>
            </div>
        </div>
    );
}
