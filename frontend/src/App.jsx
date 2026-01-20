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

const App = () => {
  return (
    <WindowManagerProvider>
      <CommandRegistryProvider>
        <MainDashboard />
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
  const [gravitySuggestions, setGravitySuggestions] = React.useState([]);
  const [viewMode, setViewMode] = useState('overview');
  const [drillDownTable, setDrillDownTable] = useState(null);
  const [autoSimulate, setAutoSimulate] = useState(false);
  const [evolutionMode, setEvolutionMode] = useState(false);
  const [liveStats, setLiveStats] = useState({
    totalTransactions: 0, fraudAlerts: 0, avgAmount: 0, failedTx: 0, tps: 0, activeNodes: 0, health: { state: 'healthy', score: 100, color: '#00ff88', issues: [] }, anomalies: []
  });
  const [currentSnapshot, setCurrentSnapshot] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);


  // WebSocket Connection (Same as before)
  useEffect(() => {
    if (!connectionId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://localhost:8001/ws/${connectionId}`;
    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'metrics_update') {
        const metrics = data.data;
        const aiStats = data.ai_stats || {};
        setLiveStats(prev => ({
          ...prev,
          totalTransactions: metrics.total_transactions,
          fraudAlerts: metrics.fraud_alerts,
          avgAmount: metrics.average_amount,
          failedTx: metrics.failed_transactions,
          tps: metrics.transaction_rate,
          activeNodes: aiStats.total_nodes || prev.activeNodes,
          health: data.health || prev.health,
          anomalies: data.anomalies || prev.anomalies
        }));
        if (aiStats.status) setAiStatus(`Neural Core: ${aiStats.status} | Scanned: ${aiStats.scanned_nodes || 0}/${aiStats.total_nodes || 0}`);
        setMlInsights(prev => ({ ...prev, anomalyScore: (100 - (data.health?.score || 100)).toFixed(0), gravity: aiStats.avg_gravity ? `${aiStats.avg_gravity.toFixed(2)}x` : '1.0x', optimization: 'Active' }));
        if (selectedNode?.id === 'hub' && aiStats.patterns !== undefined) {
          setSelectedNode(prev => ({ ...prev, customMetrics: { 'Patterns Learned': aiStats.patterns, 'Core Growth': `${aiStats.growth}x`, 'Signal Load': aiStats.signal_load } }));
        }
      }
    };
    return () => socket.close();
  }, [connectionId]);

  // Initial load check (Same as before)
  useEffect(() => {
    if (!connectionId) setTimeout(() => setShowConnectModal(true), 500);
    else fetchRealGraphData(connectionId);
  }, [connectionId]);

  // Navigation handlers (Same as before)
  const handleNavigate = React.useCallback((view) => {
    setViewMode(view);
    if (view === 'overview') { setBreadcrumbs([]); setDrillDownTable(null); }
  }, []);

  const handleNodeDrillDown = React.useCallback((nodeId, shouldSimulate = false) => {
    setViewMode('drilldown'); setDrillDownTable(nodeId);
    setAutoSimulate(shouldSimulate);
    setBreadcrumbs([{ label: 'Overview', onClick: () => handleNavigate('overview') }, { label: `Table: ${nodeId}` }]);
  }, [handleNavigate]);

  const handleBackToOverview = React.useCallback(() => { setViewMode('overview'); setDrillDownTable(null); setBreadcrumbs([]); }, []);

  const fetchGravitySuggestions = React.useCallback(async (connId) => {
    try {
      const resp = await fetch(`/api/ai/gravity-suggestions/${connId}`);
      const data = await resp.json();
      setGravitySuggestions(data.suggestions || []);
    } catch (e) { console.error('Failed to fetch gravity suggestions:', e); }
  }, []);

  const fetchRealGraphData = React.useCallback(async (id) => {
    setLoading(true); fetchGravitySuggestions(id);
    try {
      const resp = await fetch(`/api/graph/${id}`);
      if (!resp.ok) throw new Error('Failed to fetch graph');
      const rawData = await resp.json();
      if (rawData.neural_core) {
        const core = rawData.neural_core;
        setAiStatus(`Neural Core: ${core.ai_stats?.status || 'ACTIVE'} | Scanned: ${core.ai_stats?.scanned_nodes || 0}/${core.ai_stats?.total_nodes || 0}`);
        setLiveStats(prev => ({ ...prev, tps: core.metrics?.transaction_rate || 0, fraudAlerts: core.metrics?.fraud_alerts || 0, failedTx: core.metrics?.failed_transactions || 0, avgAmount: core.metrics?.average_amount || 0, activeNodes: core.ai_stats?.total_nodes || rawData.nodes.length, health: core.health || prev.health }));
        const clusterMap = {};
        rawData.nodes.forEach(node => { if (node.cluster && node.name !== 'Neural Core') { if (!clusterMap[node.cluster]) clusterMap[node.cluster] = []; clusterMap[node.cluster].push(node.name); } });
        const clusterDetails = Object.keys(clusterMap).map(c => ({ name: c, tables: clusterMap[c], count: clusterMap[c].length }));
        setMlInsights({ anomalyScore: (100 - (core.health?.score || 100)).toFixed(0), gravity: core.ai_stats?.avg_gravity ? `${core.ai_stats.avg_gravity.toFixed(2)}x` : '1.0x', optimization: 'Active', clusters: clusterDetails.length > 0 ? clusterDetails : null });
      } else { setAiStatus("Neural Core: Global Analysis Complete"); }

      const nodesTransformed = (rawData.nodes || []).map((node, i) => ({
        id: node.id, name: node.name, color: node.color || (node.group === 1 ? 0xfbbf24 : 0x22d3ee), size: node.size || (node.group === 1 ? 40 : 25),
        pos: [node.x || Math.cos(i * 0.5) * (150 + i * 10), node.y || (Math.random() - 0.5) * 200, node.z || Math.sin(i * 0.5) * (150 + i * 10)],
        entity: node.entity || 'TABLE', rows: node.row_count ? node.row_count.toLocaleString() + ' Records' : 'Empty', metrics: node.metrics || [],
        columns: node.columns || [], vitality: node.vitality || 50, pulse_rate: node.pulse_rate || 1.0, glow_intensity: node.glow_intensity || 0.5,
        customMetrics: node.customMetrics || { 'Data Quality': '95%', 'Last Update': '2m ago' }
      }));
      const edgesTransformed = (rawData.edges || []).map(e => ({ source: e.source, target: e.target, type: e.type, confidence: e.confidence, trafficIntensity: e.traffic_intensity || 0.3 }));
      setGraphData({ nodes: nodesTransformed, edges: edgesTransformed });
      setLiveStats(prev => ({ ...prev, activeNodes: nodesTransformed.length }));
      setTimeout(() => setAiStatus(null), 5000);
    } catch (e) { console.error('Error fetching graph data:', e); setAiStatus("Neural Core: Analysis Failed"); } finally { setLoading(false); }
  }, [fetchGravitySuggestions]);

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
        await fetch('/api/ai/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true, connection_id: connectionId, method: newMethod })
        });
        if (connectionId) fetchRealGraphData(connectionId);
      } catch (e) { console.error("Failed to update clustering", e); }
    }
  }, [clusteringMethod, rlActive, connectionId, fetchRealGraphData]);

  const handleRecalculateGravity = () => { if (connectionId) { setAiStatus("Recalculating Intelligence Weights..."); fetchGravitySuggestions(connectionId); setTimeout(() => setAiStatus(null), 3000); } };

  const sidebarProps = {
    actions: { loadSystem: () => { if (connectionId) fetchRealGraphData(connectionId); else setShowConnectModal(true); }, toggleRL: handleToggleRL, rlActive, clusteringMethod, toggleClusteringMethod, recalculateGravity: handleRecalculateGravity },
    clusters: [{ name: 'Accounts Cluster', nodeCount: 15, active: true }, { name: 'Transaction Cluster', nodeCount: 42, active: false }],
    onClusterClick: console.log, selectedNode, mlInsights, liveStats, flows: []
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
    }
  }, [executeCommand]);

  return (
    <DashboardLayout sidebarProps={sidebarProps}>
      <NavigationBar currentView={viewMode} onNavigate={handleNavigate} breadcrumbs={breadcrumbs} onToggleChat={() => setIsChatOpen(!isChatOpen)} isChatOpen={isChatOpen} />

      <ThreeGraph ref={graphRef} className="absolute inset-0 z-0" data={graphData} onNodeClick={handleNodeClick} />
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
          {viewMode === 'overview' && (
            <>
              <CirclePackOverlay node={selectedNode} visible={showDrillDown} onClose={() => setShowDrillDown(false)} onColumnClick={handleColumnClick} />
              {showRecordGravity && <Record3DGraph table={selectedNode?.name} column={selectedColumn} onClose={() => setShowRecordGravity(false)} />}
            </>
          )}
          {viewMode === 'drilldown' && drillDownTable && (
            <DrillDownView
              connectionId={connectionId}
              tableName={drillDownTable}
              onBack={handleBackToOverview}
              initialShowSimulation={autoSimulate}
            />
          )}
          {viewMode === 'dataflow' && <DataFlowView connectionId={connectionId} />}
          {viewMode === 'analytics' && <AnalyticsView connectionId={connectionId} mlInsights={mlInsights} gravitySuggestions={gravitySuggestions} />}
          {viewMode === 'schema' && <SchemaView connectionId={connectionId} />}
        </div>
      </div>

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

      <ChatInterface connectionId={connectionId} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      {showConnectModal && <ConnectionModal onClose={() => setShowConnectModal(false)} />}
    </DashboardLayout>
  );
};

const ConnectionManagerWrapper = ({ onClose }) => <ConnectionModal onClose={onClose} />;

export default App;
