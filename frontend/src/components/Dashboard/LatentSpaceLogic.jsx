import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
    OrbitControls,
    TransformControls,
    EffectComposer,
    RenderPass,
    UnrealBloomPass
} from 'three-stdlib';
import { SeededRNG } from '../../utils/mathUtils';
import { getLatentRegistry } from './LatentSpaceLogic_Core.js';
import EdgeStatsPanel from './EdgeStatsPanel';



/**
 * Step 1 — Enrich Node Data (Before applyLatentSpaceLayout)
 * Your nodes need two new derived fields.
 */
export function enrichNodesWithDependency(nodes, edges = []) {
    // Build a set of node IDs that have at least one incoming edge (they are "dependent")
    const hasUpstream = new Set();
    const downstreamMap = {}; // nodeId -> [downstreamIds]
    const upstreamMap = {};   // nodeId -> [upstreamIds]

    edges.forEach(edge => {
        hasUpstream.add(edge.target);  // target has an upstream source

        if (!downstreamMap[edge.source]) downstreamMap[edge.source] = [];
        downstreamMap[edge.source].push(edge.target);

        if (!upstreamMap[edge.target]) upstreamMap[edge.target] = [];
        upstreamMap[edge.target].push(edge.source);
    });

    return nodes.map(node => ({
        ...node,
        // [PROPER LOGIC] Prefer backend fields if they exist, fallback to local enrichment
        has_upstream_deps: node.has_upstream_deps !== undefined ? node.has_upstream_deps : hasUpstream.has(node.id),
        upstream_node_ids: node.upstream_node_ids || upstreamMap[node.id] || [],
        downstream_node_ids: node.downstream_node_ids || downstreamMap[node.id] || [],

        // Frontend compatibility (camelCase)
        hasUpstreamDeps: node.has_upstream_deps !== undefined ? node.has_upstream_deps : hasUpstream.has(node.id),
        downstreamNodeIds: node.downstream_node_ids || downstreamMap[node.id] || [],
    }));
}

export const LENS_CATEGORIES = {
    ops: [
        { id: 'Anomalous Peaks', color: '#ff1111' }, // Red
        { id: 'Dependent Facts', color: '#1144ff' }, // Blue
        { id: 'Healthy Tables', color: '#11ff44' }, // Green
        { id: 'Independent Facts', color: '#ffcc00' } // Yellow
    ],
    tier3: [
        { id: 'Anomalous Peaks', color: '#ff1111' }, // Red
        { id: 'Dependent Facts', color: '#1144ff' }, // Blue
        { id: 'Healthy Tables', color: '#11ff44' }, // Green
        { id: 'Independent Facts', color: '#ffcc00' } // Yellow
    ],
    security: [
        { id: 'Critical Threats', color: '#ff1111' }, // Red
        { id: 'Vulnerable Assets', color: '#ff8800' }, // Orange
        { id: 'Guarded Nodes', color: '#1144ff' }, // Blue
        { id: 'Secure Data', color: '#11ff44' } // Green
    ],
    energy: [
        { id: 'Critical Failures', color: '#ff1111' }, // Red
        { id: 'Warning Sensors', color: '#ff8800' }, // Orange
        { id: 'Grid Infrastructure', color: '#1144ff' }, // Blue
        { id: 'Energy Consumers', color: '#11ff44' } // Green
    ]
};

export const getLensCategories = (lens) => {
    return LENS_CATEGORIES[lens] || LENS_CATEGORIES.ops;
};

/**
 * Helper to find height on the manifold for any X, Z
 * Calculates the "waves" based on the actual clustered nodes.
 */
export function computeCentroids(nodes, currentLens = 'ops') {
    const totalNodes = nodes ? nodes.length : 0;
    const spacing = Math.max(15000, 10000 + totalNodes * 50);

    const categories = getLensCategories(currentLens);

    const counts = {};
    const semanticHeights = {};
    const totalTransactions = {};

    categories.forEach(cat => {
        counts[cat.id] = 0;
        semanticHeights[cat.id] = 0;
        totalTransactions[cat.id] = 0;
    });

    if (nodes) {
        nodes.forEach(n => {
            const cat = n.latent_category || 'Healthy Tables';
            if (counts[cat] !== undefined) {
                counts[cat]++;
                semanticHeights[cat] = Math.max(semanticHeights[cat], n.targetY || 50);
                totalTransactions[cat] += (n.row_count || n.rowCount || 0);
            }
        });
    }

    return categories.map((cat, index) => ({
        x: (index - 1.5) * spacing,
        z: 0,
        count: Math.max(5, counts[cat.id]),
        semanticHeight: semanticHeights[cat.id],
        totalVolume: totalTransactions[cat.id],
        color: cat.color,
        id: cat.id
    }));
}

export function getManifoldHeight(x, z, centroids) {
    if (!centroids || centroids.length === 0) return 0;

    let maxElevation = 0;

    // 1. Generate low-frequency organic coordinates to distort perfect roundness
    // This creates non-spherical, sprawling ridge structures
    const warpX = Math.sin(x * 0.0001) * 8000;
    const warpZ = Math.cos(z * 0.0001) * 8000;

    centroids.forEach(c => {
        // Distance from the center with ORGANIC DISTORTION
        const d2 = Math.pow((x + warpX) - c.x, 2) + Math.pow((z + warpZ) - c.z, 2);

        // Spread radius so the 4 mountains stand uniquely apart
        const sigma = 6000.0 + (c.count * 30);

        // Smooth organic decay
        const w = Math.exp(-d2 / (2 * sigma * sigma));

        // [STRICT ALIGNMENT] Mountain Volume Scaling
        // Based on more nodes and transactions mountain height should be there
        // Aggressive volume scaling: 500 units per log10 volume + 25 units per node
        const volumeFactor = Math.log10(c.totalVolume + 1) * 500;
        const frequencyFactor = c.count * 25;

        let height = (volumeFactor + frequencyFactor) * w;

        // Safety: Ensure a base height reflecting the semantic peak of the cluster
        height = Math.max(height, (c.semanticHeight * 0.8) * w);

        // Take the maximum elevation among all 4 mountains to prevent weird overlapping spikes
        if (height > maxElevation) {
            maxElevation = height;
        }
    });

    // 2. Add ultra low-frequency rolling noise to break up the perfectly smooth slopes
    // This creates rolling sub-hills and organic ridges across the huge slopes
    const rollingNoise = (Math.sin(x * 0.00015) * Math.cos(z * 0.00015)) * 1800;

    // We max(0, ...) so noise doesn't dig massive holes below the base grid level (0)
    return Math.max(0, maxElevation + rollingNoise);
}

/**
 * Create Latent Manifold Terrain (Dynamic Data Driven)
 * Handles the sci-fi grid terrain and visual styling based on nodes.
 */
export function createLatentManifold(nodes, currentLens = 'ops') {
    if (!nodes || nodes.length === 0) return null;

    const centroids = computeCentroids(nodes, currentLens);

    const group = new THREE.Group();
    const res = 150; // Smooth organic rolling hills
    const width = 100000; // expanded grid for linear mountains
    const depth = 60000;
    const geometry = new THREE.PlaneGeometry(width, depth, res, res);

    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    // Dynamic coloring based on node category clouds
    for (let i = 0; i < vertices.length; i += 3) {
        // PlaneGeometry creates a flat mesh on the X,Y plane.
        // We later rotate the group `group.rotation.x = -Math.PI / 2;`
        // This means the Plane's Y coordinate becomes the World's -Z coordinate.
        // To align perfectly with the D3 simulation's `targetX` and `targetZ`:
        const localX = vertices[i];
        const localY = vertices[i + 1];

        // World coordinates after rotation:
        const worldX = localX;
        const worldZ = -localY;

        // 1. Calculate Height dynamically based on clusters
        const height = getManifoldHeight(worldX, worldZ, centroids);

        // Push the Z coordinate of the PlaneGeometry (which is currently flat at 0)
        // Since we rotate the plane -90 deg on X, the Plane's local Z becomes the World's Y (height!)
        vertices[i + 2] = height;

        // 2. Calculate Color
        let maxInfluence = 0;
        let dominantColor = new THREE.Color(0.01, 0.02, 0.06);

        // Map pure singular color to the terrain, avoiding any multi-cluster mixing
        centroids.forEach(c => {
            const d2 = Math.pow(worldX - c.x, 2) + Math.pow(worldZ - c.z, 2);

            // Tighter color glow covering just the mountain peak
            const sigma = 6000.0 + ((c.count || 5) * 20);
            const influence = Math.exp(-d2 / (2 * sigma * sigma));

            // Strongly prefer the nearest peak
            if (influence > maxInfluence) {
                maxInfluence = influence;
                if (influence > 0.05) {
                    dominantColor.set(c.color);
                }
            }
        });

        if (maxInfluence > 0.05) {
            // Smoothly interpolate towards dark background, NO color mixing between mountains
            const t = Math.min(1, (maxInfluence - 0.05) / 0.5);
            const finalColor = new THREE.Color(0.01, 0.02, 0.06).lerp(dominantColor, t);
            colors[i] = finalColor.r;
            colors[i + 1] = finalColor.g;
            colors[i + 2] = finalColor.b;
        } else {
            // Sci-Fi Deep Grid Dark Blue/Black in empty space between massive clusters
            colors[i] = 0.01; colors[i + 1] = 0.02; colors[i + 2] = 0.06;
        }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const surfaceMaterial = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        metalness: 0.0, // DEAD FLAT matte so no shiny reflections cause "glitter"
        roughness: 1.0, // Maximum softness
        clearcoat: 0.0, // NO glass shine
        side: THREE.DoubleSide, // Make it visible from above!
        blending: THREE.AdditiveBlending
    });

    const surface = new THREE.Mesh(geometry, surfaceMaterial);

    const wireframe = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.05, // Almost invisible wireframe to stop line-flickering (glitter)
        wireframe: true,
        blending: THREE.AdditiveBlending
    }));

    group.add(wireframe);
    group.add(surface);

    group.rotation.x = -Math.PI / 2;
    // Lift the terrain immensely so mountains cover the clusters
    // We drop the base just slightly below 0 so the nodes aren't fully buried in the valleys
    group.position.y = -800;
    group.userData = { isManifold: true };
    return group;
}

