import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import { TrendingUp, Calendar, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area,
    XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { SectionHeader, Loading, ErrorCard } from './HealthDashboard';
import { logger } from '../../utils/logger';

const COLOR = '#f59e0b';

export default function PredictionDashboard({ connectionId, tableName, accentColor }) {
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
                const res = await apiClient.get(`/intelligence/predictions/${connectionId}/${tableName}`);
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setError(e.message);
                logger.error('Predictions failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [connectionId, tableName]);

    if (!tableName) return <Loading label="Resolving table…" color={color} />;
    if (loading)   return <Loading label="Computing future states…" color={color} />;
    if (error)     return <ErrorCard message={error} />;

    const forecast = data?.forecast ?? [];
    const growth   = data?.growth_percentage_30d ?? 0;
    const risk     = data?.risk_level ?? 'Low';
    const current  = data?.current_size ?? 0;
    const predicted = data?.predicted_size_30d ?? 0;
    const riskCol  = risk === 'High' ? '#f43f5e' : risk === 'Medium' ? '#f59e0b' : '#10b981';

    const confidence = data?.can_predict === false ? 'Low'
        : forecast.length >= 20 ? 'High'
        : forecast.length >= 10 ? 'Medium'
        : forecast.length > 0  ? 'Low'
        : null;

    const tooltipStyle = {
        contentStyle: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 },
        itemStyle: { color: color },
    };

    return (
        <div className="p-6 space-y-4 max-w-5xl mx-auto">
            <SectionHeader icon={TrendingUp} color={color} title="Future Forecast" subtitle={tableName} />

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="30-Day Growth" value={`+${growth}%`} color={color} />
                <KPI label="Current Records" value={current.toLocaleString()} color="#94a3b8" />
                <KPI label="Predicted (30d)" value={predicted.toLocaleString()} color={color} />
                <KPI label="Confidence" value={confidence ?? '—'} color={confidence === 'High' ? '#10b981' : confidence === 'Medium' ? color : '#64748b'} />
            </div>

            {/* Risk banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl border"
                style={{ background: `${riskCol}0d`, borderColor: `${riskCol}25` }}>
                <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${riskCol}18` }}>
                    {risk === 'High'
                        ? <AlertTriangle size={15} style={{ color: riskCol }} />
                        : <ShieldCheck size={15} style={{ color: riskCol }} />}
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: riskCol }}>{risk} Risk</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{data?.summary}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={12} style={{ color }} /> 30-Day Load Forecast
                    </p>
                    {confidence && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color }}>
                            <Zap size={11} /> {confidence} Confidence
                        </span>
                    )}
                </div>

                {forecast.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={forecast}>
                            <defs>
                                <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 9, fill: '#4b5563' }}
                                axisLine={false} tickLine={false}
                                tickFormatter={v => v.split('-').slice(1).join('/')}
                            />
                            <YAxis
                                tick={{ fontSize: 9, fill: '#4b5563' }}
                                axisLine={false} tickLine={false} width={36}
                                tickFormatter={v => v > 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                            />
                            <Tooltip {...tooltipStyle} />
                            <Area
                                type="stepAfter"
                                dataKey="predicted_count"
                                stroke={color}
                                strokeWidth={2.5}
                                strokeDasharray="5 4"
                                fill="url(#fg)"
                                dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-40 flex items-center justify-center">
                        <p className="text-xs text-gray-600 italic">Insufficient data for forecast chart</p>
                    </div>
                )}

                <div className="flex items-center gap-4 pt-3 border-t border-white/[0.05] text-[10px] font-bold text-gray-600">
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-px border-t-2 border-dashed" style={{ borderColor: color }} />
                        <span>Predicted trend</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <motion.div
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: color }}
                        />
                        <span>Live model</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPI({ label, value, color }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1">{label}</p>
            <p className="text-xl font-black tabular-nums" style={{ color }}>{value}</p>
        </div>
    );
}
