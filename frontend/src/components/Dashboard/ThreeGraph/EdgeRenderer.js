/**
 * EdgeRenderer.js
 * Responsibility: Edge curves, flow particles, edge visual logic.
 * Extracted from ThreeGraph.jsx lines 546-589.
 *
 * Exports:
 *   createCurvedEdge(sourcePos, targetPos, edgeData, sourceId, targetId, layoutMode, edgeColor)
 *   createParticle(type, labelText)
 */
import * as THREE from 'three';
import { logger } from '../../../utils/logger';

import { createTextSprite } from './NodeRenderer.js';
import {
    createLatentBridgeEdge,
} from '../LatentSpaceLogic.jsx';

function createCurvedEdge(sourcePos, targetPos, edgeData = {}, sourceId, targetId, layoutMode = 'galaxy', edgeColor = 0x00d4ff) {
    return createLatentBridgeEdge(sourcePos, targetPos, edgeData, sourceId, targetId, layoutMode === 'latent', edgeColor);
}

function createParticle(type = 'normal', labelText = null) {
    // Return a group if we have a label, otherwise just the mesh
    const group = new THREE.Group();

    // [FIX] Use BoxGeometry for technical bridge connections (FK columns)
    const geometry = type === 'bridge'
        ? new THREE.BoxGeometry(10, 10, 10)
        : new THREE.SphereGeometry(6, 16, 16);

    let color;
    if (type === 'fraud') color = 0xFF4757;      // Red
    else if (type === 'high_traffic') color = 0xFFD700; // Gold
    else if (type === 'bridge') color = 0x00D4FF;       // Neon Cyan
    else color = 0x00FF88;                       // Green

    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: type === 'bridge' ? 4.0 : 2.0,
        roughness: 0.2,
        metalness: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isBridge = type === 'bridge';
    group.add(mesh);

    // Also store on group for easier access in animate loop
    group.userData.isBridge = type === 'bridge';
    group.userData.mesh = mesh; // Keep reference to the mesh for rotation

    if (labelText) {
        // Smaller label for particles
        const label = createTextSprite(labelText, 32, '#ffffff');
        label.position.set(0, 15, 0);
        group.add(label);
    }

    return group;
}


export { createCurvedEdge, createParticle };
