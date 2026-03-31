import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import { AlertTriangle, ShieldCheck, Cpu, Clock } from 'lucide-react';
import { SectionHeader, Loading, ErrorCard } from './HealthDashboard';
import { logger } from '../../utils/logger';
import { INTELLIGENCE_POLL_INTERVAL } from '../../config/timing';

const COLOR = '#f43f5e';

export default function AnomalyDashboard({ connectionId, accentColor }) {
    const [anomalies, setAnomalies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const color = accentColor || COLOR;

    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
            try {
                setError(null);
                const res = await apiClient.get(`/intelligence/anomalies/${connectionId}`);
                if (!cancelled) { setAnomalies(res.anomalies || []); setLoading(false); }
            } catch (e) {
                if (!cancelled) { setError(e.message); setLoading(false); }
                logger.error('Anomalies failed:', e);
            }
        };
        fetch();
        const t = setInterval(fetch, INTELLIGENCE_POLL_INTERVAL);
        return () => { cancelled = true; clearInterval(t); };
    }, [connectionId]);

    if (loading) return <Loading label="Scanning for anomalies…" color={color} />;
    if (error) return <ErrorCard message={error} />;

    const high   = anomalies.filter(a => a.severity === 'High').length;
    const medium = anomalies.filter(a => a.severity === 'Medium').length;
    const low    = anomalies.filter(a => a.severity === 'Low').length;

    return (
        <div className="p-6 space-y-4 max-w-4xl mx-auto">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader icon={AlertTriangle} color={color} title="Risk Detection" subtitle="Real-time anomaly monitoring" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0"
                    style={{ background: anomalies.length > 0 ? `${color}18` : '#10b98118', color: anomalies.length > 0 ? color : '#10b981', border: `1px solid ${anomalies.length > 0 ? color : '#10b981'}25` }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: 'currentColor' }} />
                    {anomalies.length} Detected
                </div>
            </div>

            {/* Summary chips */}
            {anomalies.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'High',   count: high,   col: '#f43f5e' },
                        { label: 'Medium', count: medium, col: '#f59e0b' },
                        { label: 'Low',    count: low,    col: '#64748b' },
                    ].map(s => (
                        <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-center">
                            <p className="text-2xl font-black" style={{ color: s.col }}>{s.count}</p>
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">{s.label} Severity</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Anomaly cards */}
            <div className="space-y-3">
                <AnimatePresence>
                    {anomalies.map((a, i) => {
                        const sCol = a.severity === 'High' ? '#f43f5e' : a.severity === 'Medium' ? '#f59e0b' : '#64748b';
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/[0.03] border rounded-xl p-5 flex items-start gap-4 transition-colors"
                                style={{ borderColor: `${sCol}25` }}
                            >
                                <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${sCol}15` }}>
                                    <AlertTriangle size={18} style={{ color: sCol }} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
                                            style={{ background: `${sCol}20`, color: sCol }}>
                                            {a.severity}
                                        </span>
                                        <span className="text-sm font-bold text-white">{a.metric}</span>
                                    </div>
                                    <p className="text-[13px] text-gray-400 leading-relaxed">{a.explanation}</p>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <p className="text-[10px] text-gray-600 uppercase tracking-wider">Now</p>
                                    <p className="text-lg font-black tabular-nums" style={{ color: sCol }}>{a.current_value}</p>
                                    <p className="text-[10px] text-gray-600 tabular-nums">
                                        Base: {a.expected_value != null ? Number(a.expected_value).toFixed(1) : '—'}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {anomalies.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 bg-white/[0.02] border border-dashed border-white/[0.07] rounded-xl">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 mb-3">
                            <ShieldCheck size={24} className="text-emerald-400" />
                        </div>
                        <p className="text-sm font-semibold text-gray-400">No active anomalies</p>
                        <p className="text-[11px] text-gray-600 mt-1 uppercase tracking-widest">System integrity 100%</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center gap-3">
                    <Cpu size={14} className="text-cyan-400 shrink-0" />
                    <div>
                        <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">Engine</p>
                        <p className="text-[11px] text-white">Neural Core V3 · Z-Score</p>
                    </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center gap-3">
                    <Clock size={14} className="text-purple-400 shrink-0" />
                    <div>
                        <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">Refresh</p>
                        <p className="text-[11px] text-white">Every 10 seconds</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
