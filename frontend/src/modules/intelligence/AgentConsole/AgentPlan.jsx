/**
 * AgentPlan — compact step-by-step timeline shown alongside the agent chat.
 * Visualises pending → running → done/error transitions in real time.
 */
import { motion } from 'framer-motion';
import {
  Search, Database, Cpu, Zap, AlertTriangle,
  FileText, Bell, CheckCircle2, XCircle, Loader2, Circle,
} from 'lucide-react';

const TOOL_META = {
  inspect_schema:    { icon: Search,        color: 'text-cyan-400',    label: 'Inspect Schema' },
  sample_data:       { icon: Database,      color: 'text-blue-400',    label: 'Sample Data' },
  resolve_entity:    { icon: Search,        color: 'text-indigo-400',  label: 'Resolve Entities' },
  engineer_features: { icon: Cpu,           color: 'text-violet-400',  label: 'Engineer Features' },
  run_ml:            { icon: Cpu,           color: 'text-violet-400',  label: 'Run ML' },
  run_automl:        { icon: Zap,           color: 'text-amber-400',   label: 'AutoML' },
  detect_anomalies:  { icon: AlertTriangle, color: 'text-orange-400',  label: 'Detect Anomalies' },
  compute_metric:    { icon: Database,      color: 'text-teal-400',    label: 'Compute Metric' },
  explain_result:    { icon: FileText,      color: 'text-emerald-400', label: 'Explain Results' },
  write_insight:     { icon: FileText,      color: 'text-emerald-400', label: 'Write Insight' },
  trigger_decision:  { icon: Bell,          color: 'text-red-400',     label: 'Trigger Decision' },
  search_memory:     { icon: Search,        color: 'text-purple-400',  label: 'Search Memory' },
};

export default function AgentPlan({ steps = [] }) {
  return (
    <div className="p-4 space-y-1">
      <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">
        Execution Plan
      </p>
      {steps.map((step) => (
        <StepRow key={step.index} step={step} />
      ))}
    </div>
  );
}

function StepRow({ step }) {
  const meta   = TOOL_META[step.tool] || { icon: Circle, color: 'text-white/40', label: step.tool };
  const Icon   = meta.icon;

  const isRunning  = step.status === 'running';
  const isDone     = step.status === 'done';
  const isError    = step.status === 'error';
  const isPending  = step.status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-2.5 py-2 px-2 rounded-lg transition-colors ${
        isRunning ? 'bg-violet-500/10' :
        isDone    ? 'bg-emerald-500/5' :
        isError   ? 'bg-red-500/10'   : ''
      }`}
    >
      {/* Status indicator */}
      <div className="mt-0.5 shrink-0">
        {isRunning && <Loader2 size={14} className="text-violet-400 animate-spin" />}
        {isDone    && <CheckCircle2 size={14} className="text-emerald-400" />}
        {isError   && <XCircle size={14} className="text-red-400" />}
        {isPending && <Circle size={14} className="text-white/20" />}
      </div>

      {/* Tool icon + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className={meta.color} />
          <span className={`text-xs font-medium truncate ${
            isRunning ? 'text-white' :
            isDone    ? 'text-white/60' :
            isError   ? 'text-red-400' :
            'text-white/30'
          }`}>
            {meta.label}
          </span>
        </div>
        {step.description && (
          <p className="text-[10px] text-white/25 truncate mt-0.5">{step.description}</p>
        )}
        {isDone && step.elapsed_ms && (
          <p className="text-[10px] text-white/20 mt-0.5">{step.elapsed_ms}ms</p>
        )}
        {isError && step.error && (
          <p className="text-[10px] text-red-400/70 mt-0.5 truncate">{step.error}</p>
        )}
      </div>
    </motion.div>
  );
}
