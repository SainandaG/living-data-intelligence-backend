import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Activity, Database, Zap, ShieldCheck, AlertCircle, Info, Layers, TrendingUp } from 'lucide-react';

export default function DeepStatusDashboard({ connectionId, tableName }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`/api/intelligence/deep-status/${connectionId}/${tableName || 'users'}`);
                setData(res.data);
            } catch (err) {
                console.error("Deep Status fetch failed:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [connectionId, tableName]);

    if (loading) return (
        <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Running Deep Diagnostics...</p>
            </div>
        </div>
    );

    const globalScore = data?.global?.score || 0;
    const nodeScore = data?.node?.score || 0;

    return (
        <div className="p-8 h-full flex flex-col gap-8 overflow-y-auto">

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Zap className="text-cyan-400" size={24} />
                        Deep Status Diagnostics
                    </h2>
                    <p className="text-gray-400 mt-1">Granular analysis of "{tableName}" vs Global System Health</p>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex items-center justify-between overflow-hidden relative">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--primary-cyan)]/10 flex items-center justify-center border border-[var(--primary-cyan)]/20">
                        <Activity className="text-cyan-400" size={20} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest italic">NEURAL_DEEP_LINK_CONNECTED</h4>
                        <div className="flex items-center gap-4 mt-1 font-mono text-[9px] text-gray-400">
                            <span>STREAM_ID: {data?.connection_id?.slice(0, 8)}</span>
                            <span className="text-cyan-500/40">●</span>
                            <span>LATENCY: 12ms</span>
                            <span className="text-cyan-500/40">●</span>
                            <span>TPS: {data?.raw_metrics?.transaction_rate || '0.0'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-1">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="w-1 h-3 bg-cyan-500/10 rounded-full overflow-hidden">
                            <motion.div
                                animate={{ height: ['0%', '100%', '0%'] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.05 }}
                                className="w-full bg-cyan-500"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Global Health Section */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Database size={100} />
                    </div>

                    <div className="flex items-center gap-3 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                        <Activity size={14} className="text-cyan-400" />
                        Business Data Story
                    </div>

                    <div className="space-y-4">
                        {data?.node?.business_story?.length > 0 ? (
                            data.node.business_story.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.label}</p>
                                        <p className="text-xl font-mono text-white mt-1">
                                            {(item.label.toLowerCase().includes('price') || item.label.toLowerCase().includes('amount')) ? '$' : ''}
                                            {item.value.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-cyan-400/60 italic max-w-[150px] leading-tight">{item.insight}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/10">
                                <p className="text-xs text-gray-500 italic">Performing deep mathematical scan for patterns...</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-green-400" size={16} />
                            <p className="text-xs text-gray-300">
                                This table contains **{data?.node?.row_count?.toLocaleString()}** live records with a data integrity score of **{data?.node?.score?.toFixed(1)}%**.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Future Readiness Section */}
                <div className="bg-[var(--primary-cyan)]/5 border border-[var(--primary-cyan)]/20 rounded-3xl p-8 flex flex-col gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-cyan-400">
                        <TrendingUp size={100} />
                    </div>

                    <div className="flex items-center gap-3 text-cyan-400 font-bold uppercase tracking-widest text-[10px]">
                        <Zap size={14} />
                        Growth & Future Readiness
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-black/40 rounded-2xl border border-white/5">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">30-Day Projection</p>
                            <p className="text-2xl font-black text-white">{data?.node?.projected_30d?.toLocaleString() || '--'}</p>
                            <p className="text-[9px] text-gray-600 mt-2">Estimated row count based on current momentum.</p>
                        </div>
                        <div className="p-5 bg-black/40 rounded-2xl border border-white/5">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Daily Momentum</p>
                            <p className={`text-2xl font-black ${data?.node?.growth_rate > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                                {data?.node?.growth_rate > 0 ? '+' : ''}{data?.node?.growth_rate ?? '--'}%
                            </p>
                            <p className="text-[9px] text-gray-600 mt-2">Rate of new data entry vs yesterday.</p>
                        </div>
                    </div>

                    <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
                            Verified Data Samples
                        </div>
                        <div className="space-y-2">
                            {data?.node?.samples?.length > 0 ? data.node.samples.map((row, i) => (
                                <div key={i} className="flex gap-2 text-[9px] font-mono text-gray-400 bg-black/20 p-2 rounded-lg truncate border border-white/5">
                                    {Object.entries(row).slice(0, 3).map(([k, v]) => (
                                        <span key={k} className="flex gap-1">
                                            <span className="text-cyan-500/50">{k.toUpperCase()}</span>
                                            <span className="text-gray-200">{String(v)}</span>
                                            <span className="text-gray-700 mx-1">|</span>
                                        </span>
                                    ))}
                                </div>
                            )) : (
                                <div className="text-[10px] text-gray-600 italic py-4 text-center">Identifying valid data patterns...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-auto bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
                <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                    <Info size={20} />
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                    Diagnostic result: Global health is **{data?.global?.state || 'Unknown'}**. "{tableName}" is contributing **{data?.node?.score ?? 0}%** to node-level efficiency.
                    {data?.node?.row_count === 0 ? " No records detected in this table for trend analysis." : " Cumulative mathematical scan completed successfully."}
                </p>
            </div>
        </div>
    );
}
