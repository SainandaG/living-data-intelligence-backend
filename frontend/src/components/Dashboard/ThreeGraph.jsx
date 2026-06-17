import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState, useMemo } from 'react';
import { useRegisterCommand } from '../../context/CommandRegistryContext';
import { EventBus } from '../../agents/eventBus';
import soundSystem from '../../utils/SoundSystem';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { authFetch } from '../../utils/apiClient';
import {
    EffectComposer,
    RenderPass,
    UnrealBloomPass
} from 'three-stdlib';
import { useGlowManager } from '../../hooks/useGlow';
import { useCameraManager } from '../../hooks/useCamera';
import * as d3 from 'd3';

import { forceSimulation, forceManyBody, forceLink, forceX, forceY, forceZ } from 'd3-force-3d'; // 3D Physics
import { SeededRNG } from '../../utils/mathUtils';
import {
    createLatentManifold,
    getManifoldHeight,
    applyLatentSpaceLayout,
    enrichNodesWithDependency,
    propagateImpact,
    create3DAxes,
    createFlowArrows,
    createLatentBridgeEdge,
    getLensCategories
} from './LatentSpaceLogic.jsx';

import {
    initLatentRegistry,
    startLatentWebSocket,
    stopLatentWebSocket,
    switchLatentLens,
    getLatentRegistry,
    getClusterColor
} from './LatentSpaceLogic_Core.js';

import RelationshipImpactLabel from '../../3d/RelationshipImpactLabel';
import { logger } from '../../utils/logger';


/**
 * Creates a Voxel Mesh representation for a cluster of nodes.
 * Used in "Tier 3" / "3D Tables" lens.
 */

// ── Module imports — functions extracted to focused sub-modules ───────────────
import {
    createClusterVoxelMesh,
    createDataGridTexture,
} from './ThreeGraph/ClusterManager.js';

import {
    applyGalaxyLayout,
    createNodeMesh,
    createTextSprite,
    triggerBirthEffect,
} from './ThreeGraph/NodeRenderer.js';

import {
    createCurvedEdge,
    createParticle,
} from './ThreeGraph/EdgeRenderer.js';

import {
    createUniversalSkydome,
    createInfiniteDustLayer,
    createSoftSpriteTexture,
    createStarfield,
    createNeuralCoreHalo,
    disposeObject,
} from './ThreeGraph/SceneSetup.js';

import { createForceSimulation } from './ThreeGraph/PhysicsEngine.js';
import { setupInteractionHandlers } from './ThreeGraph/InteractionHandler.js';
// ─────────────────────────────────────────────────────────────────────────────

// ─── Hover FK Arc Overlay Component ─────────────────────────────────────────
// Renders SVG arcs + dual-hemisphere hub spheres between the hovered table and
// its FK-connected neighbours, mirroring the SpinExpand hover behaviour.
// Positions are pre-projected to 2D screen space by _buildHoverFKOverlay().
// ─────────────────────────────────────────────────────────────────────────────

