/**
 * DecisionBoard — Kanban-style decision queue with severity lanes,
 * approve/reject controls, and notification dispatch.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, XCircle, Bell, Send,
  ChevronDown, ChevronRight, Clock, Zap, Info,
} from 'lucide-react';
import { useDecisionFeed } from '../../../hooks/useDecisionFeed';

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: AlertTriangle, label: 'Critical' },
  high:     { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: Zap,           label: 'High' },
  warning:  { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: Clock,         label: 'Warning' },
  info:     { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   icon: Info,          label: 'Info' },
};

const STATUS_LABELS = {
  pending:  { label: 'Pending',  color: 'text-amber-400' },
  approved: { label: 'Approved', color: 'text-emerald-400' },
  rejected: { label: 'Rejected', color: 'text-red-400' },
  actioned: { label: 'Actioned', color: 'text-blue-400' },
};

export default function DecisionBoard({ tenantId = 'default', connectionId }) {
  const [filter,   setFilter]   = useState('pending');    // all | pending | critical | high
  const [expanded, setExpanded] = useState(null);

  const { decisions, stats, loading, updateStatus, dispatch } = useDecisionFeed({ tenantId });

  const filtered = decisions.filter(d => {
    if (filter === 'all') return true;
    if (filter === 'pending') return d.status === 'pending';
    return d.severity === filter;
  });

  const handleApprove = useCallback(async (id) => {
    await updateStatus(id, 'approved', 'user');
  }, [updateStatus]);

  const handleReject = useCallback(async (id) => {
    await updateStatus(id, 'rejected', 'user');
  }, [updateStatus]);

  const handleDispatch = useCallback(async (id) => {
    await dispatch(id, ['slack', 'email']);
  }, [dispatch]);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a]">
      {/* ── Stats bar ── */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.04] border-b border-white/[0.06]">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-white/60' },
          { label: 'Pending',  value: stats.pending,  color: 'text-amber-400' },
          { label: 'Critical', value: stats.critical, color: 'text-red-400' },
          { label: 'High',     value: stats.high,     color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="py-3 px-4 bg-[#0a0f1a]">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/30 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter pills ── */}
      <div className="flex gap-2 px-4 py-3 border-b border-white/[0.06]">
        {['pending', 'critical', 'high', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${
              filter === f
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                : 'border-white/10 text-white/40 hover:text-white/60'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Decision list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && !decisions.length && (
          <p className="text-xs text-white/30 text-center py-8">Loading decisions...</p>
        )}
        {!loading && !filtered.length && (
          <div className="text-center py-12">
            <CheckCircle2 size={32} className="text-emerald-500/30 mx-auto mb-3" />
            <p className="text-sm text-white/30">No {filter === 'all' ? '' : filter} decisions</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {filtered.map(decision => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              expanded={expanded === decision.id}
              onToggle={() => setExpanded(prev => prev === decision.id ? null : decision.id)}
              onApprove={() => handleApprove(decision.id)}
              onReject={() => handleReject(decision.id)}
              onDispatch={() => handleDispatch(decision.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}


function DecisionCard({ decision, expanded, onToggle, onApprove, onReject, onDispatch }) {
  const sev    = SEVERITY_CONFIG[decision.severity] || SEVERITY_CONFIG.info;
  const SevIcon = sev.icon;
  const stat   = STATUS_LABELS[decision.status] || STATUS_LABELS.pending;
  const ts     = new Date(decision.created_at * 1000).toLocaleString();
  const isPending = decision.status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-xl border ${sev.border} ${sev.bg} overflow-hidden`}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <SevIcon size={15} className={sev.color} />
        <span className="flex-1 text-sm font-medium text-white truncate">{decision.title}</span>
        <span className={`text-xs ${stat.color}`}>{stat.label}</span>
        {expanded ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
              {decision.description && (
                <p className="text-xs text-white/50 leading-relaxed">{decision.description}</p>
              )}

              {/* Findings */}
              {decision.findings?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Findings</p>
                  <div className="space-y-1">
                    {decision.findings.slice(0, 4).map((f, i) => (
                      <div key={i} className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${
                        f.severity === 'critical' ? 'bg-red-500/10 text-red-300' :
                        f.severity === 'warning'  ? 'bg-amber-500/10 text-amber-300' :
                        'bg-white/[0.04] text-white/50'
                      }`}>
                        <span className="font-medium capitalize">{f.type}:</span>
                        <span>{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {decision.recommended_actions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Recommended Actions</p>
                  <ul className="space-y-1">
                    {decision.recommended_actions.slice(0, 3).map((r, i) => (
                      <li key={i} className="text-xs text-white/50 flex items-start gap-1.5">
                        <span className={`mt-0.5 px-1 rounded text-[10px] font-bold ${
                          r.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                          r.priority === 'high'     ? 'bg-orange-500/20 text-orange-400' :
                          'bg-white/10 text-white/40'
                        }`}>{(r.priority || 'low').toUpperCase()}</span>
                        {r.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[10px] text-white/25">{ts}</p>

              {/* Action buttons */}
              {isPending && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={onApprove}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs hover:bg-emerald-500/25 transition-colors"
                  >
                    <CheckCircle2 size={12} /> Approve
                  </button>
                  <button
                    onClick={onReject}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs hover:bg-red-500/25 transition-colors"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                  <button
                    onClick={onDispatch}
                    title="Send to Slack/Email"
                    className="px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/50 text-xs hover:bg-white/10 transition-colors"
                  >
                    <Send size={12} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
