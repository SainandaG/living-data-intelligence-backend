import { create } from 'zustand';
import { getLensCategories } from '../components/Dashboard/LatentSpaceLogic.jsx';

/**
 * View Store
 * Manages all view/navigation/UI visibility state.
 * Replaces 10 useState hooks from App.jsx:
 * viewMode, activeLens, activeLayoutMode, breadcrumbs, isChatOpen,
 * showDrillDown, drillDownTable, isSidebarPanelActive, isHudMinimized,
 * insightPerspective
 * Also includes war room state (isWarRoomActive, warRoomTargetNode).
 */

const getInitialViewMode = () => {
  const path = window.location.pathname.substring(1);
  const validModes = ['overview', 'drilldown', 'dataflow', 'analytics', 'vitals', 'schema', 'intelligence', 'lineage', 'globalLatent', 'latent'];
  if (validModes.includes(path)) return path;
  return localStorage.getItem('viewMode') || 'overview';
};

const getInitialActiveLens = () =>
  localStorage.getItem('activeLens') || 'ops';

const getInitialLayoutMode = () =>
  localStorage.getItem('activeLayoutMode') || 'galaxy';

const getInitialFilters = () => {
  const saved = localStorage.getItem('activeFilters');
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  return { 'Independent Facts': true, 'Dependent Facts': true, 'Healthy Tables': true, 'Anomalous Peaks': true };
};

export const useViewStore = create((set, get) => ({
  viewMode: getInitialViewMode(),
  activeLens: getInitialActiveLens(),
  activeLayoutMode: getInitialLayoutMode(),
  breadcrumbs: [],
  isChatOpen: false,
  showDrillDown: false,
  drillDownTable: null,
  isSidebarPanelActive: false,
  isHudMinimized: false,
  insightPerspective: 'analyst',
  activeFilters: getInitialFilters(),
  isWarRoomActive: false,
  warRoomTargetNode: null,
  showPKs: true,
  showFKs: true,
  singleNodeViewEnabled: false,
  isInspectorActive: false,

  setViewMode: (mode) => {
    localStorage.setItem('viewMode', mode);
    set({ viewMode: mode });
  },

  setActiveLens: (lens) => {
    localStorage.setItem('activeLens', lens);
    const newCategories = getLensCategories(lens);
    const newFilters = {};
    newCategories.forEach((c) => { newFilters[c.id] = true; });
    set({ activeLens: lens, activeFilters: newFilters });
  },

  setActiveLayoutMode: (mode) => {
    localStorage.setItem('activeLayoutMode', mode);
    set({ activeLayoutMode: mode });
  },

  setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setIsChatOpen: (open) => set({ isChatOpen: open }),
  setShowDrillDown: (show) => set({ showDrillDown: show }),
  setDrillDownTable: (table) => set({ drillDownTable: table }),
  setIsSidebarPanelActive: (active) => set({ isSidebarPanelActive: active }),
  setIsHudMinimized: (min) => set({ isHudMinimized: min }),
  setInsightPerspective: (p) => set({ insightPerspective: p }),
  toggleInsightPerspective: () =>
    set((state) => ({ insightPerspective: state.insightPerspective === 'analyst' ? 'business' : 'analyst' })),
  setActiveFilters: (filters) => {
    const resolved = typeof filters === 'function' ? filters(get().activeFilters) : filters;
    localStorage.setItem('activeFilters', JSON.stringify(resolved));
    set({ activeFilters: resolved });
  },
  setFilterValue: (label, value) => {
    const next = { ...get().activeFilters, [label]: value };
    localStorage.setItem('activeFilters', JSON.stringify(next));
    set({ activeFilters: next });
  },

  activateWarRoom: (nodeId) => set({ isWarRoomActive: true, warRoomTargetNode: nodeId }),
  deactivateWarRoom: () => set({ isWarRoomActive: false, warRoomTargetNode: null }),
  setShowPKs: (show) => set({ showPKs: show }),
  setShowFKs: (show) => set({ showFKs: show }),
  setSingleNodeViewEnabled: (enabled) => set({ singleNodeViewEnabled: enabled }),
  setIsInspectorActive: (active) => set({ isInspectorActive: active }),
}));
