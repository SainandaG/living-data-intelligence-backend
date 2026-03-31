import { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { BarChart3, Clock, Calendar, TrendingUp, Zap } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    Tooltip, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { SectionHeader, Loading, ErrorCard } from './HealthDashboard';
import { logger } from '../../utils/logger';

const COLOR = '#6366f1';

export default function PatternDashboard({ connectionId, tableName, accentColor }) {
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
                const res = await apiClient.get(`/intelligence/patterns/${connectionId}/${tableName}`);
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setError(e.message);
                logger.error('Patterns failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [connectionId, tableName]);

    if (!tableName) return <Loading label="Resolving table…" color={color} />;
    if (loading) return <Loading label="Detecting behavioral cycles…" color={color} />;
    if (error) return <ErrorCard message={error} />;

    const hourly = data?.daily_cycle
        ? Object.entries(data.daily_cycle).map(([h, count]) => ({ hour: `${h}h`, count }))
        : [];
    const daily = data?.weekly_cycle
        ? Object.entries(data.weekly_cycle).map(([d, count]) => ({
            day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][+d],
            count,
        }))
        : [];
    const peaks = data?.peaks ?? {};

    // coefficient of variation
    const cv = (() => {
        if (hourly.length < 3) return null;
        const vals = hourly.map(d => d.count);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (mean === 0) return null;
        const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
        return std / mean;
    })();
    const variance = cv === null ? null : cv < 0.5 ? 'Stable' : cv < 1.0 ? 'Variable' : 'Volatile';

    const syncLabel = peaks.peak_hour != null
        ? peaks.peak_hour < 6 ? 'Nocturnal' : peaks.peak_hour < 12 ? 'Morning' : peaks.peak_hour < 18 ? 'Daytime' : 'Evening'
        : null;

    const tooltipStyle = {
        contentStyle: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 },
        itemStyle: { color: '#fff' },
        cursor: { fill: 'rgba(255,255,255,0.03)' },
    };

    return (
        <div className="p-6 space-y-4 max-w-5xl mx-auto">
            <SectionHeader icon={BarChart3} color={color} title="Behavior Patterns" subtitle={tableName} />

            {/* Summary */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                    {data?.summary || 'No clear patterns detected yet. System is still learning your data behavior.'}
                </p>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hourly */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={12} style={{ color }} /> Daily Activity Cycle
                        </p>
                        {peaks.peak_hour !== undefined && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: `${color}18`, color }}>
                                Peak {peaks.peak_hour}:00
                            </span>
                        )}
                    </div>
                    {hourly.length > 0 ? (
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={hourly} barCategoryGap="30%">
                                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} width={28} />
                                <Tooltip {...tooltipStyle} />
                                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                                    {hourly.map((e, i) => (
                                        <Cell key={i} fill={+e.hour.replace('h','') === peaks.peak_hour ? color : `${color}40`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-xs text-gray-600 italic text-center py-10">No hourly data yet</p>
                    )}
                </div>

                {/* Weekly */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={12} style={{ color }} /> Weekly Distribution
                        </p>
                        {peaks.peak_day_name && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: `${color}18`, color }}>
                                Busiest: {peaks.peak_day_name}
                            </span>
                        )}
                    </div>
                    {daily.length > 0 ? (
                        <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={daily}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} width={28} />
                                <Tooltip {...tooltipStyle} />
                                <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2.5}
                                    dot={{ fill: color, r: 3, strokeWidth: 0 }}
                                    activeDot={{ r: 5, strokeWidth: 0 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-xs text-gray-600 italic text-center py-10">No weekly data yet</p>
                    )}
                </div>
            </div>

            {/* Insight chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InsightChip
                    icon={Zap}
                    label="Weekend Load"
                    value={peaks.is_weekend_heavy ? 'High' : 'Normal'}
                    detail={peaks.is_weekend_heavy ? 'Spikes Fri–Sun' : 'Weekday focused'}
                    status={peaks.is_weekend_heavy ? 'warn' : 'ok'}
                    color={color}
                />
                <InsightChip
                    icon={TrendingUp}
                    label="Traffic Variance"
                    value={variance ?? 'No Data'}
                    detail={variance === 'Volatile' ? 'High spikes — investigate' : variance === 'Variable' ? 'Moderate fluctuations' : variance === 'Stable' ? 'No erratic spikes' : 'Insufficient data'}
                    status={variance === 'Volatile' ? 'warn' : 'ok'}
                    color={color}
                />
                <InsightChip
                    icon={Clock}
                    label="Sync Pattern"
                    value={syncLabel ?? 'No Data'}
                    detail={peaks.peak_hour != null ? `Peaks at ${peaks.peak_hour}:00` : 'No peak detected'}
                    status="info"
                    color={color}
                />
            </div>
        </div>
    );
}

function InsightChip({ icon: Icon, label, value, detail, status, color }) {
    const bg = status === 'warn' ? '#f59e0b' : status === 'ok' ? '#10b981' : color;
    return (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
            <div className="p-1.5 rounded-lg w-fit mb-3" style={{ background: `${bg}18` }}>
                <Icon size={14} style={{ color: bg }} />
            </div>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1">{label}</p>
            <p className="text-base font-bold text-white mb-1">{value}</p>
            <p className="text-[11px] text-gray-500">{detail}</p>
        </div>
    );
}
