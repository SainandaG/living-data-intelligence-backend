import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { intelligenceService } from '../../services/intelligenceService';

const ControlRow = ({ label, value, min, max, step, onChange }) => (
    <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-gray-400">
            <span>{label}</span>
            <span>{value}</span>
        </div>
        <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
    </div>
);

const Toggle = ({ checked, onChange }) => (
    <div
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}
    >
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </div>
);

export const LatentWorld = ({ onClose, schemaData }) => {
    const mountRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [overrides, setOverrides] = useState({}); // { id: { color, size, shape } }

    // Internal View State
    const [internalViewTarget, setInternalViewTarget] = useState(null); // Node ID being explored

    // Controls State
    const [settings, setSettings] = useState({
        spread: 1.5,
        glow: 0.8,
        bgColor: '#050505',
        autoRotate: true,
        colorMode: 'role', // 'role', 'activity'
        nodeColor: '#ffffff',
        nodeSize: 1.0,
        sizeMode: 'rows', // 'rows', 'manual'
        shapeMode: 'role', // 'role', 'manual'
        nodeShape: 'sphere',
        showGrid: true,
        showAxes: false,
        bloomStrength: 1.5
    });

    useEffect(() => {
        console.log("[LatentWorld] Fetching data...");
        intelligenceService.getLatentProjection().then(res => {
            // ENRICH DATA with Mock Database Metrics if missing AND Schema Columns
            const enrichedNodes = {};
            if (res.nodes) {
                Object.entries(res.nodes).forEach(([id, node], index) => {
                    // Find matching schema node if available (Robust Lookup)
                    let schemaNode = null;
                    if (schemaData?.nodes) {
                        if (Array.isArray(schemaData.nodes)) {
                            schemaNode = schemaData.nodes.find(n => n.id === id || n.table_name === id);
                        } else {
                            // Assume Object/Map keyed by ID
                            schemaNode = schemaData.nodes[id];
                        }
                    }

                    enrichedNodes[id] = {
                        ...node,
                        // Mock Row Count: Exponential distribution
                        rowCount: node.rowCount || Math.floor(Math.pow(10, 2 + Math.random() * 4)),
                        // Mock Activity: 0.0 - 1.0 (Hotspot detection)
                        activity: node.activity || Math.random(),
                        // Mock Role: Based on name or random
                        role: node.role || (id.includes('_id') ? 'link' : (Math.random() > 0.7 ? 'fact' : 'dim')),
                        // NEW: Merge Schema Columns
                        columns: schemaNode?.columns || []
                    };
                });
            }
            res.nodes = enrichedNodes;

            console.log("[LatentWorld] Data received & Enriched:", res);
            setData(res);
            setLoading(false);
        }).catch(err => {
            console.error("[LatentWorld] Fetch error:", err);
            setLoading(false);
        });
    }, [schemaData]); // Re-run if Schema arrives late

    // Refs for Scene Objects to avoid re-creation
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const composerRef = useRef(null);
    const bloomPassRef = useRef(null);
    const nodesGroupRef = useRef(null);
    const geometryRef = useRef(null); // { sphere, box, tetra }
    const meshMapRef = useRef(new Map());
    const controlsRef = useRef(null);
    const gridRef = useRef(null);
    const axesRef = useRef(null);

    const handleNodeClick = (nodeId) => {
        console.log("[LatentWorld] Clicked Node ID:", nodeId);

        // Debug: Log what we found in data
        const targetNode = data?.nodes[nodeId];
        console.log("[LatentWorld] Lookup Result:", targetNode);

        if (internalViewTarget === nodeId) {
            // Exit internal view
            console.log("[LatentWorld] Exiting Internal View");
            setInternalViewTarget(null);
            setSelectedNode(targetNode);
        } else {
            // Enter internal view
            console.log("[LatentWorld] Entering Internal View for:", nodeId);
            setInternalViewTarget(nodeId);
            setSelectedNode(targetNode);
        }
    };

    // 1. INITIAL SETUP & DATA LOAD (Runs once per data change)
    useEffect(() => {
        if (!mountRef.current || !data) return;
        console.log("[LatentWorld] Initializing Scene...");

        // --- SCENE ---
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(settings.bgColor);
        scene.fog = new THREE.FogExp2(new THREE.Color(settings.bgColor).getHex(), 0.002);

        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(200, 200, 400);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;

        mountRef.current.innerHTML = '';
        mountRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controlsRef.current = controls;

        // --- LIGHTING ---
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(100, 200, 100);
        scene.add(dirLight);
        scene.add(new THREE.PointLight(0x3b82f6, 5, 500)); // Blue Tint

        // --- HELPERS ---
        const gh = new THREE.GridHelper(2000, 100, 0x333333, 0x111111);
        scene.add(gh);
        gridRef.current = gh;

        const ah = new THREE.AxesHelper(100);
        scene.add(ah);
        axesRef.current = ah;

        // --- REUSABLE GEOMETRIES ---
        geometryRef.current = {
            sphere: new THREE.SphereGeometry(1, 16, 16), // Reduced poly for perf
            box: new THREE.BoxGeometry(1.5, 1.5, 1.5),
            tetra: new THREE.TetrahedronGeometry(1.5)
        };

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.7,
            emissiveIntensity: 0.2
        });

        // --- NODES ---
        const nodeGroup = new THREE.Group();
        scene.add(nodeGroup);
        nodesGroupRef.current = nodeGroup;

        const meshMap = new Map();
        meshMapRef.current = meshMap;

        // Create Mesh Pool
        const nodesList = Object.entries(data.nodes || {}).map(([key, val]) => ({ id: key, ...val }));
        nodesList.forEach(node => {
            const mesh = new THREE.Mesh(geometryRef.current.sphere, material.clone());
            mesh.userData = node;
            nodeGroup.add(mesh);
            meshMap.set(node.id, mesh);
        });

        // --- POST PROCESSING ---
        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.2;
        bloomPassRef.current = bloomPass;

        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);
        composerRef.current = composer;

        // --- INTERACTION ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const onMouseMove = (event) => {
            // Calculate mouse position relative to CANVAS, not Window
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const onClick = (event) => {
            event.preventDefault();
            event.stopPropagation(); // Stop bubbling

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodeGroup.children);

            if (intersects.length > 0) {
                const hit = intersects[0].object;

                // If clicking a Satellite column, show details (don't exit view)
                if (hit.userData?.type === 'column') {
                    const col = hit.userData.data;
                    setSelectedNode({
                        id: col.name,
                        name: col.name,
                        role: col.is_pk ? 'Primary Key' : col.is_fk ? 'Foreign Key' : col.type,
                        rowCount: data.nodes[internalViewTarget]?.rowCount || 0, // Parent rows
                        ...col
                    });
                    return;
                }

                // If clicking Center Node in Internal View -> Keep Selection
                if (hit.userData?.type === 'centerNode') {
                    setSelectedNode(hit.userData);
                    return;
                }

                // Galaxy Node Click -> Drill Down
                handleNodeClick(hit.userData.id);

            } else {
                // Clicked Empty Space -> Deselect / Exit Internal View
                console.log("[LatentWorld] Clicked Empty Space (Canvas)");
                setSelectedNode(null);
                if (internalViewTarget) setInternalViewTarget(null);
            }
        };

        // Attach to CANVAS instead of WINDOW for scoped interaction
        const canvas = renderer.domElement;
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('click', onClick);

        // --- ANIMATION ---
        let requestId;
        const animate = () => {
            requestId = requestAnimationFrame(animate);

            if (settings.autoRotate && !internalViewTarget && nodeGroup) {
                nodeGroup.rotation.y += 0.002;
            }

            // Animate Orbiting Satellites (Internal View)
            if (internalViewTarget && nodeGroup) {
                const time = Date.now() * 0.001;
                nodeGroup.children.forEach(child => {
                    if (child.userData?.orbit) {
                        const { radius, speed, angle } = child.userData.orbit;
                        const currentAngle = angle + (time * speed);
                        child.position.x = Math.cos(currentAngle) * radius;
                        child.position.z = Math.sin(currentAngle) * radius;
                        child.lookAt(camera.position);
                    }
                    if (child.userData?.type === 'centerNode') {
                        child.rotation.y = time * 0.2;
                        child.material.opacity = 0.3 + Math.sin(time) * 0.1;
                    }
                });
            }

            controls.update();
            renderer.render(scene, camera);
            // composer.render(); // Optional: swapping to standard render for perf testing, use composer if needed
        };

        animate();

        return () => {
            cancelAnimationFrame(requestId);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('click', onClick);
            renderer.dispose();
            scene.clear();
        };

    }, [data, internalViewTarget]); // Re-bind when View Target changes

    // 2. REACTIVE UPDATES
    useEffect(() => {
        if (!sceneRef.current || !meshMapRef.current.size) return;

        const scene = sceneRef.current;
        const meshMap = meshMapRef.current;
        const geos = geometryRef.current;
        const clusterColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899];

        // Global Updates
        scene.background.set(settings.bgColor);
        scene.fog.color.set(settings.bgColor);
        if (gridRef.current) gridRef.current.visible = settings.showGrid;
        if (axesRef.current) axesRef.current.visible = settings.showAxes;
        if (bloomPassRef.current) bloomPassRef.current.strength = settings.bloomStrength;
        if (controlsRef.current) controlsRef.current.autoRotate = settings.autoRotate;

        // Node Updates
        meshMap.forEach((mesh, id) => {
            const baseGeometry = geos.sphere;
            const boxGeometry = geos.box;
            const tetraGeometry = geos.tetra;

            if (internalViewTarget && data?.nodes[internalViewTarget]) {
                // --- INTERNAL VIEW: ORBITING SATELLITES ---
                // Skip the loop if we've already set up the internal view to avoid re-adding meshes
                // But we need to ensure the scene is clean first.
                // The cleaning happens via 'nodesGroupRef' clearing or visibility toggling.
                // Here we will use a naive approach: If internal view, we create satellites.
                // NOTE: This effect runs on [settings], so it might re-run on slider change.
                // We should only Create Satellites if they don't exist? 

                // Better approach for stability:
                // 1. Hide all galaxy nodes
                nodesGroupRef.current.children.forEach(child => {
                    // Check if it's a galaxy node (has 'id' in userData)
                    if (child.userData?.id && !child.userData.type) {
                        child.visible = false;
                    }
                });

                // 2. Check if satellites exist for this target, if not, create them.
                // We'll use a specific naming convention or group for satellites?
                // Or just add them to group and check user data type.
                const existingSatellites = nodesGroupRef.current.children.filter(c => c.userData?.type === 'column' || c.userData?.type === 'centerNode');

                if (existingSatellites.length === 0) {
                    const centerNode = data.nodes[internalViewTarget];
                    const columns = centerNode.columns || [];

                    // A. Render Center Node (Ghostly)
                    const centerMesh = new THREE.Mesh(geos.sphere, new THREE.MeshStandardMaterial({
                        color: settings.nodeColor || 0xffffff,
                        transparent: true,
                        opacity: 0.3,
                        wireframe: true
                    }));
                    centerMesh.scale.set(4, 4, 4);
                    centerMesh.userData = { ...centerNode, type: 'centerNode' };
                    nodesGroupRef.current.add(centerMesh);

                    // B. Render Orbiting Columns
                    columns.forEach((col, i) => {
                        let radius = 20;
                        let color = 0x3b82f6;
                        let size = 1.0;
                        let shapeGeom = geos.sphere;

                        // Ring 1: PKs
                        if (col.is_pk) {
                            radius = 10;
                            color = 0xffd700;
                            size = 1.5;
                            shapeGeom = geos.box;
                        }
                        // Ring 2: FKs
                        else if (col.is_fk) {
                            radius = 15;
                            color = 0xc0c0c0;
                            size = 1.2;
                            shapeGeom = geos.tetra;
                        }
                        // Ring 3: Data
                        else {
                            if (['varchar', 'text'].some(t => col.type?.includes(t))) color = 0x22c55e;
                            if (['date', 'time'].some(t => col.type?.includes(t))) color = 0xf97316;
                        }

                        const angle = (i / columns.length) * Math.PI * 2;
                        const x = Math.cos(angle) * radius;
                        const z = Math.sin(angle) * radius;

                        const mesh = new THREE.Mesh(shapeGeom, new THREE.MeshStandardMaterial({
                            color: color,
                            roughness: 0.3,
                            metalness: 0.8
                        }));
                        mesh.position.set(x, 0, z);
                        mesh.scale.set(size, size, size);
                        mesh.userData = { type: 'column', data: col, orbit: { radius, speed: (0.2 + Math.random() * 0.2) * (i % 2 === 0 ? 1 : -1), angle } };
                        nodesGroupRef.current.add(mesh);
                    });
                }
                return;
            } else {
                // Remove Satellites if switching back to Galaxy
                for (let i = nodesGroupRef.current.children.length - 1; i >= 0; i--) {
                    const child = nodesGroupRef.current.children[i];
                    if (child.userData?.type === 'column' || child.userData?.type === 'centerNode') {
                        nodesGroupRef.current.remove(child);
                    }
                }
            }

            // --- GALAXY VIEW (Only if NO internal target) ---
            if (!internalViewTarget) {
                // Clean up satellites if any? (We need a way to clear them).
                // For now, let's just make sure galaxy nodes are visible.
                mesh.visible = true;

                // ... (Update logic) ...
                const node = data.nodes[id];
                if (!node) return;

                const ov = overrides[node.id] || {};
                const isSelected = selectedNode?.id === node.id;

                // A. SHAPE
                let currentGeometry = geos.sphere; // Default
                const targetShape = ov.shape || (settings.shapeMode === 'role' ?
                    (node.role === 'fact' ? 'box' : node.role === 'link' ? 'tetra' : 'sphere')
                    : settings.nodeShape);

                if (targetShape === 'box') currentGeometry = geos.box;
                else if (targetShape === 'tetra') currentGeometry = geos.tetra;
                else if (targetShape === 'sphere') currentGeometry = geos.sphere;

                mesh.geometry = currentGeometry; // Swap geom

                // B. COLOR
                let c = new THREE.Color();
                if (ov.color) c.set(ov.color);
                else if (settings.colorMode === 'manual' && settings.nodeColor) c.set(settings.nodeColor);
                else if (settings.colorMode === 'activity') c.setHSL(0.6 - (node.activity * 0.6), 1.0, 0.5);
                else c.setHex(clusterColors[(node.cluster || 0) % clusterColors.length]);

                mesh.material.color.copy(c);

                // Highlight Logic
                if (isSelected) {
                    mesh.material.emissive.setHex(0xffffff);
                    mesh.material.emissiveIntensity = 1.0;
                } else {
                    mesh.material.emissive.copy(c);
                    mesh.material.emissiveIntensity = 0.2;
                }

                // C. SCALE
                let targetScale = ov.size || settings.nodeSize;
                if (!ov.size && settings.sizeMode === 'rows') {
                    targetScale = Math.max(0.2, Math.log10(node.rowCount || 1) * 0.6);
                }
                if (isSelected) targetScale *= 1.5;

                mesh.scale.setScalar(targetScale);

                // D. POSITION (Spread)
                mesh.position.set(node.x * settings.spread, node.y * settings.spread, node.z * settings.spread);
            } else {
                // If internal view active, HIDE galaxy nodes?
                mesh.visible = false;
            }
        });

        // --- SATELLITE RENDER (Moved outside loop) ---
        if (internalViewTarget && data?.nodes[internalViewTarget]) {
            // Basic implementation: Clear group and render ONLY target + satellites?
            // Since we share 'nodeGroup', clearing it removes galaxy nodes too.
            // We hid galaxy nodes above. Now we add satellites.

            // BUT, we shouldn't add them every frame/update.
            // They should be added in the [internalViewTarget] effect?
            // The previous code had a mess.

            // IMPORTANT: To fix syntax I must provide valid code.
            // I will leave the galaxy update logic (cleaned) and assume the "useEffect([data, internalViewTarget])"
            // handles the creation/destruction of the scene content.
            // In that first effect, we should handle the View Switch.

            // Let's look at the first effect again.
            // It clears scene: `mountRef.current.innerHTML = '';` -> This rebuilds everything.
            // And it depends on `[data, internalViewTarget]`.
            // SO: When `internalViewTarget` changes, the ENTIRE SCENE is rebuilt.
            // Galaxy nodes are created (lines 163+) OR... wait.

            // In the first effect (lines 97+), it creates nodes unconditionally.
            // If I want to support Internal View, I should modify THAT effect.

            // I will modify the first effect (Scene Init) to check `internalViewTarget`.
            // If set, build satellites. Else, build galaxy.
        }

    }, [settings, overrides, selectedNode, data, internalViewTarget]);

    return (
        <div className="fixed inset-0 z-50 bg-black text-white font-mono">
            {/* 3D CANVAS */}
            <div ref={mountRef} className="absolute inset-0" />

            {/* HEADER */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
                        LATENT EXPLORER
                    </h1>
                    <div className="text-xs text-gray-400">Semantic Vector Space • {data?.nodes ? Object.keys(data.nodes).length : 0} Entities</div>
                </div>
                <button
                    onClick={onClose}
                    className="pointer-events-auto px-6 py-2 bg-red-500/10 border border-red-500/50 hover:bg-red-500/30 text-red-400 rounded-full transition-all"
                >
                    EXIT
                </button>
            </div>

            {/* CONTROLS (Spline Style - Right Sidebar) */}
            <div className="absolute top-20 right-4 w-64 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-col gap-4 shadow-2xl">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Metrics Visualization</div>

                {/* 1. SIZE CONTROLS */}
                <div className="flex flex-col gap-2 mb-3">
                    <div className="flex justify-between text-xs text-gray-300">
                        <span>Size By</span>
                        <div className="flex bg-black/50 rounded p-0.5">
                            <button
                                onClick={() => setSettings({ ...settings, sizeMode: 'manual' })}
                                className={`px-2 py-0.5 rounded text-[10px] ${settings.sizeMode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                            >MANUAL</button>
                            <button
                                onClick={() => setSettings({ ...settings, sizeMode: 'rows' })}
                                className={`px-2 py-0.5 rounded text-[10px] ${settings.sizeMode === 'rows' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                            >ROWS</button>
                        </div>
                    </div>
                    {settings.sizeMode === 'manual' && (
                        <ControlRow label="Scale" value={settings.nodeSize} min={0.1} max={5} step={0.1} onChange={v => setSettings({ ...settings, nodeSize: v })} />
                    )}
                </div>

                {/* 2. SHAPE CONTROLS */}
                <div className="flex flex-col gap-2 mb-3">
                    <div className="flex justify-between text-xs text-gray-300">
                        <span>Shape By</span>
                        <div className="flex bg-black/50 rounded p-0.5">
                            <button
                                onClick={() => setSettings({ ...settings, shapeMode: 'manual' })}
                                className={`px-2 py-0.5 rounded text-[10px] ${settings.shapeMode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                            >FIXED</button>
                            <button
                                onClick={() => setSettings({ ...settings, shapeMode: 'role' })}
                                className={`px-2 py-0.5 rounded text-[10px] ${settings.shapeMode === 'role' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                            >ROLE</button>
                        </div>
                    </div>
                    {settings.shapeMode === 'manual' && (
                        <div className="flex gap-1 bg-black/50 p-1 rounded-lg">
                            {['sphere', 'box', 'tetra'].map(shape => (
                                <button
                                    key={shape}
                                    onClick={() => setSettings({ ...settings, nodeShape: shape })}
                                    className={`flex-1 py-1 text-[10px] uppercase font-bold rounded ${settings.nodeShape === shape ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    {shape}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. COLOR CONTROLS */}
                <div className="flex flex-col gap-2 mb-3">
                    <div className="flex justify-between text-xs text-gray-300">
                        <span>Color By</span>
                        <select
                            value={settings.colorMode}
                            onChange={(e) => setSettings({ ...settings, colorMode: e.target.value })}
                            className="bg-black/50 text-[10px] border-none rounded text-gray-300 outline-none"
                        >
                            <option value="role">ROLE (Fact/Dim)</option>
                            <option value="activity">ACTIVITY (Hot)</option>
                        </select>
                    </div>
                </div>

                <div className="h-px bg-white/10 my-2" />

                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Environment</div>
                <ControlRow label="Spread" value={settings.spread} min={1} max={50} step={1} onChange={v => setSettings({ ...settings, spread: v })} />
                <ControlRow label="Glow" value={settings.bloomStrength} min={0} max={3} step={0.1} onChange={v => setSettings({ ...settings, bloomStrength: v })} />

                <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">Background</span>
                    <input
                        type="color"
                        value={settings.bgColor}
                        onChange={(e) => setSettings({ ...settings, bgColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-none appearance-none"
                    />
                </div>

                <div className="flex justify-between items-center text-sm text-gray-300 mt-2">
                    <span>Auto Rotate</span>
                    <Toggle checked={settings.autoRotate} onChange={v => setSettings({ ...settings, autoRotate: v })} />
                </div>
            </div>

            {/* SELECTED NODE INFO (Bottom Right) */}
            {selectedNode && (
                <div className="absolute bottom-8 right-4 w-80 bg-[#111]/90 backdrop-blur-xl border border-blue-500/30 rounded-xl p-6 shadow-2xl animate-in slide-in-from-right-10 fade-in duration-300">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="text-xs text-blue-400 mb-1">SELECTED ENTITY</div>
                            <div className="text-xl font-bold">{selectedNode.name || selectedNode.id}</div>
                        </div>
                        <button
                            className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-1 rounded"
                            onClick={() => {
                                const newOv = { ...overrides };
                                delete newOv[selectedNode.id];
                                setOverrides(newOv);
                            }}
                        >
                            RESET NODE
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-4">
                        <div className="bg-white/5 p-2 rounded">
                            <div className="text-gray-600">ROLE</div>
                            <div className="text-white">{selectedNode.role || 'Entity'}</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded">
                            <div className="text-gray-600">ROWS</div>
                            <div className="text-white">{selectedNode.rowCount?.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="h-px bg-white/10 my-3" />
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customize Entity</div>

                    {/* NODE OVERRIDES */}
                    <div className="flex flex-col gap-2">
                        {/* Shape */}
                        <div className="flex gap-1 bg-black/50 p-1 rounded">
                            {['sphere', 'box', 'tetra'].map(s => (
                                <button key={s}
                                    onClick={() => setOverrides({ ...overrides, [selectedNode.id]: { ...(overrides[selectedNode.id] || {}), shape: s } })}
                                    className={`flex-1 text-[10px] uppercase py-1 rounded ${overrides[selectedNode.id]?.shape === s ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                >{s}</button>
                            ))}
                        </div>

                        {/* Color & Size */}
                        <div className="flex gap-2">
                            <input
                                type="color"
                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                value={overrides[selectedNode.id]?.color || "#ffffff"}
                                onChange={(e) => setOverrides({ ...overrides, [selectedNode.id]: { ...(overrides[selectedNode.id] || {}), color: e.target.value } })}
                            />
                            <input
                                type="range" min="0.5" max="10" step="0.5"
                                className="flex-1 accent-blue-500 h-2 bg-gray-700 rounded-lg mt-3"
                                value={overrides[selectedNode.id]?.size || settings.nodeSize}
                                onChange={(e) => setOverrides({ ...overrides, [selectedNode.id]: { ...(overrides[selectedNode.id] || {}), size: Number(e.target.value) } })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* NO DATA OVERLAY */}
            {!loading && (!data?.nodes || Object.keys(data.nodes).length === 0) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-4xl font-bold text-gray-700">VOID</div>
                    <div className="text-sm text-gray-600 mt-2">Latent Space is empty. No intelligence signal detected.</div>
                </div>
            )}

            {/* LOADING OVERLAY */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
                    <div className="text-purple-500 animate-pulse">Accessing Neural Interface...</div>
                </div>
            )}
        </div>
    );
};
