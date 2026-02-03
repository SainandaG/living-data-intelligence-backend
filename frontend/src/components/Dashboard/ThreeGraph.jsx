import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useRegisterCommand } from '../../context/CommandRegistryContext';
import { EventBus } from '../../agents/eventBus';
import soundSystem from '../../utils/SoundSystem';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useGlowManager } from '../../hooks/useGlow';
import { useCameraManager } from '../../hooks/useCamera';
import * as d3 from 'd3';
import { forceSimulation, forceManyBody, forceLink, forceX, forceY, forceZ } from 'd3-force-3d'; // 3D Physics

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

function createNodeMesh(nodeData) {
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

    if (isCore) {
        color = colorMap.core;
    }
    // PRIORITY 2: Use color from backend (cluster coloring) for regular nodes
    else if (nodeData.color) {
        if (typeof nodeData.color === 'string') {
            // Handle hex strings like "#fbbf24"
            color = new THREE.Color(nodeData.color).getHex();
        } else if (typeof nodeData.color === 'number') {
            color = nodeData.color;
        }
    }
    // PRIORITY 3: Status-based
    else if (nodeData.status === 'warning') {
        color = colorMap.warning;
    }
    // PRIORITY 4: Type-based
    else if (nodeData.table_type === 'fact' || ['payment', 'rental', 'orders', 'sales'].includes(nodeData.id)) {
        color = colorMap.fact;
    }
    // PRIORITY 5: Default
    else {
        color = colorMap.dimension;
    }

    // VISUAL DEBUG REMOVED - Returning to Premium Palette
    // The glow will now drive BRIGHTNESS, not Color hue.

    let size = nodeData.size || 40;
    if (isCore) {
        size = 120; // 3x Bigger for Neural Core
    }

    // 1. Inner Core Sphere (The Light Source)
    const geometry = new THREE.SphereGeometry(size * 0.5, 24, 24);
    const material = new THREE.MeshBasicMaterial({ // Basic material = 100% unlit brightness
        color: color
    });
    const sphere = new THREE.Mesh(geometry, material);

    // 2. Outer Glass Shell (The Lens)
    const shellGeo = new THREE.SphereGeometry(size, 32, 32);
    const shellMat = new THREE.MeshPhysicalMaterial({
        color: color,
        transparent: true,
        opacity: 0.1,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.9,      // Glass effect
        thickness: 2.0,
        emissive: color,
        emissiveIntensity: 0.5, // Subtle glow on the glass itself
        clearcoat: 1.0,
        clearcoatRoughness: 0.0
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    sphere.add(shell);

    // 3. The "Tech" Ring (Saturn Ring) - REMOVED to match desired clean style
    // const ringGeo = new THREE.RingGeometry(size * 1.2, size * 1.4, 32); ...

    // Store "Truth-Preserving" Glow Metric
    // Default to 1.0 if missing
    sphere.userData.nodeGlow = nodeData.node_glow || 1.0;

    // Label (Clean)
    const labelText = nodeData.name || nodeData.id;
    // VISUAL FIX: Doubled font size for readability
    const label = createTextSprite(labelText, 80, '#ffffff');
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

// --- Restored Curved Edge for "Living" Feel ---
import { SeededRNG, getHash } from '../../utils/mathUtils'; // Added deterministic math

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

    const material = new THREE.MeshBasicMaterial({
        color: color,
        // Maximize glow for Green to ensure it's visible
        emissive: color,
        emissiveIntensity: 2.0
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

const ThreeGraph = forwardRef(({ onNodeClick, data, tps = 0, className }, ref) => {
    const containerRef = useRef(null);
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const animationRef = useRef(null);
    const cameraAnimRef = useRef(null);
    const nodesRef = useRef([]);
    const particlesRef = useRef([]);
    const activeFlowTargetRef = useRef(null); // Targeted flow from Agents
    const edgesRef = useRef([]);
    const sceneRef = useRef(null);
    const hoverNodeRef = useRef(null);
    const controlsRef = useRef(null);
    const tpsRef = useRef(tps);
    const selectedNodeRef = useRef(null);
    const flowEnabledRef = useRef(false);
    const flowTimeoutRef = useRef(null); // Timeout for auto-stopping flow
    const lineageRef = useRef({ origin: null, nodes: [] });
    const simulationRef = useRef(null);

    // Refs for state setters to avoid closure issues in event handlers
    const setViewModeRef = useRef(null);
    const setDrilldownNodeRef = useRef(null);

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

    // Imperative API for Voice Agent
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
        }
    }));

    function focusOnNode(node) {
        if (!cameraRef.current || !controlsRef.current) return;
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) {
            console.warn('[ThreeGraph] Invalid node coordinates for focus:', node);
            return;
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

    // Update tpsRef whenever tps prop changes
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

    // 1. INITIALIZATION EFFECT (One-time Setup)
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

        // Init Camera
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 15000);
        camera.position.z = 1600; // Zoomed out for better overview
        cameraRef.current = camera;

        // Init Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true, // Allow CSS background to show through
            powerPreference: "high-performance"
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

        // PREMIUM LIGHTING (Ultra Bright Mode)
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 2.0);
        pointLight.position.set(500, 500, 500);
        scene.add(pointLight);

        const fillLight = new THREE.DirectionalLight(0xa78bfa, 2.0);
        fillLight.position.set(-500, 200, -500);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
        rimLight.position.set(0, 500, -500);
        scene.add(rimLight);

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

        // Controls - UNLOCKED for Interaction
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 50;
        controls.maxDistance = 4000;

        // Allow full 360 rotation
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
        controls.minAzimuthAngle = -Infinity;
        controls.maxAzimuthAngle = Infinity;

        // CRITICAL FIX: Disable auto-rotation to stop "self-rotating" behavior
        controls.autoRotate = false;

        controls.enableRotate = true; // explicitly enable
        controls.enableZoom = true;   // explicitly enable
        controls.enablePan = true;    // explicitly enable panning

        controlsRef.current = controls; // Fix: Assign to ref

        // Interaction
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
                // Traverse up to find the main node mesh
                let object = intersects[0].object;
                let foundNode = null;

                // Climb up the tree until we find a match in nodesRef or hit root
                while (object) {
                    foundNode = nodesRef.current.find(n => n.mesh === object);
                    if (foundNode) break;
                    object = object.parent;
                }

                if (foundNode && foundNode !== hoverNodeRef.current) {
                    hoverNodeRef.current = foundNode; // Update Ref
                    document.body.style.cursor = 'pointer';

                    // SONIFICATION: Play metric sound on hover
                    const gravity = foundNode.importance_score || 1.0;
                    const glowIntense = foundNode.node_glow || 0.5;
                    soundSystem.playMetricOscillation(gravity, glowIntense);
                }
            } else if (hoverNodeRef.current) {
                hoverNodeRef.current = null; // Clear Ref
                document.body.style.cursor = 'default';
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
            const time = Date.now() * 0.001;

            if (controlsRef.current) controlsRef.current.update();

            // Smooth Factor (Lower = Smoother/Heavier like Spline)
            const LERP_FACTOR = 0.08;

            // 1. UPDATE CAMERA
            updateCamera(0.016);

            // 2. GLOW & HOVER LOGIC (Visuals only)
            scene.traverse((object) => {
                if (object.isMesh && object.userData && object.userData.isNode) {
                    const nodeState = object.userData;
                    const hoverId = hoverNodeRef.current ? hoverNodeRef.current.id : null;
                    const isSelected = selectedNodeRef.current === nodeState.id;
                    const lineage = lineageRef.current;
                    let state = 'idle';

                    if (isSelected || lineage.origin === nodeState.id) state = 'hover';
                    else if (lineage.nodes.includes(nodeState.id)) state = 'related';
                    else if (hoverId) {
                        if (nodeState.id === hoverId) state = 'hover';
                        else if (getNeighbors(hoverId).includes(nodeState.id)) state = 'related';
                        else state = 'dimmed';
                    } else if (lineage.origin) state = 'dimmed';

                    // Update Glow
                    updateGlow(object, time, state, nodeState.nodeGlow);
                }
            });

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
            controls.removeEventListener('start', stopListener);

            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);

            if (mountRef.current && canvasContainer) {
                try { mountRef.current.removeChild(canvasContainer); } catch (e) { }
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
                rendererRef.current.forceContextLoss();
            }
        };
    }, []); // Runs ONCE

    // DEBUG STATE
    const [debugStats, setDebugStats] = React.useState({ nodes: 0, edges: 0, lastUpdate: '-' });

    // 2. DATA PROCESSING EFFECT (Rebuilds Content on Data Update)
    const prevDataRef = useRef(null);

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

        const changeType = hasDataChanged(data, prevDataRef.current);

        // 1. No change - skip
        if (changeType === 'none') return;

        // 2. Property change - FAST PATH (No mesh disposal)
        if (changeType === 'property') {
            const scene = sceneRef.current;
            console.log(`[ThreeGraph] ✨ Fast Property Sync... (Structural Integrity Maintained)`);
            data.nodes.forEach(incoming => {
                const existing = nodesRef.current.find(n => n.id === incoming.id);
                if (existing && existing.mesh) {
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

                    // Sync local object state
                    existing.node_glow = incoming.node_glow;
                    existing.vitality = incoming.vitality;
                    existing.color = incoming.color;
                    existing.size = incoming.size;
                }
            });
            prevDataRef.current = JSON.parse(JSON.stringify(data));
            return;
        }

        // 3. Structural change - FULL REBUILD (Structural Integrity Shifted)
        prevDataRef.current = JSON.parse(JSON.stringify(data)); // Deep copy for reference

        const scene = sceneRef.current;

        console.log(`[ThreeGraph] 🔄 Structural Update. Rebuilding Universe...`, data.nodes?.length);

        // A. CLEANUP PREVIOUS CONTENT
        nodesRef.current.forEach(n => {
            if (n.mesh) scene.remove(n.mesh);
        });
        edgesRef.current.forEach(e => {
            if (e) scene.remove(e);
        });

        nodesRef.current = [];
        edgesRef.current = [];

        // Stop previous simulation
        if (simulationRef.current) {
            simulationRef.current.stop();
        }

        // B. BUILD NEW CONTENT
        if (data.nodes && data.nodes.length > 0) {
            console.log(`[ThreeGraph] 🛠 Building ${data.nodes.length} nodes...`);
            // DEEP CLONE to prevent D3 mutation of props affecting re-renders
            const nodes = data.nodes.map(n => ({ ...n }));

            // 1. Layout
            const layoutNodes = applyGalaxyLayout(nodes, 600);
            const nodeMap = new Map();

            // 2. Create Nodes
            let createdCount = 0;
            layoutNodes.forEach((nodeData, i) => {
                const mesh = createNodeMesh(nodeData);
                // Safety Layout Check
                if (isNaN(nodeData.x)) nodeData.x = 0;
                if (isNaN(nodeData.y)) nodeData.y = 0;
                if (isNaN(nodeData.z)) nodeData.z = 0;

                mesh.position.set(nodeData.x, nodeData.y, nodeData.z);
                nodeData.mesh = mesh;
                nodeData.baseY = nodeData.y; // Ensure baseY is set on the object we use in animate

                scene.add(mesh);
                nodesRef.current.push(nodeData);
                nodeMap.set(nodeData.id, nodeData);
                createdCount++;
            });
            console.log(`[ThreeGraph] ✅ Created & Added ${createdCount} node meshes.`);

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
                        const line = createCurvedEdge(source.mesh.position, target.mesh.position, edge, edge.source, edge.target);
                        line.userData.sourceId = edge.source;
                        line.userData.targetId = edge.target;
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
                    const s = -100 * (d.importance_score || 1.0);
                    return isNaN(s) ? -30 : s;
                })
                .distanceMax(300)
            )
            .force("link", forceLink(edgesRef.current.map(e => ({ source: e.userData.sourceId, target: e.userData.targetId, ...e })))
                .id(d => d.id)
                .distance(d => {
                    const intensity = d.trafficIntensity || 0.5;
                    if (intensity <= 0.01) return 200;
                    const dist = 100 / intensity;
                    return isNaN(dist) ? 100 : Math.min(dist, 500);
                })
                .strength(0.1) // LOW INITIAL STRENGTH to prevent "clumping"
            )
            .force("x", forceX(d => d.targetX || 0).strength(0.8))
            .force("y", forceY(d => d.targetY || 0).strength(0.8))
            .force("z", forceZ(d => d.targetZ || 0).strength(0.8))
            .on("tick", () => {
                const currentScene = sceneRef.current;
                if (!currentScene) return;

                nodesRef.current.forEach((d, i) => {
                    if (d.mesh) {
                        if (isNaN(d.x) || isNaN(d.y) || isNaN(d.z)) {
                            d.x = d.targetX || 0;
                            d.y = d.targetY || 0;
                            d.z = d.targetZ || 0;
                        }

                        // If it's the very first tick and alpha is high, bypass lerp for instant positioning
                        if (simulation.alpha() > 0.95) {
                            d.mesh.position.set(d.x, d.y, d.z);
                        } else {
                            d.mesh.position.lerp(new THREE.Vector3(d.x, d.y, d.z), 0.1);
                        }
                    }
                });

                // ... same edge update logic ...

                edgesRef.current.forEach(edge => {
                    const source = edge.userData.sourceNode;
                    const target = edge.userData.targetNode;
                    if (source && target) {
                        const start = source.position;
                        const end = target.position;
                        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                        if (edge.userData.curve) {
                            edge.userData.curve.v0.copy(start);
                            edge.userData.curve.v1.copy(mid).add(new THREE.Vector3(0, Math.sin(Date.now() * 0.001) * 10, 0));
                            edge.userData.curve.v2.copy(end);
                            edge.geometry.setFromPoints(edge.userData.curve.getPoints(50));
                            edge.geometry.attributes.position.needsUpdate = true;
                        }
                    }
                });
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

    }, [data]);

    // 2. DATA UPDATE EFFECT (Disabled - Reverting)
    useEffect(() => {
        return; // DISABLED
        if (!sceneRef.current || !data) return;

        console.log("[ThreeGraph] Differential Data Update...", data.nodes.length, "nodes");
        const scene = sceneRef.current;

        // 1. Map existing nodes for quick lookup
        const existingNodeMap = new Map();
        nodesRef.current.forEach(n => existingNodeMap.set(n.id, n));

        const existingEdgeMap = new Map();
        edgesRef.current.forEach(e => existingEdgeMap.set(`${e.userData.sourceId}-${e.userData.targetId}`, e));

        const newNodes = [];
        const keptNodeIds = new Set();

        // 2. Process Incoming Nodes
        if (data.nodes) {
            const incomingNodes = applyGalaxyLayout(data.nodes.map(n => ({ ...n })), 600);

            incomingNodes.forEach(incoming => {
                keptNodeIds.add(incoming.id);
                const existing = existingNodeMap.get(incoming.id);

                if (existing) {
                    // UPDATE: Keep Physics, Update Props
                    existing.size = incoming.size;
                    existing.color = incoming.color;
                    existing.node_glow = incoming.node_glow;
                    existing.importance_score = incoming.importance_score;
                    existing.metrics = incoming.metrics;
                    existing.targetX = incoming.x;
                    existing.targetY = incoming.y;
                    existing.targetZ = incoming.z;

                    // Visual Update (Mesh)
                    if (existing.mesh) {
                        const scale = incoming.size / 20;
                        existing.mesh.scale.setScalar(1);
                    }
                    newNodes.push(existing);
                } else {
                    // NEW
                    const mesh = createNodeMesh(incoming);
                    mesh.position.set(incoming.x, incoming.y, incoming.z);
                    incoming.mesh = mesh;
                    scene.add(mesh);
                    newNodes.push(incoming);
                }
            });
        }

        // 3. Remove Stale Nodes
        nodesRef.current.forEach(n => {
            if (!keptNodeIds.has(n.id)) {
                if (n.mesh) scene.remove(n.mesh);
            }
        });
        nodesRef.current = newNodes;

        // 4. Process Edges 
        const newEdges = [];
        const keptEdgeIds = new Set();
        const currentNodesMap = new Map(newNodes.map(n => [n.id, n]));

        if (data.edges) {
            data.edges.forEach(edgeData => {
                const id = `${edgeData.source}-${edgeData.target}`;
                keptEdgeIds.add(id);
                const existingEdge = existingEdgeMap.get(id);
                const sourceNode = currentNodesMap.get(edgeData.source);
                const targetNode = currentNodesMap.get(edgeData.target);

                if (sourceNode && targetNode) {
                    if (existingEdge) {
                        existingEdge.userData.trafficIntensity = edgeData.traffic_intensity || 0.3;
                        existingEdge.userData.sourceNode = sourceNode.mesh;
                        existingEdge.userData.targetNode = targetNode.mesh;
                        newEdges.push(existingEdge);
                    } else {
                        const line = createCurvedEdge(sourceNode.mesh.position, targetNode.mesh.position, edgeData, edgeData.source, edgeData.target);
                        line.userData.sourceId = edgeData.source;
                        line.userData.targetId = edgeData.target;
                        line.userData.sourceNode = sourceNode.mesh;
                        line.userData.targetNode = targetNode.mesh;
                        scene.add(line);
                        newEdges.push(line);
                    }
                }
            });
        }

        // Remove Stale Edges
        edgesRef.current.forEach(e => {
            const id = `${e.userData.sourceId}-${e.userData.targetId}`;
            if (!keptEdgeIds.has(id)) scene.remove(e);
        });
        edgesRef.current = newEdges;


        // 5. Update Physics
        if (simulationRef.current) {
            simulationRef.current.stop();
            // Re-bind nodes (D3 modifies them in place, so new references need re-binding)
            simulationRef.current = forceSimulation(nodesRef.current)
                .numDimensions(3)
                .alpha(0.3)
                .alphaDecay(0.02)
                .velocityDecay(0.3)
                .force("charge", forceManyBody().strength(d => -100 * (d.importance_score || 1.0)).distanceMax(300))
                .force("link", forceLink(edgesRef.current.map(e => ({ source: e.userData.sourceId, target: e.userData.targetId, ...e })))
                    .id(d => d.id)
                    .distance(d => 100 / (d.trafficIntensity || 0.5)))
                .force("x", forceX(d => d.targetX || 0).strength(0.8))
                .force("y", forceY(d => d.targetY || 0).strength(0.8))
                .force("z", forceZ(d => d.targetZ || 0).strength(0.8))
                .on("tick", () => {
                    nodesRef.current.forEach(d => {
                        if (d.mesh) d.mesh.position.lerp(new THREE.Vector3(d.x, d.y, d.z), 0.1);
                    });
                    edgesRef.current.forEach(edge => {
                        if (edge.userData.sourceNode && edge.userData.targetNode) {
                            const start = edge.userData.sourceNode.position;
                            const end = edge.userData.targetNode.position;
                            if (edge.userData.curve) {
                                const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                                edge.userData.curve.v0.copy(start);
                                edge.userData.curve.v1.copy(mid).add(new THREE.Vector3(0, Math.sin(Date.now() * 0.001) * 10, 0));
                                edge.userData.curve.v2.copy(end);
                                edge.geometry.setFromPoints(edge.userData.curve.getPoints(50));
                                edge.geometry.attributes.position.needsUpdate = true;
                            }
                        }
                    });
                });
            simulationRef.current.restart();
        }

    }, [data]);

    // --- DEBUG HUD STATE ---
    // Duplicate removed

    // --- VIEW MODE SWITCHING (Logic Moved to LatentWorld Component) ---
    // We only keep the state to toggle the overlay
    const [viewMode, setViewMode] = React.useState('topology');
    const [drilldownNode, setDrilldownNode] = React.useState(null);

    // Store setters in refs so onClick handler can access them
    setViewModeRef.current = setViewMode;
    setDrilldownNodeRef.current = setDrilldownNode;


    return (
        <div ref={containerRef} className={className || "fixed inset-0 z-0"} style={{
            background: 'radial-gradient(circle at center, #1a202c 0%, #000000 100%)'
        }}>
            {/* DEBUG HUD - REMOVE BEFORE PRODUCTION */}
            <div className="absolute top-20 left-6 z-50 p-4 bg-black/80 border border-green-500/30 text-green-400 font-mono text-xs rounded shadow-lg pointer-events-none">
                <h3 className="font-bold underline mb-2">GRAPH DIAGNOSTICS</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>Nodes:</span> <span className="text-white">{debugStats.nodes}</span>
                    <span>Edges:</span> <span className="text-white">{debugStats.edges}</span>
                    <span>Data:</span> <span className="text-white">{data ? 'Received' : 'Waiting...'}</span>
                    <span>Last Upd:</span> <span className="text-gray-400">{debugStats.lastUpdate}</span>
                </div>
            </div>

            {/* TOPOLOGY VIEW (Always Mounted) */}
            <div ref={mountRef} className="absolute inset-0 z-0" />

            <div className="absolute bottom-6 left-6 z-50 flex gap-2">
                <div className="px-4 py-2 rounded border font-mono text-sm bg-cyan-500/20 border-cyan-400 text-cyan-300 pointer-events-none opacity-80">
                    TOPOLOGY VIEW • Click any node to explore
                </div>
            </div>
        </div>
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
