/**
 * useDashboard.js
 * Extracts all business logic from App.jsx into a single hook.
 * App.jsx becomes a thin shell (~150 lines) that just renders JSX.
 *
 * Contains: all useEffect, useCallback, fetch functions, command handlers,
 * WebSocket message processing, navigation helpers, and derived values.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useWindowManager } from '../context/WindowManagerContext';
import { useCommandRegistry, useRegisterCommand } from '../context/CommandRegistryContext';
import { useWebSocket } from './useWebSocket';
import { useMultiplayer } from './useMultiplayer';
import { useAsyncError } from './useAsyncError';
import {
  useAuthStore, useConnectionStore, useGraphStore,
  useViewStore, useRealtimeStore, useEvolutionStore, useIntelligenceStore,
} from '../stores';
import apiClient, { registerAsyncErrorHandler } from '../utils/apiClient';
import { decodeViewState, encodeViewState } from '../utils/stateEncoder';
import { getLensCategories } from '../components/Dashboard/LatentSpaceLogic.jsx';
import soundSystem from '../utils/SoundSystem';
import { logger } from '../utils/logger';
import { MODAL_DELAY, STATUS_CLEAR_DELAY, DRILLDOWN_CAMERA_DELAY, SHARE_TOAST_DURATION } from '../config/timing';
const UserManagementPanel = React.lazy(() => import('../components/Admin/UserManagementPanel'));

export const useDashboard = (graphRef) => {
  const throwAsyncError = useAsyncError();

  // ── Stores ───────────────────────────────────────────────────────────────────
  const { isAuthenticated, isCheckingAuth, login, logout, initialize, canDo } = useAuthStore();
  const { loading, showConnectModal, connectionId, setLoading, setShowConnectModal, setConnectionId } = useConnectionStore();
  const {
    graphData, selectedNode, hoveredNode, hoveredEdge, hoveredEdgePos,
    multiSelectedNodes, showMultiConnections, enrichedNodes,
    pinnedNodes, pinnedNodeId, pinnedCols, pinnedEdge, threeGraphKey,
    setGraphData, updateGraphData, setSelectedNode, setHoveredNode,
    setHoveredEdge, setHoveredEdgePos, setMultiSelectedNodes, setShowMultiConnections,
    setPinnedNodes, setPinnedNodeId, setPinnedCols, setPinnedEdge,
    incrementThreeGraphKey, toggleMultiSelectNode,
  } = useGraphStore();
  const {
    viewMode, activeLens, activeLayoutMode, breadcrumbs, isChatOpen,
    drillDownTable, isSidebarPanelActive, isHudMinimized, insightPerspective,
    activeFilters, isWarRoomActive, warRoomTargetNode,
    showPKs, showFKs, singleNodeViewEnabled, isInspectorActive,
    setViewMode, setActiveLens, setActiveLayoutMode, setBreadcrumbs,
    setIsChatOpen, setDrillDownTable, setIsSidebarPanelActive,
    setIsHudMinimized, setInsightPerspective, toggleInsightPerspective,
    setActiveFilters, setFilterValue, activateWarRoom, deactivateWarRoom,
    setShowPKs, setShowFKs, setSingleNodeViewEnabled, setIsInspectorActive,
  } = useViewStore();
  const { liveStats, liveTableCounts, simUpdate, setLiveStats, setLiveTableCounts, showSimToast } = useRealtimeStore();
  const {
    evolutionMode, currentSnapshot, timeMachineOpen, snapshotData, timeValue,
    setEvolutionMode, setCurrentSnapshot, openTimeMachine, closeTimeMachine,
    setSnapshotData, setTimeValue,
  } = useEvolutionStore();
  const {
    aiStatus, mlInsights, gravitySuggestions, showRecordGravity, rlActive,
    clusteringMethod, columnAliases,
    setAiStatus, setMlInsights, setGravitySuggestions, setShowRecordGravity,
    setRlActive, toggleClusteringMethod, setColumnAliases,
  } = useIntelligenceStore();
  const [activeConnections, setActiveConnections] = React.useState([]);

  // ── Router ───────────────────────────────────────────────────────────────────
  const { windows, openWindow } = useWindowManager();
  const { executeCommand } = useCommandRegistry();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialViewState = React.useMemo(() => decodeViewState(searchParams.get('view')), [searchParams]);
  const initialCameraState = useRef(initialViewState?.cameraState || null);
  const hasResetOverviewRef = useRef(false);
  const firstLoadRef = useRef(true);

  // Apply deep-link initial state once
  useEffect(() => {
    if (initialViewState?.selectedNodeId) setSelectedNode(initialViewState.selectedNodeId);
    if (initialViewState?.multiSelectedNodes) setMultiSelectedNodes(initialViewState.multiSelectedNodes);
    if (initialViewState?.currentLens) setActiveLens(initialViewState.currentLens);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    registerAsyncErrorHandler((err) => {
      if (['FORBIDDEN'].includes(err?.code)) {
        logger.warn('[App] Permission denied for background fetch:', err?.message);
        // Do not throw for forbidden, just degrade gracefully
      } else if (['UNAUTHORIZED'].includes(err?.code)) {
        logger.error('[App] Critical Auth Error:', err);
        throwAsyncError(err);
      } else {
        logger.warn('[App] Recoverable API error:', err?.code, err?.message);
      }
    });
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interceptor = apiClient.interceptors.response.use(
      (r) => r,
      (error) => {
        if (error.response?.status === 401) { logger.warn('[App] Session expired.'); logout(); }
        return Promise.reject(error);
      }
    );
    return () => apiClient.interceptors.response.eject(interceptor);
  }, [logout]);

  // ── Sidebar sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => setIsSidebarPanelActive(!!e.detail?.active);
    window.addEventListener('sidebar-panel-active', handler);
    return () => window.removeEventListener('sidebar-panel-active', handler);
  }, [setIsSidebarPanelActive]);

  // ── URL navigation ────────────────────────────────────────────────────────────
  useEffect(() => {
    const rawPath = location.pathname.substring(1).split('/')[0].replace(/\/$/, '');
    const validModes = ['overview', 'drilldown', 'dataflow', 'analytics', 'vitals', 'schema', 'intelligence', 'lineage', 'globalLatent', 'latent'];
    const targetMode = validModes.includes(rawPath) ? rawPath : 'overview';
    if (viewMode !== targetMode) setViewMode(targetMode);

    // Auto-switch lens if entering Latent Space with a Galaxy-only lens
    if ((targetMode === 'globalLatent' || targetMode === 'latent') && !['activity_week', 'activity_day'].includes(activeLens)) {
      setActiveLens('activity_week');
      graphRef.current?.setLens?.('activity_week');
    }

    // Auto-switch lens if entering Overview with a Latent-only lens
    if (targetMode === 'overview' && ['activity_week', 'activity_day'].includes(activeLens)) {
      setActiveLens('ops');
      graphRef.current?.setLens?.('ops');
    }

    if (!location.pathname.startsWith(`/${targetMode}`)) {
      if (location.pathname === '/' && targetMode === 'overview') return;
      navigate(`/${targetMode}`, { replace: true });
    }
  }, [location.pathname, viewMode, navigate, setViewMode, activeLens, setActiveLens]);

  // ── Graph mode sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!graphRef.current) return;
    if (viewMode === 'globalLatent' || viewMode === 'latent') graphRef.current.setLatentMode?.('latent');
    else if (viewMode === 'overview') graphRef.current.setLatentMode?.('galaxy');
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'overview' && graphRef.current && !hasResetOverviewRef.current) {
      graphRef.current.resetView?.(); hasResetOverviewRef.current = true;
    } else if (viewMode !== 'overview') { hasResetOverviewRef.current = false; }
  }, [viewMode]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  const wsUrl = connectionId
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/${connectionId}`
    : null;
  const { status: wsStatus, lastMessage, send: sendMessage, dbReconnecting } = useWebSocket(wsUrl);
  const wsConnected = wsStatus === 'connected';

  // ── Multiplayer ───────────────────────────────────────────────────────────────
  const { persona, activePeers, handlePresenceMessage } = useMultiplayer(sendMessage, wsConnected, {
    getCurrentCameraState: () => graphRef.current?.getCurrentCameraState?.() ?? null,
    selectedNodeId: selectedNode,
    currentLens: activeLens,
  });

  // ── WS message handler ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'presence_update') { handlePresenceMessage(lastMessage); return; }
    if (lastMessage.type !== 'metrics_update') return;

    const metrics = lastMessage.data || {};
    const aiStats = lastMessage.ai_stats || {};

    if (lastMessage.table_counts && Object.keys(lastMessage.table_counts).length > 0)
      setLiveTableCounts(lastMessage.table_counts);

    setLiveStats((prev) => ({
      ...prev,
      totalTransactions: metrics.total_transactions || prev.totalTransactions || 0,
      tps: metrics.transaction_rate || prev.tps || 0,
      activeNodes: aiStats.total_nodes || prev.activeNodes,
      health: lastMessage.health || prev.health,
      anomalies: (lastMessage.anomalies || prev.anomalies || []).map((a) => ({
        ...a, explanation: a.justification || a.explanation || a.description || a.message,
      })),
      activeBatteries: metrics.active_batteries ?? prev.activeBatteries,
      onlineStations: metrics.online_stations ?? prev.onlineStations,
      networkHealth: metrics.network_health ?? prev.networkHealth,
      energyAlerts: metrics.energy_alerts ?? prev.energyAlerts,
      avgBatteryTemp: metrics.avg_battery_temp || prev.avgBatteryTemp || 0,
      avgBatteryVolt: metrics.avg_battery_volt || prev.avgBatteryVolt || 0,
      avgBatteryCurr: metrics.avg_battery_curr || prev.avgBatteryCurr || 0,
      cacheHitRate: metrics.cache_hit_rate || prev.cacheHitRate || 99,
    }));

    if (aiStats.status) setAiStatus(`Neural Core: ${aiStats.status} | Scanned: ${aiStats.scanned_nodes || 0}/${aiStats.total_nodes || 0}`);
    setMlInsights((prev) => ({
      ...prev, anomalyScore: (100 - (lastMessage.health?.score || 100)).toFixed(0),
      gravity: aiStats.avg_gravity ? `${aiStats.avg_gravity.toFixed(2)}x` : '1.0x', optimization: 'Active',
    }));

    if (metrics.avg_battery_temp) {
      const temp = parseFloat(metrics.avg_battery_temp).toFixed(1);
      const volt = metrics.avg_battery_volt ? parseFloat(metrics.avg_battery_volt).toFixed(1) : '—';
      const curr = metrics.avg_battery_curr ? parseFloat(metrics.avg_battery_curr).toFixed(1) : '—';
      // REMOVED: showSimToast(`🔋 Battery Update: ${temp}°C | ${volt}V | ${curr}A${dbReconnecting ? ' | 🔄 DB Resyncing' : ''}`, 4000);
      updateGraphData((prev) => ({
        ...prev, nodes: prev.nodes.map((n) =>
          n.name === 'batteries' ? { ...n, avg_temperature: metrics.avg_battery_temp, avg_voltage: metrics.avg_battery_volt, avg_current: metrics.avg_battery_curr } : n
        ),
      }));
    }

    if (lastMessage.evolved_nodes) {
      updateGraphData((prev) => ({
        ...prev, nodes: prev.nodes.map((node) => {
          const e = lastMessage.evolved_nodes.find((ev) => ev.id === node.id);
          if (!e) return node;
          const merged = { ...node, size: e.size || node.size, status: e.status || node.status, vitality: e.vitality || node.vitality };
          // Carry last_interaction forward so activity_day / activity_week lenses
          // can correctly classify this node as Active vs Inactive.
          if (e.last_interaction) merged.last_interaction = e.last_interaction;
          return merged;
        }),
      }));
    }
  }, [lastMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ────────────────────────────────────────────────────────────────
  const handleNavigate = useCallback((view) => {
    navigate(`/${view}`);
    if (view === 'overview') { setBreadcrumbs([]); setDrillDownTable(null); }

    // Ensure Latent Space uses an activity lens
    if ((view === 'globalLatent' || view === 'latent') && !['activity_week', 'activity_day'].includes(activeLens)) {
      setActiveLens('activity_week');
      graphRef.current?.setLens?.('activity_week');
    }

    // Ensure Overview uses a category lens
    if (view === 'overview' && ['activity_week', 'activity_day'].includes(activeLens)) {
      setActiveLens('ops');
      graphRef.current?.setLens?.('ops');
    }
  }, [navigate, setBreadcrumbs, setDrillDownTable, activeLens, setActiveLens]);

  const handleNodeDrillDown = useCallback((nodeId, shouldSimulate = false) => {
    if (viewMode === 'overview' && graphRef.current) {
      graphRef.current.highlightNode?.(nodeId);
      setAiStatus(`Neural Core: Drilling into ${nodeId}...`);
      setTimeout(() => { handleNavigate('drilldown'); setDrillDownTable(nodeId); setAiStatus(null); }, DRILLDOWN_CAMERA_DELAY);
    } else { handleNavigate('drilldown'); setDrillDownTable(nodeId); }
    setBreadcrumbs([{ label: 'Overview', onClick: () => handleNavigate('overview') }, { label: `Table: ${nodeId}` }]);
  }, [handleNavigate, viewMode, setAiStatus, setDrillDownTable, setBreadcrumbs]);

  const handleBackToOverview = useCallback(() => {
    navigate('/overview'); setDrillDownTable(null); setSelectedNode(null); setHoveredNode(null); setBreadcrumbs([]);
  }, [navigate, setDrillDownTable, setSelectedNode, setHoveredNode, setBreadcrumbs]);

  const handleToggleLatent = useCallback(() => {
    if (viewMode === 'drilldown' || viewMode === 'latent') {
      const next = viewMode === 'latent' ? 'drilldown' : 'latent';
      if (next === 'latent') { setSelectedNode(null); setHoveredNode(null); }
      navigate(`/${next}`);
    } else {
      if (viewMode === 'overview') { setSelectedNode(null); setHoveredNode(null); }
      navigate(`/${viewMode === 'globalLatent' ? 'overview' : 'globalLatent'}`);
    }
  }, [viewMode, navigate, setSelectedNode, setHoveredNode]);

  const handleToggleLens = useCallback((lens) => {
    setActiveLens(lens); graphRef.current?.setLens?.(lens);
  }, [setActiveLens]);

  const handleToggleLayoutMode = useCallback((mode) => {
    setActiveLayoutMode(mode); graphRef.current?.setLatentMode?.(mode);
  }, [setActiveLayoutMode]);

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchGravitySuggestions = useCallback(async (connId) => {
    if (!canDo('analyst')) return;
    try {
      const data = await apiClient.get(`/ai/gravity-suggestions/${connId}`);
      setGravitySuggestions(data.suggestions || []);
    } catch (e) { logger.error('Failed to fetch gravity suggestions:', e); }
  }, [setGravitySuggestions, canDo]);

  const fetchRealGraphData = useCallback(async (id) => {
    if (firstLoadRef.current) { setLoading(true); firstLoadRef.current = false; }
    fetchGravitySuggestions(id);
    try {
      const rawData = await apiClient.get(`/graph/${id}`);
      if (rawData.neural_core) {
        const core = rawData.neural_core;
        setAiStatus(`Neural Core: ${core.ai_stats?.status || 'ACTIVE'} | Scanned: ${core.ai_stats?.scanned_nodes || 0}/${core.ai_stats?.total_nodes || 0}`);
        setLiveStats((prev) => ({ ...prev, tps: core.metrics?.transaction_rate || 0, fraudAlerts: core.metrics?.fraud_alerts || 0, failedTx: core.metrics?.failed_transactions || 0, avgAmount: core.metrics?.average_amount || 0, activeNodes: core.ai_stats?.total_nodes || rawData.nodes.length, health: core.health || prev.health }));
        const clusterMap = {};
        rawData.nodes.forEach((n) => { if (n.cluster && n.name !== 'Neural Core') { if (!clusterMap[n.cluster]) clusterMap[n.cluster] = []; clusterMap[n.cluster].push(n.name); } });
        setMlInsights({ anomalyScore: (100 - (core.health?.score || 100)).toFixed(0), gravity: core.ai_stats?.avg_gravity ? `${core.ai_stats.avg_gravity.toFixed(2)}x` : '1.0x', optimization: 'Active', clusters: Object.keys(clusterMap).map((c) => ({ name: c, tables: clusterMap[c], count: clusterMap[c].length })).filter(Boolean) });
      } else { setAiStatus('Neural Core: Global Analysis Complete'); }

      const nodesTransformed = (rawData.nodes || []).map((node, i) => {
        const importance = node.importance_score || 1.0;
        const rowBonus = node.record_count ? Math.log10(node.record_count + 1) * 5 : 0;
        return { id: node.id, name: node.name, color: node.color || (node.group === 1 ? 0xfbbf24 : 0x22d3ee), size: 20 + (importance * 15) + rowBonus, pos: [node.x || Math.cos(i * 0.5) * (150 + i * 10), node.y || (Math.random() - 0.5) * 200, node.z || Math.sin(i * 0.5) * (150 + i * 10)], entity: node.entity || 'TABLE', rows: node.row_count ? node.row_count.toLocaleString() + ' Records' : 'Empty', row_count: node.row_count || 0, metrics: node.metrics || node.foreign_keys || [], columns: node.columns || [], vitality: node.vitality === undefined ? 100 : node.vitality, pulse_rate: node.pulse_rate || 0.1, glow_intensity: node.node_glow || 0.1, node_glow: node.node_glow || 0.2, importance_score: node.importance_score || 1.0, cluster: node.cluster, foreign_keys: node.foreign_keys || [], customMetrics: node.customMetrics || {}, has_upstream_deps: node.has_upstream_deps, upstream_node_ids: node.upstream_node_ids, downstream_node_ids: node.downstream_node_ids, is_anomalous: node.is_anomalous, latent_category: node.latent_category, latent_color: node.latent_color, isFactTable: node.is_fact_table, isDimensionTable: node.is_dimension_table, isSource: node.is_source, dependencyDepth: node.dependency_depth, independencyScore: node.independency_score, anomalySeverity: node.anomaly_severity, healthScore: node.health_score, affectedDownstreamCount: node.affected_downstream_count, upstreamNodeIds: node.upstream_node_ids, downstreamNodeIds: node.downstream_node_ids };
      });
      const edgesTransformed = (rawData.edges || []).map((e) => ({ ...e, type: e.type || e.relationship_category, trafficIntensity: e.traffic_intensity || 0.3, edge_glow: e.edge_glow || 1.0 }));
      setGraphData({ nodes: nodesTransformed, edges: edgesTransformed, latent_manifold: rawData.latent_manifold || null, intelligence_stream: rawData.intelligence_stream, connectionId: id });
      setLiveStats((prev) => ({ ...prev, activeNodes: nodesTransformed.length }));
      setTimeout(() => setAiStatus(null), STATUS_CLEAR_DELAY);
    } catch (e) { logger.error('Error fetching graph data:', e); setAiStatus(`Backend Unavailable: ${e.message}`); }
    finally { setLoading(false); }
  }, [fetchGravitySuggestions, setLoading, setAiStatus, setLiveStats, setMlInsights, setGraphData]);

  // ── Initial load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.get('/agent/config')
      .then((config) => {
        window.SYSTEM_FEATURES = config.features;
        if (!connectionId && config.active_connection_id) { setConnectionId(config.active_connection_id); fetchRealGraphData(config.active_connection_id); }
        else if (!connectionId) setTimeout(() => setShowConnectModal(true), MODAL_DELAY);
      })
      .catch((err) => { logger.error('Could not fetch system config:', err); if (!connectionId) setTimeout(() => setShowConnectModal(true), MODAL_DELAY); });
  }, [connectionId, fetchRealGraphData, setConnectionId, setShowConnectModal, isAuthenticated]);

  // --- DATA SYNC: Fetch graph when connection changes from ANY source (Modal, Sidebar, Agent) ---
  useEffect(() => {
    if (!isAuthenticated) return;
    // If we have a connectionId but no graph data (or data from another connection), fetch it.
    // This handles the case where ConnectionModal sets the connectionId but doesn't trigger a fetch.
    if (connectionId && (!graphData || graphData.nodes.length === 0 || graphData.connectionId !== connectionId)) {
      logger.log(`[useDashboard] Connection changed to ${connectionId}, fetching graph data...`);
      fetchRealGraphData(connectionId);
    }
  }, [connectionId, graphData, fetchRealGraphData, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!showConnectModal && !connectionId) {
      apiClient.get('/connections')
        .then((conns) => {
          if (conns?.length > 0) {
            logger.log(`[useDashboard] Auto-selecting connection: ${conns[0].id}`);
            setConnectionId(conns[0].id);
          }
        })
        .catch((err) => logger.error('[useDashboard] Auto-discovery failed:', err));
    }
  }, [showConnectModal, connectionId, setConnectionId, isAuthenticated]);

  const fetchActiveConnections = useCallback(async () => {
    try {
      const data = await apiClient.get('/connections');
      setActiveConnections(data || []);
    } catch (e) { logger.error('Failed to fetch connections:', e); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchActiveConnections();
    const interval = setInterval(fetchActiveConnections, 10000);
    return () => clearInterval(interval);
  }, [fetchActiveConnections, isAuthenticated]);

  // ── Node interaction ──────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node, shiftKey = false) => {
    if (shiftKey) { toggleMultiSelectNode(node); return; }
    setMultiSelectedNodes([]); setSelectedNode(node);
    if (activeLayoutMode === 'latent' && node.latent_category === 'Dimension') {
      const impactedIds = new Set();
      const queue = [...(node.downstreamNodeIds || [])];
      while (queue.length > 0) { const id = queue.shift(); if (!impactedIds.has(id)) { impactedIds.add(id); const n = graphData.nodes.find((n) => n.id === id); if (n?.downstreamNodeIds) queue.push(...n.downstreamNodeIds); } }
      updateGraphData((prev) => ({ ...prev, nodes: prev.nodes.map((n) => ({ ...n, propagationState: impactedIds.has(n.id) ? 'impacted' : null })) }));
      setAiStatus(`Propagation: ${impactedIds.size} tables impacted by ${node.id}`, 5000);
    } else { updateGraphData((prev) => ({ ...prev, nodes: prev.nodes.map((n) => ({ ...n, propagationState: null })) })); }
    if (node.id !== 'hub') handleNodeDrillDown(node.id);
    setMlInsights((prev) => ({ ...prev, anomalyScore: node.vitality ? (100 - node.vitality) : 0, gravity: (node.importance_score || 0) > 0.8 ? 'High' : 'Normal' }));
  }, [handleNodeDrillDown, activeLayoutMode, graphData.nodes, toggleMultiSelectNode, setMultiSelectedNodes, setSelectedNode, updateGraphData, setAiStatus, setMlInsights]);

  const handleColumnClick = useCallback((col) => { useGraphStore.getState().setSelectedColumn(col); setShowRecordGravity(true); }, [setShowRecordGravity]);

  // ── RL / Clustering ───────────────────────────────────────────────────────────
  const handleToggleRL = useCallback(async () => {
    const next = !rlActive; setRlActive(next);
    try { await apiClient.post('/ai/optimize', { active: next, connection_id: connectionId, method: clusteringMethod }); if (connectionId) fetchRealGraphData(connectionId); }
    catch (e) { logger.error('RL Toggle Failed', e); }
  }, [rlActive, setRlActive, connectionId, clusteringMethod, fetchRealGraphData]);

  const handleToggleClusteringMethod = useCallback(async () => {
    toggleClusteringMethod();
    if (rlActive) { try { const newMethod = clusteringMethod === 'heuristic' ? 'networkx' : 'heuristic'; await apiClient.post('/ai/optimize', { active: true, connection_id: connectionId, method: newMethod }); if (connectionId) fetchRealGraphData(connectionId); } catch (e) { logger.error('Failed to update clustering', e); } }
  }, [toggleClusteringMethod, rlActive, clusteringMethod, connectionId, fetchRealGraphData]);

  const handleRecalculateGravity = useCallback(() => {
    if (connectionId) { setAiStatus('Recalculating Intelligence Weights...'); fetchGravitySuggestions(connectionId); setTimeout(() => setAiStatus(null), 3000); }
  }, [connectionId, setAiStatus, fetchGravitySuggestions]);

  // ── Share ─────────────────────────────────────────────────────────────────────
  const handleShareView = useCallback(() => {
    try {
      const hash = encodeViewState({ selectedNodeId: selectedNode?.id || null, currentLens: activeLens, multiSelectedNodes: multiSelectedNodes || [], cameraState: graphRef.current?.getCurrentCameraState?.() ?? null });
      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?view=${hash}`).then(() => showSimToast('🔗 Deep-Link Copied!', SHARE_TOAST_DURATION));
    } catch (e) { logger.error('Failed to generate Share Link', e); setAiStatus('Failed to generate link', 3000); }
  }, [selectedNode, activeLens, multiSelectedNodes, showSimToast, setAiStatus]);

  // ── Command handlers ──────────────────────────────────────────────────────────
  const handleEvolution = useCallback(({ instruction, target }) => {
    if (instruction === 'start_evolution') setEvolutionMode(true);
    else if (instruction === 'stop_evolution') setEvolutionMode(false);
    else if (instruction === 'simulate_formation' && target && !(viewMode === 'drilldown' && drillDownTable === target)) handleNodeDrillDown(target, true);
  }, [handleNodeDrillDown, viewMode, drillDownTable, setEvolutionMode]);

  const handleNav = useCallback(({ instruction, target }) => {
    const map = { show_schema: 'schema', show_analytics: 'analytics', show_dataflow: 'dataflow', show_vitals: 'vitals' };
    if (map[instruction]) setViewMode(map[instruction]);
    else if (instruction === 'go_home') handleNavigate('overview');
    else if (instruction === 'drill_down' && target && !(viewMode === 'drilldown' && drillDownTable === target)) handleNodeDrillDown(target);
  }, [handleNavigate, handleNodeDrillDown, viewMode, drillDownTable, setViewMode]);

  const handleAnalyticsCmd = useCallback(({ instruction }) => {
    if (instruction === 'run_anomaly_detection' || instruction === 'system_report') setViewMode('analytics');
    if (instruction === 'apply_clustering') handleToggleRL();
  }, [handleToggleRL, setViewMode]);

  const handleAudioCmd = useCallback(() => {
    if (!soundSystem) return;
    setAiStatus(`Sonification ${soundSystem.toggle() ? 'Enabled' : 'Disabled'}`, 3000);
  }, [setAiStatus]);

  const handleTimeMachine = useCallback(({ instruction }) => {
    if (instruction === 'open' || instruction === 'show') { openTimeMachine(); return { success: true, message: 'Opening Time Machine' }; }
    closeTimeMachine(); return { success: true, message: 'Exiting Time Machine' };
  }, [openTimeMachine, closeTimeMachine]);

  useRegisterCommand('graph_evolution', handleEvolution);
  useRegisterCommand('ui_navigation', handleNav);
  useRegisterCommand('analytics', handleAnalyticsCmd);
  useRegisterCommand('ui_audio', handleAudioCmd);
  useRegisterCommand('ui_time_machine', handleTimeMachine);

  useRegisterCommand('admin.rbac', () => {
    if (!canDo('admin')) return;
    openWindow(
      'rbac-manager',
      'Security & Dynamic RBAC',
      UserManagementPanel,
      { width: 900, height: 650, icon: 'shield', startMaximized: true }
    );
  });

  useRegisterCommand('admin.audit', () => {
    if (!canDo('admin')) return;
    openWindow(
      'audit-logs',
      'Audit Logs',
      React.lazy(() => import('../components/Admin/AuditLogPage')),
      { width: 1000, height: 700, icon: 'fingerprint', startMaximized: true }
    );
  });


  const handleAgentAction = useCallback((result) => {
    if (!result.success || !result.result) return;
    const { instruction, target, action_type, parameters } = result.result;
    const outcome = executeCommand(action_type, { instruction, target, ...parameters });
    if (!outcome.success) setAiStatus(`Agent Error: ${outcome.error}`, 4000);
    else if (outcome.result?.success === false) setAiStatus(`Visual Error: ${outcome.result.error}`, 4000);
    else if (outcome.result?.success === true && outcome.result?.message) setAiStatus(outcome.result.message, 3000);
  }, [executeCommand, setAiStatus]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const resolvedGraphLayoutMode = (viewMode === 'globalLatent' || viewMode === 'latent') ? 'latent' : activeLayoutMode;

  const sidebarProps = {
    actions: {
      loadSystem: () => { if (connectionId) fetchRealGraphData(connectionId); else setShowConnectModal(true); },
      toggleRL: handleToggleRL,
      rlActive,
      clusteringMethod,
      toggleClusteringMethod: handleToggleClusteringMethod,
      recalculateGravity: handleRecalculateGravity,
      navigateTo: handleNavigate,
      switchConnection: (id) => { setConnectionId(id); fetchRealGraphData(id); },
      openConnectModal: () => setShowConnectModal(true),
      logout: logout,
      activeConnections,
      executeCommand
    },
    clusters: mlInsights?.clusters || [], onClusterClick: () => { },
    selectedNode, impactedNodes: graphData.nodes.filter((n) => n.propagationState === 'impacted'),
    mlInsights, liveStats, activeLens,
    flows: liveStats.anomalies.map((a) => ({ id: a.id, description: a.description || a.explanation || a.message || a.metric, severity: a.severity, justification: a.justification || a.explanation })),
  };

  return {
    // Auth
    isAuthenticated, isCheckingAuth, login,
    // State (read)
    loading, showConnectModal, connectionId,
    graphData, selectedNode, hoveredNode, hoveredEdge, hoveredEdgePos,
    multiSelectedNodes, showMultiConnections, pinnedNodes, pinnedNodeId,
    pinnedCols, pinnedEdge, threeGraphKey,
    viewMode, activeLens, activeLayoutMode, breadcrumbs, isChatOpen,
    drillDownTable, isSidebarPanelActive, isHudMinimized, insightPerspective,
    activeFilters, isWarRoomActive, warRoomTargetNode,
    showPKs, showFKs, singleNodeViewEnabled, isInspectorActive,
    liveStats, liveTableCounts, simUpdate,
    evolutionMode, currentSnapshot, timeMachineOpen, snapshotData, timeValue,
    aiStatus, mlInsights, gravitySuggestions, showRecordGravity, rlActive,
    clusteringMethod, columnAliases,
    // State (write - needed in JSX)
    setShowConnectModal, setIsChatOpen, setHoveredEdge, setHoveredEdgePos,
    setPinnedEdge, setPinnedNodeId, setSelectedNode, setHoveredNode,
    setIsHudMinimized, setMultiSelectedNodes, setShowMultiConnections,
    setPinnedNodes, setPinnedCols, setColumnAliases, setInsightPerspective,
    toggleInsightPerspective, setFilterValue, activateWarRoom, deactivateWarRoom,
    setShowPKs, setShowFKs, setSingleNodeViewEnabled, setIsInspectorActive,
    setCurrentSnapshot, closeTimeMachine, incrementThreeGraphKey, setTimeValue,
    // Handlers
    handleNavigate, handleNodeDrillDown, handleBackToOverview, handleToggleLatent,
    handleToggleLens, handleToggleLayoutMode, handleNodeClick, handleColumnClick,
    handleToggleRL, handleToggleClusteringMethod, handleRecalculateGravity,
    handleShareView, handleAgentAction,
    // Derived
    resolvedGraphLayoutMode, sidebarProps, initialCameraState,
    // Multiplayer
    persona, activePeers,
    // Windows
    windows,
  };
}