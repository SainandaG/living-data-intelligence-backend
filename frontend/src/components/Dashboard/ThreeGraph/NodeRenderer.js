/**
 * NodeRenderer.js
 * Responsibility: Everything that creates a node's 3D appearance.
 * Extracted from ThreeGraph.jsx lines 171-544.
 *
 * Exports:
 *   applyGalaxyLayout(nodes, radius)
 *   createNodeMesh(nodeData, currentLens, layoutMode, clusteringMethod, animatedObjectsList)
 *   createTextSprite(message, fontsize, color)
 */
import * as THREE from 'three';
import { logger } from '../../../utils/logger';

import { SeededRNG } from '../../../utils/mathUtils';

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

        // 2. Clear Force Locks for non-core nodes (Essential for mode switching)
        node.fx = null;
        node.fy = null;
        node.fz = null;

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

            // Initial positions - ONLY if not already set by data source (e.g. AnalyticsView)
            if (isNaN(node.x) || node.x === undefined) node.x = node.targetX;
            if (isNaN(node.y) || node.y === undefined) node.y = node.targetY;
            if (isNaN(node.z) || node.z === undefined) node.z = node.targetZ;
        }
    });

    return nodes;
}
// ─── Color Palette for visual distinctness (matching SpinExpand) ───
const TABLE_COLORS = [
    0x2563eb, // Blue
    0x16a34a, // Green
    0xd97706, // Orange
    0x9333ea, // Purple
    0xdc2626, // Red
    0x0891b2, // Cyan
    0xc026d3, // Magenta
    0xea580c, // Dark Orange
    0x059669, // Emerald
    0x4f46e5, // Indigo
];

