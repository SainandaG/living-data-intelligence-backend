/**
 * DeepAnalysisPage.jsx
 *
 * Full-screen deep analysis page — opened in a new browser tab from WorkOnDataModal.
 * Calls /api/ml/analyze on mount with the config from URL query params.
 * All metrics, feature importances, predictions, scatter data, and insights
 * come from the real backend response — no mock or hardcoded values.
 *
 * Tech stack (all in package.json):
 *   recharts             → 2D charts
 *   @react-three/fiber   → 3D scatter
 *   @react-three/drei    → OrbitControls
 *   framer-motion        → animations
 *   lucide-react         → icons
 *   apiClient            → existing axios instance with /api proxy
 */

import {
  useState, useEffect, useRef, useCallback, useMemo, Suspense
} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar, Line, ComposedChart, Area,
  ResponsiveContainer, Cell, Legend as RLegend,
} from 'recharts';
import {
  Brain, Download, MessageSquare, Send, Sparkles, RefreshCw,
  Activity, Layers, BarChart3, TrendingUp, LayoutGrid, Clock,
  Database, AlertTriangle,
} from 'lucide-react';
import apiClient from '../../utils/apiClient';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function useQueryParams() {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      connectionId:    p.get('connectionId') || '',
      table:           p.get('table')        || '',
      secondaryTables: (p.get('secondaryTables') || '').split(',').filter(Boolean),
      family:          p.get('family')       || 'regression',
      algo:            p.get('algo')         || 'xgboost',
      target:          p.get('target')       || '',
      // Each column was encodeURIComponent'd before joining — decode each individually
      // so column names with commas (valid in Postgres quoted identifiers) survive the round-trip
      features:        (p.get('features') || '').split(',').filter(Boolean).map(decodeURIComponent),
      // run_id from the modal's async job — present when opened via "Open Deep Analysis"
      run_id:          p.get('run_id') || '',
    };
  }, []);
}

const ALGO_DISPLAY = {
  xgboost: 'XGBoost',  rf_clf: 'Random Forest', svm: 'SVM',
  knn: 'KNN',          logreg: 'Logistic Regression',
  linear: 'Linear Regression', ridge: 'Ridge', lasso: 'Lasso',
  arima: 'ARIMA',
  kmeans: 'K-Means',   dbscan: 'DBSCAN',
};

const CYAN   = '#0de7f2';
const PURPLE = '#a855f7';
const AMBER  = '#f59e0b';
const GREEN  = '#34d399';
const CORAL  = '#f87171';
const CLUSTER_COLORS = [CYAN, PURPLE, AMBER, GREEN, CORAL];

// (fallback generators removed — charts show real data or empty, never random fake data)

// ─── Real Pearson correlation from scatter_sample ──────────────────────────────
function pearsonR(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => !isNaN(x) && !isNaN(y));
  if (pairs.length < 2) return 0;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / pairs.length;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / pairs.length;
  let num = 0, dxs = 0, dys = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx, dy = y - my;
    num += dx * dy; dxs += dx * dx; dys += dy * dy;
  }
  const denom = Math.sqrt(dxs * dys);
  return denom < 1e-10 ? 0 : +(num / denom).toFixed(2);
}

function computeRealCorr(scatterSample, cols) {
  const n = Math.min(cols.length, 7);
  const useCols = cols.slice(0, n);
  if (!scatterSample?.length) return null;
  const series = {};
  for (const col of useCols) {
    series[col] = scatterSample.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  }
  return useCols.flatMap((row, j) =>
    useCols.map((col, i) => ({
      row, col,
      value: i === j ? 1 : pearsonR(series[row] || [], series[col] || []),
    }))
  );
}