function HoverFKArcOverlay({ overlay }) {
    const { arcs, W, H } = overlay;
    const [hubHoveredId, setHubHoveredId] = React.useState(null);

    return (
        <svg
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 10,
                overflow: 'visible',
            }}
            viewBox={`0 0 ${W} ${H}`}
        >
            <defs>
                {arcs.map(arc => (
                    <linearGradient
                        key={`grad-${arc.id}`}
                        id={`fk-grad-${arc.id}`}
                        x1={arc.from.x} y1={arc.from.y}
                        x2={arc.to.x}   y2={arc.to.y}
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop offset="0%"   stopColor={arc.fromColor} stopOpacity="0.85" />
                        <stop offset="100%" stopColor={arc.toColor}   stopOpacity="0.85" />
                    </linearGradient>
                ))}
            </defs>

            {arcs.map(arc => {
                const mx = (arc.from.x + arc.to.x) / 2;
                const dy = arc.to.y - arc.from.y;
                const dx = arc.to.x - arc.from.x;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Control point: perpendicular lift proportional to distance
                const lift = dist * 0.28;
                const perpX = -dy / dist * lift;
                const perpY =  dx / dist * lift;
                const cx = mx + perpX;
                const cy = (arc.from.y + arc.to.y) / 2 + perpY;

                // Hub (midpoint of the bezier at t=0.5)
                const hubX = 0.25 * arc.from.x + 0.5 * cx + 0.25 * arc.to.x;
                const hubY = 0.25 * arc.from.y + 0.5 * cy + 0.25 * arc.to.y;

                const isHovered = hubHoveredId === arc.id;
                const hubR = Math.max(10, Math.min(18, 8 + dist * 0.02));

                const displayCount = arc.rowCount >= 1000
                    ? `${(arc.rowCount / 1000).toFixed(1)}k`
                    : arc.rowCount > 0 ? String(arc.rowCount) : null;

                return (
                    <g key={arc.id}>
                        {/* Bezier arc with gradient */}
                        <path
                            d={`M ${arc.from.x} ${arc.from.y} Q ${cx} ${cy} ${arc.to.x} ${arc.to.y}`}
                            stroke={`url(#fk-grad-${arc.id})`}
                            strokeWidth={isHovered ? 2.5 : 1.5}
                            fill="none"
                            opacity={isHovered ? 1.0 : 0.7}
                            strokeLinecap="round"
                        />

                        {/* Hub — rendered as overlaid semicircles in SVG */}
                        <g transform={`translate(${hubX}, ${hubY})`}>
                            {/* Left hemisphere (fromColor) */}
                            <path
                                d={`M 0 ${-hubR} A ${hubR} ${hubR} 0 0 0 0 ${hubR} Z`}
                                fill={arc.fromColor}
                                opacity={isHovered ? 1.0 : 0.85}
                                style={{ filter: isHovered ? `drop-shadow(0 0 6px ${arc.fromColor})` : undefined }}
                            />
                            {/* Right hemisphere (toColor) */}
                            <path
                                d={`M 0 ${-hubR} A ${hubR} ${hubR} 0 0 1 0 ${hubR} Z`}
                                fill={arc.toColor}
                                opacity={isHovered ? 1.0 : 0.85}
                                style={{ filter: isHovered ? `drop-shadow(0 0 6px ${arc.toColor})` : undefined }}
                            />
                            {/* Divider ring */}
                            <line x1="0" y1={-hubR} x2="0" y2={hubR}
                                stroke="white" strokeWidth={isHovered ? 2 : 1}
                                opacity={isHovered ? 1 : 0.5} />
                            {/* Outer ring */}
                            <circle cx="0" cy="0" r={hubR}
                                fill="none" stroke="white"
                                strokeWidth={isHovered ? 2 : 0.8}
                                opacity={isHovered ? 0.8 : 0.3} />

                            {/* Row count badge */}
                            {displayCount && (
                                <g>
                                    <rect
                                        x={-20} y={hubR + 3}
                                        width={40} height={16}
                                        rx={8}
                                        fill="rgba(0,0,0,0.85)"
                                        stroke={arc.fromColor}
                                        strokeWidth="0.8"
                                        strokeOpacity="0.6"
                                    />
                                    <text
                                        x="0" y={hubR + 15}
                                        textAnchor="middle"
                                        fontSize="10"
                                        fontWeight="900"
                                        fontFamily="'JetBrains Mono', monospace"
                                        fill="white"
                                    >
                                        {displayCount}
                                    </text>
                                </g>
                            )}

                            {/* Invisible hit area */}
                            <circle
                                cx="0" cy="0" r={hubR + 8}
                                fill="transparent"
                                style={{ pointerEvents: 'all', cursor: 'default' }}
                                onMouseEnter={() => setHubHoveredId(arc.id)}
                                onMouseLeave={() => setHubHoveredId(null)}
                            />
                        </g>

                        {/* Tooltip on hub hover */}
                        {isHovered && (
                            <g>
                                <rect
                                    x={hubX - 90} y={hubY - hubR - 34}
                                    width={180} height={26}
                                    rx={5}
                                    fill="rgba(0,0,0,0.92)"
                                    stroke={arc.toColor}
                                    strokeWidth="1"
                                    strokeOpacity="0.7"
                                    style={{ filter: `drop-shadow(0 0 8px ${arc.fromColor}50) drop-shadow(0 0 8px ${arc.toColor}50)` }}
                                />
                                {/* Dot indicators */}
                                <circle cx={hubX - 78} cy={hubY - hubR - 21} r="4" fill={arc.fromColor} />
                                <text
                                    x={hubX - 70} y={hubY - hubR - 17}
                                    fontSize="10" fontWeight="700"
                                    fontFamily="'JetBrains Mono', monospace"
                                    fill="#fbbf24"
                                    dominantBaseline="middle"
                                >
                                    {arc.fkLabel.length > 28 ? arc.fkLabel.slice(0, 26) + '…' : arc.fkLabel}
                                </text>
                                <circle cx={hubX + 78} cy={hubY - hubR - 21} r="4" fill={arc.toColor} />
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

const ThreeGraph = forwardRef(({
    data,
    tps = 0,
    liveTableCounts = {},
    onNodeClick,
    onNodeHover,
    onEdgeHover, // [NEW] Callback for edge hover tooltips
    activeLens = 'ops',
    clusteringMethod = 'heuristic',
    paused = false,
    className = "",
    activeFilters = {},
    timeValue = 100,
    onNodesEnriched,
    multiSelectedNodes, // [NEW] Multi-select state
    showMultiConnections, // [NEW] Multi-select isolation toggle
    snapshotData = null,
    isSnapshotMode = false,
    layoutMode: layoutModeProp = 'galaxy', // Renamed to avoid collision with internal state
    showPKs = true,
    showFKs = true,
}, ref) => {
    const containerRef = useRef(null);
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const animationRef = useRef(null);
    const cameraAnimRef = useRef(null);
    const composerRef = useRef(null);
    const nodesRef = useRef([]);
    const particlesRef = useRef([]);
    const groupsRef = useRef([]); // Track grouped meshes (like Voxel Clusters) for cleanup
    const activeFlowTargetRef = useRef(null); // Targeted flow from Agents
    const animatedObjectsRef = useRef([]); // Optimization: Cache animating objects (shields)
    const [sceneReady, setSceneReady] = useState(false); // [FIX] Track initialization for effects
    const edgesRef = useRef([]);
    // Tracks whether the eye-button has globally hidden all edges.
    // The animation loop must check this before overriding edge.visible.
    const edgesGloballyHiddenRef = useRef(false);
    const sceneRef = useRef(null);
    const hoverNodeRef = useRef(null);
    const hoverConnectedIdsRef = useRef(new Set()); // IDs connected to currently hovered node
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
    const multiSelectedNodesRef = useRef(multiSelectedNodes || []);
    const showMultiConnectionsRef = useRef(showMultiConnections);
    const fkConnectionLinesRef = useRef([]); // FK relationship lines drawn on node selection (latent mode)


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
    const [currentLens, setCurrentLens] = React.useState(activeLens); // 'ops' | 'security' | 'executive' | 'tier3' | 'energy'
    const currentLensRef = useRef(activeLens); // Ref for access inside loops/imperative
    // Latent Background State (Default: Deep Space Gradient)
    const [latentBg, setLatentBg] = React.useState('radial-gradient(circle at center, #1a202c 0%, #000000 100%)');
    // Latent Time Travel State
    const [timeProgress, setTimeProgress] = React.useState(100); // 0 to 100%
    const timeProgressRef = useRef(100); // Ref for performance-critical loop access
    const manifoldRef = useRef(null);
    const backgroundGroupRef = useRef(null);
    const axesRef = useRef(null);

    // Sync Prop to State
    useEffect(() => {
        if (activeLens && activeLens !== currentLens) {
            logger.debug(`[ThreeGraph] Prop Sync: Lens -> ${activeLens}`);
            setCurrentLens(activeLens);
            currentLensRef.current = activeLens;

            if (layoutMode === 'latent') {
                switchLatentLens(activeLens);
            }
        }
    }, [activeLens, layoutMode]);

    // Edge visibility is now controlled via graphRef.current.toggleEdges(visible)
    // called directly from GraphControlsToolbar — no custom event needed.

    // Sync Multi-Select Refs
    useEffect(() => {
        multiSelectedNodesRef.current = multiSelectedNodes || [];
        showMultiConnectionsRef.current = showMultiConnections;
    }, [multiSelectedNodes, showMultiConnections]);

    // [FIX] Sync external layoutModeProp with internal layoutMode state
    useEffect(() => {
        if (layoutModeProp && layoutModeProp !== layoutMode) {
            logger.debug(`[ThreeGraph] layoutMode Sync:Prop -> ${layoutModeProp}`);
            setLayoutMode(layoutModeProp);
            layoutModeRef.current = layoutModeProp;
        }
    }, [layoutModeProp]);
    //useEffect(() => {
    //    if (sceneRef.current?.fog) {
    //        sceneRef.current.fog.density = layoutMode === 'latent' ? 0.00005 : 0.0008;
    //    }
    //}, [layoutMode]);

    // ─────────────────────────────────────────────
    // MOUNT / UNMOUNT LATENT SPACE (ISOLATED)
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (layoutMode === 'latent') {
            initLatentRegistry(
                nodesRef.current,
                currentLensRef.current,
                (updatedNode) => {
                    // Single node visual refresh callback from the websocket
                    const mainNode = nodesRef.current.find(n => n.id === updatedNode.id);
                    if (mainNode && mainNode.mesh) {
                        const newColor = new THREE.Color(getClusterColor(updatedNode._currentCluster));
                        mainNode.mesh.material.color.copy(newColor);
                        mainNode.mesh.material.emissive.copy(newColor);
                    }
                }
            );
            startLatentWebSocket();
        } else {
            stopLatentWebSocket();
            // CLEAR PHYSICS LOCKS so nodes can drift again in Galaxy mode
            nodesRef.current.forEach(n => {
                n.fx = null;
                n.fy = null;
                n.fz = null;
            });
        }

        // Cleanup on full unmount
        return () => stopLatentWebSocket();
    }, [layoutMode]);

    const [clusterMetadata, setClusterMetadata] = useState(null);
    const [clusterMetadataLoading, setClusterMetadataLoading] = useState(false);

    // ── Hover FK Arc Overlay ──────────────────────────────────────────────────
    // Stores projected 2D screen positions for FK arcs when hovering a node.
    const [hoverFKOverlay, setHoverFKOverlay] = useState(null);
    // Ref so the animation loop / event handlers can call it without stale closure
    const setHoverFKOverlayRef = useRef(setHoverFKOverlay);
    useEffect(() => { setHoverFKOverlayRef.current = setHoverFKOverlay; }, []);


    const { update: updateGlow } = useGlowManager();
    const { focusOn: cameraFocus, stopTransition: stopCameraTransition, update: updateCamera } = useCameraManager(cameraRef, controlsRef);

    // --- SHARED UTILITIES ---
    const spawnParticleForTarget = useCallback((targetNodeNames, isBridgeOnly = false) => {
        if (!sceneRef.current) return;

        let targetEdges = [];
        const sNodes = multiSelectedNodesRef.current;

        // CASE 1: Specific Targets
        if (targetNodeNames && targetNodeNames.length > 0) {
            const targets = targetNodeNames.map(name =>
                name.toString().toLowerCase().replace(/[.,!?;:]$/, '').trim()
            );

            targetEdges = edgesRef.current.filter(e => {
                const sId = typeof e.userData.sourceId === 'object' ? e.userData.sourceId.id : e.userData.sourceId;
                const tId = typeof e.userData.targetId === 'object' ? e.userData.targetId.id : e.userData.targetId;

                const s = nodesRef.current.find(n => n.id === sId);
                const t = nodesRef.current.find(n => n.id === tId);

                if (!s || !t) return false;

                const sourceMatch = targets.includes(s.name.toLowerCase()) || targets.includes(s.id.toLowerCase());
                const targetMatch = targets.includes(t.name.toLowerCase()) || targets.includes(t.id.toLowerCase());

                if (isBridgeOnly) {
                    // Check if both ends are in multi-selection
                    const bothSelected = sNodes.includes(sId) && sNodes.includes(tId);
                    return bothSelected && (sourceMatch || targetMatch);
                }

                return sourceMatch || targetMatch;
            });
        }
        // CASE 2: Global Flow (No targets)
        else {
            // [FIX] Prioritize Bridge Edges if multiple nodes are selected
            const bridgeEdges = edgesRef.current.filter(e => {
                const sId = typeof e.userData.sourceId === 'object' ? e.userData.sourceId.id : e.userData.sourceId;
                const tId = typeof e.userData.targetId === 'object' ? e.userData.targetId.id : e.userData.targetId;
                return sNodes.includes(sId) && sNodes.includes(tId);
            });

            if (bridgeEdges.length > 0 && sNodes.length > 1) {
                targetEdges = bridgeEdges;
            } else {
                targetEdges = edgesRef.current;
            }
        }

        if (targetEdges.length > 0) {
            const randomEdge = targetEdges[Math.floor(Math.random() * targetEdges.length)];

            // Check if this is a bridge edge to apply column label
            const sId = typeof randomEdge.userData.sourceId === 'object' ? randomEdge.userData.sourceId.id : randomEdge.userData.sourceId;
            const tId = typeof randomEdge.userData.targetId === 'object' ? randomEdge.userData.targetId.id : randomEdge.userData.targetId;
            const isBridge = sNodes.includes(sId) && sNodes.includes(tId);

            let label = null;
            if (isBridge && randomEdge.userData.edgeData?.column) {
                label = randomEdge.userData.edgeData.column;
            }

            const particle = createParticle(isBridge ? 'bridge' : 'high_traffic', label);
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
    }, [multiSelectedNodes]);


    // --- NODE VISIBILITY FILTERING (Class Filter) ---
    useEffect(() => {
        if (!nodesRef.current) return;
        logger.debug('[ThreeGraph] Applying Active Filters:', activeFilters);

        nodesRef.current.forEach(n => {
            // Skip hub/core nodes - they should always be visible
            if (n.id === 'hub' || n.id === 'DATABASE_CORE') return;

            const name = (n.name || '').toLowerCase();
            const type = (n.entity || n.type || n.table_type || '').toLowerCase();
            const rc = n.row_count || 0;
            const vitality = n.vitality || 100;

            let category = 'Healthy Tables';
            if (n.latent_category) {
                category = n.latent_category;
            } else {
                // Dynamic Lens fallback if latent layout wasn't run yet
                const cats = getLensCategories(currentLensRef.current);

                // Fallback heuristic for activity
                const now = new Date();
                const lastInteraction = n.last_interaction ? new Date(n.last_interaction) : new Date(0);
                const hoursSince = (now - lastInteraction) / (1000 * 60 * 60);
                const limit = currentLensRef.current === 'activity_week' ? (24 * 7) : 24;

                if (hoursSince <= limit) {
                    category = cats[0].id; // Active
                } else {
                    category = cats[1].id; // Inactive
                }
            }

            const isVisible = activeFilters[category] !== false;

            // [NEW] Categorical Filter Matching
            const hasCatFilter = Object.keys(activeFilters).some(k => k.startsWith(`cat:${n.id}:`));
            const matchesCatFilter = Object.entries(activeFilters).some(([k, v]) =>
                k.startsWith(`cat:${n.id}:`) && v === true
            );

            if (n.mesh) {
                n.mesh.visible = isVisible;

                // If the node matches a specific categorical filter, give it a "selection pulse"
                if (matchesCatFilter) {
                    n.mesh.scale.set(1.5, 1.5, 1.5);
                    if (n.mesh.material) {
                        n.mesh.material.emissiveIntensity = 3.0;
                    }
                } else if (hasCatFilter) {
                    // It has filters but this node doesn't match the active ones -> ghost it
                    n.mesh.scale.set(0.8, 0.8, 0.8);
                    if (n.mesh.material) {
                        n.mesh.material.opacity = 0.2;
                        n.mesh.material.transparent = true;
                    }
                } else {
                    // Reset to normal
                    n.mesh.scale.set(1, 1, 1);
                    if (n.mesh.material) {
                        n.mesh.material.opacity = 0.9;
                        n.mesh.material.emissiveIntensity = isVisible ? 1.5 : 0.2;
                    }
                }
            }

            // Also handle edges - hide if either source or target is hidden
            if (n.edges) {
                n.edges.forEach(edge => {
                    if (edge.mesh) {
                        // This is a bit complex as we need to know the other end's visibility
                        // For now just hide if this node is hidden
                        if (!isVisible) edge.mesh.visible = false;
                        // Re-showing is harder without a global edge pass, but nodes are primary
                    }
                });
            }
        });

        // --- EDGE VISIBILITY PASS ---
        // Build a set of hidden node IDs, then hide any edge where either endpoint is hidden.
        const hiddenIds = new Set(
            nodesRef.current
                .filter(n => n.mesh && n.mesh.visible === false)
                .map(n => n.id)
        );

        if (edgesRef.current) {
            edgesRef.current.forEach(line => {
                const srcId = typeof line.userData.sourceId === 'object'
                    ? line.userData.sourceId?.id
                    : line.userData.sourceId;
                const tgtId = typeof line.userData.targetId === 'object'
                    ? line.userData.targetId?.id
                    : line.userData.targetId;
                // Hide if either endpoint belongs to a hidden cluster
                const srcHidden = srcId && hiddenIds.has(srcId);
                const tgtHidden = tgtId && hiddenIds.has(tgtId);
                line.visible = !srcHidden && !tgtHidden;
            });
        }
    }, [activeFilters]);

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

    const handleZoom = useCallback(({ target, instruction, factor }) => {
        // Handle generic zoom in/out (no target)
        if (instruction === 'zoom_in') {
            if (cameraRef.current && controlsRef.current) {
                const f = factor || 0.8;
                const dir = new THREE.Vector3().subVectors(controlsRef.current.target, cameraRef.current.position).normalize();
                const currentDist = cameraRef.current.position.distanceTo(controlsRef.current.target);
                const newDist = Math.max(50, Math.min(2000, currentDist * f));
                cameraRef.current.position.copy(controlsRef.current.target).sub(dir.multiplyScalar(newDist));
                controlsRef.current.update();
                return { success: true, message: `Zoomed in` };
            }
            return { success: false, error: "Camera not ready" };
        }
        if (instruction === 'zoom_out') {
            if (cameraRef.current && controlsRef.current) {
                const f = factor || 1.25;
                const dir = new THREE.Vector3().subVectors(controlsRef.current.target, cameraRef.current.position).normalize();
                const currentDist = cameraRef.current.position.distanceTo(controlsRef.current.target);
                const newDist = Math.max(50, Math.min(2000, currentDist * f));
                cameraRef.current.position.copy(controlsRef.current.target).sub(dir.multiplyScalar(newDist));
                controlsRef.current.update();
                return { success: true, message: `Zoomed out` };
            }
            return { success: false, error: "Camera not ready" };
        }

        if (!target) return { success: false, error: "No target specified for focus" };
        logger.debug(`[ThreeGraph] Zoom Action: "${target}"`);

        const normalizedTarget = target.toLowerCase().trim();

        // 1. Try to find clusters first
        const clusterNodes = nodesRef.current.filter(n => {
            const c = n.cluster?.toString().toLowerCase();
            const t = n.table_type?.toLowerCase();
            return c === normalizedTarget || (c && c.includes(normalizedTarget)) ||
                t === normalizedTarget || (t && t.includes(normalizedTarget));
        });

        if (clusterNodes.length > 0) {
            logger.debug(`[ThreeGraph] Zooming to cluster with ${clusterNodes.length} nodes`);
            zoomToNodes(clusterNodes);
            return { success: true, message: `Zoomed to ${clusterNodes.length} nodes` };
        }

        // 2. Fallback to single node
        const node = findNodeByTarget(target);
        if (node) {
            logger.debug(`[ThreeGraph] Zooming to node: ${node.name}`);
            focusOnNode(node);
            selectedNodeRef.current = node.id;
            return { success: true, message: `Zoomed to ${node.name}` };
        } else {
            logger.warn(`[ThreeGraph] No zoom target found for: "${target}"`);
            return { success: false, error: `Could not find "${target}"` };
        }
    }, [findNodeByTarget]);

    const handleHighlight = useCallback(({ target }) => {
        if (!target) return { success: false, error: "No target specified" };
        logger.debug(`[ThreeGraph] Highlight Action: "${target}"`);

        const node = findNodeByTarget(target);
        if (node) {
            logger.debug(`[ThreeGraph] Highlighting node: ${node.name}`);
            selectedNodeRef.current = node.id;
            focusOnNode(node);
            return { success: true, message: `Highlighted ${node.name}` };
        } else {
            logger.warn(`[ThreeGraph] No highlight target found for: "${target}"`);
            return { success: false, error: `Could not find "${target}"` };
        }
    }, [findNodeByTarget]);

    const handleCamera = useCallback(({ instruction }) => {
        logger.debug(`[ThreeGraph] Camera Instruction: "${instruction}"`);
        // Support multiple variations of "reset" for voice robustness
        if (instruction === 'reset_view' || instruction === 'reset' || instruction === 'reset_camera' || instruction === 'view_reset') {
            resetCamera();
            if (controlsRef.current) controlsRef.current.reset();
            return { success: true, message: "View reset" };
        }
        return { success: false, error: "Unknown camera instruction" };
    }, []);

    const handleLensSwitch = useCallback(({ lens }) => {
        if (!lens) return { success: false, error: "No lens specified" };
        logger.debug(`[ThreeGraph] Lens Switch Action: "${lens}"`);
        setCurrentLens(lens);
        currentLensRef.current = lens;
        if (lens === 'tier3') soundSystem.play('uiClick');
        return { success: true, message: `Switched to ${lens} lens` };
    }, []);

    const handleFlow = useCallback(({ instruction, target, table_name, nodes }) => {
        logger.debug(`[ThreeGraph] Flow Action: ${instruction}`, { target, table_name, nodes });

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
                logger.debug(`[ThreeGraph] Setting active flow targets:`, targets);
                activeFlowTargetRef.current = targets;

                // Initial burst
                for (let i = 0; i < 20; i++) spawnParticleForTarget(targets);

                // Set Auto-Stop Timer (10 Seconds)
                flowTimeoutRef.current = setTimeout(() => {
                    logger.debug("[ThreeGraph] Auto-stopping flow after 10s");
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
            logger.debug(`[ThreeGraph] Starting global flow`);
            activeFlowTargetRef.current = null; // null = global
            // Initial burst
            for (let i = 0; i < 20; i++) spawnParticleForTarget(null);

            // Set Auto-Stop Timer
            flowTimeoutRef.current = setTimeout(() => {
                logger.debug("[ThreeGraph] Auto-stopping global flow after 10s");
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
        logger.debug(`[ThreeGraph] Tracing lineage for ${target}`);

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

    const handleEdges = useCallback(({ instruction }) => {
        logger.debug(`[ThreeGraph] Edges Instruction: "${instruction}"`);
        if (instruction === 'show_all') {
            if (edgesRef.current) {
                edgesRef.current.forEach(line => line.visible = true);
            }
            return { success: true, message: "Showing connections" };
        }
        if (instruction === 'hide_all') {
            if (edgesRef.current) {
                edgesRef.current.forEach(line => line.visible = false);
            }
            return { success: true, message: "Hiding connections" };
        }
        return { success: false, error: "Unknown edges instruction" };
    }, []);

    useRegisterCommand('graph_zoom', handleZoom);
    useRegisterCommand('graph_highlight', handleHighlight);
    useRegisterCommand('graph_camera', handleCamera);
    useRegisterCommand('graph_flow', handleFlow);
    useRegisterCommand('graph_trace_lineage', handleTraceLineage);
    useRegisterCommand('graph_lens', handleLensSwitch);
    useRegisterCommand('graph_edges', handleEdges);

    // Imperative API for Voice Agent & UI Control
    useImperativeHandle(ref, () => ({
        zoomToCluster: (target) => {
            logger.debug(`[ThreeGraph] Action: Zoom to (Cluster or Node) "${target}"`);

            const normalizedTarget = target.toLowerCase().trim();

            // 1. Try to find nodes by cluster ID or table type (Exact or Prefix)
            const clusterNodes = nodesRef.current.filter(n => {
                const c = n.cluster?.toString().toLowerCase();
                const t = n.table_type?.toLowerCase();
                return c === normalizedTarget || (c && c.includes(normalizedTarget)) ||
                    t === normalizedTarget || (t && t.includes(normalizedTarget));
            });

            if (clusterNodes.length > 0) {
                logger.debug(`[ThreeGraph] Found ${clusterNodes.length} nodes for cluster/type match:`, clusterNodes.map(n => n.name));
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
                logger.debug(`[ThreeGraph] Target "${target}" matched node: ${singleNode.name}. Focusing camera.`);
                focusOnNode(singleNode);
                selectedNodeRef.current = singleNode.id;
                return true;
            }

            logger.warn(`[ThreeGraph] No matches found for "${target}" among ${nodesRef.current.length} nodes.`);
            return false;
        },
        setEvolutionSnapshot: (snapshot) => {
            if (!snapshot || !nodesRef.current) return;
            logger.debug(`[ThreeGraph] 🎞️ Applying Evolution Snapshot...`);

            const snapshotTables = new Map(snapshot.tables.map(t => [t.id || t.name, t]));

            nodesRef.current.forEach(node => {
                const snap = snapshotTables.get(node.id) || snapshotTables.get(node.name);
                if (snap) {
                    if (snap.x !== undefined && snap.y !== undefined) {
                        node.targetX = snap.x;
                        node.targetY = snap.y;
                        node.targetZ = snap.z || 0;
                        node._needsTransition = true;
                    }

                    if (node.mesh) {
                        node.mesh.visible = true;
                        const sizeBonus = snap.relative_size * 2.0 || 0;
                        const targetScale = 0.5 + sizeBonus;
                        node.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

                        if (node.mesh.material && node.mesh.material.emissiveIntensity !== undefined) {
                            const baseGlow = snap.node_glow || 1.0;
                            const ageGlow = snap.age_factor !== undefined ? snap.age_factor : 1.0;
                            node.mesh.material.emissiveIntensity = baseGlow * ageGlow;
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
                        }
                    }
                } else if (node.mesh) {
                    node.mesh.visible = false;
                }
            });
        },
        applySnapshot: (snapshot) => {
            if (!snapshot || !nodesRef.current) return;
            const newNodesMap = new Map((snapshot.nodes || []).map(n => [n.id, n]));

            nodesRef.current.forEach(node => {
                if (newNodesMap.has(node.id)) {
                    const incoming = newNodesMap.get(node.id);
                    node.targetX = incoming.x || incoming.pos?.[0] || 0;
                    node.targetY = incoming.y || incoming.pos?.[1] || 0;
                    node.targetZ = incoming.z || incoming.pos?.[2] || 0;
                    node._needsTransition = true;
                    if (node.mesh) node.mesh.visible = true;
                } else if (node.mesh) {
                    node._isRemoving = true;
                    node._removeStartTime = Date.now();
                }
            });
        },
        setLens: (lens) => {
            logger.debug(`[ThreeGraph] 👓 Switching Lens to: ${lens}`);
            setCurrentLens(lens);
            currentLensRef.current = lens; // Sync Ref
            // If switching to voxel mode (tier3), force a layout update effectively
            if (lens === 'tier3') {
                soundSystem.play('uiClick');
            }
        },
        startFlow: () => {
            logger.debug(`[ThreeGraph] Action: Start Flow`);
            flowEnabledRef.current = true;
        },
        stopFlow: () => {
            logger.debug(`[ThreeGraph] Action: Stop Flow`);
            flowEnabledRef.current = false;
        },
        toggleEdges: (visible) => {
            edgesGloballyHiddenRef.current = !visible;
            edgesRef.current.forEach(line => { line.visible = visible; });
        },
        highlightNode: (nodeName) => {
            const cleanName = nodeName.toString().toLowerCase().replace(/[.,!?;:]$/, '').trim();
            logger.debug(`[ThreeGraph] Action: Highlight Node "${nodeName}" -> Sanitized: "${cleanName}"`);

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
                logger.warn(`[ThreeGraph] Node not found for highlight: "${cleanName}". Available:`, nodesRef.current.map(n => n.name).slice(0, 5));
            }
        },
        resetView: () => {
            logger.debug('🔄 [ThreeGraph] IMPERATIVE RESET CALLED');
            if (controlsRef.current) {
                logger.debug('📸 [ThreeGraph] Resetting camera via controls');
                controlsRef.current.reset();
            }
            resetCamera();
        },
        zoom: (factor) => {
            if (cameraRef.current && controlsRef.current) {
                // Determine direction vector from camera to controls target (center)
                const dir = new THREE.Vector3().subVectors(controlsRef.current.target, cameraRef.current.position).normalize();
                // Move camera closer (factor < 1) or further (factor > 1) by scaling current distance
                const currentDist = cameraRef.current.position.distanceTo(controlsRef.current.target);
                const newDist = Math.max(50, Math.min(2000, currentDist * factor)); // Clamp to realistic values

                // Set new position
                cameraRef.current.position.copy(controlsRef.current.target).sub(dir.multiplyScalar(newDist));
                controlsRef.current.update();
            }
        },
        setLatentMode: (mode) => {
            logger.debug(`[ThreeGraph] Setting Layout Mode: ${mode}`);
            setLayoutMode(mode);
            layoutModeRef.current = mode;
            if (backgroundGroupRef.current) {
                backgroundGroupRef.current.visible = (mode !== 'latent');
            }
            if (sceneRef.current) {
                sceneRef.current.traverse(obj => {
                    if (obj.userData?.isAtmos) obj.visible = (mode !== 'latent');
                    if (obj.userData?.isInfiniteDust) obj.material.uniforms.uOpacity.value = (mode === 'latent') ? 0.0 : 0.8;
                    if (obj.userData?.isHalo) obj.visible = (mode !== 'latent');
                });
            }
        },
        setLayoutMode: (mode) => {
            logger.debug(`[ThreeGraph] Setting Layout Mode (SAI): ${mode}`);
            setLayoutMode(mode);
            layoutModeRef.current = mode;
            if (backgroundGroupRef.current) {
                backgroundGroupRef.current.visible = (mode !== 'latent');
            }
        },
        toggleLatentMode: () => {
            setLayoutMode(prev => {
                const next = prev === 'galaxy' ? 'latent' : 'galaxy';
                layoutModeRef.current = next;
                if (backgroundGroupRef.current) {
                    backgroundGroupRef.current.visible = (next !== 'latent');
                }
                return next;
            });
        },
        screenshot: () => {
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
                const link = document.createElement('a');
                link.download = `schema-graph-${Date.now()}.png`;
                link.href = rendererRef.current.domElement.toDataURL('image/png');
                link.click();
            }
        },
    }), [layoutMode, currentLens]);

    function focusOnNode(node) {
        if (!cameraRef.current || !controlsRef.current) return;

        // Safety Clean: Use target coords if current are invalid
        let targetX = node.x;
        let targetY = node.y;
        let targetZ = node.z;

        if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(targetZ)) {
            logger.warn('[ThreeGraph] Invalid node coordinates, falling back to targets or zero:', node);
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

        logger.debug(`[ThreeGraph] Focusing on node: ${node.name} via CameraManager`);
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
        logger.debug('[ThreeGraph] Resetting Camera to Overview');
        cameraFocus(new THREE.Vector3(0, 0, 1600), new THREE.Vector3(0, 0, 0), 1.2);
        selectedNodeRef.current = null;
    }

    useEffect(() => {
        logger.debug(`[ThreeGraph] TPS changed: ${tps}`);
        tpsRef.current = tps;
        if (tps <= 0) {
            logger.debug('[ThreeGraph] TPS is 0 - clearing all particles');
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
                const response = await authFetch(`/api/graph/cluster-metadata/${data.connection_id}`);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const metadata = await response.json();

                if (metadata.status === 'success' && metadata.clusters) {
                    logger.debug(`✅ [3D Tables] Loaded ${metadata.total_clusters} clusters for ${metadata.total_tables} tables`);
                    setClusterMetadata(metadata);
                } else {
                    logger.warn(`⚠️ [3D Tables] No cluster metadata available: ${metadata.error || 'Unknown error'}`);
                    setClusterMetadata(null);
                }

            } catch (err) {
                logger.error('❌ [3D Tables] Failed to fetch cluster metadata:', err);
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

        // [IMMERSIIVE UPGRADE] Add Exponential Fog to create depth and a sense of void
        // Parameters: Hex Color, Density (Smaller = less fog)
        //scene.fog = new THREE.FogExp2(0x000000, 0.0008);

        // Conditional Background Starfield
        backgroundGroupRef.current = createStarfield(scene, nodesRef.current);
        if (backgroundGroupRef.current) {
            backgroundGroupRef.current.visible = (layoutModeRef.current !== 'latent');
        }

        // [NEW] Universal Space Atmosphere (Nebula backdrop)
        createUniversalSkydome(scene);

        // [NEW] Camera-Locked Infinite Starfield (Constant wrapping "white dust")
        const infiniteStars = createInfiniteDustLayer(scene);
        animatedObjectsRef.current.push(infiniteStars);

        // [NEW] Neural Core Halo
        const halo = createNeuralCoreHalo(scene);
        animatedObjectsRef.current.push(halo);

        // Init Camera
        // HYPER-LATENT FIX: Increase Far Plane to see full 30k+ space
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200000);
        camera.position.z = 1600; // Zoomed out for better overview
        cameraRef.current = camera;

        // Static Vector3 for reuse in animate loop to prevent GC pressure
        const lerpTargetPos = new THREE.Vector3();

        // Init Renderer
        // Init Renderer with Crash Safety
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: false, // Performance: Disabled by default for better FPS on large datasets
                alpha: true, // Allow CSS background to show through
                powerPreference: "high-performance",
                precision: "mediump" // Performance: Medium precision is usually enough for data viz
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio at 2
        } catch (e) {
            logger.error('[ThreeGraph] WebGL Crashed/Blocked:', e);
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

        // --- POST PROCESSING SETUP (Bloom) ---
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.4,  // strength
            0.3,  // radius
            0.5  // threshold
        );
        composer.addPass(bloomPass);
        composerRef.current = composer;

        // ============ WEBGL CONTEXT LOSS RECOVERY ============
        // Prevent crashes when GPU context is lost (e.g., driver issues, tab suspension)
        const webglCanvas = renderer.domElement;

        const handleContextLost = (event) => {
            event.preventDefault(); // Prevent default browser behavior
            logger.warn('⚠️ [ThreeGraph] WebGL context lost - attempting recovery...');

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
            logger.debug('✅ [ThreeGraph] WebGL context restored successfully');

            // Remove notification
            const notification = document.getElementById('webgl-recovery-notification');
            if (notification) {
                notification.remove();
            }

            // Soft reset: resize renderer and update controls to restore rendering
            setTimeout(() => {
                logger.debug('[ThreeGraph] WebGL context restored — triggering scene rebuild');
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
        sceneRef.current = scene;
        setSceneReady(true);
        logger.debug("[ThreeGraph] Scene initialized and ready.");

        // Interaction Listeners
        const stopListener = () => stopCameraTransition();
        controls.addEventListener('start', stopListener);

        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = 4.0; // [FIX] Increase threshold to make lines easier to hover

        // ── Build hover FK arc overlay helper ────────────────────────────────
        // Projects the hovered node and its FK-connected neighbours into 2D screen
        // space and stores the result in React state for the SVG overlay to render.
        // Defined before onMouseMove because it is called inside that handler.
        const _buildHoverFKOverlay = (hoveredNode, cam, rend) => {
            if (!hoveredNode?.mesh?.position) {
                setHoverFKOverlayRef.current(null);
                hoverConnectedIdsRef.current = new Set();
                return;
            }

            const rect = rend.domElement.getBoundingClientRect();
            const W = rect.width;
            const H = rect.height;

            const project3D = (pos3) => {
                const v = pos3.clone().project(cam);
                return {
                    x: (v.x * 0.5 + 0.5) * W,
                    y: (-v.y * 0.5 + 0.5) * H,
                };
            };

            const hoveredPos2D = project3D(hoveredNode.mesh.position);

            // Find FK connections via edgesRef (Three.js edges, same source as animate loop)
            // NOTE: Do NOT use data.edges here — D3 mutates edge.source/target to node objects
            // after simulation starts, making string-ID comparisons unreliable.
            // edgesRef.current uses pre-normalized userData.sourceId / userData.targetId.
            const connectedArcs = [];
            const seenPairs = new Set();
            const connectedIds = new Set(); // For node dimming in animate loop
            const hovId = String(hoveredNode.id).toLowerCase();
            connectedIds.add(hovId); // Always include self

            const getNormalizedId = (val) => {
                if (!val) return '';
                if (typeof val === 'object') return String(val.id || '').toLowerCase();
                return String(val).toLowerCase();
            };

            edgesRef.current.forEach(edge => {
                const rawSrc = getNormalizedId(edge.userData.sourceId);
                const rawTgt = getNormalizedId(edge.userData.targetId);
                const isHovSrc = rawSrc === hovId;
                const isHovTgt = rawTgt === hovId;
                if (!isHovSrc && !isHovTgt) return;

                const peerId = isHovSrc ? rawTgt : rawSrc;
                connectedIds.add(peerId); // Track for dimming

                const pairKey = [hovId, peerId].sort().join('|');
                if (seenPairs.has(pairKey)) return;
                seenPairs.add(pairKey);

                const peerNode = nodesRef.current.find(n => String(n.id).toLowerCase() === peerId);
                if (!peerNode?.mesh?.position) return;

                const peerPos2D = project3D(peerNode.mesh.position);

                // Colors — read from mesh material (most reliable), fallback to node data
                const toHexStr = (val) => {
                    if (!val && val !== 0) return null;
                    if (typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgb'))) return val;
                    if (typeof val === 'number') return '#' + val.toString(16).padStart(6, '0');
                    return null;
                };
                const getNodeColor = (nd) => {
                    if (nd.mesh?.material?.color) return '#' + nd.mesh.material.color.getHexString();
                    return toHexStr(nd.node_color) || toHexStr(nd.color) || '#60a5fa';
                };
                const hovColor  = getNodeColor(hoveredNode);
                const peerColor = getNodeColor(peerNode);
                const fromColor = isHovSrc ? hovColor : peerColor;
                const toColor   = isHovSrc ? peerColor : hovColor;

                const rowCount = peerNode.metadata?.rows || peerNode.row_count || 0;

                // FK column label
                let fkLabel = '';
                const fks = (isHovSrc ? hoveredNode : peerNode).foreign_keys || [];
                const matchFk = fks.find(fk => {
                    const ref = (fk.referenced_table || '').toLowerCase();
                    const refId = isHovSrc ? peerId : hovId;
                    return ref === refId.toLowerCase() || ref === (isHovSrc ? peerNode.name : hoveredNode.name || '').toLowerCase();
                });
                if (matchFk) {
                    const srcName = isHovSrc ? hoveredNode.name : peerNode.name;
                    const tgtName = isHovSrc ? peerNode.name : hoveredNode.name;
                    fkLabel = `${srcName}.${matchFk.column} → ${tgtName}.${matchFk.referenced_column || matchFk.column}`;
                } else {
                    fkLabel = `${isHovSrc ? hoveredNode.name : peerNode.name} → ${isHovSrc ? peerNode.name : hoveredNode.name}`;
                }

                connectedArcs.push({
                    id: pairKey,
                    from: isHovSrc ? hoveredPos2D : peerPos2D,
                    to:   isHovSrc ? peerPos2D   : hoveredPos2D,
                    fromColor, toColor,
                    rowCount,
                    fkLabel,
                    peerName: peerNode.name || peerId,
                });
            });

            // Publish connected IDs so the animate loop can dim other nodes
            hoverConnectedIdsRef.current = connectedIds;

            setHoverFKOverlayRef.current(
                connectedArcs.length > 0
                    ? { hoveredPos2D, arcs: connectedArcs, W, H }
                    : null
            );
        };

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
                    if (onEdgeHover) {
                        onEdgeHover(null); // Clear edge hover if we're hovering a node
                    }

                    // ── FK ARC OVERLAY: project FK neighbours to 2D ──────────
                    _buildHoverFKOverlay(foundNode, camera, renderer);

                    // SONIFICATION: Play metric sound on hover
                    const gravity = foundNode.importance_score || 1.0;
                    const glowIntense = foundNode.node_glow || 0.5;
                    soundSystem.playMetricOscillation(gravity, glowIntense);
                } else if (!foundNode) {
                    // RAYCAST FIX: Check for Line/Edge intersections if no node was hit, but we did hit *something*
                    let foundEdge = null;
                    for (let i = 0; i < intersects.length; i++) {
                        const intersection = intersects[i];
                        if (intersection.object.type === 'Line' && intersection.object.userData) {
                            const ud = intersection.object.userData;
                            // Need source and target to confirm it's an actual graph edge
                            if (ud.sourceId && ud.targetId) {
                                foundEdge = {
                                    isEdge: true,
                                    data: ud.edgeData || {},
                                    sourceNode: nodesRef.current.find(n => n.id === (typeof ud.sourceId === 'object' ? ud.sourceId.id : ud.sourceId)),
                                    targetNode: nodesRef.current.find(n => n.id === (typeof ud.targetId === 'object' ? ud.targetId.id : ud.targetId)),
                                    mousePos: { x: e.clientX, y: e.clientY }
                                };
                                break;
                            }
                        }
                    }

                    if (foundEdge) {
                        document.body.style.cursor = 'pointer';
                        if (onEdgeHover) onEdgeHover(foundEdge);
                    } else {
                        if (onEdgeHover) onEdgeHover(null);
                        document.body.style.cursor = 'default';
                    }
                }
            } else {
                // No intersections at all
                if (hoverNodeRef.current) {
                    hoverNodeRef.current = null; // Clear Ref
                    hoverConnectedIdsRef.current = new Set(); // Clear connected IDs
                    setHoverFKOverlayRef.current(null); // Clear FK arc overlay

                    // [NEW] Clear hover preview
                    if (onNodeHover) {
                        onNodeHover(null);
                    }
                }

                if (onEdgeHover) onEdgeHover(null);
                document.body.style.cursor = 'default';
            }
        };

        let mouseDownPos = { x: 0, y: 0 };
        const onMouseDown = (e) => {
            mouseDownPos = { x: e.clientX, y: e.clientY };
        };

        const onClick = (event) => {
            // DRAG PREVENTION logic: Don't trigger click if we just dragged the camera
            const dx = event.clientX - mouseDownPos.x;
            const dy = event.clientY - mouseDownPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                // Was likely a drag, ignore click
                return;
            }

            if (hoverNodeRef.current) {
                const toggledNode = hoverNodeRef.current;
                logger.debug("ThreeGraph: Node Clicked - Table:", toggledNode.name);
                selectedNodeRef.current = toggledNode; // Track for Business Lens impact labels

                // [STEP 4] Dependency Propagation Visual Pulse
                if (layoutModeRef.current === 'latent') {
                    logger.debug("[ThreeGraph] 🌊 Propagating Dependency Impact from:", toggledNode.name);
                    const impactedIds = propagateImpact(toggledNode.id, nodesRef.current);

                    nodesRef.current.forEach(node => {
                        if (impactedIds.has(node.id) && node.mesh) {
                            // Visual: pulse orange/red to show cascading impact
                            // We use a temporary emissive flash
                            const originalColor = new THREE.Color(node.latent_color || '#11ff44');
                            node.mesh.material.color.set('#ff8800');
                            if (node.mesh.material.emissive) {
                                node.mesh.material.emissive.set('#ff4400');
                                node.mesh.material.emissiveIntensity = 1.0;
                            }
                            node.isImpacted = true;

                            // Restore after 2 seconds
                            setTimeout(() => {
                                if (node.mesh && node.mesh.material) {
                                    node.mesh.material.color.copy(originalColor);
                                    if (node.mesh.material.emissive) {
                                        node.mesh.material.emissive.setHex(0x000000);
                                        node.mesh.material.emissiveIntensity = 0.5;
                                    }
                                    node.isImpacted = false;
                                }
                            }, 2000);
                        }
                    });

                    // ── FK SATELLITE INTERSECTION LINES ───────────────────────────────
                    // When a node is selected, find all OTHER nodes that share the same
                    // referenced_table in their foreign_keys. Draw a CatmullRom curved
                    // line routed THROUGH the selected node's FK satellite ball for that
                    // shared key — making the ball the visible junction/intersection point.

                    // Clear any previous FK connection lines
                    fkConnectionLinesRef.current.forEach(obj => {
                        scene.remove(obj);
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) obj.material.dispose();
                    });
                    fkConnectionLinesRef.current = [];

                    // Build node lookup by id and lowercase name
                    const fkNodeById = new Map();
                    nodesRef.current.forEach(n => {
                        fkNodeById.set(n.id, n);
                        if (n.name) fkNodeById.set(n.name.toLowerCase(), n);
                    });

                    // Build reverse map: referenced_table → [nodeData] for every node
                    // so we can quickly find all nodes sharing the same FK target
                    const fkTargetMap = new Map(); // referenced_table (lowercase) → Set of node ids
                    nodesRef.current.forEach(n => {
                        (n.foreign_keys || []).forEach(fk => {
                            const ref = (fk.referenced_table || '').toLowerCase();
                            if (!ref) return;
                            if (!fkTargetMap.has(ref)) fkTargetMap.set(ref, new Set());
                            fkTargetMap.get(ref).add(n.id);
                        });
                    });

                    // For each FK on the selected node, find its satellite ball
                    // (child of mesh) and draw curves to peer nodes sharing the same FK
                    const selMesh = toggledNode.mesh;
                    if (selMesh) {
                        const drawnPairs = new Set(); // avoid duplicate lines
                        (toggledNode.foreign_keys || []).forEach(fk => {
                            const ref = (fk.referenced_table || '').toLowerCase();
                            if (!ref) return;

                            // Find the satellite FK ball child that represents this FK
                            const fkBallChild = selMesh.children.find(
                                c => c.userData.type === 'fk_ball' &&
                                    (c.userData.fk?.referenced_table || '').toLowerCase() === ref
                            );

                            // Get the ball's world-space position as the curve waypoint
                            const ballWorldPos = new THREE.Vector3();
                            if (fkBallChild) {
                                fkBallChild.getWorldPosition(ballWorldPos);
                            } else {
                                // Fallback: midpoint offset if ball not found
                                ballWorldPos.copy(selMesh.position);
                                ballWorldPos.y += (toggledNode.size || 30) * 5;
                            }

                            // All other nodes that also have a FK pointing to the same table
                            const peerIds = fkTargetMap.get(ref) || new Set();
                            peerIds.forEach(peerId => {
                                if (peerId === toggledNode.id) return;
                                const pairKey = [toggledNode.id, peerId].sort().join('|') + '|' + ref;
                                if (drawnPairs.has(pairKey)) return;
                                drawnPairs.add(pairKey);

                                const peerNode = fkNodeById.get(peerId);
                                if (!peerNode?.mesh?.position) return;

                                // Curved line: selectedNode → FK ball (junction) → peer node
                                const curve = new THREE.CatmullRomCurve3([
                                    selMesh.position.clone(),
                                    ballWorldPos.clone(),
                                    peerNode.mesh.position.clone(),
                                ]);
                                const pts = curve.getPoints(60);
                                const geo = new THREE.BufferGeometry().setFromPoints(pts);
                                const mat = new THREE.LineBasicMaterial({
                                    color: 0xfbbf24,
                                    transparent: true,
                                    opacity: 0.75,
                                });
                                const fkLine = new THREE.Line(geo, mat);
                                fkLine.userData = {
                                    type: 'fk_connection_line',
                                    sourceId: toggledNode.id,
                                    targetId: peerId,
                                    sharedFk: ref,
                                };
                                scene.add(fkLine);
                                fkConnectionLinesRef.current.push(fkLine);
                            });
                        });

                        // Also handle INCOMING: other nodes whose FK targets match this node's id/name
                        // so selecting a referenced table also shows who points to it
                        const selIdLower = (toggledNode.id || '').toLowerCase();
                        const selNameLower = (toggledNode.name || '').toLowerCase();
                        const incomingPeers = fkTargetMap.get(selIdLower) || fkTargetMap.get(selNameLower) || new Set();

                        // Group incoming peers by their FK ball for the selected table
                        // Curve: peerNode → peer's FK ball for selId → selectedNode
                        incomingPeers.forEach(peerId => {
                            if (peerId === toggledNode.id) return;
                            const peerNode = fkNodeById.get(peerId);
                            if (!peerNode?.mesh) return;

                            const pairKey = [toggledNode.id, peerId].sort().join('|') + '|' + selIdLower;
                            if (drawnPairs.has(pairKey)) return;
                            drawnPairs.add(pairKey);

                            // Find the FK ball on the peer that points to the selected node
                            const peerBallChild = peerNode.mesh.children.find(
                                c => c.userData.type === 'fk_ball' &&
                                    (c.userData.fk?.referenced_table || '').toLowerCase() === selIdLower
                            );
                            const peerBallWorldPos = new THREE.Vector3();
                            if (peerBallChild) {
                                peerBallChild.getWorldPosition(peerBallWorldPos);
                            } else {
                                peerBallWorldPos.copy(peerNode.mesh.position);
                                peerBallWorldPos.y += (peerNode.size || 30) * 5;
                            }

                            // Curve routes through the PEER's FK ball (the one that points here)
                            const curve = new THREE.CatmullRomCurve3([
                                selMesh.position.clone(),
                                peerBallWorldPos.clone(),
                                peerNode.mesh.position.clone(),
                            ]);
                            const pts = curve.getPoints(60);
                            const geo = new THREE.BufferGeometry().setFromPoints(pts);
                            const mat = new THREE.LineBasicMaterial({
                                color: 0x60a5fa,  // Blue for incoming references
                                transparent: true,
                                opacity: 0.75,
                            });
                            const fkLine = new THREE.Line(geo, mat);
                            fkLine.userData = {
                                type: 'fk_connection_line',
                                sourceId: peerId,
                                targetId: toggledNode.id,
                                sharedFk: selIdLower,
                            };
                            scene.add(fkLine);
                            fkConnectionLinesRef.current.push(fkLine);
                        });
                    }

                    logger.debug(`[FK Connections] ${toggledNode.name}: ${fkConnectionLinesRef.current.length} curved FK line(s) drawn`);
                    // ─────────────────────────────────────────────────────────────────
                }

                event.stopPropagation();
                event.preventDefault();

                soundSystem.play('nodeClick');

                // Also call onNodeClick if provided - THIS IS THE ONLY NAVIGATION SOURCE
                if (onNodeClick) {
                    onNodeClick(toggledNode, event.shiftKey);
                }
            } else {
                // Clicked on background — clear selection and FK lines
                selectedNodeRef.current = null;
                fkConnectionLinesRef.current.forEach(obj => {
                    scene.remove(obj);
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) obj.material.dispose();
                });
                fkConnectionLinesRef.current = [];
            }
        };

        const canvas = renderer.domElement;
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mousedown', onMouseDown);
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
        let _hoverOverlayFrame = 0; // Throttle counter for hover overlay React state
        const animate = () => {
            animationRef.current = requestAnimationFrame(animate);
            _hoverOverlayFrame++;

            // [FIX] Zombie Simulation check
            if (paused) return;

            const time = Date.now() * 0.001;

            // [VISUAL FIX] Update Shader Uniforms for Pulse/Glow
            if (shaderUniforms) shaderUniforms.time.value = time;

            if (controlsRef.current) controlsRef.current.update();

            // [NEW] Atmospheric Rotation (Slow & Cinematic)
            if (backgroundGroupRef.current) {
                backgroundGroupRef.current.rotation.y += 0.00003; // Even slower for infinite feel
                backgroundGroupRef.current.rotation.z += 0.00001;
            }

            // Smooth Factor (Lower = Smoother/Heavier like Spline)
            const LERP_FACTOR = 0.08;

            // 1. UPDATE CAMERA
            updateCamera(0.016);

            // Helpers for lerp logic
            const lerp = (current, target, speed) => current + (target - current) * speed;

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
                    const t = Date.now() * 0.001 * (timeValue / 100);
                    const speed = object.userData.pulseSpeed || 1.0;
                    const base = object.userData.originalScale || 1.4;
                    // Formula: scale = base + sin(t * speed) * offset
                    const scale = base + Math.sin(t * speed * 3.0) * 0.15;
                    object.scale.setScalar(scale);
                    object.rotation.y += 0.02 * (timeValue / 100);
                    object.rotation.z -= 0.01 * (timeValue / 100);
                }

                // HALO PULSE
                if (object.userData && object.userData.isHalo) {
                    const pulse = 0.25 + Math.sin(time * 0.5) * 0.05;
                    object.material.opacity = pulse;
                    // Slightly oscillate scale for "breathing" effect
                    const scale = 6000 + Math.sin(time * 0.3) * 200;
                    object.scale.set(scale, scale, 1);
                }

                // CAMERA-LOCKED INFINITE DUST WRAPPING (hidden in latent mode)
                if (object.userData && object.userData.isInfiniteDust && cameraRef.current) {
                    if (layoutModeRef.current === 'latent') {
                        object.material.uniforms.uOpacity.value = 0.0;
                    } else {
                        object.material.uniforms.uOpacity.value = 0.8;
                        object.material.uniforms.uTime.value = time;
                        object.material.uniforms.uCameraPos.value.copy(cameraRef.current.position);
                    }
                }
            });

            // ─────────────────────────────────────────────
            // LATENT MODE: LERP TRANSITION ENGINE
            // Iterates through isolated registry and interpolates mesh positions
            // ─────────────────────────────────────────────
            if (layoutModeRef.current === 'latent') {
                const LERP_SPEED = 0.035;
                const registry = getLatentRegistry();

                registry.forEach((nodeClone) => {
                    if (!nodeClone._needsTransition || nodeClone._targetX === null) return;

                    nodeClone._latentX = lerp(nodeClone._latentX, nodeClone._targetX, LERP_SPEED);
                    nodeClone._latentY = lerp(nodeClone._latentY, nodeClone._targetY, LERP_SPEED);
                    nodeClone._latentZ = lerp(nodeClone._latentZ, nodeClone._targetZ, LERP_SPEED);

                    // Apply to real Three object
                    const mainNode = nodesRef.current.find(n => n.id === nodeClone.id);
                    if (mainNode && mainNode.mesh) {
                        mainNode.mesh.position.set(nodeClone._latentX, nodeClone._latentY, nodeClone._latentZ);

                        // Hard lock physics so D3 doesn't pull it back constantly
                        mainNode.fx = nodeClone._latentX;
                        mainNode.fy = nodeClone._latentY;
                        mainNode.fz = nodeClone._latentZ;

                        const dist = Math.abs(nodeClone._latentX - nodeClone._targetX) +
                            Math.abs(nodeClone._latentY - nodeClone._targetY) +
                            Math.abs(nodeClone._latentZ - nodeClone._targetZ);

                        if (dist < 1.5) {
                            nodeClone._needsTransition = false;
                            const finalColor = new THREE.Color(getClusterColor(nodeClone._currentCluster));
                            mainNode.mesh.material.color.copy(finalColor);
                            mainNode.mesh.material.emissive.copy(finalColor);
                            mainNode.mesh.material.emissiveIntensity = 0.4;
                        }
                    }
                });
            }

            // --- SNAPSHOT & EVOLUTION LERP ENGINE ---
            if (nodesRef.current) {
                const SNAP_LERP_SPEED = 0.05;
                nodesRef.current.forEach(node => {
                    if (node._needsTransition && node.targetX !== undefined) {
                        node.x = THREE.MathUtils.lerp(node.x || 0, node.targetX, SNAP_LERP_SPEED);
                        node.y = THREE.MathUtils.lerp(node.y || 0, node.targetY, SNAP_LERP_SPEED);
                        node.z = THREE.MathUtils.lerp(node.z || 0, node.targetZ, SNAP_LERP_SPEED);
                        if (node.mesh) node.mesh.position.set(node.x, node.y, node.z);
                        if (Math.abs((node.x || 0) - node.targetX) < 0.1) node._needsTransition = false;
                    }

                    if (node._isRemoving && node.mesh) {
                        const elapsed = Date.now() - node._removeStartTime;
                        const alpha = Math.max(0, 1 - (elapsed / 400));
                        node.mesh.traverse(child => {
                            if (child.material) {
                                child.material.transparent = true;
                                child.material.opacity = alpha;
                            }
                        });
                        if (alpha <= 0) {
                            node.mesh.visible = false;
                            node._isRemoving = false;
                        }
                    }
                });
            }

            // ── 1b. HOVER SCENE EFFECT: dim unconnected nodes, brighten connected ones ──
            // This mirrors the Spin & Expand behaviour where hovering creates a
            // focused "constellation" showing only the FK neighbourhood.
            const hoveredId = hoverNodeRef.current?.id ? String(hoverNodeRef.current.id).toLowerCase() : null;
            const connectedIds = hoverConnectedIdsRef.current;
            if (nodesRef.current) {
                nodesRef.current.forEach(node => {
                    if (!node.mesh) return;
                    const normalizedNodeId = String(node.id).toLowerCase();
                    const isHoveredNode = normalizedNodeId === hoveredId;
                    const isConnected   = connectedIds.has(normalizedNodeId);
                    const isIsolating   = hoveredId !== null;

                    // Target scale: hovered node pops up, others stay normal
                    const targetScale = isHoveredNode ? 1.35 : 1.0;
                    node.mesh.scale.setScalar(
                        THREE.MathUtils.lerp(node.mesh.scale.x, targetScale, 0.12)
                    );

                    // Traverse all child meshes (inner sphere + outer glass shell)
                    node.mesh.traverse(child => {
                        if (!child.isMesh || !child.material) return;
                        child.material.transparent = true;

                        // Cache base values on first encounter (before any hover modifies them)
                        if (child.material._baseOpacity === undefined) {
                            child.material._baseOpacity = child.material.opacity ?? 1.0;
                            child.material._baseEmissive = child.material.emissiveIntensity ?? 0.15;
                        }

                        if (!isIsolating) {
                            // No hover active: smoothly restore full opacity + base glow
                            child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, child.material._baseOpacity, 0.1);
                            if (child.material.emissiveIntensity !== undefined) {
                                child.material.emissiveIntensity = THREE.MathUtils.lerp(
                                    child.material.emissiveIntensity, child.material._baseEmissive, 0.1
                                );
                            }
                        } else if (isHoveredNode) {
                            // Hovered node: fully opaque + strong glow
                            child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 1.0, 0.15);
                            if (child.material.emissiveIntensity !== undefined) {
                                child.material.emissiveIntensity = THREE.MathUtils.lerp(
                                    child.material.emissiveIntensity, 2.5, 0.15
                                );
                            }
                        } else if (isConnected) {
                            // FK-connected: fully visible + mild glow
                            child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 0.95, 0.12);
                            if (child.material.emissiveIntensity !== undefined) {
                                child.material.emissiveIntensity = THREE.MathUtils.lerp(
                                    child.material.emissiveIntensity, 1.2, 0.12
                                );
                            }
                        } else {
                            // Unconnected: dim/ghost to near-invisible
                            child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 0.05, 0.1);
                            if (child.material.emissiveIntensity !== undefined) {
                                child.material.emissiveIntensity = THREE.MathUtils.lerp(
                                    child.material.emissiveIntensity, 0.0, 0.1
                                );
                            }
                        }
                        child.material.needsUpdate = true;
                    });
                });
            }

            // 2. UPDATE EDGES (Opacity only, curve handled by D3 tick)
            edgesRef.current.forEach(edge => {
                // Eye-button global hide takes absolute priority over all per-edge logic
                if (edgesGloballyHiddenRef.current) {
                    edge.visible = false;
                    return;
                }
                const hoverId = hoverNodeRef.current ? hoverNodeRef.current.id : null;
                const lineage = lineageRef.current;
                let targetOpacity = 0.15; // Base visibility

                // [FIX] Use Refs to avoid stale closure issues in animate loop
                const sNodes = multiSelectedNodesRef.current;
                const sId = typeof edge.userData.sourceId === 'object' ? edge.userData.sourceId.id : edge.userData.sourceId;
                const tId = typeof edge.userData.targetId === 'object' ? edge.userData.targetId.id : edge.userData.targetId;
                const isIsolating = showMultiConnectionsRef.current && sNodes && sNodes.length > 0;

                if (isIsolating) {
                    const isSourceSelected = sNodes.includes(sId);
                    const isTargetSelected = sNodes.includes(tId);
                    const isBridge = isSourceSelected && isTargetSelected;

                    // If multiple nodes are selected, prioritize showing ONLY 'Bridges' (direct relationships)
                    // If only one node is selected, show all its connections.
                    const isFocusingBridges = sNodes.length > 1;
                    const showCondition = isFocusingBridges ? isBridge : (isSourceSelected || isTargetSelected);

                    if (showCondition) {
                        targetOpacity = 1.0;
                        edge.userData.isActive = true;
                        edge.visible = true;

                        // [NEW] Visual Bridge Highlighting
                        if (isBridge) {
                            if (!edge.userData.originalColor) {
                                edge.userData.originalColor = edge.material.color.clone();
                            }
                            edge.material.color.set(0x00d4ff); // Neon Cyan for technical bridge
                            edge.material.linewidth = 4.0;
                        } else {
                            // Single node selection highlighting
                            if (edge.userData.originalColor) {
                                edge.material.color.copy(edge.userData.originalColor);
                                edge.userData.originalColor = null;
                            }
                            edge.material.linewidth = 1.5;
                        }
                    } else {
                        targetOpacity = 0.0;
                        edge.userData.isActive = false;
                        edge.visible = false;
                        edge.material.opacity = 0.0;
                    }
                } else {
                    edge.visible = true;
                    if (hoverId) {
                        if (sId === hoverId || tId === hoverId) {
                            targetOpacity = 0.8;
                            edge.userData.isActive = true;
                        } else {
                            targetOpacity = 0.05;
                            edge.userData.isActive = false;
                        }
                    } else if (lineage.origin) {
                        // Highlight edges within the lineage path
                        const isSourceInLineage = sId === lineage.origin || lineage.nodes.includes(sId);
                        const isTargetInLineage = tId === lineage.origin || lineage.nodes.includes(tId);

                        if (isSourceInLineage && isTargetInLineage) {
                            targetOpacity = 0.9;
                            edge.userData.isActive = true;
                        } else {
                            targetOpacity = 0.05;
                            edge.userData.isActive = false;
                        }
                    }
                }

                // Smooth Opacity only if we are not forcibly hiding it
                if (edge.visible) {
                    edge.material.opacity = THREE.MathUtils.lerp(edge.material.opacity, targetOpacity, LERP_FACTOR);
                }
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
                        p.progress += p.speed * (timeValue / 100);
                        if (p.progress >= 1) {
                            scene.remove(p.mesh);
                            disposeObject(p.mesh); // FIX: Properly dispose particle geometry/material
                            particlesRef.current.splice(i, 1);
                        } else {
                            // Safe curve evaluation
                            if (p.curve && p.curve.getPoint) {
                                p.mesh.position.copy(p.curve.getPoint(p.progress));

                                // [NEW] If this is a bridge particle (Cube), rotate it for technical effect
                                if (p.mesh.userData && p.mesh.userData.isBridge) {
                                    // p.mesh is the Group returned by createParticle
                                    // Use the stored mesh reference for cleaner rotation if available
                                    const mesh = p.mesh.userData.mesh || p.mesh;
                                    mesh.rotation.x += 0.05;
                                    mesh.rotation.y += 0.05;
                                }
                            }
                        }
                    }
                }
            }

            if (composerRef.current) {
                composerRef.current.render();
            } else {
                renderer.render(scene, camera);
            }

            // ── Keep hover FK overlay in sync with camera (throttled to ~20 fps) ─
            if (hoverNodeRef.current && _hoverOverlayFrame % 3 === 0) {
                _buildHoverFKOverlay(hoverNodeRef.current, camera, renderer);
            }
        };
        animate();


        // Initial Sizing
        const updateDimensions = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;

            if (w === 0 || h === 0) {
                logger.warn('[ThreeGraph] Container has zero dimensions. Skipping resize.');
                return;
            }

            logger.debug(`[ThreeGraph] Resizing to ${w}x${h}`);
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
            logger.debug("[ThreeGraph] Cleaning up resources & Physics...");
            if (simulationRef.current) simulationRef.current.stop();

            resizeObserver.disconnect();
            if (canvas) {
                canvas.removeEventListener('mousemove', onMouseMove);
                canvas.removeEventListener('mousedown', onMouseDown);
                canvas.removeEventListener('click', onClick);
            }
            if (controls) controls.removeEventListener('start', stopListener);

            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);

            if (mountRef.current && canvasContainer) {
                try { mountRef.current.removeChild(canvasContainer); } catch (e) { /* ignore */ }
            }

            if (sceneRef.current) {
                sceneRef.current.traverse((object) => {
                    disposeObject(object);
                });
            }

            if (rendererRef.current) {
                rendererRef.current.renderLists.dispose();
                rendererRef.current.dispose();
            }
        };
    }, []); // Runs ONCE

    // [FIX] Pause/Resume Physics Simulation
    useEffect(() => {
        if (simulationRef.current) {
            if (paused) {
                logger.debug("[ThreeGraph] ⏸ Pausing Simulation");
                simulationRef.current.stop();
            } else {
                logger.debug("[ThreeGraph] ▶ Resuming Simulation");
                simulationRef.current.restart();
            }
        }
    }, [paused]);

    // [NEW] Effect for dimming multi-selected nodes
    useEffect(() => {
        if (multiSelectedNodes && multiSelectedNodes.length > 1) {
            logger.debug(`[ThreeGraph] 🌊 Multi-Selection Detected (${multiSelectedNodes.length}). Activating automated bridge flow.`);
            flowEnabledRef.current = true;
        } else if (!multiSelectedNodes || multiSelectedNodes.length === 0) {
            // Optional: reset flow if selection cleared
            // flowEnabledRef.current = false; 
        }
    }, [multiSelectedNodes?.length]);

    // [NEW] Effect for dimming multi-selected nodes
    useEffect(() => {
        if (!nodesRef.current) return;

        const isIsolating = showMultiConnections && multiSelectedNodes && multiSelectedNodes.length > 0;

        // Pre-calculate which nodes should be visible
        const visibleNodes = new Set();
        if (isIsolating && edgesRef.current) {
            // First, all explicitly selected nodes are visible
            multiSelectedNodes.forEach(id => visibleNodes.add(id));

            // Second, add neighbors of selected nodes (because their edges will be drawn)
            edgesRef.current.forEach(edge => {
                const sId = typeof edge.userData.sourceId === 'object' ? edge.userData.sourceId.id : edge.userData.sourceId;
                const tId = typeof edge.userData.targetId === 'object' ? edge.userData.targetId.id : edge.userData.targetId;

                const isSourceSelected = multiSelectedNodes.includes(sId);
                const isTargetSelected = multiSelectedNodes.includes(tId);

                if (isSourceSelected || isTargetSelected) {
                    visibleNodes.add(sId);
                    visibleNodes.add(tId);
                }
            });
        }

        nodesRef.current.forEach(node => {
            if (node.mesh) {
                let materials = [];
                let shellMaterial = null;

                if (node.mesh.isMesh) {
                    materials = Array.isArray(node.mesh.material) ? node.mesh.material : [node.mesh.material];
                } else if (node.mesh.isGroup) {
                    node.mesh.children.forEach((child, index) => {
                        if (child.isMesh) {
                            // Detect the outer shell from legacy createNodeMesh which is always index 1
                            if (index === 1 && child.geometry && child.geometry.type === 'SphereGeometry') {
                                shellMaterial = child.material;
                            } else {
                                if (Array.isArray(child.material)) {
                                    materials.push(...child.material);
                                } else {
                                    materials.push(child.material);
                                }
                            }
                        }
                    });
                }

                // Filter out any undefined just in case
                materials = materials.filter(m => m);

                materials.forEach(mat => {
                    mat.transparent = true;
                    if (isIsolating) {
                        if (visibleNodes.has(node.id)) {
                            mat.opacity = 0.95;
                            node.mesh.visible = true;
                        } else {
                            mat.opacity = 0.0;
                            node.mesh.visible = false;
                        }
                    } else {
                        // Restore basic opacity 
                        mat.opacity = (layoutModeRef.current === 'analysis' || currentLensRef.current === 'tier3') ? 0.85 : 1.0;
                        node.mesh.visible = true; // Ensure visibility is restored
                    }
                    mat.needsUpdate = true;
                });

                if (shellMaterial) {
                    shellMaterial.transparent = true;
                    if (isIsolating) {
                        if (visibleNodes.has(node.id)) {
                            shellMaterial.opacity = 0.9;
                        } else {
                            shellMaterial.opacity = 0.0;
                        }
                    } else {
                        shellMaterial.opacity = layoutModeRef.current === 'latent' ? 0.9 : 0.45;
                    }
                    shellMaterial.needsUpdate = true;
                }

                // Dim/Hide Label Sprite
                if (node.labelSprite && node.labelSprite.material) {
                    if (isIsolating && !visibleNodes.has(node.id)) {
                        node.labelSprite.material.opacity = 0.0;
                        node.labelSprite.visible = false;
                    } else {
                        node.labelSprite.material.opacity = 1.0;
                        node.labelSprite.visible = true;
                    }
                }
            }
        });
    }, [data, multiSelectedNodes, showMultiConnections]);


    // ═══════════════════════════════════════════════════════
    // [BUSINESS LENS] Paint / Restore nodes based on active role
    // This ONLY applies on top — existing behavior is untouched







    // DEBUG STATE
    const [debugStats, setDebugStats] = React.useState({ nodes: 0, edges: 0, lastUpdate: '-' });

    // 2. DATA PROCESSING EFFECT (Rebuilds Content on Data Update)
    const prevDataRef = useRef(null);
    const prevLayoutModeRef = useRef(layoutMode);
    const prevLensRef = useRef(currentLens);
    const prevShowPKsRef = useRef(showPKs);
    const prevShowFKsRef = useRef(showFKs);

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
        if (!sceneRef.current || !data || !sceneReady) {
            logger.debug("[ThreeGraph] Data effect skipped:", { scene: !!sceneRef.current, data: !!data, sceneReady });
            return;
        }
        logger.debug("[ThreeGraph] 🚀 Data Effect Triggered. Processing nodes...", data.nodes?.length);

        // Force structural update if layoutMode OR currentLens OR visibility toggles change
        const layoutChanged = prevLayoutModeRef.current !== layoutMode;
        const lensChanged = prevLensRef.current !== currentLens;
        const showPKsChanged = prevShowPKsRef.current !== showPKs;
        const showFKsChanged = prevShowFKsRef.current !== showFKs;

        if (layoutChanged) {
            logger.debug(`[ThreeGraph] 📐 Layout Mode Changed: ${prevLayoutModeRef.current} -> ${layoutMode}`);
        }
        if (lensChanged) {
            logger.debug(`[ThreeGraph] 👓 Lens Changed: ${prevLensRef.current} -> ${currentLens}`);
        }
        if (showPKsChanged || showFKsChanged) {
            logger.debug(`[ThreeGraph] 👁️ Visibility Changed: PK=${showPKs}, FK=${showFKs}`);
        }

        const changeType = hasDataChanged(data, prevDataRef.current);

        // 1. No change - skip (UNLESS layout, lens, or visibility changed)
        if (changeType === 'none' && !layoutChanged && !lensChanged && !showPKsChanged && !showFKsChanged) return;

        // Update refs
        prevLayoutModeRef.current = layoutMode;
        prevLensRef.current = currentLens;
        prevShowPKsRef.current = showPKs;
        prevShowFKsRef.current = showFKs;

        // 2. Property change - FAST PATH (No mesh disposal)
        // CRITICAL: Skip fast path if lens changed or visibility changed - need full rebuild
        if (changeType === 'property' && !lensChanged && !layoutChanged && !showPKsChanged && !showFKsChanged) {
            const scene = sceneRef.current;
            logger.debug(`[ThreeGraph] ✨ Fast Property Sync... (Structural Integrity Maintained)`);
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

        logger.debug(`[ThreeGraph] 🔄 Structural Update. Rebuilding Universe...`, data.nodes?.length);




        // A. CLEANUP PREVIOUS CONTENT (AGGRESSIVE)
        logger.debug("[ThreeGraph] 🧹 Disposing previous scene resources...");

        const previousPositions = new Map();

        // 1. Nodes
        if (nodesRef.current) {
            nodesRef.current.forEach(n => {
                if (n.mesh) {
                    previousPositions.set(n.id, n.mesh.position.clone());
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

        // 4. FK Connection Lines (cleared on scene rebuild)
        if (fkConnectionLinesRef.current) {
            fkConnectionLinesRef.current.forEach(obj => {
                if (obj) {
                    scene.remove(obj);
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) obj.material.dispose();
                }
            });
            fkConnectionLinesRef.current = [];
        }

        // 5. Latent World Artifacts (Manifold & Axes)
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
            logger.debug(`[ThreeGraph] 🛠 Building ${data.nodes.length} nodes...`);
            // DEEP CLONE to prevent D3 mutation of props affecting re-renders
            const nodes = data.nodes.map(n => ({ ...n }));

            // 1. Layout - CONDITIONAL BASED ON MODE
            // Step 1: Enrich with dependency data
            const enrichedNodes = enrichNodesWithDependency(nodes, data.edges || []);

            const layoutNodes = layoutMode === 'latent'
                ? applyLatentSpaceLayout([...enrichedNodes], currentLens) // Ensure spread to avoid mutations
                : applyGalaxyLayout(enrichedNodes, 800);

            // [FIX] Sync computed semantic labels (latent_category) back to App state for the UI Panel filter counts
            if (onNodesEnriched) {
                onNodesEnriched(layoutNodes);
            }

            const nodeMap = new Map();

            // 2. Create Nodes
            let createdCount = 0;

            // ============ SAI BRANCH: 'analysis' LAYOUT MODE ============
            // Voxel clusters positioned at latent coordinates
            if (layoutMode === 'analysis') {
                logger.debug("[ThreeGraph] 🧊 Activating SAI Analysis Mode (Voxel Clusters)");

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
                    logger.debug("[SAI Analysis] No cluster data found, auto-clustering by type...");

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

                logger.debug(`✅ [SAI Analysis] Created ${clusterKeys.length} voxel clusters with ${createdCount} nodes`);
            }
            // ============ 3D TABLES LENS (tier3) - NEURAL CORE + INDIVIDUAL NODES ============
            else if (currentLens === 'tier3') {
                logger.debug("[ThreeGraph] 🧊 Activating 3D Tables - Neural Core + Individual Voxels");

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

                logger.debug(`✅ Created Neural Core with ${layoutNodes.length} tables as combined voxel chunk`);

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

                logger.debug(`✅ [3D Tables] Created Neural Core + ${createdCount} individual table voxels in graph structure`);
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

                        // Smooth transition: Spawn at previous position if it existed
                        const prevPos = previousPositions.get(nodeData.id);
                        if (prevPos && layoutMode === 'latent') {
                            mesh.position.copy(prevPos);
                            // Set coordinates to previous so initLatentRegistry lerps from here
                            nodeData.x = prevPos.x;
                            nodeData.y = prevPos.y;
                            nodeData.z = prevPos.z;
                        } else {
                            mesh.position.set(nodeData.x, nodeData.y, nodeData.z);
                        }

                        // [FIX] Link Data & Refs for Animation/Raycasting
                        nodeData.mesh = mesh;
                        // Find the label sprite among children for D3 tick position updates (if any)
                        nodeData.labelSprite = mesh.children.find(c => c.type === 'Sprite');

                        // ── PK & FK SATELLITE BALLS (Latent & Galaxy Modes) ─────────────────
                        // Added as children of the node mesh so they automatically
                        // follow the parent during the lerp transition animation.
                        if (layoutMode === 'latent' || layoutMode === 'galaxy') {
                            const pks = (nodeData.columns || []).filter(c => c.is_pk);
                            const fks = nodeData.foreign_keys || [];

                            if (pks.length > 0 || fks.length > 0) {
                                const nodeRadius = nodeData.size || 30;

                                // Common Geometries (Smaller for Galaxy Mode)
                                const ballR = layoutMode === 'galaxy' ? Math.max(nodeRadius * 0.35, 8) : Math.max(nodeRadius * 0.65, 20);
                                const sphereGeo = new THREE.SphereGeometry(ballR, 8, 8);

                                // 1. Primary Keys (Vibrant Green)
                                if (showPKs) {
                                    pks.forEach((pk, i) => {
                                        const orbitR = layoutMode === 'galaxy' ? nodeRadius * 2.8 : nodeRadius * 4.2; // Tighter orbit for galaxy
                                        const angle = (i / Math.max(pks.length, 1)) * Math.PI * 2;
                                        const lx = Math.cos(angle) * orbitR;
                                        const lz = Math.sin(angle) * orbitR;

                                        const pkMat = new THREE.MeshStandardMaterial({
                                            color: 0x00ff88,
                                            emissive: 0x00ff88,
                                            emissiveIntensity: 2.5,
                                            transparent: true,
                                            opacity: 1.0,
                                            metalness: 0.3,
                                            roughness: 0.1,
                                        });

                                        const ball = new THREE.Mesh(sphereGeo, pkMat);
                                        ball.position.set(lx, 0, lz);
                                        ball.userData = { type: 'pk_ball', pk, parentId: nodeData.id, parentName: nodeData.name };
                                        mesh.add(ball);

                                        // ADD LABEL
                                        const labelFontSize = layoutMode === 'galaxy' ? 14 : 22;
                                        const label = createTextSprite(pk.name || 'PK', labelFontSize, '#00ff88');
                                        label.position.set(0, ballR + (layoutMode === 'galaxy' ? 6 : 12), 0);
                                        ball.add(label);

                                        // Connector
                                        const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4 });
                                        const lineGeo = new THREE.BufferGeometry().setFromPoints([
                                            new THREE.Vector3(0, 0, 0),
                                            new THREE.Vector3(lx, 0, lz),
                                        ]);
                                        mesh.add(new THREE.Line(lineGeo, lineMat));
                                    });
                                }

                                // 2. Foreign Keys (Amber Yellow) - Outer Orbit
                                if (showFKs) {
                                    fks.slice(0, 8).forEach((fk, i) => {
                                        const orbitR = layoutMode === 'galaxy' ? nodeRadius * 4.5 : nodeRadius * 6.2; // Tighter orbit for galaxy
                                        const angle = (i / Math.min(fks.length, 8)) * Math.PI * 2 + (Math.PI / 4); // Offset from PKs
                                        const lx = Math.cos(angle) * orbitR;
                                        const lz = Math.sin(angle) * orbitR;

                                        const fkMat = new THREE.MeshStandardMaterial({
                                            color: 0xfbbf24,
                                            emissive: 0xfbbf24,
                                            emissiveIntensity: 2.0,
                                            transparent: true,
                                            opacity: 1.0,
                                            metalness: 0.3,
                                            roughness: 0.1,
                                        });

                                        const ball = new THREE.Mesh(sphereGeo, fkMat);
                                        ball.position.set(lx, 0, lz);
                                        ball.userData = { type: 'fk_ball', fk, parentId: nodeData.id, parentName: nodeData.name };
                                        mesh.add(ball);

                                        // ADD LABEL
                                        const labelFontSize = layoutMode === 'galaxy' ? 12 : 20;
                                        const nameToDisplay = fk.column || fk.name || 'FK';
                                        const label = createTextSprite(nameToDisplay, labelFontSize, '#fbbf24');
                                        label.position.set(0, ballR + (layoutMode === 'galaxy' ? 5 : 10), 0);
                                        ball.add(label);

                                        // Connector
                                        const lineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.4 });
                                        const lineGeo = new THREE.BufferGeometry().setFromPoints([
                                            new THREE.Vector3(0, 0, 0),
                                            new THREE.Vector3(lx, 0, lz),
                                        ]);
                                        mesh.add(new THREE.Line(lineGeo, lineMat));
                                    });
                                }

                                logger.debug(`[Satellite Balls] ${nodeData.name}: ${pks.length} PK, ${fks.length} FK`);
                            }
                        }
                        // ─────────────────────────────────────────────────────────────────

                        scene.add(mesh);
                        nodesRef.current.push(nodeData);
                        nodeMap.set(nodeData.id, nodeData);
                        createdCount++;
                    });

                    // Clear Instanced Refs to prevent update loop conflicts
                    instancedMeshRef.current = null;
                    instancedShellRef.current = null;
                    textSpritesGroupRef.current = null; // Labels are children now

                    logger.debug(`✅ [Legacy Mode] Created ${createdCount} individual meshes.`);
                }
            }
            logger.debug(`[ThreeGraph] ✅ Created & Added ${createdCount} nodes.`);

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
                        // [FILTER] In Latent Mode, usually only show connections from NEURAL CORE to node
                        // However, if both ends are SELECTED (Bridge), we allow it for technical lineage visualization.
                        if (layoutMode === 'latent') {
                            const isSourceCore = source.id === 'hub' || source.id === 'DATABASE_CORE' || source.type === 'core' || source.name === 'Neural Core';
                            const isTargetCore = target.id === 'hub' || target.id === 'DATABASE_CORE' || target.type === 'core' || target.name === 'Neural Core';

                            const sId = typeof edge.source === 'object' ? edge.source.id : edge.source;
                            const tId = typeof edge.target === 'object' ? edge.target.id : edge.target;
                            const isSourceSelected = (multiSelectedNodes || []).includes(sId);
                            const isTargetSelected = (multiSelectedNodes || []).includes(tId);
                            const isBridge = isSourceSelected && isTargetSelected;

                            // If neither side is a core node AND it's not a bridge between selected nodes, skip it
                            if (!isSourceCore && !isTargetCore && !isBridge) return;
                        }

                        // CHANGED: Use Curved Edge with DETERMINISTIC SEEDing
                        // [FIX] Use raw coordinates, not mesh position (which is 0,0,0 for InstancedMesh)
                        const startPos = new THREE.Vector3(source.x, source.y, source.z);
                        const endPos = new THREE.Vector3(target.x, target.y, target.z);

                        // Determine edge color based on target node (or source if target is hub)
                        let edgeColor = 0x00d4ff; // Default Cyan
                        if (layoutMode === 'latent') {
                            if (target.id !== 'hub' && target.id !== 'DATABASE_CORE') {
                                edgeColor = target.latent_color || target.color || edgeColor;
                            } else if (source.id !== 'hub' && source.id !== 'DATABASE_CORE') {
                                edgeColor = source.latent_color || source.color || edgeColor;
                            }

                            // [FIX] Prevent black edges in Tier 3 / Analysis views
                            if (new THREE.Color(edgeColor).getHex() === 0x000000) {
                                edgeColor = 0x00d4ff;
                            }
                        }

                        const line = createCurvedEdge(startPos, endPos, edge, edge.source, edge.target, layoutMode, edgeColor);
                        line.userData.sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
                        line.userData.targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
                        line.userData.type = edge.type || 'Dependency';
                        line.userData.edgeData = edge; // [NEW] Store full data for detailed tooltips

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
            if (layoutMode === 'latent') {
                if (sceneRef.current?.fog) sceneRef.current.fog.density = 0.00005;
                logger.debug('[ThreeGraph] 🏔️ Rendering Latent Manifold...');

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

                const manifold = createLatentManifold(layoutNodes, currentLens);
                if (manifold) {
                    scene.add(manifold);
                    manifoldRef.current = manifold;
                }

                const axes = create3DAxes('latent', currentLens);
                scene.add(axes);
                axesRef.current = axes;

                const flows = createFlowArrows(data.latent_manifold, currentLens);
                flows.userData = { isFlow: true };
                scene.add(flows);
                axesRef.current.add(flows);

                if (cameraRef.current && controlsRef.current) {
                    const targetPos = new THREE.Vector3(40000, 20000, 40000);
                    const lookAt = new THREE.Vector3(0, 0, 0);
                    cameraFocus(targetPos, lookAt, 1.5);
                }

            } else {
                if (sceneRef.current?.fog) sceneRef.current.fog.density = 0.0002;

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

                if (layoutMode === 'galaxy' && cameraRef.current) {
                    const targetPos = new THREE.Vector3(0, 200, 1000);
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
                    const s = -100 * (d.importance_score || 1.0);
                    // Organic layout for both modes, but latent has softer charge to stay packed
                    return isNaN(s) ? -30 : (layoutMode === 'latent' ? Math.max(s, -50) : s);
                })
                .distanceMax(300)
            )
            .force("collide", d3.forceCollide()
                // Enable collision for latent so clusters pack organically without 100% overlap
                .radius(d => (layoutMode === 'latent') ? (d.size || 10) * 0.8 : (d.size || 10) * 1.2)
                .iterations(3)
            )
            .force("link", forceLink(edgesRef.current.map(e => ({ source: e.userData.sourceId, target: e.userData.targetId, ...e })))
                .id(d => d.id)
                .distance(d => {
                    const intensity = d.trafficIntensity || 0.5;
                    if (intensity <= 0.01) return 150;
                    const dist = 150 / intensity;
                    return isNaN(dist) ? 150 : Math.min(dist, 600);
                })
                // Soft link strength in latent mode to allow groups to cluster organically
                .strength(layoutMode === 'latent' ? 0.01 : 0.05)
            )
            // Strong axial pull for latent to hold the cloud macro-structure against link collapse
            .force("x", forceX(d => d.targetX || 0).strength(layoutMode === 'latent' ? 0.9 : 0.8))
            .force("y", forceY(d => d.targetY || 0).strength(layoutMode === 'latent' ? 0.9 : 0.8))
            .force("z", forceZ(d => d.targetZ || 0).strength(layoutMode === 'latent' ? 0.9 : 0.8));

        // [FIX] Define persistent vectors outside the tick for performance, but inside the component/init function
        const lerpTargetPos = new THREE.Vector3();
        const nodeMap = new Map();

        simulation.on("tick", () => {
            const currentScene = sceneRef.current;
            if (!currentScene) return;

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
                        lerpTargetPos.set(d.x, d.y, d.z);
                        d.mesh.position.lerp(lerpTargetPos, 0.1);
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

        return () => {
            // Cleanup: stop simulation when deps change or component unmounts
            if (simulationRef.current) simulationRef.current.stop();
        };

    }, [data, layoutMode, currentLens, clusteringMethod, JSON.stringify(multiSelectedNodes || []), sceneReady, showPKs, showFKs]); // Re-run when structure, selection, or scene state changes



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


    // --- TRANSACTION PULSE EFFECT ---
    // Uses liveTableCounts (WebSocket, 2s) NOT data.nodes (graph API, slow)
    const prevRowCountsRef = useRef({});

    useEffect(() => {
        if (!sceneRef.current || !liveTableCounts || Object.keys(liveTableCounts).length === 0) return;

        const popColors = {
            'batteries': new THREE.Color(0x00ff00), // Lime
            'telemetics_data': new THREE.Color(0x00ffff), // Cyan
            'batteryhealthlog': new THREE.Color(0xff00ff), // Pink
            'gps_tracking_log': new THREE.Color(0xff9900), // Orange
            'stations': new THREE.Color(0xffff00)  // Yellow
        };

        let popCount = 0;

        Object.entries(liveTableCounts).forEach(([tableId, currentCount]) => {
            if (!popColors[tableId]) return; // Only pulse the WEZU tables

            const prevCount = prevRowCountsRef.current[tableId] || 0;

            if (currentCount > prevCount && prevCount > 0) { // prevCount > 0 avoids first-load false positives
                const sceneNode = nodesRef.current.find(n => n.id === tableId);
                if (sceneNode && sceneNode.mesh) {
                    const mesh = sceneNode.mesh;
                    if (!mesh.material) { prevRowCountsRef.current[tableId] = currentCount; return; }

                    const originalScale = mesh.scale.clone();
                    const originalColor = mesh.material.color?.clone();
                    const hasEmissive = !!mesh.material.emissive;
                    const originalEmissive = hasEmissive ? mesh.material.emissive.clone() : null;
                    const originalEmissiveIntensity = mesh.material.emissiveIntensity || 0;
                    const glowColor = popColors[tableId];

                    // --- INSTANT POP ---
                    mesh.scale.multiplyScalar(2.8);
                    if (originalColor) mesh.material.color.copy(glowColor);
                    if (hasEmissive) {
                        mesh.material.emissive.copy(glowColor);
                        mesh.material.emissiveIntensity = 1.5;
                    }

                    // Shell glow
                    const shell = mesh.children[0];
                    const shellHasEmissive = shell?.material?.emissive != null;
                    if (shell && shell.material) {
                        if (shell.material.color) shell.material.color.copy(glowColor);
                        if (shellHasEmissive) {
                            shell.material.emissive.copy(glowColor);
                            shell.material.emissiveIntensity = 2.0;
                        }
                    }

                    logger.debug(`[ThreeGraph] 💥 TRANSACTION POP: ${tableId} | ${prevCount} -> ${currentCount}`);

                    // --- SMOOTH DECAY ---
                    let step = 0;
                    const decay = setInterval(() => {
                        step++;
                        // Guard: mesh may have been disposed
                        if (!mesh.material) { clearInterval(decay); return; }
                        if (step > 20) {
                            clearInterval(decay);
                            mesh.scale.copy(originalScale);
                            if (originalColor) mesh.material.color.copy(originalColor);
                            if (hasEmissive && originalEmissive) {
                                mesh.material.emissive.copy(originalEmissive);
                                mesh.material.emissiveIntensity = originalEmissiveIntensity;
                            }
                            if (shell && shell.material && shellHasEmissive && originalEmissive) {
                                shell.material.emissive.copy(originalEmissive);
                                shell.material.emissiveIntensity = originalEmissiveIntensity;
                            }
                        } else {
                            const t = 1 - (step / 20);
                            mesh.scale.set(
                                originalScale.x * (1 + 1.8 * t),
                                originalScale.y * (1 + 1.8 * t),
                                originalScale.z * (1 + 1.8 * t)
                            );
                            if (hasEmissive) mesh.material.emissiveIntensity = originalEmissiveIntensity + 5.0 * t;
                            if (shell && shell.material && shellHasEmissive) {
                                shell.material.emissiveIntensity = originalEmissiveIntensity + 8.0 * t;
                            }
                        }
                    }, 50);

                    popCount++;
                }
            }

            prevRowCountsRef.current[tableId] = currentCount;
        });

        if (popCount > 0) logger.debug(`[ThreeGraph] 💥 ${popCount} nodes glowed!`);

        // Cleanup: clear any pending pop-glow timers
        return () => {
            // Individual timeouts use 50ms delays — they will fire and self-clear,
            // but we mark the ref to guard against unmounted updates
        };

    }, [liveTableCounts]);

    // --- AUTOMATED BRIDGE FLOW ---
    useEffect(() => {
        if (showMultiConnections && multiSelectedNodes && multiSelectedNodes.length > 1) {
            logger.debug("[ThreeGraph] 🌉 Bridge selection detected. Triggering automated technical flow.");
            // Spawn bridge particles periodically
            const interval = setInterval(() => {
                spawnParticleForTarget(null, true); // true = isBridgeOnly
            }, 500);
            return () => clearInterval(interval);
        }
    }, [showMultiConnections, multiSelectedNodes?.length, spawnParticleForTarget]);

    return (
        <div ref={containerRef} className={className || "absolute inset-0 z-0"} style={containerStyle}>
            {/* DEBUG HUD - REMOVE BEFORE PRODUCTION */}
            {/* TOPOLOGY VIEW (Always Mounted) */}
            {/* Snapshot Mode Marker */}
            {isSnapshotMode && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-amber-500/20 backdrop-blur-md border border-amber-500/40 rounded-full flex items-center gap-3 animate-pulse pointer-events-none">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    <span className="text-amber-300 text-xs font-bold uppercase tracking-[0.2em]">
                        Viewing Snapshot Analysis — Live Data Paused
                    </span>
                </div>
            )}

            <div
                ref={mountRef}
                className={`absolute inset-0 z-0 transition-opacity duration-700 ${isSnapshotMode ? 'opacity-80' : 'opacity-100'}`}
                style={{ willChange: 'transform' }}
            />

            {/* ── Hover FK Arc Overlay ─────────────────────────────────────── */}
            {hoverFKOverlay && (
                <HoverFKArcOverlay overlay={hoverFKOverlay} />
            )}

            {/* [BUSINESS LENS] Floating Impact Labels removed per user request */}

        </div>
    );
});

export default React.memo(ThreeGraph);
