import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { AlertTriangle, ShieldAlert, Cpu, Activity, Clock } from 'lucide-react';

export default function AnomalyDashboard({ connectionId }) {
    const [anomalies, setAnomalies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnomalies = async () => {
            try {
                const res = await axios.get(`/api/intelligence/anomalies/${connectionId}`);
                setAnomalies(res.data.anomalies || []);
            } catch (err) {
                console.error("Failed to fetch anomalies:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnomalies();
        const interval = setInterval(fetchAnomalies, 10000);
        return () => clearInterval(interval);
    }, [connectionId]);

    if (loading) return (
        <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Scanning for Anomalies...</p>
            </div>
        </div>
    );

    return (
        <div className="p-8 h-full flex flex-col gap-6 overflow-y-auto">

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <AlertTriangle className="text-red-500" size={24} />
                        Active Risks & Anomalies
                    </h2>
                    <p className="text-gray-400 mt-1">Real-time detection of unusual database patterns</p>
                </div>

                <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{anomalies.length} Detected</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <AnimatePresence>
                    {anomalies.map((anomaly, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white/5 border border-white/10 hover:border-red-500/30 transition-colors rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center group"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 group-hover:scale-110 transition-transform">
                                <ShieldAlert size={28} />
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${anomaly.severity === 'High' ? 'bg-red-500 text-white' :
                                            anomaly.severity === 'Medium' ? 'bg-orange-500 text-white' : 'bg-yellow-500 text-black'
                                        }`}>
                                        {anomaly.severity} Severity
                                    </span>
                                    <h3 className="text-lg font-bold text-white tracking-tight">{anomaly.metric}</h3>
                                </div>
                                <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
                                    {anomaly.explanation}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-2 pr-4">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Current Value</p>
                                    <p className="text-xl font-mono text-red-400 font-bold">{anomaly.current_value}</p>
                                </div>
                                <div className="text-right opacity-50">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Baseline</p>
                                    <p className="text-sm font-mono text-white italic">{anomaly.expected_value.toFixed(1)}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {anomalies.length === 0 && (
                    <div className="p-20 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-4">
                            <Activity size={24} />
                        </div>
                        <p className="text-gray-400 font-medium">No active anomalies detected.</p>
                        <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest font-bold">System Integrity: 100%</p>
                    </div>
                )}
            </div>

            {/* AI Diagnostics Footer */}
            <div className="mt-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
                    <Cpu size={18} className="text-cyan-400" />
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Detection Engine</p>
                        <p className="text-xs text-white">Neural Core V3 / Z-Score Analysis</p>
                    </div>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
                    <Clock size={18} className="text-purple-400" />
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Update frequency</p>
                        <p className="text-xs text-white">Synchronized / 10s intervals</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
