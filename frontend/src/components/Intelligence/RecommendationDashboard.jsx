import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import { Lightbulb, Sparkles, ArrowRight, AlertCircle, TrendingUp, CheckCircle2, Activity } from 'lucide-react';
import { SectionHeader, Loading, ErrorCard } from './HealthDashboard';
import { logger } from '../../utils/logger';

const COLOR = '#f97316';

export default function RecommendationDashboard({ connectionId, tableName, accentColor, setActiveTab }) {
    const [recs, setRecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const color = accentColor || COLOR;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setError(null);
                const url = tableName
                    ? `/intelligence/recommendations/${connectionId}/${tableName}`
                    : `/intelligence/recommendations/${connectionId}`;
                const res = await apiClient.get(url);
                if (!cancelled) setRecs(res.recommendations || []);
            } catch (e) {
                if (!cancelled) setError(e.message);
                logger.error('Recommendations failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [connectionId, tableName]);

    if (loading) return <Loading label="Generating smart actions…" color={color} />;
    if (error)   return <ErrorCard message={error} />;

    const high    = recs.filter(r => r.urgency === 'High').length;
    const secRecs = recs.filter(r => r.category === 'Security').length;
    const optPct  = Math.max(0, 100 - high * 15 - (recs.length - high) * 5);
    const compPct = Math.max(60, 100 - secRecs * 10 - high * 4);

    const navigate = (action) => {
        const map = {
            'View Full Status':       'deep-status',
            'Open Metrics Explorer':  'deep-status',
            'Trace Root Cause':       'root-cause',
            'Review Anomalies':       'anomalies',
            'Run Quality Scan':       'health',
            'Configure Partitioning': 'predictions',
        };
        setActiveTab?.(map[action] || 'deep-status');
    };

    return (
        <div className="p-6 space-y-4 max-w-5xl mx-auto">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader icon={Sparkles} color={color} title="Action Plans" subtitle="AI-driven recommendations" />
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                    <Lightbulb size={12} /> {recs.length} actions
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBadge icon={TrendingUp}   label="Optimization" value={`${optPct}%`}          color={color} />
                <StatBadge icon={CheckCircle2} label="Compliance"   value={`${compPct}/100`}       color="#10b981" />
                <StatBadge icon={Activity}     label="Actions"      value={recs.length.toString()} color={color} />
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 flex items-center gap-2">
                    <Sparkles size={14} style={{ color }} />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI Copilot Active</span>
                </div>
            </div>

            {/* Recommendation cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnimatePresence>
                    {recs.map((rec, i) => {
                        const urgCol = rec.urgency === 'High' ? '#f43f5e' : '#f59e0b';
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="bg-white/[0.03] border border-white/[0.07] hover:border-orange-500/25 rounded-xl p-5 flex flex-col gap-3 transition-all group"
                            >
                                {/* Top row */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
                                        style={{ background: `${color}18`, color }}>
                                        {rec.category}
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: urgCol }}>
                                        <AlertCircle size={11} /> {rec.urgency}
                                    </span>
                                </div>

                                {/* Title */}
                                <h3 className="text-sm font-bold text-white group-hover:text-orange-300 transition-colors leading-snug">
                                    {rec.title}
                                </h3>

                                {/* Description */}
                                <p className="text-[12px] text-gray-400 leading-relaxed flex-1">
                                    {rec.description}
                                </p>

                                {/* Solution */}
                                {rec.solution && (
                                    <div className="bg-black/30 rounded-lg p-3 border border-white/[0.05]">
                                        <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold mb-1">Solution</p>
                                        <p className="text-[12px] text-gray-300 italic leading-relaxed">{rec.solution}</p>
                                    </div>
                                )}

                                {/* Benefit */}
                                {rec.benefit && (
                                    <p className="text-[11px] italic" style={{ color: `${color}cc` }}>"{rec.benefit}"</p>
                                )}

                                {/* CTA */}
                                <button
                                    onClick={() => navigate(rec.action)}
                                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
                                    style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
                                    onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#000'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.color = color; }}
                                >
                                    {rec.action}
                                    <ArrowRight size={13} />
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {recs.length === 0 && (
                <div className="flex flex-col items-center py-14 bg-white/[0.02] border border-dashed border-white/[0.07] rounded-xl">
                    <CheckCircle2 size={28} className="text-emerald-400 mb-3" />
                    <p className="text-sm font-semibold text-gray-400">No actions required</p>
                    <p className="text-[11px] text-gray-600 mt-1">System is operating optimally</p>
                </div>
            )}
        </div>
    );
}

function StatBadge({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 flex items-center gap-2.5">
            <Icon size={14} style={{ color }} className="shrink-0" />
            <div>
                <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold leading-none">{label}</p>
                <p className="text-sm font-bold text-white mt-0.5">{value}</p>
            </div>
        </div>
    );
}
