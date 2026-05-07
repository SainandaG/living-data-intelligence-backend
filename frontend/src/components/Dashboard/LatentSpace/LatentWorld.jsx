/**
 * LatentSpace/LatentWorld.jsx
 * The main 3D React component that renders the latent space scene.
 * Extracted from LatentSpaceLogic.jsx lines 1384-1768.
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Text, Html } from '@react-three/drei';
import { authFetch } from '../../../utils/apiClient';
import * as THREE from 'three';
import { OrbitControls, TransformControls, EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';
import { SeededRNG } from '../../../utils/mathUtils';
import { getLatentRegistry } from '../LatentSpaceLogic_Core.js';
import { logger } from '../../../utils/logger';
import s from './styles.js';
import {
    enrichNodesWithDependency, getLensCategories, LENS_CATEGORIES,
    computeCentroids, getManifoldHeight, createLatentManifold,
    applyLatentSpaceLayout, propagateImpact,
    create3DAxes, createFlowArrows, createLatentBridgeEdge,
} from './computations.js';

export const LatentWorld = ({ targetNode, onClose, schemaData, connectionId, multiSelectedNodes, showMultiConnections }) => {
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
    const [hoveredFkBall, setHoveredFkBall] = useState(null); // { fk, parentName, screenX, screenY }

    const geoms = useMemo(() => ({
        sphere: new THREE.SphereGeometry(1, 32, 32),
        box: new THREE.BoxGeometry(1.6, 1.6, 1.6),
        bar: new THREE.BoxGeometry(2, 4, 2),
        octa: new THREE.OctahedronGeometry(1.6),
        tetra: new THREE.TetrahedronGeometry(1.6),
        pillar: new THREE.CylinderGeometry(5, 5, 140, 6),
        pedestal: new THREE.TorusGeometry(3.5, 0.12, 16, 64),
        fkBall: new THREE.SphereGeometry(1, 12, 12),  // lower poly for FK satellites
    }), []);

    useEffect(() => {
        if (!connectionId) return;

        if (targetNode) {
            // DRILL-DOWN MODE: Fetch clusters for this node's columns
            setLoading(true);
            const fetchClusters = async () => {
                try {
                    const response = await authFetch(`/api/internal-node/clusters/${connectionId}/${targetNode.name}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    const data = await response.json();
                    if (data.status === 'success' && data.clusters && data.clusters.length > 0) {
                        setDataClusters(data.clusters);
                        // Map clusters to "latent nodes" for mountain logic if we want to use same engine
                        const latentNodes = data.clusters.map(c => ({
                            id: c.name,
                            name: c.name,
                            row_count: c.count,
                            vitality: c.health_score ?? c.vitality ?? 75,
                            latent_category: c.latent_category ?? c.category ?? 'Dimension',
                        }));
                        setLatentNodes(latentNodes);
                    } else {
                        setDataClusters([]);
                    }
                } catch (err) {
                    logger.error('❌ Failed to fetch clusters:', err);
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
                const resp = await authFetch(`/api/drilldown/${connectionId}/column-intelligence/${targetNode.name}/${selectedSatellite.name}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                const data = await resp.json();
                setIntelligence(data.intelligence);
            } catch (err) {
                logger.error("Failed to fetch column intelligence:", err);
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

            // --- POST PROCESSING SETUP (Bloom) ---
            const composer = new EffectComposer(renderer);
            const renderPass = new RenderPass(sceneRef.current, camera);
            composer.addPass(renderPass);

            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(width, height),
                1.5,  // strength
                0.5,  // radius
                0.22  // threshold
            );
            composer.addPass(bloomPass);
            composerRef.current = composer;
            bloomPassRef.current = bloomPass;

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

            const grid = create3DAxes('latent', 'activity_week');
            sceneRef.current.add(grid);

            const onResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', onResize);
            setWebglError(null);
        } catch (err) {
            logger.error("LATENT_WORLD_ENGINE_FAILURE:", err);
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

        // Pre-calculate which nodes should be visible
        const isIsolating = showMultiConnections && multiSelectedNodes && multiSelectedNodes.length > 0;
        const visibleNodes = new Set();

        if (isIsolating && schemaData?.edges) {
            multiSelectedNodes.forEach(id => visibleNodes.add(id));
            schemaData.edges.forEach(edge => {
                const isSourceSelected = multiSelectedNodes.includes(edge.source);
                const isTargetSelected = multiSelectedNodes.includes(edge.target);
                if (isSourceSelected || isTargetSelected) {
                    visibleNodes.add(edge.source);
                    visibleNodes.add(edge.target);
                }
            });
        }

        // 3. Add Nodes as Glowing Spheres/Symbols mapped to terrain
        arrangedNodes.forEach(node => {
            if (!node.visible) return;

            // Apply isolation logic
            if (isIsolating && !visibleNodes.has(node.id)) {
                return; // Skip rendering this node
            }

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

        // 4. FK Satellite Balls — small amber spheres beside each table node
        if (targetNode === null) {
            const fkMat = new THREE.MeshStandardMaterial({
                color: 0xfbbf24,
                emissive: 0xfbbf24,
                emissiveIntensity: 1.2,
                transparent: true,
                opacity: 0.85,
                metalness: 0.6,
                roughness: 0.2
            });
            const lineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.25 });

            arrangedNodes.forEach(node => {
                if (!node.visible) return;
                if (isIsolating && !visibleNodes.has(node.id)) return;

                const fks = node.foreign_keys || [];
                if (fks.length === 0) return;

                const nodeSize = Math.min(60, 20 + (Math.log10(Math.max(node.row_count || 1, 1)) * 5));
                const orbitRadius = nodeSize * 2.2;
                const fkBallSize = Math.max(6, nodeSize * 0.28);

                fks.forEach((fk, i) => {
                    const angle = (i / fks.length) * Math.PI * 2;
                    const fx = node.x + Math.cos(angle) * orbitRadius;
                    const fy = node.y + 20; // slightly above parent
                    const fz = node.z + Math.sin(angle) * orbitRadius;

                    // FK ball mesh
                    const fkMesh = new THREE.Mesh(geoms.fkBall, fkMat.clone());
                    fkMesh.scale.set(fkBallSize, fkBallSize, fkBallSize);
                    fkMesh.position.set(fx, fy, fz);
                    fkMesh.userData = {
                        type: 'fk_ball',
                        fk,
                        parentId: node.id,
                        parentName: node.name || node.id,
                    };
                    group.add(fkMesh);

                    // Thin connector line from parent to FK ball
                    const lineGeo = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(node.x, node.y, node.z),
                        new THREE.Vector3(fx, fy, fz),
                    ]);
                    const line = new THREE.Line(lineGeo, lineMat.clone());
                    line.userData = { type: 'fk_connector' };
                    group.add(line);
                });
            });
        }

        // Add Bridge Edges (Sparse, or targeted if isolating)
        if (targetNode === null && schemaData?.edges) {
            let edgesToRender = schemaData.edges;

            // Apply isolation logic to filter edges FIRST before slicing
            if (isIsolating) {
                edgesToRender = schemaData.edges.filter(edge => {
                    const isSourceSelected = multiSelectedNodes.includes(edge.source);
                    const isTargetSelected = multiSelectedNodes.includes(edge.target);
                    return isSourceSelected || isTargetSelected;
                });
            }

            // Only slice if not isolating, or if there's an absurd amount of selected edges to prevent lag
            const edgeLimit = isIsolating ? 500 : 50;

            edgesToRender.slice(0, edgeLimit).forEach(edge => {
                const sNode = arrangedNodes.find(n => n.id === edge.source);
                const tNode = arrangedNodes.find(n => n.id === edge.target);

                if (sNode && tNode) {
                    const bridge = createLatentBridgeEdge(sNode, tNode, edge, edge.source, edge.target, true);
                    group.add(bridge);
                }
            });
        }

    }, [latentNodes, geoms, schemaData, multiSelectedNodes, showMultiConnections]);

    useEffect(() => {
        let frame;
        const animate = () => {
            frame = requestAnimationFrame(animate);
            const t = performance.now() * 0.001;
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
                    } else if (obj.userData.type === 'fk_ball') {
                        // Gentle pulse on FK balls
                        obj.material.emissiveIntensity = 0.9 + Math.sin(t * 2 + obj.position.x) * 0.4;
                    }
                });
            }
            if (controlsRef.current) controlsRef.current.update();
            if (composerRef.current) {
                composerRef.current.render();
            } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
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
            if (hits.length > 0) {
                const hit = hits[0].object;
                if (hit.userData.type === 'voxel') {
                    setHoveredVoxel(hit);
                    setHoveredFkBall(null);
                } else if (hit.userData.type === 'fk_ball') {
                    setHoveredVoxel(null);
                    setHoveredFkBall({ ...hit.userData, screenX: e.clientX, screenY: e.clientY });
                    renderer.domElement.style.cursor = 'pointer';
                } else {
                    setHoveredVoxel(null);
                    setHoveredFkBall(null);
                    renderer.domElement.style.cursor = 'default';
                }
            } else {
                setHoveredVoxel(null);
                setHoveredFkBall(null);
                renderer.domElement.style.cursor = 'default';
            }
        };

        const onCK = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(satellitesGroupRef.current.children, true);
            if (hits.length > 0) {
                const hitObj = hits[0].object;
                if (hitObj.userData.type === 'fk_ball') {
                    // FK ball click: keep tooltip visible, no satellite selection change
                    return;
                } else if (hitObj.userData.type === 'voxel') {
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
            onTimeChange={(v) => logger.debug('Time distortion:', v)}
            onZoomIn={() => cameraRef.current?.position.multiplyScalar(0.8)}
            onZoomOut={() => cameraRef.current?.position.multiplyScalar(1.2)}
            onZoomReset={() => {
                cameraRef.current?.position.set(40000, 20000, 40000);
                cameraRef.current?.lookAt(0, 0, 0);
            }}
            onClose={onClose}
            connectionId={connectionId}
        >
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

            {/* FK Ball Tooltip */}
            {hoveredFkBall && (
                <div style={{
                    position: 'fixed',
                    left: hoveredFkBall.screenX + 14,
                    top: hoveredFkBall.screenY - 10,
                    zIndex: 9000,
                    pointerEvents: 'none',
                    background: 'rgba(10,12,20,0.92)',
                    border: '1px solid rgba(251,191,36,0.5)',
                    borderRadius: 10,
                    padding: '8px 14px',
                    boxShadow: '0 0 16px rgba(251,191,36,0.2)',
                    backdropFilter: 'blur(12px)',
                    minWidth: 160,
                }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: 4 }}>
                        FK Relationship
                    </div>
                    <div style={{ fontSize: 11, color: '#fff', fontFamily: 'monospace', marginBottom: 2 }}>
                        <span style={{ color: '#94a3b8' }}>{hoveredFkBall.parentName}</span>
                        <span style={{ color: '#fbbf24', margin: '0 6px' }}>·</span>
                        <span style={{ color: '#fde68a' }}>{hoveredFkBall.fk?.column || '?'}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                        → <span style={{ color: '#a78bfa' }}>{hoveredFkBall.fk?.referenced_table || hoveredFkBall.fk?.target_table || 'unknown'}</span>
                    </div>
                </div>
            )}

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
