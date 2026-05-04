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
   * canDo(featureId, minRole)
   * 
   * Priority: admin/super_admin bypass → explicit granular permission check → hierarchical role check fallback
   */
  canDo: (featureOrRole, fallbackRole = null) => {
    const { userRole, userPermissions } = get();
    
    // Admin/super_admin bypass everything
    if (userRole === 'admin' || userRole === 'super_admin') return true;
    
    // Explicit Granular feature permission check
    for (const category in userPermissions) {
      if (userPermissions[category] && userPermissions[category][featureOrRole]) {
        const level = userPermissions[category][featureOrRole];
        return level === 'read' || level === 'execute'; // Explicitly grant or deny
      }
    }
    
    // If not explicitly defined in DB, fallback to hierarchical check
    const checkRole = fallbackRole || featureOrRole;
    const ROLE_HIERARCHY = { viewer: 1, editor: 2, analyst: 3, admin: 4, super_admin: 5 };
    const requiredLevel = ROLE_HIERARCHY[checkRole];
    
    if (requiredLevel !== undefined) {
      const userLevel = ROLE_HIERARCHY[userRole] || 0;
      return userLevel >= requiredLevel;
    }
    
    return false;
  }
}));