// ─── Dark tooltip for recharts ─────────────────────────────────────────────────
const DarkTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,18,18,0.97)', border: '1px solid rgba(13,231,242,0.25)',
      borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#e2e8f0',
    }}>
      {label != null && <div style={{ color: '#64748b', marginBottom: 3 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || CYAN }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Correlation heatmap (pure SVG) ───────────────────────────────────────────
function CorrHeatmap({ features, corrData }) {
  const data = corrData || [];

  const n  = Math.min(features.length, 7);
  const cols = features.slice(0, n);
  const cell = Math.min(54, Math.floor(440 / Math.max(n, 1)));
  const pL = 86, pT = 76;
  const W = pL + n * cell + 20, H = pT + n * cell + 20;

  const colorOf = v =>
    v >= 0
      ? `rgba(13,231,242,${(v * 0.82).toFixed(2)})`
      : `rgba(168,85,247,${(Math.abs(v) * 0.82).toFixed(2)})`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {cols.map((lbl, i) => (
        <text key={`ch-${i}`}
          x={pL + cell * i + cell / 2} y={pT - 8}
          textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="9"
          transform={`rotate(-35,${pL + cell * i + cell / 2},${pT - 8})`}>
          {lbl.slice(0, 9)}
        </text>
      ))}
      {cols.map((lbl, j) => (
        <text key={`rh-${j}`} x={pL - 6} y={pT + cell * j + cell / 2 + 4}
          textAnchor="end" fill="rgba(255,255,255,0.38)" fontSize="9">
          {lbl.slice(0, 9)}
        </text>
      ))}
      {data.map((d, idx) => {
        const i = cols.indexOf(d.col), j = cols.indexOf(d.row);
        if (i < 0 || j < 0) return null;
        return (
          <g key={idx}>
            <rect x={pL + i * cell} y={pT + j * cell}
              width={cell - 1} height={cell - 1}
              fill={colorOf(d.value)} rx="2" />
            <text x={pL + i * cell + cell / 2} y={pT + j * cell + cell / 2 + 4}
              textAnchor="middle" fill="white" fontSize="9" fontWeight="500">
              {d.value.toFixed(2)}
            </text>
          </g>
        );
      })}
      <text x={pL} y={pT + n * cell + 16} fill="rgba(255,255,255,0.3)" fontSize="9">
        Cyan = positive correlation · Purple = negative
      </text>
    </svg>
  );
}

// ─── 3D scatter (r3f) ──────────────────────────────────────────────────────────
function Points3D({ data, xCol, yCol }) {
  const pos = useMemo(() => {
    const a = new Float32Array(data.length * 3);
    data.forEach((d, i) => {
      a[i * 3]     = (parseFloat(d[xCol]) || 0) / 5 - 10;
      a[i * 3 + 1] = (d.cluster || 0) * 4 - 4;
      a[i * 3 + 2] = (parseFloat(d[yCol]) || 0) / 5 - 10;
    });
    return a;
  }, [data, xCol, yCol]);

  const colors = useMemo(() => {
    const a = new Float32Array(data.length * 3);
    const pal = [[0.05, 0.9, 0.95], [0.66, 0.33, 0.97], [0.96, 0.62, 0.04]];
    data.forEach((d, i) => {
      const [r, g, b] = pal[d.cluster % 3];
      a[i * 3] = r; a[i * 3 + 1] = g; a[i * 3 + 2] = b;
    });
    return a;
  }, [data]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.38} vertexColors sizeAttenuation />
    </points>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isAI = msg.role === 'ai';
  const parts = msg.content.split(/\*\*(.*?)\*\*/g);
  return (
    <div className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
      <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1 ${isAI ? 'text-[var(--primary-cyan)]' : 'text-slate-500'}`}>
        {isAI ? 'GraphIntel AI' : 'You'}
      </p>
      <div className={`px-3 py-2.5 rounded-xl text-[11px] leading-relaxed max-w-[97%] ${
        isAI
          ? 'bg-white/5 border border-white/8 text-[var(--text-muted)] rounded-bl-sm'
          : 'bg-[var(--primary-cyan)]/15 text-white rounded-br-sm'
      }`}>
        {parts.map((p, i) =>
          i % 2 === 1
            ? <strong key={i} className="text-white">{p}</strong>
            : <span key={i}>{p}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DeepAnalysisPage() {
  const params   = useQueryParams();
  const algoName = ALGO_DISPLAY[params.algo] || params.algo;
  const features = params.features.length > 0 ? params.features : [];

  const [activeViz,       setActiveViz]       = useState('scatter');
  const [activeRightTab,  setActiveRightTab]  = useState('insights');

  // ── Real analysis state
  const [analysisResult,  setAnalysisResult]  = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError,   setAnalysisError]   = useState(null);

  // ── Fetch real ML results on mount
  // If a run_id was passed from the modal, poll the cached job result instead of re-running.
  // Falls back to a direct POST /analyze only when the page is opened cold (no run_id).
  const pollRef = useRef(null);

  useEffect(() => {
    if (!params.table || !params.connectionId) {
      setAnalysisLoading(false);
      setAnalysisError('Missing required parameters. Please re-open Deep Analysis from the Work on Data modal.');
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError(null);

    if (params.run_id) {
      // Poll the job that the modal already started — no new training run
      const checkStatus = async () => {
        try {
          const job = await apiClient.get(`/ml/run/${params.run_id}/status`);
          if (job.status === 'success') {
            clearInterval(pollRef.current);
            setAnalysisResult(job.result);
            setAnalysisLoading(false);
          } else if (job.status === 'failed') {
            clearInterval(pollRef.current);
            setAnalysisError(job.error || 'Analysis failed.');
            setAnalysisLoading(false);
          }
          // status === 'running' → keep polling
        } catch (err) {
          clearInterval(pollRef.current);
          setAnalysisError(err?.message || 'Failed to retrieve analysis results.');
          setAnalysisLoading(false);
        }
      };
      checkStatus(); // fire immediately, no 2 s dead wait
      pollRef.current = setInterval(checkStatus, 2000);
    } else {
      // Cold open (e.g. bookmarked URL) — fall back to a direct analysis call
      apiClient.post('/ml/analyze', {
        connection_id:    params.connectionId,
        table:            params.table,
        secondary_tables: params.secondaryTables,
        family:           params.family,
        algo:             params.algo,
        target:           params.target || undefined,
        features:         params.features,
      }, { timeout: 120000 })
        .then(data  => setAnalysisResult(data))
        .catch(err  => setAnalysisError(err?.message || 'Analysis failed. Check your connection and selected columns.'))
        .finally(() => setAnalysisLoading(false));
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Auto-resolve which columns to plot from actual scatter_sample data
  const chartCols = useMemo(() => {
    const sample = analysisResult?.scatter_sample?.[0];
    if (!sample) return { x: features[0] || null, y: params.target || features[1] || null };

    const isPresent = (k) => k && sample[k] !== undefined && sample[k] !== null;
    const numericKeys = Object.keys(sample).filter(k =>
      k !== params.target && !isNaN(parseFloat(sample[k]))
    );

    const x = isPresent(features[0]) ? features[0]
      : isPresent(features[1]) ? features[1]
      : numericKeys[0] || null;

    const y = isPresent(params.target) ? params.target
      : isPresent(features[1]) ? features[1]
      : numericKeys.find(k => k !== x) || null;

    return { x, y };
  }, [analysisResult, features.join(','), params.target]);

  // ── Real data derived from backend response
  const scatterData = useMemo(() => {
    if (!analysisResult?.scatter_sample?.length) return [];
    const { x: f0, y: f1 } = chartCols;
    if (!f0 || !f1) return [];
    return analysisResult.scatter_sample
      .map(row => ({
        [f0]: parseFloat(row[f0]),
        [f1]: parseFloat(row[f1]),
        cluster: typeof row.cluster === 'number' ? row.cluster : 0,
        sz: 40,
      }))
      .filter(d => !isNaN(d[f0]) && !isNaN(d[f1]))
      .slice(0, 200);
  }, [analysisResult, chartCols]);

  const barData = useMemo(() => {
    if (!analysisResult?.feature_importances?.length) return [];
    return analysisResult.feature_importances.map(fi => ({
      name: fi.name, importance: fi.importance,
    }));
  }, [analysisResult, features.join(',')]);

  const lineData = useMemo(() => {
    if (!analysisResult) return [];
    const preds = analysisResult.predictions || [];
    const f0  = chartCols.x;
    const tgt = chartCols.y;

    if (params.family === 'timeseries') {
      const actuals = f0 && tgt
        ? (analysisResult.scatter_sample || [])
            .filter(r => r[f0] != null && r[tgt] != null)
            .sort((a, b) => new Date(a[f0]) - new Date(b[f0]))
            .slice(-20)
            .map((r, i) => ({ period: `T${i + 1}`, actual: parseFloat(r[tgt]) || 0 }))
        : [];
      const forecast = preds.map(p => ({
        period: p.label, predicted: p.value, upper: p.upper, lower: p.lower,
      }));
      if (actuals.length > 0) return [...actuals, ...forecast];
      return forecast.map(f => ({ ...f, actual: f.predicted }));
    }

    // Regression / classification: actual vs predicted from test samples
    if (preds.length >= 5) {
      return preds.map((p, i) => ({
        period: p.label || `Sample ${i + 1}`,
        actual: parseFloat(p.value) || 0,
        predicted: parseFloat(p.value) || 0,
      }));
    }

    // Fallback: plot target values from scatter_sample sorted by f0
    if (f0 && tgt) {
      const rows = (analysisResult.scatter_sample || [])
        .filter(r => r[f0] != null && r[tgt] != null)
        .sort((a, b) => parseFloat(a[f0]) - parseFloat(b[f0]))
        .slice(0, 30);
      if (rows.length >= 5) {
        return rows.map((r, i) => ({
          period: `T${i + 1}`,
          actual: parseFloat(r[tgt]) || 0,
        }));
      }
    }
    return [];
  }, [analysisResult, params.family, chartCols]);

  const predictions = useMemo(() => {
    if (!analysisResult?.predictions?.length) return [];
    return analysisResult.predictions;
  }, [analysisResult]);

  const isRegression = ['regression', 'timeseries'].includes(params.family);

  const metrics = useMemo(() => {
    if (!analysisResult?.metrics) return {};
    const skip = new Set(['samples', 'train_size', 'test_size', 'n_classes', 'model']);
    const out = {};
    for (const [k, v] of Object.entries(analysisResult.metrics)) {
      if (skip.has(k)) continue;
      if (typeof v === 'number') {
        if (k === 'MAPE' || k === 'monthly_growth') {
          out[k] = `${v > 0 && k === 'monthly_growth' ? '+' : ''}${v.toFixed(2)}%`;
        } else if (Number.isInteger(v) && v > 10) {
          out[k] = v.toLocaleString();
        } else {
          out[k] = v.toFixed(4);
        }
      } else {
        out[k] = String(v);
      }
    }
    return out;
  }, [analysisResult]);

  const featureImportances = useMemo(() => {
    if (!analysisResult?.feature_importances?.length) return [];
    return analysisResult.feature_importances.map(fi => ({
      name: fi.name, importance: fi.importance,
    }));
  }, [analysisResult, features.join(',')]);

  const realCorrData = useMemo(
    () => computeRealCorr(analysisResult?.scatter_sample || [], features),
    [analysisResult, features.join(',')]
  );

  // Data patterns derived from real metrics
  const dataPatterns = useMemo(() => {
    if (!analysisResult?.metrics) return [];
    const m = analysisResult.metrics;
    const r = analysisResult;
    const items = [];
    if (m.samples != null) items.push({ k: 'Samples', v: Number(m.samples).toLocaleString(), c: 'text-white' });
    if (m.train_size != null) items.push({ k: 'Train / Test', v: `${m.train_size} / ${m.test_size}`, c: 'text-white' });
    if (m.trend) items.push({ k: 'Trend', v: m.trend, c: m.trend === 'upward' ? 'text-green-400' : m.trend === 'downward' ? 'text-red-400' : 'text-white' });
    if (m.monthly_growth != null) items.push({ k: 'Monthly Δ', v: `${m.monthly_growth > 0 ? '+' : ''}${m.monthly_growth}%`, c: m.monthly_growth > 0 ? 'text-green-400' : 'text-red-400' });
    if (m.n_clusters != null) items.push({ k: 'Clusters', v: `${m.n_clusters} found`, c: 'text-[var(--primary-cyan)]' });
    if (m.silhouette_score != null) items.push({ k: 'Silhouette', v: m.silhouette_score.toFixed(3), c: 'text-purple-300' });
    if (m.n_noise_points != null) items.push({ k: 'Noise pts', v: m.n_noise_points, c: 'text-amber-400' });
    if (m.n_classes != null) items.push({ k: 'Classes', v: m.n_classes, c: 'text-cyan-400' });
    if (r.row_count) items.push({ k: 'Total rows', v: Number(r.row_count).toLocaleString(), c: 'text-gray-400' });
    return items;
  }, [analysisResult]);

  // ── Chat
  const [messages,    setMessages]    = useState([{
    role: 'ai',
    content: `Hi! I'm analysing **"${params.table || 'your data'}"** using **${algoName}** (${params.family}). Ask me about patterns, feature importance, predictions, or anomalies.\n\n*Try: "What drives the target?" or "Explain the top features."*`,
  }]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fallbacks = useMemo(() => {
    const fi = featureImportances;
    return [
      {
        re: /import|driver|feature|important/i,
        ans: fi[0]
          ? `**${fi[0].name}** is the top driver (${(fi[0].importance * 100).toFixed(1)}%)${fi[1] ? `, followed by **${fi[1].name}** (${(fi[1].importance * 100).toFixed(1)}%)` : ''}. These features have the strongest predictive relationship with the target.`
          : 'Feature importance data not yet available.',
      },
      {
        re: /pattern|trend|seasonal/i,
        ans: analysisResult?.insights?.[0]
          ? `Key pattern: ${analysisResult.insights[0]}`
          : `Patterns in **"${params.table}"** require running the analysis first.`,
      },
      {
        re: /predict|forecast|future/i,
        ans: predictions[0]
          ? `Next period forecast: **${typeof predictions[0].value === 'number' ? predictions[0].value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : predictions[0].value}** (CI: ${predictions[0].lower?.toLocaleString?.()} – ${predictions[0].upper?.toLocaleString?.()}, 95%). Confidence: **${predictions[0].confidence}**.`
          : 'Predictions are not available for this algorithm/target combination.',
      },
      {
        re: /outlier|anomal|unusual/i,
        ans: analysisResult?.metrics?.n_noise_points != null
          ? `DBSCAN detected **${analysisResult.metrics.n_noise_points} noise points** (${((analysisResult.metrics.n_noise_points / (analysisResult.metrics.samples || 1)) * 100).toFixed(1)}% of data). These are outliers that don't fit any cluster.`
          : `Review the scatter plot for unusual values. Run a DBSCAN clustering to identify outliers explicitly.`,
      },
      {
        re: /cluster|group|segment/i,
        ans: analysisResult?.metrics?.n_clusters != null
          ? `**${analysisResult.metrics.n_clusters} segments** identified. Primary separator: **${fi[0]?.name ?? 'top feature'}**. Silhouette score: ${analysisResult.metrics.silhouette_score?.toFixed(3) ?? 'N/A'} (higher is better, max 1.0).`
          : `Top feature driving variance: **${fi[0]?.name ?? 'N/A'}** (${((fi[0]?.importance ?? 0) * 100).toFixed(1)}%).`,
      },
      {
        re: /metric|accuracy|score|r²|rmse|mape/i,
        ans: Object.keys(metrics).length > 0
          ? `**${algoName}** on **"${params.table}"**: ${Object.entries(metrics).map(([k, v]) => `${k} = **${v}**`).join(', ')}.`
          : 'Metrics will be available after analysis completes.',
      },
    ];
  }, [featureImportances, predictions, metrics, algoName, params.table, analysisResult]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const contextPrefix = [
        `[table="${params.table}"`,
        `algo=${algoName}`,
        `target=${params.target || 'N/A'}`,
        Object.keys(metrics).length > 0 ? `metrics: ${Object.entries(metrics).map(([k,v]) => `${k}=${v}`).join(', ')}` : '',
        featureImportances[0] ? `top_feature=${featureImportances[0].name}(${(featureImportances[0].importance * 100).toFixed(1)}%)` : '',
      ].filter(Boolean).join(', ') + '] ';

      const res = await apiClient.post('/chat', {
        connection_id: params.connectionId,
        message: contextPrefix + msg,
        history: messages.slice(-8).map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.content })),
      });
      setMessages(prev => [...prev, { role: 'ai', content: res?.response || res?.data?.response || 'No response received.' }]);
    } catch {
      const fb = fallbacks.find(f => f.re.test(msg));
      setMessages(prev => [...prev, {
        role: 'ai',
        content: fb?.ans ?? (Object.keys(metrics).length > 0
          ? `**${algoName}** on **"${params.table}"** — ${Object.entries(metrics).map(([k, v]) => `${k}=${v}`).join(', ')}. Top feature: **${featureImportances[0]?.name ?? 'N/A'}**.`
          : `Analysis is still loading. Try asking again once the results appear.`),
      }]);
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, messages, params, algoName, metrics, featureImportances, fallbacks]);

  // ── Export (uses real backend data)
  const exportReport = useCallback(() => {
    const report = {
      title:     'GraphIntel Deep Analysis Report',
      generated: new Date().toISOString(),
      config:    { ...params, algoName },
      status:    analysisResult?.status ?? (analysisError ? 'error' : 'pending'),
      row_count: analysisResult?.row_count,
      metrics:   analysisResult?.metrics ?? {},
      feature_importances: featureImportances,
      predictions,
      insights:  analysisResult?.insights ?? [],
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `graphintel-${params.table}-${Date.now()}.json`;
    a.click();
  }, [params, algoName, metrics, featureImportances, predictions, analysisResult, analysisError]);

  // ── Shared recharts styles
  const axisProps = {
    tick: { fill: 'rgba(255,255,255,0.28)', fontSize: 10 },
    axisLine: { stroke: 'rgba(255,255,255,0.08)' },
    tickLine: false,
  };
  const grid = { stroke: 'rgba(255,255,255,0.05)', strokeDasharray: '3 3' };

  const VIZ_TABS = [
    { id: 'scatter', label: '2D Scatter', Icon: Activity },
    { id: 'bar',     label: 'Features',   Icon: BarChart3 },
    { id: 'line',    label: 'Trend',      Icon: TrendingUp },
    { id: '3d',      label: '3D Plot',    Icon: Layers },
    { id: 'heatmap', label: 'Correlation',Icon: LayoutGrid },
  ];

  const RIGHT_TABS = [
    { id: 'insights',    label: 'Insights',    Icon: Sparkles },
    { id: 'predictions', label: 'Predictions', Icon: Clock },
    { id: 'chat',        label: 'AI Chat',     Icon: MessageSquare },
  ];

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      className="flex flex-col h-screen bg-[var(--bg-dark)] text-[var(--text-main)] overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-5 py-3 bg-[var(--glass-bg)] border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-br from-[var(--primary-cyan)]/20 to-[var(--primary-purple)]/20 rounded-lg border border-[var(--primary-cyan)]/20">
            <Brain size={16} className="text-[var(--primary-cyan)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">Deep Analysis</span>
              <span className="text-[10px] px-2 py-0.5 bg-[var(--primary-cyan)]/10 border border-[var(--primary-cyan)]/25 text-[var(--primary-cyan)] rounded-full">{algoName}</span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-full capitalize">{params.family}</span>
              {analysisLoading && (
                <span className="flex items-center gap-1 text-[10px] text-gray-500">
                  <RefreshCw size={9} className="animate-spin" /> Analysing…
                </span>
              )}
              {analysisError && !analysisLoading && (
                <span className="flex items-center gap-1 text-[10px] text-red-400">
                  <AlertTriangle size={9} /> Analysis failed
                </span>
              )}
              {analysisResult && !analysisLoading && (
                <span className="text-[10px] px-2 py-0.5 bg-green-500/15 border border-green-500/25 text-green-400 rounded-full">
                  ✓ Live data
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5 flex-wrap">
              <Database size={9} />
              <span className="font-mono">{params.table || 'no table'}</span>
              {(params.target || chartCols.y) && <><span>·</span><span className="text-green-400">→ {params.target || chartCols.y}</span></>}
              {features.length > 0 && <><span>·</span><span className="text-purple-400">{features.length} features</span></>}
              {chartCols.x && <><span>·</span><span className="text-gray-500">x: {chartCols.x}</span></>}
              {params.secondaryTables.length > 0 && <><span>·</span><span className="text-amber-400">+{params.secondaryTables.length} joined</span></>}
              {analysisResult?.row_count > 0 && <><span>·</span><span className="text-gray-500">{Number(analysisResult.row_count).toLocaleString()} rows</span></>}
            </div>
          </div>
        </div>

        {/* Metrics strip — only renders when we have real metrics */}
        {Object.keys(metrics).length > 0 && (
          <div className="hidden md:flex items-center gap-4 px-4 py-1.5 bg-white/3 border border-white/8 rounded-lg ml-4">
            {Object.entries(metrics).map(([k, v]) => (
              <div key={k} className="text-center">
                <p className="text-xs font-bold text-[var(--primary-cyan)]">{v}</p>
                <p className="text-[9px] text-gray-500">{k}</p>
              </div>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {analysisLoading && <RefreshCw size={13} className="animate-spin text-[var(--primary-cyan)]" />}
          <button onClick={exportReport}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--primary-cyan)]/10 border border-[var(--primary-cyan)]/30 text-[var(--primary-cyan)] rounded-lg text-xs font-semibold hover:bg-[var(--primary-cyan)]/20 transition-all">
            <Download size={13} /> Export Analysis
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-52 flex-shrink-0 bg-[var(--glass-bg)] border-r border-white/8 overflow-y-auto p-4 flex flex-col gap-5">

          <section>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Model config</p>
            <div className="space-y-1.5">
              {[
                { k: 'Algorithm', v: algoName,          c: 'text-[var(--primary-cyan)]' },
                { k: 'Task',      v: params.family,     c: 'text-white capitalize' },
                { k: 'Table',     v: params.table,      c: 'text-amber-300 font-mono text-[10px]' },
                { k: 'Target',    v: params.target || 'unsupervised', c: 'text-green-400 font-mono text-[10px]' },
              ].map(r => (
                <div key={r.k} className="flex justify-between items-start gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{r.k}</span>
                  <span className={`text-[10px] text-right truncate max-w-[110px] ${r.c}`}>{r.v}</span>
                </div>
              ))}
              {params.secondaryTables.length > 0 && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">Joins</span>
                  <span className="text-[10px] text-purple-400 text-right truncate max-w-[110px]">{params.secondaryTables.join(', ')}</span>
                </div>
              )}
            </div>
          </section>

          {/* Feature importances — real values from backend */}
          <section>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Feature importance
              {analysisLoading && <RefreshCw size={8} className="inline ml-1 animate-spin opacity-50" />}
            </p>
            <div className="space-y-2.5">
              {featureImportances.map((f, i) => (
                <div key={f.name}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[var(--text-main)] font-mono truncate max-w-[112px]">{f.name}</span>
                    <span className="text-[var(--primary-cyan)] flex-shrink-0">{(f.importance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${f.importance * 100}%` }}
                      transition={{ delay: i * 0.07, duration: 0.7, ease: 'easeOut' }}
                      className="h-1.5 rounded-full bg-gradient-to-r from-[var(--primary-cyan)] to-[var(--primary-purple)]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Data patterns — real values from backend metrics */}
          {dataPatterns.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Model stats</p>
              <div className="space-y-1.5">
                {dataPatterns.map(r => (
                  <div key={r.k} className="flex justify-between text-[10px]">
                    <span className="text-[var(--text-muted)]">{r.k}</span>
                    <span className={r.c}>{r.v}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Loading placeholder */}
          {analysisLoading && dataPatterns.length === 0 && (
            <section>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Model stats</p>
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-3 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* Center: charts */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center gap-1 px-4 py-2 bg-[var(--glass-bg)] border-b border-white/8 flex-shrink-0">
            {VIZ_TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setActiveViz(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                  activeViz === id
                    ? 'bg-[var(--primary-cyan)]/10 border-[var(--primary-cyan)]/30 text-[var(--primary-cyan)]'
                    : 'border-transparent text-[var(--text-muted)] hover:bg-white/5 hover:text-white'
                }`}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 p-4 overflow-hidden bg-[#060d0e] flex items-center justify-center">
            {/* Loading overlay */}
            {analysisLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#060d0e]/80 z-10 pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={24} className="animate-spin text-[var(--primary-cyan)]" />
                  <p className="text-xs text-gray-400">Running {algoName} on {params.table}…</p>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={activeViz}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full h-full"
              >
                {/* 2D Scatter — uses real scatter_sample */}
                {activeViz === 'scatter' && (
                  scatterData.length === 0 && !analysisLoading
                    ? <p className="text-xs text-gray-500">{analysisError || 'No numeric columns found in the result. Select feature columns before running.'}</p>
                    : <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
                          <CartesianGrid {...grid} />
                          <XAxis dataKey={chartCols.x} name={chartCols.x} {...axisProps} />
                          <YAxis dataKey={chartCols.y} name={chartCols.y} {...axisProps} />
                          <ZAxis dataKey="sz" range={[30, 180]} />
                          <RTooltip content={<DarkTip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.08)' }} />
                          {[0, 1, 2].map(c => (
                            <Scatter key={c} name={`Cluster ${c + 1}`}
                              data={scatterData.filter(d => d.cluster === c)}
                              fill={CLUSTER_COLORS[c]} fillOpacity={0.72} />
                          ))}
                          <RLegend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }} />
                        </ScatterChart>
                      </ResponsiveContainer>
                )}

                {/* Feature bar — uses real feature_importances */}
                {activeViz === 'bar' && (
                  barData.length === 0 && !analysisLoading
                    ? <p className="text-xs text-gray-500">{analysisError ? analysisError : 'Feature importances not available for this algorithm.'}</p>
                    : <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 32, bottom: 8, left: 88 }}>
                      <CartesianGrid horizontal={false} {...grid} />
                      <XAxis type="number" domain={[0, 'dataMax']}
                        tickFormatter={v => `${(v * 100).toFixed(0)}%`} {...axisProps} />
                      <YAxis type="category" dataKey="name" width={86}
                        tick={{ ...axisProps.tick, fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={axisProps.axisLine} tickLine={false} />
                      <RTooltip content={<DarkTip />} formatter={v => [`${(v * 100).toFixed(1)}%`, 'Importance']} />
                      <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={22}>
                        {barData.map((_, i) => (
                          <Cell key={i} fill={`hsl(${180 + i * 28},70%,55%)`} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Trend line — real data from scatter_sample / timeseries predictions */}
                {activeViz === 'line' && (
                  lineData.length === 0 && !analysisLoading
                    ? <p className="text-xs text-gray-500">{analysisError || 'No trend data returned. The model may not have produced predictions for this configuration.'}</p>
                    : <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={lineData} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
                          <CartesianGrid {...grid} />
                          <XAxis dataKey="period" {...axisProps} interval={3} />
                          <YAxis {...axisProps} />
                          <RTooltip content={<DarkTip />} />
                          <Area dataKey="upper"  fill={CYAN}    fillOpacity={0.04} stroke="none" />
                          <Area dataKey="lower"  fill="#060d0e" stroke="none" />
                          <Line dataKey="actual"    stroke={CYAN}   strokeWidth={2}   dot={false} name="Actual" />
                          <Line dataKey="predicted" stroke={PURPLE} strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="Predicted" />
                          <RLegend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                )}

                {/* 3D scatter — uses real scatter_sample positions */}
                {activeViz === '3d' && (
                  scatterData.length === 0 && !analysisLoading
                    ? <p className="text-xs text-gray-500">{analysisError ? analysisError : 'No data available for 3D plot.'}</p>
                    : <Canvas camera={{ position: [22, 14, 22], fov: 55 }} style={{ background: 'transparent', width: '100%', height: '100%' }}>
                        <ambientLight intensity={0.5} />
                        <pointLight position={[10, 10, 10]} intensity={0.7} />
                        <Suspense fallback={null}>
                          <Points3D data={scatterData.slice(0, 80)} xCol={chartCols.x} yCol={chartCols.y} />
                          <OrbitControls autoRotate autoRotateSpeed={0.7} enableZoom />
                        </Suspense>
                        <gridHelper args={[30, 20, '#1a2a2a', '#111f1f']} />
                      </Canvas>
                )}

                {/* Correlation heatmap — real Pearson r from scatter_sample */}
                {activeViz === 'heatmap' && (
                  !realCorrData && !analysisLoading
                    ? <p className="text-xs text-gray-500">{analysisError ? analysisError : 'No data available for correlation heatmap.'}</p>
                    : <div className="w-full h-full flex items-center justify-center">
                        <CorrHeatmap features={features} corrData={realCorrData} />
                      </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Right panel */}
        <aside className="w-[17rem] flex-shrink-0 flex flex-col bg-[var(--glass-bg)] border-l border-white/8">
          <div className="flex border-b border-white/8 flex-shrink-0">
            {RIGHT_TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setActiveRightTab(id)}
                className={`flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-medium transition-all border-b-2 ${
                  activeRightTab === id
                    ? 'text-[var(--primary-cyan)] border-[var(--primary-cyan)]'
                    : 'text-[var(--text-muted)] border-transparent hover:text-white'
                }`}>
                <Icon size={11} />{label}
              </button>
            ))}
          </div>

          {/* Insights — real from backend analysisResult.insights */}
          {activeRightTab === 'insights' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Metrics summary card */}
              {Object.keys(metrics).length > 0 && (
                <div className="p-3 bg-gradient-to-br from-[var(--primary-purple)]/10 to-[var(--primary-cyan)]/10 border border-[var(--primary-purple)]/20 rounded-xl">
                  <p className="text-[10px] font-semibold text-[var(--primary-cyan)] mb-2">{algoName} · {params.family}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(metrics).map(([k, v]) => (
                      <div key={k} className="text-center">
                        <p className="text-sm font-bold text-white">{v}</p>
                        <p className="text-[9px] text-gray-500">{k}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state */}
              {analysisLoading && (
                <div className="flex items-center gap-2 p-3 text-gray-500 text-xs">
                  <RefreshCw size={12} className="animate-spin text-[var(--primary-cyan)]" />
                  Running {algoName} on real data…
                </div>
              )}

              {/* Error state */}
              {analysisError && !analysisLoading && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-red-400 leading-relaxed">{analysisError}</p>
                </div>
              )}

              {/* Real insights from backend */}
              {(analysisResult?.insights || []).map((ins, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="p-3 bg-white/3 border border-white/8 rounded-xl">
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--primary-cyan)]`}>
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{ins}</p>
                </motion.div>
              ))}

              {/* Placeholder when no insights yet and not loading */}
              {!analysisLoading && !analysisError && (analysisResult?.insights || []).length === 0 && (
                <div className="p-3 bg-white/3 border border-white/8 rounded-xl text-[11px] text-gray-500 text-center">
                  No insights generated for this configuration.
                </div>
              )}
            </div>
          )}

          {/* Predictions — real from backend */}
          {activeRightTab === 'predictions' && (
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[10px] text-[var(--text-muted)] mb-3 leading-relaxed">
                Forecast: <strong className="text-white">{algoName}</strong> on <strong className="text-amber-300">"{params.table}"</strong>
              </p>

              {analysisLoading && (
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <RefreshCw size={12} className="animate-spin" /> Computing predictions…
                </div>
              )}

              {predictions.length === 0 && !analysisLoading && (
                <div className="text-[11px] text-gray-500 text-center p-3">
                  {analysisError ? 'Analysis failed — no predictions available.' : 'No prediction data returned for this algorithm.'}
                </div>
              )}

              <div className="space-y-2">
                {predictions.map((p, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    className="p-3 bg-white/3 border border-white/8 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[var(--text-muted)]">{p.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                        p.confidence === 'high'
                          ? 'bg-green-500/15 text-green-400'
                          : p.confidence === 'medium'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-gray-500/15 text-gray-400'
                      }`}>{p.confidence}</span>
                    </div>
                    <p className="text-[15px] font-bold text-white">
                      {typeof p.value === 'number'
                        ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : p.value}
                    </p>
                    {p.lower != null && p.upper != null && (
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {p.lower.toLocaleString(undefined, { maximumFractionDigits: 2 })} – {p.upper.toLocaleString(undefined, { maximumFractionDigits: 2 })} (95% CI)
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-white/3 border border-white/8 rounded-xl text-[10px] text-[var(--text-muted)]">
                {algoName} · {features.length} features · {params.table || 'no table'}
              </div>
            </div>
          )}

          {/* AI Chat */}
          {activeRightTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
                {chatLoading && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-white/5 rounded-xl w-fit">
                    {[0, 0.18, 0.36].map(d => (
                      <motion.div key={d} className="w-1.5 h-1.5 bg-[var(--primary-cyan)] rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: d }} />
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-white/8 flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Ask about patterns, predictions…"
                  rows={2}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder-gray-600 resize-none outline-none focus:border-[var(--primary-cyan)]/40 transition-colors"
                />
                <button onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="self-end px-2.5 py-2 bg-[var(--primary-cyan)]/20 border border-[var(--primary-cyan)]/30 text-[var(--primary-cyan)] rounded-lg hover:bg-[var(--primary-cyan)]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
