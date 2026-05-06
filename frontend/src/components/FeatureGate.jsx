import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * FeatureGate Component
 * Conditionally renders children if the current user has the required permissions.
 */
const FeatureGate = ({ feature, fallback = null, children }) => {
  const { can } = usePermissions();

  if (can(feature)) {
    return <>{children}</>;
  }

  return fallback;
};

export default FeatureGate;
