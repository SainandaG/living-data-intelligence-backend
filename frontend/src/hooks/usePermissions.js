import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';

/**
 * usePermissions Hook
 *
 * Permission resolution order (explicit beats hierarchy):
 *
 *  1. super_admin / admin  → always true
 *  2. Explicit grant in userPermissions JSONB → read/execute = allow, none = deny
 *     Also checks known aliases (e.g. "connections" → also checks "connect")
 *  3. Hierarchical fallback: compare userLevel vs feature.min_role
 *  4. Unknown feature with no explicit grant → deny
 *
 * Fixes vs original:
 *  - Features fetched for ALL logged-in users (not just admins)
 *  - Explicit grants checked FIRST so they override hierarchy in both directions
 *  - hasOwnProperty used so 'none' values are caught correctly
 *  - Custom role levels resolved from /admin/roles DB, not just ROLE_HIERARCHY
 *  - Feature ID aliases handled (connections → connect/manage)
 */

// Maps frontend FeatureGate IDs to their actual stored permission key(s)
// Add any future mismatches here
const FEATURE_ALIASES = {
  connections: ['connections', 'connect', 'manage'],
};

export const usePermissions = () => {
  const { userRole, userPermissions } = useAuthStore();
  const [features, setFeatures] = useState([]);
  const [roleLevel, setRoleLevel] = useState(null);

  const ROLE_HIERARCHY = { viewer: 1, editor: 2, analyst: 3, admin: 4, super_admin: 1000 };
  const builtinLevel = ROLE_HIERARCHY[userRole] ?? null;

  useEffect(() => {
    if (!userRole) return;

    const fetchMetadata = async () => {
      try {
        // Fetch features for ALL users — needed for hierarchy min_role check
        const featData = await apiClient.get('/admin/features');
        const allFeatures = (featData?.categories || []).flatMap(cat => cat.features || []);
        setFeatures(allFeatures);
      } catch (e) {
        console.warn('[usePermissions] Could not fetch feature metadata:', e?.response?.status);
        setFeatures([]);
      }

      // Custom roles: resolve level from /admin/roles
      if (builtinLevel === null) {
        try {
          const rolesData = await apiClient.get('/admin/roles');
          const roleRow = (rolesData || []).find(
            r => r.name?.toLowerCase() === userRole?.toLowerCase()
          );
          setRoleLevel(roleRow?.level ?? 1);
        } catch (e) {
          setRoleLevel(1);
        }
      } else {
        setRoleLevel(builtinLevel);
      }
    };

    fetchMetadata();
  }, [userRole]);

  const userLevel = roleLevel ?? builtinLevel ?? 0;

  /**
   * Check explicit grants for a feature ID — also checks known aliases.
   * Returns 'granted' | 'denied' | 'none' (not set explicitly).
   */
  const checkExplicit = (featureId) => {
    const keysToCheck = FEATURE_ALIASES[featureId] ?? [featureId];

    for (const category in userPermissions) {
      const catPerms = userPermissions[category];
      if (!catPerms) continue;
      for (const key of keysToCheck) {
        if (Object.prototype.hasOwnProperty.call(catPerms, key)) {
          const val = catPerms[key];
          if (val === 'none') return 'denied';
          if (val === 'read' || val === 'execute') return 'granted';
        }
      }
    }
    return 'none';
  };

  const can = (featureId) => {
    if (!userRole) return false;

    // 1. Admins bypass everything
    if (userRole === 'super_admin' || userRole === 'admin') return true;

    // 2. Explicit grant check — wins over hierarchy
    const explicit = checkExplicit(featureId);
    if (explicit === 'granted') return true;
    if (explicit === 'denied') return false;

    // 3. Hierarchical fallback using feature metadata
    const keysToCheck = FEATURE_ALIASES[featureId] ?? [featureId];
    for (const key of keysToCheck) {
      const feature = features.find(f => f.id === key);
      if (feature) {
        const minRoleLevel = ROLE_HIERARCHY[feature.min_role] ?? 1;
        return userLevel >= minRoleLevel;
      }
    }

    // 4. Unknown feature with no explicit grant → deny
    return false;
  };

  return { role: userRole, level: userLevel, can };
};

export default usePermissions;