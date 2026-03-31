import { create } from 'zustand';
import apiClient from '../utils/apiClient';

/**
 * Auth Store
 * Manages authentication state: login, logout, token presence.
 * Replaces isAuthenticated and isCheckingAuth useState hooks from App.jsx.
 */
export const useAuthStore = create((set) => ({
  isAuthenticated: false,
  isCheckingAuth: true,

  initialize: () => {
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      set({ isAuthenticated: true, isCheckingAuth: false });
    } else {
      set({ isCheckingAuth: false });
    }
  },

  login: () => set({ isAuthenticated: true, isCheckingAuth: false }),

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    delete apiClient.defaults.headers.common['Authorization'];
    set({ isAuthenticated: false });
  },
}));
