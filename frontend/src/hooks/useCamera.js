import { useCallback, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hook to manage smooth camera transitions (Vanilla version)
 */
export const useCameraManager = (cameraRef, controlsRef) => {
    const transitionState = useRef({
        active: false,
        startPos: new THREE.Vector3(),
        startLookAt: new THREE.Vector3(),
        targetPos: new THREE.Vector3(),
        targetLookAt: new THREE.Vector3(),
        duration: 1.5,
        elapsed: 0
    });

    const focusOn = useCallback((position, lookAt = null, duration = 1.5) => {
        if (!cameraRef.current || !controlsRef.current) return;

        transitionState.current = {
            active: true,
            startPos: cameraRef.current.position.clone(),
            startLookAt: controlsRef.current.target.clone(),
            targetPos: position.clone(),
            targetLookAt: lookAt ? lookAt.clone() : position.clone(),
            duration,
            elapsed: 0
        };
    }, [cameraRef, controlsRef]);

    const update = (delta) => {
        if (!transitionState.current.active) return;

        const ts = transitionState.current;
        ts.elapsed += delta;
        const progress = Math.min(ts.elapsed / ts.duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        cameraRef.current.position.lerpVectors(ts.startPos, ts.targetPos, ease);
        controlsRef.current.target.lerpVectors(ts.startLookAt, ts.targetLookAt, ease);
        controlsRef.current.update();

        if (progress >= 1) {
            ts.active = false;
        }
    };

    return { focusOn, update };
};
