/**
 * WorkOnDataModal.jsx
 *
 * Full ML analysis launcher:
 *  - AI suggests best tables + columns with reasoning
 *  - User can accept AI suggestion or manually select
 *  - All 4 algorithm families: Classification, Regression, Time Series, Clustering
 *  - "Run Model" calls real /api/ml/analyze and shows results inline
 *  - "Open Deep Analysis" still opens /deep-analysis in a new tab
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, Brain, ChevronDown, ChevronRight, Check,
  Database, Columns, RefreshCw, Zap, FlaskConical, TrendingUp,
  GitBranch, Clock, Layers, ExternalLink, AlertTriangle,
  ArrowLeft, BarChart2, Lightbulb, Activity, Search, CheckSquare, Square,
  Send, StopCircle, Loader2, History, Download, Upload, FileText, Table2
} from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { useAgentStream } from '../../hooks/useAgentStream';
import RecentRunsSidebar from './RecentRunsSidebar';

// ─── Algorithm Catalogue ───────────────────────────────────────────────────────
const ALGO_FAMILIES = [
  {
    id: 'classification',
    label: 'Classification',
    icon: GitBranch,
    color: 'cyan',
    description: 'Predict categories or labels',
    algos: [
      { id: 'rf_clf', name: 'Random Forest', tag: 'Accurate', tagColor: 'blue', best_for: 'High-dimensional data, mixed types' },
      { id: 'svm', name: 'SVM', tag: 'Robust', tagColor: 'purple', best_for: 'Clear margin separation, medium datasets' },
      { id: 'knn', name: 'K-Nearest Neighbors', tag: 'Fast', tagColor: 'green', best_for: 'Local patterns, small-medium datasets' },
      { id: 'logreg', name: 'Logistic Regression', tag: 'Interpretable', tagColor: 'teal', best_for: 'Binary outcomes, linear boundaries' },
    ],
  },
  {
    id: 'regression',
    label: 'Regression',
    icon: TrendingUp,
    color: 'orange',
    description: 'Predict continuous numeric values',
    algos: [
      { id: 'linear', name: 'Linear Regression', tag: 'Fast', tagColor: 'green', best_for: 'Linear relationships, baseline model' },
      { id: 'ridge', name: 'Ridge Regression', tag: 'Regularized', tagColor: 'blue', best_for: 'Multicollinearity, many features' },
      { id: 'lasso', name: 'Lasso Regression', tag: 'Sparse', tagColor: 'purple', best_for: 'Feature selection, sparse solutions' },
      { id: 'xgboost', name: 'GradientBoosting', tag: '★ Best', tagColor: 'amber', best_for: 'Tabular data, high accuracy, non-linear' },
    ],
  },
  {
    id: 'timeseries',
    label: 'Time Series',
    icon: Clock,
    color: 'violet',
    description: 'Forecast temporal patterns',
    algos: [
      { id: 'arima', name: 'ARIMA', tag: 'Classic', tagColor: 'teal', best_for: 'Stationary time series, seasonal data' },
    ],
  },
  {
    id: 'clustering',
    label: 'Clustering',
    icon: Layers,
    color: 'pink',
    description: 'Discover hidden groups',
    algos: [
      { id: 'kmeans', name: 'K-Means', tag: 'Fast', tagColor: 'green', best_for: 'Well-separated spherical clusters' },
      { id: 'dbscan', name: 'DBSCAN', tag: 'Flexible', tagColor: 'purple', best_for: 'Arbitrary shapes, noise detection' },
    ],
  },
];

const COLOR_MAP = {
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-[0_0_12px_rgba(34,211,238,0.15)]' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-[0_0_12px_rgba(249,115,22,0.15)]' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'shadow-[0_0_12px_rgba(139,92,246,0.15)]' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', glow: 'shadow-[0_0_12px_rgba(236,72,153,0.15)]' },
};

const TAG_COLORS = {
  blue: 'bg-blue-500/20 text-blue-300',
  purple: 'bg-purple-500/20 text-purple-300',
  green: 'bg-green-500/20 text-green-300',
  teal: 'bg-teal-500/20 text-teal-300',
  amber: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
};

// ─── Family accent colours ────────────────────────────────────────────────────
const FAMILY_HEX = {
  classification: '#22d3ee',
  regression: '#f97316',
  timeseries: '#8b5cf6',
  clustering: '#ec4899',
};

// ─── AI Suggestion Engine (client-side heuristic + optional API) ─────────────

// Tables that are internal/system tables — bad primary ML tables
const SYSTEM_TABLE_RE = /token|snapshot|migration|audit|_log$|logs$|session|auth|permission|role|cache|queue|celery|job_|neural_/i;
// Columns that are IDs/FKs — bad regression targets
const ID_COL_RE = /^id$|_id$|^fk_/i;
// Column names that make strong regression targets
const PREFERRED_TARGET_RE = /amount|price|rate|duration|score|count|total|soc|pct|percent|revenue|cost|age|weight|temp|value|salary|balance|distance|health|charge/i;

function pickBestTarget(candidates) {
  const nonId = candidates.filter(c => !ID_COL_RE.test(c.name));
  const preferred = nonId.filter(c => PREFERRED_TARGET_RE.test(c.name));
  return (preferred[0] || nonId[0] || candidates[0])?.name || null;
}

function generateAISuggestion(graphData) {
  const tables = graphData?.nodes || [];
  if (!tables.length) return null;

  const scored = tables.map(t => {
    const cols = t.columns || [];
    const meaningfulNumerics = cols.filter(c =>
      /int|float|double|decimal|numeric|real|number/i.test(c.type || '') && !ID_COL_RE.test(c.name)
    );
    const isSystem = SYSTEM_TABLE_RE.test(t.name || '');
    return {
      ...t,
      score: (Math.log10((t.row_count || 1) + 1) * 40)
        + ((cols.length || 0) * 2)
        + ((t.foreign_keys?.length || 0) * 5)
        + (meaningfulNumerics.length * 15)   // boost tables with real numeric columns
        - (isSystem ? 200 : 0),              // heavy penalty for system/internal tables
    };
  }).sort((a, b) => b.score - a.score);

  const primary = scored[0];
  const allColumns = primary?.columns || [];
  const numericCols = allColumns.filter(c => /int|float|double|decimal|numeric|real|number/i.test(c.type || ''));
  const nonIdNumerics = numericCols.filter(c => !ID_COL_RE.test(c.name));
  const dateCols = allColumns.filter(c => /date|time|timestamp/i.test(c.type || ''));
  const catCols = allColumns.filter(c => /char|varchar|text|bool|enum/i.test(c.type || ''));

  let taskFamily = 'regression', recommendedAlgo = 'xgboost';
  let targetCol = pickBestTarget(nonIdNumerics.length ? nonIdNumerics : numericCols) || allColumns[0]?.name;
  let featureCols = [];
  let reasoning = '', confidence = 87;

  if (dateCols.length > 0 && nonIdNumerics.length > 0) {
    taskFamily = 'timeseries'; recommendedAlgo = 'arima';
    targetCol = pickBestTarget(nonIdNumerics);
    featureCols = [dateCols[0]?.name].filter(Boolean);
    reasoning = `Detected ${dateCols.length} timestamp column(s) in "${primary.name}". Seasonal trend model will be applied.`;
    confidence = 82;
  } else if (nonIdNumerics.length >= 2) {
    taskFamily = 'regression'; recommendedAlgo = 'xgboost';
    targetCol = pickBestTarget(nonIdNumerics);
    featureCols = nonIdNumerics.filter(c => c.name !== targetCol).slice(0, 4).map(c => c.name)
      .concat(catCols.slice(0, 2).map(c => c.name));
    reasoning = `"${primary.name}" has ${nonIdNumerics.length} numeric columns and ${primary.row_count?.toLocaleString() || 'many'} rows. GradientBoosting excels on tabular data.`;
    confidence = 91;
  } else if (catCols.length > 0) {
    taskFamily = 'classification'; recommendedAlgo = 'rf_clf';
    targetCol = catCols[0]?.name;
    featureCols = nonIdNumerics.slice(0, 4).map(c => c.name).concat(catCols.slice(1, 3).map(c => c.name));
    reasoning = `Categorical target "${catCols[0]?.name}" detected in "${primary.name}". Random Forest handles mixed feature types robustly.`;
    confidence = 85;
  } else {
    taskFamily = 'clustering'; recommendedAlgo = 'kmeans';
    targetCol = null;
    featureCols = nonIdNumerics.slice(0, 5).map(c => c.name);
    reasoning = `No clear target column detected. K-Means can discover hidden segments in "${primary.name}".`;
    confidence = 74;
  }

  const secondaryTables = scored.slice(1, 3).map(t => ({
    name: t.name,
    reason: t.foreign_keys?.length > 0
      ? `Joins to ${primary.name} via foreign key — adds relational context`
      : `${t.row_count?.toLocaleString() || 0} rows of supporting dimensional data`,
  }));

  return {
    primaryTable: primary.name, secondaryTables, taskFamily, recommendedAlgo,
    targetCol, featureCols: featureCols.filter(Boolean).slice(0, 6),
    reasoning, confidence, allTables: scored,
  };
}

// ─── Metric display labels per family ────────────────────────────────────────
const METRIC_LABELS = {
  // classification
  accuracy: 'Accuracy',
  baseline_accuracy: 'Baseline',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1 Score',
  n_classes: 'Classes',
  // regression
  R2: 'R²',
  RMSE: 'RMSE',
  MAE: 'MAE',
  // clustering
  silhouette_score: 'Silhouette',
  n_clusters: 'Clusters',
  inertia: 'Inertia',
  n_noise_points: 'Noise Pts',
  // timeseries
  MAPE: 'MAPE',
  trend: 'Trend',
  monthly_growth: 'Growth/Mo',
};

// Keys shown per family (ordered)
const FAMILY_METRIC_KEYS = {
  classification: ['accuracy', 'baseline_accuracy', 'f1', 'precision', 'recall'],
  regression: ['R2', 'RMSE', 'MAE'],
  clustering: ['silhouette_score', 'n_clusters', 'inertia'],
  timeseries: ['trend', 'MAPE', 'monthly_growth', 'RMSE'],
};

// ─── Results Panel ────────────────────────────────────────────────────────────
function ResultsPanel({ results, onBack, onOpenDeep }) {
  const accent = FAMILY_HEX[results.family] || '#22d3ee';
  const algoName = ALGO_FAMILIES.flatMap(f => f.algos).find(a => a.id === results.algo)?.name || results.algo;

  // Show family-specific metrics in a defined order, fall back to all non-internal keys
  const preferredKeys = FAMILY_METRIC_KEYS[results.family] || [];
  const metricEntries = preferredKeys.length > 0
    ? preferredKeys.filter((k) => k in results.metrics).map((k) => [k, results.metrics[k]])
    : Object.entries(results.metrics).filter(
      ([k]) => !['samples', 'train_size', 'test_size', 'n_classes', 'model'].includes(k)
    );

  return (
    <div className="p-6 space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={13} /> Back
        </button>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">{algoName}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}30` }}>
            {results.family}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">{results.table}</span>
          {results.row_count > 0 && (
            <span className="text-[10px] text-gray-600">· {results.row_count.toLocaleString()} rows</span>
          )}
        </div>
        <button
          onClick={onOpenDeep}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg border transition-all"
          style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
        >
          <ExternalLink size={11} /> Deep Analysis
        </button>
        <button
          onClick={() => {
            apiClient.get(`/ml/run/${results.run_id}/pdf`, { responseType: 'blob' })
              .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ML_Report_${results.run_id.slice(0, 8)}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => window.URL.revokeObjectURL(url), 250);
              })
              .catch((err) => {
                console.error('[PDF download failed]', err);
                alert('PDF download failed. The report may not be available for this run.');
              });
          }}
          className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all font-semibold"
        >
          <Download size={11} /> Download Report
        </button>
      </div>

      {/* Data quality warnings — shown BEFORE metrics so user reads them first */}
      {results.data_warnings?.length > 0 && (
        <div className="space-y-1.5">
          {results.data_warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-200 leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metricEntries.map(([key, val]) => (
          <div key={key} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold leading-none mb-1">
              {METRIC_LABELS[key] || key}
            </p>
            <p className="text-lg font-black tabular-nums leading-none" style={{ color: accent }}>
              {typeof val === 'number'
                ? (key === 'MAPE' ? `${val}%` : key === 'monthly_growth' ? `${val > 0 ? '+' : ''}${val}%` : val.toLocaleString(undefined, { maximumFractionDigits: 4 }))
                : String(val)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        {/* Feature importances */}
        {results.feature_importances.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <BarChart2 size={11} style={{ color: accent }} /> Feature Importance
            </p>
            <div className="space-y-2">
              {results.feature_importances.slice(0, 8).map((fi) => (
                <div key={fi.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-gray-300 font-mono truncate max-w-[65%]">{fi.name}</span>
                    <span className="text-[10px] font-bold" style={{ color: accent }}>
                      {(fi.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${fi.importance * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.05 }}
                      className="h-full rounded-full"
                      style={{ background: accent }}
                    />
                  </div>
                  {fi.insight && (
                    <p className={`mt-1 text-[10px] italic leading-tight ${fi.direction === 'positive' ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      {fi.insight}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predictions */}
        {results.predictions.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <Activity size={11} style={{ color: accent }} />
              {results.family === 'clustering' ? 'Segment Distribution' :
                results.family === 'classification' ? 'Class Distribution' : 'Predictions'}
            </p>
            <div className="space-y-2">
              {results.predictions.slice(0, 6).map((pred, i) => {
                const confColor = pred.confidence === 'high' ? '#10b981'
                  : pred.confidence === 'medium' ? '#f59e0b' : '#6b7280';
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 w-20 truncate flex-shrink-0">{pred.label}</span>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.abs(pred.value))}%` }}
                        transition={{ duration: 0.5, delay: 0.05 * i }}
                        className="h-full rounded-full"
                        style={{ background: confColor }}
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums w-20 text-right"
                      style={{ color: confColor }}>
                      {typeof pred.value === 'number'
                        ? (results.family === 'clustering' || results.family === 'classification'
                          ? `${pred.value.toFixed(1)}%`
                          : pred.value.toLocaleString(undefined, { maximumFractionDigits: 2 }))
                        : pred.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      {results.insights.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
            <Lightbulb size={11} style={{ color: accent }} /> AI Insights
          </p>
          <div className="space-y-2">
            {results.insights.map((ins, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-start gap-2.5"
              >
                <span className="text-[10px] font-black mt-0.5" style={{ color: accent }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-[12px] text-gray-300 leading-relaxed">{ins}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function WorkOnDataModal({ isOpen, onClose, graphData, connectionId }) {
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Config selections
  const [selectedFamily, setSelectedFamily] = useState('regression');
  const [selectedAlgo, setSelectedAlgo] = useState('xgboost');
  const [expandedFamily, setExpandedFamily] = useState('regression');
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedSecondaryTables, setSelectedSecondaryTables] = useState([]);
  const [targetCol, setTargetCol] = useState('');
  const [featureCols, setFeatureCols] = useState([]);
  const [tableSearch, setTableSearch] = useState('');
  const [colSearch, setColSearch] = useState('');

  // ── Data source mode ──────────────────────────────────────────────────────
  const [dataSourceMode, setDataSourceMode] = useState('database'); // 'database' | 'csv'
  const [csvUploadId,     setCsvUploadId]    = useState(null);
  const [csvFilename,     setCsvFilename]    = useState('');
  const [csvColumns,      setCsvColumns]     = useState([]); // [{name, type}]
  const [csvRowCount,     setCsvRowCount]    = useState(0);
  const [csvUploadStatus, setCsvUploadStatus] = useState('idle'); // 'idle'|'uploading'|'done'|'error'
  const [csvUploadError,  setCsvUploadError]  = useState(null);
  const csvDropRef = useRef(null);

  // Run state
  const [isGenerating, setIsGenerating] = useState(false);
  const [mlResults, setMlResults] = useState(null);
  const [mlError, setMlError] = useState(null);
  const runAbortRef = useRef(null);          // AbortController for the /run POST
  const pollTimerRef = useRef(null);         // setInterval id for status polling
  const activeRunIdRef = useRef(null);       // run_id being polled

  // History state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historyRuns, setHistoryRuns] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchRunHistory = useCallback(async () => {
    if (!connectionId) return;
    setIsHistoryLoading(true);
    try {
      const res = await apiClient.get('/ml/experiments', { params: { connection_id: connectionId, limit: 20 } });
      setHistoryRuns(res.runs || []);
    } catch (e) {
      console.warn('[ML/history] failed:', e);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (isOpen && connectionId) fetchRunHistory();
  }, [isOpen, connectionId, fetchRunHistory]);

  const ML_ERROR_MESSAGES = {
    422: (detail) => `Check your column selection: ${detail}`,
    504: () => 'Analysis timed out — try fewer features or a faster algorithm.',
    503: () => 'Database connection failed — check your connection.',
    500: () => 'Unexpected error — our team has been notified.',
  };

  const structuredMlError = (err) => {
    const status = err?.response?.status ?? err?.status;
    const detail = err?.response?.data?.detail ?? err?.detail ?? err?.message ?? 'Analysis failed.';
    const builder = ML_ERROR_MESSAGES[status];
    return builder ? builder(detail) : detail;
  };

  const _stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    activeRunIdRef.current = null;
  }, []);

  const handleCancelRun = useCallback(() => {
    const runId = activeRunIdRef.current;  // capture before _stopPolling clears it
    _stopPolling();
    runAbortRef.current?.abort();
    if (runId) {
      apiClient.delete(`/ml/run/${runId}`).catch(() => { });
    }
    setIsGenerating(false);
    setMlError(null);
  }, [_stopPolling]);

  // ── CSV upload handler ────────────────────────────────────────────────────
  const handleCsvFile = useCallback(async (file) => {
    if (!file) return;
    setCsvUploadStatus('uploading');
    setCsvUploadError(null);
    setCsvUploadId(null);
    setCsvColumns([]);
    setTargetCol('');
    setFeatureCols([]);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await apiClient.post('/ml/csv/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvUploadId(res.csv_id);
      setCsvFilename(res.filename);
      setCsvColumns(res.columns || []);
      setCsvRowCount(res.row_count || 0);
      setCsvUploadStatus('done');
      // Auto-pick a sensible target (first numeric column that's not an id)
      const numeric = (res.columns || []).filter(c => c.type === 'numeric' && !ID_COL_RE.test(c.name));
      const cat = (res.columns || []).filter(c => c.type !== 'numeric' && !ID_COL_RE.test(c.name));
      if (numeric.length > 0) {
        setTargetCol(numeric[0].name);
        setFeatureCols(numeric.slice(1, 6).concat(cat.slice(0, 2)).map(c => c.name));
      } else if (cat.length > 0) {
        setTargetCol(cat[0].name);
        setFeatureCols(cat.slice(1, 7).map(c => c.name));
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Upload failed.';
      setCsvUploadError(msg);
      setCsvUploadStatus('error');
    }
  }, []);

  const tables = graphData?.nodes || [];
  const activeTable = tables.find(t => t.name === selectedTable);
  const allColumns = activeTable?.columns || [];

  // Aggregate columns from primary + secondary tables
  const columnsFromSelected = React.useMemo(() => {
    if (dataSourceMode === 'csv') {
      return (csvColumns || []).map(c => ({ ...c, _table: csvFilename || 'Uploaded CSV' }));
    }
    const cols = [];
    const seen = new Set();
    const addCols = (tName) => {
      const t = tables.find(x => x.name === tName);
      if (!t?.columns) return;
      t.columns.forEach(c => {
        const key = `${tName}.${c.name}`;
        if (!seen.has(key)) { seen.add(key); cols.push({ ...c, _table: tName }); }
      });
    };
    if (selectedTable) addCols(selectedTable);
    selectedSecondaryTables.forEach(addCols);
    return cols;
  }, [dataSourceMode, csvColumns, csvFilename, tables, selectedTable, selectedSecondaryTables]);

  // Reset selection state when switching data source mode
  useEffect(() => {
    setTargetCol('');
    setFeatureCols([]);
    setColSearch('');
  }, [dataSourceMode]);

  // Clean stale selections when columns change (e.g. after uploading a new CSV)
  useEffect(() => {
    if (!columnsFromSelected.length) return;
    setTargetCol(prev => (prev && columnsFromSelected.some(c => c.name === prev)) ? prev : '');
    setFeatureCols(prev => prev.filter(p => columnsFromSelected.some(c => c.name === p)));
  }, [columnsFromSelected]);



  const filteredTables = React.useMemo(() => {
    const src = aiSuggestion?.allTables || tables;
    if (!tableSearch.trim()) return src;
    const q = tableSearch.toLowerCase();
    return src.filter(t => t.name.toLowerCase().includes(q));
  }, [tables, aiSuggestion, tableSearch]);

  const filteredCols = React.useMemo(() => {
    if (!colSearch.trim()) return columnsFromSelected;
    const q = colSearch.toLowerCase();
    return columnsFromSelected.filter(c => c.name.toLowerCase().includes(q));
  }, [columnsFromSelected, colSearch]);

  // Derive which algorithm families are valid for the current column selection
  const validFamilies = React.useMemo(() => {
    if (!targetCol) return new Set(['classification', 'regression', 'timeseries', 'clustering']);
    const col = columnsFromSelected.find(c => c.name === targetCol);
    const t = col?.type || '';
    const isNum = /int|float|double|decimal|numeric|real/i.test(t);
    const isDate = /date|time|timestamp/i.test(t);
    const hasDateCol = columnsFromSelected.some(c =>
      c.name !== targetCol && /date|time|timestamp/i.test(c.type || '')
    );
    if (isDate) return new Set(['timeseries', 'clustering']);
    if (isNum) return new Set(hasDateCol ? ['regression', 'timeseries', 'clustering'] : ['regression', 'clustering']);
    /* CAT */    return new Set(['classification', 'clustering']);
  }, [targetCol, columnsFromSelected]);

  // Auto-switch family + algo when the current selection becomes incompatible
  useEffect(() => {
    if (validFamilies.has(selectedFamily)) return;
    const next = ['regression', 'classification', 'timeseries', 'clustering'].find(f => validFamilies.has(f));
    if (!next) return;
    setSelectedFamily(next);
    setExpandedFamily(next);
    const defaultAlgo = ALGO_FAMILIES.find(f => f.id === next)?.algos[0]?.id;
    if (defaultAlgo) setSelectedAlgo(defaultAlgo);
  }, [validFamilies, selectedFamily]);

  // Always-current ref so async callbacks read the live manualMode value
  const manualModeRef = useRef(manualMode);
  useEffect(() => { manualModeRef.current = manualMode; }, [manualMode]);

  // Track whether we've already initialized for the current modal session
  const hasInitRef = useRef(false);

  // Generate AI suggestion only when modal FIRST opens — never reset results mid-session
  useEffect(() => {
    if (!isOpen) { hasInitRef.current = false; return; }
    if (!graphData?.nodes?.length) return;
    if (hasInitRef.current) return; // already ran for this open session
    hasInitRef.current = true;

    setMlResults(null);
    setMlError(null);

    const local = generateAISuggestion(graphData);
    setAiSuggestion(local);
    if (local && !manualModeRef.current) applyAISuggestion(local);

    if (!connectionId || !local?.primaryTable) return;
    setAiLoading(true);
    apiClient.get('/ml/suggest', { params: { connection_id: connectionId, table: local.primaryTable } })
      .then(res => {
        const s = res?.suggestion;
        if (!s) return;
        const enhanced = {
          ...local,
          taskFamily: s.family || local.taskFamily,
          recommendedAlgo: s.algo || local.recommendedAlgo,
          targetCol: s.target || local.targetCol,
          featureCols: s.features?.length ? s.features : local.featureCols,
          confidence: s.confidence || local.confidence,
          reasoning: res?.reason || local.reasoning,
          fromBackend: true,
        };
        setAiSuggestion(enhanced);
        if (!manualModeRef.current) applyAISuggestion(enhanced);
      })
      .catch((err) => { console.warn('[ML/suggest] failed:', err?.message || err); })
      .finally(() => setAiLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, graphData]);

  // Stop polling when modal closes mid-run
  useEffect(() => {
    if (!isOpen) _stopPolling();
  }, [isOpen, _stopPolling]);

  const applyAISuggestion = useCallback((s) => {
    if (!s) return;
    setSelectedTable(s.primaryTable);
    setSelectedFamily(s.taskFamily);
    setSelectedAlgo(s.recommendedAlgo);
    setExpandedFamily(s.taskFamily);
    setTargetCol(s.targetCol || '');
    setFeatureCols(s.featureCols || []);
    setSelectedSecondaryTables(s.secondaryTables?.map(t => t.name) || []);
    setManualMode(false);
  }, []);

  const toggleFeature = (col) => setFeatureCols(prev =>
    prev.includes(col)
      ? prev.filter(c => c !== col)
      : prev.length >= 20 ? prev : [...prev, col]
  );

  const selectAllFeatures = () => {
    const available = columnsFromSelected
      .filter(c => c.name !== targetCol && !ID_COL_RE.test(c.name))
      .map(c => c.name)
      .slice(0, 20);
    setFeatureCols(available);
  };


  const toggleSecondaryTable = (name) => setSelectedSecondaryTables(prev =>
    prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
  );

  const handleOpenDeepAnalysis = () => {
    const params = new URLSearchParams({
      connectionId: connectionId || '',
      table: dataSourceMode === 'csv' ? csvFilename : selectedTable,
      secondaryTables: dataSourceMode === 'csv' ? '' : selectedSecondaryTables.join(','),
      family: selectedFamily,
      algo: selectedAlgo,
      target: targetCol,
      // Encode each column name individually to handle commas in Postgres-quoted identifiers
      features: featureCols.map(encodeURIComponent).join(','),
    });
    if (dataSourceMode === 'csv') {
      params.set('csv_id', csvUploadId);
      params.set('csv_filename', csvFilename);
    }
    // Pass the run_id so DeepAnalysisPage can poll the cached result instead of re-running
    if (activeRunIdRef.current) {
      params.set('run_id', activeRunIdRef.current);
    }
    window.open(`/deep-analysis?${params.toString()}`, '_blank');
    onClose();
  };


  const handleRunInline = async () => {
    if (!selectedTable) return;
    _stopPolling();
    const controller = new AbortController();
    runAbortRef.current = controller;
    setIsGenerating(true);
    setMlError(null);
    setMlResults(null);

    let runId;
    try {
      // Start the background job — returns immediately with a run_id
      const payload = dataSourceMode === 'csv' ? {
        csv_id: csvUploadId,
        table: csvFilename,
        family: selectedFamily,
        algo: selectedAlgo,
        target: targetCol || undefined,
        features: featureCols,
      } : {

        connection_id: connectionId,
        table: selectedTable,
        secondary_tables: selectedSecondaryTables,
        family: selectedFamily,
        algo: selectedAlgo,
        target: targetCol || undefined,
        features: featureCols,
      };

      const { run_id } = await apiClient.post('/ml/run', payload, { signal: controller.signal });
      runId = run_id;
      activeRunIdRef.current = runId;
    } catch (e) {

      if (e?.name === 'CanceledError' || e?.name === 'AbortError') return;
      setMlError(structuredMlError(e));
      setIsGenerating(false);
      return;
    }

    // Poll /ml/run/{run_id}/status every 2 seconds
    pollTimerRef.current = setInterval(async () => {
      if (controller.signal.aborted) { _stopPolling(); return; }
      try {
        const job = await apiClient.get(`/ml/run/${runId}/status`);
        if (job.status === 'success') {
          _stopPolling();
          setMlResults(job.result);
          setIsGenerating(false);
          fetchRunHistory(); // Refresh history after a successful run
        } else if (job.status === 'failed') {
          _stopPolling();
          setMlError(job.error || 'Analysis failed.');
          setIsGenerating(false);
        }
        // status === 'running' → keep polling
      } catch (e) {
        _stopPolling();
        setMlError(structuredMlError(e));
        setIsGenerating(false);
      }
    }, 2000);
  };

  // ── APEX Agent NL query bar ──────────────────────────────────────────────
  const [nlQuery, setNlQuery] = useState('');
  const [showAgent, setShowAgent] = useState(false);
  const { run: runAgent, cancel: cancelAgent, events: agentEvents, status: agentStatus, report: agentReport } = useAgentStream();

  const handleAgentQuery = useCallback(async (e) => {
    e?.preventDefault();
    const q = nlQuery.trim();
    if (!q || !connectionId) return;
    setShowAgent(true);
    await runAgent({ query: q, connection_id: connectionId });
  }, [nlQuery, connectionId, runAgent]);

  // When agent produces a report, auto-populate suggestion fields
  useEffect(() => {
    if (!agentReport) return;
    const fi = agentReport.top_feature;
    if (fi) setFeatureCols(prev => prev.includes(fi) ? prev : [fi, ...prev].slice(0, 6));
  }, [agentReport]);

  if (!isOpen) return null;

  const currentFamilyColors = COLOR_MAP[ALGO_FAMILIES.find(f => f.id === selectedFamily)?.color || 'cyan'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-[960px] max-h-[90vh] bg-[#0a1212] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[#0a1212] to-[#0f1a1a] shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg border border-amber-500/20">
                <FlaskConical size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Work on Data
                  <span className="text-[10px] px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 rounded-full font-semibold uppercase tracking-wider">
                    AI Analyst
                  </span>
                </h2>
                <p className="text-xs text-gray-500">
                  {mlResults ? 'Model results from your database' : 'AI-powered ML analysis with real algorithms'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[11px] font-bold ${isSidebarOpen ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
            >
              <History size={14} /> History
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <RecentRunsSidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)} 
            runs={historyRuns}
            isLoading={isHistoryLoading}
            onSelectRun={(run) => {
              setMlResults({
                ...run,
                row_count: run.row_count ?? 0,
                predictions: run.predictions ?? [],
                insights: run.insights ?? [],
                data_warnings: run.data_warnings ?? [],
                status: 'success',
              });
              setIsSidebarOpen(false);
            }}
          />

          {/* ── APEX NL Query Bar ── */}
          <div className="px-6 pt-4 pb-3 border-b border-white/[0.06] bg-[#0a1212] shrink-0">
            <form onSubmit={handleAgentQuery} className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-violet-500/40 transition-colors">
                <Brain size={14} className="text-violet-400 shrink-0" />
                <input
                  value={nlQuery}
                  onChange={e => setNlQuery(e.target.value)}
                  placeholder='Ask APEX: "Find churn drivers" or "Detect anomalies in orders"'
                  disabled={!connectionId}
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
                />
                {agentStatus === 'running' || agentStatus === 'planning' ? (
                  <Loader2 size={14} className="text-violet-400 animate-spin shrink-0" />
                ) : agentEvents.length > 0 ? (
                  <span className="text-[10px] text-violet-400 shrink-0">✓ done</span>
                ) : null}
              </div>
              {agentStatus === 'running' || agentStatus === 'planning' ? (
                <button type="button" onClick={cancelAgent}
                  className="p-2 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                  <StopCircle size={15} />
                </button>
              ) : (
                <button type="submit" disabled={!nlQuery.trim() || !connectionId}
                  className="p-2 rounded-xl bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <Send size={15} />
                </button>
              )}
            </form>
            {/* Live agent status line */}
            {showAgent && agentEvents.length > 0 && (
              <div className="mt-2 text-[11px] text-white/35 truncate pl-1">
                {[...agentEvents].reverse().find(e => e.text)?.text || ''}
              </div>
            )}
            {agentReport?.narrative && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-2 text-[11px] text-violet-300/70 bg-violet-500/5 rounded-lg px-3 py-2 border border-violet-500/15 line-clamp-2">
                {agentReport.narrative}
              </motion.div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* ── Results view ── */}
            {mlResults ? (
              <ResultsPanel
                results={mlResults}
                onBack={() => setMlResults(null)}
                onOpenDeep={handleOpenDeepAnalysis}
              />
            ) : (
              <>
                {/* AI Suggestion Banner */}
                {aiSuggestion && !manualMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-6 mt-5 p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/25 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-purple-500/20 rounded-lg mt-0.5 flex-shrink-0">
                        <Sparkles size={16} className="text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-cyan-400">AI Recommendation</span>
                          <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full font-semibold">
                            {aiSuggestion.confidence}% confidence
                          </span>
                          {aiSuggestion.fromBackend && (
                            <span className="text-[10px] px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-full font-semibold">
                              ✓ Schema-enhanced
                            </span>
                          )}
                          {aiLoading && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <RefreshCw size={9} className="animate-spin" /> Enhancing…
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed mb-3">{aiSuggestion.reasoning}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300">
                            <span className="text-gray-500">Table:</span> <strong className="text-cyan-400">{aiSuggestion.primaryTable}</strong>
                          </span>
                          <span className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300">
                            <span className="text-gray-500">Algorithm:</span> <strong className="text-amber-300">{ALGO_FAMILIES.flatMap(f => f.algos).find(a => a.id === aiSuggestion.recommendedAlgo)?.name}</strong>
                          </span>
                          {aiSuggestion.targetCol && (
                            <span className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300">
                              <span className="text-gray-500">Target:</span> <strong className="text-green-300">{aiSuggestion.targetCol}</strong>
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300">
                            <span className="text-gray-500">Features:</span> <strong className="text-purple-300">{aiSuggestion.featureCols.length} cols</strong>
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => applyAISuggestion(aiSuggestion)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/30 transition-all"
                          >
                            <Check size={12} /> Accept Suggestion
                          </button>
                          <button
                            onClick={() => { setManualMode(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all"
                          >
                            Configure Manually
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Error banner */}
                {mlError && (
                  <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-300 leading-relaxed">{mlError}</p>
                  </div>
                )}

                {/* Data source toggle */}
                <div className="px-6 pt-4 flex items-center gap-4">
                  <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => setDataSourceMode('database')}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dataSourceMode === 'database' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'text-gray-500 hover:text-white'}`}
                    >
                      <Database size={13} /> Database
                    </button>
                    <button
                      onClick={() => setDataSourceMode('csv')}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dataSourceMode === 'csv' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-gray-500 hover:text-white'}`}
                    >
                      <Upload size={13} /> CSV File
                    </button>
                  </div>
                  {dataSourceMode === 'csv' && csvUploadStatus === 'done' && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-white/3 border border-white/8 px-3 py-1.5 rounded-xl">
                      <FileText size={11} className="text-amber-400" />
                      <span className="font-mono">{csvFilename}</span>
                      <span className="text-gray-600">·</span>
                      <span>{csvRowCount.toLocaleString()} rows</span>
                    </div>
                  )}
                </div>

                {/* Config grid */}
                <div className="grid grid-cols-[1fr_1fr] gap-x-6 p-6">


                  {/* LEFT: Table + Column Selection */}
                  <div className="flex flex-col gap-4 min-h-0">

                    {/* ── Tables / CSV Upload ── */}
                    <div className="flex flex-col min-h-0">
                      <div className="flex items-center gap-2 mb-2">
                        {dataSourceMode === 'database' ? (
                          <>
                            <Database size={13} className="text-cyan-400" />
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tables</span>
                            <span className="text-[10px] text-gray-500 ml-auto tabular-nums">
                              {selectedTable ? '1 primary' : '—'}
                              {selectedSecondaryTables.length > 0 ? ` + ${selectedSecondaryTables.length} joined` : ''}
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload size={13} className="text-amber-400" />
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">File Ingestion</span>
                          </>
                        )}
                      </div>

                      {dataSourceMode === 'database' ? (
                        <>
                          {/* Table search */}
                          <div className="relative mb-2">
                            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input
                              type="text" value={tableSearch} onChange={e => setTableSearch(e.target.value)}
                              placeholder="Filter tables…"
                              className="w-full pl-7 pr-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-[11px] text-white placeholder-gray-600 outline-none focus:border-cyan-500/40 transition-colors"
                            />
                          </div>
                          {/* Table list — ALL tables, scrollable */}
                          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                            {filteredTables.map((table) => {
                              const isPrimary = selectedTable === table.name;
                              const isSecondary = selectedSecondaryTables.includes(table.name);
                              const isAI = aiSuggestion?.primaryTable === table.name;
                              return (
                                <div key={table.name} className="flex items-center gap-1">
                                  {/* Primary selection (radio) */}
                                  <button
                                    onClick={() => { setSelectedTable(table.name); setTargetCol(''); setFeatureCols([]); setColSearch(''); }}
                                    className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all text-[11px] border ${isPrimary
                                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                                      : isSecondary
                                        ? 'bg-purple-500/10 border-purple-500/25 text-purple-300'
                                        : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.08]'
                                      }`}
                                  >
                                    <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isPrimary ? 'border-cyan-400' : 'border-gray-600'}`}>
                                      {isPrimary && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                                    </div>
                                    <span className="font-mono font-medium flex-1 truncate">{table.name}</span>
                                    <span className="text-[10px] text-gray-500 flex-shrink-0">{(table.row_count || 0).toLocaleString()}</span>
                                    {isAI && <span className="text-[8px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded-full flex-shrink-0">AI</span>}
                                  </button>
                                  {/* Join checkbox — only shown for non-primary tables when a primary is selected */}
                                  {selectedTable && selectedTable !== table.name && (
                                    <button
                                      onClick={() => toggleSecondaryTable(table.name)}
                                      title={isSecondary ? 'Remove from join' : 'Add as join table'}
                                      className={`p-1 rounded transition-all flex-shrink-0 ${isSecondary ? 'text-purple-400 hover:text-purple-300' : 'text-gray-600 hover:text-gray-400'
                                        }`}
                                    >
                                      {isSecondary ? <CheckSquare size={13} /> : <Square size={13} />}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {filteredTables.length === 0 && (
                              <p className="text-[10px] text-gray-500 text-center py-3 italic">No tables match &quot;{tableSearch}&quot;</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}
                          onClick={() => csvDropRef.current?.click()}
                          className={`group relative h-44 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden ${csvUploadStatus === 'uploading'
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : csvUploadStatus === 'done'
                              ? 'bg-green-500/5 border-green-500/30'
                              : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-amber-500/30'
                            }`}
                        >
                          <input type="file" hidden accept=".csv" ref={csvDropRef} onChange={(e) => { const f = e.target.files[0]; if (f) handleCsvFile(f); }} />
                          {csvUploadStatus === 'uploading' ? (
                            <div className="flex flex-col items-center gap-2">
                              <RefreshCw size={24} className="text-amber-400 animate-spin" />
                              <p className="text-[11px] font-bold text-amber-300 uppercase tracking-widest">Uploading CSV…</p>
                            </div>
                          ) : csvUploadStatus === 'done' ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="p-2 bg-green-500/15 rounded-xl border border-green-500/30">
                                <Check size={20} className="text-green-400" />
                              </div>
                              <p className="text-[11px] font-bold text-green-300 uppercase tracking-widest text-center px-4 truncate w-full">
                                {csvFilename}
                              </p>
                              <p className="text-[9px] text-gray-500">Click to change file</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-amber-500/10 group-hover:scale-110 transition-all">
                                <Upload size={24} className="text-gray-500 group-hover:text-amber-400" />
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-semibold text-gray-300">Drop CSV here or click</p>
                                <p className="text-[10px] text-gray-500 mt-1">Maximum 50MB · Any tabular format</p>
                              </div>
                            </div>
                          )}
                          {csvUploadError && (
                            <div className="absolute bottom-0 inset-x-0 p-2 bg-red-500 text-white text-[9px] font-bold text-center">
                              {csvUploadError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>


                    {/* ── Columns ── */}
                    {columnsFromSelected.length > 0 ? (
                      <div className="flex flex-col min-h-0">
                        {/* Target column (not shown for clustering) */}
                        {selectedFamily !== 'clustering' && (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <Columns size={13} className="text-green-400" />
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Target Column</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3 max-h-28 overflow-y-auto pr-1">
                              {columnsFromSelected.map((col) => {
                                const isTarget = targetCol === col.name;
                                const typeLabel = /int|float|double|decimal|numeric/i.test(col.type || '') ? 'NUM'
                                  : /date|time/i.test(col.type || '') ? 'DATE' : 'CAT';
                                const typeColor = typeLabel === 'NUM' ? 'text-teal-400'
                                  : typeLabel === 'DATE' ? 'text-amber-400' : 'text-pink-400';
                                return (
                                  <button
                                    key={`t-${col._table}.${col.name}`}
                                    onClick={() => setTargetCol(col.name)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition-all ${isTarget
                                      ? 'bg-green-500/15 border-green-500/40 text-green-300'
                                      : 'bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/[0.08]'
                                      }`}
                                  >
                                    {col.name}
                                    <span className={`text-[9px] font-bold ${typeColor}`}>{typeLabel}</span>
                                    {selectedSecondaryTables.length > 0 && col._table !== selectedTable && (
                                      <span className="text-[8px] text-purple-400/60">{col._table}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {/* Feature columns */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Columns size={13} className="text-cyan-400" />
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Feature Columns</span>
                          <span className="text-[10px] text-gray-500">{featureCols.length} / {columnsFromSelected.filter(c => c.name !== targetCol).length}</span>
                          <div className="ml-auto flex gap-1">
                            <button onClick={selectAllFeatures}
                              className="text-[10px] px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-500/20 transition-all">
                              All
                            </button>
                            <button onClick={() => setFeatureCols([])}
                              className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 text-gray-400 rounded hover:bg-white/10 transition-all">
                              None
                            </button>
                          </div>
                        </div>
                        {/* Column search (only shown when there are many columns) */}
                        {columnsFromSelected.length > 8 && (
                          <div className="relative mb-2">
                            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input
                              type="text" value={colSearch} onChange={e => setColSearch(e.target.value)}
                              placeholder="Filter columns…"
                              className="w-full pl-7 pr-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-[11px] text-white placeholder-gray-600 outline-none focus:border-cyan-500/40 transition-colors"
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {filteredCols.filter(c => c.name !== targetCol).map((col) => {
                            const isFeature = featureCols.includes(col.name);
                            const isAIFeature = aiSuggestion?.featureCols?.includes(col.name);
                            const typeLabel = /int|float|double|decimal|numeric/i.test(col.type || '') ? 'NUM'
                              : /date|time/i.test(col.type || '') ? 'DATE' : 'CAT';
                            const typeColor = typeLabel === 'NUM' ? 'text-teal-400'
                              : typeLabel === 'DATE' ? 'text-amber-400' : 'text-pink-400';
                            return (
                              <button
                                key={`f-${col._table}.${col.name}`}
                                onClick={() => toggleFeature(col.name)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition-all ${isFeature
                                  ? 'bg-cyan-500/10 border-cyan-500/35 text-cyan-400'
                                  : 'bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/[0.08]'
                                  }`}
                              >
                                {col.name}
                                <span className={`text-[9px] font-bold ${typeColor}`}>{typeLabel}</span>
                                {isAIFeature && !isFeature && <span className="text-[8px] text-purple-400">★</span>}
                                {selectedSecondaryTables.length > 0 && col._table !== selectedTable && (
                                  <span className="text-[8px] text-purple-400/60">{col._table}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-white/[0.08] rounded-xl">
                        <Database size={28} className="text-gray-600 mb-2" />
                        <p className="text-xs text-gray-500">Select a table to configure columns</p>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Algorithm Families */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-0">
                      <Brain size={13} className="text-purple-400" />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Algorithm</span>
                    </div>
                    {ALGO_FAMILIES.filter(family => validFamilies.has(family.id)).map((family) => {
                      const colors = COLOR_MAP[family.color];
                      const FamilyIcon = family.icon;
                      const isExpanded = expandedFamily === family.id;
                      const isActive = selectedFamily === family.id;
                      return (
                        <div key={family.id} className={`border rounded-xl overflow-hidden transition-all ${isActive ? `${colors.border} ${colors.glow}` : 'border-white/[0.08]'}`}>
                          <button
                            onClick={() => { setExpandedFamily(isExpanded ? null : family.id); setSelectedFamily(family.id); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${isActive ? colors.bg : 'hover:bg-white/[0.03]'}`}
                          >
                            <FamilyIcon size={15} className={isActive ? colors.text : 'text-gray-500'} />
                            <div className="flex-1 text-left">
                              <div className={`text-sm font-semibold ${isActive ? colors.text : 'text-gray-300'}`}>{family.label}</div>
                              <div className="text-[10px] text-gray-500">{family.description}</div>
                            </div>
                            {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 space-y-1.5">
                                  {family.algos.map((algo) => {
                                    const isSelectedAlgo = selectedAlgo === algo.id && selectedFamily === family.id;
                                    return (
                                      <button
                                        key={algo.id}
                                        onClick={() => { setSelectedAlgo(algo.id); setSelectedFamily(family.id); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border ${isSelectedAlgo
                                          ? `${colors.bg} ${colors.border} ${colors.text}`
                                          : 'bg-white/[0.03] border-transparent hover:bg-white/[0.06] text-gray-400'
                                          }`}
                                      >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelectedAlgo ? 'border-current' : 'border-gray-600'}`}>
                                          {isSelectedAlgo && <div className="w-2 h-2 rounded-full bg-current" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className={`text-xs font-semibold ${isSelectedAlgo ? 'text-current' : 'text-gray-300'}`}>{algo.name}</div>
                                          <div className="text-[10px] text-gray-500 truncate">{algo.best_for}</div>
                                        </div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0 ${TAG_COLORS[algo.tagColor]}`}>
                                          {algo.tag}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-[#0a1212] flex items-center gap-3 shrink-0">
            <div className="text-xs text-gray-500 flex items-center gap-1.5 min-w-0 overflow-hidden">
              {(dataSourceMode === 'database' ? selectedTable : csvUploadId) ? (
                <>
                  <span className={`${dataSourceMode === 'database' ? 'text-cyan-400' : 'text-amber-400'} font-mono truncate`}>
                    {dataSourceMode === 'database' ? selectedTable : csvFilename}
                  </span>
                  <span className="shrink-0">·</span>
                  <span className="text-amber-400 shrink-0">{ALGO_FAMILIES.flatMap(f => f.algos).find(a => a.id === selectedAlgo)?.name}</span>
                  {targetCol && <><span className="shrink-0">·</span><span className="text-green-400 shrink-0">→ {targetCol}</span></>}
                  {featureCols.length > 0 && <><span className="shrink-0">·</span><span className="text-purple-400 shrink-0">{featureCols.length} features</span></>}
                </>
              ) : (
                <span className="flex items-center gap-1 shrink-0">
                  <AlertTriangle size={11} className="text-amber-500" /> {dataSourceMode === 'database' ? 'Select a table to continue' : 'Upload a CSV to continue'}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {mlResults ? (
                <button
                  onClick={() => setMlResults(null)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all"
                >
                  <ArrowLeft size={13} /> Reconfigure
                </button>
              ) : isGenerating ? (
                <button
                  onClick={handleCancelRun}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-all"
                >
                  <StopCircle size={13} /> Cancel
                </button>
              ) : (
                <>
                  <button onClick={onClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all">
                    Close
                  </button>
                  <button
                    onClick={handleOpenDeepAnalysis}
                    disabled={dataSourceMode === 'database' ? !selectedTable : !csvUploadId}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ExternalLink size={13} /> Open Deep Analysis
                  </button>
                </>
              )}
              <button
                onClick={handleRunInline}
                disabled={(dataSourceMode === 'database' ? !selectedTable : !csvUploadId) || isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-semibold hover:from-amber-500/30 hover:to-orange-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(251,191,36,0.1)]"
              >

                {isGenerating
                  ? <><RefreshCw size={13} className="animate-spin" /> Running…</>
                  : mlResults
                    ? <><RefreshCw size={13} /> Re-run</>
                    : <><Zap size={13} /> Run Model</>
                }
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}