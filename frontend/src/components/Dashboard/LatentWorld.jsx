import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
    OrbitControls,
    TransformControls,
    EffectComposer,
    RenderPass,
    UnrealBloomPass
} from 'three-stdlib';

const ControlRow = ({ label, value, min, max, step, onChange }) => (
    <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[9px] text-gray-400 font-black uppercase tracking-widest">
            <span>{label}</span>
            <span className="text-cyan-400">{typeof value === 'number' ? value.toFixed(2) : value}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-cyan-500 transition-all hover:accent-cyan-400" />
    </div>
);

const Toggle = ({ checked, onChange, label }) => (
    <div className="flex justify-between items-center text-[9px] text-gray-500 font-black uppercase tracking-widest">
        <span>{label}</span>
        <div onClick={() => onChange(!checked)} className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-cyan-500/50' : 'bg-white/10'}`}>
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
    const [columns, setColumns] = useState([]);
    const [selectedSatellite, setSelectedSatellite] = useState(null);
    const [intelligence, setIntelligence] = useState(null);
    const [overrides, setOverrides] = useState({});
    const [hoveredId, setHoveredId] = useState(null);
    const [webglError, setWebglError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const [settings, setSettings] = useState({
        bgColor: '#010101',
        glow: 3.5,
        speed: 0.04,
        autoRotate: true,
        levitation: true,
        sizeBy: 'ROWS',
        editMode: false
    });

    const geoms = useMemo(() => ({
        sphere: new THREE.SphereGeometry(1, 32, 32),
        box: new THREE.BoxGeometry(1.6, 1.6, 1.6),
        bar: new THREE.BoxGeometry(2, 4, 2),
        octa: new THREE.OctahedronGeometry(1.6),
        tetra: new THREE.TetrahedronGeometry(1.6),
        pillar: new THREE.CylinderGeometry(5, 5, 140, 6),
        pedestal: new THREE.TorusGeometry(3.5, 0.12, 16, 64)
    }), []);

    // 1. DATA INITIALIZATION
    useEffect(() => {
        if (!targetNode) return;
        let cols = targetNode.columns || [];
        if (cols.length === 0 && schemaData?.nodes) {
            const sn = Array.isArray(schemaData.nodes) ? schemaData.nodes.find(n => n.id === targetNode.id) : schemaData.nodes[targetNode.id];
            cols = sn?.columns || [];
        }
        if (cols.length === 0) {
            cols = Array.from({ length: 14 }, (_, i) => ({
                name: `field_${i}`,
                is_pk: i === 0,
                is_fk: i > 11,
                rows: Math.floor(Math.random() * 900000) + 10000,
                type: i === 0 ? 'SERIAL' : i > 11 ? 'INTEGER' : 'VARCHAR(255)',
                impact: i === 0 ? ['Payment_Processor', 'Receipt_Sync'] : i === 1 ? ['User_Profile', 'Auth_Audit'] : [],
                samples: ['Fragment_A', 'Fragment_B', 'Fragment_C', 'Fragment_D']
            }));
        }
        setColumns([...cols].sort((a, b) => a.is_pk ? -1 : b.is_pk ? 1 : a.is_fk ? 1 : b.is_fk ? -1 : 0));
        setLoading(false);
    }, [targetNode, schemaData]);

    // NEW: FETCH GRANULAR INTELLIGENCE
    useEffect(() => {
        if (!selectedSatellite || !connectionId || !targetNode) {
            setIntelligence(null);
            return;
        }

        const fetchIntel = async () => {
            try {
                const resp = await fetch(`/api/drilldown/${connectionId}/column-intelligence/${targetNode.name}/${selectedSatellite.name}`);
                if (resp.ok) {
                    const data = await resp.json();
                    setIntelligence(data.intelligence);
                }
            } catch (err) {
                console.error("Failed to fetch column intelligence:", err);
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
                setWebglError("CRITICAL: WebGL Context Lost. Reallocating resources...");
            };
            renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

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

            composer = new EffectComposer(renderer);
            composer.addPass(new RenderPass(sceneRef.current, camera));
            const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), settings.glow, 0.4, 0.85);
            composer.addPass(bloomPass);
            composerRef.current = composer;
            bloomPassRef.current = bloomPass;

            sceneRef.current.add(satellitesGroupRef.current);
            sceneRef.current.add(new THREE.AmbientLight(0xffffff, 0.4));
            const sky = new THREE.PointLight(0x00f2ff, 1000, 300); sky.position.set(0, 150, 0);
            sceneRef.current.add(sky);

            const grid = new THREE.GridHelper(600, 50, 0x111111, 0x080808);
            grid.position.y = -70;
            sceneRef.current.add(grid);

            const animate = () => {
                frame = requestAnimationFrame(animate);
                const t = Date.now() * 0.001;

                satellitesGroupRef.current.children.forEach((c, i) => {
                    if (c.userData.type === 'core') c.rotation.y += 0.005;
                    if (c.userData.type === 'satellite') {
                        const isSelected = selectedSatellite && selectedSatellite.name === c.userData.id;

                        if (!overrides[c.userData.id]?.pos && !transform.dragging) {
                            const { r, y, angle, speed } = c.userData.orbit;
                            const moveSlowdown = isSelected ? 0 : (hoveredId === c.userData.id ? 0.2 : 1.0);
                            const a = angle + t * speed * (settings.speed * 20) * moveSlowdown;

                            c.position.x = Math.cos(a) * r;
                            c.position.z = Math.sin(a) * r;
                            if (settings.levitation) c.position.y = y + Math.sin(t * 1.8 + i) * 1.5;
                        }
                        c.rotation.y += 0.015;
                    }
                    if (c.userData.type === 'pedestal') {
                        const p = satellitesGroupRef.current.children.find(o => o.userData.id === c.userData.parentId && o.userData.type === 'satellite');
                        if (p) c.position.set(p.position.x, p.position.y - (p.scale.y / 2) - 1.5, p.position.z);
                    }
                });

                orbit.update();
                composer.render();
            };
            animate();

            const onResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
                composer.setSize(window.innerWidth, window.innerHeight);
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
                renderer.forceContextLoss();
                if (renderer.domElement && mountRef.current) {
                    try { mountRef.current.removeChild(renderer.domElement); } catch (e) { }
                }
            }
            if (composer) composer.dispose();
            sceneRef.current.clear();
        };
    }, [loading, retryCount]);

    // 3. STRUCTURAL BUILD LAYER
    useEffect(() => {
        if (!columns.length || !sceneRef.current) return;

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

        columns.forEach((col, i) => {
            let y = 0, r = 60;
            if (col.is_pk) { y = 50; r = 30; }
            else if (col.is_fk) { y = -45; r = 50; }
            else {
                const mids = columns.filter(c => !c.is_pk && !c.is_fk);
                const midIdx = mids.findIndex(c => c.name === col.name);
                y = 30 - (midIdx / (mids.length || 1)) * 60;
                r = 60;
            }

            const angle = (i / columns.length) * Math.PI * 2;
            const ov = overrides[col.name] || {};
            const neonColor = ov.color || (col.is_pk ? 0xfacc15 : col.is_fk ? 0xa855f7 : 0x00f2ff);

            const mat = new THREE.MeshStandardMaterial({
                color: neonColor, emissive: neonColor, emissiveIntensity: 1.8, metalness: 0.9, roughness: 0.1
            });

            const mesh = new THREE.Mesh(geoms.box, mat);

            let scaleY = 4;
            if (settings.sizeBy === 'ROWS' && col.rows) {
                scaleY = 2 + (Math.log10(col.rows / 1000 + 1) * 3);
            }
            if (ov.height) scaleY = ov.height;

            const scaleXZ = 1.4; // V16: Reduced from 2.5 for sleeker profile
            mesh.scale.set(scaleXZ, scaleY, scaleXZ);

            if (ov.pos) mesh.position.copy(ov.pos);
            else mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

            mesh.userData = { id: col.name, type: 'satellite', data: col, orbit: { r, y, angle, speed: 0.05 + Math.random() * 0.1 } };

            const ped = new THREE.Mesh(geoms.pedestal, new THREE.MeshBasicMaterial({ color: neonColor, transparent: true, opacity: 0.25 }));
            ped.scale.set(0.6, 0.6, 0.6); // Scale down pedestal to match thinner bars
            ped.rotation.x = Math.PI / 2;
            ped.userData = { type: 'pedestal', parentId: col.name };
            group.add(ped);
            group.add(mesh);
        });
    }, [columns, settings.sizeBy, overrides, geoms]);

    // 4. OPTICS & SYNC LAYER
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

        const onMM = (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(satellitesGroupRef.current.children.filter(o => o.userData.type === 'satellite'));
            setHoveredId(hits.length > 0 ? hits[0].object.userData.id : null);
        };
        const onCK = () => {
            if (transformRef.current?.dragging) return;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(satellitesGroupRef.current.children.filter(o => o.userData.type === 'satellite'));
            if (hits.length > 0) setSelectedSatellite(hits[0].object.userData.data);
            else setSelectedSatellite(null);
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

            {/* Navigation */}
            <div className="absolute top-8 left-8 flex items-center gap-6 z-[10010]">
                <button onClick={onClose} className="group p-4 bg-black/50 border border-white/10 rounded-3xl backdrop-blur-3xl hover:bg-black transition-all">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500 flex items-center justify-center text-black font-black italic">←</div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white underline underline-offset-4">Topology View</span>
                    </div>
                </button>
                <div className="flex flex-col border-l border-white/10 pl-6 space-y-1">
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] opacity-80 italic">Refined Monument // V16 Stable</span>
                    <h1 className="text-4xl font-black tracking-tighter uppercase leading-none truncate max-w-[20rem]">{targetNode?.name || 'Local Analytics'}</h1>
                </div>
            </div>

            {/* Global Workshop Sidebar */}
            <div className="absolute top-24 right-8 w-72 flex flex-col gap-6 z-[10005]">
                <div className="bg-black/30 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 space-y-7 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">Workbench</span>
                    </div>

                    <div className="bg-cyan-500/10 p-5 rounded-3xl border border-cyan-500/20 mb-2">
                        <Toggle label="Architecture Mode" checked={settings.editMode} onChange={v => setSettings({ ...settings, editMode: v })} />
                    </div>

                    <div className="space-y-5">
                        <ControlRow label="Monument Drift" value={settings.speed} min={0} max={0.4} step={0.01} onChange={v => setSettings({ ...settings, speed: v })} />
                        <div className="space-y-3">
                            <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest text-center block">Global Height Balance</span>
                            <div className="flex bg-white/5 p-1 rounded-2xl gap-1 border border-white/5">
                                {['UNIFORM', 'ROWS'].map(m => (
                                    <button key={m} onClick={() => setSettings({ ...settings, sizeBy: m })} className={`flex-1 py-2 rounded-xl text-[9px] font-black transition-all ${settings.sizeBy === m ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-gray-500 hover:text-white'}`}>{m}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 space-y-7 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500">Optical Lab</span>
                    </div>
                    <ControlRow label="Neon Intensity" value={settings.glow} min={0} max={6} step={0.1} onChange={v => setSettings({ ...settings, glow: v })} />
                    <div className="flex justify-between items-center text-[9px] text-gray-500 font-black uppercase tracking-widest">
                        <span>Chamber Tint</span>
                        <input type="color" value={settings.bgColor} onChange={e => setSettings({ ...settings, bgColor: e.target.value })} className="w-10 h-6 bg-transparent border-none cursor-pointer rounded-lg shadow-inner" />
                    </div>
                    <Toggle label="Levitation" checked={settings.levitation} onChange={v => setSettings({ ...settings, levitation: v })} />
                    <Toggle label="Auto Simulation" checked={settings.autoRotate} onChange={v => setSettings({ ...settings, autoRotate: v })} />
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
                            value={overrides[selectedSatellite.name]?.color || (selectedSatellite.is_pk ? '#facc15' : selectedSatellite.is_fk ? '#a855f7' : '#00f2ff')}
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
                                    {selectedSatellite.data_type || selectedSatellite.type || 'VARCHAR(255)'}
                                    {intelligence && <span className="ml-2 px-1.5 py-0.5 bg-white/5 text-[10px] text-white/40 rounded border border-white/5">x{intelligence.signature_strength || 1} Instances</span>}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest">Entry Volume</span>
                                <span className="text-sm font-black text-purple-400">{(selectedSatellite.rows || 14000).toLocaleString()} <span className="text-[9px] opacity-40 italic">Rows</span></span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest mb-3 italic">Downstream Pulse</span>
                            <div className="flex flex-wrap gap-2.5">
                                {intelligence ? (
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
                            <span className="text-[10px] text-gray-500 font-black uppercase block tracking-widest mb-2 italic">Propagation Path</span>
                            <div className="text-[10px] font-black text-white/60 flex items-center gap-2 uppercase overflow-x-auto pb-2 scrollbar-hide">
                                {intelligence?.propagation_path ? (
                                    intelligence.propagation_path.map((step, i) => (
                                        <React.Fragment key={i}>
                                            <span className={i === 0 ? "text-cyan-400" : i === intelligence.propagation_path.length - 1 ? "text-purple-400" : "text-white/40"}>{step}</span>
                                            {i < intelligence.propagation_path.length - 1 && <span className="text-white/10 mx-0.5">→</span>}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 text-gray-700 italic">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-800 animate-pulse" />
                                            <span>Establishing Neural Link...</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

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
            )}

            {/* Analytics Rail */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10005] flex items-center gap-10 text-[8px] font-black text-gray-900 uppercase tracking-[0.4em] pointer-events-none opacity-20 italic">
                <span>STABLE_BUILD_V16_REFINED</span>
                <span>Coordinates: {columns.length} BLOCKS SYNCED</span>
                <span>COMPACT_UI_ENABLED</span>
            </div>
        </div>
    );
};
