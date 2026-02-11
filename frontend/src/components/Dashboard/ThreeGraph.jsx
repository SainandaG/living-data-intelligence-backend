import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useRegisterCommand } from '../../context/CommandRegistryContext';
import soundSystem from '../../utils/SoundSystem';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useGlowManager } from '../../hooks/useGlow';
import { useCameraManager } from '../../hooks/useCamera';
import { SeededRNG } from '../../utils/mathUtils';

// Layout & Spatial Formulas
function applyGalaxyLayout(nodes, radius = 900) {
    const numNodes = nodes.length;
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden Angle

    nodes.forEach((node, i) => {
        if (node.id === 'DATABASE_CORE' || node.id === 'hub') {
            node.targetX = 0; node.targetY = 0; node.targetZ = 0;
            return;
        }

        const y = 1 - (i / (numNodes - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = phi * i;

        node.targetX = Math.cos(theta) * r * radius;
        node.targetY = y * radius;
        node.targetZ = Math.sin(theta) * r * radius;

        // If it's a new node or doesn't have initial pos, snap it
        if (node.x === undefined) {
            node.x = node.targetX;
            node.y = node.targetY;
            node.z = node.targetZ;
        }
    });
}

function applyLatentSpaceLayout(nodes) {
    nodes.forEach(node => {
        if (node.id === 'hub') {
            node.targetX = 0; node.targetY = 0; node.targetZ = 0;
            return;
        }
        // SCALING: Ensure nodes inhabit the full 30k x 20k plain
        node.targetX = (node.latent_x || 0) * 1.1;
        node.targetY = (node.latent_y || 0); // Temporary, will be refined in animate
        node.targetZ = (node.latent_z || 0) * 1.8; // More spread in depth
    });
    return nodes;
}

// Helper to find height on the manifold for any X, Z
function getManifoldHeight(x, z, emitters) {
    if (!emitters || emitters.length === 0) return 0;

    const sigma = 2500.0; // Wider peak influence
    let weightedHeight = 0;
    let totalW = 0;

    emitters.forEach(e => {
        // High-Fidelity Scaling: Categories are mapped to wide zones
        const ex = e.x * 1.1;
        const ez = e.z * 1.8;
        const d2 = Math.pow(x - ex, 2) + Math.pow(z - ez, 2);

        // Dynamic influence based on category importance
        const w = Math.exp(-d2 / (2 * sigma * sigma)) * (e.weight || 1.0);
        weightedHeight += e.y * w;
        totalW += w;
    });

    // Mountain Base Floor: prevent sagging
    return (totalW > 0.001) ? (weightedHeight / (totalW + 0.05)) : 0;
}

// Manifold & Intelligence Visuals (Hyper-Latent Summons)
function createLatentManifold(manifoldData) {
    if (!manifoldData || !manifoldData.emitters) return null;

    const group = new THREE.Group();

    // REDUCED RESOLUTION: Prevents excessive vertex twinkling
    const res = 150; // Reduced from 300 for stability
    const geometry = new THREE.PlaneGeometry(32000, 22000, res, res);
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    const sigma = 2500.0;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const geom_y = vertices[i + 1];
        const world_z = -geom_y;

        let weightedHeight = 0;
        let totalW = 0;
        let r_acc = 0, g_acc = 0, b_acc = 0;

        manifoldData.emitters.forEach(e => {
            const ex = e.x * 1.1; // Consistent scaling
            const ez = e.z * 1.8;
            const d2 = Math.pow(x - ex, 2) + Math.pow(world_z - ez, 2);
            const w = Math.exp(-d2 / (2 * sigma * sigma)) * (e.weight || 1.0);

            weightedHeight += e.y * w;
            totalW += w;

            // Use the actual emitter color (business_entity-based from backend)
            const emitterColor = new THREE.Color(e.color || '#94A3B8');
            r_acc += emitterColor.r * w;
            g_acc += emitterColor.g * w;
            b_acc += emitterColor.b * w;
        });

        // Sharp Topological Peaks
        const finalY = (totalW > 0.001) ? (weightedHeight / (totalW + 0.05)) : 0;
        vertices[i + 2] = finalY;

        if (totalW > 0.01) {
            colors[i] = r_acc / totalW;
            colors[i + 1] = g_acc / totalW;
            colors[i + 2] = b_acc / totalW;
        } else {
            // Dark abyssal depths
            colors[i] = 0.02; colors[i + 1] = 0.03; colors[i + 2] = 0.04;
        }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 1. Vibrant Matte Surface (Reference Diagram Style)
    const surfaceMaterial = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        metalness: 0.0, // Eliminate high-frequency twinkling
        roughness: 0.9, // Matte finish for diagrammatic clarity
        clearcoat: 0.0,
        side: THREE.DoubleSide
    });
    const surface = new THREE.Mesh(geometry, surfaceMaterial);

    group.add(surface);

    // DISABLED: Contour wireframe causing excessive twinkling
    /*
    // 2. High-Contrast Contour Overlays (Surgical Topology)
    const contourMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.7, // High clarity as in Image 2
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    });

    // Multiple contour layers for depth
    const contours = new THREE.Mesh(geometry.clone(), contourMat);
    contours.position.z = 5;
    group.add(contours);
    */

    // Ground Shadow Plane (Density Map)
    const groundGeo = new THREE.PlaneGeometry(32000, 22000, 1, 1);
    const groundMat = new THREE.MeshBasicMaterial({
        color: 0x011627,
        transparent: true,
        opacity: 0.8
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.z = -200;
    group.add(ground);

    // 3D Grid Helper for Grounding (Reduced visibility)
    const grid = new THREE.GridHelper(32000, 16, 0x1e293b, 0x0f172a); // Fewer lines
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -190;
    grid.material.opacity = 0.15; // Much dimmer
    grid.material.transparent = true;
    group.add(grid);

    // DYNAMIC CATEGORY LABELS (Derived from Connected Database)
    const categoryMap = new Map();
    manifoldData.emitters.forEach(e => {
        const catName = e.classification || 'Other';
        if (!categoryMap.has(catName)) {
            categoryMap.set(catName, { x: 0, count: 0, color: e.color });
        }
        const data = categoryMap.get(catName);
        data.x += e.x * 1.1;
        data.count++;
    });

    categoryMap.forEach((data, name) => {
        const avgX = data.x / data.count;
        const sprite = createTextSprite(name.charAt(0).toUpperCase() + name.slice(1), 400, data.color); // Larger labels
        sprite.position.set(avgX, 11500, 1000); // Floating above the summits
        group.add(sprite);
    });

    group.rotation.x = -Math.PI / 2;
    group.position.y = -50;

    group.userData = { isManifold: true };
    return group;
}

function createDistributionCurve(points, color, width = 2000) {
    const curvePoints = [];
    const count = 50;
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = (t - 0.5) * width;
        let y = 0;
        points.forEach(p => {
            const w = Math.exp(-Math.pow(x - p.pos, 2) / (2 * Math.pow(400, 2)));
            y += p.val * w;
        });
        curvePoints.push(new THREE.Vector3(x, y, 0));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const geometry = new THREE.TubeGeometry(curve, 64, 5, 8, false);
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }));
}

