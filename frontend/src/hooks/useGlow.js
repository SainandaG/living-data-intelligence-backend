import { useRef } from 'react';
import * as THREE from 'three';

/**
 * Hook to manage neural pulsing and glow effects (Vanilla Three version)
 */
export const useGlowManager = () => {
    const update = (object, time, state, nodeGlow = 1.0) => {
        if (!object || !object.traverse) return;

        object.traverse((child) => {
            if (child.isMesh && child.material) {
                // Store original values if not present
                if (child.userData.originalOpacity === undefined) child.userData.originalOpacity = child.material.opacity;
                if (child.userData.originalEmissive === undefined) child.userData.originalEmissive = child.material.emissiveIntensity || 0.0;

                const LERP_FACTOR = 0.1;
                let targetOpacity = child.userData.originalOpacity;

                // Emissive only applies to standard/physical materials
                const hasEmissive = child.material.emissiveIntensity !== undefined;
                let baseEmissive = hasEmissive ? Math.min(3.0, (child.userData.originalEmissive + nodeGlow * 0.4)) : 0;
                let targetEmissive = baseEmissive;

                // Handle Hover/Active states
                if (state === 'hover') {
                    targetOpacity = Math.min(1.0, child.userData.originalOpacity * 2.0);
                    if (hasEmissive) targetEmissive = baseEmissive + 1.0;
                } else if (state === 'dimmed') {
                    targetOpacity = 0.1;
                    if (hasEmissive) targetEmissive = 0.05;
                }

                // Apply Pulse
                const pulse = Math.sin(time * (2 + (nodeGlow * 0.8))) * 0.1 * nodeGlow;
                if (hasEmissive) targetEmissive += pulse;

                // Lerp properties safely
                if (child.material.transparent) {
                    child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, targetOpacity, LERP_FACTOR);
                }

                if (hasEmissive) {
                    child.material.emissiveIntensity = THREE.MathUtils.lerp(child.material.emissiveIntensity, targetEmissive, LERP_FACTOR);
                }
            }
        });
    };

    return { update };
};
