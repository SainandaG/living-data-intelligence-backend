import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';

/**
 * usePermissions Hook
 * Provides granular feature gating based on role levels and explicit permissions.
 */
export const usePermissions = () => {
  const { userRole, userPermissions } = useAuthStore();
  const [features, setFeatures] = useState([]);
  const [roles, setRoles] = useState([]);

  const ROLE_HIERARCHY = { viewer: 1, editor: 2, analyst: 3, admin: 4, super_admin: 1000 };
  const userLevel = ROLE_HIERARCHY[userRole] || 0;

  useEffect(() => {
    // Only fetch for admin+ to avoid 403s
    if (userLevel >= 4) {
      const fetchMetadata = async () => {
        try {
          const [featData, roleData] = await Promise.all([
            apiClient.get('/admin/features'),
            apiClient.get('/admin/roles')
          ]);
          const allFeatures = (featData?.categories || []).flatMap(cat => cat.features || []);
          setFeatures(allFeatures);
          setRoles(roleData || []);
        } catch (e) {
          console.error('Failed to fetch permission metadata:', e);
        }
      };
      fetchMetadata();
    }
  }, [userLevel]);

  const can = (featureId) => {
    // 1. Super Admin bypass
    if (userRole === 'super_admin') return true;

    // 2. Hierarchical Check (Role level vs Feature min_role)
    const feature = features.find(f => f.id === featureId);
    if (feature) {
      const minRoleLevel = ROLE_HIERARCHY[feature.min_role] || 0;
      if (userLevel < minRoleLevel) return false;
    }

    // 3. Explicit Permission Check (not "none")
    // Note: userPermissions is keyed by category, e.g., { "Security": { "audit": "execute" } }
    for (const category in userPermissions) {
      if (userPermissions[category] && userPermissions[category][featureId]) {
        const val = userPermissions[category][featureId];
        return val !== 'none';
      }
    }

    // Fallback: If feature exists but no explicit permission, allow if level matches
    if (feature) return true;

    // Fallback for unknown features (gate by default if not super admin)
    return userLevel >= 4;
  };

  return { role: userRole, level: userLevel, can };
};

export default usePermissions;
