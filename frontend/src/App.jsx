import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WindowManagerProvider, useWindowManager } from './context/WindowManagerContext';
import Window from './components/WindowManager/Window';
import Taskbar from './components/WindowManager/Taskbar';
import ConnectionModal from './components/WindowManager/ConnectionModal';
import Settings from './components/Apps/Settings';

// New Dashboard Imports
import ThreeGraph from './components/Dashboard/ThreeGraph';
import Record3DGraph from './components/Dashboard/Record3DGraph';
import DrillDownView from './components/Dashboard/DrillDownView';
import DataFlowView from './components/Dashboard/DataFlowView';
import AnalyticsView from './components/Dashboard/AnalyticsView';
import SchemaView from './components/Dashboard/SchemaView';
import ChatInterface from './components/Dashboard/ChatInterface';
import HealthDashboard from './components/Dashboard/HealthDashboard';
import IntelligenceHub from './components/Intelligence/IntelligenceHub';
import { LatentWorld } from './components/Dashboard/LatentWorld';

import NavigationBar from './components/Layout/NavigationBar';
import DashboardLayout from './components/Layout/DashboardLayout';
import { Legend, CirclePackOverlay, StatsDashboard } from './components/Dashboard/UIOverlay';
import VoiceControl from './components/Voice/VoiceControl';
import AgentStatusPanel from './components/Voice/AgentStatusPanel';
import { agentService } from './services/agentService';
import TimelinePlayer from './components/Evolution/TimelinePlayer';
import EvolutionOverlay from './components/Evolution/EvolutionOverlay';
import EvolutionMathOverlay from './components/Evolution/EvolutionMathOverlay';
import { CommandRegistryProvider, useCommandRegistry, useRegisterCommand } from './context/CommandRegistryContext';
import soundSystem from './utils/SoundSystem';
import { useWebSocket } from './hooks/useWebSocket';
import apiClient from './utils/apiClient';

