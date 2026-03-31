import { create } from 'zustand';

/**
 * Graph Store
 * Manages all graph/node/edge state.
 * Replaces 14 useState hooks from App.jsx:
 * graphData, selectedNode, selectedColumn, hoveredNode, hoveredEdge,
 * hoveredEdgePos, multiSelectedNodes, showMultiConnections, enrichedNodes,
 * pinnedNodes, pinnedNodeId, pinnedCols, pinnedEdge, threeGraphKey
 */
export const useGraphStore = create((set, get) => ({
  graphData: { nodes: [], edges: [] },
  selectedNode: null,
  selectedColumn: null,
  hoveredNode: null,
  hoveredEdge: null,
  hoveredEdgePos: null,
  multiSelectedNodes: [],
  showMultiConnections: false,
  enrichedNodes: null,
  pinnedNodes: new Set(),
  pinnedNodeId: null,
  pinnedCols: new Set(),
  pinnedEdge: null,
  threeGraphKey: 0,

  setGraphData: (data) => set({ graphData: data }),
  updateGraphData: (updater) => set((state) => ({ graphData: updater(state.graphData) })),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setSelectedColumn: (col) => set({ selectedColumn: col }),
  setHoveredNode: (node) => set({ hoveredNode: node }),
  setHoveredEdge: (edge) => set({ hoveredEdge: edge }),
  setHoveredEdgePos: (pos) => set({ hoveredEdgePos: pos }),
  setMultiSelectedNodes: (nodes) => set({ multiSelectedNodes: typeof nodes === 'function' ? nodes(get().multiSelectedNodes) : nodes }),
  setShowMultiConnections: (show) => set({ showMultiConnections: show }),
  setEnrichedNodes: (nodes) => set({ enrichedNodes: nodes }),
  setPinnedNodes: (nodes) => set({ pinnedNodes: typeof nodes === 'function' ? nodes(get().pinnedNodes) : nodes }),
  setPinnedNodeId: (id) => set({ pinnedNodeId: id }),
  setPinnedCols: (cols) => set({ pinnedCols: typeof cols === 'function' ? cols(get().pinnedCols) : cols }),
  setPinnedEdge: (edge) => set({ pinnedEdge: edge }),
  incrementThreeGraphKey: () => set((state) => ({ threeGraphKey: state.threeGraphKey + 1 })),

  toggleMultiSelectNode: (node) => set((state) => {
    const isSelected = state.multiSelectedNodes.some((n) => n.id === node.id);
    return {
      multiSelectedNodes: isSelected
        ? state.multiSelectedNodes.filter((n) => n.id !== node.id)
        : [...state.multiSelectedNodes, node],
    };
  }),

  clearSelection: () => set({ selectedNode: null, hoveredNode: null, multiSelectedNodes: [] }),
}));
