import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { GitBranch, Box, ArrowRight, Share2, Info } from 'lucide-react';

export default function RootCauseDashboard({ connectionId, tableName }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`/api/intelligence/root-cause/${connectionId}/${tableName || 'customers'}`);
                setData(res.data);
            } catch (err) {
                console.error("Failed to fetch root cause data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [connectionId, tableName]);

    if (loading) return (
        <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Tracing Dependency Impact...</p>
            </div>
        </div>
    );

    const impactPath = data?.impact_path || [];
    const riskScore = data?.risk_score || 0;

    return (
        <div className="p-8 h-full flex flex-col gap-8 overflow-y-auto">

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 flex flex-col items-end">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Impact Risk Score</p>
                    <span className={`text-5xl font-black ${riskScore > 70 ? 'text-red-500' : riskScore > 40 ? 'text-orange-400' : 'text-green-400'
                        }`}>{riskScore}</span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <GitBranch className="text-purple-400" size={20} />
                    <h2 className="text-lg font-bold text-white tracking-tight">Root Cause & Propagation</h2>
                </div>
                <p className="text-xl text-gray-200 leading-relaxed font-medium max-w-2xl">
                    {data?.summary}
                </p>
            </div>

            <div className="flex flex-col gap-12">
                <div className="relative">
                    {/* Origin Node */}
                    <motion.div
                        drag
                        dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
                        className="flex flex-col items-center relative z-10 cursor-grab active:cursor-grabbing"
                    >
                        <div className="w-24 h-24 rounded-3xl bg-purple-500/20 border-2 border-purple-500 p-1">
                            <div className="w-full h-full bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 flex-col gap-1 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
                                <Box size={24} />
                                <span className="text-[8px] font-black uppercase tracking-widest">SOURCE</span>
                            </div>
                        </div>
                        <p className="text-white font-bold mt-3 text-sm">{tableName}</p>
                    </motion.div>

                    {/* Impact Line */}
                    {impactPath.length > 0 && (
                        <div className="h-20 w-px bg-gradient-to-b from-purple-500 to-white/10 mx-auto relative">
                            <motion.div
                                animate={{ top: ['0%', '100%'], opacity: [0, 1, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 blur-[2px]"
                            />
                        </div>
                    )}

                    {/* Affected Nodes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {impactPath.map((item, i) => (
                            <motion.div
                                key={i}
                                drag
                                dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + (i * 0.1) }}
                                className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-grab active:cursor-grabbing z-20"
                            >
                                <div className="p-3 bg-white/5 rounded-xl text-gray-400">
                                    <Share2 size={16} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-white">{item.table}</p>
                                        <ArrowRight size={14} className="text-gray-600" />
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{item.reason}</p>
                                </div>
                                <div className="w-1.5 h-6 rounded-full bg-orange-500/40" />
                            </motion.div>
                        ))}
                    </div>

                    {impactPath.length === 0 && (
                        <div className="text-center p-12 bg-white/5 rounded-3xl border border-dashed border-white/10 opacity-50">
                            <Info size={32} className="mx-auto mb-4 text-gray-600" />
                            <p className="text-sm text-gray-400">No cascading dependencies detected.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 flex items-center gap-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                    <GitBranch size={16} className="text-purple-400" />
                </div>
                <p className="text-[10px] text-purple-200/60 font-medium">
                    Dependency mapping is based on foreign key constraints and query join frequency detected by Neural Core.
                </p>
            </div>
        </div>
    );
}
