/**
 * AgentChat — natural language interface for the APEX analytical agent.
 *
 * Streams the agent's plan + step execution in real time via SSE.
 * Shows a live plan timeline on the left, narrated events on the right.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, StopCircle, Sparkles, Brain, Loader2,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAgentStream } from '../../../hooks/useAgentStream';
import AgentPlan from './AgentPlan';

const SUGGESTED_QUERIES = [
  'Find churn drivers in the last 90 days',
  'Detect anomalies in recent transactions',
  'Forecast next 30 days of revenue',
  'Segment customers by behaviour',
  'What are the top predictors of order value?',
];

export default function AgentChat({ connectionId, onReportReady }) {
  const [query,    setQuery]    = useState('');
  const [history,  setHistory]  = useState([]);   // [{role, content, data}]
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  const { run, cancel, events, planSteps, report, status, error } = useAgentStream();

  // Auto-scroll on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // When analysis completes, surface report to parent
  useEffect(() => {
    if (status === 'done' && report) {
      setHistory(prev => [...prev, {
        role: 'agent',
        content: report.narrative || 'Analysis complete.',
        data: report,
      }]);
      onReportReady?.(report);
    }
  }, [status, report, onReportReady]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || !connectionId) return;

    setQuery('');
    setHistory(prev => [...prev, { role: 'user', content: q }]);
    await run({ query: q, connection_id: connectionId });
  }, [query, connectionId, run]);

  const handleSuggestion = useCallback((q) => {
    setQuery(q);
    inputRef.current?.focus();
  }, []);

  const isRunning = status === 'running' || status === 'planning';

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a]">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Brain size={16} className="text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">APEX Intelligence Agent</p>
          <p className="text-xs text-white/40">Ask anything about your data</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            isRunning ? 'bg-violet-400 animate-pulse' :
            status === 'done' ? 'bg-emerald-400' :
            status === 'error' ? 'bg-red-400' : 'bg-white/20'
          }`} />
          <span className="text-xs text-white/40 capitalize">{status}</span>
        </div>
      </div>

      {/* ── Conversation + Plan ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Suggested queries when idle */}
          {history.length === 0 && status === 'idle' && (
            <div className="space-y-3">
              <p className="text-xs text-white/30 uppercase tracking-wider">Suggested queries</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUERIES.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {history.map((msg, i) => (
            <ChatBubble key={i} msg={msg} />
          ))}

          {/* Live event feed during run */}
          {isRunning && (
            <LiveFeed events={events} />
          )}

          {/* Error state */}
          {status === 'error' && error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Plan timeline — visible when running or done */}
        <AnimatePresence>
          {planSteps.length > 0 && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/[0.06] overflow-y-auto"
            >
              <AgentPlan steps={planSteps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Input ── */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-white/[0.06] flex items-end gap-2"
      >
        <textarea
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
          placeholder={connectionId ? 'Ask about your data...' : 'Connect a database first'}
          disabled={!connectionId || isRunning}
          rows={1}
          className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] rounded-xl
                     px-4 py-3 text-sm text-white placeholder-white/30 outline-none
                     focus:border-violet-500/40 focus:bg-white/[0.06] transition-all
                     disabled:opacity-40 max-h-32 min-h-[44px]"
          style={{ height: 'auto', overflowY: 'hidden' }}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={cancel}
            className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <StopCircle size={18} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!query.trim() || !connectionId}
            className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        )}
      </form>
    </div>
  );
}


// ── Sub-components ─────────────────────────────────────────────────────────────

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
        isUser
          ? 'bg-violet-500/20 text-violet-100 rounded-br-sm'
          : 'bg-white/[0.05] text-white/80 rounded-bl-sm'
      }`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} className="text-violet-400" />
            <span className="text-xs font-medium text-violet-400">APEX</span>
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        {msg.data?.key_findings?.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
            {msg.data.key_findings.map((f, i) => (
              <div key={i} className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${
                f.severity === 'critical' ? 'bg-red-500/15 text-red-300' :
                f.severity === 'warning'  ? 'bg-amber-500/15 text-amber-300' :
                'bg-white/[0.04] text-white/50'
              }`}>
                <span className="capitalize font-medium">{f.type}:</span>
                <span>{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LiveFeed({ events }) {
  const visible = events.filter(e =>
    ['status', 'step_status', 'result', 'error'].includes(e.type) || e.text
  ).slice(-8);

  return (
    <div className="space-y-1">
      {visible.map((evt, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex items-start gap-2 text-xs ${
            evt.type === 'error' ? 'text-red-400' :
            evt.type === 'result' ? 'text-emerald-400' :
            'text-white/40'
          }`}
        >
          <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin text-violet-400/60" />
          <span>{evt.text || evt.summary}</span>
        </motion.div>
      ))}
    </div>
  );
}
