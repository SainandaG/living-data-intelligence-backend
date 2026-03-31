import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import { Activity, ShieldCheck, AlertCircle, Zap, Database, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import BlueprintOverlay from './BlueprintOverlay';
import { logger } from '../../utils/logger';
import { INTELLIGENCE_POLL_INTERVAL } from '../../config/timing';

const COLOR = '#10b981';

function Stat({ label, value, sub, accent }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
            <span className="text-2xl font-black text-white tabular-nums" style={{ color: accent }}>{value}</span>
            {sub && <span className="text-[11px] text-gray-600">{sub}</span>}
        </div>
    );
}

function HealthDashboard({ connectionId, tableName, accentColor }) {
    const [data, setData] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const color = accentColor || COLOR;

    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
            try {
                setError(null);
                const [hist, health] = await Promise.all([
                    apiClient.get(`/intelligence/health/history/${connectionId}`),
                    apiClient.get(`/intelligence/health/${connectionId}`),
                ]);
                if (cancelled) return;
                if (hist?.history) {
                    setHistory(hist.history.map(h => ({
                        time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        score: h.score,
                    })));
                }
                setData(health);
            } catch (e) {
                if (!cancelled) setError(e.message);
                logger.error('Health fetch failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetch();
        const t = setInterval(fetch, INTELLIGENCE_POLL_INTERVAL);
        return () => { cancelled = true; clearInterval(t); };
    }, [connectionId]);

    if (loading) return <Loading label="Analyzing system vitality…" color={color} />;
    if (error) return <ErrorCard message={error} />;

    const score = data?.health_score ?? 0;
    const state = data?.state ?? 'unknown';
    const issues = data?.issues ?? [];
    const metrics = data?.raw_metrics ?? {};
    const stateColor = state === 'healthy' ? '#10b981' : state === 'stressed' ? '#f59e0b' : '#f43f5e';

    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (circumference * score) / 100;

    return (
        <div className="p-6 space-y-4 max-w-5xl mx-auto">

            {/* Title row */}
            <SectionHeader
                icon={Activity}
                color={color}
                title="System Health"
                subtitle={tableName ? `Scanning · ${tableName}` : 'Global scan'}
            />

            {/* Hero row: score ring + state + metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Score ring */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
                    <div className="relative w-32 h-32">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                            <motion.circle
                                cx="50" cy="50" r="42" fill="none"
                                stroke={stateColor} strokeWidth="8"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: offset }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                                strokeLinecap="round"
                                style={{ filter: `drop-shadow(0 0 6px ${stateColor}80)` }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-white tabular-nums">{score}</span>
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Score</span>
                        </div>
                    </div>
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                        style={{ background: `${stateColor}18`, color: stateColor, border: `1px solid ${stateColor}30` }}
                    >
                        {state === 'healthy' ? <ShieldCheck size={13} /> : <AlertCircle size={13} />}
                        {state}
                    </div>
                </div>

                {/* Analysis card */}
                <div className="md:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 flex flex-col gap-4">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Health Analysis</p>
                    <p className="text-base text-white leading-relaxed font-medium">
                        {data?.simple_explanation || 'Collecting diagnostics…'}
                    </p>

                    <div className="grid grid-cols-3 gap-3 mt-auto">
                        <Stat label="Pulse" value={`${(data?.visual_config?.pulse_speed ?? 1).toFixed(1)}Hz`} />
                        <Stat label="Cache Hit" value={metrics.cache_hit_rate != null ? `${metrics.cache_hit_rate}%` : '—'} accent={color} />
                        <Stat label="Connections" value={metrics.active_connections ?? '—'} />
                    </div>

                    {issues.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                            {issues.map((issue, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-red-300">
                                    <AlertCircle size={13} className="text-red-400 shrink-0" />
                                    {issue}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Metric chips */}
            <div className="grid grid-cols-3 gap-3">
                <MetricChip icon={Activity} label="TPS" value={metrics.transaction_rate ?? '0.0'} color={color} />
                <MetricChip icon={Zap} label="Load Level" value={(data?.visual_config?.pulse_speed ?? 1) > 1.5 ? 'Intense' : 'Optimal'} color={color} />
                <MetricChip icon={Database} label="Active Risks" value={`${issues.length} detected`} color={issues.length > 0 ? '#f43f5e' : color} />
            </div>

            {/* History chart */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp size={13} style={{ color }} /> Health Trend
                </p>
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history.length > 0 ? history : [{ time: '', score: score }]}>
                            <defs>
                                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={stateColor} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={stateColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="score" stroke={stateColor} strokeWidth={2.5} fill="url(#hg)" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Blueprint */}
            {tableName && <BlueprintOverlay connectionId={connectionId} tableName={tableName} />}
        </div>
    );
}

function MetricChip({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="p-1.5 rounded-lg" style={{ background: `${color}18` }}>
                <Icon size={14} style={{ color }} />
            </div>
            <div>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-white">{value}</p>
            </div>
        </div>
    );
}

export function SectionHeader({ icon: Icon, color, title, subtitle }) {
    return (
        <div className="flex items-center gap-3 pb-1">
            <div className="p-2 rounded-xl" style={{ background: `${color}18` }}>
                <Icon size={16} style={{ color }} />
            </div>
            <div>
                <h2 className="text-sm font-bold text-white">{title}</h2>
                {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
            </div>
        </div>
    );
}

export function Loading({ label, color }) {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-12">
            <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: color || '#10b981' }} />
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{label || 'Loading…'}</p>
        </div>
    );
}

export function ErrorCard({ message }) {
    return (
        <div className="m-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
            Intelligence service unavailable — {message}
        </div>
    );
}

export default React.memo(HealthDashboard);
