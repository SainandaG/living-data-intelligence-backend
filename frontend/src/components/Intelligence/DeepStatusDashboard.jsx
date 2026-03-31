import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import { Zap, TrendingUp, Database, ShieldCheck, Info, Activity } from 'lucide-react';
import { SectionHeader, Loading, ErrorCard } from './HealthDashboard';
import { logger } from '../../utils/logger';
import { INTELLIGENCE_POLL_INTERVAL } from '../../config/timing';

const COLOR = '#3b82f6';

export default function DeepStatusDashboard({ connectionId, tableName, accentColor }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const color = accentColor || COLOR;

    useEffect(() => {
        if (!tableName) return;
        let cancelled = false;
        const fetch = async () => {
            try {
                setError(null);
                setLoading(true);
                const res = await apiClient.get(`/intelligence/deep-status/${connectionId}/${tableName}`);
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setError(e.message);
                logger.error('Deep Status failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetch();
        const t = setInterval(fetch, INTELLIGENCE_POLL_INTERVAL);
        return () => { cancelled = true; clearInterval(t); };
    }, [connectionId, tableName]);

    if (!tableName) return <Loading label="Resolving table…" color={color} />;
    if (loading) return <Loading label="Running deep diagnostics…" color={color} />;
    if (error) return <ErrorCard message={error} />;

    const globalState = data?.global?.state ?? 'unknown';
    const globalScore = data?.global?.score ?? 0;
    const nodeScore = data?.node?.score ?? 0;
    const rowCount = data?.node?.row_count ?? 0;
    const growth = data?.node?.growth_rate ?? null;
    const projected = data?.node?.projected_30d ?? null;
    const samples = data?.node?.samples ?? [];
    const bizStory = data?.node?.business_story ?? [];
    const cacheHit = data?.raw_metrics?.cache_hit_rate;
    const tps = data?.raw_metrics?.transaction_rate;
    const stateColor = globalState === 'healthy' ? '#10b981' : globalState === 'stressed' ? '#f59e0b' : '#f43f5e';

    return (
        <div className="p-6 space-y-4 max-w-5xl mx-auto">
            <SectionHeader icon={Zap} color={color} title="Deep Diagnostics" subtitle={`Granular analysis · ${tableName}`} />

            {/* Live stream bar */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Activity size={14} style={{ color }} />
                    <div className="flex items-center gap-4 font-mono text-[10px] text-gray-500">
                        <span>STREAM: <span className="text-gray-300">{data?.connection_id?.slice(0, 8) ?? '—'}</span></span>
                        <span className="text-white/10">|</span>
                        <span>CACHE: <span className="text-gray-300">{cacheHit != null ? `${cacheHit}%` : '—'}</span></span>
                        <span className="text-white/10">|</span>
                        <span>TPS: <span className="text-gray-300">{tps ?? '0.0'}</span></span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: stateColor }} />
                    <span className="text-[10px] font-bold uppercase" style={{ color: stateColor }}>{globalState}</span>
                </div>
            </div>

            {/* Score cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Global Score',    value: `${globalScore}%`, color: stateColor },
                    { label: 'Node Score',      value: `${nodeScore.toFixed(1)}%`, color },
                    { label: 'Row Count',       value: rowCount.toLocaleString(), color: '#94a3b8' },
                    { label: 'Daily Momentum',  value: growth != null ? `${growth > 0 ? '+' : ''}${growth}%` : '—', color: growth > 0 ? '#10b981' : '#94a3b8' },
                ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1">{s.label}</p>
                        <p className="text-xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Business story + growth */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Business story */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Database size={12} style={{ color }} /> Business Data Story
                    </p>
                    {bizStory.length > 0 ? (
                        <div className="space-y-2">
                            {bizStory.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/[0.05]">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.label}</p>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white tabular-nums">
                                            {item.label.toLowerCase().includes('price') || item.label.toLowerCase().includes('amount') ? '$' : ''}
                                            {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                                        </p>
                                        {item.insight && <p className="text-[9px] text-gray-600 italic max-w-[160px] truncate">{item.insight}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-600 italic text-center py-6">Performing deep mathematical scan…</p>
                    )}
                </div>

                {/* Growth readiness */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-4">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={12} style={{ color }} /> Growth Readiness
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05]">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">30-Day Projection</p>
                            <p className="text-lg font-black text-white">{projected != null ? projected.toLocaleString() : '—'}</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05]">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Node Efficiency</p>
                            <p className="text-lg font-black" style={{ color }}>{nodeScore.toFixed(1)}%</p>
                        </div>
                    </div>

                    {/* Progress bar for node score */}
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                            <span>Integrity</span><span>{nodeScore.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${nodeScore}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                        </div>
                    </div>

                    {/* Integrity footer */}
                    <div className="flex items-center gap-2 pt-1">
                        <ShieldCheck size={13} className="text-green-400 shrink-0" />
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                            <span className="text-gray-300 font-semibold">{rowCount.toLocaleString()}</span> live records · integrity score <span className="text-gray-300 font-semibold">{nodeScore.toFixed(1)}%</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Data samples */}
            {samples.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Live Data Samples</p>
                    <div className="space-y-1.5">
                        {samples.slice(0, 5).map((row, i) => (
                            <div key={i} className="flex gap-3 text-[10px] font-mono bg-black/30 px-3 py-2 rounded-lg border border-white/[0.04] truncate">
                                {Object.entries(row).slice(0, 4).map(([k, v]) => (
                                    <span key={k} className="flex gap-1">
                                        <span style={{ color: `${color}80` }}>{k.toUpperCase()}</span>
                                        <span className="text-gray-300">{String(v)}</span>
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer note */}
            <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                <Info size={14} style={{ color }} className="shrink-0" />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                    Global health is <span className="font-bold" style={{ color: stateColor }}>{globalState}</span>.
                    Table <span className="text-gray-300 font-semibold">"{tableName}"</span> contributes{' '}
                    <span className="text-gray-300 font-semibold">{nodeScore.toFixed(1)}%</span> to node-level efficiency.
                    {rowCount === 0 && ' No records detected for trend analysis.'}
                </p>
            </div>
        </div>
    );
}
