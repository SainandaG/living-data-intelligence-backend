/**
 * LatentSpace/computations.js
 * Pure computation functions — no React, no JSX.
 * Extracted from LatentSpaceLogic.jsx lines 24-643.
 *
 * Exports:
 *   enrichNodesWithDependency, LENS_CATEGORIES, getLensCategories,
 *   computeCentroids, getManifoldHeight, createLatentManifold,
 *   applyLatentSpaceLayout, propagateImpact,
 *   create3DAxes, createFlowArrows, createLatentBridgeEdge
 */
import * as THREE from 'three';
import { SeededRNG } from '../../../utils/mathUtils';
import { getLatentRegistry } from '../LatentSpaceLogic_Core.js';
import { logger } from '../../../utils/logger';

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
        { id: 'Anomalous Peaks',   color: '#ef4444' }, // Red
        { id: 'Dependent Facts',   color: '#3b82f6' }, // Blue
        { id: 'Healthy Tables',    color: '#22c55e' }, // Green
        { id: 'Independent Facts', color: '#f59e0b' }, // Amber/Orange
    ],
    tier3: [
        { id: 'Anomalous Peaks',   color: '#ef4444' },
        { id: 'Dependent Facts',   color: '#3b82f6' },
        { id: 'Healthy Tables',    color: '#22c55e' },
        { id: 'Independent Facts', color: '#f59e0b' },
    ],
    security: [
        { id: 'Critical Threats',  color: '#ef4444' },
        { id: 'Vulnerable Assets', color: '#f97316' },
        { id: 'Guarded Nodes',     color: '#3b82f6' },
        { id: 'Secure Data',       color: '#22c55e' },
    ],
    energy: [
        { id: 'Critical Failures',  color: '#ef4444' },
        { id: 'Warning Sensors',    color: '#f97316' },
        { id: 'Grid Infrastructure',color: '#3b82f6' },
        { id: 'Energy Consumers',   color: '#22c55e' },
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

        // Guaranteed minimum peak of 5000 units so every cluster forms a visible hill
        const minPeak = 5000;
        let height = Math.max(
            (volumeFactor + frequencyFactor) * w,
            minPeak * w,
            (c.semanticHeight * 0.8) * w
        );

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
    const res   = 150;
    const width = 100000;
    const depth = 60000;

    // ── Helper: compute vertex color given world X/Z ────────────────────────
    function vertexColor(worldX, worldZ) {
        let maxInfluence = 0;
        let dominant = new THREE.Color(0.01, 0.015, 0.05);
        centroids.forEach(c => {
            const d2     = Math.pow(worldX - c.x, 2) + Math.pow(worldZ - c.z, 2);
            const sigma  = 7000.0 + ((c.count || 5) * 25);
            const infl   = Math.exp(-d2 / (2 * sigma * sigma));
            if (infl > maxInfluence) {
                maxInfluence = infl;
                if (infl > 0.04) dominant.set(c.color);
            }
        });
        if (maxInfluence > 0.04) {
            const t = Math.min(1, (maxInfluence - 0.04) / 0.45);
            return new THREE.Color(0.01, 0.015, 0.05).lerp(dominant, t);
        }
        return new THREE.Color(0.01, 0.015, 0.05);
    }

    // ── 1. Main terrain surface ─────────────────────────────────────────────
    const geometry = new THREE.PlaneGeometry(width, depth, res, res);
    const vertices = geometry.attributes.position.array;
    const colors   = new Float32Array(vertices.length);

    for (let i = 0; i < vertices.length; i += 3) {
        const worldX = vertices[i];
        const worldZ = -vertices[i + 1];
        vertices[i + 2] = getManifoldHeight(worldX, worldZ, centroids);
        const col = vertexColor(worldX, worldZ);
        colors[i] = col.r; colors[i + 1] = col.g; colors[i + 2] = col.b;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Semi-transparent surface — no clearcoat/metalness to prevent camera-movement reflections
    const surface = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        depthWrite: false,
    }));

    // Visible contour/wireframe lines (topographic map look)
    const contour = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.28,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }));

    group.add(surface);
    group.add(contour);

    // ── 2. Shadow projection floor ──────────────────────────────────────────
    // Flat plane below the terrain showing cluster footprints as colored blobs
    const floorGeo    = new THREE.PlaneGeometry(width, depth, res, res);
    const floorVerts  = floorGeo.attributes.position.array;
    const floorColors = new Float32Array(floorVerts.length);

    for (let i = 0; i < floorVerts.length; i += 3) {
        const worldX = floorVerts[i];
        const worldZ = -floorVerts[i + 1];
        // Floor stays flat (no height displacement)
        floorVerts[i + 2] = 0;
        const col = vertexColor(worldX, worldZ);
        floorColors[i] = col.r; floorColors[i + 1] = col.g; floorColors[i + 2] = col.b;
    }
    floorGeo.attributes.position.needsUpdate = true;
    floorGeo.setAttribute('color', new THREE.BufferAttribute(floorColors, 3));

    const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }));
    // Place floor well below terrain base so it's the "shadow" projection
    floorMesh.position.y = -8000;
    group.add(floorMesh);

    group.rotation.x = -Math.PI / 2;
    group.position.y  = -800;
    group.userData    = { isManifold: true };
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

    logger.debug(`[LatentLogic] Applying layout to ${nodes.length} nodes for Lens: ${currentLens}`);

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

    const size  = 100000;
    const depth = 60000;

    // ── Grid walls ──────────────────────────────────────────────────────────
    const wall1 = new THREE.GridHelper(size, 40, 0x334155, 0x1e293b);
    wall1.rotation.x = Math.PI / 2;
    wall1.position.z = -depth / 2.5;
    wall1.position.y = -500;
    wall1.material.opacity     = 0.30;
    wall1.material.transparent = true;
    group.add(wall1);

    const wall2 = new THREE.GridHelper(depth, 40, 0x334155, 0x1e293b);
    wall2.rotation.z = Math.PI / 2;
    wall2.position.x = -size / 2.5;
    wall2.position.y = -500;
    wall2.material.opacity     = 0.30;
    wall2.material.transparent = true;
    group.add(wall2);

    // ── Canvas sprite helper ────────────────────────────────────────────────
    function makeLabel(text, color = '#94a3b8') {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 128);
        ctx.font = 'bold 68px Inter, Arial, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign  = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(9000, 2250, 1);
        return sprite;
    }

    // "Risk" — left Y wall, elevated
    const riskLabel = makeLabel('Risk', '#f87171');
    riskLabel.position.set(-size / 2.5 - 4000, 10000, 0);
    group.add(riskLabel);

    // "Health" — back Z wall, elevated
    const healthLabel = makeLabel('Health', '#4ade80');
    healthLabel.position.set(0, 10000, -depth / 2.5 - 4000);
    group.add(healthLabel);

    // "Value" — floor level, along X axis
    const valueLabel = makeLabel('Value', '#94a3b8');
    valueLabel.position.set(0, -1500, depth / 2 + 5000);
    group.add(valueLabel);

    return group;
}

