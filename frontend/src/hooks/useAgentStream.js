/**
 * useAgentStream — streams APEX agent SSE events from POST /api/apex/agent/run.
 *
 * Uses fetch + ReadableStream (not EventSource) because EventSource
 * doesn't support POST bodies.
 *
 * Usage:
 *   const { run, events, planSteps, report, status, error } = useAgentStream();
 *   await run({ query: "Find churn drivers", connection_id: "conn_1" });
 */
import { useState, useCallback, useRef } from 'react';
import apiClient, { authFetch } from '../utils/apiClient';

export function useAgentStream() {
  const [events,    setEvents]    = useState([]);
  const [planSteps, setPlanSteps] = useState([]);
  const [report,    setReport]    = useState(null);
  const [status,    setStatus]    = useState('idle');   // idle | planning | running | done | error
  const [error,     setError]     = useState(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setEvents([]);
    setPlanSteps([]);
    setReport(null);
    setStatus('idle');
    setError(null);
  }, []);

  const run = useCallback(async ({ query, connection_id, context, tenant_id, user_id }) => {
    // Cancel any in-flight run
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    reset();
    setStatus('planning');

    try {
      // Use fetch directly for SSE over POST
      const baseUrl = apiClient.defaults?.baseURL || '';
      const token   = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await authFetch(`${baseUrl}/apex/agent/run`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ query, connection_id, context, tenant_id, user_id }),
        signal:  controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`Agent API error: ${resp.status} ${resp.statusText}`);
      }

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';   // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          let evt;
          try { evt = JSON.parse(jsonStr); }
          catch { continue; }

          // Route event to state
          handleEvent(evt, setEvents, setPlanSteps, setReport, setStatus);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Agent stream failed');
        setStatus('error');
      }
    }
  }, [reset]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  return { run, cancel, reset, events, planSteps, report, status, error };
}


// ── Event router ──────────────────────────────────────────────────────────────

function handleEvent(evt, setEvents, setPlanSteps, setReport, setStatus) {
  const { type } = evt;

  setEvents(prev => [...prev.slice(-200), evt]);   // ring buffer — keep last 200

  switch (type) {
    case 'planning':
      setStatus('planning');
      break;

    case 'plan_start':
      setStatus('running');
      if (evt.steps) {
        setPlanSteps(evt.steps.map(s => ({ ...s, status: 'pending' })));
      }
      break;

    case 'step_start':
      setPlanSteps(prev => prev.map(s =>
        s.index === evt.step_index ? { ...s, status: 'running', text: evt.text } : s
      ));
      break;

    case 'step_done':
      setPlanSteps(prev => prev.map(s =>
        s.index === evt.step_index
          ? { ...s, status: 'done', elapsed_ms: evt.elapsed_ms }
          : s
      ));
      break;

    case 'step_error':
      setPlanSteps(prev => prev.map(s =>
        s.index === evt.step_index ? { ...s, status: 'error', error: evt.text } : s
      ));
      break;

    case 'plan_done':
      setStatus('done');
      if (evt.report) setReport(evt.report);
      break;

    case 'error':
      setStatus('error');
      break;

    case 'stream_end':
      // Stream closed gracefully
      break;

    default:
      break;
  }
}
