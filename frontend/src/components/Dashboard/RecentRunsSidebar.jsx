import React from 'react';
import { motion } from 'framer-motion';
import { 
  History, X, Play, Clock, Database, BarChart2, 
  ChevronRight, FlaskConical, GitBranch, TrendingUp, Layers, CheckCircle2, AlertCircle
} from 'lucide-react';

const ALGO_ICONS = {
  classification: GitBranch,
  regression: TrendingUp,
  timeseries: Clock,
  clustering: Layers,
};

const FAMILY_COLORS = {
  classification: 'cyan',
  regression: 'orange',
  timeseries: 'violet',
  clustering: 'pink',
};

const COLOR_MAP = {
  cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  pink: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
};

export default function RecentRunsSidebar({ isOpen, onClose, runs, onSelectRun, isLoading }) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? 0 : '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 w-80 h-full bg-[#0d1515] border-l border-white/10 z-[6100] flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <History size={18} className="text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Runs</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Runs List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 space-y-3 opacity-50">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Fetching history...</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-6">
            <History size={32} className="text-gray-700 mb-3" />
            <p className="text-xs text-gray-500">No recent runs found for this connection.</p>
          </div>
        ) : (
          runs.map((run, index) => {
            const Icon = ALGO_ICONS[run.family] || BarChart2;
            const colorClass = COLOR_MAP[FAMILY_COLORS[run.family]] || 'text-gray-400 bg-white/5 border-white/10';
            const date = new Date(run.created_at * 1000).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return (
              <motion.button
                key={`${run.run_id}-${index}`}
                whileHover={{ x: -4, backgroundColor: 'rgba(255,255,255,0.04)' }}
                onClick={() => onSelectRun(run)}
                className="w-full text-left p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] group transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-1.5 rounded-lg border ${colorClass}`}>
                    <Icon size={14} />
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono italic">{date}</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-bold text-gray-200 group-hover:text-white transition-colors truncate">
                      {run.table}
                    </h4>
                    {run.status === 'success' ? (
                      <CheckCircle2 size={12} className="text-green-500" />
                    ) : (
                      <AlertCircle size={12} className="text-red-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <FlaskConical size={10} /> {run.algo}
                  </p>
                </div>

                {run.metrics && Object.keys(run.metrics).length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-hidden">
                    {Object.entries(run.metrics).slice(0, 2).map(([key, val]) => (
                      <div key={key} className="bg-white/[0.03] border border-white/[0.05] rounded-md px-1.5 py-0.5">
                        <span className="text-[8px] text-gray-600 uppercase font-bold mr-1">{key}</span>
                        <span className="text-[9px] text-amber-500/80 font-mono">
                          {typeof val === 'number' ? val.toFixed(3) : val}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-3 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 uppercase tracking-tighter">
                    Re-Open <ChevronRight size={10} />
                  </span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="p-4 bg-white/[0.01] border-t border-white/5">
        <p className="text-[10px] text-gray-600 leading-tight">
          History is persisted locally in the experiment tracker. Closing the session won't delete these results.
        </p>
      </div>
    </motion.div>
  );
}
