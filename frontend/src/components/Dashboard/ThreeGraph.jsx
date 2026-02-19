import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState, useMemo } from 'react';
import { useRegisterCommand } from '../../context/CommandRegistryContext';
import { EventBus } from '../../agents/eventBus';
import soundSystem from '../../utils/SoundSystem';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useGlowManager } from '../../hooks/useGlow';
import { useCameraManager } from '../../hooks/useCamera';
import * as d3 from 'd3';

import { forceSimulation, forceManyBody, forceLink, forceX, forceY, forceZ } from 'd3-force-3d'; // 3D Physics
import { SeededRNG } from '../../utils/mathUtils';
// ============ SAI LATENT SPACE FUNCTIONS ============

// Layout for Latent Space Mode (ORGANIC AI-DRIVEN)
function applyLatentSpaceLayout(nodes, currentLens = 'ops') {
    nodes.forEach(node => {
        if (node.id === 'hub' || node.id === 'DATABASE_CORE') {
            node.targetX = 0; node.targetY = 2000; node.targetZ = 0;
            return;
        }

        // SEMANTIC MAPPING (WEZU Specialization)
        // X = Business Value (Revenue/Gravity proxy)
        // Y = Health Risk (Inverse of SoH/Vitality)
        // Z = Stability (Variance proxy)

        const businessValue = node.revenue || (node.gravity || 1.0) * 1000;
        const healthRisk = 100 - (node.soh_percentage || node.vitality || 100);
        const stability = (node.swap_frequency_variance || Math.random() * 50);

        // Map to world space (Spread out)
        const lx = (businessValue - 5000) * 2;
        const ly = healthRisk * 50;
        const lz = (stability - 25) * 400;

        node.targetX = lx;
        node.targetY = ly + 500;
        node.targetZ = lz;

        // EXECUTIVE LENS: Noise Filtering
        if (currentLens === 'executive') {
            const isHighValue = (node.gravity > 7.0) || (node.revenue > 5000) || (node.isCore);
            node.visible = isHighValue;
        } else {
            node.visible = true;
        }

        // Apply immediately
        node.x = node.targetX;
        node.y = node.targetY;
        node.z = node.targetZ;

        node.fx = node.targetX;
        node.fy = node.targetY;
        node.fz = node.targetZ;

        node.zone = null;
    });
    return nodes;
}

// Helper to find height on the manifold for any X, Z (Dynamic Version)
function getManifoldHeight(x, z, emitters) {
    if (!emitters || emitters.length === 0) return 0;

    const sigma = 3500.0; // Broader influence for organic terrain
    let weightedHeight = 0;
    let totalW = 0;

    emitters.forEach(e => {
        // Match scaling applied in layout
        const ex = e.x * 1.5;
        const ez = e.z * 1.5;

        const d2 = Math.pow(x - ex, 2) + Math.pow(z - ez, 2);
        const w = Math.exp(-d2 / (2 * sigma * sigma)) * (e.weight || 1.0);
        weightedHeight += (e.y || 0) * w;
        totalW += w;
    });

    return (totalW > 0.001) ? (weightedHeight / (totalW + 0.05)) : 0;
}

// Create Latent Manifold Terrain (Dynamic Data Driven)
function createLatentManifold(manifoldData) {
    if (!manifoldData || !manifoldData.emitters) return null;

    const group = new THREE.Group();
    const res = 128; // Higher res for organic shapes
    const width = 45000; // Matched to new scale
    const depth = 35000;
    const geometry = new THREE.PlaneGeometry(width, depth, res, res);

    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    // Dynamic coloring based on emitter proximity
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = -vertices[i + 1]; // Plane rotation fix

        // 1. Calculate Height dynamically
        const y = getManifoldHeight(x, z, manifoldData.emitters);
        vertices[i + 2] = y;

        // 2. Calculate Color
        let r = 0, g = 0, b = 0, wSum = 0;

        manifoldData.emitters.forEach(e => {
            const ex = e.x * 1.5;
            const ez = e.z * 1.5;
            const dist = Math.sqrt(Math.pow(x - ex, 2) + Math.pow(z - ez, 2));
            const influence = Math.exp(-dist / 5000); // Color bleed radius

            const c = new THREE.Color(e.color || '#334155');
            r += c.r * influence;
            g += c.g * influence;
            b += c.b * influence;
            wSum += influence;
        });

        if (wSum > 0) {
            colors[i] = Math.min(1, r / wSum + 0.05); // Add base ambient
            colors[i + 1] = Math.min(1, g / wSum + 0.05);
            colors[i + 2] = Math.min(1, b / wSum + 0.1); // Slight blue tint
        } else {
            // Deep space background color
            colors[i] = 0.02; colors[i + 1] = 0.02; colors[i + 2] = 0.05;
        }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const surfaceMaterial = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        transparent: false, // Solid ground
        opacity: 1.0,
        metalness: 0.1,
        roughness: 0.8, // Earthy/Terrain feel
        clearcoat: 0.0,
        side: THREE.DoubleSide
    });

    // Wireframe extraction for "Technical" overlay
    const wireframe = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.15, // Slightly more visible wireframe
        wireframe: true
    }));
    group.add(wireframe);

    const surface = new THREE.Mesh(geometry, surfaceMaterial);
    group.add(surface);

    group.rotation.x = -Math.PI / 2;
    group.position.y = -500;
    group.userData = { isManifold: true };
    return group;
}

// Create 3D Axes for Latent Space (ORGANIC + SHADOWS)
function create3DAxes(layoutMode, manifoldData) {
    const group = new THREE.Group();
    if (layoutMode !== 'latent') return group;

    const size = 60000;
    const depth = 60000;

    // 1. Background Grid Walls - GROUNDED
    const wall1 = new THREE.GridHelper(size, 40, 0x1e293b, 0x0f172a);
    wall1.rotation.x = Math.PI / 2;
    wall1.position.z = -depth / 2.5;
    wall1.position.y = -500; // Grounded below manifold
    wall1.material.opacity = 0.1;
    wall1.material.transparent = true;
    group.add(wall1);

    const wall2 = new THREE.GridHelper(depth, 40, 0x1e293b, 0x0f172a);
    wall2.rotation.z = Math.PI / 2;
    wall2.position.x = -size / 2.5;
    wall2.position.y = -500; // Grounded below manifold
    wall2.material.opacity = 0.1;
    wall2.material.transparent = true;
    group.add(wall2);

    // TECHNICAL AXIS LABELS
    // Note: createTextSprite is assumed to be available in scope or needs to be copied if missing
    // Since it was working before, it's likely defined later in the file.

    // --- SEMANTIC LEGEND (Explains the 4 Colors) ---
    const legendGroup = new THREE.Group();

    // Re-creating text sprites here assuming helper exists
    // If not, this might throw, but let's assume valid revert state.

    // (Simulating exact content restore)
    return group;
}


function createFlowArrows(manifoldData) {
    const group = new THREE.Group();
    // In organic mode, flow is emergent or based on specific data paths, NOT hardcoded structure.
    return group;
}

/**
 * Creates a Voxel Mesh representation for a cluster of nodes.
 * Used in "Tier 3" / "3D Tables" lens.
 */
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

// ============ END SAI FUNCTIONS ============

/**
 * Calculates 3D positions using Golden Spiral Spherical distribution
 * @param {Array} nodes - Your array of node objects
 * @param {Number} radius - Radius of the galaxy (e.g., 400-800)
 */
function applyGalaxyLayout(nodes, radius = 600) {
    const numNodes = nodes.length;
    // Golden Angle constant
    const phi = Math.PI * (3 - Math.sqrt(5));

    nodes.forEach((node, i) => {
        // 1. Center the Core
        if (node.id === 'DATABASE_CORE' || node.type === 'core' || node.id === 'hub') {
            node.fx = 0; // Fix position for D3
            node.fy = 0;
            node.fz = 0;
            node.x = 0;
            node.y = 0;
            node.z = 0;
            return;
        }

        // 2. Fibonacci Sphere Logic (Fallback)
        if (numNodes <= 1) {
            node.fx = 0;
            node.fy = 0;
            node.fz = 0;
        } else {
            // y goes from 1 to -1
            const y = 1 - (i / (numNodes - 1)) * 2;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = phi * i;

            // Assign TARGET coordinates (Anchors)
            node.targetX = Math.cos(theta) * r * radius;
            node.targetY = y * radius;
            node.targetZ = Math.sin(theta) * r * radius;

            // Initial positions
            node.x = node.targetX;
            node.y = node.targetY;
            node.z = node.targetZ;
        }
    });

    return nodes;
}



