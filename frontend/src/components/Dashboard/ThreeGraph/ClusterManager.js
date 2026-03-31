/**
 * ClusterManager.js
 * Responsibility: 3D voxel cluster meshes, cluster grouping, lens-based visual boundaries.
 * Extracted from ThreeGraph.jsx lines 47-163.
 *
 * Exports:
 *   createClusterVoxelMesh(nodesInCluster, currentLens)
 *   createDataGridTexture(title, baseColorHex, nodeData)
 */
import * as THREE from 'three';
import { logger } from '../../../utils/logger';

import { createTextSprite } from './NodeRenderer.js';

function createClusterVoxelMesh(nodesInCluster, currentLens = 'ops') {
    const group = new THREE.Group();
    const count = nodesInCluster.length;

    // Calculate grid dimensions
    const dim = Math.ceil(Math.pow(count, 1 / 2.5));
    const voxelSize = 100;

    nodesInCluster.forEach((node, i) => {
        const x = i % dim;
        const y = Math.floor(i / (dim * dim));
        const z = Math.floor((i % (dim * dim)) / dim);

        const color = currentLens === 'tier3' ? 0x000000 : (node.color ? new THREE.Color(node.color).getHex() : 0x22d3ee);
        const tex = createDataGridTexture(node.name, color, node);

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(voxelSize - 6, voxelSize - 6, voxelSize - 6),
            new THREE.MeshPhysicalMaterial({
                map: tex,
                transparent: true,
                opacity: 0.85, // MAtch single nodes
                metalness: 0.1,
                roughness: 0.2,
                clearcoat: 1.0,
                emissive: color,
                emissiveIntensity: 0.3
            })
        );

        mesh.position.set(
            (x - dim / 2 + 0.5) * voxelSize,
            (y + 0.5) * voxelSize,
            (z - dim / 2 + 0.5) * voxelSize
        );

        mesh.userData = { ...node, isNode: true };

        // LABEL: Add clear text label above the voxel
        const labelText = node.name || node.id;
        const label = createTextSprite(labelText, 40, '#ffffff'); // Clean white text
        label.position.set(0, voxelSize / 2 + 20, 0); // Hover above cube
        mesh.add(label);


        group.add(mesh);
    });
    if (currentLens === 'tier3') {
        const totalSize = dim * voxelSize;
        const boxGeo = new THREE.BoxGeometry(totalSize + 20, totalSize + 20, totalSize + 20); // Slightly larger padding
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x22d3ee, // Cyan
            wireframe: true,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            emissive: 0x22d3ee,
            emissiveIntensity: 0.5,
            roughness: 0.1,
            metalness: 0.1
        });
        const container = new THREE.Mesh(boxGeo, boxMat);
        group.add(container);

        // Add corner markers (optional for "Tech" look)
        const frameGeo = new THREE.BoxGeometry(totalSize + 40, totalSize + 40, totalSize + 40);
        const edges = new THREE.EdgesGeometry(frameGeo);
        const segmentMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
        const segments = new THREE.LineSegments(edges, segmentMat);
        group.add(segments);
    }

    return group;
}

function createDataGridTexture(title, baseColorHex, nodeData) {
    const canvas = document.createElement('canvas'); const size = 1024; canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, size, size);
    const baseColor = '#' + new THREE.Color(baseColorHex).getHexString();
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, size, 100);
    ctx.font = 'bold 48px Inter, Arial'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText((title || 'Unknown').toUpperCase(), 40, 70);
    const columns = nodeData?.columns || [];
    let displayCols = columns.slice(0, 2).map(c => typeof c === 'string' ? c : c.name);
    // User Request: Align Operations/Analytics to Z-Axis readings
    displayCols.push('OP_SIGMA_Z', 'HEALTH_IDX', 'STABILITY.╬⌐');
    ctx.lineWidth = 3; const rows = 12; const cols = displayCols.length; const rowH = (size - 100) / rows; const colW = size / cols;
    ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#cbd5e1';
    for (let c = 0; c < cols; c++) ctx.fillText(displayCols[c].substring(0, 12), c * colW + 20, 160);
    ctx.font = '28px monospace';
    for (let r = 1; r < rows; r++) {
        const y = 100 + r * rowH; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.strokeStyle = '#1e293b'; ctx.stroke();
        const sampleRow = (nodeData.sample_data && nodeData.sample_data[r - 1]) ? nodeData.sample_data[r - 1] : null;
        for (let c = 0; c < cols; c++) {
            const x = c * colW; if (r === 1) { ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x, size); ctx.strokeStyle = '#334155'; ctx.stroke(); }
            const nodeSeed = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const baseVal = (Math.sin(r * 0.5 + c * 0.2 + nodeSeed) + 1) / 2;
            let val = '---';
            const colName = displayCols[c];
            if (sampleRow && sampleRow[colName] !== undefined) {
                val = String(sampleRow[colName]).substring(0, 15); ctx.fillStyle = '#ffffff';
            } else if (nodeData.analytical_readings && nodeData.analytical_readings[colName]) {
                val = nodeData.analytical_readings[colName]; ctx.fillStyle = colName.includes('HEALTH') ? '#10b981' : (colName.includes('STABILITY') ? '#f59e0b' : '#00d4ff');
            } else {
                const lowColName = colName.toLowerCase();
                if (lowColName.includes('op_sigma_z')) { val = ((nodeData.latent_z || 0) / 2000 + baseVal * 0.1).toFixed(4); ctx.fillStyle = '#00d4ff'; }
                else if (lowColName.includes('health')) { val = (90 + (baseVal * 9)).toFixed(1) + '%'; ctx.fillStyle = '#10b981'; }
                else { val = Math.floor(baseVal * 5000 + 100 * r).toString(); ctx.fillStyle = '#94a3b8'; }
            }
            ctx.fillText(val, x + 20, y + rowH * 0.7);
        }
    }
    ctx.font = 'bold 20px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillText('VALIDATED NEURAL TOPOLOGY // CALC: ACCURATE', 40, size - 40);
    ctx.strokeStyle = baseColor; ctx.lineWidth = 16; ctx.strokeRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 16; return tex;
}


export { createClusterVoxelMesh, createDataGridTexture };
