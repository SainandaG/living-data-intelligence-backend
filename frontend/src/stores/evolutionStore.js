import { create } from 'zustand';

/**
 * Evolution Store
 * Manages time-travel and evolution mode state.
 * Replaces 5 useState hooks from App.jsx:
 * evolutionMode, currentSnapshot, timeMachineOpen, snapshotData, timeValue
 */
export const useEvolutionStore = create((set) => ({
  evolutionMode: false,
  currentSnapshot: null,
  timeMachineOpen: false,
  snapshotData: null,
  timeValue: 100,

  setEvolutionMode: (active) => set({ evolutionMode: active }),
  setCurrentSnapshot: (snap) => set({ currentSnapshot: snap }),
  openTimeMachine: () => set({ timeMachineOpen: true }),
  closeTimeMachine: () => set({ timeMachineOpen: false, snapshotData: null }),
  setSnapshotData: (data) => set({ snapshotData: data }),
  setTimeValue: (val) => set({ timeValue: val }),
}));