/**
 * Layout for Latent Space Mode (ORGANIC AI-DRIVEN)
 * Groups nodes into 4 Futuristic Sci-Fi Categories (Fact, Dimension, Anomaly, High Transaction)
 * and arranges them in growing clouded layouts based on node count.
 */
export function applyLatentSpaceLayout(nodes, currentLens = 'ops') {
    const cats = getLensCategories(currentLens);
    const clusters = {};
    cats.forEach(c => {
        clusters[c.id] = [];
        c.count = 0;
    });

    console.log(`[LatentLogic] Applying layout to ${nodes.length} nodes for Lens: ${currentLens}`);

    // 1. Assign each to a 4-Category Sci-Fi Affinity Group
    nodes.forEach(node => {
        if (node.id === 'hub' || node.id === 'DATABASE_CORE') return;

        const isFactTable = node.isFactTable || false;
        const isAnomalous = node.is_anomalous || node.isAnomalous || (node.healthScore < 25);
        const nodeType = (node.table_type || node.type || '').toLowerCase();
        const baseHealth = node.vitality !== undefined ? node.vitality : (node.healthScore || 100);

        // [STRICT ALIGNMENT] Ignore hub/core for dependency checks
        const filteredUpstreams = (node.upstreamNodeIds || []).filter(id => id !== 'hub' && id !== 'DATABASE_CORE');
        const hasUpstream = filteredUpstreams.length > 0 || (node.has_upstream_deps === true && !node.isSource);
        const isYellowCandidate = (isFactTable || node.isSource === true) && !hasUpstream;

        // [STRICT ALIGNMENT] Placement Priority & Node-Level Height Formula
        let nodeHeight = 50;
        const multiplier = 100;

        let assignedCat = cats[2]; // Default index 2 (Green)

        if (currentLens === 'ops' || currentLens === 'tier3') {
            if (isYellowCandidate) {
                assignedCat = cats[3]; // Yellow
                nodeHeight = (node.independencyScore || 0) * (node.affectedDownstreamCount || 0) * 30 * multiplier;
            } else if (isAnomalous) {
                assignedCat = cats[0]; // Red
                nodeHeight = (node.anomalySeverity || 0) * (node.affectedDownstreamCount || 0) * 0.5 * multiplier;
            } else if (isFactTable && hasUpstream) {
                assignedCat = cats[1]; // Blue
                const upCount = node.upstreamNodeIds?.length || 0;
                nodeHeight = (node.dependencyDepth || 1) * upCount * 5 * multiplier;
            } else {
                assignedCat = cats[2]; // Green
                const rowNorm = Math.min(10, Math.log10((node.row_count || node.rowCount || 1) + 1));
                nodeHeight = baseHealth * rowNorm * 0.2 * multiplier;
            }
        } else if (currentLens === 'security') {
            // Use table name keywords to identify security domains, not raw health thresholds
            // that push 70%+ of nodes into one cluster.
            const nodeId = (node.id || '').toLowerCase();
            const isAuthTable = /auth|token|session|otp|biometric|secret|key|password|credential|permission|role|access|login|mfa|jwt/.test(nodeId);
            const isSensitiveTable = /user|account|payment|card|bank|kyc|pii|identity|profile|wallet|transaction|audit/.test(nodeId);
            const isMonitoringTable = /log|event|alert|incident|threat|scan|report|monitor|security|anomal|risk|fraud/.test(nodeId);

            if (isAnomalous || isAuthTable) {
                assignedCat = cats[0]; // Red — Critical Threats (auth tables + anomalous)
                nodeHeight = (100 - baseHealth) * multiplier * 0.5;
            } else if (isSensitiveTable) {
                assignedCat = cats[1]; // Orange — Vulnerable Assets (sensitive data)
                nodeHeight = (node.dependencyDepth || 1) * 10 * multiplier;
            } else if (isMonitoringTable || hasUpstream) {
                assignedCat = cats[2]; // Blue — Guarded Nodes (monitoring/dependent tables)
                const rowNorm = Math.min(10, Math.log10((node.row_count || 1) + 1));
                nodeHeight = (node.dependencyDepth || 1) * rowNorm * 5 * multiplier;
            } else {
                assignedCat = cats[3]; // Green — Secure Data (reference/config tables)
                nodeHeight = baseHealth * 0.3 * multiplier;
            }
        } else if (currentLens === 'energy') {
            // Use WEZU-specific table names — DB tables never have type 'bess'/'grid'/'meter'
            const nodeId = (node.id || '').toLowerCase();
            const isBatteryCore = /^batteries$|^battery_batches$|^battery_specs$|^battery_transfers$/.test(nodeId);
            const isSensorTable = /telemeti|telematics|gps|tracking|sensor|telemetry/.test(nodeId);
            const isHealthTable = /healthlog|batteryhealth|maintenance|lifecycle|inspection/.test(nodeId);
            const isStation = /^stations$|^station/.test(nodeId);

            if (isAnomalous || (baseHealth < 40)) {
                assignedCat = cats[0]; // Red — Critical Failures
                nodeHeight = (node.anomalySeverity || (100 - baseHealth)) * 10 * multiplier;
            } else if (isSensorTable) {
                assignedCat = cats[1]; // Orange — Warning Sensors (live telemetry)
                nodeHeight = (node.row_count || 1) * 0.5 * multiplier;
            } else if (isBatteryCore || isStation || isHealthTable) {
                assignedCat = cats[2]; // Blue — Grid Infrastructure (core WEZU tables)
                nodeHeight = (node.dependencyDepth || 1) * 30 * multiplier;
            } else {
                assignedCat = cats[3]; // Green — Energy Consumers (all other tables)
                const rowNorm = Math.min(10, Math.log10((node.row_count || 1) + 1));
                nodeHeight = baseHealth * rowNorm * 0.2 * multiplier;
            }
        }

        // Clamp height for visual stability
        node.semanticElevation = Math.max(100, Math.min(nodeHeight, 8000));
        node.targetY = node.semanticElevation;
        node.y = node.targetY;

        node.latent_category = assignedCat.id;

        // [DISTINCT COLORS] High-Contrast Deterministic Jitter
        const baseColor = new THREE.Color(assignedCat.color);
        const seed = node.id;
        const rng = new SeededRNG(seed);

        const hsl = {};
        baseColor.getHSL(hsl);

        // WIDER HUE RANGE: +/- 0.2 (72 degrees) for intense color variety
        const hShift = (rng.next() - 0.5) * 0.4;

        // HIGH SATURATION: Keep them very vibrant (0.8 to 1.0)
        const finalS = 0.8 + (rng.next() * 0.2);

        // BALANCED LIGHTNESS: Lowered from 0.85 to 0.65 to prevent white-out (0.4 to 0.65)
        const finalL = 0.4 + (rng.next() * 0.25);

        const finalColor = new THREE.Color().setHSL(
            (hsl.h + hShift + 1) % 1,
            finalS,
            finalL
        );

        node.latent_color = `#${finalColor.getHexString()}`;

        clusters[assignedCat.id].push(node);
    });

    const clusterKeys = Object.keys(clusters);

    // Macro spacing to ensure the massive clouds don't overlap
    // Align mountains one after the other in a line
    const totalNodes = nodes.length;
    const spacing = Math.max(15000, 10000 + totalNodes * 50);

    clusterKeys.forEach((key, index) => {
        const clusterNodes = clusters[key];
        const numInCluster = clusterNodes.length;

        // "One after one" inline array along X-axis
        const cx = (index - 1.5) * spacing;
        const cz = 0;

        // Micro-distribution: Organic Noisy Gaussian Spread
        // Sort nodes by row count (size) so biggest are generally nearer the center
        clusterNodes.sort((a, b) => (b.row_count || 0) - (a.row_count || 0));

        clusterNodes.forEach((node, i) => {
            // ORGANIC SPREAD: Tighter concentration near peaks for a "bloom" effect
            const maxSpread = 1500 + (numInCluster * 60);

            // ORGANIC SPREAD: High concentration at center, tapering out gracefully
            // Lowered power factor from 3.5 to 1.2 to allow wide range spread
            const spreadFactor = Math.pow(Math.random(), 1.2);
            const distance = spreadFactor * maxSpread;
            const theta = Math.random() * Math.PI * 2;

            // X and Z revolve around the cluster center `cx, cz` organically
            const nx = cx + distance * Math.cos(theta);
            const nz = cz + distance * Math.sin(theta);

            // [REFINEMENT] Hover offset scaled by density
            // Inner nodes float higher, outer nodes sit closer to the slope
            const cloudHeightVariance = (Math.random() * 100) * (1 - spreadFactor);

            node.targetX = nx;
            node.targetZ = nz;
            node._hoverOffset = cloudHeightVariance; // Store for Pass 2

            // LENS-BASED VISIBILITY
            if (currentLens === 'executive') {
                const isHighValue = (node.gravity > 7.0) || (node.row_count > 50000) || (node.isCore);
                node.visible = isHighValue;
            } else {
                node.visible = true;
            }

            node.zone = key; // Keep track of its zone
        });
    });

    // PASS 2: Anchor nodes precisely to the generated Latent Mountain structure
    const centroids = computeCentroids(nodes);
    nodes.forEach(node => {
        if (node.id === 'hub' || node.id === 'DATABASE_CORE') return;
        if (node.targetX !== undefined && node.targetZ !== undefined) {
            // [REFINEMENT] Relative Terrain Anchoring
            // Calculate height of the mountain at this exact coordinate
            const surfaceHeight = getManifoldHeight(node.targetX, node.targetZ, centroids);

            // Nodes float at a comfortable offset above the surface
            // base offset + semantic contribution (capped)
            const baseOffset = 40;
            const semanticContribution = (node.semanticElevation || 0) * 0.04;

            // Anchor relative to terrain (-800 world shift)
            node.targetY = (surfaceHeight - 800) + baseOffset + semanticContribution + (node._hoverOffset || 0);

            // Apply directly as a starting point to avoid wild drifting
            node.x = node.targetX;
            node.y = node.targetY;
            node.z = node.targetZ;

            // LOCK D3 PHYSICS: Force nodes to strictly stay in their clusters
            node.fx = node.targetX;
            node.fy = node.targetY;
            node.fz = node.targetZ;
        }
    });

    // Don't forget the core nodes
    nodes.forEach(node => {
        if (node.id === 'hub' || node.id === 'DATABASE_CORE') {
            node.targetX = 0;
            node.targetY = 2000;
            node.targetZ = 0;
            node.x = node.targetX;
            node.y = node.targetY;
            node.z = node.targetZ;
            node.fx = node.targetX;
            node.fy = node.targetY;
            node.fz = node.targetZ;
        }
    });

    return nodes;
}