// ============ HOVER INTERFACE: Intelligence Preview ============
const IntelligencePreview = ({ node }) => {
  if (!node) return null;
  return (
    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 p-4 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 shadow-2xl min-w-[320px]">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#' + (typeof node.color === 'number' ? node.color.toString(16).padStart(6, '0') : (node.color || '22d3ee').toString().replace('0x', '')) }}></div>
        <h3 className="text-lg font-bold tracking-tight">{node.name || node.id || 'Unknown Entity'}</h3>
        <span className="text-[10px] uppercase tracking-widest opacity-50 px-2 py-0.5 rounded border border-white/10 bg-white/5 font-mono">Heuristic Preview</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm font-light">
        <div>
          <p className="text-[10px] uppercase opacity-40 mb-1 tracking-wider">Vitality Score</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-1000" style={{ width: `${node.vitality || 100}%`, backgroundColor: (node.vitality < 40 ? '#ef4444' : (node.vitality < 70 ? '#fbbf24' : '#10b981')) }}></div>
            </div>
            <span className="font-mono text-xs">{Math.round(node.vitality || 100)}%</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase opacity-40 mb-1 tracking-wider">Neural Gravity</p>
          <p className="font-mono text-cyan-400 font-bold">{(node.neural_gravity || node.gravity_score || 1.0).toFixed(2)}G</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 text-sm font-light mt-2">
        <div>
          <p className="text-[10px] uppercase opacity-40 mb-1 tracking-wider">Ontology Class</p>
          <p className="font-bold text-white uppercase tracking-tighter">
            {node.entity || node.table_type || 'Unclassified'}
          </p>
        </div>
      </div>

      {node.avg_temperature && (
        <div className="mt-2 p-2 bg-slate-900/50 border border-slate-700/50 rounded space-y-2">

          {/* Temperature */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] uppercase opacity-60 tracking-wider text-orange-200">Temp</span>
              <span className={`text-xs font-bold font-mono ${node.avg_temperature > 45 ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}>
                {Number(node.avg_temperature).toFixed(1)}°C
              </span>
            </div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${node.avg_temperature > 45 ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(100, (node.avg_temperature / 60) * 100)}%` }}
              />
            </div>
          </div>

          {/* Voltage (if available) */}
          {node.avg_voltage && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] uppercase opacity-60 tracking-wider text-blue-200">Voltage</span>
                <span className="text-xs font-bold font-mono text-blue-400">{Number(node.avg_voltage).toFixed(1)}V</span>
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, (node.avg_voltage / 60) * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Current (if available) */}
          {node.avg_current && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] uppercase opacity-60 tracking-wider text-yellow-200">Current</span>
                <span className="text-xs font-bold font-mono text-yellow-400">{Number(node.avg_current).toFixed(1)}A</span>
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${Math.min(100, (node.avg_current / 20) * 100)}%` }} />
              </div>
            </div>
          )}

        </div>
      )}

      {node.decision_provenance && (
        <div className="mt-3 p-2 bg-white/5 rounded-lg border border-white/5">
          <p className="text-[9px] uppercase font-bold text-cyan-400/80 tracking-widest mb-1 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></span>
            Decision Provenance
          </p>
          <p className="text-[11px] text-gray-300 italic leading-snug">
            "{node.decision_provenance}"
          </p>
        </div>
      )}

      {(node.last_activity) && (
        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center text-[11px] opacity-60 italic font-mono">
          <span>Signal Quality: High</span>
          <span>{node.last_activity || 'Heartbeat Active'}</span>
        </div>
      )}
    </div>
  );
};

// Simple Error Boundary for Debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', position: 'fixed', top: 0, left: 0, zIndex: 999999, background: 'black', width: '100%', height: '100%' }}>
          <h1>Component Error</h1>
          <pre>{this.state.error && this.state.error.toString()}</pre>
          <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
          <button onClick={() => this.setState({ hasError: false })} style={{ padding: 10, marginTop: 20 }}>Dismiss</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  return (
    <WindowManagerProvider>
      <CommandRegistryProvider>
        <ErrorBoundary>
          <MainDashboard />
        </ErrorBoundary>
      </CommandRegistryProvider>
    </WindowManagerProvider>
  );
};

const MainDashboard = () => {
  const graphRef = React.useRef(null);
  const { openWindow, windows, connectionId } = useWindowManager();
  const { executeCommand } = useCommandRegistry(); // Use Registry for execution

  // ... (State definitions remain the same) ...
  const [selectedNode, setSelectedNode] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [showRecordGravity, setShowRecordGravity] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [graphData, setGraphData] = React.useState({ nodes: [], edges: [] });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [rlActive, setRlActive] = useState(false);
  const [clusteringMethod, setClusteringMethod] = useState('heuristic');
  const [mlInsights, setMlInsights] = useState(null);
  const [simUpdate, setSimUpdate] = useState(null); // Toast for simulation updates 
  const [gravitySuggestions, setGravitySuggestions] = React.useState([]);
  const [viewMode, setViewMode] = useState('overview');
  const [drillDownTable, setDrillDownTable] = useState(null);
  const [autoSimulate, setAutoSimulate] = useState(false);
  const [evolutionMode, setEvolutionMode] = useState(false);
  const [showIntelligenceHub, setShowIntelligenceHub] = useState(false);
  const [liveStats, setLiveStats] = useState({
    totalTransactions: 0, fraudAlerts: 0, avgAmount: 0, failedTx: 0, tps: 0, activeNodes: 0, health: { state: 'healthy', score: 100, color: '#00ff88', issues: [] }, anomalies: []
  });
  const [currentSnapshot, setCurrentSnapshot] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [activeLens, setActiveLens] = useState('ops'); // New Lens State
  const [activeLayoutMode, setActiveLayoutMode] = useState('galaxy'); // SAI Layout Mode
  const [hoveredNode, setHoveredNode] = useState(null); // Intelligence Preview State

  // Lens Switch Handler
  const handleToggleLens = React.useCallback((lens) => {
    console.log(`[App] Switching Lens to: ${lens}`);
    setActiveLens(lens);
    if (graphRef.current && graphRef.current.setLens) {
      graphRef.current.setLens(lens);
    }
  }, []);

  // SAI Layout Mode Handler
  const handleToggleLayoutMode = React.useCallback((mode) => {
    console.log(`[App] Switching Layout Mode to: ${mode}`);
    setActiveLayoutMode(mode);
    if (graphRef.current && graphRef.current.setLayoutMode) {
      graphRef.current.setLayoutMode(mode);
    }
  }, []);

  // --- REAL-TIME SYNC (WebSocket) ---
  const wsUrl = connectionId ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/${connectionId}` : null;
  const { isConnected: wsConnected, lastMessage } = useWebSocket(wsUrl);


  useEffect(() => {
    if (lastMessage && lastMessage.type === 'metrics_update') {
      const metrics = lastMessage.data;
      const aiStats = lastMessage.ai_stats || {};

      console.log("📡 [WS] Real-time Metrics Update:", metrics);

      setLiveStats(prev => ({
        ...prev,
        totalTransactions: metrics.total_transactions,
        fraudAlerts: metrics.fraud_alerts,
        avgAmount: metrics.average_amount,
        failedTx: metrics.failed_transactions,
        tps: metrics.transaction_rate,
        activeNodes: aiStats.total_nodes || prev.activeNodes,
        health: lastMessage.health || prev.health,
        anomalies: (lastMessage.anomalies || prev.anomalies || []).map(a => ({
          ...a,
          explanation: a.justification || a.explanation || a.description || a.message
        })),
        // Energy Extension
        activeBatteries: metrics.active_batteries || 0,
        onlineStations: metrics.online_stations || 0,
        networkHealth: metrics.network_health || 0,
        energyAlerts: metrics.energy_alerts || 0
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

        setSimUpdate(`🔋 Battery Update: ${temp}°C | ${volt}V | ${curr}A`);
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
  }, [lastMessage]);



  // Initial load check
  useEffect(() => {
    // Fetch System Config & Feature Flags
    apiClient.get('/agent/config')
      .then(config => {
        console.log("🛠️ System Config Loaded:", config);
        // Store in global window for easy debugging access
        window.SYSTEM_FEATURES = config.features;

        // If specific features are enabled, we might want to set initial state
        if (config.features?.USE_NLP_V2) console.log("🧠 NLP V2 Active");
        if (config.features?.USE_NETWORKX_GLOW) console.log("✨ NetworkX Glow Active");
      })
      .catch(err => console.error("Could not fetch system config:", err));

    if (!connectionId) setTimeout(() => setShowConnectModal(true), 500);
    else fetchRealGraphData(connectionId);
  }, [connectionId]);

  // Navigation handlers (Same as before)
  const handleNavigate = React.useCallback((view) => {
    console.log('[App] Navigation:', view);



    // Standard navigation
    if (view === 'intelligence') {
      setShowIntelligenceHub(true);
      return;
    }

    setViewMode(view);
    if (view === 'overview') {
      setBreadcrumbs([]);
      setDrillDownTable(null);
      if (graphRef.current) {
        console.log("[App] Resetting graph view on navigation to overview");
        graphRef.current.resetView();
      }
    }
  }, []);

  const handleNodeDrillDown = React.useCallback((nodeId, shouldSimulate = false) => {
    // CINEMATIC TRANSITION: Zoom in first if we are in overview
    if (viewMode === 'overview' && graphRef.current) {
      graphRef.current.highlightNode(nodeId);
      setAiStatus(`Neural Core: Drilling into ${nodeId}...`);

      // Wait for camera to arrive (1.2s) before unmounting graph
      setTimeout(() => {
        setViewMode('drilldown');
        setDrillDownTable(nodeId);
        setAutoSimulate(shouldSimulate);
        setAiStatus(null);
      }, 1200);
    } else {
      // Direct switch if already in another view or graph not ready
      setViewMode('drilldown');
      setDrillDownTable(nodeId);
      setAutoSimulate(shouldSimulate);
    }

    setBreadcrumbs([{ label: 'Overview', onClick: () => handleNavigate('overview') }, { label: `Table: ${nodeId}` }]);
  }, [handleNavigate, viewMode]);

  // Effect to ensure graph is reset whenever we return to overview
  useEffect(() => {
    if (viewMode === 'overview' && graphRef.current) {
      console.log("🔄 [App] Auto-resetting graph view for Overview");
      graphRef.current.resetView();
    }
  }, [viewMode]);

  const handleBackToOverview = React.useCallback(() => {
    setViewMode('overview');
    setDrillDownTable(null);
    setBreadcrumbs([]);
  }, []);

  // Sync Graph Mode with View Mode
  useEffect(() => {
    if (graphRef.current) {
      if (viewMode === 'globalLatent') {
        console.log("[App] Switching Graph to Latent Mode");
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
      setViewMode(nextView);
    } else {
      // Default global toggle
      setViewMode(prev => prev === 'globalLatent' ? 'overview' : 'globalLatent');
    }
  }, [viewMode]);

  const fetchGravitySuggestions = React.useCallback(async (connId) => {
    try {
      const resp = await fetch(`/api/ai/gravity-suggestions/${connId}`);
      const data = await resp.json();
      setGravitySuggestions(data.suggestions || []);
    } catch (e) { console.error('Failed to fetch gravity suggestions:', e); }
  }, []);

  const fetchRealGraphData = React.useCallback(async (id) => {
    // V17 Load Guard: Only show global loading on first mount or empty state
    if (!graphData.nodes || graphData.nodes.length === 0) setLoading(true);
    fetchGravitySuggestions(id);
    try {
      const rawData = await apiClient.get(`/graph/${id}`);
      // if (!resp.ok) throw new Error('Failed to fetch graph'); // Axios handles this
      // const rawData = await resp.json(); // Axios returns data directly
      console.log(`[App] 📥 Graph Data Received from Backend:`, rawData);
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
          vitality: node.vitality || 50,
          pulse_rate: node.pulse_rate || 1.0,
          glow_intensity: node.node_glow || 0.5,
          node_glow: node.node_glow || 1.0,
          importance_score: node.importance_score || 1.0,
          cluster: node.cluster, // [FIX] Preserve cluster property for coloring
          foreign_keys: node.foreign_keys || [],
          customMetrics: node.customMetrics || {}
        };
      });
      const edgesTransformed = (rawData.edges || []).map(e => ({
        source: e.source,
        target: e.target,
        type: e.type,
        confidence: e.confidence,
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
  }, [fetchGravitySuggestions, graphData.nodes.length]);

  const handleNodeClick = React.useCallback((node) => {
    setSelectedNode(node);
    if (node.id !== 'hub') handleNodeDrillDown(node.id); else setShowDrillDown(false);
    setMlInsights(prev => ({ ...prev, anomalyScore: node.vitality ? (100 - node.vitality) : 0, gravity: (node.importance_score || 0) > 0.8 ? 'High' : 'Normal' }));
  }, [handleNodeDrillDown]);

  const handleColumnClick = React.useCallback((col) => { setSelectedColumn(col); setShowRecordGravity(true); }, []);

  const handleToggleRL = useCallback(async () => {
    setRlActive(prev => {
      const next = !prev;
      fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next, connection_id: connectionId, method: clusteringMethod })
      })
        .then(() => { if (connectionId) fetchRealGraphData(connectionId); })
        .catch(e => console.error("RL Toggle Failed", e));
      return next;
    });
  }, [connectionId, clusteringMethod, fetchRealGraphData]);

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
        console.log(`[App] Already in drilldown for ${target}. Triggering deep analysis.`);
        // Note: The specific viewer (DrillDownView) will also catch this via its own registration
        // but we can add global logic here if needed.
      } else {
        console.log(`[App] Navigating to DrillDown: ${target}`);
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

  useRegisterCommand('graph_evolution', handleEvolution);
  useRegisterCommand('ui_navigation', handleNav);
  useRegisterCommand('analytics', handleAnalyticsCmd);
  useRegisterCommand('ui_audio', handleAudioCmd);

  const toggleClusteringMethod = useCallback(async () => {
    const newMethod = clusteringMethod === 'heuristic' ? 'networkx' : 'heuristic';
    setClusteringMethod(newMethod);
    if (rlActive) {
      try {
        await apiClient.post('/ai/optimize', {
          active: true, connection_id: connectionId, method: newMethod
        });
        /*
        await fetch('/api/ai/optimize', {
        method: 'POST',
      headers: {'Content-Type': 'application/json' },
      body: JSON.stringify({active: true, connection_id: connectionId, method: newMethod })
        });
      */
        if (connectionId) fetchRealGraphData(connectionId);
      } catch (e) { console.error("Failed to update clustering", e); }
    }
  }, [clusteringMethod, rlActive, connectionId, fetchRealGraphData]);

  const handleRecalculateGravity = () => { if (connectionId) { setAiStatus("Recalculating Intelligence Weights..."); fetchGravitySuggestions(connectionId); setTimeout(() => setAiStatus(null), 3000); } };

  const sidebarProps = {
    actions: { loadSystem: () => { if (connectionId) fetchRealGraphData(connectionId); else setShowConnectModal(true); }, toggleRL: handleToggleRL, rlActive, clusteringMethod, toggleClusteringMethod, recalculateGravity: handleRecalculateGravity },
    clusters: mlInsights?.clusters || [],
    onClusterClick: console.log,
    selectedNode,
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

    console.log(`[App] Dispatching Agent Action via Registry: ${action_type}/${instruction}`);

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

  return (
    <DashboardLayout sidebarProps={sidebarProps}>
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
      />

      {/* SIMULATION TOAST */}
      {simUpdate && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 border border-green-500/50 text-green-400 px-6 py-3 rounded-full shadow-lg backdrop-blur-md animate-bounce">
          <span className="text-lg font-mono font-bold">{simUpdate}</span>
        </div>
      )}

      {/* PERSISTENT GRAPH LAYER - Stays mounted to prevent "Cold Start" clumping */}
      <div
        className={`fixed inset-0 transition-all duration-1000 ease-in-out ${viewMode === 'overview' || viewMode === 'analytics' || viewMode === 'globalLatent'
          ? 'opacity-100'
          : 'opacity-0 pointer-events-none'
          }`}
        style={{ zIndex: 0 }}
      >
        <ThreeGraph
          ref={graphRef}
          data={graphData}
          tps={liveStats.tps}
          onNodeClick={handleNodeClick}
          onNodeHover={setHoveredNode}
          activeLens={activeLens}
          clusteringMethod={clusteringMethod} // [FIX] Pass clustering method for visual updates
          paused={viewMode !== 'overview' && viewMode !== 'analytics' && viewMode !== 'globalLatent'} // [FIX] Stop rendering when hidden
        />
      </div>
      <IntelligencePreview node={hoveredNode} />
      <AgentStatusPanel />
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

      <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
        <div className="w-full h-full">
          {/* These overlays are now always rendered, but their visibility is controlled by their own props */}
          <CirclePackOverlay node={selectedNode} visible={showDrillDown && viewMode === 'overview'} onClose={() => setShowDrillDown(false)} onColumnClick={handleColumnClick} />
          {showRecordGravity && <Record3DGraph table={selectedNode?.name} column={selectedColumn} onClose={() => setShowRecordGravity(false)} />}

          {viewMode === 'drilldown' && drillDownTable && (
            <DrillDownView
              connectionId={connectionId}
              tableName={drillDownTable}
              onBack={handleBackToOverview}
              onToggleLatent={handleToggleLatent}
              initialShowSimulation={autoSimulate}
            />
          )}
          {viewMode === 'dataflow' && <DataFlowView connectionId={connectionId} />}
          {viewMode === 'analytics' && <AnalyticsView connectionId={connectionId} graphData={graphData} mlInsights={mlInsights} gravitySuggestions={gravitySuggestions} />}
          {viewMode === 'vitals' && <HealthDashboard />}
          {viewMode === 'schema' && <SchemaView connectionId={connectionId} />}
        </div>
      </div>

      {/* Latent World rendered outside the pointer-events-none container for full interactivity */}
      {viewMode === 'latent' && (
        <LatentWorld
          key={`latent-${selectedNode?.id || 'none'}`}
          targetNode={selectedNode}
          onClose={handleToggleLatent}
          schemaData={graphData}
          connectionId={connectionId}
        />
      )}

      {/* REMOVED: Separate LatentGalaxy component. Now integrated into ThreeGraph for seamless transition */}

      <div className="relative z-[3000]">
        <AnimatePresence>
          {windows.map((w) => <Window key={w.id} {...w} />)}
        </AnimatePresence>
        {windows.length > 0 && <Taskbar />}
      </div>

      <AnimatePresence>
        {aiStatus && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[4001] px-6 py-3 bg-[var(--bg-elevated)] border border-[var(--primary-cyan)]/30 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.2)] flex items-center gap-3 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-[var(--primary-cyan)] animate-ping" />
            <span className="text-xs font-bold tracking-wider text-white uppercase font-mono">{aiStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

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

      {showIntelligenceHub && (
        <IntelligenceHub
          connectionId={connectionId}
          onClose={() => setShowIntelligenceHub(false)}
        />
      )}

      <ChatInterface connectionId={connectionId} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      {showConnectModal && <ConnectionModal onClose={() => setShowConnectModal(false)} />}
    </DashboardLayout >
  );
};

export default App;