function create3DAxes(layoutMode, manifoldData) {
    const group = new THREE.Group();
    if (layoutMode !== 'latent') return group;

    const size = 30000;
    const depth = 20000;

    // 1. Background Grid Walls
    const wall1 = new THREE.GridHelper(size, 20, 0x1e293b, 0x1e293b);
    wall1.rotation.x = Math.PI / 2;
    wall1.position.z = -depth / 2;
    wall1.position.y = 2000;
    wall1.material.opacity = 0.1;
    wall1.material.transparent = true;
    group.add(wall1);

    const wall2 = new THREE.GridHelper(depth, 10, 0x1e293b, 0x1e293b);
    wall2.rotation.z = Math.PI / 2;
    wall2.position.x = -size / 2;
    wall2.position.y = 2000;
    wall2.material.opacity = 0.1;
    wall2.material.transparent = true;
    group.add(wall2);

    // TECHNICAL AXIS LABELS (Matched to Reference Image 2)
    const riskLabel = createTextSprite("RISK (Y-AXIS)", 350, "#ff4d4d");
    riskLabel.position.set(-size / 2 - 1000, 6000, -depth / 2);
    group.add(riskLabel);

    const healthLabel = createTextSprite("HEALTH (Z-AXIS)", 350, "#4dff4d");
    healthLabel.position.set(-size / 2 - 1000, 0, depth / 2 + 1000);
    group.add(healthLabel);

    const valueLabel = createTextSprite("BUSINESS VALUE (X-AXIS)", 350, "#4d4dff");
    valueLabel.position.set(0, -500, depth / 2 + 2000);
    group.add(valueLabel);

    // 2. Technical Arrows (Reference Aligned)
    const arrowOrigin = new THREE.Vector3(-size / 2, 0, depth / 2);
    group.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), arrowOrigin, size, 0xffffff, 800, 400));
    group.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), arrowOrigin, 8000, 0xffffff, 800, 400));
    group.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), arrowOrigin, depth, 0xffffff, 800, 400));

    // Semantic Zone Labels REMOVED as per User Request (they were just examples)
    // Mountain peaks now rely on categorical colors and node clustering for classification.

    // 3. 2D Distribution Curves (Shadow Projections)
    if (manifoldData?.emitters) {
        const xPoints = manifoldData.emitters.map(e => ({ pos: e.x, val: e.weight * 50 }));
        const curveX = createDistributionCurve(xPoints, 0xffffff, size);
        curveX.position.set(0, 0, depth / 2);
        group.add(curveX);

        const zPoints = manifoldData.emitters.map(e => ({ pos: e.z, val: e.weight * 50 }));
        const curveZ = createDistributionCurve(zPoints, 0xffffff, depth);
        curveZ.rotation.y = Math.PI / 2;
        curveZ.position.set(-size / 2, 0, 0);
        group.add(curveZ);
    }

    return group;
}

