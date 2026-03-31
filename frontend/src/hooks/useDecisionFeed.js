/**
 * useDecisionFeed — polls /api/decisions for real-time decision updates.
 *
 * Upgradeable to WebSocket in Phase 5 without changing the consuming component.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../utils/apiClient';

const POLL_INTERVAL_MS = 15_000;

export function useDecisionFeed({ tenantId = 'default', autoStart = true } = {}) {
  const [decisions, setDecisions] = useState([]);
  const [stats,     setStats]     = useState({ total: 0, pending: 0, critical: 0, high: 0 });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const intervalRef = useRef(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/api/decisions?tenant_id=${tenantId}&limit=50`);
      setDecisions(data.decisions || []);
      setStats(data.stats || { total: 0, pending: 0, critical: 0, high: 0 });
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load decisions');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const updateStatus = useCallback(async (decisionId, status, resolvedBy) => {
    await apiClient.patch(`/api/decisions/${decisionId}/status`, { status, resolved_by: resolvedBy });
    await fetch();
  }, [fetch]);

  const createDecision = useCallback(async (payload) => {
    const result = await apiClient.post('/api/decisions', payload);
    await fetch();
    return result;
  }, [fetch]);

  const dispatch = useCallback(async (decisionId, channels) => {
    return apiClient.post(`/api/decisions/${decisionId}/dispatch`, { channels });
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    fetch();
    intervalRef.current = setInterval(fetch, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetch, autoStart]);

  return {
    decisions, stats, loading, error,
    refresh: fetch,
    updateStatus, createDecision, dispatch,
  };
}