/**
 * Create Flow Arrows for Latent Space
 */
export function createFlowArrows(_manifoldData) {
    const group = new THREE.Group();

    // Default spacing matches computeCentroids with ~20 nodes
    const spacing = 15000;
    // 4 cluster peak positions along X (same order as computeCentroids categories)
    // Green → Blue → Amber → Red  (healthy → dependent → independent → anomalous)
    const peaks = [
        new THREE.Vector3(-1.5 * spacing, 4000, 0),
        new THREE.Vector3(-0.5 * spacing, 4000, 0),
        new THREE.Vector3( 0.5 * spacing, 4000, 0),
        new THREE.Vector3( 1.5 * spacing, 4000, 0),
    ];

    for (let i = 0; i < peaks.length - 1; i++) {
        const from = peaks[i];
        const to   = peaks[i + 1];
        const dir  = new THREE.Vector3().subVectors(to, from).normalize();
        const len  = from.distanceTo(to) * 0.52; // arrow covers ~52% of gap

        const arrow = new THREE.ArrowHelper(
            dir,
            from,
            len,
            0xffffff,        // white shaft + head
            len * 0.18,      // head length
            len * 0.10,      // head width
        );

        // Semi-transparent white
        arrow.line.material.transparent = true;
        arrow.line.material.opacity = 0.70;
        arrow.cone.material.transparent = true;
        arrow.cone.material.opacity = 0.75;

        group.add(arrow);
    }

    return group;
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

    // [FIX] Safety check to prevent black edges (invisible on black bg)
    if (new THREE.Color(finalColor).getHex() === 0x000000) {
        finalColor = 0x00d4ff; // Default to cyan
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
// DATA LENS PANEL (CATEGORICAL FILTERING)
// =========================================================================

// DataLensPanel removed and extracted to standalone component.

// =========================================================================
// REACT UI OVERLAY FOR LATENT SPACE
// =========================================================================