/**
 * Step 4 — Dependency Propagation on Toggle
 * Breadth-first traversal to find all impacted downstream nodes
 */
export function propagateImpact(toggledNodeId, allNodes) {
    const nodeMap = Object.fromEntries(allNodes.map(n => [n.id, n]));
    const impacted = new Set();
    const queue = [toggledNodeId];

    while (queue.length > 0) {
        const current = queue.shift();
        const node = nodeMap[current];
        const downstreamIds = node?.downstreamNodeIds || node?.downstream_node_ids || [];
        if (!node || downstreamIds.length === 0) continue;

        downstreamIds.forEach(downId => {
            if (!impacted.has(downId)) {
                impacted.add(downId);
                queue.push(downId);
            }
        });
    }
    return impacted; // Set of affected node IDs
}

/**
 * Create 3D Axes for Latent Space (ORGANIC + SHADOWS)
 */
export function create3DAxes(layoutMode) {
    const group = new THREE.Group();
    if (layoutMode !== 'latent') return group;

    const size = 100000;
    const depth = 60000;

    // 1. Background Grid Walls - GROUNDED
    const wall1 = new THREE.GridHelper(size, 40, 0x1e293b, 0x0f172a);
    wall1.rotation.x = Math.PI / 2;
    wall1.position.z = -depth / 2.5;
    wall1.position.y = -500;
    wall1.material.opacity = 0.1;
    wall1.material.transparent = true;
    group.add(wall1);

    const wall2 = new THREE.GridHelper(depth, 40, 0x1e293b, 0x0f172a);
    wall2.rotation.z = Math.PI / 2;
    wall2.position.x = -size / 2.5;
    wall2.position.y = -500;
    wall2.material.opacity = 0.1;
    wall2.material.transparent = true;
    group.add(wall2);

    return group;
}

/**
 * Create Flow Arrows for Latent Space
 */
export function createFlowArrows(manifoldData) {
    // Utility for visualizing flow directions
    return new THREE.Group();
}

/**
 * Specialized Curved Edge for Latent Mode (Bridge Arcs)
 * This avoids disturbing the Galaxy Mode "Neural Web" look.
 */
export function createLatentBridgeEdge(sourcePos, targetPos, edgeData = {}, sourceId, targetId, isLatentMode = true, edgeColor = 0x00d4ff) {
    const start = new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z);
    const end = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);

    const distance = start.distanceTo(end);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    if (isLatentMode) {
        // High, clean "Bridge" arcs that go UP
        mid.y += distance * 0.5;
    } else {
        // Deterministic randomization for Galaxy Mode
        const seed = (sourceId && targetId) ? `${sourceId}-${targetId}` : JSON.stringify(sourcePos) + JSON.stringify(targetPos);
        const rng = new SeededRNG(seed);
        mid.x += (rng.next() - 0.5) * distance * 0.3;
        mid.y += (rng.next() - 0.5) * distance * 0.3;
        mid.z += (rng.next() - 0.5) * distance * 0.3;
    }

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const edgeGlow = edgeData.edge_glow || 1.0;
    const edgeWidth = Math.min(6, Math.max(1.5, edgeGlow * 1.5));
    const edgeOpacity = Math.min(0.9, Math.max(0.4, edgeGlow * 0.2));

    // Parse hexadecimal color string or use default number
    let finalColor = edgeColor;
    if (typeof edgeColor === 'string') {
        finalColor = new THREE.Color(edgeColor);
    }

    const material = new THREE.LineBasicMaterial({
        color: finalColor,
        transparent: true,
        opacity: edgeOpacity,
        linewidth: edgeWidth
    });

    const line = new THREE.Line(geometry, material);
    line.userData.curve = curve;
    line.userData.sourcePos = sourcePos;
    line.userData.targetPos = targetPos;
    line.userData.sourceId = sourceId;
    line.userData.targetId = targetId;
    line.userData.edgeData = edgeData;

    return line;
}

// =========================================================================
// REACT UI OVERLAY FOR LATENT SPACE
// =========================================================================

