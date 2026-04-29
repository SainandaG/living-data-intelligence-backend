/**
 * useDecisionFeed — real-time decision updates via SSE from GET /api/decisions/stream.
 *
 * Receives a snapshot on connect, then individual `decision_created` /
 * `decision_updated` events pushed by the backend immediately on mutation.
 * Falls back to a reconnect loop with exponential back-off on error.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../utils/apiClient';

const RECONNECT_BASE_MS  = 2_000;
const RECONNECT_MAX_MS   = 30_000;
const RECONNECT_EXPONENT = 2;

function buildStats(decisions) {
  return {
    total:    decisions.length,
    pending:  decisions.filter(d => d.status   === 'pending').length,
    critical: decisions.filter(d => d.severity === 'critical').length,
    high:     decisions.filter(d => d.severity === 'high').length,
  };
}

export function useDecisionFeed({ tenantId = 'default', autoStart = true } = {}) {
  const [decisions, setDecisions] = useState([]);
  const [stats,     setStats]     = useState({ total: 0, pending: 0, critical: 0, high: 0 });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const abortRef     = useRef(null);
  const reconnectRef = useRef(null);
  // Mutable values that don't drive renders — kept on a single ref to match hook count
  const retryRef     = useRef({ count: 0 });

  // ── REST mutations (each triggers a backend broadcast so SSE stays accurate) ──

  const updateStatus = useCallback(async (decisionId, status, resolvedBy) => {
    await apiClient.patch(`/decisions/${decisionId}/status`, { status, resolved_by: resolvedBy });
  }, []);

  const createDecision = useCallback(async (payload) => {
    return apiClient.post('/decisions', payload);
  }, []);

  const dispatch = useCallback(async (decisionId, channels) => {
    return apiClient.post(`/decisions/${decisionId}/dispatch`, { channels });
  }, []);

  // ── SSE connection ────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const baseUrl = apiClient.defaults?.baseURL || '';
        const token   = localStorage.getItem('token') || sessionStorage.getItem('token');
        const headers = { Accept: 'text/event-stream' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const resp = await authFetch(
          `${baseUrl}/decisions/stream?tenant_id=${encodeURIComponent(tenantId)}`,
          { headers, signal: controller.signal },
        );

        if (!resp.ok) throw new Error(`SSE connect failed: ${resp.status} ${resp.statusText}`);

        setLoading(false);
        retryRef.current.count = 0;   // successful connection — reset back-off

        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            let evt;
            try { evt = JSON.parse(jsonStr); } catch { continue; }

            if (evt.type === 'snapshot') {
              setDecisions(evt.decisions || []);
              setStats(evt.stats || buildStats(evt.decisions || []));
            } else if (evt.type === 'decision_created') {
              setDecisions(prev => {
                const next = [evt.decision, ...prev.filter(d => d.id !== evt.decision.id)];
                setStats(buildStats(next));
                return next;
              });
            } else if (evt.type === 'decision_updated') {
              setDecisions(prev => {
                const next = prev.map(d => d.id === evt.decision.id ? evt.decision : d);
                setStats(buildStats(next));
                return next;
              });
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;   // intentional disconnect
        setError(err.message || 'Decision stream disconnected');
        setLoading(false);

        // Exponential back-off reconnect
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(RECONNECT_EXPONENT, retryRef.current.count),
          RECONNECT_MAX_MS,
        );
        retryRef.current.count += 1;
        reconnectRef.current = setTimeout(connect, delay);
      }
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!autoStart) return;
    connect();
    return () => {
      abortRef.current?.abort();
      clearTimeout(reconnectRef.current);
    };
  }, [connect, autoStart]);

  return {
    decisions, stats, loading, error,
    refresh: connect,
    updateStatus, createDecision, dispatch,
  };
}