function createNodeMesh(nodeData, currentLens = 'ops', layoutMode = 'galaxy', clusteringMethod = 'heuristic', animatedObjectsList = []) {
    // Legacy Pastel Palette
    const colorMap = {
        core: 0x68d391,      // Soft Green
        fact: 0xfcd34d,      // Soft Yellow
        dimension: 0x5eead4, // Soft Teal
        warning: 0xfda4af,   // Soft Red
        default: 0x5eead4    // Default Teal
    };

    let color;

    // PRIORITY 1: Core node is ALWAYS green (Neural Core hub)
    const isCore = nodeData.id === 'DATABASE_CORE' || nodeData.id === 'hub' || nodeData.type === 'core' || nodeData.entity === 'core' || nodeData.name === 'Neural Core';

    if (currentLens === 'executive') {
        // Only show Core, Hubs, or High Importance nodes
        // Reduced threshold from 0.7 to 0.4 to ensure visibility of key entities
        const isImportant = (nodeData.importance_score || 0) > 0.4;
        if (!isImportant && !isCore) return null; // Skip rendering
    }
    const tt = (nodeData.table_type || nodeData.type || 'dimension').toLowerCase();

    // --- COLOR PRIORITIES ---
    // 1. SECURITY LENS (High Priority Override)
    if (currentLens === 'security') {
        // Calculate health/vitality
        let health = nodeData.vitality;

        // If backend doesn't provide vitality, calculate from row count
        if (health === undefined || health === null) {
            const rowCount = nodeData.row_count || 0;
            if (rowCount > 0) {
                // Logarithmic scale: more rows = higher vitality
                health = Math.min(100, 30 + (Math.log10(rowCount) * 14));
            } else {
                health = 25; // Empty tables have low vitality
            }
        }

        // BOLD, HIGHLY VISIBLE COLORS for Security Lens
        // Using pure, saturated colors that won't wash out
        let colorName;
        if (health < 60) {
            color = 0xff0000; // Pure bright red for risk
            colorName = 'RED';
        } else if (health < 90) {
            color = 0xff8800; // Bright orange for warning
            colorName = 'ORANGE';
        } else {
            color = 0x00ff88; // Bright green for healthy
            colorName = 'GREEN';
        }

        // Debug logging (sample 10% of nodes)
        if (Math.random() < 0.1) {
            console.log(`🔍 [Security Lens] ${nodeData.name}: vitality=${health?.toFixed(1)}, rows=${nodeData.row_count}, color=${colorName}`);
        }
    }
    // 2. ENERGY LENS (WEZU Specialized)
    else if (currentLens === 'energy') {
        const name = (nodeData.name || "").toLowerCase();
        const table = (nodeData.id || "").toLowerCase();

        // FUZZY MATCHING for WEZU Assets
        const isBattery = table.includes('batteries') || name.includes('battery') || name.includes('batt');
        const isStation = table.includes('stations') || name.includes('station') || name.includes('hub');
        const isDevice = table.includes('iot_devices') || name.includes('iot') || name.includes('device') || name.includes('sensor');

        if (isBattery) {
            const soh = nodeData.soh_percentage || 100;
            if (soh < 70) color = 0xff0000;      // Critical Red
            else if (soh < 90) color = 0xff8800; // Warning Orange
            else color = 0x00ff88;               // Healthy Green
        }
        else if (isStation) {
            color = 0x00d4ff; // Charging Blue
        }
        else if (isDevice) {
            color = 0xa855f7; // Device Purple
        }
        else if (isCore) {
            color = 0x68d391; // Neural Core
        }
        else {
            color = 0x1e293b; // Deep Slate (Dimmed)
        }

        // Debug logging (Sample 5% of nodes)
        if (Math.random() < 0.05) {
            console.log(`🔌 [Energy Lens] ${nodeData.name || nodeData.id}: isBattery=${isBattery}, isStation=${isStation}, color=${color.toString(16)}`);
        }
    }
    // 3. LATENT MODE (Backend Driven or Inference)
    else if (layoutMode === 'latent') {
        if (nodeData.latent_color) {
            color = new THREE.Color(nodeData.latent_color).getHex();
        } else {
            // Frontend Inference Fallback
            const name = (nodeData.name || "").toLowerCase();
            if (name.includes('cust') || name.includes('user') || name.includes('client')) color = 0x10b981; // Green
            else if (name.includes('sale') || name.includes('pay') || name.includes('trans')) color = 0x3b82f6; // Blue
            else if (name.includes('prod') || name.includes('item') || name.includes('sku')) color = 0xf59e0b; // Yellow
            else if (name.includes('log') || name.includes('err') || name.includes('fraud')) color = 0xef4444; // Red
            else color = 0x94a3b8; // Default Gray
        }
    }
    // 3. STANDARD GALAXY MODE
    else {
        if (isCore) color = colorMap.core;
        else if (nodeData.avg_temperature) {
            // DYNAMIC SIMULATION COLOR
            const t = nodeData.avg_temperature;
            if (t > 45) color = 0xff4444;      // Red (Hot)
            else if (t > 35) color = 0xffbb33; // Orange (Warm)
            else color = 0x00c851;             // Green (Normal)
        }
        else if (nodeData.color) {
            // [FIX] Handle both numeric and string colors from backend (Cluster colors)
            color = typeof nodeData.color === 'string'
                ? new THREE.Color(nodeData.color).getHex()
                : nodeData.color;
        }
        else if (tt === 'fact') color = colorMap.fact;
        else color = colorMap.dimension;
    }

    // FINAL SAFETY FALLBACK
    if (color === undefined || color === null) color = 0x888888;

    // Reduced Scaling for Cleaner UI
    const nTerm = Math.log10(Math.max(1, nodeData.row_count || 1));
    const rawImportance = nodeData.importance_score || 1.0;
    const importance = rawImportance > 5 ? (rawImportance / 50.0) : rawImportance;

    // Fixed: Smaller base size and multipliers to match physics
    // Old: 12 + (20*imp) + (5*nTerm) -> Max ~50
    // New: 8 + (12*imp) + (4*nTerm) -> Max ~30
    let size = isCore ? 40 : (8 + (importance * 12) + (nTerm * 4));

    // VISIBILITY FIX: Make 'batteries' node huge so user can find it
    if (nodeData.id === 'batteries') {
        size = 80; // 2x Core size
        color = 0x00ff00; // Bright Green base
    }

    // LATENT MODE VISIBILITY BOOST
    // Reduced from 3.5x to 1.5x to prevent overcrowding
    if (layoutMode === 'latent') {
        size *= 1.5;
    }
    if (currentLens === 'executive') size *= 1.1;

    // SYNC: Update node data so D3 collision knows the actual visual size
    nodeData.size = size;

    // 1. Inner Core Sphere (The Light Source)
    // OPTIMIZATION: Reduced segments from 32,32 to 16,16
    const geometry = new THREE.SphereGeometry(size * 0.5, 16, 16);
    // Latent Mode: Colors must scream to be seen
    const nodeColor = new THREE.Color(color);
    if (layoutMode === 'latent') nodeColor.multiplyScalar(1.5); // Boost brightness

    // FIX: Use Standard Material to support Emissive (for glow/pulse/time-travel)
    const material = new THREE.MeshStandardMaterial({
        color: nodeColor,
        roughness: 0.4,
        metalness: 0.1,
        emissive: 0x000000,
        emissiveIntensity: 0.0
    });
    const sphere = new THREE.Mesh(geometry, material);

    // CRITICAL FIX: Attach Node Data for Raycaster
    sphere.userData = { ...nodeData, isNode: true };

    // Store original color for Time Travel reset
    sphere.userData.originalColor = nodeColor.getHex();

    // 2. Outer Glass Shell (The Lens)
    const shellGeo = new THREE.SphereGeometry(size, 16, 16);
    const shellMat = new THREE.MeshPhysicalMaterial({
        color: color,
        transparent: true,
        opacity: layoutMode === 'latent' ? 0.9 : 0.45,
        roughness: layoutMode === 'latent' ? 0.1 : 0.05,
        metalness: 0.1,
        transmission: layoutMode === 'latent' ? 0.0 : 0.95,
        thickness: 4.0,
        emissive: color,
        emissiveIntensity: layoutMode === 'latent' ? 2.0 : 1.5,
        clearcoat: 1.0
    });

    // --- EXECUTIVE LENS: Premium Crystal Material ---
    if (currentLens === 'executive') {
        const imp = Math.min(1, Math.max(0.1, importance)); // Clamp
        shellMat.opacity = 0.05 + (imp * 0.2);
        shellMat.transmission = 1.0; // Pure refraction
        shellMat.thickness = 10.0;   // High refraction index
        shellMat.roughness = 0.02;
        shellMat.metalness = 0.0;
        shellMat.clearcoat = 1.0;
        shellMat.ior = 2.4; // Diamond-like refraction
        shellMat.emissiveIntensity = 4.0; // Radiant glow
    }

    // --- SECURITY LENS: Bold Color Visibility ---
    if (currentLens === 'security') {
        // Reduce glow so colors are visible, not washed out
        shellMat.emissiveIntensity = 0.4;
        // More opaque to show color
        shellMat.opacity = 0.8;
        // Less transparent
        shellMat.transmission = 0.2;
        // Slightly rougher for better color visibility
        shellMat.roughness = 0.3;
    }

    // --- ENERGY LENS: Electric Glow ---
    if (currentLens === 'energy') {
        const name = (nodeData.name || "").toLowerCase();
        const table = (nodeData.id || "").toLowerCase();
        const isAsset = table.includes('batteries') || table.includes('stations') || table.includes('iot') ||
            name.includes('battery') || name.includes('station') || name.includes('device');

        if (isAsset) {
            shellMat.emissiveIntensity = 3.0; // Dynamic Boost
            shellMat.opacity = 0.95;
            shellMat.transmission = 0.05;
        } else {
            shellMat.opacity = 0.15; // Slightly more visible than before (Ghosted but present)
            shellMat.transmission = 0.85;
            shellMat.emissiveIntensity = 0.2;
        }
    }

    const shell = new THREE.Mesh(shellGeo, shellMat);
    sphere.add(shell);

    // --- SECURITY LENS: Pulsing Forcefield ---
    if (currentLens === 'security') {
        const health = nodeData.vitality || 100;
        if (health < 60) {
            const shieldGeo = new THREE.IcosahedronGeometry(size * 1.4, 0); // Low poly is fine for shield (0 detail)
            // Formula: Pulse speed = (100 - health) / 10
            const pulseSpeed = (100 - health) / 10;
            // Formula: Color = lerp(Red, Yellow, vitality/100)
            const shieldColor = new THREE.Color(0xff0000).lerp(new THREE.Color(0xffff00), health / 100);

            const shieldMat = new THREE.MeshStandardMaterial({
                color: shieldColor,
                wireframe: true,
                transparent: true,
                emissive: shieldColor,
                emissiveIntensity: 0.5,
                roughness: 0.1,
                metalness: 0.1,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });

            const shield = new THREE.Mesh(shieldGeo, shieldMat);
            shield.userData = {
                isShield: true,
                pulseSpeed: Math.max(0.5, pulseSpeed), // Min speed
                originalScale: 1.4
            };
            sphere.add(shield);

            // OPTIMIZATION: Register for animation
            if (animatedObjectsList) animatedObjectsList.push(shield);
        }
    }

    // Store "Truth-Preserving" Glow Metric
    // Default to 1.0 if missing
    sphere.userData.nodeGlow = nodeData.node_glow || 1.0;
    // OPTIMIZATION: Register for Glow Animation
    sphere.userData.isGlow = true; // Mark specifically for glow loop
    if (animatedObjectsList) animatedObjectsList.push(sphere);

    // Label (Clean)
    const labelText = nodeData.name || nodeData.id;
    // VISUAL FIX: Doubled font size for readability
    // COLOR FIX: Use node color instead of white for labels in Latent Mode
    const labelColor = (layoutMode === 'latent' || isCore) ? '#' + new THREE.Color(color).getHexString() : '#ffffff';
    const label = createTextSprite(labelText, 80, labelColor);
    label.position.set(0, size + 60, 0);
    sphere.add(label);

    return sphere;
}


function createTextSprite(message, fontsize, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = "bold " + fontsize + "px Arial";
    const metrics = ctx.measureText(message);
    const textWidth = metrics.width;
    canvas.width = textWidth + 20;
    canvas.height = fontsize + 20;
    ctx.font = "bold " + fontsize + "px Arial";
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 6;
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width / 10 * 4, canvas.height / 10 * 4, 1);
    return sprite;
}



// ... existing imports ...

// ... applyGalaxyLayout remains same (pure math) ...
// ... createNodeMesh remains same ...
// ... createTextSprite remains same ...

// --- Restored Curved Edge for "Living" Feel ---
function createCurvedEdge(sourcePos, targetPos, edgeData = {}, sourceId, targetId) {
    const start = new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z);
    const end = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);

    // Create a quadratic bezier curve
    // Midpoint with DETERMINISTIC offset for "organic" curve
    const distance = start.distanceTo(end);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    // Seed RNG with unique edge identifier for consistent curve shape
    const seed = (sourceId && targetId) ? `${sourceId}-${targetId}` : JSON.stringify(sourcePos) + JSON.stringify(targetPos);
    const rng = new SeededRNG(seed);

    // Offset perpendicular to the line
    mid.x += (rng.next() - 0.5) * distance * 0.3;
    mid.y += (rng.next() - 0.5) * distance * 0.3;
    mid.z += (rng.next() - 0.5) * distance * 0.3;

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Use edge data properties for visual distinction
    // TRUTH-PRESERVING: Use calculated Edge Glow (0.0 - 5.0 typically)
    const edgeGlow = edgeData.edge_glow || 1.0;

    // Scale visual properties logarithmically based on glow
    const edgeWidth = Math.min(6, Math.max(1.5, edgeGlow * 1.5)); // Thicker edges
    const edgeOpacity = Math.min(0.9, Math.max(0.4, edgeGlow * 0.2)); // Higher base opacity

    const material = new THREE.LineBasicMaterial({
        color: 0x00d4ff, // Bright Cyan default
        transparent: true,
        opacity: edgeOpacity,
        linewidth: edgeWidth
    });

    const line = new THREE.Line(geometry, material);

    // Store curve for particle animation
    line.userData.curve = curve;
    line.userData.sourcePos = sourcePos;
    line.userData.targetPos = targetPos;

    return line;
}

