/**
 * InvestigationWorkspace — persistent canvas for deep analysis.
 *
 * Replaces DeepAnalysisPage.jsx as the primary full-screen investigation
 * surface. Can be opened as a standalone page (/investigation/:id) or
 * embedded inside IntelligenceHub.
 *
 * Panels:
 *   Left  — Evidence Chain (ordered, pinnable findings)
 *   Center — Visualization canvas (charts, 3D cloud, causal graph)
 *   Right  — AI chat + what-if controls
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pin, PinOff, Trash2, Plus, Download, Share2,
  BarChart3, Layers, GitBranch, Sliders, MessageSquare,
  ChevronLeft, ChevronRight, Maximize2, Save,
} from 'lucide-react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
  LineChart, Line, Area, ComposedChart,
} from 'recharts';
import apiClient from '../../../utils/apiClient';
import { useMLJob } from '../../../hooks/useMLJob';
import AgentChat from '../AgentConsole/AgentChat';

const PANEL_VIEWS = [
  { id: 'charts',  label: 'Charts',       icon: BarChart3  },
  { id: 'causal',  label: 'Causal',       icon: GitBranch  },
  { id: 'whatif',  label: 'What-If',      icon: Sliders    },
  { id: 'chat',    label: 'AI Chat',      icon: MessageSquare },
];

export default function InvestigationWorkspace({
  connectionId,
  workspaceId,       // existing workspace to load, or null for new
  initialMLResult,   // pass result directly from WorkOnDataModal
  onClose,
}) {
  const [workspace,      setWorkspace]      = useState(null);
  const [evidenceChain,  setEvidenceChain]  = useState([]);
  const [activeView,     setActiveView]     = useState('charts');
  const [leftCollapsed,  setLeftCollapsed]  = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mlResult,       setMlResult]       = useState(initialMLResult || null);
  const [saving,         setSaving]         = useState(false);

  // Load or create workspace
  useEffect(() => {
    if (!connectionId) return;

    if (workspaceId) {
      apiClient.get(`/api/workspace/${workspaceId}`)
        .then(ws => {
          setWorkspace(ws);
          setEvidenceChain(ws.evidence_chain || []);
          if (ws.canvas_state?.ml_result) setMlResult(ws.canvas_state.ml_result);
        })
        .catch(console.error);
    } else {
      apiClient.post('/api/workspace', {
        title:         `Investigation — ${new Date().toLocaleDateString()}`,
        connection_id: connectionId,
        canvas_state:  initialMLResult ? { ml_result: initialMLResult } : {},
      }).then(ws => {
        setWorkspace(ws);
        setEvidenceChain(ws.evidence_chain || []);
      }).catch(console.error);
    }
  }, [connectionId, workspaceId, initialMLResult]);

  // Seed initial evidence from ML result
  useEffect(() => {
    if (!initialMLResult || evidenceChain.length > 0) return;
    const items = [];
    if (initialMLResult.metrics) {
      items.push({ type: 'finding', title: 'Model Metrics', content: initialMLResult.metrics, pinned: true });
    }
    if (initialMLResult.insights?.length) {
      items.push({ type: 'annotation', title: 'AI Insights', content: { text: initialMLResult.insights.join('\n') }, pinned: false });
    }
    setEvidenceChain(items.map((it, i) => ({ ...it, id: `seed-${i}`, added_at: Date.now() / 1000 })));
  }, [initialMLResult, evidenceChain.length]);

  const addEvidence = useCallback(async (item) => {
    if (!workspace) return;
    try {
      const result = await apiClient.post(`/api/workspace/${workspace.id}/evidence`, item);
      setEvidenceChain(prev => [...prev, result]);
    } catch {
      setEvidenceChain(prev => [...prev, { ...item, id: `local-${Date.now()}` }]);
    }
  }, [workspace]);

  const removeEvidence = useCallback(async (evidenceId) => {
    if (workspace) {
      apiClient.delete(`/api/workspace/${workspace.id}/evidence/${evidenceId}`).catch(() => {});
    }
    setEvidenceChain(prev => prev.filter(e => e.id !== evidenceId));
  }, [workspace]);

  const togglePin = useCallback((evidenceId) => {
    setEvidenceChain(prev => prev.map(e =>
      e.id === evidenceId ? { ...e, pinned: !e.pinned } : e
    ));
  }, []);

  const handleSave = useCallback(async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await apiClient.patch(`/api/workspace/${workspace.id}`, {
        evidence_chain: evidenceChain,
        canvas_state: { ml_result: mlResult },
      });
    } finally {
      setSaving(false);
    }
  }, [workspace, evidenceChain, mlResult]);

  const handleReportReady = useCallback((report) => {
    addEvidence({
      type: 'finding',
      title: 'APEX Agent Report',
      content: report,
      pinned: true,
    });
  }, [addEvidence]);

  return (
    <div className="flex h-full bg-[#080d14] text-white overflow-hidden">

      {/* ── Left: Evidence Chain ── */}
      <motion.div
        animate={{ width: leftCollapsed ? 40 : 280 }}
        className="flex flex-col border-r border-white/[0.06] shrink-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
          {!leftCollapsed && <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Evidence Chain</span>}
          <button onClick={() => setLeftCollapsed(p => !p)} className="p-1 rounded hover:bg-white/10 text-white/30">
            {leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {!leftCollapsed && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Pinned first */}
            {[...evidenceChain].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
              .map(item => (
                <EvidenceItem
                  key={item.id}
                  item={item}
                  onPin={() => togglePin(item.id)}
                  onRemove={() => removeEvidence(item.id)}
                />
              ))}
            {!evidenceChain.length && (
              <p className="text-xs text-white/20 text-center py-6">
                Run an analysis to start building evidence
              </p>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Center: Visualization Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.06] shrink-0">
          {PANEL_VIEWS.map(v => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeView === v.id
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                <Icon size={13} /> {v.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <Save size={13} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Canvas content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeView === 'charts' && (
            <ChartsView mlResult={mlResult} onPinChart={(item) => addEvidence(item)} />
          )}
          {activeView === 'causal' && (
            <CausalView mlResult={mlResult} />
          )}
          {activeView === 'whatif' && (
            <WhatIfView mlResult={mlResult} connectionId={connectionId} />
          )}
          {activeView === 'chat' && (
            <div className="h-full">
              <AgentChat connectionId={connectionId} onReportReady={handleReportReady} />
            </div>
          )}
        </div>
      </div>

      {/* ── Right: collapsed by default on small screens ── */}
      <AnimatePresence>
        {!rightCollapsed && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 300 }}
            exit={{ width: 0 }}
            className="border-l border-white/[0.06] shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">AI Chat</span>
              <button onClick={() => setRightCollapsed(true)} className="p-1 rounded hover:bg-white/10 text-white/30">
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="h-[calc(100%-45px)]">
              <AgentChat connectionId={connectionId} onReportReady={handleReportReady} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {rightCollapsed && (
        <button
          onClick={() => setRightCollapsed(false)}
          className="w-10 flex flex-col items-center justify-center border-l border-white/[0.06] text-white/20 hover:text-white/50 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
      )}
    </div>
  );
}


// ── Evidence Item ──────────────────────────────────────────────────────────────
function EvidenceItem({ item, onPin, onRemove }) {
  const typeColor = {
    finding:    'text-violet-400 bg-violet-500/10',
    chart:      'text-cyan-400 bg-cyan-500/10',
    annotation: 'text-amber-400 bg-amber-500/10',
    ml_result:  'text-emerald-400 bg-emerald-500/10',
    anomaly:    'text-red-400 bg-red-500/10',
  }[item.type] || 'text-white/40 bg-white/5';

  return (
    <div className={`rounded-lg border border-white/[0.06] p-2.5 ${item.pinned ? 'bg-violet-500/5 border-violet-500/20' : 'bg-white/[0.02]'}`}>
      <div className="flex items-start gap-2">
        <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColor}`}>
          {item.type}
        </div>
        <p className="text-xs text-white/70 flex-1 truncate">{item.title}</p>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onPin} className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/60">
            {item.pinned ? <Pin size={11} className="text-violet-400" /> : <PinOff size={11} />}
          </button>
          <button onClick={onRemove} className="p-0.5 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Charts View ────────────────────────────────────────────────────────────────
function ChartsView({ mlResult, onPinChart }) {
  if (!mlResult) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-white/20">
        <BarChart3 size={40} className="mb-3 opacity-30" />
        <p className="text-sm">Run an analysis to see visualisations</p>
      </div>
    );
  }

  const { feature_importances = [], predictions = [], metrics = {}, family } = mlResult;
  const accent = { classification: '#22d3ee', regression: '#f97316', clustering: '#ec4899', timeseries: '#8b5cf6' }[family] || '#8b5cf6';

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Feature importances */}
      {feature_importances.length > 0 && (
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-white/60">Feature Importance</p>
            <button
              onClick={() => onPinChart({ type: 'chart', title: 'Feature Importance', content: { feature_importances }, pinned: false })}
              className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1"
            >
              <Pin size={10} /> Pin
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={feature_importances.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} width={55} />
              <Tooltip contentStyle={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {feature_importances.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={accent} fillOpacity={1 - i * 0.08} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Predictions / distribution */}
      {predictions.length > 0 && (
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
          <p className="text-xs font-semibold text-white/60 mb-3">
            {family === 'timeseries' ? '30-Day Forecast' : 'Predictions / Distribution'}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            {family === 'timeseries' ? (
              <ComposedChart data={predictions}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="upper" stroke="none" fill={accent} fillOpacity={0.1} />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#0f1623" fillOpacity={1} />
                <Line type="monotone" dataKey="value" stroke={accent} dot={false} strokeWidth={2} />
              </ComposedChart>
            ) : (
              <BarChart data={predictions.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill={accent} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Metrics grid */}
      <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] col-span-2">
        <p className="text-xs font-semibold text-white/60 mb-3">Model Metrics</p>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(metrics)
            .filter(([k]) => !['samples', 'train_size', 'test_size', 'n_classes', 'model'].includes(k))
            .map(([k, v]) => (
              <div key={k} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">{k}</p>
                <p className="text-lg font-bold mt-1" style={{ color: accent }}>
                  {typeof v === 'number' ? v.toFixed(4) : String(v)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}


// ── Causal View ────────────────────────────────────────────────────────────────
function CausalView({ mlResult }) {
  const fi = mlResult?.feature_importances || [];
  const target = mlResult?.table || 'target';

  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <p className="text-xs text-white/40 uppercase tracking-wider">Feature → Target Causal Graph</p>
      <div className="relative w-full max-w-lg">
        {fi.slice(0, 6).map((f, i) => {
          const width = `${Math.max(20, f.importance * 100)}%`;
          const opacity = 0.9 - i * 0.12;
          return (
            <div key={f.name} className="flex items-center gap-3 mb-3">
              <span className="text-xs text-white/50 w-32 truncate text-right">{f.name}</span>
              <div className="flex-1 relative h-6 bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width }}
                  transition={{ delay: i * 0.06, duration: 0.5 }}
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{ background: `rgba(139,92,246,${opacity})` }}
                />
              </div>
              <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
              <span className="text-xs text-white/30 w-10 text-right">{(f.importance * 100).toFixed(1)}%</span>
            </div>
          );
        })}
        {fi.length > 0 && (
          <div className="text-center mt-4">
            <div className="inline-block px-4 py-2 bg-violet-500/20 border border-violet-500/30 rounded-lg text-sm text-violet-300">
              {target}
            </div>
          </div>
        )}
        {!fi.length && (
          <p className="text-white/20 text-sm text-center">Run ML analysis to see causal relationships</p>
        )}
      </div>
    </div>
  );
}


// ── What-If View ───────────────────────────────────────────────────────────────
function WhatIfView({ mlResult, connectionId }) {
  const fi = mlResult?.feature_importances?.slice(0, 6) || [];
  // Slider 0–1 maps to weight 0.0–2.0 (0.5 = 1.0 = no change)
  const [weights, setWeights] = useState({});
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const baseMetrics = mlResult?.metrics || {};
  const primaryMetricKey = 'f1' in baseMetrics ? 'f1' : 'R2' in baseMetrics ? 'R2' : 'silhouette_score' in baseMetrics ? 'silhouette_score' : null;
  const baseScore = primaryMetricKey ? (baseMetrics[primaryMetricKey] ?? 0) : 0;
  const simScore = primaryMetricKey && simResult?.metrics ? (simResult.metrics[primaryMetricKey] ?? null) : null;

  // Debounced backend call whenever weights change
  useEffect(() => {
    if (!mlResult || !connectionId || !fi.length) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        // Convert slider (0–1) → multiplier (0.0–2.0)
        const feature_weights = {};
        fi.forEach(f => {
          const sliderVal = weights[f.name] ?? 0.5;
          feature_weights[f.name] = parseFloat((sliderVal * 2.0).toFixed(3));
        });

        const resp = await apiClient.post('/ml/whatif', {
          connection_id: connectionId,
          table: mlResult.table,
          features: fi.map(f => f.name),
          target: mlResult.target || null,
          algo: mlResult.algo,
          family: mlResult.family,
          feature_weights,
        });
        setSimResult(resp);
      } catch (e) {
        setError(e?.response?.data?.detail || 'Simulation failed');
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights, connectionId, mlResult]);

  const delta = simScore !== null ? simScore - baseScore : null;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <p className="text-xs text-white/40 uppercase tracking-wider text-center">What-If Scenario Simulator</p>
      <p className="text-xs text-white/25 text-center">
        Adjust feature weights (0 = zero out · centre = unchanged · 2× = double)
      </p>

      {fi.map(f => {
        const sliderVal = weights[f.name] ?? 0.5;
        const multiplier = sliderVal * 2.0;
        const pct = ((multiplier - 1.0) * 100).toFixed(0);
        const sign = multiplier >= 1 ? '+' : '';
        return (
          <div key={f.name} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-white/60">{f.name}</span>
              <span className={`font-mono ${multiplier < 1 ? 'text-red-400' : multiplier > 1 ? 'text-emerald-400' : 'text-white/40'}`}>
                {sign}{pct}%
              </span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={sliderVal}
              onChange={e => setWeights(prev => ({ ...prev, [f.name]: parseFloat(e.target.value) }))}
              className="w-full accent-violet-500"
            />
          </div>
        );
      })}

      {!fi.length && <p className="text-white/20 text-sm text-center">Run ML analysis first</p>}

      {fi.length > 0 && (
        <>
          {/* Score comparison */}
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Baseline</p>
                <p className="text-2xl font-bold text-white/60">{baseScore.toFixed(4)}</p>
                {primaryMetricKey && <p className="text-[10px] text-white/20 mt-0.5">{primaryMetricKey}</p>}
              </div>
              <div className="flex flex-col items-center justify-center">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                ) : delta !== null ? (
                  <p className={`text-xl font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-white/40'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(4)}
                  </p>
                ) : (
                  <p className="text-white/20 text-xs">—</p>
                )}
                <p className="text-[10px] text-white/20 mt-0.5">delta</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Simulated</p>
                <p className={`text-2xl font-bold ${loading ? 'text-white/20' : 'text-violet-400'}`}>
                  {simScore !== null ? simScore.toFixed(4) : '—'}
                </p>
                {primaryMetricKey && <p className="text-[10px] text-white/20 mt-0.5">{primaryMetricKey}</p>}
              </div>
            </div>
          </div>

          {/* Simulated feature importances */}
          {simResult?.feature_importances?.length > 0 && (
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
              <p className="text-xs text-white/40 mb-3">Simulated Feature Importance</p>
              {simResult.feature_importances.slice(0, 6).map((f, i) => (
                <div key={f.name} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-white/40 w-28 truncate text-right">{f.name}</span>
                  <div className="flex-1 bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, f.importance * 100)}%`, opacity: 1 - i * 0.1 }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30 w-10 text-right font-mono">
                    {(f.importance * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center bg-red-500/10 rounded-lg p-2">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
