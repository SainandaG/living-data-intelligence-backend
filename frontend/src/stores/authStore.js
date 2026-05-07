import { create } from 'zustand';
import apiClient from '../utils/apiClient';

/**
 * Enhanced Auth Store for Dynamic RBAC
 * Manages authentication state and granular permissions.
 *
 * Real-time role sync flow:
 *  1. Backend pushes  { type: "role_update", role, permissions }  over WebSocket
 *  2. useDashboard (or any WS consumer) calls  applyRoleUpdate(role, permissions)
 *  3. Store updates instantly → UI re-renders with correct access
 *  4. Simultaneously calls /auth/refresh to get a new signed JWT so future API
 *     calls carry the correct role claim
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
        userPermissions: perms ? JSON.parse(perms) : {},
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
      userPermissions: user.permissions || {},
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
   * applyRoleUpdate — called when a  role_update  WebSocket event arrives
   * for the current user. Updates the store immediately (instant UI effect)
   * and then silently refreshes the JWT so subsequent API calls are authorised.
   */
  applyRoleUpdate: async (newRole, newPermissions = {}) => {
    // 1. Update store & localStorage immediately so the UI reacts without waiting
    localStorage.setItem('user_role', newRole);
    localStorage.setItem('user_permissions', JSON.stringify(newPermissions));
    set({ userRole: newRole, userPermissions: newPermissions });

    // 2. Refresh JWT in the background so the new role claim reaches the backend
    await get().silentTokenRefresh();
  },

  /**
   * applyPermissionsUpdate — called when a  permissions_update  WebSocket event
   * arrives (Role Factory changed the permission set of the user's current role).
   * Refreshes the JWT + store without touching the role name.
   */
  applyPermissionsUpdate: async (changedRole) => {
    const { userRole } = get();
    // Only act if the updated role matches the current user's role
    if (changedRole && changedRole.toLowerCase() !== (userRole || '').toLowerCase()) return;
    await get().silentTokenRefresh();
  },

  /**
   * silentTokenRefresh — calls /auth/refresh and applies the new token + permissions
   * to the store. Safe to call from any context; swallows errors gracefully.
   */
  silentTokenRefresh: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return;

    try {
      const BASE_URL = import.meta?.env?.VITE_API_URL || 'http://localhost:8000';
      // Use raw fetch (not apiClient) to avoid any interceptor loops
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return; // e.g. refresh token also expired — leave user logged in with stale data

      const data = await res.json();
      if (!data.access_token) return;

      localStorage.setItem('token', data.access_token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;

      // /auth/refresh now also returns role + permissions
      if (data.role) {
        localStorage.setItem('user_role', data.role);
        set({ userRole: data.role });
      }
      if (data.permissions !== undefined) {
        const perms = data.permissions || {};
        localStorage.setItem('user_permissions', JSON.stringify(perms));
        set({ userPermissions: perms });
      }
    } catch (e) {
      console.warn('[authStore] silentTokenRefresh failed:', e);
    }
  },

  /**
   * canDo(featureId, minRole)
   *
   * Resolution order:
   *  1. admin / super_admin → always true
   *  2. Explicit grant in userPermissions → read/execute = allow, none = deny
   *     Also checks known aliases (e.g. "connections" → checks "connect" too)
   *  3. Hierarchical role check (featureOrRole treated as a role name)
   */
  canDo: (featureOrRole, fallbackRole = null) => {
    const { userRole, userPermissions } = get();

    // Admin/super_admin bypass everything
    if (userRole === 'admin' || userRole === 'super_admin') return true;

    // Known feature aliases
    const FEATURE_ALIASES = { connections: ['connections', 'connect', 'manage'] };
    const keysToCheck = FEATURE_ALIASES[featureOrRole] ?? [featureOrRole];

    // Explicit granular permission check — checked BEFORE hierarchy
    for (const category in userPermissions) {
      const catPerms = userPermissions[category];
      if (!catPerms) continue;
      for (const key of keysToCheck) {
        if (Object.prototype.hasOwnProperty.call(catPerms, key)) {
          const level = catPerms[key];
          if (level === 'none') return false;
          if (level === 'read' || level === 'execute') return true;
        }
      }
    }

    // Hierarchical fallback
    const checkRole = fallbackRole || featureOrRole;
    const ROLE_HIERARCHY = { viewer: 1, editor: 2, analyst: 3, admin: 4, super_admin: 1000 };
    const requiredLevel = ROLE_HIERARCHY[checkRole];

    if (requiredLevel !== undefined) {
      const userLevel = ROLE_HIERARCHY[userRole] ?? 1;
      return userLevel >= requiredLevel;
    }

    return false;
  },
}));