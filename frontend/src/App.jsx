// Cleaned up App.jsx
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WindowManagerProvider, useWindowManager } from './context/WindowManagerContext';
import Window from './components/WindowManager/Window';
import Taskbar from './components/WindowManager/Taskbar';
import ConnectionModal from './components/WindowManager/ConnectionModal';
import Settings from './components/Apps/Settings'; // Still used in openWindow('settings')

// New Dashboard Imports
import ThreeGraph from './components/Dashboard/ThreeGraph';
import Record3DGraph from './components/Dashboard/Record3DGraph';
import DrillDownView from './components/Dashboard/DrillDownView';
import DataFlowView from './components/Dashboard/DataFlowView';
import AnalyticsView from './components/Dashboard/AnalyticsView';
import SchemaView from './components/Dashboard/SchemaView';
import ChatInterface from './components/Dashboard/ChatInterface'; // New Chat
import NavigationBar from './components/Layout/NavigationBar';
import DashboardLayout from './components/Layout/DashboardLayout';
import { Legend, CirclePackOverlay, StatsDashboard } from './components/Dashboard/UIOverlay';

const App = () => {
  return (
    <WindowManagerProvider>
      <MainDashboard />
    </WindowManagerProvider>
  );
};

const MainDashboard = () => {
  const { openWindow, windows, connectionId } = useWindowManager();
  const [selectedNode, setSelectedNode] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [showRecordGravity, setShowRecordGravity] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [graphData, setGraphData] = React.useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [rlActive, setRlActive] = useState(false);
  const [mlInsights, setMlInsights] = useState(null);
  const [gravitySuggestions, setGravitySuggestions] = React.useState([]);

  // Navigation state
  const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'drilldown' | 'dataflow' | 'analytics' | 'schema'
  const [drillDownTable, setDrillDownTable] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  const [liveStats, setLiveStats] = useState({
    totalTransactions: 0,
    fraudAlerts: 0,
    avgAmount: 0,
    failedTx: 0,
    tps: 0,
    activeNodes: 0,
    health: { state: 'healthy', score: 100, color: '#00ff88', issues: [] },
    anomalies: []
  });

  // WebSocket Connection for Real-time Monitoring
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
        setLiveStats(prev => ({
          ...prev,
          totalTransactions: metrics.total_transactions,
          fraudAlerts: metrics.fraud_alerts,
          avgAmount: metrics.average_amount,
          failedTx: metrics.failed_transactions,
          tps: metrics.transaction_rate,
          health: data.health || prev.health,
          anomalies: data.anomalies || prev.anomalies
        }));
      }
    };

    socket.onerror = (err) => console.error("WebSocket Error:", err);
    socket.onclose = () => console.warn("WebSocket Disconnected");

    return () => socket.close();
  }, [connectionId]);

  // Initial load check
  useEffect(() => {
    console.log('[App] Initial load check - connectionId:', connectionId);
    if (!connectionId) {
      // Show modal after a brief delay to let UI render
      setTimeout(() => {
        console.log('[App] Showing connection modal');
        setShowConnectModal(true);
      }, 500);
    } else {
      console.log('[App] ConnectionId exists, fetching graph data');
      fetchRealGraphData(connectionId);
    }
  }, [connectionId]);

  const fetchGravitySuggestions = React.useCallback(async (connId) => {
    try {
      const resp = await fetch(`/api/ai/gravity-suggestions/${connId}`);
      if (!resp.ok) throw new Error('Failed to fetch suggestions');
      const data = await resp.json();
      setGravitySuggestions(data.suggestions || []);
      console.log('[App] AI Gravity Suggestions:', data.suggestions);
    } catch (e) {
      console.error('[App] Failed to fetch gravity suggestions:', e);
    }
  }, []);

  const fetchRealGraphData = async (id) => {
    console.log('[App] fetchRealGraphData called with id:', id);
    setLoading(true);
    fetchGravitySuggestions(id);
    try {
      // Fetch from backend
      const url = `/api/graph/${id}`;
      console.log('[App] Fetching from:', url);
      const response = await fetch(url);
      console.log('[App] Response status:', response.status, response.ok);
      if (!response.ok) throw new Error('Failed to fetch graph');

      const rawData = await response.json();
      console.log('[App] Raw data received:', rawData);
      console.log('[App] Nodes count:', rawData.nodes?.length || 0);

      // --- Neural Core Integration logic ---
      if (rawData.neural_core) {
        setAiStatus(`Neural Core: ${rawData.neural_core.status.toUpperCase()} | Health: ${rawData.neural_core.health.state}`);

        // Update live stats from initial AI analysis
        if (rawData.neural_core.metrics) {
          const m = rawData.neural_core.metrics;
          setLiveStats(prev => ({
            ...prev,
            tps: m.transaction_rate || 0,
            fraudAlerts: m.fraud_alerts || 0,
            failedTx: m.failed_transactions || 0,
            health: rawData.neural_core.health || prev.health
          }));
        }
      } else {
        setAiStatus("Neural Core: Global Analysis Complete");
      }

      const nodesTransformed = (rawData.nodes || []).map((node, i) => {
        const x = typeof node.x === 'number' ? node.x : (Math.cos(i * 0.5) * (150 + i * 10));
        const y = typeof node.y === 'number' ? node.y : ((Math.random() - 0.5) * 200);
        const z = typeof node.z === 'number' ? node.z : (Math.sin(i * 0.5) * (150 + i * 10));

        // Derived for UIOverlay structure
        const columns = node.columns || [];
        const primary_keys = columns.filter(c => c.is_pk).map(c => c.name);
        const foreign_keys = columns.filter(c => c.is_fk).map(c => ({
          column: c.name,
          referenced_table: c.references || 'Unknown' // simplified
        }));

        const structure = {
          name: node.name,
          children: columns.map(col => ({
            name: col.name,
            type: col.is_pk ? 'PK' : (col.is_fk ? 'FK' : 'data'),
            value: 100
          }))
        };

        return {
          id: node.id,
          name: node.name,
          color: node.color ? parseInt(node.color.replace('#', '0x'), 16) : (node.group === 1 ? 0xfbbf24 : 0x22d3ee),
          size: node.size || (node.group === 1 ? 40 : 25),
          pos: [x, y, z],
          entity: node.entity || 'TABLE',
          rows: node.row_count ? node.row_count.toLocaleString() + ' Records' : 'Empty',
          metrics: node.metrics || [],
          columns: columns,
          primary_keys: primary_keys,
          foreign_keys: foreign_keys,
          structure: structure,

          // Neural Core Data
          vitality: node.vitality || 50,
          pulse_rate: node.pulse_rate || 1.0,
          glow_intensity: node.glow_intensity || 0.5,

          customMetrics: node.customMetrics || { // Add fallback if missing
            'Data Quality': `${Math.floor(Math.random() * 20 + 80)}%`,
            'Last Update': '2m ago'
          }
        };
      });

      const edgesTransformed = (rawData.edges || []).map(edge => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
        confidence: edge.confidence,
        trafficIntensity: edge.traffic_intensity || 0.3
      }));

      setGraphData({ nodes: nodesTransformed, edges: edgesTransformed });
      console.log('[App] Transformed data set, nodes:', nodesTransformed.length, 'edges:', edgesTransformed.length);
      setLiveStats(prev => ({ ...prev, activeNodes: nodesTransformed.length }));

      // Clear status after 5s
      setTimeout(() => setAiStatus(null), 5000);

    } catch (e) {
      console.error('[App] Error fetching graph data:', e);
      setAiStatus("Neural Core: Analysis Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node) => {
    console.log("Node clicked in App:", node);
    setSelectedNode(node);

    // Automatic Drill-Down: If it's a data node, open the Circle Pack overlay immediately
    if (node.id !== 'hub') {
      setViewMode('drilldown');
      setShowDrillDown(true); // Explicitly set showDrillDown to true to open CirclePackOverlay
    } else {
      // If hub is clicked, maybe just show stats or stay in graph
      setViewMode('graph');
      setShowDrillDown(false); // Ensure drilldown is closed if hub is clicked
    }

    // Real ML Insights derived from node properties
    setMlInsights({
      anomalyScore: node.vitality ? (100 - node.vitality) : Math.floor(Math.random() * 20),
      gravity: (node.importance_score || 0) > 0.8 ? 'High' : 'Normal',
      clusters: ['Neural Semantic Group']
    });
  };

  const handleDrillDown = React.useCallback((node) => {
    setShowDrillDown(true);
  }, []);

  const handleColumnClick = React.useCallback((columnName) => {
    setSelectedColumn(columnName);
    setShowRecordGravity(true);
  }, []);

  const handleToggleRL = async () => {
    setRlActive(!rlActive);
    // Call backend to toggle optimization
    try {
      await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rlActive, connection_id: connectionId })
      });
      if (!rlActive && connectionId) fetchRealGraphData(connectionId); // Refresh layout if enabling
    } catch (e) { console.error("RL Toggle Failed", e); }
  };

  const handleRecalculateGravity = () => {
    if (connectionId) {
      setAiStatus("Recalculating Intelligence Weights...");
      fetchGravitySuggestions(connectionId);
      // Clear status after 3s
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  // Navigation handlers
  const handleNavigate = (view) => {
    setViewMode(view);
    if (view === 'overview') {
      setBreadcrumbs([]);
      setDrillDownTable(null);
    }
  };

  const handleNodeDrillDown = (nodeId) => {
    setViewMode('drilldown');
    setDrillDownTable(nodeId);
    setBreadcrumbs([
      { label: 'Overview', onClick: () => handleNavigate('overview') },
      { label: `Table: ${nodeId}` }
    ]);
  };

  const handleBackToOverview = () => {
    setViewMode('overview');
    setDrillDownTable(null);
    setBreadcrumbs([]);
  };

  // Prepare sidebar props
  const sidebarProps = {
    actions: {
      loadSystem: () => { if (connectionId) fetchRealGraphData(connectionId); else setShowConnectModal(true); },
      toggleRL: handleToggleRL,
      rlActive: rlActive,
      recalculateGravity: handleRecalculateGravity
    },
    clusters: [ // Simulated clusters for now, will map to backend later
      { name: 'Accounts Cluster', nodeCount: 15, active: true },
      { name: 'Transaction Cluster', nodeCount: 42, active: false }
    ],
    onClusterClick: (cluster) => console.log("Clicked cluster", cluster),
    selectedNode: selectedNode,
    mlInsights: mlInsights
  };

  return (
    <DashboardLayout sidebarProps={sidebarProps}>
      {/* Navigation Bar */}
      <NavigationBar
        currentView={viewMode}
        onNavigate={handleNavigate}
        breadcrumbs={breadcrumbs}
      />

      {/* 1. Underlying 3D Graph (Background Layer) */}
      <ThreeGraph
        className="absolute inset-0 z-0"
        data={graphData}
        onNodeClick={(node) => {
          handleNodeClick(node);
          if (node && node.id) handleNodeDrillDown(node.id);
        }}
      />

      {/* 2. UI Overlay Layer (Interactive) */}
      <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">

        {/* Render StatsDashboard for Overview Mode */}
        {viewMode === 'overview' && (
          <div className="absolute top-4 right-4 z-50 pointer-events-auto">
            <StatsDashboard stats={liveStats} />
          </div>
        )}

        <div className="w-full h-full pointer-events-auto">
          {/* Conditional View Rendering */}
          {viewMode === 'overview' && (
            <>
              {/* Deep Dive Overlays */}
              <CirclePackOverlay
                node={selectedNode}
                visible={showDrillDown}
                onClose={() => setShowDrillDown(false)}
                onColumnClick={handleColumnClick}
              />

              {showRecordGravity && (
                <Record3DGraph
                  table={selectedNode?.name}
                  column={selectedColumn}
                  onClose={() => setShowRecordGravity(false)}
                />
              )}
            </>
          )}

          {viewMode === 'drilldown' && drillDownTable && (
            <DrillDownView
              connectionId={connectionId}
              tableName={drillDownTable}
              onBack={handleBackToOverview}
            />
          )}

          {viewMode === 'dataflow' && (
            <DataFlowView connectionId={connectionId} />
          )}

          {viewMode === 'analytics' && (
            <AnalyticsView
              connectionId={connectionId}
              mlInsights={mlInsights}
              gravitySuggestions={gravitySuggestions}
            />
          )}

          {viewMode === 'schema' && (
            <SchemaView connectionId={connectionId} />
          )}
        </div>
      </div>

      {/* 4. Window Manager Layer (Settings, Terminal) */}
      <div className="relative z-[3000]">
        <AnimatePresence>
          {windows.map((w) => (
            <Window key={w.id} {...w} />
          ))}
        </AnimatePresence>
        {windows.length > 0 && <Taskbar />}
      </div>

      {/* AI Status Notification */}
      <AnimatePresence>
        {aiStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[4001] px-6 py-3 bg-[var(--bg-elevated)] border border-[var(--primary-cyan)]/30 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.2)] flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--primary-cyan)] animate-ping" />
            <span className="text-xs font-bold tracking-wider text-white uppercase font-mono">{aiStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. AI Chat Interface */}
      <ChatInterface connectionId={connectionId} />

      {/* 6. Modals */}
      {showConnectModal && (
        <ConnectionModal
          onClose={() => setShowConnectModal(false)}
        />
      )}
    </DashboardLayout>
  );
};

const ConnectionManagerWrapper = ({ onClose }) => {
  return <ConnectionModal onClose={onClose} />;
};

export default App;
