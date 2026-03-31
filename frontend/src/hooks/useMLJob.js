/**
 * useMLJob — runs an ML or AutoML job and tracks progress.
 *
 * For synchronous jobs (inline), calls the endpoint and returns results.
 * For long-running jobs, polls a job-status endpoint.
 */
import { useState, useCallback } from 'react';
import apiClient from '../utils/apiClient';

export function useMLJob() {
  const [result,   setResult]   = useState(null);
  const [status,   setStatus]   = useState('idle');    // idle | running | done | error
  const [progress, setProgress] = useState(0);
  const [error,    setError]    = useState(null);

  const runAnalysis = useCallback(async (params) => {
    setStatus('running');
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      setProgress(30);
      const data = await apiClient.post('/api/ml/analyze', params);
      setProgress(100);
      setResult(data);
      setStatus('done');
      return data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'ML analysis failed');
      setStatus('error');
      throw err;
    }
  }, []);

  const runAutoML = useCallback(async (params) => {
    setStatus('running');
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      setProgress(20);
      const data = await apiClient.post('/api/ml/automl', params);
      setProgress(100);
      setResult(data);
      setStatus('done');
      return data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'AutoML failed');
      setStatus('error');
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  return { runAnalysis, runAutoML, reset, result, status, progress, error };
}
