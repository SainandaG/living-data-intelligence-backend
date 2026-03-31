import { create } from 'zustand';

/**
 * Connection Store
 * Manages database connection state: loading, modal visibility, connection ID.
 * Replaces loading, showConnectModal from App.jsx useState hooks.
 * connectionId is lifted here from WindowManagerContext for cross-component access.
 */
export const useConnectionStore = create((set, get) => ({
  loading: false,
  showConnectModal: false,
  connectionId: null,

  setLoading: (loading) => set({ loading }),
  setShowConnectModal: (show) => set({ showConnectModal: show }),
  setConnectionId: (id) => set({ connectionId: id }),
  openConnectModal: () => set({ showConnectModal: true }),
  closeConnectModal: () => set({ showConnectModal: false }),
}));