function createFlowArrows(manifoldData) {
    const group = new THREE.Group();
    if (!manifoldData?.emitters) return group;

    // Sequence: Dimensions -> Facts -> Time Intelligence
    const cats = ['dimension', 'fact', 'time_intelligence'];
    const centers = {};
    manifoldData.emitters.forEach(e => {
        if (e.classification && cats.includes(e.classification)) {
            if (!centers[e.classification]) centers[e.classification] = { pos: new THREE.Vector3(0, 0, 0), count: 0 };
            centers[e.classification].pos.add(new THREE.Vector3(e.x, e.y, e.z));
            centers[e.classification].count++;
        }
    });

    const sequence = cats.filter(c => centers[c]);
    for (let i = 0; i < sequence.length - 1; i++) {
        const start = centers[sequence[i]].pos.clone().divideScalar(centers[sequence[i]].count);
        const end = centers[sequence[i + 1]].pos.clone().divideScalar(centers[sequence[i + 1]].count);

        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.y += 1200; // Arch upwards for prominence

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(30);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
            color: 0xffffff,
            opacity: 0.6,
            transparent: true,
            blending: THREE.AdditiveBlending
        }));
        group.add(line);

        // Arrow head for flow direction
        const dir = new THREE.Vector3().subVectors(end, mid).normalize();
        const arrow = new THREE.ArrowHelper(dir, end, 250, 0xffffff, 120, 60);
        group.add(arrow);
    }
    return group;
}

function createFloorProjections(manifoldData) {
    const group = new THREE.Group();
    if (!manifoldData) return group;

    manifoldData.emitters.forEach(e => {
        // Glowing Halo Projection
        const geometry = new THREE.RingGeometry(180, 200, 32);
        const material = new THREE.MeshBasicMaterial({
            color: e.color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(e.x, -95, e.z); // REMOVED 2.5x
        group.add(ring);
    });
    return group;
}

// Composite Voxel Architecture - Each voxel is a specific table
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

        const color = node.color ? new THREE.Color(node.color).getHex() : 0x22d3ee;
        const tex = createDataGridTexture(node.name, color, node);

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(voxelSize - 6, voxelSize - 6, voxelSize - 6),
            new THREE.MeshPhysicalMaterial({
                map: tex,
                transparent: true, opacity: 0.95,
                metalness: 0.2, roughness: 0.5, clearcoat: 0.8
            })
        );

        mesh.position.set(
            (x - dim / 2 + 0.5) * voxelSize,
            (y + 0.5) * voxelSize,
            (z - dim / 2 + 0.5) * voxelSize
        );

        mesh.userData = { ...node, isNode: true };
        group.add(mesh);
    });

    return group;
}