export const LatentSpaceUIOverlay = ({
    children, // This will be the 3D Canvas
    dataClusters,
    selectedNodeId,
    timeValue = 100,
    onTimeChange,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onClose,
    onToggleLens,
    activeFilters = {},
    onFilterChange,
    standalone = false, // If true, it acts as a transparent overlay for App.jsx
    hudOnly = false, // NEW: If true, hides header/footer to fit perfectly in DashboardLayout
    liveStats = null, // NEW: Receive real stats from App.jsx
    currentLens = 'ops', // NEW: Dynamic Lens categorization
    hoveredEdge // [NEW] Added for relationship hover detection
}) => {
    const starCanvasRef = useRef(null);
    const chartRefs = [useRef(null), useRef(null), useRef(null)];
    const modalChartRef = useRef(null);

    // Dynamic Filter Mapping
    const lensCategories = getLensCategories(currentLens);

    // Core Layout States
    const [aiOn, setAiOn] = useState(true);
    const [tier3On, setTier3On] = useState(true);
    const [panels, setPanels] = useState({ intel: true, filter: true, hud: true, relHud: true });
    const [stickyEdge, setStickyEdge] = useState(null); // [NEW] Stores last hovered edge
    const relHudUserClosed = useRef(false); // Track if user manually closed the Relationship HUD

    // Data stats
    // Compute total records from all loaded nodes, or default to a realistic baseline
    const calculatedTotalRecords = dataClusters?.reduce((sum, node) => sum + (node.row_count || Math.floor(Math.random() * 5000 + 1000)), 0) || 12462;
    const computedActiveThreads = dataClusters?.length || 125;

    const metrics = {
        snap: (liveStats?.totalTransactions > 0 ? liveStats.totalTransactions : calculatedTotalRecords).toLocaleString(),
        threads: (liveStats?.activeNodes > 0 ? liveStats.activeNodes : computedActiveThreads).toLocaleString(),
        lat: liveStats?.tps > 0 ? (1000 / liveStats.tps).toFixed(1) : '--',
        ghostLines: Math.max(190, 206 + (liveStats?.tps || 0) * 0.1),
        healthScore: liveStats?.health?.score ?? 90,
        avgVitality: dataClusters?.length > 0
            ? Math.round(dataClusters.reduce((s, n) => s + (n.vitality || n.healthScore || 100), 0) / dataClusters.length)
            : 90
    };

    const [chartModal, setChartModal] = useState({ open: false, type: 'throughput', tab: '1m' });

    const togglePanel = (id) => setPanels(p => ({ ...p, [id]: !p[id] }));

    // Extract selected node if needed
    let selectedNode = null;
    if (selectedNodeId && dataClusters) {
        dataClusters.forEach(cluster => {
            if (cluster && cluster.id === selectedNodeId) selectedNode = cluster;
            if (cluster.children) {
                const found = cluster.children.find(n => n.id === selectedNodeId);
                if (found) selectedNode = found;
            }
        });
    }

    // Capture hovered edge into sticky state - persists after hover ends
    useEffect(() => {
        if (hoveredEdge) {
            setStickyEdge(hoveredEdge);
            // Re-open if user hasn't manually closed it
            if (!relHudUserClosed.current) {
                setPanels(p => ({ ...p, relHud: true }));
            }
        }
    }, [hoveredEdge]);

    // Wrap togglePanel to also track user-closed state for relHud
    const handleToggleRelHud = () => {
        setPanels(p => {
            const newVal = !p.relHud;
            relHudUserClosed.current = !newVal; // if closing (newVal=false), mark as user-closed
            return { ...p, relHud: newVal };
        });
    };

    // --- ANIMATIONS ---
    useEffect(() => {
        let frameId;
        const sctx = starCanvasRef.current?.getContext('2d');
        const stars = Array.from({ length: 300 }, () => ({
            x: Math.random(), y: Math.random(),
            r: Math.random() * 1.2 + 0.2,
            a: Math.random() * 0.7 + 0.15,
            ph: Math.random() * Math.PI * 2,
        }));

        const drawStars = (t) => {
            if (!starCanvasRef.current || !sctx) return;
            const W = starCanvasRef.current.width = starCanvasRef.current.offsetWidth;
            const H = starCanvasRef.current.height = starCanvasRef.current.offsetHeight;
            sctx.clearRect(0, 0, W, H);

            /*
            // Nebulas
            [[0.25, 0.35, W * 0.28, 'rgba(30,0,80,0.16)'], [0.72, 0.55, W * 0.22, 'rgba(0,40,100,0.12)']].forEach(([cx, cy, r, c]) => {
                const g = sctx.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, r);
                g.addColorStop(0, c); g.addColorStop(1, 'transparent');
                sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);
            });
            */

            /*
            // Stars
            stars.forEach(s => {
                const tw = 0.5 + 0.5 * Math.sin(t * 0.7 + s.ph);
                sctx.globalAlpha = s.a * tw;
                sctx.fillStyle = '#fff';
                sctx.beginPath(); sctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); sctx.fill();
            });
            */
            sctx.globalAlpha = 1;
        };

        const drawSparklines = (t) => {
            const W = 80; const H = 46;
            // Line
            if (chartRefs[0].current) {
                const ctx = chartRefs[0].current.getContext('2d');
                chartRefs[0].current.width = W; chartRefs[0].current.height = H;
                ctx.clearRect(0, 0, W, H);

                const pts = Array.from({ length: 12 }, (_, i) => ({
                    x: (i / 11) * W,
                    y: H - (0.2 + 0.6 * Math.abs(Math.sin(i * 0.8 + t * 0.3))) * H
                }));
                ctx.beginPath();
                pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
                ctx.fillStyle = '#818cf830'; ctx.fill();
            }
            // Bar
            if (chartRefs[1].current) {
                const ctx = chartRefs[1].current.getContext('2d');
                chartRefs[1].current.width = W; chartRefs[1].current.height = H;
                ctx.clearRect(0, 0, W, H);
                const bars = [8, 20, 12, 17, 9, 22];
                const bw = (W - (bars.length - 1) * 2) / bars.length;
                bars.forEach((h, i) => {
                    const bh = (h / 22) * H * 0.85;
                    ctx.fillStyle = i === 1 ? '#a5b4fc' : '#818cf880';
                    ctx.fillRect(i * (bw + 2), H - bh, bw, bh);
                });
            }
            // Health icon
            if (chartRefs[2].current) {
                const ctx = chartRefs[2].current.getContext('2d');
                chartRefs[2].current.width = W; chartRefs[2].current.height = H;
                ctx.clearRect(0, 0, W, H);
                ctx.fillStyle = '#4ade80'; ctx.font = '18px serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('♥', W / 2, H / 2 - 2);
                const r = (14 + 4 * Math.abs(Math.sin(t * 2)));
                ctx.beginPath(); ctx.arc(W / 2, H / 2 - 2, r, 0, Math.PI * 2);
                ctx.strokeStyle = '#4ade8040'; ctx.lineWidth = 1.5; ctx.stroke();
            }
        };

        const loop = (ts) => {
            const t = ts * 0.001;
            drawStars(t);
            drawSparklines(t);
            frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);

        return () => { cancelAnimationFrame(frameId); }
    }, []);

    // Draw Chart Modal
    useEffect(() => {
        if (!chartModal.open || !modalChartRef.current) return;
        let cId;
        const color = chartModal.type === 'clusters' ? '#22d3ee' : chartModal.type === 'health' ? '#4ade80' : '#818cf8';

        const drawModal = () => {
            const canvas = modalChartRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const W = canvas.width = canvas.offsetWidth || 470;
            const H = canvas.height = canvas.offsetHeight || 160;
            ctx.clearRect(0, 0, W, H);

            const t = performance.now() * 0.001;
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const y = H * 0.1 + i * (H * 0.8 / 4);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            }

            if (chartModal.type === 'throughput') {
                // 1. THROUGHPUT: Digital Activity Matrix (Grid/Heatmap)
                const color = '#818cf8';

                const cols = 35; // Number of columns (time)
                const rows = 12; // Number of rows (channels/threads)
                const paddingX = 20;
                const paddingY = 15;

                const cellW = (W - paddingX * 2) / cols;
                const cellH = (H - paddingY * 2) / rows;
                const margin = 2; // Gap between cells

                for (let c = 0; c < cols; c++) {
                    for (let r = 0; r < rows; r++) {
                        // Math to calculate intensity of each cell based on time and position
                        const xOffset = c * 0.2;
                        const yOffset = r * 0.4;

                        // Create a flowing noise pattern
                        const noise1 = Math.sin(t * 3 - xOffset + Math.sin(yOffset));
                        const noise2 = Math.cos(t * 1.5 + xOffset * 0.5 + yOffset);

                        // Emphasize recent activity (right side of the grid)
                        const ageFactor = (c / cols);

                        // Combine to get an intensity value 0.0 to 1.0
                        let intensity = (noise1 * 0.5 + 0.5) * (noise2 * 0.5 + 0.5) * ageFactor;

                        // Add some random flickering sparks
                        if (Math.random() > 0.98) intensity = 1.0;
                        if (Math.random() > 0.95 && ageFactor > 0.8) intensity = 1.5;

                        if (intensity < 0.1) continue; // Skip very dark cells for cleaner look

                        const x = paddingX + c * cellW + margin / 2;
                        const y = paddingY + r * cellH + margin / 2;
                        const w = cellW - margin;
                        const h = cellH - margin;

                        // Draw inner cell
                        ctx.fillStyle = `rgba(129, 140, 248, ${Math.min(1, intensity)})`;

                        // Add glow if high intensity
                        if (intensity > 0.6) {
                            ctx.shadowColor = color;
                            ctx.shadowBlur = 8 * intensity;
                            ctx.fillStyle = '#fff'; // Bright white core for active cells
                        } else {
                            ctx.shadowBlur = 0;
                        }

                        ctx.beginPath();
                        ctx.roundRect(x, y, w, h, 2);
                        ctx.fill();
                        ctx.shadowBlur = 0; // reset
                    }
                }

                // Overlay a subtle scanning line moving left to right
                const scanLineX = paddingX + ((t * 0.4) % 1) * (W - paddingX * 2);
                const grad = ctx.createLinearGradient(scanLineX - 20, 0, scanLineX, 0);
                grad.addColorStop(0, 'rgba(129, 140, 248, 0)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');

                ctx.fillStyle = grad;
                ctx.fillRect(scanLineX - 20, paddingY, 20, H - paddingY * 2);

            } else if (chartModal.type === 'clusters') {
                // 2. CLUSTERS: Distribution Bar Histogram
                const totalNodes = (dataClusters || []).length || 1;
                const lensCategories = getLensCategories(currentLens);
                const items = lensCategories.map(cat => ({
                    cat: cat.id,
                    color: cat.color,
                    pct: (dataClusters || []).filter(n => n.latent_category === cat.id).length / totalNodes
                }));

                const gap = 30;
                const barW = (W - (gap * (items.length + 1))) / items.length;

                for (let i = 0; i < items.length; i++) {
                    const x = gap + i * (barW + gap);
                    // Add subtle floating noise to the stats so it feels alive
                    const noise = Math.sin(t * 2 + i) * 0.03;
                    const hRatio = Math.max(0.05, Math.min(0.9, items[i].pct + noise));
                    const barH = Math.max(H * 0.1, H * hRatio);
                    const y = H - barH;

                    const color = items[i].color;

                    ctx.shadowColor = color; ctx.shadowBlur = 12;
                    const grad = ctx.createLinearGradient(x, y, x, H);
                    grad.addColorStop(0, color); grad.addColorStop(1, color + '20');
                    ctx.fillStyle = grad;

                    ctx.beginPath();
                    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // Data labels on top
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px "Rajdhani"';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${Math.floor((items[i].pct + noise) * 100)}%`, x + barW / 2, y - 8);
                }

            } else if (chartModal.type === 'health') {
                // 3. HEALTH: Cybernetic System ECG & Gauge
                const color = '#4ade80';

                // Ring Gauge (Left side)
                const cx = W * 0.15;
                const cy = H / 2;
                const r = H * 0.35;

                // Health ring gauge — real score from liveStats
                const healthVal = metrics.healthScore;
                const healthRing = Math.max(0, Math.min(1, healthVal / 100));

                // Background Track
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 6; ctx.stroke();

                // Health arc
                ctx.beginPath();
                const endAngle = -Math.PI / 2 + (Math.PI * 2 * healthRing);
                ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
                const ringColor = healthVal >= 80 ? '#4ade80' : healthVal >= 50 ? '#f59e0b' : '#ef4444';
                ctx.strokeStyle = ringColor; ctx.lineWidth = 6;
                ctx.shadowColor = ringColor; ctx.shadowBlur = 12;
                ctx.stroke(); ctx.shadowBlur = 0;

                // Center Text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 22px "Rajdhani"';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(Math.round(healthVal).toString(), cx, cy - 2);
                ctx.font = '9px "Rajdhani"'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillText('HEALTH', cx, cy + 14);

                // ECG Signal (Right side)
                const ecgX = cx + r + 40;
                const ecgW = W - ecgX - 20;
                ctx.beginPath();

                // Simulating a heartbeat trace
                const loopTime = 1.5;
                const localT = (t % loopTime) / loopTime;

                for (let x = 0; x < ecgW; x += 2) {
                    const xt = x / ecgW;
                    let y = H / 2;

                    const distToBeat = Math.abs(xt - localT);
                    if (distToBeat < 0.08) {
                        // QRS Complex simulation
                        const pulse = Math.sin(distToBeat * Math.PI * 25);
                        const envelope = Math.max(0, 1 - distToBeat * 15);
                        y -= pulse * (H * 0.4) * envelope;
                    }

                    // Add subtle baseline wander 
                    y += Math.sin(x * 0.05 + t * 5) * 2;

                    if (x === 0) ctx.moveTo(ecgX + x, y);
                    else ctx.lineTo(ecgX + x, y);
                }

                ctx.strokeStyle = color; ctx.lineWidth = 2;
                ctx.shadowColor = color; ctx.shadowBlur = 8;
                ctx.stroke(); ctx.shadowBlur = 0;

                // Beam tracker at the current pulse point
                const currentBeatX = ecgX + (localT * ecgW);
                ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(currentBeatX, H / 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            }

            cId = requestAnimationFrame(drawModal);
        };
        cId = requestAnimationFrame(drawModal);
        return () => cancelAnimationFrame(cId);
    }, [chartModal.open, chartModal.type]);


    return (
        <div style={{
            ...s.app,
            ...(standalone ? { background: 'transparent', position: 'absolute', inset: 0, height: '100%', width: '100%', pointerEvents: 'none' } : {})
        }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600&display=swap');
                .latent-overlay-root * { font-family: 'Rajdhani', sans-serif; box-sizing: border-box; }
                .latent-overlay-root .ls-mono { font-family: 'Share Tech Mono', monospace; }
                @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
                .latent-overlay-root .anim-blink { animation: blink 2s infinite; }
            `}} />

            <div className="latent-overlay-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none' }}>

                {/* HEADER */}
                {!hudOnly && (
                    <header style={{ ...s.header, pointerEvents: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '0.25em', color: '#fff' }}>Latent<span style={{ color: s.c.indigo }}>Space</span></span>
                            <span style={{ fontSize: '9px', letterSpacing: '0.15em', padding: '2px 7px', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '3px', color: s.c.indigo, background: 'rgba(99,102,241,0.1)' }}>v4.1.2 ALPHA</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', letterSpacing: '0.1em' }}>
                            <span style={{ color: aiOn ? 'rgba(200,210,240,0.4)' : '#fff' }}>HEURISTIC</span>
                            <div onClick={() => setAiOn(!aiOn)} style={{ width: '36px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', transition: 'all 0.2s', flexShrink: 0 }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'all 0.2s', left: aiOn ? '18px' : '3px', background: aiOn ? s.c.indigo : 'rgba(255,255,255,0.3)', boxShadow: aiOn ? `0 0 8px ${s.c.indigo}` : 'none' }} />
                            </div>
                            <span style={{ color: aiOn ? '#fff' : 'rgba(200,210,240,0.4)' }}>AI-DRIVEN</span>
                        </div>

                        <div style={{ display: 'flex', gap: '28px' }}>
                            <div style={s.metric}><span style={s.metricLbl}>Nodes Mapped</span><span style={{ ...s.metricVal, color: s.c.indigo }}>{dataClusters?.length || 0} / 125</span></div>
                            <div style={s.metric}><span style={s.metricLbl}>Avg Health</span><span style={{ ...s.metricVal, color: metrics.avgVitality >= 80 ? s.c.green : '#f59e0b' }}>{metrics.avgVitality}%</span></div>
                            <div style={s.metric}><span style={s.metricLbl}>System Score</span><span style={{ ...s.metricVal, color: 'rgba(200,210,240,0.8)' }}>{Math.round(metrics.healthScore)}/100</span></div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.c.indigo} strokeWidth="1.5" strokeLinecap="round" style={{ cursor: 'pointer' }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#334,#667)', border: '1px solid rgba(148,163,184,0.25)' }} />

                            <button
                                onClick={onClose}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#f87171',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    marginLeft: '10px'
                                }}
                            >
                                CLOSE
                            </button>
                        </div>
                    </header>
                )}

                {/* MAIN CONTENT WORKSPACE */}
                <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', pointerEvents: 'none' }}>

                    {/* CENTER (BACKGROUNDS + WRAPPING REACT THREE FIBER CANVAS) */}
                    {!standalone && !hudOnly && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(15,20,40,0.95) 0%,#030508 100%)' }} />
                            <canvas ref={starCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                        </div>
                    )}

                    {/* The actual 3D canvas injected from the parent (e.g. LatentWorld.jsx holding <Canvas>) must sit here and pointer-events MUST be allowed! */}
                    {!standalone && !hudOnly && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'auto' }}>
                            {children}
                        </div>
                    )}

                    {/* LEFT SIDEBAR */}
                    <aside style={{ ...s.sidebar, pointerEvents: 'auto', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div style={s.panel}>
                            <div style={s.panelHead}><span style={s.panelTitle}>Intelligence Report</span><span style={s.closeBtn} onClick={() => togglePanel('intel')}>×</span></div>
                            {panels.intel && (
                                <div style={s.panelBody}>
                                    <div style={s.dataRow}><span style={s.dataKey}>STATUS:</span><span style={{ ...s.dataVal, color: s.c.green, fontWeight: 700 }}>OPERATIONAL</span></div>
                                    <div style={s.dataRow}><span style={s.dataKey}>CLUSTERS MAPPED:</span><span style={{ ...s.dataVal, color: s.c.cyan }}>{new Set(dataClusters?.map(c => c.latent_category)).size || 5}</span></div>
                                    <div style={s.dataRow}><span style={s.dataKey}>TOTAL RECORDS:</span><span style={s.dataVal}>{metrics.snap}</span></div>
                                    <div style={s.dataRow}><span style={s.dataKey}>ACTIVE THREADS:</span><span style={s.dataVal}>{metrics.threads}</span></div>
                                    <div style={{ ...s.dataRow, borderBottom: 'none' }}><span style={s.dataKey}>LATENCY:</span><span style={{ ...s.dataVal, color: parseFloat(metrics.lat) > 4.5 ? '#f59e0b' : s.c.cyan }}>{metrics.lat}ms</span></div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '12px', height: '46px' }}>
                                        <div style={s.miniChart} onClick={() => setChartModal({ open: true, type: 'throughput', tab: '1m' })}><canvas ref={chartRefs[0]} style={{ width: '100%', height: '100%' }} /></div>
                                        <div style={s.miniChart} onClick={() => setChartModal({ open: true, type: 'clusters', tab: '1m' })}><canvas ref={chartRefs[1]} style={{ width: '100%', height: '100%' }} /></div>
                                        <div style={s.miniChart} onClick={() => setChartModal({ open: true, type: 'health', tab: '1m' })}><canvas ref={chartRefs[2]} style={{ width: '100%', height: '100%' }} /></div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '8px', color: 'rgba(129,140,248,0.4)', letterSpacing: '0.08em' }}>
                                        <span style={{ cursor: 'pointer' }} onClick={() => setChartModal({ open: true, type: 'throughput', tab: '1m' })}>THROUGHPUT</span>
                                        <span style={{ cursor: 'pointer' }} onClick={() => setChartModal({ open: true, type: 'clusters', tab: '1m' })}>CLUSTERS</span>
                                        <span style={{ cursor: 'pointer' }} onClick={() => setChartModal({ open: true, type: 'health', tab: '1m' })}>HEALTH</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RELATIONSHIP HUD PANEL - ALWAYS VISIBLE */}
                        <div style={{ ...s.panel, marginTop: '10px' }}>
                            <div style={s.panelHead}>
                                <span style={s.panelTitle}>Relationship HUD</span>
                                <span style={s.closeBtn} onClick={handleToggleRelHud}>×</span>
                            </div>
                            {panels.relHud && (
                                <div style={s.panelBody}>
                                    {stickyEdge ? (
                                        <EdgeStatsPanel
                                            edge={stickyEdge}
                                            visible={true}
                                            variant="sidebar"
                                        />
                                    ) : (
                                        <div style={{ fontSize: '9px', color: 'rgba(167,186,220,0.35)', letterSpacing: '0.08em', textAlign: 'center', padding: '6px 0', lineHeight: 1.6 }}>
                                            HOVER A RELATIONSHIP<br />LINE TO SEE DETAILS
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1 }} />
                    </aside>

                    <div style={{ flex: 1, position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '14px', left: '20px', zIndex: 20, pointerEvents: 'none' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.9)', margin: 0 }}>INTELLIGENCE LAYER SEMANTIC MAP</h2>
                            <p style={{ fontSize: '9px', letterSpacing: '0.25em', color: 'rgba(129,140,248,0.55)', marginTop: '2px', margin: 0 }}>3D LATENT SPACE GRAPH • {dataClusters?.length || 0} NODES DETECTED</p>
                        </div>

                        <div style={{ position: 'absolute', top: '14px', right: '20px', zIndex: 20, textAlign: 'right', pointerEvents: 'none' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(0,245,255,0.65)' }} className="ls-mono">LATENT VECTOR RATE<br /><span style={{ color: s.c.cyan, fontWeight: 700 }}>[{selectedNode ? (selectedNode.x / 1000).toFixed(3) : '0.222'}, <b>{selectedNode ? (selectedNode.y / 1000).toFixed(3) : '0.004'}</b>, {selectedNode ? (selectedNode.z / 1000).toFixed(3) : '0.331'}]</span></div>
                        </div>


                    </div>

                    {/* RIGHT SIDEBAR */}
                    <aside style={{ ...s.sidebar, pointerEvents: 'auto' }}>
                        <div style={s.panel}>
                            <div style={s.panelHead}><span style={s.panelTitle}>Class Filter</span><span style={s.closeBtn} onClick={() => togglePanel('filter')}>×</span></div>
                            {panels.filter && (
                                <div style={s.panelBody}>
                                    {lensCategories.map(cat => {
                                        const f = { label: cat.id, c: cat.color };
                                        const count = (dataClusters || []).filter(n => n.latent_category === f.label).length;

                                        const isActive = activeFilters[f.label] !== false;

                                        return (
                                            <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isActive ? f.c : 'rgba(100,100,100,0.5)', boxShadow: isActive ? `0 0 5px ${f.c}` : 'none' }} />
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.4)' }}>{f.label}</span>
                                                        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '-2px' }}>{count} NODES</span>
                                                    </div>
                                                </div>
                                                <div
                                                    onClick={() => onFilterChange?.(f.label, !isActive)}
                                                    style={{ width: '36px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer', background: isActive ? f.c + '25' : 'rgba(255,255,255,0.05)', border: `1px solid ${isActive ? f.c + '55' : 'rgba(255,255,255,0.1)'}` }}
                                                >
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'all 0.2s', left: isActive ? '18px' : '3px', background: isActive ? f.c : 'rgba(255,255,255,0.3)', boxShadow: isActive ? `0 0 7px ${f.c}` : 'none' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ ...s.panel, ...(panels.hud ? { flex: 1 } : {}) }}>
                            <div style={s.panelHead}><span style={s.panelTitle}>Micro-Panel HUD</span><span style={s.closeBtn} onClick={() => togglePanel('hud')}>×</span></div>
                            {panels.hud && (
                                <div style={s.panelBody}>
                                    <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: s.c.indigo, fontWeight: 700, marginBottom: '8px' }}>
                                        {selectedNode ? `NODE: ${selectedNode.name || selectedNode.id}` : 'SELECTED VOXEL'}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', rowGap: '5px', columnGap: '8px', fontSize: '9px' }} className="ls-mono">
                                        <span style={{ color: 'rgba(167,186,220,0.4)' }}>ONTOLOGY CLASS:</span><span style={{ color: 'rgba(200,215,240,0.9)', fontWeight: 700 }}>{selectedNode ? (selectedNode.entity || selectedNode.table_type || 'Unclassified') : 'REFERENCES'}</span>
                                        <span style={{ color: 'rgba(167,186,220,0.4)' }}>NEURAL GRAVITY:</span><span style={{ color: s.c.cyan }}>{selectedNode ? (selectedNode.neural_gravity || selectedNode.importance_score || 1.0).toFixed(2) + 'G' : '0.88G'}</span>
                                        <span style={{ color: 'rgba(167,186,220,0.4)' }}>ID:</span><span style={{ color: 'rgba(200,215,240,0.9)' }}>{selectedNode ? selectedNode.id : 'REF-68294-A'}</span>
                                        <span style={{ color: 'rgba(167,186,220,0.4)' }}>{selectedNode ? 'RECORDS' : 'TX ID'}:</span><span style={{ color: 'rgba(200,215,240,0.9)' }}>{selectedNode ? (selectedNode.row_count || 0).toLocaleString() : 'TAN-8045'}</span>
                                    </div>
                                    <div style={{ marginTop: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }} className="ls-mono">
                                            <span style={{ color: 'rgba(167,186,220,0.4)' }}>VITALITY SCORE:</span><span style={{ color: selectedNode ? (selectedNode.vitality < 40 ? '#ef4444' : (selectedNode.vitality < 70 ? '#fbbf24' : '#4ade80')) : '#4ade80' }}>{selectedNode ? Math.round(selectedNode.vitality || 100) : 88}%</span>
                                        </div>
                                        <div style={{ height: '3px', background: 'rgba(30,41,59,0.8)', borderRadius: '2px', overflow: 'hidden', marginTop: '5px' }}>
                                            <div style={{
                                                height: '100%',
                                                borderRadius: '2px',
                                                width: `${selectedNode ? Math.max(0, Math.min(100, selectedNode.vitality || 100)) : 88}%`,
                                                background: selectedNode ? (selectedNode.vitality < 40 ? '#ef4444' : (selectedNode.vitality < 70 ? '#fbbf24' : '#22c55e')) : '#22c55e'
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '9px', color: 'rgba(167,186,220,0.4)', marginTop: '10px' }} className="ls-mono">
                                            CONTRIBUTING COLUMNS:
                                            <div style={{ color: 'rgba(200,215,240,0.85)', marginTop: '4px' }}>{selectedNode ? (selectedNode.columns?.slice(0, 3).map(c => c.name).join(', ') || 'N/A') : 'UserID, Session, Region'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '0.08em' }}><div style={{ width: '14px', height: '2px', borderRadius: '1px', flexShrink: 0, background: s.c.cyan, boxShadow: `0 0 4px ${s.c.cyan}` }} /><span style={{ color: 'rgba(167,186,220,0.7)' }}>X: BUSINESS VALUE</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '0.08em' }}><div style={{ width: '14px', height: '2px', borderRadius: '1px', flexShrink: 0, background: s.c.gold, boxShadow: `0 0 4px ${s.c.gold}` }} /><span style={{ color: 'rgba(167,186,220,0.7)' }}>Y: HEALTH RISK</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '0.08em' }}><div style={{ width: '14px', height: '2px', borderRadius: '1px', flexShrink: 0, background: s.c.purple, boxShadow: `0 0 4px ${s.c.purple}` }} /><span style={{ color: 'rgba(167,186,220,0.7)' }}>Z: STABILITY</span></div>
                        </div>
                    </aside>
                </main>

                {/* FOOTER */}
                <footer style={{
                    ...s.footer,
                    pointerEvents: 'auto',
                    ...(hudOnly ? { background: 'transparent', borderTop: 'none', position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 50 } : {})
                }}>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={s.footBtn} onClick={onZoomIn} title="Zoom In"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></div>
                        <div style={s.footBtn} onClick={onZoomOut} title="Zoom Out"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg></div>
                        <div style={s.footBtn} onClick={onZoomReset} title="Reset View"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg></div>
                    </div>
                </footer>
            </div>

            {/* CHART MODAL OVERLAY */}
            {chartModal.open && (
                <div style={{ position: 'absolute', inset: 0, paddingBottom: '80px', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', pointerEvents: 'auto' }} onClick={(e) => { if (e.target === e.currentTarget) setChartModal({ ...chartModal, open: false }) }}>
                    <div style={{ background: 'rgba(8,14,35,0.97)', border: '1px solid rgba(129,140,248,0.35)', borderRadius: '10px', width: '520px', maxWidth: '90vw', padding: '20px 24px', boxShadow: '0 0 60px rgba(99,102,241,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', color: '#fff', margin: '0 0 4px 0', fontFamily: 'Rajdhani, sans-serif' }}>
                                    {chartModal.type === 'throughput' ? 'THROUGHPUT ANALYSIS' : chartModal.type === 'clusters' ? 'CLUSTER DISTRIBUTION' : 'SYSTEM HEALTH INDEX'}
                                </h3>
                                <p style={{ fontSize: '9px', color: 'rgba(129,140,248,0.6)', letterSpacing: '0.1em', margin: 0, fontFamily: 'Rajdhani, sans-serif' }}>Real-time dynamic visualization</p>
                            </div>
                            <button onClick={() => setChartModal({ ...chartModal, open: false })} style={{ background: 'none', border: 'none', color: 'rgba(167,186,220,0.4)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                            {['1m', '5m', '1h', '1d'].map(tb => (
                                <div key={tb} onClick={() => setChartModal({ ...chartModal, tab: tb })} style={{ fontFamily: 'Rajdhani, sans-serif', padding: '4px 12px', borderRadius: '4px', border: `1px solid ${chartModal.tab === tb ? s.c.indigo : 'rgba(129,140,248,0.25)'}`, fontSize: '9px', letterSpacing: '0.12em', cursor: 'pointer', color: chartModal.tab === tb ? '#fff' : 'rgba(167,186,220,0.6)', background: chartModal.tab === tb ? 'rgba(129,140,248,0.18)' : 'transparent' }}>
                                    {tb.toUpperCase()}
                                </div>
                            ))}
                        </div>
                        <div style={{ height: '160px', position: 'relative' }}>
                            <canvas ref={modalChartRef} style={{ width: '100%', height: '100%' }} />
                        </div>
                        {/* 4-stat summary grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginTop: '14px' }}>
                            {chartModal.type === 'throughput' ? (
                                <>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{liveStats?.tps || 1246}</div><div style={s.chartStatLbl}>AVG TPS</div></div>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{Math.floor((liveStats?.tps || 1246) * 1.5)}</div><div style={s.chartStatLbl}>PEAK TPS</div></div>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{Math.floor((liveStats?.tps || 1246) * 0.5)}</div><div style={s.chartStatLbl}>MIN TPS</div></div>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{liveStats?.health?.score || 99.8}%</div><div style={s.chartStatLbl}>UPTIME</div></div>
                                </>
                            ) : chartModal.type === 'clusters' ? (
                                <>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{new Set(dataClusters?.map(c => c.latent_category)).size || 5}</div><div style={s.chartStatLbl}>CLUSTERS</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{dataClusters?.filter(n => n.latent_category?.toLowerCase().includes('fact')).length || 0}</div><div style={s.chartStatLbl}>FACT DATA</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{dataClusters?.filter(n => n.latent_category?.toLowerCase().includes('dimension')).length || 0}</div><div style={s.chartStatLbl}>DIMENSION</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{dataClusters?.filter(n => n.latent_category?.toLowerCase().includes('transaction') || n?.row_count > 50000).length || 0}</div><div style={s.chartStatLbl}>HIGH TX</div></div>
                                </>
                            ) : (
                                <>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{liveStats?.health?.score || 98.4}%</div><div style={s.chartStatLbl}>HEALTH</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{metrics.lat}ms</div><div style={s.chartStatLbl}>LATENCY</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{metrics.threads}</div><div style={s.chartStatLbl}>THREADS</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{liveStats?.failedTx || 0}</div><div style={s.chartStatLbl}>ERRORS</div></div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// =========================================================================
// MAIN LATENT WORLD COMPONENT (CONSOLIDATED)
// =========================================================================

export const LatentWorld = ({ targetNode, onClose, schemaData, connectionId }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(new THREE.Scene());
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const composerRef = useRef(null);
    const bloomPassRef = useRef(null);
    const controlsRef = useRef(null);
    const transformRef = useRef(null);
    const satellitesGroupRef = useRef(new THREE.Group());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dataClusters, setDataClusters] = useState([]);
    const [selectedSatellite, setSelectedSatellite] = useState(null);
    const [intelligence, setIntelligence] = useState(null);
    const [overrides, setOverrides] = useState({});
    const [hoveredId, setHoveredId] = useState(null);
    const [webglError, setWebglError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const [settings, setSettings] = useState({
        bgColor: '#010101',
        glow: 3.5,
        speed: 0,
        autoRotate: false,
        levitation: true,
        sizeBy: 'ROWS',
        editMode: false,
        showTimeTravel: true
    });

    const [hoveredVoxel, setHoveredVoxel] = useState(null);
    const [selectedVoxel, setSelectedVoxel] = useState(null);
    const [selectionMode, setSelectionMode] = useState('cluster');
    const [latentNodes, setLatentNodes] = useState([]);

    const geoms = useMemo(() => ({
        sphere: new THREE.SphereGeometry(1, 32, 32),
        box: new THREE.BoxGeometry(1.6, 1.6, 1.6),
        bar: new THREE.BoxGeometry(2, 4, 2),
        octa: new THREE.OctahedronGeometry(1.6),
        tetra: new THREE.TetrahedronGeometry(1.6),
        pillar: new THREE.CylinderGeometry(5, 5, 140, 6),
        pedestal: new THREE.TorusGeometry(3.5, 0.12, 16, 64)
    }), []);

    useEffect(() => {
        if (!connectionId) return;

        if (targetNode) {
            // DRILL-DOWN MODE: Fetch clusters for this node's columns
            setLoading(true);
            const fetchClusters = async () => {
                try {
                    const response = await fetch(`/api/internal-node/clusters/${connectionId}/${targetNode.name}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    const data = await response.json();
                    if (data.status === 'success' && data.clusters && data.clusters.length > 0) {
                        setDataClusters(data.clusters);
                        // Map clusters to "latent nodes" for mountain logic if we want to use same engine
                        const mockNodes = data.clusters.map(c => ({
                            id: c.name,
                            name: c.name,
                            row_count: c.count * 1000, // Scale for majesty
                            vitality: 100,
                            latent_category: c.name === 'Identity' ? 'Fact' : c.name === 'Temporal' ? 'Anomaly' : 'Dimension'
                        }));
                        setLatentNodes(mockNodes);
                    } else {
                        setDataClusters([]);
                    }
                } catch (err) {
                    console.error('❌ Failed to fetch clusters:', err);
                    setError(`Unable to load cluster data: ${err.message}`);
                    setDataClusters([]);
                } finally {
                    setLoading(false);
                }
            };
            fetchClusters();
        } else if (schemaData && schemaData.nodes) {
            // GLOBAL MODE: Use schemaData directly
            setLoading(false);
            setLatentNodes(schemaData.nodes);
        } else {
            setLoading(false);
        }
    }, [targetNode, connectionId, schemaData]);

    useEffect(() => {
        if (!selectedSatellite || !connectionId || !targetNode) {
            setIntelligence(null);
            return;
        }
        const isCluster = selectedSatellite.type === 'cluster' ||
            ['Identity', 'Temporal', 'Numeric', 'Text', 'Reference', 'Boolean', 'Analysis Failed'].includes(selectedSatellite.name);
        if (isCluster) {
            setIntelligence(null);
            return;
        }
        const fetchIntel = async () => {
            try {
                const resp = await fetch(`/api/drilldown/${connectionId}/column-intelligence/${targetNode.name}/${selectedSatellite.name}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                const data = await resp.json();
                setIntelligence(data.intelligence);
            } catch (err) {
                console.error("Failed to fetch column intelligence:", err);
                setIntelligence({ error: true, message: err.message, impact: [], complexity_score: 0 });
            }
        };
        fetchIntel();
    }, [selectedSatellite, connectionId, targetNode]);

    useEffect(() => {
        if (!mountRef.current || loading) return;
        let frame;
        let renderer;

        try {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const camera = new THREE.PerspectiveCamera(50, width / height, 1, 300000);
            camera.position.set(40000, 20000, 40000);
            cameraRef.current = camera;

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            mountRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            const orbit = new OrbitControls(camera, renderer.domElement);
            orbit.enableDamping = true;
            controlsRef.current = orbit;

            const transform = new TransformControls(camera, renderer.domElement);
            transform.addEventListener('dragging-changed', (e) => orbit.enabled = !e.value);
            transformRef.current = transform;
            sceneRef.current.add(transform);

            sceneRef.current.add(satellitesGroupRef.current);
            sceneRef.current.add(new THREE.AmbientLight(0xffffff, 0.4));
            const sky = new THREE.PointLight(0x00f2ff, 1000, 300); sky.position.set(0, 150, 0);
            sceneRef.current.add(sky);

            const grid = create3DAxes('latent');
            sceneRef.current.add(grid);

            const onResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', onResize);
            setWebglError(null);
        } catch (err) {
            console.error("LATENT_WORLD_ENGINE_FAILURE:", err);
            setWebglError("WEBGL_BLOCKED: Browser context allocation failed.");
        }

        return () => {
            if (frame) cancelAnimationFrame(frame);
            if (renderer) {
                renderer.dispose();
                if (renderer.domElement && mountRef.current) {
                    try { mountRef.current.removeChild(renderer.domElement); } catch (e) { }
                }
            }
            sceneRef.current.clear();
        };
    }, [loading, retryCount]);

    useEffect(() => {
        if (!latentNodes.length || !sceneRef.current) return;
        const group = satellitesGroupRef.current;
        group.clear();

        // 1. Process Layout with Organic Gravity
        const arrangedNodes = applyLatentSpaceLayout([...latentNodes]);

        // 2. Add Majestic Mountains (Terrain)
        const oldManifold = sceneRef.current.children.find(c => c.userData?.isManifold);
        if (oldManifold) sceneRef.current.remove(oldManifold);

        const manifold = createLatentManifold(arrangedNodes);
        if (manifold) {
            sceneRef.current.add(manifold);
        }

        // 3. Add Nodes as Glowing Spheres/Symbols mapped to terrain
        arrangedNodes.forEach(node => {
            if (!node.visible) return;

            const color = node.latent_color || '#22d3ee';
            const size = Math.min(60, 20 + (Math.log10(Math.max(node.row_count || 1, 1)) * 5));
            const geometry = node.vitality < 60 ? geoms.octa : geoms.sphere;
            const material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 1.5,
                transparent: true,
                opacity: 0.9,
                metalness: 0.8,
                roughness: 0.1
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(size, size, size);
            mesh.position.set(node.x, node.y, node.z);
            mesh.userData = { ...node, type: 'node' };
            group.add(mesh);
        });

        // Add Bridge Edges (Sparse)
        if (targetNode === null && schemaData?.edges) {
            schemaData.edges.slice(0, 50).forEach(edge => {
                const sNode = arrangedNodes.find(n => n.id === edge.source);
                const tNode = arrangedNodes.find(n => n.id === edge.target);
                if (sNode && tNode) {
                    const bridge = createLatentBridgeEdge(sNode, tNode, edge, edge.source, edge.target, true);
                    group.add(bridge);
                }
            });
        }

    }, [latentNodes, geoms, schemaData]);

    useEffect(() => {
        let frame;
        const animate = () => {
            frame = requestAnimationFrame(animate);
            if (satellitesGroupRef.current) {
                satellitesGroupRef.current.children.forEach((obj) => {
                    if (obj.userData.type === 'voxel') {
                        if (hoveredVoxel === obj) {
                            obj.material.emissiveIntensity = 2.5;
                            obj.position.y = obj.userData.baseY + 3;
                        } else {
                            obj.material.emissiveIntensity = 1.2;
                            obj.position.y += (obj.userData.baseY - obj.position.y) * 0.1;
                        }
                    }
                });
            }
            if (controlsRef.current) controlsRef.current.update();
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };
        animate();
        return () => cancelAnimationFrame(frame);
    }, [hoveredVoxel]);

    useEffect(() => {
        if (!rendererRef.current) return;
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const onMM = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(satellitesGroupRef.current.children, true);
            setHoveredVoxel(hits.length > 0 && hits[0].object.userData.type === 'voxel' ? hits[0].object : null);
        };

        const onCK = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(satellitesGroupRef.current.children, true);
            if (hits.length > 0) {
                const hitObj = hits[0].object;
                if (hitObj.userData.type === 'voxel') {
                    setSelectedVoxel(hitObj.userData);
                    setSelectionMode('voxel');
                    setSelectedSatellite(hitObj.userData.clusterData);
                } else if (hitObj.userData.type === 'cluster') {
                    setSelectedSatellite(hitObj.userData.data);
                    setSelectionMode('cluster');
                }
            } else {
                setSelectedSatellite(null);
                setSelectedVoxel(null);
                setSelectionMode('cluster');
            }
        };

        renderer.domElement.addEventListener('mousemove', onMM);
        renderer.domElement.addEventListener('click', onCK);
        return () => {
            renderer.domElement.removeEventListener('mousemove', onMM);
            renderer.domElement.removeEventListener('click', onCK);
        };
    }, [loading]);

    if (loading) return null;

    return (
        <LatentSpaceUIOverlay
            dataClusters={dataClusters}
            selectedNodeId={selectedSatellite?.name || selectedSatellite?.id}
            timeValue={100}
            onTimeChange={(v) => console.log('Time distortion:', v)}
            onZoomIn={() => cameraRef.current?.position.multiplyScalar(0.8)}
            onZoomOut={() => cameraRef.current?.position.multiplyScalar(1.2)}
            onZoomReset={() => {
                cameraRef.current?.position.set(40000, 20000, 40000);
                cameraRef.current?.lookAt(0, 0, 0);
            }}
            onClose={onClose}
        >
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            {webglError && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', textAlign: 'center' }}>
                    <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: 'bold' }}>SYSTEM ERROR: ENGINE OVERLOAD</div>
                    <button onClick={() => setRetryCount(prev => prev + 1)} style={{ padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>REBOOT ENGINE</button>
                </div>
            )}
        </LatentSpaceUIOverlay>
    );
};


// CSS-IN-JS Styles 
const s = {
    c: { cyan: '#00f5ff', orange: '#ff6b00', purple: '#bc13fe', green: '#00ff88', pink: '#ff2d78', gold: '#ffd700', indigo: '#818cf8', bg: '#030508' },
    app: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#030508', color: 'rgba(200,210,240,0.9)', overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '50px', background: 'rgba(5,8,20,0.95)', borderBottom: '1px solid rgba(99,102,241,0.15)', flexShrink: 0, zIndex: 50 },
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '38px', background: 'rgba(5,8,20,0.95)', borderTop: '1px solid rgba(99,102,241,0.12)', flexShrink: 0, zIndex: 50 },
    sidebar: { width: '272px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', overflowY: 'auto', zIndex: 20 },
    panel: { background: 'rgba(10,15,30,0.75)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' },
    panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    panelTitle: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#fff', textTransform: 'uppercase' },
    panelBody: { padding: '12px 14px' },
    closeBtn: { cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '16px', lineHeight: 1 },
    metric: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    metricLbl: { fontSize: '8px', color: 'rgba(200,210,240,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' },
    metricVal: { fontSize: '12px', fontWeight: 600, fontFamily: '"Share Tech Mono", monospace' },
    dataRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '10px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    dataKey: { color: 'rgba(167,186,220,0.45)', letterSpacing: '0.05em' },
    dataVal: { color: 'rgba(200,215,240,0.9)', fontFamily: '"Share Tech Mono", monospace' },
    miniChart: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', overflow: 'hidden', position: 'relative', cursor: 'pointer' },
    footBtn: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: '4px', cursor: 'pointer' },
    chartStat: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '5px', padding: '8px 10px', textAlign: 'center' },
    chartStatVal: { fontSize: '16px', fontWeight: 700, fontFamily: '"Share Tech Mono", monospace', color: '#818cf8' },
    chartStatLbl: { fontSize: '8px', color: 'rgba(167,186,220,0.4)', letterSpacing: '0.1em', marginTop: '2px', fontFamily: '"Rajdhani", sans-serif' }
};