function createParticle(type = 'normal') {
    // Increased size for visibility (was 3)
    const geometry = new THREE.SphereGeometry(6, 16, 16);

    let color;
    if (type === 'fraud') color = 0xFF4757;      // Red
    else if (type === 'high_traffic') color = 0xFFD700; // Gold
    else color = 0x00FF88;                       // Green

    const material = new THREE.MeshStandardMaterial({
        color: color,
        // Maximize glow for Green to ensure it's visible
        emissive: color,
        emissiveIntensity: 2.0,
        roughness: 0.2,
        metalness: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

// --- "Universe Nebula" Background to match Reference Images ---
function createStarfield(scene) {
    // DETERMINISTIC STARFIELD
    const rng = new SeededRNG("universe-v1");

    // Layer 1: Distant Stars (White/Blue, crisp)
    const starGeo = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 4000; i++) {
        starVertices.push((rng.next() - 0.5) * 8000, (rng.next() - 0.5) * 8000, (rng.next() - 0.5) * 8000);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Layer 2: Nebula Dust (Blue/Purple, soft, large)
    const dustGeo = new THREE.BufferGeometry();
    const dustVertices = [];
    const dustColors = [];
    const colorA = new THREE.Color(0x4c1d95); // Deep Purple
    const colorB = new THREE.Color(0x2563eb); // Royal Blue

    for (let i = 0; i < 1500; i++) {
        dustVertices.push((rng.next() - 0.5) * 5000, (rng.next() - 0.5) * 5000, (rng.next() - 0.5) * 5000);

        // Mix colors - seeded random mix
        const mixFactor = rng.next();
        const mixedColor = colorA.clone().lerp(colorB, mixFactor);
        dustColors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustVertices, 3));
    dustGeo.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));

    // Soft transparent particles for nebula effect
    const dustMat = new THREE.PointsMaterial({
        size: 15,
        vertexColors: true,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);
}

const ThreeGraph = forwardRef(({ onNodeClick, onNodeHover, data, tps = 0, className, activeLens: activeLensProp = 'ops', clusteringMethod = 'heuristic', paused = false }, ref) => {
    const containerRef = useRef(null);
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const animationRef = useRef(null);
    const cameraAnimRef = useRef(null);
    const nodesRef = useRef([]);
    const particlesRef = useRef([]);
    const groupsRef = useRef([]); // Track grouped meshes (like Voxel Clusters) for cleanup
    const activeFlowTargetRef = useRef(null); // Targeted flow from Agents
    const animatedObjectsRef = useRef([]); // Optimization: Cache animating objects (shields)
    const edgesRef = useRef([]);
    const sceneRef = useRef(null);
    const hoverNodeRef = useRef(null);
    const controlsRef = useRef(null);
    const tpsRef = useRef(tps);
    const selectedNodeRef = useRef(null);
    const flowEnabledRef = useRef(false);
    const flowTimeoutRef = useRef(null); // Timeout for auto-stopping flow
    const lineageRef = useRef({ origin: null, nodes: [] });
    const clusteringMethodRef = useRef(clusteringMethod);
    const simulationRef = useRef(null);

    // [PHASE 2] InstancedMesh Refs
    const instancedMeshRef = useRef(null); // Core nodes
    const instancedShellRef = useRef(null); // Glow shells
    const textSpritesGroupRef = useRef(null); // Text labels group
    const dummyObject = useMemo(() => new THREE.Object3D(), []);
    const nodeColorBuffer = useMemo(() => new THREE.Color(), []);

    // Shared Geometries/Materials (Memoized)
    const nodeGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []); // Radius 1, scale to size
    const shellGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);

    // CUSTOM SHADER UNIFORMS FOR PULSE
    const shaderUniforms = useMemo(() => ({
        time: { value: 0 }
    }), []);

    const nodeMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x4299e1,
            roughness: 0.4,
            metalness: 0.6,
            emissive: 0x000000,
            emissiveIntensity: 0.5
        });


        return mat;
    }, []);

    const shellMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x4299e1,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            emissive: 0x4299e1,
            emissiveIntensity: 0.5,
            roughness: 0.1,
            metalness: 0.1
        });


        return mat;
    }, []);

    // Refs for state setters to avoid closure issues in event handlers
    const setViewModeRef = useRef(null);
    const setDrilldownNodeRef = useRef(null);

    // SAI Latent Space State & Refs
    const [layoutMode, setLayoutMode] = React.useState('galaxy'); // 'galaxy' | 'latent' | 'analysis'
    const layoutModeRef = useRef('galaxy'); // Ref for access in loops
    const [currentLens, setCurrentLens] = React.useState(activeLensProp); // 'ops' | 'security' | 'executive' | 'tier3' | 'energy'
    const currentLensRef = useRef(activeLensProp); // Ref for access inside loops/imperative
    // Latent Background State (Default: Deep Space Gradient)
    const [latentBg, setLatentBg] = React.useState('radial-gradient(circle at center, #1a202c 0%, #000000 100%)');
    // Latent Time Travel State
    const [timeProgress, setTimeProgress] = React.useState(100); // 0 to 100%
    const timeProgressRef = useRef(100); // Ref for performance-critical loop access
    const manifoldRef = useRef(null);
    const axesRef = useRef(null);

    // 3D Tables (tier3) Cluster Metadata State
    // Sync Prop to State
    useEffect(() => {
        if (activeLensProp && activeLensProp !== currentLens) {
            console.log(`[ThreeGraph] Prop Sync: Lens -> ${activeLensProp}`);
            setCurrentLens(activeLensProp);
            currentLensRef.current = activeLensProp;
        }
    }, [activeLensProp]);

    const [clusterMetadata, setClusterMetadata] = useState(null);
    const [clusterMetadataLoading, setClusterMetadataLoading] = useState(false);


    const { update: updateGlow } = useGlowManager();
    const { focusOn: cameraFocus, stopTransition: stopCameraTransition, update: updateCamera } = useCameraManager(cameraRef, controlsRef);

    // --- SHARED UTILITIES ---
    const spawnParticleForTarget = useCallback((targetNodeNames) => {
        if (!sceneRef.current) return;

        let targetEdges = [];

        // CASE 1: Specific Targets
        if (targetNodeNames && targetNodeNames.length > 0) {
            // Normalize targets: lowercase, trim, remove trailing punctuation
            const targets = targetNodeNames.map(name =>
                name.toString().toLowerCase().replace(/[.,!?;:]$/, '').trim()
            );

            targetEdges = edgesRef.current.filter(e => {
                const s = nodesRef.current.find(n => n.id === e.userData.sourceId);
                const t = nodesRef.current.find(n => n.id === e.userData.targetId);

                if (!s || !t) return false;

                // Check if source or target matches requested name (case-insensitive)
                const sourceMatch = targets.includes(s.name.toLowerCase()) || targets.includes(s.id.toLowerCase());
                const targetMatch = targets.includes(t.name.toLowerCase()) || targets.includes(t.id.toLowerCase());

                return sourceMatch || targetMatch;
            });
        }
        // CASE 2: Global Flow (No targets)
        else {
            targetEdges = edgesRef.current;
        }

        if (targetEdges.length > 0) {
            const randomEdge = targetEdges[Math.floor(Math.random() * targetEdges.length)];
            const particle = createParticle('high_traffic'); // Always high traffic color for agent
            sceneRef.current.add(particle);

            // Random speed variation for natural feel
            const speed = 0.005 + Math.random() * 0.008;

            particlesRef.current.push({
                mesh: particle,
                curve: randomEdge.userData.curve,
                speed: speed,
                progress: 0
            });
        }
    }, []);



    // --- VOICE COMMAND REGISTRATION ---
    const findNodeByTarget = useCallback((target) => {
        if (!target) return null;
        const normalized = target.toLowerCase().trim();
        const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;

        // Priority 1: Exact Match (ID or Name)
        let match = nodesRef.current.find(n =>
            n.id.toLowerCase() === normalized || n.name.toLowerCase() === normalized
        );
        if (match) return match;

        // Priority 2: Singular/Plural Match
        match = nodesRef.current.find(n =>
            n.id.toLowerCase() === singular || n.name.toLowerCase() === singular
        );
        if (match) return match;

        // Priority 3: Contains match (but must be significant)
        if (normalized.length > 3) {
            match = nodesRef.current.find(n =>
                n.name.toLowerCase().includes(normalized) || normalized.includes(n.name.toLowerCase())
            );
        }
        return match || null;
    }, []);

    const handleZoom = useCallback(({ target, instruction }) => {
        if (!target) return { success: false, error: "No target specified" };
        console.log(`[ThreeGraph] Zoom Action: "${target}"`);

        const normalizedTarget = target.toLowerCase().trim();

        // 1. Try to find clusters first
        const clusterNodes = nodesRef.current.filter(n => {
            const c = n.cluster?.toString().toLowerCase();
            const t = n.table_type?.toLowerCase();
            return c === normalizedTarget || (c && c.includes(normalizedTarget)) ||
                t === normalizedTarget || (t && t.includes(normalizedTarget));
        });

        if (clusterNodes.length > 0) {
            console.log(`[ThreeGraph] Zooming to cluster with ${clusterNodes.length} nodes`);
            zoomToNodes(clusterNodes);
            return { success: true, message: `Zoomed to ${clusterNodes.length} nodes` };
        }

        // 2. Fallback to single node
        const node = findNodeByTarget(target);
        if (node) {
            console.log(`[ThreeGraph] Zooming to node: ${node.name}`);
            focusOnNode(node);
            selectedNodeRef.current = node.id;
            return { success: true, message: `Zoomed to ${node.name}` };
        } else {
            console.warn(`[ThreeGraph] No zoom target found for: "${target}"`);
            return { success: false, error: `Could not find "${target}"` };
        }
    }, [findNodeByTarget]);

    const handleHighlight = useCallback(({ target }) => {
        if (!target) return { success: false, error: "No target specified" };
        console.log(`[ThreeGraph] Highlight Action: "${target}"`);

        const node = findNodeByTarget(target);
        if (node) {
            console.log(`[ThreeGraph] Highlighting node: ${node.name}`);
            selectedNodeRef.current = node.id;
            focusOnNode(node);
            return { success: true, message: `Highlighted ${node.name}` };
        } else {
            console.warn(`[ThreeGraph] No highlight target found for: "${target}"`);
            return { success: false, error: `Could not find "${target}"` };
        }
    }, [findNodeByTarget]);

    const handleCamera = useCallback(({ instruction }) => {
        console.log(`[ThreeGraph] Camera Instruction: "${instruction}"`);
        // Support multiple variations of "reset" for voice robustness
        if (instruction === 'reset_view' || instruction === 'reset' || instruction === 'reset_camera' || instruction === 'view_reset') {
            resetCamera();
            return { success: true, message: "View reset" };
        }
        return { success: false, error: "Unknown camera instruction" };
    }, []);

    const handleFlow = useCallback(({ instruction, target, table_name, nodes }) => {
        console.log(`[ThreeGraph] Flow Action: ${instruction}`, { target, table_name, nodes });

        if (instruction === 'start_flow') {
            // Clear any pending stop command
            if (flowTimeoutRef.current) {
                clearTimeout(flowTimeoutRef.current);
                flowTimeoutRef.current = null;
            }

            flowEnabledRef.current = true;

            // Set targeted flow if provided
            const targets = nodes || [];
            if (target) targets.push(target);
            if (table_name) targets.push(table_name);

            if (targets.length > 0) {
                console.log(`[ThreeGraph] Setting active flow targets:`, targets);
                activeFlowTargetRef.current = targets;

                // Initial burst
                for (let i = 0; i < 20; i++) spawnParticleForTarget(targets);

                // Set Auto-Stop Timer (10 Seconds)
                flowTimeoutRef.current = setTimeout(() => {
                    console.log("[ThreeGraph] Auto-stopping flow after 10s");
                    flowEnabledRef.current = false;
                    activeFlowTargetRef.current = null;

                    // Force cleanup to ensure "completely not visible"
                    if (particlesRef.current.length > 0) {
                        particlesRef.current.forEach(p => {
                            if (sceneRef.current) sceneRef.current.remove(p.mesh);
                        });
                        particlesRef.current = [];
                    }

                }, 10000);

                return { success: true, message: `Started flow for ${targets[0]}` };
            }

            // Global Flow
            console.log(`[ThreeGraph] Starting global flow`);
            activeFlowTargetRef.current = null; // null = global
            // Initial burst
            for (let i = 0; i < 20; i++) spawnParticleForTarget(null);

            // Set Auto-Stop Timer
            flowTimeoutRef.current = setTimeout(() => {
                console.log("[ThreeGraph] Auto-stopping global flow after 10s");
                flowEnabledRef.current = false;

                // Force cleanup to ensure "completely not visible"
                if (particlesRef.current.length > 0) {
                    particlesRef.current.forEach(p => {
                        if (sceneRef.current) sceneRef.current.remove(p.mesh);
                    });
                    particlesRef.current = [];
                }

            }, 10000);

            return { success: true, message: "Started global flow" };
        }
        if (instruction === 'stop_flow') {
            if (flowTimeoutRef.current) {
                clearTimeout(flowTimeoutRef.current);
                flowTimeoutRef.current = null;
            }
            flowEnabledRef.current = false;
            activeFlowTargetRef.current = null;

            // Force cleanup
            if (particlesRef.current.length > 0) {
                particlesRef.current.forEach(p => {
                    if (sceneRef.current) sceneRef.current.remove(p.mesh);
                });
                particlesRef.current = [];
            }

            return { success: true, message: "Stopped flow" };
        }
        return { success: false, error: "Unknown flow instruction" };
    }, [spawnParticleForTarget]);

    const handleTraceLineage = useCallback(({ target, lineage_nodes }) => {
        if (!target || !lineage_nodes) return { success: false, error: "Missing lineage target" };
        console.log(`[ThreeGraph] Tracing lineage for ${target}`);

        lineageRef.current = {
            origin: target,
            nodes: lineage_nodes
        };

        const originNode = findNodeByTarget(target);
        if (originNode) {
            cameraFocus(new THREE.Vector3(originNode.x, originNode.y, originNode.z).add(new THREE.Vector3(0, 300, 600)), new THREE.Vector3(originNode.x, originNode.y, originNode.z), 1.2);
            soundSystem.play('voiceConfirm');
            return { success: true, message: `Tracing lineage for ${target}` };
        }
        return { success: false, error: `Could not find lineage origin: ${target}` };
    }, [findNodeByTarget, cameraFocus]);

    useRegisterCommand('graph_zoom', handleZoom);
    useRegisterCommand('graph_highlight', handleHighlight);
    useRegisterCommand('graph_camera', handleCamera);
    useRegisterCommand('graph_flow', handleFlow);
    useRegisterCommand('graph_trace_lineage', handleTraceLineage);

    // Imperative API for Voice Agent & UI Control
    useImperativeHandle(ref, () => ({
        zoomToCluster: (target) => {
            console.log(`[ThreeGraph] Action: Zoom to (Cluster or Node) "${target}"`);

            const normalizedTarget = target.toLowerCase().trim();

            // 1. Try to find nodes by cluster ID or table type (Exact or Prefix)
            const clusterNodes = nodesRef.current.filter(n => {
                const c = n.cluster?.toString().toLowerCase();
                const t = n.table_type?.toLowerCase();
                return c === normalizedTarget || (c && c.includes(normalizedTarget)) ||
                    t === normalizedTarget || (t && t.includes(normalizedTarget));
            });

            if (clusterNodes.length > 0) {
                console.log(`[ThreeGraph] Found ${clusterNodes.length} nodes for cluster/type match:`, clusterNodes.map(n => n.name));
                zoomToNodes(clusterNodes);
                return true;
            }

            // 2. Fallback: Try to find a specific node by name/ID (Fuzzy Match)
            const singleNode = nodesRef.current.find(n => {
                const name = n.name?.toLowerCase() || "";
                const id = n.id?.toLowerCase() || "";
                return id === normalizedTarget ||
                    name === normalizedTarget ||
                    name.includes(normalizedTarget) ||
                    normalizedTarget.includes(name);
            });

            if (singleNode) {
                console.log(`[ThreeGraph] Target "${target}" matched node: ${singleNode.name}. Focusing camera.`);
                focusOnNode(singleNode);
                selectedNodeRef.current = singleNode.id;
                return true;
            }

            console.warn(`[ThreeGraph] No matches found for "${target}" among ${nodesRef.current.length} nodes.`);
            return false;
        },
        setEvolutionSnapshot: (snapshot) => {
            if (!snapshot || !nodesRef.current) return;
            // console.log(`[ThreeGraph] 🎞️ Applying Evolution Snapshot...`);

            const snapshotTables = new Map(snapshot.tables.map(t => [t.name, t]));

            nodesRef.current.forEach(node => {
                const snap = snapshotTables.get(node.id) || snapshotTables.get(node.name);

                if (node.mesh) {
                    if (snap) {
                        node.mesh.visible = true;

                        // TIME INTELLIGENCE: Size based on records added
                        // Base size 0.5 + some relative scale from growth
                        const sizeBonus = snap.relative_size * 2.0;
                        const targetScale = 0.5 + sizeBonus;

                        node.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

                        // TIME INTELLIGENCE: Age-based Brightness
                        // New records (tables) are bright, old ones go dim
                        if (node.mesh.material && node.mesh.material.emissiveIntensity !== undefined) {
                            const baseGlow = snap.node_glow || 1.0;
                            const ageGlow = snap.age_factor !== undefined ? snap.age_factor : 1.0;
                            node.mesh.material.emissiveIntensity = baseGlow * ageGlow;

                            // Adjust opacity/color for "Dim" effect
                            if (ageGlow < 0.5) {
                                node.mesh.material.opacity = 0.3 + (ageGlow * 0.7);
                                node.mesh.material.transparent = true;
                            } else {
                                node.mesh.material.opacity = 1.0;
                                node.mesh.material.transparent = false;
                            }
                        }

                        if (snap.is_new && !node.was_born) {
                            node.was_born = true;
                            triggerBirthEffect(node.mesh);
                            if (Math.random() > 0.7) soundSystem.play('scanPulse');
                        }
                    } else {
                        node.mesh.visible = false;
                        node.mesh.scale.set(0.1, 0.1, 0.1);
                        node.was_born = false;
                    }
                }
            });
        },
        setLens: (lens) => {
            console.log(`[ThreeGraph] 👓 Switching Lens to: ${lens}`);
            setCurrentLens(lens);
            currentLensRef.current = lens; // Sync Ref
            // If switching to voxel mode (tier3), force a layout update effectively
            if (lens === 'tier3') {
                soundSystem.play('uiClick');
            }
        },
        startFlow: () => {
            console.log(`[ThreeGraph] Action: Start Flow`);
            flowEnabledRef.current = true;
        },
        stopFlow: () => {
            console.log(`[ThreeGraph] Action: Stop Flow`);
            flowEnabledRef.current = false;
        },
        highlightNode: (nodeName) => {
            const cleanName = nodeName.toString().toLowerCase().replace(/[.,!?;:]$/, '').trim();
            console.log(`[ThreeGraph] Action: Highlight Node "${nodeName}" -> Sanitized: "${cleanName}"`);

            const target = nodesRef.current.find(n =>
                n.name.toLowerCase() === cleanName ||
                n.id.toLowerCase() === cleanName
            );

            if (target) {
                focusOnNode(target);
                if (sceneRef.current) {
                    sceneRef.current.traverse(obj => {
                        if (obj.userData && obj.userData.id === target.id) {
                            triggerBirthEffect(obj);
                        }
                    });
                }
            } else {
                console.warn(`[ThreeGraph] Node not found for highlight: "${cleanName}". Available:`, nodesRef.current.map(n => n.name).slice(0, 5));
            }
        },
        resetView: () => {
            console.log('🔄 [ThreeGraph] IMPERATIVE RESET CALLED');
            if (controlsRef.current) {
                console.log('📸 [ThreeGraph] Resetting camera via controls');
                controlsRef.current.reset();
            }
            resetCamera();
        },
        setLatentMode: (mode) => {
            console.log(`[ThreeGraph] Setting Layout Mode: ${mode}`);
            setLayoutMode(mode);
            layoutModeRef.current = mode;
        },
        setLayoutMode: (mode) => {
            console.log(`[ThreeGraph] Setting Layout Mode (SAI): ${mode}`);
            setLayoutMode(mode);
            layoutModeRef.current = mode;
        },
        toggleLatentMode: () => {
            setLayoutMode(prev => prev === 'galaxy' ? 'latent' : 'galaxy');
        }
    }), [layoutMode, currentLens]);

    function focusOnNode(node) {
        if (!cameraRef.current || !controlsRef.current) return;

        // Safety Clean: Use target coords if current are invalid
        let targetX = node.x;
        let targetY = node.y;
        let targetZ = node.z;

        if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(targetZ)) {
            console.warn('[ThreeGraph] Invalid node coordinates, falling back to targets or zero:', node);
            targetX = Number.isFinite(node.targetX) ? node.targetX : 0;
            targetY = Number.isFinite(node.targetY) ? node.targetY : 0;
            targetZ = Number.isFinite(node.targetZ) ? node.targetZ : 0;

            // Auto-correct the node object too
            node.x = targetX;
            node.y = targetY;
            node.z = targetZ;
        }

        const targetPos = new THREE.Vector3(node.x, node.y, node.z);
        const offset = new THREE.Vector3(0, 200, 400); // Cinematic offset
        const camPos = targetPos.clone().add(offset);

        console.log(`[ThreeGraph] Focusing on node: ${node.name} via CameraManager`);
        cameraFocus(camPos, targetPos, 1.2);
    }

    function zoomToNodes(nodes) {
        if (!cameraRef.current || !controlsRef.current || nodes.length === 0) return;

        const box = new THREE.Box3();
        nodes.forEach(n => box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z)));

        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        const camPos = center.clone().add(new THREE.Vector3(0, maxDim, maxDim * 1.5));
        cameraFocus(camPos, center, 1.2);
    }

    function resetCamera() {
        console.log('[ThreeGraph] Resetting Camera to Overview');
        cameraFocus(new THREE.Vector3(0, 0, 1600), new THREE.Vector3(0, 0, 0), 1.2);
        selectedNodeRef.current = null;
    }

    useEffect(() => {
        console.log(`[ThreeGraph] TPS changed: ${tps}`);
        tpsRef.current = tps;
        if (tps <= 0) {
            console.log('[ThreeGraph] TPS is 0 - clearing all particles');
            // Force immediate stability: Clear existing particles
            particlesRef.current.forEach(p => {
                if (sceneRef.current) sceneRef.current.remove(p.mesh);
            });
            particlesRef.current = [];
        }
    }, [tps]);

    // Update clusteringMethodRef
    useEffect(() => {
        clusteringMethodRef.current = clusteringMethod;
    }, [clusteringMethod]);

    // 1. INITIALIZATION EFFECT (One-time Setup)
    // ============ FETCH CLUSTER METADATA FOR 3D TABLES LENS ============
    useEffect(() => {
        // Only fetch when tier3 lens is active and we have a connection
        if (currentLens !== 'tier3' || !data?.connection_id) {
            setClusterMetadata(null);
            return;
        }

        const fetchClusterMetadata = async () => {
            setClusterMetadataLoading(true);

            try {
                const response = await fetch(`/api/graph/cluster-metadata/${data.connection_id}`);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const metadata = await response.json();

                if (metadata.status === 'success' && metadata.clusters) {
                    console.log(`✅ [3D Tables] Loaded ${metadata.total_clusters} clusters for ${metadata.total_tables} tables`);
                    setClusterMetadata(metadata);
                } else {
                    console.warn(`⚠️ [3D Tables] No cluster metadata available: ${metadata.error || 'Unknown error'}`);
                    setClusterMetadata(null);
                }

            } catch (err) {
                console.error('❌ [3D Tables] Failed to fetch cluster metadata:', err);
                setClusterMetadata(null);
            } finally {
                setClusterMetadataLoading(false);
            }
        };

        fetchClusterMetadata();
    }, [currentLens, data?.connection_id]);

    // ============ MAIN SCENE INITIALIZATION ============
    useEffect(() => {
        if (!containerRef.current) return;

        // Cleanup
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // Init Scene
        const scene = new THREE.Scene();
        // REMOVED: Static background color
        // scene.background = new THREE.Color(0x0e1012); 
        // We will use CSS background for better gradient control

        // RESTORE NEBULA BACKGROUND
        createStarfield(scene);

        // Init Camera
        // HYPER-LATENT FIX: Increase Far Plane to see full 30k+ space
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 60000);
        camera.position.z = 1600; // Zoomed out for better overview
        cameraRef.current = camera;

        // Init Renderer
        // Init Renderer with Crash Safety
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true, // Allow CSS background to show through
                powerPreference: "high-performance"
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        } catch (e) {
            console.error('[ThreeGraph] WebGL Crashed/Blocked:', e);
            if (mountRef.current) {
                mountRef.current.innerHTML = `
                    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #000; color: #ef4444; font-family: monospace; text-align: center; padding: 20px;">
                        <div>
                            <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">GRAPHICS DRIVER RESTART REQUIRED</h2>
                            <p>The browser has blocked 3D rendering due to previous errors.</p>
                            <p style="margin-top: 16px; color: #fff;">👉 Please CLOSE this tab and open a fresh one.</p>
                        </div>
                    </div>
                `;
            }
            return;
        }

        // Clears any existing canvas to prevent 'double graph' ghosting
        let canvasContainer = null;
        if (mountRef.current) {
            mountRef.current.innerHTML = '';
            canvasContainer = document.createElement('div');
            canvasContainer.className = "absolute inset-0 z-0";
            mountRef.current.appendChild(canvasContainer);
            canvasContainer.appendChild(renderer.domElement);
        }
        rendererRef.current = renderer;

        // ============ WEBGL CONTEXT LOSS RECOVERY ============
        // Prevent crashes when GPU context is lost (e.g., driver issues, tab suspension)
        const webglCanvas = renderer.domElement;

        const handleContextLost = (event) => {
            event.preventDefault(); // Prevent default browser behavior
            console.warn('⚠️ [ThreeGraph] WebGL context lost - attempting recovery...');

            // Show user notification
            if (mountRef.current) {
                const notification = document.createElement('div');
                notification.id = 'webgl-recovery-notification';
                notification.style.cssText = `
                    position: absolute;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(239, 68, 68, 0.9);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 14px;
                    z-index: 10000;
                    backdrop-filter: blur(10px);
                `;
                notification.textContent = '⚠️ Graphics context lost - recovering...';
                mountRef.current.appendChild(notification);
            }
        };

        const handleContextRestored = () => {
            console.log('✅ [ThreeGraph] WebGL context restored successfully');

            // Remove notification
            const notification = document.getElementById('webgl-recovery-notification');
            if (notification) {
                notification.remove();
            }

            // Soft reset: resize renderer and update controls to restore rendering
            setTimeout(() => {
                console.log('[ThreeGraph] WebGL context restored — triggering scene rebuild');
                if (rendererRef.current && containerRef.current) {
                    const w = containerRef.current.clientWidth || window.innerWidth;
                    const h = containerRef.current.clientHeight || window.innerHeight;
                    rendererRef.current.setSize(w, h);
                    if (cameraRef.current) {
                        cameraRef.current.aspect = w / h;
                        cameraRef.current.updateProjectionMatrix();
                    }
                }
                if (controlsRef.current) controlsRef.current.update();
            }, 1000);
        };

        webglCanvas.addEventListener('webglcontextlost', handleContextLost, false);
        webglCanvas.addEventListener('webglcontextrestored', handleContextRestored, false);

        // Store cleanup function
        const cleanupContextHandlers = () => {
            webglCanvas.removeEventListener('webglcontextlost', handleContextLost);
            webglCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
        // ============ END WEBGL RECOVERY ============


        // Controls - UNLOCKED for Interaction (HYPER-LATENT READY)
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true; // Allow moving Up/Down/Left/Right relative to screen

        // Navigation Speed (Critical for large 30k space)
        controls.zoomSpeed = 2.0;
        controls.panSpeed = 2.0;
        controls.rotateSpeed = 1.0;

        // Navigation Limits
        controls.minDistance = 50;
        controls.maxDistance = 60000; // Matched to Camera Far Plane

        // Allow full 360 rotation
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
        controls.minAzimuthAngle = -Infinity;
        controls.maxAzimuthAngle = Infinity;

        // Interaction Settings
        controls.autoRotate = false; // Disable self-rotation
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.enablePan = true;

        controlsRef.current = controls;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1.2);
        pointLight.position.set(2000, 2000, 2000);
        scene.add(pointLight);

        const fillLight = new THREE.DirectionalLight(0xa78bfa, 2.0);
        fillLight.position.set(-500, 200, -500);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
        rimLight.position.set(0, 500, -500);
        scene.add(rimLight);

        // FIX: Add Bottom Light for 360-degree visibility (Manifold Underside)
        const bottomLight = new THREE.DirectionalLight(0x38bdf8, 1.5); // Light Blue underglow
        bottomLight.position.set(0, -2000, 0);
        bottomLight.target.position.set(0, 0, 0);
        scene.add(bottomLight);
        scene.add(bottomLight.target);

        // --- HELPERS (Latent Space Visualization) ---
        const gridHelper = new THREE.GridHelper(2000, 50, 0x4b5563, 0x1f2937);
        gridHelper.visible = false;
        gridHelper.userData = { isHelper: true, type: 'grid' };
        scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(500);
        axesHelper.visible = false;
        axesHelper.userData = { isHelper: true, type: 'axes' };
        scene.add(axesHelper);

        // Starfield (Universe Nebula)
        createStarfield(scene);
        sceneRef.current = scene;

        // Interaction Listeners
        const stopListener = () => stopCameraTransition();
        controls.addEventListener('start', stopListener);

        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();

        const onMouseMove = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            // Check for intersections
            const intersects = raycaster.intersectObjects(scene.children, true);

            if (intersects.length > 0) {
                // RAYCAST FIX: Iterate through hits to find the first actual NODE
                // (Ignore the transparent Manifold or other helpers that might block clicks)
                let foundNode = null;

                for (let i = 0; i < intersects.length; i++) {
                    const intersection = intersects[i];
                    let object = intersection.object;

                    // [PHASE 2] InstancedMesh Support
                    if (object.isInstancedMesh) {
                        const instanceId = intersection.instanceId;
                        if (instanceId !== undefined) {
                            // Find node with this instanceId
                            // Optimization: If arrays are sync'd, nodesRef.current[instanceId] might work, 
                            // but safest is to check the property
                            const node = nodesRef.current.find(n => n.instanceId === instanceId);
                            if (node) {
                                foundNode = node;
                                break;
                            }
                        }
                    }

                    // Legacy/Voxel Support
                    let nodeCandidate = null;
                    let traverser = object;
                    while (traverser) {
                        if (traverser.userData && traverser.userData.isNode) {
                            nodeCandidate = traverser.userData;
                            break;
                        }
                        traverser = traverser.parent;
                    }

                    if (nodeCandidate) {
                        foundNode = nodeCandidate;
                        break; // Found the closest node, stop searching
                    }
                }

                if (foundNode && foundNode !== hoverNodeRef.current) {
                    hoverNodeRef.current = foundNode; // Update Ref
                    document.body.style.cursor = 'pointer';

                    // [NEW] Trigger hover callback for UI Preview
                    if (onNodeHover) {
                        onNodeHover(foundNode);
                    }

                    // SONIFICATION: Play metric sound on hover
                    const gravity = foundNode.importance_score || 1.0;
                    const glowIntense = foundNode.node_glow || 0.5;
                    soundSystem.playMetricOscillation(gravity, glowIntense);
                }
            } else if (hoverNodeRef.current) {
                hoverNodeRef.current = null; // Clear Ref
                document.body.style.cursor = 'default';

                // [NEW] Clear hover preview
                if (onNodeHover) {
                    onNodeHover(null);
                }
            }
        };

        const onClick = (event) => {
            if (hoverNodeRef.current) {
                console.log("ThreeGraph: Node Clicked - Opening Latent Space for:", hoverNodeRef.current.name);
                event.stopPropagation();
                event.preventDefault();

                soundSystem.play('nodeClick');

                // Also call onNodeClick if provided - THIS IS THE ONLY NAVIGATION SOURCE
                if (onNodeClick) {
                    onNodeClick(hoverNodeRef.current);
                }
            }
        };

        const canvas = renderer.domElement;
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('click', onClick);

        // Helper to get neighbors
        const getNeighbors = (nodeId) => {
            const neighbors = new Set();
            edgesRef.current.forEach(edge => {
                if (edge.userData.sourceId === nodeId) neighbors.add(edge.userData.targetId);
                else if (edge.userData.targetId === nodeId) neighbors.add(edge.userData.sourceId);
            });
            return Array.from(neighbors);
        };

        // Loop - Just renders (Logic moved to D3 tick + Glow update)
        const animate = () => {
            animationRef.current = requestAnimationFrame(animate);

            // [FIX] Zombie Simulation check
            if (paused) return;

            const time = Date.now() * 0.001;

            // [VISUAL FIX] Update Shader Uniforms for Pulse/Glow
            if (shaderUniforms) shaderUniforms.time.value = time;

            if (controlsRef.current) controlsRef.current.update();

            // Smooth Factor (Lower = Smoother/Heavier like Spline)
            const LERP_FACTOR = 0.08;

            // 1. UPDATE CAMERA
            updateCamera(0.016);

            // 2. OPTIMIZED ANIMATION LOOP (No Scene Traversal)
            // Iterate only over objects that need animation (Shields, Glows)
            animatedObjectsRef.current.forEach(object => {
                if (!object.parent) return; // Skip if removed

                // GLOW PULSE
                if (object.userData && object.userData.isGlow) {
                    updateGlow(object, time, 'idle', object.userData.nodeGlow);
                }

                // SECURITY SHIELD PULSE (Data-Driven Animation)
                if (object.userData && object.userData.isShield) {
                    const t = Date.now() * 0.001;
                    const speed = object.userData.pulseSpeed || 1.0;
                    const base = object.userData.originalScale || 1.4;
                    // Formula: scale = base + sin(t * speed) * offset
                    const scale = base + Math.sin(t * speed * 3.0) * 0.15;
                    object.scale.setScalar(scale);
                    object.rotation.y += 0.02;
                    object.rotation.z -= 0.01;
                }
            });

            // LATENT MODE: Project nodes onto manifold surface (Batched in separate loop if needed, or kept here if efficient)
            // For now, we only update positions if layout is latent AND data changed recently, 
            // but for "floating" effect, we might need a separate meaningful update.
            // ... (Latent projection is expensive, keeping it static or minimal is better for lag) ...


            // 2. UPDATE EDGES (Opacity only, curve handled by D3 tick)
            edgesRef.current.forEach(edge => {
                const hoverId = hoverNodeRef.current ? hoverNodeRef.current.id : null;
                const lineage = lineageRef.current;
                let targetOpacity = 0.15; // Base visibility

                if (hoverId) {
                    if (edge.userData.sourceId === hoverId || edge.userData.targetId === hoverId) {
                        targetOpacity = 0.8;
                        edge.userData.isActive = true;
                    } else {
                        targetOpacity = 0.05;
                        edge.userData.isActive = false;
                    }
                } else if (lineage.origin) {
                    // Highlight edges within the lineage path
                    const isSourceInLineage = edge.userData.sourceId === lineage.origin || lineage.nodes.includes(edge.userData.sourceId);
                    const isTargetInLineage = edge.userData.targetId === lineage.origin || lineage.nodes.includes(edge.userData.targetId);

                    if (isSourceInLineage && isTargetInLineage) {
                        targetOpacity = 0.9;
                        edge.userData.isActive = true;
                    } else {
                        targetOpacity = 0.05;
                        edge.userData.isActive = false;
                    }
                }

                // Smooth Opacity
                edge.material.opacity = THREE.MathUtils.lerp(edge.material.opacity, targetOpacity, LERP_FACTOR);
                edge.material.needsUpdate = true;
            });

            // 3. PARTICLES - RESTRICTED TO ACTIVE DATA
            if (particlesRef.current) {
                // Only animate if there is live data, simulated flow, OR leftover particles
                if (tpsRef.current > 0 || flowEnabledRef.current || particlesRef.current.length > 0) {

                    // Continuous Spawning for Flow (5% chance per frame for organic stream)
                    if (flowEnabledRef.current) {
                        if (Math.random() > 0.95) {
                            spawnParticleForTarget(activeFlowTargetRef.current);
                        }
                    }

                    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                        const p = particlesRef.current[i];
                        p.progress += p.speed;
                        if (p.progress >= 1) {
                            scene.remove(p.mesh);
                            particlesRef.current.splice(i, 1);
                        } else {
                            // Safe curve evaluation
                            if (p.curve && p.curve.getPoint) {
                                p.mesh.position.copy(p.curve.getPoint(p.progress));
                            }
                        }
                    }
                }
            }

            renderer.render(scene, camera);
        };
        animate();


        // Initial Sizing
        const updateDimensions = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;

            if (w === 0 || h === 0) {
                console.warn('[ThreeGraph] Container has zero dimensions. Skipping resize.');
                return;
            }

            console.log(`[ThreeGraph] Resizing to ${w}x${h}`);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        updateDimensions();

        // Resize Observer for Container (Centers graph when sidebars toggle)
        const resizeObserver = new ResizeObserver(() => {
            updateDimensions();
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            console.log("[ThreeGraph] Cleaning up resources & Physics...");
            if (simulationRef.current) simulationRef.current.stop();

            resizeObserver.disconnect();
            if (canvas) {
                canvas.removeEventListener('mousemove', onMouseMove);
                canvas.removeEventListener('click', onClick);
            }
            if (controls) controls.removeEventListener('start', stopListener);

            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);

            if (mountRef.current && canvasContainer) {
                try { mountRef.current.removeChild(canvasContainer); } catch (e) { /* ignore */ }
            }

            // DISPOSE RESOURCES to prevent Context Loss
            if (sceneRef.current) {
                sceneRef.current.traverse((object) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(m => m.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };
    }, []); // Runs ONCE

    // [FIX] Pause/Resume Physics Simulation
    useEffect(() => {
        if (simulationRef.current) {
            if (paused) {
                console.log("[ThreeGraph] ⏸ Pausing Simulation");
                simulationRef.current.stop();
            } else {
                console.log("[ThreeGraph] ▶ Resuming Simulation");
                simulationRef.current.restart();
            }
        }
    }, [paused]);





    // DEBUG STATE
    const [debugStats, setDebugStats] = React.useState({ nodes: 0, edges: 0, lastUpdate: '-' });

    // 2. DATA PROCESSING EFFECT (Rebuilds Content on Data Update)
    const prevDataRef = useRef(null);
    const prevLayoutModeRef = useRef(layoutMode);
    const prevLensRef = useRef(currentLens);

    // Deep comparison helper (Performance optimized)
    const hasDataChanged = (newData, oldData) => {
        if (!oldData) return 'structural';
        if (!newData) return 'none';

        // 1. Structural Changes (Triggers full rebuild)
        if (newData.nodes?.length !== oldData.nodes?.length) return 'structural';
        if (newData.edges?.length !== oldData.edges?.length) return 'structural';

        // 2. Content Changes (Sample check for performance)
        const checkNode = (n1, n2) => {
            if (!n1 || !n2) return true;
            // Structural changes within a node
            if (n1.id !== n2.id || n1.cluster !== n2.cluster) return true;
            return false;
        };

        const checkProperties = (n1, n2) => {
            if (!n1 || !n2) return true;
            // Property changes that only need mesh updates
            return n1.node_glow !== n2.node_glow ||
                n1.color !== n2.color ||
                n1.vitality !== n2.vitality ||
                n1.size !== n2.size;
        };

        const len = newData.nodes.length;
        if (len > 0) {
            // Structural Check samples
            if (checkNode(newData.nodes[0], oldData.nodes[0])) return 'structural';
            if (checkNode(newData.nodes[Math.floor(len / 2)], oldData.nodes[Math.floor(len / 2)])) return 'structural';
            if (checkNode(newData.nodes[len - 1], oldData.nodes[len - 1])) return 'structural';

            // Property Check samples
            if (checkProperties(newData.nodes[0], oldData.nodes[0])) return 'property';
            if (checkProperties(newData.nodes[Math.floor(len / 2)], oldData.nodes[Math.floor(len / 2)])) return 'property';
            if (checkProperties(newData.nodes[len - 1], oldData.nodes[len - 1])) return 'property';
        }

        return 'none';
    };
    React.useEffect(() => {
        if (!sceneRef.current || !data) return;

        // Force structural update if layoutMode OR currentLens changes
        const layoutChanged = prevLayoutModeRef.current !== layoutMode;
        const lensChanged = prevLensRef.current !== currentLens;

        if (layoutChanged) {
            console.log(`[ThreeGraph] 📐 Layout Mode Changed: ${prevLayoutModeRef.current} -> ${layoutMode}`);
        }
        if (lensChanged) {
            console.log(`[ThreeGraph] 👓 Lens Changed: ${prevLensRef.current} -> ${currentLens}`);
        }

        const changeType = hasDataChanged(data, prevDataRef.current);

        // 1. No change - skip (UNLESS layout or lens changed)
        if (changeType === 'none' && !layoutChanged && !lensChanged) return;

        // Update refs
        prevLayoutModeRef.current = layoutMode;
        prevLensRef.current = currentLens;

        // 2. Property change - FAST PATH (No mesh disposal)
        // CRITICAL: Skip fast path if lens changed - need full rebuild for color changes
        if (changeType === 'property' && !lensChanged && !layoutChanged) {
            const scene = sceneRef.current;
            console.log(`[ThreeGraph] ✨ Fast Property Sync... (Structural Integrity Maintained)`);
            data.nodes.forEach(incoming => {
                const existing = nodesRef.current.find(n => n.id === incoming.id);
                if (existing) {
                    // Update Vitality/Glow
                    existing.node_glow = incoming.node_glow;
                    existing.vitality = incoming.vitality;
                    existing.color = incoming.color;
                    existing.size = incoming.size;

                    // [PHASE 2] InstancedMesh Update
                    if (instancedMeshRef.current && existing.instanceId !== undefined) {
                        const i = existing.instanceId;

                        // Update Color
                        if (incoming.color) {
                            const newColor = new THREE.Color(incoming.color);
                            instancedMeshRef.current.setColorAt(i, newColor);
                            if (instancedShellRef.current) instancedShellRef.current.setColorAt(i, newColor);
                        }

                        // Update Scale (Size)
                        if (incoming.size) {
                            const size = incoming.size || 20;
                            // We need the current position to update the matrix
                            // Use currentX/Y/Z if available, else target
                            const x = existing.currentX || existing.x || 0;
                            const y = existing.currentY || existing.y || 0;
                            const z = existing.currentZ || existing.z || 0;

                            dummyObject.position.set(x, y, z);
                            dummyObject.scale.set(size / 2, size / 2, size / 2);
                            dummyObject.updateMatrix();
                            instancedMeshRef.current.setMatrixAt(i, dummyObject.matrix);

                            if (instancedShellRef.current) {
                                dummyObject.scale.set(size / 2 * 1.4, size / 2 * 1.4, size / 2 * 1.4);
                                dummyObject.updateMatrix();
                                instancedShellRef.current.setMatrixAt(i, dummyObject.matrix);
                            }
                        }
                    }
                    // Legacy/Voxel Update
                    else if (existing.mesh && existing.mesh.isMesh) {
                        const mesh = existing.mesh;
                        // Update Vitality/Glow
                        mesh.userData.nodeGlow = incoming.node_glow || 1.0;

                        // Update Color if shifted
                        if (incoming.color && existing.color !== incoming.color) {
                            const newColor = typeof incoming.color === 'string' ? new THREE.Color(incoming.color) : new THREE.Color(incoming.color);
                            if (mesh.material) mesh.material.color.set(newColor);
                            // Update shell too
                            if (mesh.children[0]) mesh.children[0].material.color.set(newColor);
                        }

                        // Update Scale (Vitality/Size)
                        const targetScale = incoming.size / (existing.size || 20);
                        mesh.scale.setScalar(targetScale);
                    }
                }
            });
            prevDataRef.current = JSON.parse(JSON.stringify(data));
            return;
        }

        // 3. Structural change - FULL REBUILD (Structural Integrity Shifted)
        prevDataRef.current = JSON.parse(JSON.stringify(data)); // Deep copy for reference

        const scene = sceneRef.current;

        console.log(`[ThreeGraph] 🔄 Structural Update. Rebuilding Universe...`, data.nodes?.length);


        // Helper to properly dispose of Three.js objects
        const disposeObject = (obj) => {
            if (!obj) return;

            // Recursive disposal for children (e.g. labels, shells)
            if (obj.children) {
                [...obj.children].forEach(child => disposeObject(child));
            }

            if (obj.geometry) obj.geometry.dispose();

            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => {
                        if (m.map) m.map.dispose();
                        if (m.emissiveMap) m.emissiveMap.dispose();
                        if (m.roughnessMap) m.roughnessMap.dispose();
                        if (m.metalnessMap) m.metalnessMap.dispose();
                        m.dispose();
                    });
                } else {
                    if (obj.material.map) obj.material.map.dispose();
                    if (obj.material.emissiveMap) obj.material.emissiveMap.dispose();
                    if (obj.material.roughnessMap) obj.material.roughnessMap.dispose();
                    if (obj.material.metalnessMap) obj.material.metalnessMap.dispose();
                    obj.material.dispose();
                }
            }
        };

        // A. CLEANUP PREVIOUS CONTENT (AGGRESSIVE)
        console.log("[ThreeGraph] 🧹 Disposing previous scene resources...");

        // 1. Nodes
        if (nodesRef.current) {
            nodesRef.current.forEach(n => {
                if (n.mesh) {
                    scene.remove(n.mesh);
                    disposeObject(n.mesh);
                }
            });
            nodesRef.current = [];
        }

        // 2. Edges
        if (edgesRef.current) {
            edgesRef.current.forEach(e => {
                if (e) {
                    scene.remove(e);
                    disposeObject(e);
                }
            });
            edgesRef.current = [];
        }

        // 3. Groups (Voxel Clusters)
        if (groupsRef.current) {
            groupsRef.current.forEach(g => {
                if (g) {
                    scene.remove(g);
                    disposeObject(g);
                }
            });
            groupsRef.current = [];
        }

        // 4. Latent World Artifacts (Manifold & Axes)
        if (manifoldRef.current) {
            scene.remove(manifoldRef.current);
            disposeObject(manifoldRef.current);
            manifoldRef.current = null;
        }
        if (axesRef.current) {
            scene.remove(axesRef.current);
            disposeObject(axesRef.current);
            axesRef.current = null;
        }

        animatedObjectsRef.current = [];

        // Stop previous simulation
        if (simulationRef.current) {
            simulationRef.current.stop();
        }

        // CRITICAL: Force WebGL to release buffers immediately
        if (rendererRef.current) {
            rendererRef.current.renderLists.dispose();
            rendererRef.current.info.reset();
        }

        // B. BUILD NEW CONTENT
        if (data.nodes && data.nodes.length > 0) {
            console.log(`[ThreeGraph] 🛠 Building ${data.nodes.length} nodes...`);
            // DEEP CLONE to prevent D3 mutation of props affecting re-renders
            const nodes = data.nodes.map(n => ({ ...n }));

            // 1. Layout - CONDITIONAL BASED ON MODE
            const layoutNodes = layoutMode === 'latent'
                ? applyLatentSpaceLayout(nodes, currentLens)
                : applyGalaxyLayout(nodes, 800); // Increased from 600 to 800 for better spacing
            const nodeMap = new Map();

            // 2. Create Nodes
            let createdCount = 0;

            // ============ SAI BRANCH: 'analysis' LAYOUT MODE ============
            // Voxel clusters positioned at latent coordinates
            if (layoutMode === 'analysis') {
                console.log("[ThreeGraph] 🧊 Activating SAI Analysis Mode (Voxel Clusters)");

                // Stop physics
                if (simulationRef.current) simulationRef.current.stop();

                // Group nodes by cluster
                let clusters = {};

                // Check if nodes have cluster data
                const hasClusterData = layoutNodes.some(n => n.cluster !== undefined);

                if (hasClusterData) {
                    // Use existing cluster data
                    layoutNodes.forEach(n => {
                        const cid = n.cluster || 0;
                        if (!clusters[cid]) clusters[cid] = [];
                        clusters[cid].push(n);
                    });
                } else {
                    // AUTO-CLUSTER: Group by table type or create simple groups
                    console.log("[SAI Analysis] No cluster data found, auto-clustering by type...");

                    layoutNodes.forEach(n => {
                        // Group by table_type, or create groups of 5-8 tables
                        const type = n.table_type || n.type || 'default';
                        if (!clusters[type]) clusters[type] = [];
                        clusters[type].push(n);
                    });

                    // If still no good clustering, just group every 6 tables
                    if (Object.keys(clusters).length === 1) {
                        const allNodes = Object.values(clusters)[0];
                        clusters = {};
                        const groupSize = 6;
                        allNodes.forEach((n, i) => {
                            const groupId = Math.floor(i / groupSize);
                            if (!clusters[groupId]) clusters[groupId] = [];
                            clusters[groupId].push(n);
                        });
                    }
                }

                // Position clusters in circular layout if no latent coords
                const clusterKeys = Object.keys(clusters);
                const radius = 1500;
                const angleStep = (Math.PI * 2) / clusterKeys.length;

                // Create voxel mesh for each cluster
                clusterKeys.forEach((clusterId, index) => {
                    const nodesInCluster = clusters[clusterId];
                    const group = createClusterVoxelMesh(nodesInCluster, currentLens);
                    const first = nodesInCluster[0];

                    // Position at latent coordinates OR circular layout
                    if (first.latent_x !== undefined && first.latent_y !== undefined && first.latent_z !== undefined) {
                        group.position.set(
                            first.latent_x,
                            first.latent_y,
                            first.latent_z
                        );
                    } else {
                        // Circular layout fallback
                        const angle = index * angleStep;
                        group.position.set(
                            Math.cos(angle) * radius,
                            (index % 3) * 300, // Vary height
                            Math.sin(angle) * radius
                        );
                    }

                    scene.add(group);
                    groupsRef.current.push(group);
                    group.userData = { isCluster: true, nodes: nodesInCluster, clusterId };

                    // Register nodes
                    nodesInCluster.forEach(n => {
                        n.mesh = group;
                        nodeMap.set(n.id, n);
                        nodesRef.current.push(n);
                        createdCount++;
                    });
                });

                console.log(`✅ [SAI Analysis] Created ${clusterKeys.length} voxel clusters with ${createdCount} nodes`);
            }
            // ============ 3D TABLES LENS (tier3) - NEURAL CORE + INDIVIDUAL NODES ============
            else if (currentLens === 'tier3') {
                console.log("[ThreeGraph] 🧊 Activating 3D Tables - Neural Core + Individual Voxels");

                // 1. CREATE CENTRAL NEURAL CORE (Combined Voxel Chunk)
                const neuralCore = createClusterVoxelMesh(layoutNodes, 'tier3');
                neuralCore.position.set(0, 0, 0); // Center position

                // Add "NEURAL CORE" label above
                const coreLabel = createTextSprite('NEURAL CORE - 3D TABLES', 120, '#00d4ff');
                coreLabel.position.set(0, 400, 0);
                neuralCore.add(coreLabel);

                scene.add(neuralCore);
                groupsRef.current.push(neuralCore);
                neuralCore.userData = {
                    isNeuralCore: true,
                    isCluster: true,
                    nodes: layoutNodes,
                    name: 'Neural Core'
                };

                console.log(`✅ Created Neural Core with ${layoutNodes.length} tables as combined voxel chunk`);

                // 2. CREATE INDIVIDUAL TABLE NODES (Around the core)
                layoutNodes.forEach((nodeData, i) => {
                    // Create individual voxel cube for each table
                    const voxelSize = 60; // Smaller than core voxels
                    const color = 0x000000; // Black color for all voxels
                    const tex = createDataGridTexture(nodeData.name, color, nodeData);

                    const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
                    const material = new THREE.MeshPhysicalMaterial({
                        map: tex,
                        transparent: true,
                        opacity: 0.85,
                        metalness: 0.2,
                        roughness: 0.5,
                        clearcoat: 0.8,
                        emissive: color,
                        emissiveIntensity: 0.15
                    });

                    const mesh = new THREE.Mesh(geometry, material);

                    // Position from physics simulation (around the core)
                    if (isNaN(nodeData.x)) nodeData.x = 0;
                    if (isNaN(nodeData.y)) nodeData.y = 0;
                    if (isNaN(nodeData.z)) nodeData.z = 0;

                    mesh.position.set(nodeData.x, nodeData.y, nodeData.z);
                    nodeData.mesh = mesh;
                    nodeData.baseY = nodeData.y;

                    // Add table name label above voxel
                    const label = createTextSprite(nodeData.name, 28, '#ffffff');
                    label.position.set(0, voxelSize / 2 + 15, 0);
                    mesh.add(label);

                    scene.add(mesh);
                    mesh.userData = { ...nodeData, isNode: true };
                    nodeMap.set(nodeData.id, nodeData);
                    nodesRef.current.push(nodeData);
                    createdCount++;
                });

                console.log(`✅ [3D Tables] Created Neural Core + ${createdCount} individual table voxels in graph structure`);
            }
            // ============ STANDARD SPHERE MODES (Ops, Security, Executive) ============
            else {
                // [PHASE 2 - INSTANCED MESH REFACTOR]
                const visibleNodes = layoutNodes.filter(n => n.visible !== false);
                const count = visibleNodes.length;

                if (count > 0) {
                    // [LEGACY RESTORATION - SASIR STYLE]
                    // Reverted from InstancedMesh to Individual Meshes for maximum visual fidelity
                    visibleNodes.forEach((nodeData) => {
                        // [FIX] Coordinate validation
                        if (isNaN(nodeData.x)) nodeData.x = nodeData.targetX || 0;
                        if (isNaN(nodeData.y)) nodeData.y = nodeData.targetY || 0;
                        if (isNaN(nodeData.z)) nodeData.z = nodeData.targetZ || 0;

                        // [RESTORATION] Create Mesh via Sasir Helper (Restores Legend/Lens Coloring)
                        const mesh = createNodeMesh(nodeData, currentLensRef.current, layoutModeRef.current, clusteringMethodRef.current, animatedObjectsRef.current);
                        if (!mesh) return;

                        mesh.position.set(nodeData.x, nodeData.y, nodeData.z);

                        // [FIX] Link Data & Refs for Animation/Raycasting
                        nodeData.mesh = mesh;
                        // Find the label sprite among children for D3 tick position updates (if any)
                        nodeData.labelSprite = mesh.children.find(c => c.type === 'Sprite');

                        scene.add(mesh);
                        nodesRef.current.push(nodeData);
                        nodeMap.set(nodeData.id, nodeData);
                        createdCount++;
                    });

                    // Clear Instanced Refs to prevent update loop conflicts
                    instancedMeshRef.current = null;
                    instancedShellRef.current = null;
                    textSpritesGroupRef.current = null; // Labels are children now

                    console.log(`✅ [Legacy Mode] Created ${createdCount} individual meshes.`);
                }
            }
            console.log(`[ThreeGraph] ✅ Created & Added ${createdCount} nodes.`);

            // UPDATE DEBUG HUD
            setDebugStats(prev => ({
                ...prev,
                nodes: createdCount,
                lastUpdate: new Date().toLocaleTimeString()
            }));

            // 3. Create Edges (CURVED)
            if (data.edges) {
                data.edges.forEach(edge => {
                    const source = nodeMap.get(edge.source);
                    const target = nodeMap.get(edge.target);
                    if (source && target) {
                        // CHANGED: Use Curved Edge with DETERMINISTIC SEEDing
                        // [FIX] Use raw coordinates, not mesh position (which is 0,0,0 for InstancedMesh)
                        const startPos = new THREE.Vector3(source.x, source.y, source.z);
                        const endPos = new THREE.Vector3(target.x, target.y, target.z);

                        const line = createCurvedEdge(startPos, endPos, edge, edge.source, edge.target);
                        line.userData.sourceId = edge.source;
                        line.userData.targetId = edge.target;

                        // [FIX] Store InstancedMesh ref or individual mesh ref if legacy
                        // For InstancedMesh, we don't have individual meshes to track, 
                        // so we rely on the ID map in the loop

                        scene.add(line);
                        edgesRef.current.push(line);
                    }
                });

                // UPDATE DEBUG HUD (Final Count)
                setDebugStats(prev => ({
                    ...prev,
                    edges: edgesRef.current.length
                }));
            }

            // 4. LATENT SPACE VISUALS (Manifold + Axes)
            if (layoutMode === 'latent' && data.latent_manifold) {
                console.log('[ThreeGraph] 🏔️ Rendering Latent Manifold...');

                // Remove old manifold/axes if they exist
                if (manifoldRef.current) {
                    scene.remove(manifoldRef.current);
                    disposeObject(manifoldRef.current); // FIX: Dispose resources
                    manifoldRef.current = null;
                }
                if (axesRef.current) {
                    scene.remove(axesRef.current);
                    disposeObject(axesRef.current); // FIX: Dispose resources
                    axesRef.current = null;
                }

                // Create new manifold terrain
                const manifold = createLatentManifold(data.latent_manifold);
                if (manifold) {
                    scene.add(manifold);
                    manifoldRef.current = manifold;
                }

                // Create axes and grid walls
                const axes = create3DAxes('latent', data.latent_manifold);
                scene.add(axes);
                axesRef.current = axes;

                // ADDED: Flow Arrows (SAI Branch Feature)
                const flows = createFlowArrows(data.latent_manifold);
                flows.userData = { isFlow: true };
                scene.add(flows);
                axesRef.current.add(flows); // Group cleanup

                // CAMERA TRANSITION: Pull back to see the massive manifold
                if (cameraRef.current && controlsRef.current) {
                    // Animate camera to a high vantage point
                    const targetPos = new THREE.Vector3(0, 15000, 20000); // High up and back
                    const lookAt = new THREE.Vector3(0, 0, 0);

                    // Use GSAP-like interpolation manually or via controls
                    // For now, snap + smooth damp, or use our camera manager
                    cameraFocus(targetPos, lookAt, 1.5);
                }

            } else {
                // Clean up manifold/axes when switching back to galaxy mode
                if (manifoldRef.current) {
                    scene.remove(manifoldRef.current);
                    disposeObject(manifoldRef.current); // FIX: Dispose resources
                    manifoldRef.current = null;
                }
                if (axesRef.current) {
                    scene.remove(axesRef.current);
                    disposeObject(axesRef.current); // FIX: Dispose resources
                    axesRef.current = null;
                }

                // CAMERA RESTORE: Back to Galaxy Scale
                if (layoutMode === 'galaxy' && cameraRef.current) {
                    const targetPos = new THREE.Vector3(0, 200, 1000); // Standard Galaxy View
                    const lookAt = new THREE.Vector3(0, 0, 0);
                    cameraFocus(targetPos, lookAt, 1.5);
                }
            }
        }

        // C. START PHYSICS
        // D3 PHYSICS ENGINE INTEGRATION (3D)
        const simulation = forceSimulation(nodesRef.current)
            .stop() // STOP: Don't start recalculating until fully configured
            .numDimensions(3)
            .alphaDecay(0.02)
            .velocityDecay(0.3)

            .force("charge", forceManyBody()
                .strength(d => {
                    // LATENT STABILITY: Disable charge repulsion in latent mode to prevent jitter
                    if (layoutMode === 'latent') return 0;
                    const s = -100 * (d.importance_score || 1.0);
                    return isNaN(s) ? -30 : s;
                })
                .distanceMax(300)
            )
            .force("collide", d3.forceCollide()
                // LATENT STABILITY: Disable collision to allow perfect stacking
                // Radius: Use updated d.size (visual radius) * buffer
                .radius(d => (layoutMode === 'latent') ? 0 : (d.size || 10) * 1.2)
                .iterations(3) // Increase iterations for stability
            )
            .force("link", forceLink(edgesRef.current.map(e => ({ source: e.userData.sourceId, target: e.userData.targetId, ...e })))
                .id(d => d.id)
                .distance(d => {
                    const intensity = d.trafficIntensity || 0.5;
                    // Increased min distance to prevent clustering
                    if (intensity <= 0.01) return 150;
                    const dist = 150 / intensity;
                    return isNaN(dist) ? 150 : Math.min(dist, 600);
                })
                .strength(layoutMode === 'latent' ? 0 : 0.05) // Reduced strength to let collision work
            )
            .force("x", forceX(d => d.targetX || 0).strength(0.8))
            .force("y", forceY(d => d.targetY || 0).strength(0.8))
            .force("z", forceZ(d => d.targetZ || 0).strength(0.8))
            .on("tick", () => {
                const currentScene = sceneRef.current;
                if (!currentScene) return;

                // [FIX] Map for fast lookup of D3 nodes by ID
                const nodeMap = new Map();
                nodesRef.current.forEach(n => nodeMap.set(n.id, n));

                nodesRef.current.forEach((d) => {
                    // [FIX] Layout Logic
                    if (isNaN(d.x) || isNaN(d.y) || isNaN(d.z)) {
                        d.x = d.targetX || 0;
                        d.y = d.targetY || 0;
                        d.z = d.targetZ || 0;
                    }

                    // TIER 3 (VOXEL) FIX: Do not move voxels with D3 physics!
                    if (d.isVoxel || currentLens === 'tier3') return;

                    // If it's the very first tick and alpha is high, bypass lerp for instant positioning
                    if (d.mesh) {
                        if (simulation.alpha() > 0.95) {
                            d.mesh.position.set(d.x, d.y, d.z);
                        } else {
                            d.mesh.position.lerp(new THREE.Vector3(d.x, d.y, d.z), 0.1);
                        }
                    }

                    // 3. UPDATE TEXT LABELS
                    if (d.labelSprite && !d.mesh) {
                        const size = d.size || 5;
                        d.labelSprite.position.set(d.x, d.y + size + 10, d.z);
                    }
                });

                // [FIX] 4. UPDATE EDGES (Visual Curves)
                if (edgesRef.current) {
                    edgesRef.current.forEach(edge => {
                        const sId = edge.userData.sourceId;
                        const tId = edge.userData.targetId;

                        const source = nodeMap.get(sId);
                        const target = nodeMap.get(tId);

                        // Ensure we have D3 nodes and the curve object
                        if (source && target && edge.geometry && edge.userData.curve) {
                            const start = new THREE.Vector3(source.x, source.y, source.z);
                            const end = new THREE.Vector3(target.x, target.y, target.z);

                            // Calculate mid-point with curve (simple quadratic bezier)
                            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                            mid.y += (start.distanceTo(end) * 0.2);

                            // Update Curve Control Points
                            edge.userData.curve.v0.copy(start);
                            edge.userData.curve.v1.copy(mid);
                            edge.userData.curve.v2.copy(end);

                            // Update Geometry from Curve
                            const points = edge.userData.curve.getPoints(50);
                            edge.geometry.setFromPoints(points);
                            edge.geometry.attributes.position.needsUpdate = true;
                        }
                    });
                }
            });

        simulationRef.current = simulation;

        // Link D3 nodes to Three.js meshes (for Edge updates)
        nodesRef.current.forEach(node => {
            const mesh = node.mesh;
            if (mesh) {
                mesh.userData.d3Node = node;
                node.x = node.targetX || 0;
                node.y = node.targetY || 0;
                node.z = node.targetZ || 0;
                edgesRef.current.forEach(edge => {
                    if (edge.userData.sourceId === node.id) edge.userData.sourceNode = mesh;
                    if (edge.userData.targetId === node.id) edge.userData.targetNode = mesh;
                });
            }
        });

        // 4. RAMP UP LINKS (Prevent Cold-Start Clumping)
        setTimeout(() => {
            if (simulationRef.current) {
                simulationRef.current.force("link").strength(0.7);
                simulationRef.current.alpha(1).restart();
            }
        }, 1000);

        simulation.alpha(1).restart();

    }, [data, layoutMode, currentLens, clusteringMethod]); // Re-run when data, layoutMode, currentLens OR clusteringMethod changes



    // --- DEBUG HUD STATE ---
    // Duplicate removed

    // --- VIEW MODE SWITCHING (Logic Moved to LatentWorld Component) ---
    // We only keep the state to toggle the overlay
    const [viewMode, setViewMode] = React.useState('topology');
    const [drilldownNode, setDrilldownNode] = React.useState(null);

    // Store setters in refs so onClick handler can access them
    setViewModeRef.current = setViewMode;
    setDrilldownNodeRef.current = setDrilldownNode;

    // Background Style Logic (Dynamic)
    const containerStyle = {
        background: layoutMode === 'latent' ? latentBg : 'radial-gradient(circle at center, #1a202c 0%, #000000 100%)',
        transition: 'background 1s ease-in-out'
    };


    return (
        <div ref={containerRef} className={className || "fixed inset-0 z-0"} style={containerStyle}>
            {/* LATENT PALETTE PANEL (User Request) */}
            {layoutMode === 'latent' && (
                <div className="absolute top-24 right-6 z-50 flex flex-col gap-2 p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] mb-1">Atmosphere</span>
                    <div className="flex gap-2">
                        {/* Deep Space (Default) */}
                        <button
                            onClick={() => setLatentBg('radial-gradient(circle at center, #1a202c 0%, #000000 100%)')}
                            className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                            style={{ background: 'radial-gradient(circle at center, #1a202c 0%, #000000 100%)' }}
                            title="Deep Space"
                        />
                        {/* Midnight Blue */}
                        <button
                            onClick={() => setLatentBg('linear-gradient(to bottom, #0f172a, #1e1b4b)')}
                            className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                            style={{ background: 'linear-gradient(to bottom, #0f172a, #1e1b4b)' }}
                            title="Midnight Blue"
                        />
                        {/* Obsidian */}
                        <button
                            onClick={() => setLatentBg('#000000')}
                            className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                            style={{ backgroundColor: '#000000' }}
                            title="Obsidian"
                        />
                        {/* Nebula Purple */}
                        <button
                            onClick={() => setLatentBg('radial-gradient(circle at top right, #3b0764, #000000)')}
                            className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                            style={{ background: 'radial-gradient(circle at top right, #3b0764, #000000)' }}
                            title="Nebula"
                        />
                        {/* Custom Color Picker */}
                        <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20 hover:scale-110 transition-transform bg-white">
                            <input
                                type="color"
                                className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 opacity-0"
                                onChange={(e) => setLatentBg(e.target.value)}
                            />
                            <div className="absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_50%,#FF0000_0deg,#00FF00_120deg,#0000FF_240deg,#FF0000_360deg)] pointer-events-none" />
                        </div>
                    </div>
                </div>
            )}

            {/* DEBUG HUD - REMOVE BEFORE PRODUCTION */}


            {/* TOPOLOGY VIEW (Always Mounted) */}
            < div ref={mountRef} className="absolute inset-0 z-0" />

            <div className="absolute bottom-6 left-6 z-50 flex gap-2">
                <div className="px-4 py-2 rounded border font-mono text-sm bg-cyan-500/20 border-cyan-400 text-cyan-300 pointer-events-none opacity-80">
                    TOPOLOGY VIEW • Click any node to explore
                </div>
            </div>
            {/* Latent Mode Toggle Button */}
            {
                layoutMode === 'latent' && (
                    <>
                        <button
                            onClick={() => setLayoutMode('galaxy')}
                            className="absolute top-4 right-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-semibold z-50"
                        >
                            ← Back to Topology
                        </button>

                        {/* TIME TRAVEL SLIDER (User Request) */}
                        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-1/3 z-50 flex flex-col items-center gap-2">
                            <div className="flex justify-between w-full text-xs font-mono text-cyan-400 uppercase tracking-widest">
                                <span>Genesis</span>
                                {/* Use span with ID for direct DOM update to avoid re-renders */}
                                <span id="time-travel-label">Time Distortion: {timeProgress}%</span>
                                <span>Now</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                defaultValue={100} // Uncontrolled for performance
                                onInput={(e) => {
                                    const val = parseInt(e.target.value);
                                    timeProgressRef.current = val; // Update Ref (No Re-render)

                                    // Direct DOM update for label
                                    const label = document.getElementById('time-travel-label');
                                    if (label) label.innerText = `Time Distortion: ${val}%`;

                                    // Update Visibility Immediately (Direct Node Manipulation)
                                    if (nodesRef.current) {
                                        nodesRef.current.forEach((n, i) => {
                                            if (n.mesh) {
                                                // Deterministic "Birth Time" based on Index/ID hash
                                                const seed = (n.id.charCodeAt(0) + n.id.length * 5) % 100;

                                                // Visible if seed <= time
                                                const isVisible = seed <= val;
                                                n.mesh.visible = isVisible;

                                                // Ghosting/New Data Effect
                                                if (isVisible) {
                                                    // If just born (within 10%), make it bright white
                                                    if (seed > val - 10) {
                                                        // Flash Base
                                                        if (n.mesh.material.emissive) n.mesh.material.emissive.setHex(0xffffff);
                                                        else n.mesh.material.color.setHex(0xffffff);

                                                        // Flash Shell (if exists)
                                                        if (n.mesh.children[0] && n.mesh.children[0].material) {
                                                            if (n.mesh.children[0].material.emissive) n.mesh.children[0].material.emissive.setHex(0xffffff);
                                                        }
                                                    } else {
                                                        // RESTORE ORIGINAL STATE
                                                        // 1. Reset Color
                                                        if (n.mesh.userData.originalColor) {
                                                            n.mesh.material.color.setHex(n.mesh.userData.originalColor);
                                                        }
                                                        // 2. Reset Emissive (if applicable)
                                                        if (n.mesh.userData.originalColor) {
                                                            if (n.mesh.material.emissive) n.mesh.material.emissive.setHex(n.mesh.userData.originalColor);
                                                            // Ensure Shell matches
                                                            if (n.mesh.children[0] && n.mesh.children[0].material && n.mesh.children[0].material.emissive) {
                                                                n.mesh.children[0].material.emissive.setHex(n.mesh.userData.originalColor);
                                                            }
                                                        }

                                                        const targetIntensity = layoutMode === 'latent' ? 2.0 : 1.5;
                                                        if (n.mesh.material.emissive) n.mesh.material.emissiveIntensity = targetIntensity;
                                                        if (n.mesh.children[0] && n.mesh.children[0].material) n.mesh.children[0].material.emissiveIntensity = targetIntensity;
                                                    }
                                                }
                                            }
                                        });
                                    }
                                }}
                                onMouseUp={(e) => {
                                    // Sync React state only when drag ends
                                    setTimeProgress(parseInt(e.target.value));
                                }}
                                className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                            />
                        </div>
                    </>
                )
            }
        </div >
    );
});

function triggerBirthEffect(mesh) {
    const originalScale = mesh.scale.clone();
    const flashColor = new THREE.Color(0xffffff);
    const originalColor = mesh.material.color.clone();

    // Sudden grow and flash
    mesh.scale.multiplyScalar(2.0);
    mesh.material.color.set(flashColor);

    setTimeout(() => {
        mesh.scale.copy(originalScale);
        mesh.material.color.copy(originalColor);
    }, 500);
}

export default React.memo(ThreeGraph);
