import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Activity, ShieldCheck, AlertCircle, Info, Clock, Zap, Database } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import BlueprintOverlay from './BlueprintOverlay';

export default function HealthDashboard({ connectionId, tableName }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch real health history
                const historyRes = await axios.get(`/api/intelligence/health/history/${connectionId}`);
                if (historyRes.data.history) {
                    setHistory(historyRes.data.history.map(h => ({
                        time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        score: h.score
                    })));
                }

                const res = await axios.get(`/api/intelligence/health/${connectionId}`);
                setData(res.data);
            } catch (err) {
                console.error("Health fetch failed:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [connectionId]);

    if (loading) return (
        <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Analyzing System Vitality...</p>
            </div>
        </div>
    );

    const score = data?.health_score || 0;
    const state = data?.state || 'unknown';
    const color = data?.color || '#00ff88';

    return (
        <div className="p-8 h-full flex flex-col gap-6 overflow-y-auto bg-gradient-to-b from-transparent to-cyan-500/5">

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter italic">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30">
                            <Activity className="text-cyan-400 animate-pulse" size={24} />
                        </div>
                        SYSTEM VITALITY
                    </h2>
                    <p className="text-gray-400 font-mono text-[10px] uppercase tracking-[0.2em] mt-2 opacity-60">Real-time Neural Diagnostics / {tableName}</p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Health Score</p>
                        <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${score}%` }}
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                />
                            </div>
                            <span className="text-2xl font-black text-white font-mono">{score}%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Health Score Main Circle */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative w-48 h-48 mb-6">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                cx="50" cy="50" r="45"
                                fill="none" stroke="currentColor"
                                strokeWidth="8" className="text-white/5"
                            />
                            <motion.circle
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (283 * score / 100) }}
                                cx="50" cy="50" r="45"
                                fill="none" stroke={color}
                                strokeWidth="8" strokeDasharray="283"
                                strokeLinecap="round"
                                className="drop-shadow-[0_0_8px_rgba(0,255,136,0.3)]"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-bold text-white tabular-nums">{score}</span>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Score</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                        {state === 'healthy' ? <ShieldCheck className="text-green-400" size={16} /> : <AlertCircle className="text-red-400" size={16} />}
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-200">{state}</span>
                    </div>
                </div>

                {/* Status Card */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex-1 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                            <Activity size={80} className="text-cyan-500" />
                        </div>

                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                            <Info size={16} className="text-cyan-400" />
                            System Health Analysis
                        </h3>
                        <p className="text-2xl text-white font-medium mb-6 leading-tight max-w-[80%]">
                            {data?.simple_explanation}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Load Level</span>
                                <span className={`text-lg font-mono ${(data?.health_score || 0) > 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {(data?.visual_config?.pulse_speed || 1) > 1.5 ? 'Intense' : 'Optimal'}
                                </span>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Operational Stability</span>
                                <span className="text-lg font-mono text-cyan-400">{data?.health_score}%</span>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Risks</span>
                                <span className={`text-lg font-mono ${(data?.issues?.length || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {data?.issues?.length || 0} Detected
                                </span>
                            </div>
                        </div>

                        {data?.issues?.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle size={14} /> Critical Attention Required
                                </p>
                                {data.issues.map((issue, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ x: -10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-sm text-red-200">{issue}</span>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-cyan-500/30 transition-colors cursor-help">
                            <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                                <Activity size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Neural Activity</p>
                                <p className="text-lg font-mono text-white">{(data?.visual_config?.pulse_speed || 1).toFixed(1)}Hz</p>
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-purple-500/30 transition-colors cursor-help">
                            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                                <Zap size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Service Speed</p>
                                <p className="text-lg font-mono text-white">{data?.raw_metrics?.cache_hit_rate ? data.raw_metrics.cache_hit_rate + '%' : 'Optimizing...'}</p>
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-orange-500/30 transition-colors cursor-help">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400">
                                <Database size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Active Load</p>
                                <p className="text-lg font-mono text-white">{data?.raw_metrics?.active_connections || 'Searching...'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group overflow-hidden relative">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                            <Zap className="text-cyan-400" size={20} />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a0a0c] animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">Neural Diagnostic Stream</h4>
                        <div className="flex items-center gap-4 mt-1">
                            <span className="text-[10px] font-mono text-gray-400">TPS: {data?.raw_metrics?.transaction_rate || '0.0'}</span>
                            <div className="w-1 h-1 rounded-full bg-gray-600" />
                            <span className="text-[10px] font-mono text-gray-400">HIT_RATIO: {data?.raw_metrics?.cache_hit_rate || '99.9'}%</span>
                            <div className="w-1 h-1 rounded-full bg-gray-600" />
                            <span className="text-[10px] font-mono text-cyan-400/60 font-bold uppercase">Active Scanning table: {tableName}</span>
                        </div>
                    </div>
                </div>

                <div className="h-4 w-32 bg-white/5 rounded-full overflow-hidden border border-white/5 flex items-center justify-end px-1 gap-0.5">
                    {[...Array(12)].map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                height: [4, 12, 4],
                                opacity: [0.2, 0.6, 0.2]
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.1
                            }}
                            className="w-1 bg-cyan-500 rounded-full"
                        />
                    ))}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">24-Hour Health Trend</h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-cyan-500" />
                            <span>STABILITY</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full relative" style={{ minHeight: '300px', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history.length > 0 ? history : [{ time: '', score: 100 }]}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} itemStyle={{ color: '#fff', fontSize: '12px' }} />
                            <Area type="monotone" dataKey="score" stroke={color} fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} animationDuration={2000} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Scientific Alignment Blueprint */}
            <BlueprintOverlay connectionId={connectionId} tableName={tableName} />
        </div>
    );
}
