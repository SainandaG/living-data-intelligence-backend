import { create } from 'zustand';
import apiClient from '../utils/apiClient';

/**
 * Enhanced Auth Store for Dynamic RBAC
 * Manages authentication state and granular permissions.
 */
export const useAuthStore = create((set, get) => ({
  isAuthenticated: false,
  isCheckingAuth: true,
  userRole: null,
  userPermissions: {},

  initialize: () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('user_role');
    const perms = localStorage.getItem('user_permissions');

    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      set({ 
        isAuthenticated: true, 
        isCheckingAuth: false,
        userRole: role || 'viewer',
        userPermissions: perms ? JSON.parse(perms) : {}
      });
    } else {
      set({ isCheckingAuth: false });
    }
  },

  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user_role', user.role || 'viewer');
    localStorage.setItem('user_permissions', JSON.stringify(user.permissions || {}));
    
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    set({ 
      isAuthenticated: true, 
      isCheckingAuth: false,
      userRole: user.role || 'viewer',
      userPermissions: user.permissions || {}
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_permissions');
    delete apiClient.defaults.headers.common['Authorization'];
    set({ isAuthenticated: false, userRole: null, userPermissions: {} });
  },

  /**
   * canDo('feature_id') or canDo('category')
   * Checks if user has 'read' or 'execute' permission for a feature.
   */
  canDo: (featureId) => {
    const { userRole, userPermissions } = get();
    if (userRole === 'admin' || userRole === 'super_admin') return true;
    
    // Check nested permissions
    for (const category in userPermissions) {
      if (userPermissions[category][featureId]) {
        const level = userPermissions[category][featureId];
        return level === 'read' || level === 'execute';
      }
    }
    return false;
  }
}));
