import React, { useRef, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { WindowManagerProvider } from './context/WindowManagerContext';
import Window from './components/WindowManager/Window';
import Taskbar from './components/WindowManager/Taskbar';
import ConnectionModal from './components/WindowManager/ConnectionModal';
import { CommandRegistryProvider } from './context/CommandRegistryContext';
import { useDashboard } from './hooks/useDashboard';

const ThreeGraph = lazy(() => import('./components/Dashboard/ThreeGraph'));
const ThreeGraphSpinExpand = lazy(() => import('./components/Dashboard/ThreeGraphSpinExpand'));
import DrillDownView from './components/Dashboard/DrillDownView';
import DataFlowView from './components/Dashboard/DataFlowView';
import AnalyticsView from './components/Dashboard/AnalyticsView';
import SchemaView from './components/Dashboard/SchemaView';
import ChatInterface from './components/Dashboard/ChatInterface';
const PerspectiveLineageView = lazy(() => import('./components/Dashboard/PerspectiveLineageView'));
import SystemVitalsDashboard from './components/Dashboard/SystemVitalsDashboard';
import IntelligenceHub from './components/Intelligence/IntelligenceHub';
import { LatentWorld, LatentSpaceUIOverlay } from './components/Dashboard/LatentSpaceLogic.jsx';
import { GraphOverlaySkeleton } from './components/Dashboard/LoadingSkeleton';
import EdgeStatsPanel from './components/Dashboard/EdgeStatsPanel';
import LineageInsightHUD from './components/Dashboard/LineageInsightHUD';
import WarRoomHUD from './components/Incident/WarRoomHUD';
import { GenerationLogPanel } from './components/Dashboard/GenerationLogPanel';
import NavigationBar from './components/Layout/NavigationBar';
import DashboardLayout from './components/Layout/DashboardLayout';
import { Legend } from './components/Dashboard/UIOverlay';
import GraphControlsToolbar from './components/Dashboard/GraphControlsToolbar';
import GraphCanvasHUD from './components/Dashboard/GraphCanvasHUD';
import VoiceControl from './components/Voice/VoiceControl';
import TimelinePlayer from './components/Evolution/TimelinePlayer';
import EvolutionOverlay from './components/Evolution/EvolutionOverlay';
import EvolutionMathOverlay from './components/Evolution/EvolutionMathOverlay';
import TimeMachinePanel from './components/Panels/TimeMachinePanel';
import LoginPage from './components/Auth/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import { cn } from './utils/cn';
import RemoteCursors from './components/Multiplayer/RemoteCursors';
import { logger } from './utils/logger';
import { useVoiceSystems } from './hooks/useVoiceSystems';

const AppCrashScreen = React.memo(() => (
  <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
    <h1 className="text-2xl font-bold text-white mb-2">Critical System Failure</h1>
    <button onClick={() => window.location.reload()} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold mt-6">Reload</button>
  </div>
));

const PanelError = React.memo(({ name, reset }) => (
  <div className="p-6 bg-black/40 border border-rose-500/20 rounded-xl m-4">
    <div className="flex items-center gap-3 text-rose-400 mb-2"><span className="material-symbols-outlined">warning</span><h4 className="font-bold">{name} Error</h4></div>
    <button onClick={reset} className="text-[10px] text-rose-400 font-bold uppercase tracking-widest hover:text-rose-300">Re-initialize</button>
  </div>
));

const ThreeGraphFallback = React.memo(({ reset }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-black/40">
    <h3 className="text-lg font-bold text-white mb-2">3D Visualization Offline</h3>
    <button onClick={reset} className="px-6 py-2 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-xs font-bold uppercase">Restart Engine</button>
  </div>
));

const App = () => (
  <ErrorBoundary fallback={<AppCrashScreen />}>
    <WindowManagerProvider>
      <CommandRegistryProvider>
        <MainDashboard />
      </CommandRegistryProvider>
    </WindowManagerProvider>
  </ErrorBoundary>
);

const MainDashboard = () => {
  const graphRef = useRef(null);
  const d = useDashboard(graphRef);

  const uiContext = React.useMemo(() => ({
    currentView: d.viewMode,
    tableName: d.drillDownTable,
    connectionId: d.connectionId,
    isEvolution: d.evolutionMode,
    isChatOpen: d.isChatOpen,
    availableTables: d.graphData?.nodes?.map((n) => n.id).filter((id) => id !== 'hub'),
    databaseMetrics: d.liveStats,
    neuralCoreStats: d.mlInsights,
    nodes: d.graphData?.nodes
  }), [
    d.viewMode, d.drillDownTable, d.connectionId, d.evolutionMode,
    d.isChatOpen, d.graphData?.nodes, d.liveStats, d.mlInsights
  ]);

  const voiceSystems = useVoiceSystems(d.handleAgentAction, uiContext);

  if (d.isCheckingAuth) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><div className="animate-spin h-8 w-8 text-blue-500" /></div>;
  if (!d.isAuthenticated) return <LoginPage onLoginSuccess={d.login} />;

  return (
    <>
      <DashboardLayout
        sidebarProps={d.sidebarProps} timeValue={d.timeValue}
        onTimeChange={(d.viewMode === 'latent' || d.viewMode === 'globalLatent') ? d.setTimeValue : null}
        isInspectorActive={d.isInspectorActive}
        navbar={
          <NavigationBar currentView={d.viewMode} onNavigate={d.handleNavigate} breadcrumbs={d.breadcrumbs}
            onToggleChat={() => d.setIsChatOpen(!d.isChatOpen)} isChatOpen={d.isChatOpen}
            activeLens={d.activeLens} onToggleLens={d.handleToggleLens}
            perspective={d.insightPerspective} onTogglePerspective={d.toggleInsightPerspective}
            onShareView={d.handleShareView} activePeers={d.activePeers} persona={d.persona}
            isWarRoomActive={d.isWarRoomActive}
          />
        }
      >
        {d.simUpdate && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 border border-green-500/50 text-green-400 px-6 py-3 rounded-full backdrop-blur-md animate-bounce">
            <span className="text-lg font-mono font-bold">{d.simUpdate}</span>
          </div>
        )}

        <div className={cn('absolute inset-0 transition-all duration-1000', ['overview', 'analytics', 'globalLatent', 'latent'].includes(d.viewMode) ? 'opacity-100' : 'opacity-0 pointer-events-none')} style={{ zIndex: 0 }}>
          {/* Graph canvas depth vignette */}
          <div className="graph-vignette absolute inset-0 pointer-events-none z-[2]" />

          {/* Canvas HUD: corner brackets, lens badge, live stats */}
          <GraphCanvasHUD
            graphData={d.graphData}
            activeLens={d.activeLens}
            layoutMode={d.activeLayoutMode}
            visible={!d.loading && !!d.graphData?.nodes?.length && !d.isInspectorActive}
          />

          {d.loading && <GraphOverlaySkeleton />}
          <ErrorBoundary key={d.threeGraphKey} fallback={(_, reset) => <ThreeGraphFallback reset={() => { reset(); d.incrementThreeGraphKey(); }} />} onError={(err) => logger.error('3D engine crashed:', err)}>
            <Suspense fallback={<GraphOverlaySkeleton />}>
              {d.resolvedGraphLayoutMode === 'spin_expand' ? (
                <ThreeGraphSpinExpand ref={graphRef} data={d.graphData}
                  onNodeClick={d.handleNodeClick} onNodeHover={d.setHoveredNode}
                  onEdgeHover={(edge) => { d.setHoveredEdge(edge); if (edge) d.setHoveredEdgePos(edge.mousePos); }}
                  activeLens={d.activeLens}
                  showPKs={d.showPKs} showFKs={d.showFKs}
                  singleNodeViewEnabled={d.singleNodeViewEnabled}
                  connectionId={d.connectionId}
                  isInspectorActive={d.isInspectorActive}
                  setIsInspectorActive={d.setIsInspectorActive}
                  className="absolute inset-0 z-0"
                />
              ) : (
                <ThreeGraph ref={graphRef} data={d.graphData} initialCameraState={d.initialCameraState.current}
                  tps={d.liveStats.tps} onNodeClick={d.handleNodeClick} onNodeHover={d.setHoveredNode}
                  onEdgeHover={(edge) => { d.setHoveredEdge(edge); if (edge) d.setHoveredEdgePos(edge.mousePos); }}
                  layoutMode={d.resolvedGraphLayoutMode} activeLens={d.activeLens} activeFilters={d.activeFilters}
                  multiSelectedNodes={d.multiSelectedNodes} showMultiConnections={d.showMultiConnections}
                  showPKs={d.showPKs} showFKs={d.showFKs}
                />
              )}
            </Suspense>
          </ErrorBoundary>

          <AnimatePresence>
            {d.aiStatus && !d.isInspectorActive && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-4 left-4 z-[4001] px-3 py-1 bg-[var(--bg-elevated)]/60 border border-[var(--primary-cyan)]/20 rounded-full flex items-center gap-2 backdrop-blur-md">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-cyan)] animate-ping" />
                <span className="text-[9px] font-bold tracking-wider text-white uppercase font-mono">{d.aiStatus}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <ErrorBoundary fallback={null}>
            <EdgeStatsPanel edge={d.pinnedEdge || d.hoveredEdge} position={d.hoveredEdgePos}
              visible={!d.isHudMinimized && !!(d.pinnedEdge || d.hoveredEdge) && !['latent', 'globalLatent'].includes(d.viewMode) && !d.isSidebarPanelActive}
              isPinned={!!d.pinnedEdge} onPin={() => d.setPinnedEdge(d.pinnedEdge ? null : d.hoveredEdge)}
              onClose={() => { d.setPinnedEdge(null); d.setHoveredEdge(null); d.setIsHudMinimized(true); }}
            />
          </ErrorBoundary>

          <ErrorBoundary fallback={null}>
            <LineageInsightHUD hoveredNode={d.hoveredNode}
              selectedNode={d.graphData.nodes?.find((n) => n.id === d.pinnedNodeId) || d.selectedNode}
              pinnedNodeId={d.pinnedNodeId} onPin={(id) => d.setPinnedNodeId(d.pinnedNodeId === id ? null : id)}
              onClose={() => { d.setPinnedNodeId(null); d.setSelectedNode(null); d.setHoveredNode(null); d.setIsHudMinimized(true); }}
              multiSelectedNodes={d.multiSelectedNodes} graphData={d.graphData} perspective={d.insightPerspective}
              onEnterWarRoom={(nodeId) => { d.activateWarRoom(nodeId); graphRef.current?.highlightNode?.(nodeId); }}
              visible={!d.isHudMinimized && (!d.hoveredEdge || d.pinnedNodeId) && !d.isSidebarPanelActive}
            />
          </ErrorBoundary>

          <AnimatePresence>
            {d.isHudMinimized && !d.isInspectorActive && (
              <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                onClick={() => d.setIsHudMinimized(false)}
                className="fixed top-[100px] left-[92px] p-2 bg-[var(--bg-elevated)]/80 border border-[var(--primary-cyan)]/30 rounded-lg flex items-center gap-2 text-[var(--primary-cyan)] font-bold text-[10px] uppercase tracking-widest backdrop-blur-md z-[5001]">
                <Activity size={14} className="animate-pulse" /> Restore HUD
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {d.isWarRoomActive && (
              <WarRoomHUD targetNode={d.warRoomTargetNode} activePeers={d.activePeers} connectionId={d.connectionId}
                anomalyData={d.liveStats.anomalies.find((a) => { const name = typeof d.warRoomTargetNode === 'object' ? (d.warRoomTargetNode.name || d.warRoomTargetNode.id) : d.warRoomTargetNode; return a.metric === name || (typeof a.explanation === 'string' && a.explanation.toLowerCase().includes(String(name).toLowerCase())); })}
                onExit={() => { d.deactivateWarRoom(); graphRef.current?.resetView?.(); }}
              />
            )}
          </AnimatePresence>

          {/* Production-grade floating graph controls */}
          {!['globalLatent', 'latent'].includes(d.viewMode) && (
            <GraphControlsToolbar
              graphRef={graphRef}
              graphData={d.graphData}
              activeLens={d.activeLens}
              layoutMode={d.activeLayoutMode}
              voiceSystems={voiceSystems}
            />
          )}

          <ErrorBoundary fallback={null}>
            {['globalLatent', 'latent'].includes(d.viewMode) && (
              <LatentSpaceUIOverlay hudOnly dataClusters={d.graphData?.nodes} schemaData={d.graphData}
                selectedNodeId={d.selectedNode?.id || d.hoveredNode?.id} liveStats={d.liveStats}
                timeValue={d.timeValue} onTimeChange={d.setTimeValue} currentLens={d.activeLens}
                hoveredEdge={d.hoveredEdge} connectionId={d.connectionId} onDrillDown={d.handleNodeDrillDown}
                insightPerspective={d.insightPerspective} setInsightPerspective={d.setInsightPerspective}
                onClose={() => d.handleNavigate(d.viewMode === 'latent' ? 'drilldown' : 'overview')}
                onZoomIn={() => graphRef.current?.zoom?.(0.8)} onZoomOut={() => graphRef.current?.zoom?.(1.2)}
                onZoomReset={() => graphRef.current?.resetView?.()} onToggleLens={d.handleToggleLens}
                activeFilters={d.activeFilters} onFilterChange={(label, value) => d.setFilterValue(label, value)}
                multiSelectedNodes={d.multiSelectedNodes} setMultiSelectedNodes={d.setMultiSelectedNodes}
                showMultiConnections={d.showMultiConnections} setShowMultiConnections={d.setShowMultiConnections}
                showPKs={d.showPKs} showFKs={d.showFKs} setShowPKs={d.setShowPKs} setShowFKs={d.setShowFKs}
                onShareView={d.handleShareView}
              />
            )}
          </ErrorBoundary>
        </div>

        {d.viewMode === 'overview' && !d.isInspectorActive && (
          <Legend
            layoutMode={d.activeLayoutMode}
            showPKs={d.showPKs}
            showFKs={d.showFKs}
            setShowPKs={d.setShowPKs}
            setShowFKs={d.setShowFKs}
            activeLens={d.activeLens}
            onToggleLayoutMode={d.handleToggleLayoutMode}
            singleNodeViewEnabled={d.singleNodeViewEnabled}
            setSingleNodeViewEnabled={d.setSingleNodeViewEnabled}
          />
        )}
        <ErrorBoundary fallback={null}>
          <VoiceControl voiceSystems={voiceSystems} />
        </ErrorBoundary>

        <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
          <div className="w-full h-full">
            {!d.connectionId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8 bg-black/40 border border-amber-500/30 rounded-2xl backdrop-blur-xl max-w-md">
                  <div className="text-amber-500 mb-4"><span className="material-symbols-outlined text-6xl">database_off</span></div>
                  <h3 className="text-xl font-bold text-white mb-2">No Active Session</h3>
                  <p className="text-gray-400 text-sm mb-6">Connect to a database to access full capabilities.</p>
                  <button onClick={() => d.setShowConnectModal(true)} className="px-6 py-2 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-xs font-bold uppercase">Connect Database</button>
                </div>
              </div>
            ) : (
              <>
                {d.viewMode === 'drilldown' && d.drillDownTable && <ErrorBoundary fallback={(_, reset) => <PanelError name="Drill Down" reset={reset} />}><DrillDownView connectionId={d.connectionId} tableName={d.drillDownTable} onBack={d.handleBackToOverview} onToggleLatent={d.handleToggleLatent} initialShowSimulation={false} /></ErrorBoundary>}
                {d.viewMode === 'dataflow' && <ErrorBoundary fallback={(_, reset) => <PanelError name="Data Flow" reset={reset} />}><DataFlowView connectionId={d.connectionId} /></ErrorBoundary>}
                {d.viewMode === 'analytics' && <ErrorBoundary fallback={(_, reset) => <PanelError name="Analytics" reset={reset} />}><AnalyticsView connectionId={d.connectionId} graphData={d.graphData} mlInsights={d.mlInsights} gravitySuggestions={d.gravitySuggestions} /></ErrorBoundary>}
                {d.viewMode === 'vitals' && <ErrorBoundary fallback={(_, reset) => <PanelError name="System Vitals" reset={reset} />}><SystemVitalsDashboard /></ErrorBoundary>}
                {d.viewMode === 'schema' && <ErrorBoundary fallback={(_, reset) => <PanelError name="Schema" reset={reset} />}><SchemaView connectionId={d.connectionId} /></ErrorBoundary>}
                {d.viewMode === 'intelligence' && <ErrorBoundary fallback={(_, reset) => <PanelError name="Intelligence Hub" reset={reset} />}><IntelligenceHub connectionId={d.connectionId} selectedNode={d.selectedNode} /></ErrorBoundary>}
                {d.viewMode === 'lineage' && (
                  <ErrorBoundary fallback={(_, reset) => <PanelError name="Perspective Lineage" reset={reset} />}>
                    <PerspectiveLineageView multiSelectedNodes={d.multiSelectedNodes} setMultiSelectedNodes={d.setMultiSelectedNodes}
                      showMultiConnections={d.showMultiConnections} setShowMultiConnections={d.setShowMultiConnections}
                      graphData={d.graphData} insightPerspective={d.insightPerspective} setInsightPerspective={d.setInsightPerspective}
                      activeFilters={d.activeFilters} onFilterChange={(label, value) => d.setFilterValue(label, value)}
                      connectionId={d.connectionId} pinnedNodes={d.pinnedNodes} setPinnedNodes={d.setPinnedNodes}
                      pinnedCols={d.pinnedCols} setPinnedCols={d.setPinnedCols} columnAliases={d.columnAliases} setColumnAliases={d.setColumnAliases}
                    />
                  </ErrorBoundary>
                )}
              </>
            )}
          </div>
        </div>

        <div className="relative z-[3000]">
          <AnimatePresence>{d.windows.map((w) => <Window key={w.id} {...w} />)}</AnimatePresence>
          {d.windows.length > 0 && <Taskbar />}
        </div>

        <AnimatePresence>
          {d.evolutionMode && (
            <>
              <TimelinePlayer connectionId={d.connectionId} onSnapshotUpdate={(snap) => { d.setCurrentSnapshot(snap); graphRef.current?.setEvolutionSnapshot?.(snap); }} onClose={() => d.setEvolutionMode?.(false)} />
              <EvolutionOverlay snapshot={d.currentSnapshot} />
              <EvolutionMathOverlay snapshot={d.currentSnapshot} />
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => d.setEvolutionMode?.(false)} className="fixed top-24 left-6 px-4 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold uppercase z-50">Exit Evolution Mode</motion.button>
            </>
          )}
        </AnimatePresence>

        <ErrorBoundary fallback={null}><ChatInterface connectionId={d.connectionId} isOpen={d.isChatOpen} onClose={() => d.setIsChatOpen(false)} /></ErrorBoundary>

        <AnimatePresence>
          {d.timeMachineOpen && (
            <ErrorBoundary fallback={null}>
              <TimeMachinePanel connectionId={d.connectionId}
                onSnapshotSelect={(data) => { d.setSnapshotData(data); graphRef.current?.applySnapshot?.(data); }}
                onClose={d.closeTimeMachine}
              />
            </ErrorBoundary>
          )}
        </AnimatePresence>

        <ErrorBoundary fallback={null}>{d.showConnectModal && <ConnectionModal onClose={() => d.setShowConnectModal(false)} />}</ErrorBoundary>
        <RemoteCursors activePeers={d.activePeers} />
        <GenerationLogPanel />
      </DashboardLayout>
    </>
  );
};

export default App;
