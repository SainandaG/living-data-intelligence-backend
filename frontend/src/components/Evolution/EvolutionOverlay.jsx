import React from 'react';
import { motion } from 'framer-motion';
import { Database, Activity, TrendingUp, Layers } from 'lucide-react';

const EvolutionOverlay = ({ snapshot }) => {
    if (!snapshot) return null;

    const activeCount = snapshot.tables.length;
    const totalRows = snapshot.tables.reduce((acc, t) => acc + t.row_count, 0);

    return (
        <div className="fixed top-24 right-6 w-64 z-40 space-y-4">
            <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 shadow-xl"
            >
                <div className="flex items-center gap-2 mb-4 text-indigo-400">
                    <Activity size={18} />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Evolution Stats</h3>
                </div>

                <div className="space-y-4">
                    <StatItem
                        icon={<Layers size={14} />}
                        label="Active Tables"
                        value={activeCount}
                        sub="of total schema"
                    />
                    <StatItem
                        icon={<Database size={14} />}
                        label="Total Records"
                        value={totalRows.toLocaleString()}
                        sub="reconstructed"
                    />
                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <StatItem
                            icon={<TrendingUp size={14} />}
                            label="Avg Vitality"
                            value={`${snapshot.global_metrics?.avg_vitality || 0}%`}
                            color="text-emerald-400"
                        />
                        <StatItem
                            icon={<Activity size={14} />}
                            label="Intelligence"
                            value={snapshot.global_metrics?.intelligence_score || 0}
                            sub="Node Glow Avg"
                            color="text-indigo-400"
                        />
                    </div>
                </div>
            </motion.div>

            {/* Latest Milestone Alert */}
            {snapshot.milestones && snapshot.milestones.length > 0 && (
                <motion.div
                    key={snapshot.milestones[snapshot.milestones.length - 1].date}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-3"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-500 rounded-lg text-white">
                            <TrendingUp size={14} />
                        </div>
                        <div>
                            <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-tighter">Latest Milestone</div>
                            <div className="text-white text-xs font-medium leading-tight mt-0.5">
                                {snapshot.milestones[snapshot.milestones.length - 1].title}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

const StatItem = ({ icon, label, value, sub, color = "text-white" }) => (
    <div className="flex flex-col">
        <div className="flex items-center gap-2 text-slate-400 mb-1">
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
        </div>
        <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold font-mono ${color}`}>{value}</span>
            {sub && <span className="text-slate-500 text-[9px] uppercase">{sub}</span>}
        </div>
    </div>
);

export default EvolutionOverlay;
