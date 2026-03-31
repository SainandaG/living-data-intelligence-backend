import { create } from 'zustand';

/**
 * Intelligence Store
 * Manages AI/ML intelligence state.
 * Replaces 8 useState hooks from App.jsx:
 * aiStatus, mlInsights, gravitySuggestions, showRecordGravity,
 * rlActive, clusteringMethod, activeFilters (moved to viewStore), columnAliases
 */
export const useIntelligenceStore = create((set, get) => ({
  aiStatus: null,
  mlInsights: null,
  gravitySuggestions: [],
  showRecordGravity: false,
  rlActive: false,
  clusteringMethod: 'heuristic',
  columnAliases: {},

  setAiStatus: (status, clearAfterMs = null) => {
    set({ aiStatus: status });
    if (clearAfterMs) {
      setTimeout(() => set({ aiStatus: null }), clearAfterMs);
    }
  },
  clearAiStatus: () => set({ aiStatus: null }),

  setMlInsights: (insights) =>
    set((state) => ({
      mlInsights: typeof insights === 'function' ? insights(state.mlInsights) : insights,
    })),

  setGravitySuggestions: (suggestions) => set({ gravitySuggestions: suggestions }),
  setShowRecordGravity: (show) => set({ showRecordGravity: show }),
  setRlActive: (active) => set({ rlActive: active }),

  setClusteringMethod: (method) => set({ clusteringMethod: method }),
  toggleClusteringMethod: () =>
    set((state) => ({
      clusteringMethod: state.clusteringMethod === 'heuristic' ? 'networkx' : 'heuristic',
    })),

  setColumnAliases: (aliases) => set({ columnAliases: aliases }),
  addColumnAlias: (col, alias) =>
    set((state) => ({ columnAliases: { ...state.columnAliases, [col]: alias } })),
}));
