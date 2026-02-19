import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
    OrbitControls,
    TransformControls,
    EffectComposer,
    RenderPass,
    UnrealBloomPass
} from 'three-stdlib';

// Glass Morphism Styles
const glassPanel = "bg-[rgba(24,17,20,0.7)] backdrop-blur-[12px] border border-white/10";
const glowCyan = "drop-shadow-[0_0_8px_rgba(0,245,255,0.6)]";
const glowGold = "drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]";
const glowPurple = "drop-shadow-[0_0_8px_rgba(191,0,255,0.6)]";
const glowPrimary = "drop-shadow-[0_0_12px_rgba(238,43,140,0.8)]";

const ControlRow = ({ label, value, min, max, step, onChange }) => (
    <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px] text-white/40 font-bold uppercase tracking-widest">
            <span>{label}</span>
            <span className="text-[#ee2b8c] font-bold">{typeof value === 'number' ? value.toFixed(2) : value}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#ee2b8c] transition-all" />
    </div>
);

const Toggle = ({ checked, onChange, label }) => (
    <div className="flex justify-between items-center text-[10px] text-white/40 font-bold uppercase tracking-widest">
        <span>{label}</span>
        <div onClick={() => onChange(!checked)} className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-[#ee2b8c]/50' : 'bg-white/10'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
        </div>
    </div>
);

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
    const [dataClusters, setDataClusters] = useState([]); // RENAMED: columns -> dataClusters
    const [selectedSatellite, setSelectedSatellite] = useState(null); // This now selects a CLUSTER
    const [intelligence, setIntelligence] = useState(null);
    const [overrides, setOverrides] = useState({});
    const [hoveredId, setHoveredId] = useState(null);
    const [webglError, setWebglError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const [settings, setSettings] = useState({
        bgColor: '#010101',
        glow: 3.5,
        speed: 0, // STATIC: Speed set to 0
        autoRotate: false, // STATIC: No auto-rotate
        levitation: true,
        sizeBy: 'ROWS',
        editMode: false,
        showTimeTravel: true
    });

    // TIME TRAVEL STATE


    // HOVER & SELECTION STATE
    const [hoveredVoxel, setHoveredVoxel] = useState(null);
    const [selectedVoxel, setSelectedVoxel] = useState(null);
    const [selectionMode, setSelectionMode] = useState('cluster'); // 'cluster' | 'voxel'

    const geoms = useMemo(() => ({
        sphere: new THREE.SphereGeometry(1, 32, 32),
        box: new THREE.BoxGeometry(1.6, 1.6, 1.6),
        bar: new THREE.BoxGeometry(2, 4, 2),
        octa: new THREE.OctahedronGeometry(1.6),
        tetra: new THREE.TetrahedronGeometry(1.6),
        pillar: new THREE.CylinderGeometry(5, 5, 140, 6),
        pedestal: new THREE.TorusGeometry(3.5, 0.12, 16, 64)
    }), []);

    // 1. DATA INITIALIZATION (FETCH REAL CLUSTERS FROM API)
    useEffect(() => {
        if (!targetNode || !connectionId) return;

        // Start loading
        setLoading(true);
        setError(null);

        const fetchClusters = async () => {
            try {
                // Fetch real clusters from backend
                const response = await fetch(`/api/internal-node/clusters/${connectionId}/${targetNode.name}`);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // Check if we got real data or fallback
                if (data.status === 'success' && data.clusters && data.clusters.length > 0) {
                    console.log(`✅ Loaded ${data.clusters.length} real clusters for ${targetNode.name}`);
                    setDataClusters(data.clusters);

                    // Show warning if fallback was used
                    if (data.error) {
                        console.warn(`⚠️ Partial data: ${data.error}`);
                    }
                } else {
                    // API returned error, use fallback
                    console.warn(`⚠️ Using fallback clusters: ${data.error || 'No clusters returned'}`);
                    setDataClusters(getFallbackClusters());
                }

            } catch (err) {
                // Network error or API unavailable
                console.error('❌ Failed to fetch clusters:', err);
                setError(`Unable to load cluster data: ${err.message}`);

                // Graceful degradation: use mock data
                setDataClusters(getFallbackClusters());
            } finally {
                setLoading(false);
            }
        };

        fetchClusters();
    }, [targetNode, connectionId]);

    // No mock fallback — show empty state when API fails
    const getFallbackClusters = () => {
        return [];
    };





    // NEW: FETCH GRANULAR INTELLIGENCE
    // NEW: FETCH GRANULAR INTELLIGENCE
    useEffect(() => {
        if (!selectedSatellite || !connectionId || !targetNode) {
            setIntelligence(null);
            return;
        }

        // Skip intelligence fetch for Clusters (they are not columns)
        // Clusters typically have 'count' and 'risk' properties, while columns might not
        // or we check if name matches a known cluster type
        const isCluster = selectedSatellite.type === 'cluster' ||
            ['Identity', 'Temporal', 'Numeric', 'Text', 'Reference', 'Boolean', 'Analysis Failed'].includes(selectedSatellite.name);

        if (isCluster) {
            console.log("[LatentWorld] Selected item is a cluster, skipping column intelligence fetch.");
            setIntelligence(null);
            return;
        }

        const fetchIntel = async () => {
            try {
                // Ensure we are fetching for a valid column
                const resp = await fetch(`/api/drilldown/${connectionId}/column-intelligence/${targetNode.name}/${selectedSatellite.name}`);

                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                }

                const data = await resp.json();
                setIntelligence(data.intelligence);

            } catch (err) {
                console.error("Failed to fetch column intelligence:", err);
                // Set distinct error state, but don't break the UI
                setIntelligence({
                    error: true,
                    message: err.message,
                    impact: [], // Ensure array exists to prevent .map crash
                    complexity_score: 0
                });
            }
        };


        fetchIntel();
    }, [selectedSatellite, connectionId, targetNode]);

    // 2. STABLE ENGINE SETUP
    useEffect(() => {
        if (!mountRef.current || loading) return;

        let frame;
        let renderer, composer;

        try {
            const width = window.innerWidth;
            const height = window.innerHeight;

            const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
            camera.position.set(150, 100, 150);
            cameraRef.current = camera;

            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
                failIfMajorPerformanceCaveat: false
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            mountRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            const onContextLost = (e) => {
                e.preventDefault();
                console.warn("⚠️ WebGL Context Lost. Attempting to restore...");
                // Don't show error screen immediately, let Three.js try to recover or just re-init on next mount
                // setWebglError("CRITICAL: WebGL Context Lost. Reallocating resources..."); 
            };
            renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

            const onContextRestored = () => {
                console.log("✅ WebGL Context Restored.");
                setWebglError(null);
                setRetryCount(c => c + 1); // Trigger re-render
            };
            renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

            const orbit = new OrbitControls(camera, renderer.domElement);
            orbit.enableDamping = true;
            controlsRef.current = orbit;

            const transform = new TransformControls(camera, renderer.domElement);
            transform.addEventListener('dragging-changed', (e) => orbit.enabled = !e.value);
            transform.addEventListener('change', () => {
                if (transform.object) {
                    const o = transform.object;
                    setOverrides(prev => ({
                        ...prev,
                        [o.userData.id]: {
                            ...(prev[o.userData.id] || {}),
                            pos: o.position.clone()
                        }
                    }));
                }
            });
            transformRef.current = transform;
            sceneRef.current.add(transform);

            // PERFORMANCE OPTIMIZATION: Bloom removed to prevent crash
            // composer = new EffectComposer(renderer);

            sceneRef.current.add(satellitesGroupRef.current);
            sceneRef.current.add(new THREE.AmbientLight(0xffffff, 0.4));
            const sky = new THREE.PointLight(0x00f2ff, 1000, 300); sky.position.set(0, 150, 0);
            sceneRef.current.add(sky);

            const grid = new THREE.GridHelper(600, 50, 0x111111, 0x080808);
            grid.position.y = -70;
            sceneRef.current.add(grid);

            // Animation loop removed - now handled by dedicated useEffect hook below

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
                // renderer.forceContextLoss(); // CAUSES CRASH ON RAPID REMOUNT - REMOVED
                if (renderer.domElement && mountRef.current) {
                    try { mountRef.current.removeChild(renderer.domElement); } catch (e) { /* ignore */ }
                }
            }
            sceneRef.current.clear();
        };
    }, [loading, retryCount]);

    // 3. STRUCTURAL BUILD LAYER (CLUSTERS)
    useEffect(() => {
        if (!dataClusters.length || !sceneRef.current) return;

        const group = satellitesGroupRef.current;
        group.clear();

        const pillarMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, wireframe: true, transparent: true, opacity: 0.4 });
        const pillarCoreMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 1, roughness: 0 });
        const pillar = new THREE.Mesh(geoms.pillar, pillarMat);
        const pillarCore = new THREE.Mesh(geoms.pillar, pillarCoreMat);
        pillarCore.scale.set(0.95, 1, 0.95);
        pillar.add(pillarCore);
        pillar.userData = { type: 'core' };
        group.add(pillar);

        // GRID LAYOUT - TINY BOXES, EACH COLOR IN OWN REGION
        const voxelSize = 1.5; // Tiny boxes
        const gap = 0.8;

        // Calculate grid layout for clusters
        const gridSpan = 200; // Very large grid
        const clustersPerRow = 3; // 3 clusters per row
        const regionSize = gridSpan / clustersPerRow;

        dataClusters.forEach((cluster, clusterIndex) => {
            const neonColor = cluster.color;

            // Calculate which region this cluster occupies
            const regionCol = clusterIndex % clustersPerRow;
            const regionRow = Math.floor(clusterIndex / clustersPerRow);

            // Region boundaries
            const regionStartX = regionCol * regionSize - gridSpan / 2;
            const regionStartZ = regionRow * regionSize - gridSpan / 2;

            // Calculate how many voxels for this cluster based on data
            // FIX: Backend returns column count (small), not row count. Use directly.
            const rawCount = cluster.count || 0;
            // Cap at 200 per cluster for performance, min 5 for visibility
            const dataBasedVoxelCount = Math.min(200, Math.max(5, rawCount));

            // Calculate grid dimensions for this cluster
            const voxelsPerRow = Math.ceil(Math.sqrt(dataBasedVoxelCount));
            const voxelsPerCol = Math.ceil(dataBasedVoxelCount / voxelsPerRow);

            let voxelCount = 0;

            // Create grid of tiny boxes in this cluster's region
            for (let row = 0; row < voxelsPerCol && voxelCount < dataBasedVoxelCount; row++) {
                for (let col = 0; col < voxelsPerRow && voxelCount < dataBasedVoxelCount; col++) {

                    const mat = new THREE.MeshStandardMaterial({
                        color: neonColor,
                        emissive: neonColor,
                        emissiveIntensity: 1.2,
                        metalness: 0.8,
                        roughness: 0.3,
                        transparent: true,
                        opacity: 0.85
                    });

                    const voxel = new THREE.Mesh(geoms.box, mat);
                    voxel.scale.set(0, 0, 0); // Start hidden (Animated in loop)

                    // Position within cluster's region
                    const worldX = regionStartX + (col * (voxelSize + gap));
                    const worldZ = regionStartZ + (row * (voxelSize + gap));

                    voxel.position.set(
                        worldX,
                        voxelSize / 2,
                        worldZ
                    );

                    // Assign birth time based on position
                    const birthTime = ((row * voxelsPerRow + col) / dataBasedVoxelCount) * 90;

                    // USE REAL ROW DATA IF AVAILABLE (From sample_rows)
                    let txValue = '0.00';
                    let txTime = new Date().toISOString();
                    let txType = cluster.name || 'Generic';
                    let rowData = null;

                    // Get row cyclicly if we have samples
                    if (dataClusters.sample_rows && dataClusters.sample_rows.length > 0) {
                        const rowIndex = voxelCount % dataClusters.sample_rows.length;
                        rowData = dataClusters.sample_rows[rowIndex];
                    }

                    if (rowData) {
                        try {
                            // IMPROVED HEURISTIC: Handle string-encoded numbers (common in JSON)
                            // Prioritize columns with 'Amount', 'Price', 'Total', 'Cost' in name
                            const numericKeys = Object.keys(rowData).filter(k => {
                                const val = rowData[k];
                                const isNum = !isNaN(parseFloat(val)) && isFinite(val) && !k.toLowerCase().includes('id') && !k.toLowerCase().includes('key');
                                return isNum;
                            });

                            // Sort keys to prefer financial terms
                            numericKeys.sort((a, b) => {
                                const scoreA = (a.toLowerCase().includes('amount') || a.toLowerCase().includes('total') || a.toLowerCase().includes('price')) ? 1 : 0;
                                const scoreB = (b.toLowerCase().includes('amount') || b.toLowerCase().includes('total') || b.toLowerCase().includes('price')) ? 1 : 0;
                                return scoreB - scoreA;
                            });

                            const dateKeys = Object.keys(rowData).filter(k =>
                                !isNaN(Date.parse(rowData[k])) && typeof rowData[k] !== 'number'
                            );

                            if (numericKeys.length > 0) txValue = Number(rowData[numericKeys[0]]).toFixed(2);
                            else txValue = '0.00'; // No numeric data available

                            if (dateKeys.length > 0) txTime = rowData[dateKeys[0]];
                            else txTime = new Date().toISOString();

                            txType = cluster.name;
                        } catch (e) {
                            txValue = '0.00'; // Parse error — no data
                        }
                    } else {
                        // No row data available
                        txValue = '0.00';
                        txTime = new Date().toISOString();
                    }

                    voxel.userData = {
                        id: `${cluster.name}_voxel_${voxelCount}`,
                        type: 'voxel',
                        clusterId: cluster.name,
                        clusterData: cluster,
                        birthTime: birthTime,
                        baseScale: 1,
                        voxelIndex: voxelCount,
                        regionX: regionCol,
                        regionZ: regionRow,
                        // Transaction Details
                        txValue: txValue,
                        txTime: txTime,
                        txType: txType,
                        _rawData: rowData
                    };

                    group.add(voxel);
                    voxelCount++;
                }
            }
        });

        // NO GRID LINES - REMOVED
    }, [dataClusters, settings.sizeBy, overrides, geoms]);

    // 4. ANIMATION LOOP (UPDATED FOR VOXELS & TRANSACTIONS)
    useEffect(() => {
        let frame;
        const animate = () => {
            frame = requestAnimationFrame(animate);

            if (satellitesGroupRef.current) {
                satellitesGroupRef.current.children.forEach((obj, i) => {
                    // VOXEL ANIMATION (Hover/Selection & Entrance)
                    if (obj.userData.type === 'voxel') {
                        // ENTRANCE ANIMATION: Scale up from 0 to 1
                        if (obj.scale.x < 1) {
                            const speed = 0.1 + (i % 5) * 0.02; // Varied speed
                            obj.scale.addScalar(speed);
                            if (obj.scale.x > 1) obj.scale.set(1, 1, 1);
                        }

                        // HOVER FEEDBACK: Brighten and elevate
                        if (hoveredVoxel === obj) {
                            obj.material.emissiveIntensity = 2.5;
                            obj.position.y = obj.userData.baseY + 3; // Elevate more
                            // Gentle rotation for inspection
                            obj.rotation.y += 0.05;
                            obj.rotation.x = Math.sin(Date.now() * 0.005) * 0.2;
                        } else {
                            obj.material.emissiveIntensity = 1.2;
                            // Store base Y if not stored
                            if (obj.userData.baseY === undefined) {
                                obj.userData.baseY = obj.position.y;
                            }
                            // Smooth return to base
                            obj.position.y += (obj.userData.baseY - obj.position.y) * 0.1;
                            obj.rotation.set(0, 0, 0); // Reset rotation
                        }

                        // SELECTION FEEDBACK: Pulse
                        if (selectedVoxel && selectedVoxel.id === obj.userData.id) {
                            obj.material.emissiveIntensity = 2.0 + Math.sin(Date.now() * 0.01);
                        }
                    }

                    // PILLAR/PEDESTAL SYNC (Legacy support, though not primary focus)
                    if (obj.userData.type === 'pedestal') {
                        // ... existing logic ...
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
    }, [settings.levitation, selectedSatellite, overrides, hoveredVoxel, selectedVoxel]);

    // 5. OPTICS & SYNC LAYER
    useEffect(() => {
        if (sceneRef.current) sceneRef.current.background = new THREE.Color(settings.bgColor);
        if (bloomPassRef.current) bloomPassRef.current.strength = settings.glow;
        if (controlsRef.current) controlsRef.current.autoRotate = settings.autoRotate;

        if (selectedSatellite && settings.editMode && transformRef.current) {
            const mesh = satellitesGroupRef.current.children.find(o => o.userData.id === selectedSatellite.name && o.userData.type === 'satellite');
            if (mesh) transformRef.current.attach(mesh);
        } else if (transformRef.current) {
            transformRef.current.detach();
        }
    }, [settings.bgColor, settings.glow, settings.autoRotate, selectedSatellite, settings.editMode]);

    // 5. INTERACTION SYNC
    useEffect(() => {
        if (!rendererRef.current) return;
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // MOUSE MOVE HANDLER FOR HOVER
        const onMM = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(satellitesGroupRef.current.children, true);

            let newHoveredVoxel = null;
            if (hits.length > 0) {
                const hitObj = hits[0].object;
                if (hitObj.userData.type === 'voxel') {
                    newHoveredVoxel = hitObj;
                }
            }

            setHoveredVoxel(newHoveredVoxel);
        };

        // CLICK HANDLER
        const onCK = (e) => {
            if (transformRef.current?.dragging) return;
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(satellitesGroupRef.current.children, true); // Recursive
            if (hits.length > 0) {
                const hitObj = hits[0].object;

                // Check if we hit a voxel
                if (hitObj.userData.type === 'voxel') {
                    // Clicked on individual voxel - show voxel-specific data
                    setSelectedVoxel({
                        ...hitObj.userData,
                        // Ensure transaction details are passed
                        txValue: hitObj.userData.txValue || '0.00',
                        txTime: hitObj.userData.txTime || new Date().toISOString(),
                        txType: hitObj.userData.txType || 'Transaction'
                    });
                    setSelectionMode('voxel');
                    setSelectedSatellite(hitObj.userData.clusterData); // Keep cluster context
                } else {
                    // Clicked on cluster or other object
                    setSelectedVoxel(null);
                    setSelectionMode('cluster');

                    if (hitObj.userData.type === 'cluster') {
                        setSelectedSatellite(hitObj.userData.data);
                    } else {
                        // Try to find parent cluster
                        let parent = hitObj.parent;
                        while (parent && parent.userData.type !== 'cluster') {
                            parent = parent.parent;
                        }
                        if (parent && parent.userData.type === 'cluster') {
                            setSelectedSatellite(parent.userData.data);
                        }
                    }
                }
            } else {
                // Clicked empty space - clear selection
                setSelectedSatellite(null);
                setSelectedVoxel(null);
                setSelectionMode('cluster');
            }
        };

        const canvas = renderer.domElement;
        canvas.addEventListener('mousemove', onMM);
        canvas.addEventListener('click', onCK);
        return () => {
            canvas.removeEventListener('mousemove', onMM);
            canvas.removeEventListener('click', onCK);
        };
    }, [loading, webglError]);

    if (loading) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#010101] text-white font-mono overflow-hidden select-none">
            <div ref={mountRef} className="absolute inset-0 z-0" />

            {/* Error Overlay */}
            {webglError && (
                <div className="absolute inset-0 z-[10020] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center gap-8 text-center px-12">
                    <div className="w-24 h-24 rounded-full border-4 border-red-500/50 flex items-center justify-center animate-pulse">
                        <span className="text-4xl">⚠️</span>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-red-500 italic">Core Buffer Overload</h2>
                        <button onClick={() => setRetryCount(prev => prev + 1)} className="px-8 py-3 bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-xl">Force Engine Reboot</button>
                    </div>
                </div>
            )}

            {/* Top Navigation Bar - Glass Morphism */}
            <div className="absolute top-8 left-8 right-8 flex items-start justify-between z-[10010]">
                {/* Left: Back Button + Title */}
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className={`group p-4 ${glassPanel} rounded-[2rem] hover:bg-[rgba(238,43,140,0.1)] transition-all`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ee2b8c] flex items-center justify-center text-white font-black italic">←</div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">Topology View</span>
                        </div>
                    </button>
                    <div className="flex flex-col border-l border-white/10 pl-6 space-y-1">
                        <h1 className="text-white text-sm font-bold tracking-[0.2em] uppercase opacity-80">Neural Map v1.0.2</h1>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] text-white/50 font-medium uppercase tracking-tighter">Latent Space Online</span>
                        </div>
                    </div>
                </div>

                {/* Right: System Load Widget */}
                <div className={`${glassPanel} px-4 py-3 rounded-lg flex flex-col items-end min-w-[120px]`}>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 font-bold">CLUSTERS</span>
                        <span className="text-xs text-[#ee2b8c] font-bold">{dataClusters.length}</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 mt-2 rounded-full overflow-hidden">
                        <div className="h-full bg-[#ee2b8c]" style={{ width: `${Math.min(dataClusters.length * 10, 100)}%` }}></div>
                    </div>
                    <div className="flex gap-1 mt-2">
                        <div className="w-1 h-2 bg-[#ee2b8c]/60 rounded-full"></div>
                        <div className="w-1 h-2 bg-[#ee2b8c]/40 rounded-full"></div>
                        <div className="w-1 h-2 bg-white/10 rounded-full"></div>
                        <div className="w-1 h-2 bg-white/10 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Global Workshop Sidebar - Glass Morphism */}
            <div className="absolute top-32 right-8 w-72 flex flex-col gap-6 z-[10005]">
                <div className={`${glassPanel} rounded-[2.5rem] p-6 space-y-7 shadow-2xl`}>
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00F5FF]">Workbench</span>
                    </div>

                    <div className="bg-[#00F5FF]/10 p-5 rounded-3xl border border-[#00F5FF]/20 mb-2">
                        <Toggle label="Architecture Mode" checked={settings.editMode} onChange={v => setSettings({ ...settings, editMode: v })} />
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-3">
                            <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest text-center block">Global Height Balance</span>
                            <div className="flex bg-white/5 p-1 rounded-2xl gap-1 border border-white/5">
                                {['UNIFORM', 'ROWS'].map(m => (
                                    <button key={m} onClick={() => setSettings({ ...settings, sizeBy: m })} className={`flex-1 py-2 rounded-xl text-[9px] font-black transition-all ${settings.sizeBy === m ? 'bg-[#ee2b8c] text-white shadow-lg shadow-[#ee2b8c]/30' : 'text-gray-500 hover:text-white'}`}>{m}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`${glassPanel} rounded-[2.5rem] p-8 space-y-7 shadow-2xl`}>
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#BF00FF]">Optical Lab</span>
                    </div>
                    <ControlRow label="Neon Intensity" value={settings.glow} min={0} max={6} step={0.1} onChange={v => setSettings({ ...settings, glow: v })} />
                    <div className="flex justify-between items-center text-[10px] text-white/40 font-bold uppercase tracking-widest">
                        <span>Chamber Tint</span>
                        <input type="color" value={settings.bgColor} onChange={e => setSettings({ ...settings, bgColor: e.target.value })} className="w-10 h-6 bg-transparent border-none cursor-pointer rounded-lg shadow-inner" />
                    </div>
                    <Toggle label="Levitation" checked={settings.levitation} onChange={v => setSettings({ ...settings, levitation: v })} />
                </div>
            </div>

            {/* Predictive Inspector HUD (Compact V16) */}
            {selectedSatellite && (
                <div className="absolute bottom-8 right-8 w-96 bg-black/90 backdrop-blur-[80px] border border-cyan-500/20 rounded-[3rem] p-8 shadow-[0_0_100px_rgba(0,0,0,1)] z-[10010] flex flex-col gap-6 animate-in fade-in slide-in-from-right-5">
                    <div className="flex justify-between items-center">
                        <div className="space-y-0.5 overflow-hidden">
                            <h2 className="text-3xl font-black tracking-tighter leading-none text-white italic truncate max-w-[18rem] uppercase" title={selectedSatellite.name}>{selectedSatellite.name}</h2>
                            <span className="text-[8px] text-cyan-400 font-black uppercase tracking-[0.2em] inline-flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_cyan] animate-pulse" />
                                Analyzing Sequence
                            </span>
                        </div>
                        <button onClick={() => setSelectedSatellite(null)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 border border-white/5 transition-colors">✕</button>
                    </div>

                    {/* NEON PALETTE (Color Picker) */}
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">Brand Color</span>
                        </div>
                        <input
                            type="color"
                            value={overrides[selectedSatellite.name]?.color || selectedSatellite.color}
                            onChange={e => setOverrides({ ...overrides, [selectedSatellite.name]: { ...(overrides[selectedSatellite.name] || {}), color: e.target.value } })}
                            className="w-12 h-6 bg-transparent border-none cursor-pointer rounded-lg shadow-lg"
                        />
                    </div>

                    {/* DATA BLUEPRINT (Impact & Flow) */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-6">
                        <div className="flex justify-between items-end">
                            <div className="space-y-2.5">
                                <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest">Blueprint Signature</span>
                                <span className="text-sm font-black text-cyan-400 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_cyan]" />
                                    {selectedSatellite.data_type || 'CLUSTER'}
                                    {selectedSatellite.tags && selectedSatellite.tags.map(t => (
                                        <span key={t} className="ml-2 px-1.5 py-0.5 bg-white/5 text-[10px] text-white/40 rounded border border-white/5">{t}</span>
                                    ))}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest">Entry Volume</span>
                                <span className="text-sm font-black text-purple-400">{(selectedSatellite.count || 0).toLocaleString()} <span className="text-[9px] opacity-40 italic">Events</span></span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest mb-3 italic">Downstream Pulse</span>
                            <div className="flex flex-wrap gap-2.5">
                                {intelligence && intelligence.impact ? (
                                    intelligence.impact.map((node, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-black rounded-lg border border-cyan-500/20 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:bg-cyan-500/20 transition-colors uppercase tracking-tight">{node}</span>
                                    ))
                                ) : (
                                    (selectedSatellite.impact && selectedSatellite.impact.length > 0) ? selectedSatellite.impact.map((node, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-black rounded-lg border border-cyan-500/20">{node}</span>
                                    )) : <span className="text-[11px] text-gray-700 font-black uppercase italic tracking-widest">Isolated System Node</span>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">


                            {intelligence && (
                                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest italic">Computed Complexity</span>
                                    <span className="text-xs font-black text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                                        {intelligence.complexity_score.toFixed(1)} <span className="text-[9px] opacity-60">G²</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* PRECISION CONTROLS */}
                        <div className="bg-white/5 rounded-2xl p-5 border border-white/5 space-y-4">
                            <ControlRow
                                label="Extrusion"
                                value={overrides[selectedSatellite.name]?.height || (settings.sizeBy === 'ROWS' ? 2 + (Math.log10((selectedSatellite.rows || 0) / 1000 + 1) * 3) : 4)}
                                min={1} max={40} step={0.5}
                                onChange={v => setOverrides({ ...overrides, [selectedSatellite.name]: { ...(overrides[selectedSatellite.name] || {}), height: v } })}
                            />
                            {(overrides[selectedSatellite.name]?.pos || overrides[selectedSatellite.name]?.height || overrides[selectedSatellite.name]?.color) && (
                                <button onClick={() => { const n = { ...overrides }; delete n[selectedSatellite.name]; setOverrides(n); }} className="w-full py-2 bg-red-500/20 text-red-500 text-[8px] font-black rounded-xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">SNAP TO DEFAULT</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* VOXEL MICRO-PANEL (Individual Voxel Details) */}
            {selectionMode === 'voxel' && selectedVoxel && (
                <div className="absolute bottom-8 left-8 w-96 bg-black/90 backdrop-blur-[80px] border border-purple-500/20 rounded-[3rem] p-8 shadow-[0_0_100px_rgba(0,0,0,1)] z-[10010] flex flex-col gap-6 animate-in fade-in slide-in-from-left-5">
                    <div className="flex justify-between items-center">
                        <div className="space-y-0.5">
                            <h2 className="text-2xl font-black tracking-tighter leading-none text-white italic uppercase">📍 Voxel Details</h2>
                            <span className="text-[8px] text-purple-400 font-black uppercase tracking-[0.2em] inline-flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_purple] animate-pulse" />
                                Micro-Level Analysis
                            </span>
                        </div>
                        <button onClick={() => { setSelectedVoxel(null); setSelectionMode('cluster'); }} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 border border-white/5 transition-colors">✕</button>
                    </div>

                    {/* Voxel Position & Cluster */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest">Grid Position</span>
                                <span className="text-sm font-black text-purple-400">[{selectedVoxel.regionX}, {selectedVoxel.regionZ}] • Voxel #{selectedVoxel.voxelIndex}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest">Cluster</span>
                                <span className="text-sm font-black text-cyan-400">{selectedVoxel.clusterId}</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest mb-2">Timestamp</span>
                            <span className="text-xs font-mono text-white/80">
                                {new Date(selectedVoxel.txTime).toLocaleString()}
                            </span>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest mb-2">Transaction Value</span>
                            <span className="text-2xl font-black text-purple-400">${selectedVoxel.txValue}</span>
                        </div>
                    </div>

                    {/* Voxel-Level Histogram (Simplified) */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest mb-4">Hourly Activity</span>
                        <div className="h-16 flex items-end justify-between gap-0.5">
                            {Array.from({ length: 12 }, (_, i) => {
                                const value = 20 + Math.sin(i * 0.5 + selectedVoxel.voxelIndex) * 15 + Math.random() * 10;
                                return (
                                    <div key={i} className="group relative flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-t-sm" style={{ height: `${Math.min(100, value)}%` }}>
                                        <div className="absolute bottom-0 w-full bg-purple-400 h-full opacity-60 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* View Full Cluster Button */}
                    <button
                        onClick={() => setSelectionMode('cluster')}
                        className="w-full py-3 bg-cyan-500/20 text-cyan-400 text-[10px] font-black rounded-xl border border-cyan-500/20 hover:bg-cyan-500 hover:text-white transition-all uppercase tracking-wider"
                    >
                        View Full Cluster
                    </button>
                </div>
            )}

            {/* COLOR LEGEND (Bottom-Left) */}
            <div className="absolute bottom-8 left-8 flex flex-col gap-2 z-[10005]">
                <div className="flex gap-3">
                    <div className={`${glassPanel} px-3 py-1.5 rounded-full flex items-center gap-2`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" style={{ filter: glowGold }}></div>
                        <span className="text-[10px] font-bold tracking-wider">VIP (GOLD)</span>
                    </div>
                    <div className={`${glassPanel} px-3 py-1.5 rounded-full flex items-center gap-2`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00F5FF]" style={{ filter: glowCyan }}></div>
                        <span className="text-[10px] font-bold tracking-wider">HF (CYAN)</span>
                    </div>
                    <div className={`${glassPanel} px-3 py-1.5 rounded-full flex items-center gap-2`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#BF00FF]" style={{ filter: glowPurple }}></div>
                        <span className="text-[10px] font-bold tracking-wider">ANOMALY (PURPLE)</span>
                    </div>
                </div>
            </div>

            {/* ZOOM CONTROLS (Right Side) */}
            <div className="absolute right-8 bottom-32 flex flex-col gap-4 z-[10005]">
                <button
                    onClick={() => {
                        if (cameraRef.current) {
                            cameraRef.current.position.multiplyScalar(0.8);
                        }
                    }}
                    className={`${glassPanel} w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-[#ee2b8c]/20 transition-all text-xl font-bold`}
                >
                    +
                </button>
                <button
                    onClick={() => {
                        if (cameraRef.current) {
                            cameraRef.current.position.multiplyScalar(1.2);
                        }
                    }}
                    className={`${glassPanel} w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-[#ee2b8c]/20 transition-all text-xl font-bold`}
                >
                    −
                </button>
                <button
                    onClick={() => {
                        if (cameraRef.current) {
                            cameraRef.current.position.set(150, 100, 150);
                            cameraRef.current.lookAt(0, 0, 0);
                        }
                    }}
                    className={`${glassPanel} w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-[#ee2b8c]/20 transition-all text-xl font-bold`}
                >
                    ⌖
                </button>
            </div>


        </div>
    );
};
