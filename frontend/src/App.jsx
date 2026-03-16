import React, { useEffect, useState, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Shield, Info, Settings as SettingsIcon, Zap } from 'lucide-react';
import { WindowManagerProvider, useWindowManager } from './context/WindowManagerContext';
import Window from './components/WindowManager/Window';
import Taskbar from './components/WindowManager/Taskbar';
import ConnectionModal from './components/WindowManager/ConnectionModal';
import Settings from './components/Apps/Settings';

// New Dashboard Imports
const ThreeGraph = lazy(() => import('./components/Dashboard/ThreeGraph'));
const Record3DGraph = lazy(() => import('./components/Dashboard/Record3DGraph'));
import DrillDownView from './components/Dashboard/DrillDownView';
import DataFlowView from './components/Dashboard/DataFlowView';
import AnalyticsView from './components/Dashboard/AnalyticsView';
import SchemaView from './components/Dashboard/SchemaView';
import ChatInterface from './components/Dashboard/ChatInterface';
const PerspectiveLineageView = lazy(() => import('./components/Dashboard/PerspectiveLineageView'));
import SystemVitalsDashboard from './components/Dashboard/SystemVitalsDashboard';
import IntelligenceHub from './components/Intelligence/IntelligenceHub';
import { LatentWorld, LatentSpaceUIOverlay, getLensCategories } from './components/Dashboard/LatentSpaceLogic.jsx';
import { SidebarSkeleton, GraphOverlaySkeleton } from './components/Dashboard/LoadingSkeleton';
import EdgeStatsPanel from './components/Dashboard/EdgeStatsPanel';
import LineageInsightHUD from './components/Dashboard/LineageInsightHUD';
import WarRoomHUD from './components/Incident/WarRoomHUD';
import { GenerationLogPanel } from './components/Dashboard/GenerationLogPanel';
// Navigation

import NavigationBar from './components/Layout/NavigationBar';
import DashboardLayout from './components/Layout/DashboardLayout';
import { Legend, CirclePackOverlay, StatsDashboard } from './components/Dashboard/UIOverlay';
import VoiceControl from './components/Voice/VoiceControl';
import AgentStatusPanel from './components/Voice/AgentStatusPanel';
import { agentService } from './services/agentService';
import TimelinePlayer from './components/Evolution/TimelinePlayer';
import EvolutionOverlay from './components/Evolution/EvolutionOverlay';
import EvolutionMathOverlay from './components/Evolution/EvolutionMathOverlay';
import TimeMachinePanel from './components/Panels/TimeMachinePanel';
import { CommandRegistryProvider, useCommandRegistry, useRegisterCommand } from './context/CommandRegistryContext';
import soundSystem from './utils/SoundSystem';
import { useWebSocket } from './hooks/useWebSocket';
import { useMultiplayer } from './hooks/useMultiplayer';
import apiClient, { registerAsyncErrorHandler } from './utils/apiClient';
import { useAsyncError } from './hooks/useAsyncError';
import { decodeViewState, encodeViewState } from './utils/stateEncoder';
import LoginPage from './components/Auth/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import { cn } from './utils/cn';
import RemoteCursors from './components/Multiplayer/RemoteCursors';


// --- ERROR FALLBACK COMPONENTS ---

const AppCrashScreen = React.memo(() => (
  <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
    <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border border-rose-500/20">
      <span className="material-symbols-outlined text-rose-500 text-4xl">terminal</span>
    </div>
    <h1 className="text-2xl font-bold text-white mb-2">Critical System Failure</h1>
    <p className="text-gray-400 mb-8 max-w-md">
      The application encountered a critical error and cannot continue.
      Your session and data remain safe on the server.
    </p>
    <button
      onClick={() => window.location.reload()}
      className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-500/20"
    >
      Reload Intelligence System
    </button>
  </div>
));

const ThreeGraphFallback = React.memo(({ reset }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-md">
    <div className="text-amber-500/80 mb-4 animate-pulse">
      <span className="material-symbols-outlined text-6xl">videogame_asset_off</span>
    </div>
    <h3 className="text-lg font-bold text-white mb-2">3D Visualization Offline</h3>
    <p className="text-gray-400 text-sm mb-6">The neural rendering engine has stalled.</p>
    <button
      onClick={reset}
      className="px-6 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/30 rounded-lg text-xs font-bold uppercase transition-all"
    >
      Restart Engine
    </button>
  </div>
));

const PanelError = React.memo(({ name, reset }) => (
  <div className="p-6 bg-black/40 border border-rose-500/20 rounded-xl m-4 backdrop-blur-xl">
    <div className="flex items-center gap-3 text-rose-400 mb-2">
      <span className="material-symbols-outlined">warning</span>
      <h4 className="font-bold">{name} Error</h4>
    </div>
    <p className="text-xs text-gray-500 mb-4">This module failed to initialize properly.</p>
    <button
      onClick={reset}
      className="text-[10px] text-rose-400 font-bold uppercase tracking-widest hover:text-rose-300 transition-colors"
    >
      Re-initialize
    </button>
  </div>
));

const App = () => {
  return (
    <ErrorBoundary fallback={<AppCrashScreen />}>
      <WindowManagerProvider>
        <CommandRegistryProvider>
          <MainDashboard />
        </CommandRegistryProvider>
      </WindowManagerProvider>
    </ErrorBoundary>
  );
};

const MainDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const throwAsyncError = useAsyncError();

  // Initialize Auth
  useEffect(() => {
    // Only throw truly fatal errors to ErrorBoundary (e.g. forbidden access).
    // Recoverable errors (network, 500, timeout) are handled by individual catch blocks.
    registerAsyncErrorHandler((err) => {
      const fatalCodes = ['FORBIDDEN'];
      if (fatalCodes.includes(err?.code)) {
        throwAsyncError(err);
      } else {
        console.warn('[App] Recoverable API error (not crashing):', err?.code, err?.message);
      }
    });
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    }
    setIsCheckingAuth(false);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    delete apiClient.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
  }, []);

  // Set up global 401 interceptor
  useEffect(() => {
    const interceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.warn('[App] Session expired or invalid. Logging out...');
          handleLogout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.response.eject(interceptor);
    };
  }, [handleLogout]);

  const graphRef = React.useRef(null);
  const { openWindow, windows, connectionId, setConnectionId } = useWindowManager();
  const { executeCommand } = useCommandRegistry(); // Use Registry for execution
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Decode the Deep-Link view state ONCE
  const initialViewState = React.useMemo(() => {
    return decodeViewState(searchParams.get('view'));
  }, [searchParams]);

  // ... (State definitions remain the same) ...
  const [selectedNode, setSelectedNode] = useState(initialViewState?.selectedNodeId || null);
  const [aiStatus, setAiStatus] = useState(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [showRecordGravity, setShowRecordGravity] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [threeGraphKey, setThreeGraphKey] = useState(0);
  const [graphData, setGraphData] = React.useState({ nodes: [], edges: [] });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [rlActive, setRlActive] = useState(false);
  const [clusteringMethod, setClusteringMethod] = useState('heuristic');
  const [mlInsights, setMlInsights] = useState(null);
  const [simUpdate, setSimUpdate] = useState(null); // Toast for simulation updates 
  const [gravitySuggestions, setGravitySuggestions] = React.useState([]);
  const [viewMode, setViewMode] = useState(() => {
    // Priority 1: URL path
    const path = window.location.pathname.substring(1);
    const validModes = ['overview', 'drilldown', 'dataflow', 'analytics', 'vitals', 'schema', 'intelligence', 'lineage', 'globalLatent', 'latent'];
    if (validModes.includes(path)) return path;

    // Priority 2: localStorage
    return localStorage.getItem('viewMode') || 'overview';
  });
  const [drillDownTable, setDrillDownTable] = useState(null);
  const [autoSimulate, setAutoSimulate] = useState(false);
  const [evolutionMode, setEvolutionMode] = useState(false);

  const [liveStats, setLiveStats] = useState({
    totalTransactions: 0, fraudAlerts: 0, avgAmount: 0, failedTx: 0, tps: 0, activeNodes: 0,
    health: { state: 'healthy', score: 100, color: '#00ff88', issues: [] },
    anomalies: [],
    // WEZU Energy
    activeBatteries: 0, onlineStations: 0, networkHealth: 0, energyAlerts: 0,
    // Battery Telemetry
    avgBatteryTemp: 0, avgBatteryVolt: 0, avgBatteryCurr: 0,
    // DB Performance
    cacheHitRate: 99,
  });
  // Live per-table row counts — updated every 2s from WebSocket for node glow
  const [liveTableCounts, setLiveTableCounts] = useState({});
  const [currentSnapshot, setCurrentSnapshot] = useState(null);
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);
  const [snapshotData, setSnapshotData] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [activeLens, setActiveLens] = useState(() => initialViewState?.currentLens || localStorage.getItem('activeLens') || 'ops'); // New Lens State
  const [activeLayoutMode, setActiveLayoutMode] = useState(() => localStorage.getItem('activeLayoutMode') || 'galaxy'); // SAI Layout Mode
  const [hoveredNode, setHoveredNode] = useState(null); // Intelligence Preview State
  const [hoveredEdge, setHoveredEdge] = useState(null); // [NEW] Edge hover state
  const [hoveredEdgePos, setHoveredEdgePos] = useState(null);
  const [timeValue, setTimeValue] = useState(100); // Time Travel State
  const [multiSelectedNodes, setMultiSelectedNodes] = useState(initialViewState?.multiSelectedNodes || []); // [NEW] Multi-select state
  const [showMultiConnections, setShowMultiConnections] = useState(false); // [NEW] Isolates connections
  const hasResetOverviewRef = useRef(false);
  const firstLoadRef = useRef(true);
  const initialCameraState = useRef(initialViewState?.cameraState || null);
  const [activeFilters, setActiveFilters] = useState(() => {
    const saved = localStorage.getItem('activeFilters');
    return saved ? JSON.parse(saved) : {
      'Independent Facts': true,
      'Dependent Facts': true,
      'Healthy Tables': true,
      'Anomalous Peaks': true
    };
  });
  const [enrichedNodes, setEnrichedNodes] = useState(null);
  const [insightPerspective, setInsightPerspective] = useState('analyst'); // 'analyst' or 'business'
  const [pinnedNodes, setPinnedNodes] = useState(new Set()); // [NEW] Pin state persistence
  const [pinnedNodeId, setPinnedNodeId] = useState(null); // [NEW] HUD Pin state
  const [isSidebarPanelActive, setIsSidebarPanelActive] = useState(false); // [NEW] Track if Intelligence Hub or Agent Hub is open
  const [pinnedCols, setPinnedCols] = useState(new Set()); // [NEW] Pin state persistence
  const [columnAliases, setColumnAliases] = useState({}); // [NEW] Manual business term overrides
  const [pinnedEdge, setPinnedEdge] = useState(null); // [NEW] Edge HUD Pin state
  const [isHudMinimized, setIsHudMinimized] = useState(false); // [NEW] Global HUD visibility lock

  // --- WAR ROOM STATE ---
  const [isWarRoomActive, setIsWarRoomActive] = useState(false);
  const [warRoomTargetNode, setWarRoomTargetNode] = useState(null);

  const resolvedGraphLayoutMode =
    (viewMode === 'globalLatent' || viewMode === 'latent')
      ? 'latent'
      : activeLayoutMode;

  // Global Sidebar Panel Sync
  useEffect(() => {
    const handleSidebarState = (e) => {
      setIsSidebarPanelActive(!!e.detail?.active);
    };
    window.addEventListener('sidebar-panel-active', handleSidebarState);
    return () => window.removeEventListener('sidebar-panel-active', handleSidebarState);
  }, []);

  // --- UNIFIED URL-DRIVEN NAVIGATION SYSTEM ---
  // The URL is the single source of truth. All navigation should use navigate(path).
  useEffect(() => {
    const rawPath = location.pathname.substring(1).replace(/\/$/, "");
    const validModes = ['overview', 'drilldown', 'dataflow', 'analytics', 'vitals', 'schema', 'intelligence', 'lineage', 'globalLatent', 'latent'];

    // 1. Determine target mode from URL (fallback to overview at root)
    const targetMode = validModes.includes(rawPath) ? rawPath : 'overview';

    // 2. Sync State from URL (only if mismatch)
    if (viewMode !== targetMode) {
      setViewMode(targetMode);
      localStorage.setItem('viewMode', targetMode);
    }

    // 3. Sync URL from State (only for normalizing / invalid paths)
    // If we are at root / and mode is already overview, we're good.
    // If we are at an invalid path or missing mode segment, enforce it.
    if (location.pathname !== `/${targetMode}`) {
      if (location.pathname === '/' && targetMode === 'overview') {
        // Allow root / to stay as /
      } else {
        navigate(`/${targetMode}`, { replace: true });
      }
    }
  }, [location.pathname, viewMode, navigate]);

  useEffect(() => {
    localStorage.setItem('activeLens', activeLens);
  }, [activeLens]);

  useEffect(() => {
    localStorage.setItem('activeLayoutMode', activeLayoutMode);
  }, [activeLayoutMode]);

  useEffect(() => {
    localStorage.setItem('activeFilters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  // Lens Switch Handler
  const handleToggleLens = React.useCallback((lens) => {
    setActiveLens(lens);

    // [FEATURE] Reset filters based on the selected lens categories
    const newCategories = getLensCategories(lens);
    const newFilters = {};
    newCategories.forEach(c => {
      newFilters[c.id] = true;
    });
    setActiveFilters(newFilters);

    if (graphRef.current && graphRef.current.setLens) {
      graphRef.current.setLens(lens);
    }
  }, []);

  // SAI Layout Mode Handler
  const handleToggleLayoutMode = React.useCallback((mode) => {
    setActiveLayoutMode(mode);
    if (graphRef.current && graphRef.current.setLatentMode) {
      graphRef.current.setLatentMode(mode);
    }
  }, []);

  // --- REAL-TIME SYNC (WebSocket) ---
  const wsUrl = connectionId ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/${connectionId}` : null;
  const { status: wsStatus, lastMessage, send: sendMessage, dbReconnecting } = useWebSocket(wsUrl);
  const wsConnected = wsStatus === "connected";

  // --- MULTIPLAYER PRESENCE ---
  const { persona, activePeers, handlePresenceMessage } = useMultiplayer(sendMessage, wsConnected, {
    getCurrentCameraState: () => graphRef.current?.getCurrentCameraState ? graphRef.current.getCurrentCameraState() : null,
    selectedNodeId: selectedNode,
    currentLens: activeLens
  });

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'presence_update') {
        handlePresenceMessage(lastMessage);
        return;
      }

      if (lastMessage.type === 'metrics_update') {
        const metrics = lastMessage.data || {};
        const aiStats = lastMessage.ai_stats || {};

        // Update per-table counts for node glow (every 2s)
        if (lastMessage.table_counts && Object.keys(lastMessage.table_counts).length > 0) {
          setLiveTableCounts(lastMessage.table_counts);
        }

        setLiveStats(prev => ({
          ...prev,
          totalTransactions: metrics.total_transactions || prev.totalTransactions || 0,
          tps: metrics.transaction_rate || prev.tps || 0,
          activeNodes: aiStats.total_nodes || prev.activeNodes,
          health: lastMessage.health || prev.health,
          anomalies: (lastMessage.anomalies || prev.anomalies || []).map(a => ({
            ...a,
            explanation: a.justification || a.explanation || a.description || a.message
          })),
          // WEZU Energy — direct from backend battery queries (now fixed with current_a)
          activeBatteries: metrics.active_batteries != null ? metrics.active_batteries : prev.activeBatteries,
          onlineStations: metrics.online_stations != null ? metrics.online_stations : prev.onlineStations,
          networkHealth: metrics.network_health != null ? metrics.network_health : prev.networkHealth,
          energyAlerts: metrics.energy_alerts != null ? metrics.energy_alerts : prev.energyAlerts,
          avgBatteryTemp: metrics.avg_battery_temp || prev.avgBatteryTemp || 0,
          avgBatteryVolt: metrics.avg_battery_volt || prev.avgBatteryVolt || 0,
          avgBatteryCurr: metrics.avg_battery_curr || prev.avgBatteryCurr || 0,
          cacheHitRate: metrics.cache_hit_rate || prev.cacheHitRate || 99,
        }));

        if (aiStats.status) {
          setAiStatus(`Neural Core: ${aiStats.status} | Scanned: ${aiStats.scanned_nodes || 0}/${aiStats.total_nodes || 0}`);
        }

        setMlInsights(prev => ({
          ...prev,
          anomalyScore: (100 - (lastMessage.health?.score || 100)).toFixed(0),
          gravity: aiStats.avg_gravity ? `${aiStats.avg_gravity.toFixed(2)}x` : '1.0x',
          optimization: 'Active'
        }));

        // Live Node Update: Inject Battery Temp without reload
        if (metrics.avg_battery_temp) {
          // VISUALIZATION: Notify user of update
          const temp = parseFloat(metrics.avg_battery_temp).toFixed(1);
          const volt = metrics.avg_battery_volt ? parseFloat(metrics.avg_battery_volt).toFixed(1) : '—';
          const curr = metrics.avg_battery_curr ? parseFloat(metrics.avg_battery_curr).toFixed(1) : '—';

          setSimUpdate(`🔋 Battery Update: ${temp}°C | ${volt}V | ${curr}A${dbReconnecting ? ' | 🔄 DB Resyncing' : ''}`);
          setTimeout(() => setSimUpdate(null), 4000);

          setGraphData(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
              n.name === 'batteries'
                ? {
                  ...n,
                  avg_temperature: metrics.avg_battery_temp,
                  avg_voltage: metrics.avg_battery_volt,
                  avg_current: metrics.avg_battery_curr
                }
                : n
            )
          }));
        }

        // 4. Update Node Evolution (Incremental)
        if (lastMessage.evolved_nodes) {
          setGraphData(prev => {
            const updatedNodes = prev.nodes.map(node => {
              const evolved = lastMessage.evolved_nodes.find(e => e.id === node.id);
              if (evolved) {
                return {
                  ...node,
                  size: evolved.size || node.size,
                  status: evolved.status || node.status,
                  vitality: evolved.vitality || node.vitality
                };
              }
              return node;
            });
            return { ...prev, nodes: updatedNodes };
          });
        }
      }
    }
  }, [lastMessage]);


  // Navigation handlers (URL-driven)
  const handleNavigate = React.useCallback((view) => {
    navigate(`/${view}`);

    if (view === 'overview') {
      setBreadcrumbs([]);
      setDrillDownTable(null);
    }
  }, [navigate]);

  const handleNodeDrillDown = React.useCallback((nodeId, shouldSimulate = false) => {
    // CINEMATIC TRANSITION: Zoom in first if we are in overview
    if (viewMode === 'overview' && graphRef.current) {
      graphRef.current.highlightNode(nodeId);
      setAiStatus(`Neural Core: Drilling into ${nodeId}...`);

      // Wait for camera to arrive (1.2s) before unmounting graph
      setTimeout(() => {
        handleNavigate('drilldown');
        setDrillDownTable(nodeId);
        setAutoSimulate(shouldSimulate);
        setAiStatus(null);
      }, 1200);
    } else {
      // Direct switch if already in another view or graph not ready
      handleNavigate('drilldown');
      setDrillDownTable(nodeId);
      setAutoSimulate(shouldSimulate);
    }

    setBreadcrumbs([{ label: 'Overview', onClick: () => handleNavigate('overview') }, { label: `Table: ${nodeId}` }]);
  }, [handleNavigate, viewMode]);

  // Effect to ensure graph is reset whenever we return to overview
  useEffect(() => {
    if (viewMode === 'overview') {
      if (graphRef.current && !hasResetOverviewRef.current) {
        graphRef.current.resetView();
        hasResetOverviewRef.current = true;
      }
    } else {
      // Clear flag when we leave overview
      hasResetOverviewRef.current = false;
    }
  }, [viewMode]);

  const handleBackToOverview = React.useCallback(() => {
    navigate('/overview');
    setDrillDownTable(null);
    setSelectedNode(null); // [FIX] Clear selection to restore hover hud
    setHoveredNode(null);
    setBreadcrumbs([]);
  }, [navigate]);

  // Sync Graph Mode with View Mode (Visual Bridge)
  useEffect(() => {
    if (graphRef.current) {
      if (viewMode === 'globalLatent' || viewMode === 'latent') {
        graphRef.current.setLatentMode('latent');
      } else if (viewMode === 'overview') {
        graphRef.current.setLatentMode('galaxy');
      }
    }
  }, [viewMode]);

  const handleToggleLatent = React.useCallback(() => {
    // Legacy support for DrillDown -> LatentWorld
    if (viewMode === 'drilldown' || viewMode === 'latent') {
      const nextView = viewMode === 'latent' ? 'drilldown' : 'latent';

      if (nextView === 'latent') {
        setSelectedNode(null);
        setHoveredNode(null);
      }
      navigate(`/${nextView}`);
    } else {
      if (viewMode === 'overview') {
        setSelectedNode(null);
        setHoveredNode(null);
      }
      const target = viewMode === 'globalLatent' ? 'overview' : 'globalLatent';
      navigate(`/${target}`);
    }
  }, [viewMode, navigate]);

  const fetchGravitySuggestions = React.useCallback(async (connId) => {
    try {
      const data = await apiClient.get(`/ai/gravity-suggestions/${connId}`);
      setGravitySuggestions(data.suggestions || []);
    } catch (e) { console.error('Failed to fetch gravity suggestions:', e); }
  }, []);

  const fetchRealGraphData = React.useCallback(async (id) => {
    // V17 Load Guard: Only show global loading on first mount or empty state
    if (firstLoadRef.current) { setLoading(true); firstLoadRef.current = false; }
    fetchGravitySuggestions(id);
    try {
      const rawData = await apiClient.get(`/graph/${id}`);
      if (rawData.neural_core) {
        const core = rawData.neural_core;
        setAiStatus(`Neural Core: ${core.ai_stats?.status || 'ACTIVE'} | Scanned: ${core.ai_stats?.scanned_nodes || 0}/${core.ai_stats?.total_nodes || 0}`);
        setLiveStats(prev => ({ ...prev, tps: core.metrics?.transaction_rate || 0, fraudAlerts: core.metrics?.fraud_alerts || 0, failedTx: core.metrics?.failed_transactions || 0, avgAmount: core.metrics?.average_amount || 0, activeNodes: core.ai_stats?.total_nodes || rawData.nodes.length, health: core.health || prev.health }));
        const clusterMap = {};
        rawData.nodes.forEach(node => { if (node.cluster && node.name !== 'Neural Core') { if (!clusterMap[node.cluster]) clusterMap[node.cluster] = []; clusterMap[node.cluster].push(node.name); } });
        const clusterDetails = Object.keys(clusterMap).map(c => ({ name: c, tables: clusterMap[c], count: clusterMap[c].length }));
        setMlInsights({ anomalyScore: (100 - (core.health?.score || 100)).toFixed(0), gravity: core.ai_stats?.avg_gravity ? `${core.ai_stats.avg_gravity.toFixed(2)}x` : '1.0x', optimization: 'Active', clusters: clusterDetails.length > 0 ? clusterDetails : null });
      } else { setAiStatus("Neural Core: Global Analysis Complete"); }

      const nodesTransformed = (rawData.nodes || []).map((node, i) => {
        // Dynamic Size Calculation based on Neural Importance
        const importance = node.importance_score || 1.0;
        const rowBonus = node.record_count ? Math.log10(node.record_count + 1) * 5 : 0;
        const calculatedSize = 20 + (importance * 15) + rowBonus;

        return {
          id: node.id,
          name: node.name,
          color: node.color || (node.group === 1 ? 0xfbbf24 : 0x22d3ee),
          size: calculatedSize,
          pos: [node.x || Math.cos(i * 0.5) * (150 + i * 10), node.y || (Math.random() - 0.5) * 200, node.z || Math.sin(i * 0.5) * (150 + i * 10)],
          entity: node.entity || 'TABLE',
          rows: node.row_count ? node.row_count.toLocaleString() + ' Records' : 'Empty',
          row_count: node.row_count || 0,
          metrics: node.metrics || node.foreign_keys || [],
          columns: node.columns || [],
          vitality: node.vitality === undefined ? 100 : node.vitality, // Fix: Don't default to 50
          pulse_rate: node.pulse_rate || 0.1,
          glow_intensity: node.node_glow || 0.1,
          node_glow: node.node_glow || 0.2,
          importance_score: node.importance_score || 1.0,
          cluster: node.cluster,
          foreign_keys: node.foreign_keys || [],
          customMetrics: node.customMetrics || {},

          // [CRITICAL] Preserve Semantic & Dependency Fields
          has_upstream_deps: node.has_upstream_deps,
          upstream_node_ids: node.upstream_node_ids,
          downstream_node_ids: node.downstream_node_ids,
          is_anomalous: node.is_anomalous,
          latent_category: node.latent_category,
          latent_color: node.latent_color,

          // [STRICT ALIGNMENT] Preservation
          isFactTable: node.is_fact_table,
          isDimensionTable: node.is_dimension_table,
          isSource: node.is_source,
          dependencyDepth: node.dependency_depth,
          independencyScore: node.independency_score,
          anomalySeverity: node.anomaly_severity,
          healthScore: node.health_score,
          affectedDownstreamCount: node.affected_downstream_count,
          upstreamNodeIds: node.upstream_node_ids,
          downstreamNodeIds: node.downstream_node_ids
        };
      });
      const edgesTransformed = (rawData.edges || []).map(e => ({
        ...e,
        source: e.source,
        target: e.target,
        type: e.type || e.relationship_category,
        trafficIntensity: e.traffic_intensity || 0.3,
        edge_glow: e.edge_glow || 1.0
      }));

      // Use real latent manifold data from backend (no mock data injection)
      const finalLatentManifold = rawData.latent_manifold || null;

      setGraphData({
        nodes: nodesTransformed,
        edges: edgesTransformed,
        latent_manifold: finalLatentManifold, // Use shim if real data missing
        intelligence_stream: rawData.intelligence_stream // Causal history
      });

      setLiveStats(prev => ({ ...prev, activeNodes: nodesTransformed.length }));
      setTimeout(() => setAiStatus(null), 5000);
    } catch (e) {
      console.error('Error fetching graph data:', e);
      setAiStatus(`Backend Unavailable: ${e.message}`);
      // No demo fallback — show honest empty state
    } finally { setLoading(false); }
  }, [fetchGravitySuggestions]);

  // Initial load check
  useEffect(() => {
    // Fetch System Config & Feature Flags
    apiClient.get('/agent/config')
      .then(config => {
        // Store in global window for easy debugging access
        window.SYSTEM_FEATURES = config.features;

        // If we don't have a connection yet, but the backend has one ready, use it!
        if (!connectionId && config.active_connection_id) {
          console.log(`🔌 Auto-adopting backend connection: ${config.active_connection_id}`);
          setConnectionId(config.active_connection_id);
          fetchRealGraphData(config.active_connection_id);
        } else if (!connectionId) {
          setTimeout(() => setShowConnectModal(true), 500);
        }
      })
      .catch(err => {
        console.error("Could not fetch system config:", err);
        if (!connectionId) setTimeout(() => setShowConnectModal(true), 500);
      });
  }, [connectionId, fetchRealGraphData]);

  // Fallback check
  useEffect(() => {
    if (!showConnectModal && !connectionId) {
      // Look for any connection instead of hardcoded demo
      apiClient.get('/connections')
        .then(conns => {
          if (conns && conns.length > 0) {
            setConnectionId(conns[0].id);
            fetchRealGraphData(conns[0].id);
          }
        })
        .catch(err => console.error("Auto-discovery failed:", err));
    }
  }, [showConnectModal, connectionId, fetchRealGraphData]);

  const handleNodeClick = React.useCallback((node, shiftKey = false) => {
    if (shiftKey) {
      setMultiSelectedNodes(prev => {
        const isSelected = prev.some(n => n.id === node.id);
        if (isSelected) {
          return prev.filter(n => n.id !== node.id);
        } else {
          return [...prev, node];
        }
      });
      // Skip drilldown and other single-node logic when shift-selecting
      return;
    }

    // Normal click: Clear multi-selection and select single node
    setMultiSelectedNodes([]);
    setSelectedNode(node);

    // [STRICT ALIGNMENT] Dependency Propagation Logic
    // If it's an Independent Fact (Yellow), propagate impact downstream
    if (activeLayoutMode === 'latent' && node.latent_category === 'Dimension') {
      const impactedIds = new Set();
      const queue = [...(node.downstreamNodeIds || [])];

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!impactedIds.has(currentId)) {
          impactedIds.add(currentId);
          const currentNode = graphData.nodes.find(n => n.id === currentId);
          if (currentNode && currentNode.downstreamNodeIds) {
            queue.push(...currentNode.downstreamNodeIds);
          }
        }
      }


      // Update graph data with impacted flags
      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({
          ...n,
          propagationState: impactedIds.has(n.id) ? 'impacted' : null
        }))
      }));

      setAiStatus(`Propagation: ${impactedIds.size} tables impacted by ${node.id}`);
      setTimeout(() => setAiStatus(null), 5000);
    } else {
      // Clear propagation if clicking non-independent or switching views
      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({ ...n, propagationState: null }))
      }));
    }

    if (node.id !== 'hub') handleNodeDrillDown(node.id); else setShowDrillDown(false);
    setMlInsights(prev => ({ ...prev, anomalyScore: node.vitality ? (100 - node.vitality) : 0, gravity: (node.importance_score || 0) > 0.8 ? 'High' : 'Normal' }));
  }, [handleNodeDrillDown, activeLayoutMode, graphData.nodes, setMultiSelectedNodes]);

  const handleColumnClick = React.useCallback((col) => { setSelectedColumn(col); setShowRecordGravity(true); }, []);

  const handleToggleRL = useCallback(async () => {
    setRlActive(prev => {
      const next = !prev;
      apiClient.post('/ai/optimize', { active: next, connection_id: connectionId, method: clusteringMethod })
        .then(() => { if (connectionId) fetchRealGraphData(connectionId); })
        .catch(e => console.error("RL Toggle Failed", e));
      return next;
    });
  }, [connectionId, clusteringMethod, fetchRealGraphData]);

  // --- DEEP-LINK SHARE HANDLER ---
  const handleShareView = useCallback(() => {
    try {
      // 1. Get Camera State from ThreeGraph
      const cameraState = graphRef.current?.getCurrentCameraState ? graphRef.current.getCurrentCameraState() : null;

      // 2. Build state payload
      const viewState = {
        selectedNodeId: selectedNode?.id || null,
        currentLens: activeLens,
        multiSelectedNodes: multiSelectedNodes || [],
        cameraState: cameraState
      };

      // 3. Encode and build URL
      const hash = encodeViewState(viewState);
      const url = `${window.location.origin}${window.location.pathname}?view=${hash}`;

      // 4. Copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
        setSimUpdate("🔗 Deep-Link Copied to Clipboard!");
        setTimeout(() => setSimUpdate(null), 3000);
      });
    } catch (e) {
      console.error("Failed to generate Share Link", e);
      setAiStatus("Failed to generate link");
      setTimeout(() => setAiStatus(null), 3000);
    }
  }, [selectedNode, activeLens, multiSelectedNodes]);

  // --- GLOBAL COMMAND REGISTRATION (App Level) ---
  const handleEvolution = useCallback(({ instruction, target }) => {
    if (instruction === 'start_evolution') setEvolutionMode(true);
    else if (instruction === 'stop_evolution') setEvolutionMode(false);
    else if (instruction === 'simulate_formation' && target) {
      if (viewMode !== 'drilldown' || drillDownTable !== target) {
        handleNodeDrillDown(target, true);
      }
    }
  }, [handleNodeDrillDown, viewMode, drillDownTable]);

  const handleNav = useCallback(({ instruction, target }) => {
    if (instruction === 'show_schema') setViewMode('schema');
    else if (instruction === 'show_analytics') setViewMode('analytics');
    else if (instruction === 'show_dataflow') setViewMode('dataflow');
    else if (instruction === 'show_vitals') setViewMode('vitals');
    else if (instruction === 'go_home') handleNavigate('overview');
    else if (instruction === 'drill_down' && target) {
      if (viewMode === 'drilldown' && drillDownTable === target) {
        // Note: The specific viewer (DrillDownView) will also catch this via its own registration
        // but we can add global logic here if needed.
      } else {
        handleNodeDrillDown(target);
      }
    }
  }, [handleNavigate, handleNodeDrillDown, viewMode, drillDownTable]);

  const handleAnalyticsCmd = useCallback(({ instruction }) => {
    if (instruction === 'run_anomaly_detection' || instruction === 'system_report') setViewMode('analytics');
    if (instruction === 'apply_clustering') handleToggleRL();
  }, [handleToggleRL]);

  const handleAudioCmd = useCallback(({ target }) => {
    if (!soundSystem) return;
    const isNowEnabled = soundSystem.toggle();
    setAiStatus(`Sonification ${isNowEnabled ? 'Enabled' : 'Disabled'}`);
    setTimeout(() => setAiStatus(null), 3000);
  }, []);

  const handleTimeMachine = useCallback(({ instruction }) => {
    if (instruction === 'open' || instruction === 'show') {
      setTimeMachineOpen(true);
      return { success: true, message: "Opening Time Machine" };
    } else {
      setTimeMachineOpen(false);
      setSnapshotData(null);
      return { success: true, message: "Exiting Time Machine" };
    }
  }, []);

  useRegisterCommand('graph_evolution', handleEvolution);
  useRegisterCommand('ui_navigation', handleNav);
  useRegisterCommand('analytics', handleAnalyticsCmd);
  useRegisterCommand('ui_audio', handleAudioCmd);
  useRegisterCommand('ui_time_machine', handleTimeMachine);

  const toggleClusteringMethod = useCallback(async () => {
    const newMethod = clusteringMethod === 'heuristic' ? 'networkx' : 'heuristic';
    setClusteringMethod(newMethod);
    if (rlActive) {
      try {
        await apiClient.post('/ai/optimize', {
          active: true, connection_id: connectionId, method: newMethod
        });
        if (connectionId) fetchRealGraphData(connectionId);
      } catch (e) { console.error("Failed to update clustering", e); }
    }
  }, [clusteringMethod, rlActive, connectionId, fetchRealGraphData]);

  const handleRecalculateGravity = () => { if (connectionId) { setAiStatus("Recalculating Intelligence Weights..."); fetchGravitySuggestions(connectionId); setTimeout(() => setAiStatus(null), 3000); } };

  const sidebarProps = {
    actions: { loadSystem: () => { if (connectionId) fetchRealGraphData(connectionId); else setShowConnectModal(true); }, toggleRL: handleToggleRL, rlActive, clusteringMethod, toggleClusteringMethod, recalculateGravity: handleRecalculateGravity, navigateTo: handleNavigate },
    clusters: mlInsights?.clusters || [],
    onClusterClick: () => { },
    selectedNode,
    impactedNodes: graphData.nodes.filter(n => n.propagationState === 'impacted'),
    mlInsights,
    liveStats,
    activeLens, // Pass lens state
    flows: liveStats.anomalies.map(a => ({
      id: a.id,
      description: a.description || a.message || a.metric,
      severity: a.severity,
      justification: a.justification || a.explanation
    }))
  };

  // REPLACED: Handle Agent Action with Dynamic Registry Execution
  const handleAgentAction = React.useCallback((executionResult) => {
    if (!executionResult.success || !executionResult.result) return;
    const { instruction, target, action_type, parameters } = executionResult.result;


    // Dispatch to Registry
    const outcome = executeCommand(action_type, { instruction, target, ...parameters });

    if (!outcome.success) {
      console.warn(`[App] Agent Command Failed: ${outcome.error}`);
      setAiStatus(`Agent Error: ${outcome.error}`);
      setTimeout(() => setAiStatus(null), 4000);
    } else if (outcome.result && outcome.result.success === false) {
      console.warn(`[App] Frontend Execution Failed: ${outcome.result.error}`);
      setAiStatus(`Visual Error: ${outcome.result.error}`);
      setTimeout(() => setAiStatus(null), 4000);
    } else if (outcome.result && outcome.result.success === true && outcome.result.message) {
      setAiStatus(outcome.result.message);
      setTimeout(() => setAiStatus(null), 3000);
    }
  }, [executeCommand]);



  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <DashboardLayout
        sidebarProps={sidebarProps}
        timeValue={timeValue}
        onTimeChange={(viewMode === 'latent' || viewMode === 'globalLatent') ? setTimeValue : null}
        navbar={
          <NavigationBar
            currentView={viewMode}
            onNavigate={handleNavigate}
            breadcrumbs={breadcrumbs}
            onToggleChat={() => setIsChatOpen(!isChatOpen)}
            isChatOpen={isChatOpen}
            activeLens={activeLens}
            onToggleLens={handleToggleLens}
            activeLayoutMode={activeLayoutMode}
            onToggleLayoutMode={handleToggleLayoutMode}
            perspective={insightPerspective}
            onTogglePerspective={() => setInsightPerspective(p => p === 'analyst' ? 'business' : 'analyst')}
            onShareView={handleShareView}
            activePeers={activePeers}
            persona={persona}
            isWarRoomActive={isWarRoomActive}
          />
        }
      >

        {/* SIMULATION TOAST */}
        {simUpdate && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 border border-green-500/50 text-green-400 px-6 py-3 rounded-full shadow-lg backdrop-blur-md animate-bounce">
            <span className="text-lg font-mono font-bold">{simUpdate}</span>
          </div>
        )}



        {/* PERSISTENT GRAPH LAYER - Stays mounted to prevent "Cold Start" clumping */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-1000 ease-in-out",
            (viewMode === 'overview' || viewMode === 'analytics' || viewMode === 'globalLatent' || viewMode === 'latent')
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'
          )}
          style={{ zIndex: 0 }}
        >
          {loading && <GraphOverlaySkeleton />}

          <ErrorBoundary
            key={threeGraphKey}
            fallback={(error, reset) => <ThreeGraphFallback reset={() => { reset(); setThreeGraphKey(prev => prev + 1); }} />}
            onError={(err) => console.error('3D engine crashed:', err)}
          >
            <Suspense fallback={<GraphOverlaySkeleton />}>
              <ThreeGraph
                ref={graphRef}
                data={graphData}
                initialCameraState={initialCameraState.current}
                tps={liveStats.tps}
                onNodeClick={handleNodeClick}
                onNodeHover={setHoveredNode}
                onEdgeHover={(edge) => {
                  setHoveredEdge(edge);
                  if (edge) setHoveredEdgePos(edge.mousePos);
                }}
                layoutMode={resolvedGraphLayoutMode}
                activeLens={activeLens}
                activeFilters={activeFilters}
                multiSelectedNodes={multiSelectedNodes}
                showMultiConnections={showMultiConnections}
              />
            </Suspense>
          </ErrorBoundary>

          {/* AI STATUS TOAST - REPOSITIONED TO GRAPH CORNER */}
          <AnimatePresence>
            {aiStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10, x: -10 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute bottom-4 left-4 z-[4001] px-3 py-1 bg-[var(--bg-elevated)]/60 border border-[var(--primary-cyan)]/20 rounded-full flex items-center gap-2 backdrop-blur-md"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-cyan)] animate-ping" />
                <span className="text-[9px] font-bold tracking-wider text-white uppercase font-mono">{aiStatus}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <ErrorBoundary fallback={null}>
            {/* EDGE/RELATIONSHIP HUD - Only floating in non-sidebar modes */}
            <EdgeStatsPanel
              edge={pinnedEdge || hoveredEdge}
              position={hoveredEdgePos}
              visible={!isHudMinimized && !!(pinnedEdge || hoveredEdge) && viewMode !== 'latent' && viewMode !== 'globalLatent' && !isSidebarPanelActive}
              isPinned={!!pinnedEdge}
              onPin={() => setPinnedEdge(pinnedEdge ? null : hoveredEdge)}
              onClose={() => { setPinnedEdge(null); setHoveredEdge(null); setIsHudMinimized(true); }}
            />
          </ErrorBoundary>

          <ErrorBoundary fallback={null}>
            {/* LINEAGE INSIGHT HUD - Appears on Selection + Hover */}
            <LineageInsightHUD
              hoveredNode={hoveredNode}
              selectedNode={graphData.nodes?.find(n => n.id === pinnedNodeId) || selectedNode}
              pinnedNodeId={pinnedNodeId}
              onPin={(nodeId) => setPinnedNodeId(pinnedNodeId === nodeId ? null : nodeId)}
              onClose={() => { setPinnedNodeId(null); setSelectedNode(null); setHoveredNode(null); setIsHudMinimized(true); }}
              multiSelectedNodes={multiSelectedNodes}
              graphData={graphData}
              perspective={insightPerspective}
              onEnterWarRoom={(nodeId) => {
                setIsWarRoomActive(true);
                setWarRoomTargetNode(nodeId);
                if (graphRef.current?.highlightNode) {
                  graphRef.current.highlightNode(nodeId);
                }
              }}
              visible={!isHudMinimized && (!hoveredEdge || pinnedNodeId) && !isSidebarPanelActive}
            />
          </ErrorBoundary>

          <ErrorBoundary fallback={null}>
            {/* MINIMIZED HUD RESTORE TRIGGER */}
            <AnimatePresence>
              {isHudMinimized && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={() => setIsHudMinimized(false)}
                  className="fixed top-[100px] left-[92px] p-2 bg-[var(--bg-elevated)]/80 hover:bg-[var(--primary-cyan)]/20 border border-[var(--primary-cyan)]/30 rounded-lg flex items-center gap-2 text-[var(--primary-cyan)] font-bold text-[10px] uppercase tracking-widest backdrop-blur-md z-[5001] shadow-lg transition-all"
                >
                  <Activity size={14} className="animate-pulse" />
                  Restore HUD
                </motion.button>
              )}
            </AnimatePresence>
          </ErrorBoundary>

          {/* WAR ROOM INCIDENT HUD */}
          <AnimatePresence>
            {isWarRoomActive && (
              <WarRoomHUD
                targetNode={warRoomTargetNode}
                activePeers={activePeers}
                connectionId={connectionId}
                anomalyData={liveStats.anomalies.find(a => {
                  const name = typeof warRoomTargetNode === 'object' ? (warRoomTargetNode.name || warRoomTargetNode.id) : warRoomTargetNode;
                  return a.metric === name ||
                    (typeof a.explanation === 'string' && a.explanation.toLowerCase().includes(String(name).toLowerCase()));
                })}
                onExit={() => {
                  setIsWarRoomActive(false);
                  setWarRoomTargetNode(null);
                  if (graphRef.current?.resetView) {
                    graphRef.current.resetView(); // Optional: reset camera
                  }
                }}
              />
            )}
          </AnimatePresence>


          {/* LATENT SPACE HUD OVERLAY */}
          <ErrorBoundary fallback={null}>
            {(viewMode === 'globalLatent' || viewMode === 'latent') && (
              <LatentSpaceUIOverlay
                hudOnly={true}
                dataClusters={enrichedNodes || graphData?.nodes}
                schemaData={graphData}
                selectedNodeId={selectedNode?.id || hoveredNode?.id}
                liveStats={liveStats}
                timeValue={timeValue}
                onTimeChange={setTimeValue}
                currentLens={activeLens}
                hoveredEdge={hoveredEdge}
                connectionId={connectionId}
                onDrillDown={handleNodeDrillDown}
                insightPerspective={insightPerspective}
                setInsightPerspective={setInsightPerspective}
                onClose={() => {
                  if (viewMode === 'latent') handleNavigate('drilldown');
                  else handleNavigate('overview');
                }}
                onZoomIn={() => {
                  if (graphRef.current && graphRef.current.zoom) graphRef.current.zoom(0.8);
                }}
                onZoomOut={() => {
                  if (graphRef.current && graphRef.current.zoom) graphRef.current.zoom(1.2);
                }}
                onZoomReset={() => {
                  if (graphRef.current && graphRef.current.resetView) graphRef.current.resetView();
                }}
                onToggleLens={handleToggleLens}
                activeFilters={activeFilters}
                onFilterChange={(label, value) => {
                  setActiveFilters(prev => ({ ...prev, [label]: value }));
                }}
                multiSelectedNodes={multiSelectedNodes}
                setMultiSelectedNodes={setMultiSelectedNodes}
                showMultiConnections={showMultiConnections}
                setShowMultiConnections={setShowMultiConnections}
                onShareView={handleShareView}
              />
            )}
          </ErrorBoundary>


        </div>

        {/* Legend Layer */}
        {viewMode !== 'drilldown' && (
          <Legend layoutMode={activeLayoutMode} />
        )}

        <ErrorBoundary fallback={null}>
          <AgentStatusPanel />
        </ErrorBoundary>
        <ErrorBoundary fallback={null}>
          <VoiceControl
            onActionTriggered={handleAgentAction}
            uiContext={{
              currentView: viewMode,
              tableName: drillDownTable,
              connectionId: connectionId,
              isEvolution: evolutionMode,
              isChatOpen,
              availableTables: graphData.nodes.map(n => n.id).filter(id => id !== 'hub'),
              databaseMetrics: liveStats,
              neuralCoreStats: mlInsights
            }}
          />
        </ErrorBoundary>

        <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
          <div className="w-full h-full">
            {!connectionId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8 bg-black/40 border border-amber-500/30 rounded-2xl backdrop-blur-xl max-w-md">
                  <div className="text-amber-500 mb-4">
                    <span className="material-symbols-outlined text-6xl">database_off</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Active Session</h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Please connect to a database to access full intelligence and analytics capabilities.
                  </p>
                  <button
                    onClick={() => setShowConnectModal(true)}
                    className="px-6 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/30 rounded-lg text-xs font-bold uppercase transition-all"
                  >
                    Connect Database
                  </button>
                </div>
              </div>
            ) : (
              <>
                {viewMode === 'drilldown' && drillDownTable && (
                  <ErrorBoundary fallback={(err, reset) => <PanelError name="Drill Down" reset={reset} />}>
                    <DrillDownView
                      connectionId={connectionId}
                      tableName={drillDownTable}
                      onBack={handleBackToOverview}
                      onToggleLatent={handleToggleLatent}
                      initialShowSimulation={autoSimulate}
                    />
                  </ErrorBoundary>
                )}
                {viewMode === 'dataflow' && (
                  <ErrorBoundary fallback={(err, reset) => <PanelError name="Data Flow" reset={reset} />}>
                    <DataFlowView connectionId={connectionId} />
                  </ErrorBoundary>
                )}
                {viewMode === 'analytics' && (
                  <ErrorBoundary fallback={(err, reset) => <PanelError name="Analytics" reset={reset} />}>
                    <AnalyticsView connectionId={connectionId} graphData={graphData} mlInsights={mlInsights} gravitySuggestions={gravitySuggestions} />
                  </ErrorBoundary>
                )}
                {viewMode === 'vitals' && (
                  <ErrorBoundary fallback={(err, reset) => <PanelError name="System Vitals" reset={reset} />}>
                    <SystemVitalsDashboard />
                  </ErrorBoundary>
                )}
                {viewMode === 'schema' && (
                  <ErrorBoundary fallback={(err, reset) => <PanelError name="Schema" reset={reset} />}>
                    <SchemaView connectionId={connectionId} />
                  </ErrorBoundary>
                )}
                {viewMode === 'intelligence' && (
                  <ErrorBoundary fallback={(err, reset) => <PanelError name="Intelligence Hub" reset={reset} />}>
                    <IntelligenceHub connectionId={connectionId} selectedNode={selectedNode} />
                  </ErrorBoundary>
                )}
                {viewMode === 'lineage' && (
                  <ErrorBoundary fallback={(err, reset) => <PanelError name="Perspective Lineage" reset={reset} />}>
                    <PerspectiveLineageView
                      multiSelectedNodes={multiSelectedNodes}
                      setMultiSelectedNodes={setMultiSelectedNodes}
                      showMultiConnections={showMultiConnections}
                      setShowMultiConnections={setShowMultiConnections}
                      graphData={graphData}
                      insightPerspective={insightPerspective}
                      setInsightPerspective={setInsightPerspective}
                      activeFilters={activeFilters}
                      onFilterChange={(label, value) => {
                        setActiveFilters(prev => ({ ...prev, [label]: value }));
                      }}
                      connectionId={connectionId}
                      pinnedNodes={pinnedNodes}
                      setPinnedNodes={setPinnedNodes}
                      pinnedCols={pinnedCols}
                      setPinnedCols={setPinnedCols}
                      columnAliases={columnAliases}
                      setColumnAliases={setColumnAliases}
                    />
                  </ErrorBoundary>
                )}
              </>
            )}
          </div>
        </div>


        {/* REMOVED: Separate LatentGalaxy component. Now integrated into ThreeGraph for seamless transition */}

        <div className="relative z-[3000]">
          <AnimatePresence>
            {windows.map((w) => <Window key={w.id} {...w} />)}
          </AnimatePresence>
          {windows.length > 0 && <Taskbar />}
        </div>


        <AnimatePresence>
          {evolutionMode && (
            <>
              <TimelinePlayer connectionId={connectionId} onSnapshotUpdate={(snapshot) => { setCurrentSnapshot(snapshot); graphRef.current?.setEvolutionSnapshot(snapshot); }} onClose={() => setEvolutionMode(false)} />
              <EvolutionOverlay snapshot={currentSnapshot} />
              <EvolutionMathOverlay snapshot={currentSnapshot} />
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEvolutionMode(false)} className="fixed top-24 left-6 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold uppercase tracking-widest z-50 backdrop-blur-md">Exit Evolution Mode</motion.button>
            </>
          )}
        </AnimatePresence>

        <ErrorBoundary fallback={null}>
          <ChatInterface connectionId={connectionId} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        </ErrorBoundary>

        <AnimatePresence>
          {timeMachineOpen && (
            <ErrorBoundary fallback={null}>
              <TimeMachinePanel
                connectionId={connectionId}
                onSnapshotSelect={(fullData, meta) => {
                  setSnapshotData(fullData);
                  if (graphRef.current?.applySnapshot) {
                    graphRef.current.applySnapshot(fullData);
                  }
                }}
                onClose={() => {
                  setTimeMachineOpen(false);
                  setSnapshotData(null);
                }}
              />
            </ErrorBoundary>
          )}
        </AnimatePresence>
        <ErrorBoundary fallback={null}>
          {showConnectModal && <ConnectionModal onClose={() => setShowConnectModal(false)} />}
        </ErrorBoundary>

        {/* MULTIPLAYER CURSOR LAYER */}
        <RemoteCursors activePeers={activePeers} />

        {/* BACKGROUND PROCESS LOGS */}
        <GenerationLogPanel />
      </DashboardLayout>

    </>
  );
};

export default App;