function getStableColor(nodeId) {
    if (!nodeId) return 0x2563eb;
    let hash = 0;
    const str = String(nodeId);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % TABLE_COLORS.length;
    return TABLE_COLORS[index];
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
        // Fixed: Use 'importance' property which is passed from AnalyticsView/Backend
        const isImportant = (nodeData.importance_score || nodeData.importance || 0) > 0.4;
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
            logger.debug(`🔍 [Security Lens] ${nodeData.name}: vitality=${health?.toFixed(1)}, rows=${nodeData.row_count}, color=${colorName}`);
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
            logger.debug(`🔌 [Energy Lens] ${nodeData.name || nodeData.id}: isBattery=${isBattery}, isStation=${isStation}, color=${color.toString(16)}`);
        }
    }
    // 3. LATENT MODE (Backend Driven or Inference)
    else if (layoutMode === 'latent') {
        if (nodeData.latent_color) {
            color = new THREE.Color(nodeData.latent_color).getHex();
        } else {
            const n = (nodeData.name || "").toLowerCase();
            if (n.includes('log') || n.includes('err') || n.includes('fraud')) color = 0xef4444; // Red
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
        else {
            // Assign visually distinct colors using same coloring implement as SpinExpand
            color = getStableColor(nodeData.id || nodeData.name);
        }
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

    // VISIBILITY FIX: Make the 5 live-updating WEZU tables massive so user can find them easily!
    const liveTables = ['batteries', 'telemetics_data', 'batteryhealthlog', 'gps_tracking_log', 'stations'];
    if (liveTables.includes(nodeData.id)) {
        size = 80; // Massive size to stand out
        if (nodeData.id === 'batteries') color = 0x00ff00; // Bright Lime Green
        if (nodeData.id === 'telemetics_data') color = 0x00ffff; // Cyan
        if (nodeData.id === 'batteryhealthlog') color = 0xff00ff; // Neon Pink
        if (nodeData.id === 'gps_tracking_log') color = 0xff9900; // Orange
        if (nodeData.id === 'stations') color = 0xffff00; // Yellow
    }

    // LATENT MODE VISIBILITY BOOST
    // Reduced from 3.5x to 1.5x to prevent overcrowding
    if (layoutMode === 'latent') {
        size *= 1.5;
    }
    if (currentLens === 'executive') size *= 1.1;

    // SYNC: Update node data so D3 collision knows the actual visual size
    nodeData.size = size;

    const nodeColor = new THREE.Color(color);
    // Premium-feel harmonization: backend cluster colors are an arbitrary rainbow
    // (lime green next to hot pink next to yellow), which reads busy/cheap once
    // 100+ nodes are on screen. Clamp saturation/lightness into a cohesive band
    // while keeping hue, so clusters stay distinguishable but the palette reads
    // as one deliberate scheme. Security/Energy lenses keep bold status colors.
    if (currentLens !== 'security' && currentLens !== 'energy' && !isCore) {
        const hsl = { h: 0, s: 0, l: 0 };
        nodeColor.getHSL(hsl);
        nodeColor.setHSL(hsl.h, Math.min(hsl.s, 0.55), THREE.MathUtils.clamp(hsl.l, 0.42, 0.62));
    }
    const isLatent = layoutMode === 'latent';

    // ── 1. Inner core — bright emissive orb ──────────────────────────────
    const coreGeo = new THREE.SphereGeometry(size * 0.45, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        roughness: 0.12,
        metalness: 0.0,
        emissive: nodeColor,
        emissiveIntensity: isLatent ? 1.5 : 1.3,
    });
    const sphere = new THREE.Mesh(coreGeo, coreMat);

    // ── 2. Outer glass shell — vibrant with visible color ────────────────
    const shellGeo = new THREE.SphereGeometry(size, 24, 24);
    const shellMat = new THREE.MeshPhysicalMaterial({
        color: nodeColor,
        transparent: true,
        opacity: isLatent ? 0.9 : 0.65,
        roughness: 0.1,
        metalness: 0.05,
        transmission: isLatent ? 0.0 : 0.35,
        thickness: 3.0,
        emissive: nodeColor,
        emissiveIntensity: isLatent ? 1.0 : 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
    });

    // ── 3. Specular highlight dot — gives a "wet marble" look ────────────
    const specGeo = new THREE.SphereGeometry(size * 0.18, 10, 10);
    const specMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false,
    });
    const spec = new THREE.Mesh(specGeo, specMat);
    spec.position.set(size * 0.25, size * 0.3, size * 0.55);

    // ── 4. Soft outer glow halo ──────────────────────────────────────────
    // Shrunk from 1.4x/0.12 opacity: with 100+ nodes packed on the galaxy
    // sphere, overlapping halos merged into a single colored haze that hid
    // node edges entirely. Tighter, dimmer halo keeps the glow per-node.
    const haloGeo = new THREE.SphereGeometry(size * 1.15, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
        color: nodeColor, transparent: true, opacity: 0.08, depthWrite: false,
        side: THREE.BackSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);

    // ── Lens overrides ───────────────────────────────────────────────────
    if (currentLens === 'executive') {
        const imp = Math.min(1, Math.max(0.1, importance));
        shellMat.opacity = 0.08 + (imp * 0.2);
        shellMat.transmission = 0.95;
        shellMat.thickness = 8.0;
        shellMat.roughness = 0.02;
        shellMat.ior = 2.2;
        shellMat.emissiveIntensity = 0.7;
        haloMat.opacity = 0.1;
    }

    if (currentLens === 'security') {
        shellMat.emissiveIntensity = 0.45;
        shellMat.opacity = 0.75;
        shellMat.transmission = 0.15;
        shellMat.roughness = 0.25;
        coreMat.emissiveIntensity = 0.6;
    }

    if (currentLens === 'energy') {
        const name = (nodeData.name || "").toLowerCase();
        const table = (nodeData.id || "").toLowerCase();
        const isAsset = table.includes('batteries') || table.includes('stations') || table.includes('iot') ||
            name.includes('battery') || name.includes('station') || name.includes('device');
        if (isAsset) {
            shellMat.emissiveIntensity = 0.8;
            shellMat.opacity = 0.9;
            shellMat.transmission = 0.05;
            coreMat.emissiveIntensity = 0.8;
            haloMat.opacity = 0.12;
        } else {
            shellMat.opacity = 0.12;
            shellMat.transmission = 0.8;
            shellMat.emissiveIntensity = 0.15;
            haloMat.opacity = 0.02;
        }
    }

    // ── Security forcefield for unhealthy nodes ──────────────────────────
    if (currentLens === 'security') {
        const health = nodeData.vitality || 100;
        if (health < 60) {
            const pulseSpeed = (100 - health) / 10;
            const shieldColor = new THREE.Color(0xff0000).lerp(new THREE.Color(0xffff00), health / 100);
            const shieldGeo = new THREE.IcosahedronGeometry(size * 1.4, 0);
            const shieldMat = new THREE.MeshStandardMaterial({
                color: shieldColor, wireframe: true, transparent: true,
                emissive: shieldColor, emissiveIntensity: 0.5,
                roughness: 0.1, metalness: 0.1, opacity: 0.6,
                blending: THREE.AdditiveBlending,
            });
            const shield = new THREE.Mesh(shieldGeo, shieldMat);
            shield.userData = { isShield: true, pulseSpeed: Math.max(0.5, pulseSpeed), originalScale: 1.4 };
            sphere.add(shield);
            if (animatedObjectsList) animatedObjectsList.push(shield);
        }
    }

    // ── Assemble ─────────────────────────────────────────────────────────
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.userData = { isOuterShell: true };
    sphere.add(shell);
    spec.userData = { isSpec: true };
    sphere.add(spec);
    halo.userData = { isNodeHalo: true };
    sphere.add(halo);

    sphere.userData = {
        ...nodeData,
        isNode: true,
        isInnerCore: true,
        nodeGlow: nodeData.node_glow || 0.2,
        isGlow: true,
        originalColor: nodeColor.getHex(),
    };

    if (animatedObjectsList) animatedObjectsList.push(sphere);

    // ── Label — white with shadow for readability ────────────────────────
    // With 50-100+ tables, showing every label at once is unreadable text soup.
    // Only the biggest/most important nodes get a label by default; hovering
    // reveals the rest (see the hover-dim loop in ThreeGraph.jsx, which treats
    // sprites the same way it treats mesh opacity for hovered/connected nodes).
    // Raised from 22: most real schemas have enough mid-importance tables to
    // clear a size-22 bar, so 30+ labels rendered at once turned the overview
    // into text soup. 32 keeps only the handful of standout hubs labeled.
    const LABEL_VISIBLE_SIZE = 32;
    const labelText = nodeData.name || nodeData.id;
    const label = createTextSprite(labelText, 80, '#ffffff');
    label.position.set(0, size + 50, 0);
    label.userData.alwaysHiddenLabel = size < LABEL_VISIBLE_SIZE;
    label.visible = size >= LABEL_VISIBLE_SIZE;
    sphere.add(label);

    return sphere;
}


function createTextSprite(message, fontsize, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = `bold ${fontsize}px 'Inter', 'Segoe UI', system-ui, sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(message);
    const textWidth = metrics.width;
    const pad = fontsize * 0.4;
    canvas.width = Math.ceil(textWidth + pad * 2);
    canvas.height = Math.ceil(fontsize * 1.4 + pad * 2);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = fontsize * 0.15;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = color;
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width / 10 * 4, canvas.height / 10 * 4, 1);
    return sprite;
}





export { applyGalaxyLayout, createNodeMesh, createTextSprite };

/**
 * triggerBirthEffect
 * Flash-scale animation when a new node is born/added to the scene.
 * @param {THREE.Mesh} mesh - the node mesh to animate
 */
export function triggerBirthEffect(mesh) {
    const originalScale = mesh.scale.clone();
    const flashColor = new THREE.Color(0xffffff);
    const originalColor = mesh.material.color.clone();

    mesh.scale.multiplyScalar(2.0);
    mesh.material.color.set(flashColor);

    setTimeout(() => {
        mesh.scale.copy(originalScale);
        mesh.material.color.copy(originalColor);
    }, 500);
}
