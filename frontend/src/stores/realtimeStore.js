import { create } from 'zustand';

/**
 * Realtime Store
 * Manages live WebSocket-driven data.
 * Replaces 4 useState hooks from App.jsx:
 * liveStats, liveTableCounts, simUpdate, autoSimulate
 */
export const useRealtimeStore = create((set, get) => ({
  liveStats: {
    totalTransactions: 0,
    fraudAlerts: 0,
    avgAmount: 0,
    failedTx: 0,
    tps: 0,
    activeNodes: 0,
    health: { state: 'healthy', score: 100, color: '#00ff88', issues: [] },
    anomalies: [],
    // WEZU Energy
    activeBatteries: 0,
    onlineStations: 0,
    networkHealth: 0,
    energyAlerts: 0,
    // Battery Telemetry
    avgBatteryTemp: 0,
    avgBatteryVolt: 0,
    avgBatteryCurr: 0,
    // DB Performance
    cacheHitRate: 99,
  },
  liveTableCounts: {},
  simUpdate: null,
  autoSimulate: false,

  setLiveStats: (updater) =>
    set((state) => ({
      liveStats: typeof updater === 'function' ? updater(state.liveStats) : { ...state.liveStats, ...updater },
    })),

  setLiveTableCounts: (counts) => set({ liveTableCounts: counts }),

  showSimToast: (message, duration = 4000) => {
    set({ simUpdate: message });
    setTimeout(() => set({ simUpdate: null }), duration);
  },

  clearSimToast: () => set({ simUpdate: null }),
  setAutoSimulate: (active) => set({ autoSimulate: active }),
}));
