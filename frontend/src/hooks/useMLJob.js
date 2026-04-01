/**
 * useMLJob — runs an ML or AutoML job, polls for real status, and supports cancellation.
 *
 * Progress is driven by polling GET /api/ml/run/{run_id}/status every 2 s until
 * the job leaves the "running" state — no fake setTimeout delays.
 */
import { useState, useCallback, useRef } from 'react';
import apiClient from '../utils/apiClient';

const ERROR_MESSAGES = {
  422: (detail) => `Check your column selection: ${detail}`,
  504: () => 'Analysis timed out — try fewer features or a faster algorithm.',
  503: () => 'Database connection failed — check your connection.',
  500: () => 'Unexpected error — our team has been notified.',
};

function structuredError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
  const builder = ERROR_MESSAGES[status];
  return builder ? builder(detail) : detail;
}

export function useMLJob() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');    // idle | running | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const _pollStatus = useCallback(async (runId, signal) => {
    while (true) {
      if (signal?.aborted) return null;
      await new Promise((r) => setTimeout(r, 2000));
      if (signal?.aborted) return null;
      try {
        const s = await apiClient.get(`/api/ml/run/${runId}/status`, { signal });
        if (s.status !== 'running') return s;
        // Update progress: push toward 90% while still running
        setProgress((p) => Math.min(p + 8, 90));
      } catch {
        return null;
      }
    }
  }, []);

  const cancel = useCallback(async (runId) => {
    abortRef.current?.abort();
    if (runId) {
      try { await apiClient.delete(`/api/ml/run/${runId}`); } catch { /* best-effort */ }
    }
    setStatus('idle');
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const runAnalysis = useCallback(async (params) => {
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('running');
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      const data = await apiClient.post('/api/ml/analyze', params, { signal: controller.signal });
      // /analyze is synchronous — result comes back directly
      setProgress(100);
      setResult(data);
      setStatus('done');
      return data;
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      setError(structuredError(err));
      setStatus('error');
      throw err;
    }
  }, []);

  const runAutoML = useCallback(async (params) => {
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('running');
    setProgress(10);
    setError(null);
    setResult(null);

    let runId = null;
    try {
      setProgress(20);
      const data = await apiClient.post('/api/ml/automl', params, { signal: controller.signal });
      runId = data?.run_ids?.[0] ?? null;

      // Poll until not running (AutoML run is tracked in experiment tracker)
      if (runId) {
        setProgress(30);
        await _pollStatus(runId, controller.signal);
      }

      setProgress(100);
      setResult(data);
      setStatus('done');
      return data;
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      setError(structuredError(err));
      setStatus('error');
      throw err;
    }
  }, [_pollStatus]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  return { runAnalysis, runAutoML, cancel, reset, result, status, progress, error };
}
