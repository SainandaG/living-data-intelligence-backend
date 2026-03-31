import React, { useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { Activity, Cpu, Database, HardDrive, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { logger } from '../../utils/logger';
import { VITALS_POLL_INTERVAL } from '../../config/timing';

export default function HealthDashboard() {
    const [vitals, setVitals] = useState(null);
    const [loading, setLoading] = useState(true);

    const [serviceUnavailable, setServiceUnavailable] = useState(false);

    useEffect(() => {
        const fetchVitals = async () => {
            try {
                const data = await apiClient.get('/vitals/');
                setVitals(data);
            } catch (error) {
                logger.error('Failed to fetch vitals:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVitals();
        const interval = setInterval(fetchVitals, VITALS_POLL_INTERVAL); // Update every 5s
        return () => clearInterval(interval);
    }, []);

    if (loading && !vitals && !serviceUnavailable) {
        return <div className="p-4 text-white font-mono text-xs animate-pulse text-center">Syncing with Neural Core...</div>;
    }
    if (serviceUnavailable) {
        return (
            <div className="p-6 text-amber-200 text-sm border border-amber-500/20 rounded-2xl bg-amber-500/10">
                Vitals service not available. The backend vitals module may not be loaded.
            </div>
        );
    }

    const { vitals: sys, agents, status } = vitals || {};

    return (
        <div className="p-6 space-y-6 overflow-y-auto max-h-full">
            <header className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <ShieldCheck className="text-green-400" />
                    System Vitals
                </h2>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'HEALTHY' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`}></div>
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">{status}</span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <VitalsCard
                    icon={<Cpu size={20} />}
                    label="CPU Compute"
                    value={`${sys?.cpu_usage || 0}%`}
                    subtext="Process load"
                    color="text-blue-400"
                />
                <VitalsCard
                    icon={<HardDrive size={20} />}
                    label="Neural Mem"
                    value={`${sys?.memory_usage_mb || 0}MB`}
                    subtext="RAM allocation"
                    color="text-purple-400"
                />
                <VitalsCard
                    icon={<Activity size={20} />}
                    label="API Latency"
                    value={`${sys?.avg_api_latency_ms || 0}ms`}
                    subtext="Sync speed"
                    color="text-cyan-400"
                />
            </div>

            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-xs font-mono text-gray-500 uppercase mb-6 tracking-widest flex items-center gap-2">
                    <Database size={14} />
                    Agent Status Cluster
                </h3>
                <div className="space-y-6">
                    <AgentRow label="T0 Explorer" state={agents?.t0_agent} />
                    <AgentRow label="T1 Executor" state={agents?.t1_agent} />
                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-xs text-gray-400">Task Queue Depth</span>
                        <span className="font-mono text-white text-lg">{agents?.queue_depth || 0}</span>
                    </div>
                </div>
            </section>
        </div>
    );
}

function VitalsCard({ icon, label, value, subtext, color }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors"
        >
            <div className={`${color} mb-3`}>{icon}</div>
            <div className="text-sm text-gray-400 uppercase font-mono text-[10px] mb-1">{label}</div>
            <div className="text-2xl font-bold text-white mb-1 font-mono">{value}</div>
            <div className="text-[10px] text-gray-500">{subtext}</div>
        </motion.div>
    );
}

function AgentRow({ label, state }) {
    const isIdle = state?.includes('IDLE');
    return (
        <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300 font-medium">{label}</span>
            <div className="flex items-center gap-3">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${isIdle ? 'border-gray-700 text-gray-500' : 'border-cyan-500/50 text-cyan-400'}`}>
                    {state}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full ${isIdle ? 'bg-gray-700' : 'bg-cyan-500 animate-pulse'}`}></div>
            </div>
        </div>
    );
}
