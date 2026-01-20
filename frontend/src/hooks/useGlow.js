import { useRef } from 'react';
import * as THREE from 'three';

/**
 * Hook to manage neural pulsing and glow effects (Vanilla Three version)
 */
export const useGlowManager = () => {
    const update = (object, time, state, nodeGlow = 1.0) => {
        if (!object || !object.traverse) return;

        object.traverse((child) => {
            if (child.material) {
                // Store original values if not present
                if (!child.userData.originalOpacity) child.userData.originalOpacity = child.material.opacity;
                if (!child.userData.originalEmissive) child.userData.originalEmissive = child.material.emissiveIntensity || 0.1;

                const LERP_FACTOR = 0.08;
                let targetOpacity = child.userData.originalOpacity;
                let baseEmissive = Math.min(3.0, (child.userData.originalEmissive + nodeGlow * 0.4));
                let targetEmissive = baseEmissive;

                // Handle Hover/Active states
                if (state === 'hover') {
                    targetOpacity = Math.min(1.0, child.userData.originalOpacity * 1.5);
                    targetEmissive = baseEmissive + 0.8;
                } else if (state === 'related') {
                    targetEmissive = baseEmissive + 0.3;
                } else if (state === 'dimmed') {
                    targetOpacity = 0.1;
                    targetEmissive = 0.05;
                }

                // Apply Pulse
                const pulse = Math.sin(time * (2 + (nodeGlow * 0.8))) * 0.15 * nodeGlow;
                targetEmissive += pulse;

                // Lerp
                child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, targetOpacity, LERP_FACTOR);
                if (child.material.emissiveIntensity !== undefined) {
                    child.material.emissiveIntensity = THREE.MathUtils.lerp(child.material.emissiveIntensity, targetEmissive, LERP_FACTOR);
                }
            }
        });
    };

    return { update };
};