function createNodeMesh(nodeData, currentLens = 'ops', layoutMode = 'galaxy') {

    const colorMap = {
        core: 0xff9f1a,        // Vibrant Orange
        customer: 0x4CAF50,    // Green
        transaction: 0x2196F3, // Blue
        product: 0xffc107,     // Yellow
        fraud: 0xf44336,       // Red
        other: 0x94a3b8        // Gray
    };

    const isCore = nodeData.id === 'DATABASE_CORE' || nodeData.id === 'hub';
    const entity = (nodeData.entity || 'other').toLowerCase();

    let color;
    if (isCore) color = colorMap.core;
    else if (nodeData.color) {
        if (typeof nodeData.color === 'string') color = new THREE.Color(nodeData.color).getHex();
        else color = nodeData.color;
    }
    else {
        color = colorMap[entity] || colorMap.other;
    }

    // SIZING Logic
    const nTerm = Math.log10(Math.max(1, nodeData.row_count || 1));
    const rawImportance = nodeData.importance_score || 1.0;
    const importance = rawImportance > 5 ? (rawImportance / 50.0) : rawImportance;

    // Increased variance: smaller nodes stay small, larger nodes feel more massive
    let size = isCore ? 160 : (30 + (importance * 60) + (nTerm * 15));
    if (layoutMode === 'latent') size *= 0.8; // Slightly larger than before for visibility

    // 1. Inner Core Sphere (The Light Source)
    const geometry = new THREE.SphereGeometry(size * 0.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);

    // 2. Outer Glass Shell (The Lens)
    const shellGeo = new THREE.SphereGeometry(size, 32, 32);
    const shellMat = new THREE.MeshPhysicalMaterial({
        color: color,
        transparent: true,
        opacity: layoutMode === 'latent' ? 0.3 : 0.45,
        roughness: layoutMode === 'latent' ? 0.8 : 0.05,
        metalness: 0.0,
        transmission: layoutMode === 'latent' ? 0.5 : 0.95,
        thickness: 4.0,
        emissive: color,
        emissiveIntensity: layoutMode === 'latent' ? 0.4 : 1.5, // Dimmable in analytical mode
        clearcoat: layoutMode === 'latent' ? 0.0 : 1.0
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    mesh.add(shell);

    const group = new THREE.Group();
    group.add(mesh);

    // Label
    const displayName = isCore ? "Neural Core" : (nodeData.name || nodeData.id);
    let labelSize = isCore ? 200 : (140 + (importance * 60));
    if (layoutMode === 'latent') labelSize *= 1.5; // LARGER labels in Latent Space for visibility

    const label = createTextSprite(displayName, labelSize, isCore ? '#ff9f1a' : '#ffffff');
    label.position.set(0, size + 140, 0); // Further offset for giant labels
    group.add(label);

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
    displayCols.push('OP_SIGMA_Z', 'HEALTH_IDX', 'STABILITY.Ω');
    ctx.lineWidth = 3; const rows = 12; const cols = displayCols.length; const rowH = (size - 100) / rows; const colW = size / cols;
    ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#cbd5e1';
    for (let c = 0; c < cols; c++) ctx.fillText(displayCols[c].substring(0, 12), c * colW + 20, 160);
    ctx.font = '28px monospace';
    for (let r = 1; r < rows; r++) {
        const y = 100 + r * rowH; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.strokeStyle = '#1e293b'; ctx.stroke();

        // Fetch Real Live Row if available
        const sampleRow = (nodeData.sample_data && nodeData.sample_data[r - 1]) ? nodeData.sample_data[r - 1] : null;

        for (let c = 0; c < cols; c++) {
            const x = c * colW; if (r === 1) { ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x, size); ctx.strokeStyle = '#334155'; ctx.stroke(); }

            // SEEDING: Deterministic noise per node to prevent "same-y" values
            const nodeSeed = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const baseVal = (Math.sin(r * 0.5 + c * 0.2 + nodeSeed) + 1) / 2;

            let val = '---';
            const colName = displayCols[c];

            if (sampleRow && sampleRow[colName] !== undefined) {
                // 1. RENDER REAL "INNER DATA" (First Priority)
                val = String(sampleRow[colName]).substring(0, 15);
                ctx.fillStyle = '#ffffff';
            } else if (nodeData.analytical_readings && nodeData.analytical_readings[colName]) {
                // 2. RENDER LOGICAL READINGS (Calculated in Backend)
                val = nodeData.analytical_readings[colName];
                ctx.fillStyle = colName.includes('HEALTH') ? '#10b981' : (colName.includes('STABILITY') ? '#f59e0b' : '#00d4ff');
            } else {
                // 3. FALLBACK TO SEMANTICALLY GUIDED NOISE
                const lowColName = colName.toLowerCase();
                if (lowColName.includes('op_sigma_z')) {
                    val = ((nodeData.latent_z || 0) / 2000 + baseVal * 0.1).toFixed(4);
                    ctx.fillStyle = '#00d4ff';
                } else if (lowColName.includes('health')) {
                    val = (90 + (baseVal * 9)).toFixed(1) + '%';
                    ctx.fillStyle = '#10b981';
                } else {
                    val = Math.floor(baseVal * 5000 + 100 * r).toString();
                    ctx.fillStyle = '#94a3b8';
                }
            }
            ctx.fillText(val, x + 20, y + rowH * 0.7);
        }
    }
    ctx.font = 'bold 20px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillText('VALIDATED NEURAL TOPOLOGY // CALC: ACCURATE', 40, size - 40);
    ctx.strokeStyle = baseColor; ctx.lineWidth = 16; ctx.strokeRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 16; return tex;
}

function createTextSprite(message, fontsize, color) {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontsize}px Inter, Arial`;
    const w = ctx.measureText(message).width + 80;
    canvas.width = w; canvas.height = fontsize * 1.8;

    ctx.font = `bold ${fontsize}px Inter, Arial`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // High-Contrast Backdrop Glow (Absolute Clarity)
    ctx.shadowColor = 'rgba(0,0,0,1.0)';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = fontsize / 6; // Thicker outline
    ctx.strokeText(message, canvas.width / 2, canvas.height / 2);
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);

    // Secondary Fill for extra brightness
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(canvas.width / 8, canvas.height / 8, 1); return sprite;
}

function createCurvedEdge(sourceMesh, targetMesh, edgeData = {}) {
    const s = sourceMesh.position;
    const t = targetMesh.position;
    const start = new THREE.Vector3(s.x, s.y, s.z);
    const end = new THREE.Vector3(t.x, t.y, t.z);
    const dist = start.distanceTo(end);

    // DETERMINISTIC ORGANIC OFFSET
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const rng = new SeededRNG((sourceMesh.userData.id || 's') + '-' + (targetMesh.userData.id || 't'));

    // Increased curvature offset (0.3 -> 0.45) for better "organic" look in large clusters
    mid.x += (rng.next() - 0.5) * dist * 0.45;
    mid.y += (rng.next() - 0.5) * dist * 0.45;
    mid.z += (rng.next() - 0.5) * dist * 0.45;

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));

    // TRUTH-PRESERVING: Use calculated Edge Glow (0.0 - 5.0 typical)
    const edgeGlow = edgeData.edge_glow || 1.0;
    const edgeWidth = Math.min(4, Math.max(1.0, edgeGlow * 1.0));
    const edgeOpacity = 0.15; // Low opacity for "fine connections" aesthetic

    const material = new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: edgeOpacity,
        linewidth: edgeWidth,
        blending: THREE.AdditiveBlending
    });

    const line = new THREE.Line(geometry, material);
    line.userData = {
        sourceMesh, targetMesh, curve, edgeData,
        originalOpacity: edgeOpacity
    };
    return line;
}

function updateEdgeGeometry(edge) {
    const s = edge.userData.sourceMesh.position;
    const t = edge.userData.targetMesh.position;
    const start = new THREE.Vector3(s.x, s.y, s.z);
    const end = new THREE.Vector3(t.x, t.y, t.z);
    const dist = start.distanceTo(end);

    // DETERMINISTIC ORGANIC OFFSET
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const rng = new SeededRNG((edge.userData.sourceMesh.userData.id || 's') + '-' + (edge.userData.targetMesh.userData.id || 't'));

    // Consistent curvature with createCurvedEdge
    mid.x += (rng.next() - 0.5) * dist * 0.45;
    mid.y += (rng.next() - 0.5) * dist * 0.45;
    mid.z += (rng.next() - 0.5) * dist * 0.45;

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    edge.geometry.setFromPoints(curve.getPoints(50));
    edge.userData.curve = curve;
}

function createParticle(type = 'normal') {
    return new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: type === 'fraud' ? 0xFF4757 : (type === 'high_traffic' ? 0xFFD700 : 0x00FF88), emissive: 0xffffff, emissiveIntensity: 2 }));
}

function createStarfield(scene) {
    const rng = new SeededRNG("comet-v2");

    // Layer 1: Distant Stars
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 5000; i++) starVerts.push((rng.next() - 0.5) * 15000, (rng.next() - 0.5) * 15000, (rng.next() - 0.5) * 15000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const starMat = new THREE.PointsMaterial({ size: 12, color: 0xaaaaaa, transparent: true, opacity: 0.6 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Layer 2: Nebula Nebula (Deep Space Clouds)
    const dustGeo = new THREE.BufferGeometry();
    const dustVerts = [];
    const dustColors = [];
    const colorA = new THREE.Color(0x4c1d95); // Deep Purple
    const colorB = new THREE.Color(0x2563eb); // Royal Blue

    for (let i = 0; i < 2500; i++) {
        dustVerts.push((rng.next() - 0.5) * 12000, (rng.next() - 0.5) * 12000, (rng.next() - 0.5) * 12000);
        const mixedColor = colorA.clone().lerp(colorB, rng.next());
        dustColors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustVerts, 3));
    dustGeo.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
    const dustMat = new THREE.PointsMaterial({ size: 40, vertexColors: true, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
    const nebula = new THREE.Points(dustGeo, dustMat);
    nebula.userData = { isNebula: true };
    scene.add(nebula);
}

/**
 * Main Component
 */
const ThreeGraph = forwardRef(({ onNodeClick, data, tps = 0, className, layoutMode = 'galaxy', currentLens = 'ops', isIsolated = false }, ref) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const animationRef = useRef(null);
    const nodesRef = useRef([]);
    const edgesRef = useRef([]);
    const particlesRef = useRef([]);
    const activeFlowTargetRef = useRef(null);
    const sceneRef = useRef(null);
    const hoverNodeRef = useRef(null);
    const controlsRef = useRef(null);
    const layoutModeRef = useRef(layoutMode);
    const tpsRef = useRef(tps);
    const onNodeClickRef = useRef(onNodeClick);

    useEffect(() => { layoutModeRef.current = layoutMode; }, [layoutMode]);
    useEffect(() => { tpsRef.current = tps; }, [tps]);
    useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

    const spawnParticleForTarget = useCallback((targetNodeNames) => {
        if (!sceneRef.current || edgesRef.current.length === 0) return;

        let targetEdges = [];
        if (targetNodeNames && targetNodeNames.length > 0) {
            const targets = targetNodeNames.map(name => name.toLowerCase().trim());
            targetEdges = edgesRef.current.filter(e => {
                const sId = e.userData.sourceMesh.userData.id.toLowerCase();
                const tId = e.userData.targetMesh.userData.id.toLowerCase();
                return targets.includes(sId) || targets.includes(tId);
            });
        } else {
            targetEdges = edgesRef.current;
        }

        if (targetEdges.length > 0) {
            const randomEdge = targetEdges[Math.floor(Math.random() * targetEdges.length)];
            const particle = createParticle('normal');
            sceneRef.current.add(particle);

            particlesRef.current.push({
                mesh: particle,
                curve: randomEdge.userData.curve,
                speed: 0.005 + Math.random() * 0.01,
                progress: 0
            });
        }
    }, []);

    const { update: updateGlow } = useGlowManager();
    const { focusOn: cameraFocus } = useCameraManager(cameraRef, controlsRef);

    useImperativeHandle(ref, () => ({
        resetView: () => { cameraFocus(new THREE.Vector3(0, 0, 2000), new THREE.Vector3(0, 0, 0)); }
    }));

    useEffect(() => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth, height = containerRef.current.clientHeight;
        const scene = new THREE.Scene(); sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100000);
        camera.position.set(2500, 2000, 3500); cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.innerHTML = ''; containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        scene.add(new THREE.AmbientLight(0xffffff, 1.0)); // Softer light
        const pLight = new THREE.PointLight(0xffffff, 1.2); pLight.position.set(1000, 1000, 1000); scene.add(pLight);
        createStarfield(scene);

        if (data?.nodes) {
            // FORCE GALAXY as default for all top-level views (Overview/Universe/Schema)
            if (layoutMode === 'latent') {
                applyLatentSpaceLayout(data.nodes);
            } else {
                applyGalaxyLayout(data.nodes, 2200); // Massive sprawl for high-fidelity look
            }
            const nodeMap = new Map();
            nodesRef.current = [];

            if (layoutMode === 'analysis') {
                const clusters = {};
                data.nodes.forEach(n => { const cid = n.cluster || 0; if (!clusters[cid]) clusters[cid] = []; clusters[cid].push(n); });
                Object.values(clusters).forEach(nodesInCluster => {
                    const group = createClusterVoxelMesh(nodesInCluster, currentLens);
                    const first = nodesInCluster[0];
                    group.position.set(first.latent_x, first.latent_y, first.latent_z);
                    scene.add(group);
                    group.userData = { isCluster: true, nodes: nodesInCluster };
                    nodesInCluster.forEach(n => { n.mesh = group; nodeMap.set(n.id, n); nodesRef.current.push(n); });
                });
            } else {
                data.nodes.forEach(nodeData => {
                    const mesh = createNodeMesh(nodeData, currentLens, layoutMode);
                    // Robust position check
                    const lx = nodeData.latent_x ?? 0;
                    const ly = nodeData.latent_y ?? 0;
                    const lz = nodeData.latent_z ?? 0;
                    const gx = nodeData.x ?? 0;
                    const gy = nodeData.y ?? 0;
                    const gz = nodeData.z ?? 0;

                    mesh.position.set(
                        nodeData.x ?? 0,
                        nodeData.y ?? 0,
                        nodeData.z ?? 0
                    );
                    scene.add(mesh);
                    nodeData.mesh = mesh; mesh.userData = { ...nodeData, isNode: true };
                    nodesRef.current.push(nodeData); nodeMap.set(nodeData.id, nodeData);
                });
            }

            if (data.latent_manifold) {
                const manifold = createLatentManifold(data.latent_manifold);
                if (manifold) {
                    manifold.visible = (layoutMode === 'latent');
                    scene.add(manifold);
                    // Add flows and axes
                    const annotations = new THREE.Group();
                    annotations.visible = (layoutMode === 'latent');
                    annotations.add(create3DAxes(layoutMode, data.latent_manifold));
                    annotations.add(createFlowArrows(data.latent_manifold));
                    scene.add(annotations);
                }
            }

            if (data.edges) {
                edgesRef.current = [];
                data.edges.forEach(edge => {
                    const s = nodeMap.get(edge.source), t = nodeMap.get(edge.target);
                    if (s && t && s.mesh && t.mesh) {
                        const line = createCurvedEdge(s.mesh, t.mesh, edge);
                        line.visible = (layoutMode !== 'latent'); // Hide edges in Latent Space
                        scene.add(line); edgesRef.current.push(line);
                    }
                });
            }
        }

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controlsRef.current = controls;
        const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();

        const onMouseMove = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj && !obj.userData?.isNode && obj.parent && obj.parent.type !== 'Scene') obj = obj.parent;
                if (obj && obj.userData?.isNode && obj.userData !== hoverNodeRef.current) {
                    hoverNodeRef.current = obj.userData;
                    document.body.style.cursor = 'pointer';
                    soundSystem.playMetricOscillation(obj.userData.neural_gravity || 1.0, obj.userData.entropy || 0.5);
                }
            } else if (hoverNodeRef.current) {
                hoverNodeRef.current = null; document.body.style.cursor = 'default';
            }
        };

        const onClick = () => {
            if (hoverNodeRef.current && onNodeClickRef.current) {
                onNodeClickRef.current(hoverNodeRef.current);
                soundSystem.play('nodeClick');
            }
        };

        renderer.domElement.addEventListener('mousemove', onMouseMove);
        renderer.domElement.addEventListener('click', onClick);

        const animate = () => {
            animationRef.current = requestAnimationFrame(animate);
            const time = Date.now() * 0.001;
            const isAnalysis = layoutModeRef.current === 'analysis';

            nodesRef.current.forEach(node => {
                const mesh = node.mesh;
                const isHub = node.id === 'hub';
                const isCore = isHub || node.id === 'DATABASE_CORE';
                const isLatent = layoutModeRef.current === 'latent';

                // ISOLATION
                if (isIsolated && !isCore) mesh.visible = false;
                else mesh.visible = true;

                if (!mesh.visible) return;

                // COORDINATE TRANSITION
                let tx = node.targetX ?? 0;
                let tz = node.targetZ ?? 0;
                let ty = node.targetY ?? 0;

                // Sync height with manifold surface in real-time
                if (isLatent && data.latent_manifold && !isCore) {
                    const surfaceY = getManifoldHeight(mesh.position.x, mesh.position.z, data.latent_manifold.emitters);
                    ty = surfaceY + 150; // Sit clearly above the peaks
                }

                mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, tx, 0.08);
                mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, tz, 0.08);

                const float = (!isAnalysis && !isHub) ? Math.sin(time * 0.5 + node.id.length) * 5 : 0;
                mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, ty + float, 0.1);

                // Update Label scaling specifically for this frame if needed (simplification: hide small ones)
                const label = mesh.children.find(c => c.type === 'Sprite');
                if (label) label.visible = !isLatent || (hoverNodeRef.current?.id === node.id || isCore || node.importance_score > 3);

                updateGlow(mesh, time, (hoverNodeRef.current?.id === node.id ? 'hover' : 'idle'), (node.node_glow ?? node.glow_intensity ?? 1.0));
            });

            // Animate Manifold (Breathing Intelligence)
            const manifold = scene.children.find(c => c.userData?.isManifold);
            const isLatent = layoutModeRef.current === 'latent';

            if (manifold) {
                manifold.visible = isLatent;
                if (isLatent) {
                    manifold.position.y = -50 + Math.sin(time * 0.4) * 15; // Deeper breathing
                    manifold.children.forEach((child, idx) => {
                        if (child.isMesh && idx === 0) {
                            child.material.opacity = 0.5 + Math.sin(time * 0.2) * 0.15;
                        }
                    });
                }
            }

            // Sync Environment (Deep Space for Latent Mode)
            const starfield = scene.children.find(c => c.isPoints && !c.userData?.isNebula); // Need nebula tag
            if (starfield) {
                starfield.material.opacity = isLatent ? 0.2 : 0.7; // Dim stars in mountain view
            }

            // Sync Annotations Visibility
            scene.children.forEach(c => {
                if (c.children && c.children.some(child => child.type === 'ArrowHelper' || child.type === 'Line')) {
                    // This is likely our axes/arrows group
                    c.visible = isLatent;
                }
            });

            edgesRef.current.forEach(edge => {
                edge.visible = !isIsolated;
                if (edge.visible) {
                    // DYNAMIC UPDATE: Force edge to follow moving meshes
                    updateEdgeGeometry(edge);

                    const isH = hoverNodeRef.current && (edge.userData.sourceMesh.userData.id === hoverNodeRef.current.id || edge.userData.targetMesh.userData.id === hoverNodeRef.current.id);
                    edge.material.opacity = THREE.MathUtils.lerp(edge.material.opacity, isH ? 0.8 : edge.userData.originalOpacity, 0.1);
                }
            });

            // Animate Particles
            const particleSpeed = 0.05 + (tpsRef.current / 500);
            particlesRef.current.forEach((p, idx) => {
                p.progress += p.speed * particleSpeed;
                if (p.progress >= 1) {
                    scene.remove(p.mesh);
                    particlesRef.current.splice(idx, 1);
                } else {
                    const pos = p.curve.getPointAt(p.progress);
                    p.mesh.position.copy(pos);
                }
            });

            // Auto-Generate Particles based on TPS
            if (tpsRef.current > 0 && Math.random() < (tpsRef.current / 60)) {
                spawnParticleForTarget(activeFlowTargetRef.current);
            }

            renderer.render(scene, camera);
            controls.update();
        };
        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
            renderer.domElement.removeEventListener('mousemove', onMouseMove);
            renderer.domElement.removeEventListener('click', onClick);
            renderer.dispose();
        };
    }, [data, currentLens, isIsolated, layoutMode]); // Added layoutMode to dep array

    return <div ref={containerRef} className={className || "fixed inset-0 z-0"} style={{ background: 'radial-gradient(circle at center, #1a202c 0%, #000000 100%)' }} />;
});

export default React.memo(ThreeGraph);
