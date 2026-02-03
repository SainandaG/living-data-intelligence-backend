import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const ControlRow = ({ label, value, min, max, step, onChange }) => (
    <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
            <span>{label}</span>
            <span className="text-cyan-400">{value}</span>
        </div>
        <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
        />
    </div>
);

const Toggle = ({ checked, onChange, label }) => (
    <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase">
        <span>{label}</span>
        <div
            onClick={() => onChange(!checked)}
            className={`w-8 h-4 rounded-full relative cursor-pointer transition-all ${checked ? 'bg-cyan-500/50' : 'bg-white/10'}`}
        >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
        </div>
    </div>
);

export const LatentWorld = ({ targetNode, onClose, schemaData }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const orbitControlsRef = useRef(null);
    const transformControlsRef = useRef(null);
    const composerRef = useRef(null);
    const bloomPassRef = useRef(null);
    const satellitesGroupRef = useRef(null);
    const geometriesRef = useRef(null);
    const laserRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());

    const [loading, setLoading] = useState(true);
    const [sceneReady, setSceneReady] = useState(false);
    const [columns, setColumns] = useState([]);
    const [selectedSatellite, setSelectedSatellite] = useState(null);
    const [overrides, setOverrides] = useState({});
    const [hoveredId, setHoveredId] = useState(null);
    const [moveToolEnabled, setMoveToolEnabled] = useState(false);

    const [settings, setSettings] = useState({
        bgColor: '#050505',
        spread: 35,
        glow: 2.3,
        scale: 7,
        autoRotate: true,
        levitation: true,
        orbitSpeed: 0.2,
        showGrid: true,
        sizeBy: 'UNIFORM',
        colorBy: 'ROLE'
    });

    // Data initialization
    useEffect(() => {
        if (!targetNode) {
            setLoading(false);
            return;
        }

        let nodeColumns = [];
        if (targetNode.columns && targetNode.columns.length > 0) {
            nodeColumns = targetNode.columns;
        } else if (schemaData?.nodes) {
            const schemaNode = Array.isArray(schemaData.nodes)
                ? schemaData.nodes.find(n => n.id === targetNode.id || n.name === targetNode.name)
                : schemaData.nodes[targetNode.id];
            nodeColumns = schemaNode?.columns || [];
        }

        if (nodeColumns.length > 0) {
            setColumns(nodeColumns);
        } else {
            const mockCols = Array.from({ length: 14 }, (_, i) => ({
                name: `property_${i}`,
                type: i % 4 === 0 ? 'varchar' : i % 4 === 1 ? 'int' : i % 4 === 2 ? 'float' : 'date',
                is_pk: i === 0,
                is_fk: i === 1 || i === 2,
                rows: Math.floor(Math.random() * 500000),
                samples: ['Value A', 'Value B', 'Value C', 'Value D'].sort(() => Math.random() - 0.5)
            }));
            setColumns(mockCols);
        }
        setLoading(false);
    }, [targetNode, schemaData]);

    // Main Scene Setup
    useEffect(() => {
        if (!mountRef.current) return;

        // Initialize Geometries before anything else
        geometriesRef.current = {
            sphere: new THREE.SphereGeometry(1, 32, 32),
            box: new THREE.BoxGeometry(1.2, 1.2, 1.2),
            tetra: new THREE.TetrahedronGeometry(1.2),
            torus: new THREE.TorusGeometry(1, 0.3, 16, 100),
            capsule: new THREE.CapsuleGeometry(0.6, 1, 4, 16),
            octa: new THREE.OctahedronGeometry(1.2)
        };

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(settings.bgColor);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(50, 50, 100);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const orbitControls = new OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.autoRotate = settings.autoRotate;
        orbitControlsRef.current = orbitControls;

        const transformControls = new TransformControls(camera, renderer.domElement);
        transformControls.addEventListener('dragging-changed', (e) => {
            orbitControls.enabled = !e.value;
        });
        transformControls.addEventListener('change', () => {
            if (transformControls.object) {
                const obj = transformControls.object;
                setOverrides(prev => ({
                    ...prev,
                    [obj.userData.id]: {
                        ...(prev[obj.userData.id] || {}),
                        posOverride: obj.position.clone()
                    }
                }));
            }
        });
        scene.add(transformControls);
        transformControlsRef.current = transformControls;

        const satellitesGroup = new THREE.Group();
        scene.add(satellitesGroup);
        satellitesGroupRef.current = satellitesGroup;

        // Vertical Laser
        const laserGeom = new THREE.CylinderGeometry(0.5, 0.5, 300, 32);
        const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.2 });
        const laser = new THREE.Mesh(laserGeom, laserMat);
        scene.add(laser);
        laserRef.current = laser;

        // Grid
        const grid = new THREE.GridHelper(400, 40, 0x222222, 0x111111);
        grid.position.y = -2;
        scene.add(grid);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(100, 100, 100);
        scene.add(dirLight);

        // Composer & Effects
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), settings.glow, 0.4, 0.85);
        bloomPassRef.current = bloom;
        composer.addPass(bloom);
        composerRef.current = composer;

        let animationId;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            const time = Date.now() * 0.001;

            if (laserRef.current) {
                laserRef.current.material.opacity = 0.1 + Math.sin(time * 3) * 0.1;
                laserRef.current.rotation.y = time;
            }

            satellitesGroup.children.forEach((child, i) => {
                if (child.userData.orbit) {
                    const hasOverride = !!overrides[child.userData.id]?.posOverride;
                    if (!hasOverride && child !== transformControls.object) {
                        const { radius, speed, angle, yOffset } = child.userData.orbit;
                        const finalSpeed = speed * (settings.orbitSpeed * 3);
                        const currentAngle = angle + (time * finalSpeed);
                        child.position.x = Math.cos(currentAngle) * radius;
                        child.position.z = Math.sin(currentAngle) * radius;
                        if (settings.levitation) {
                            child.position.y = Math.sin(time * 2 + i) * 2 + yOffset;
                        }
                    } else if (hasOverride && child !== transformControls.object) {
                        child.position.copy(overrides[child.userData.id].posOverride);
                    }
                    child.rotation.x += 0.01;
                    child.rotation.y += 0.01;
                    const targetScale = child.userData.baseScale * (child.userData.id === hoveredId ? 1.5 : 1.0);
                    child.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
                }
            });

            if (!transformControls.dragging) {
                raycasterRef.current.setFromCamera(mouseRef.current, camera);
                const intersects = raycasterRef.current.intersectObjects(satellitesGroup.children);
                if (intersects.length > 0) {
                    const hit = intersects[0].object;
                    if (hit.userData.type === 'satellite') setHoveredId(hit.userData.id);
                } else {
                    setHoveredId(null);
                }
            }

            orbitControls.update();
            composer.render();
        };
        animate();
        setSceneReady(true);

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        const handleMouseMove = (e) => {
            mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationId);
            renderer.dispose();
        };
    }, []);

    // Build Satellites whenever columns or overrides change
    useEffect(() => {
        if (!sceneReady || !satellitesGroupRef.current || !geometriesRef.current) return;
        const group = satellitesGroupRef.current;
        group.clear();

        // Core
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 2,
            wireframe: true
        });
        const coreGeom = geometriesRef.current['sphere'];
        if (coreGeom) {
            const core = new THREE.Mesh(coreGeom, coreMat);
            core.scale.set(settings.scale, settings.scale, settings.scale);
            group.add(core);
        }

        columns.forEach((col, i) => {
            const angle = (i / columns.length) * Math.PI * 2;
            const radius = settings.spread + (i % 2 === 0 ? 5 : -5);
            const override = overrides[col.name] || {};

            let material;
            if (override.isGlass) {
                material = new THREE.MeshPhysicalMaterial({
                    color: override.color || 0xffffff,
                    metalness: 0, roughness: 0, transmission: 1, thickness: 1,
                    transparent: true, opacity: 0.6
                });
            } else {
                material = new THREE.MeshStandardMaterial({
                    color: override.color || (col.is_pk ? 0xfacc15 : col.is_fk ? 0xa855f7 : 0x00f2ff),
                    metalness: override.metalness ?? 0.8,
                    roughness: override.roughness ?? 0.2,
                    emissive: override.color || (col.is_pk ? 0xfacc15 : col.is_fk ? 0xa855f7 : 0x00f2ff),
                    emissiveIntensity: 0.3
                });
            }

            const geomKey = override.shape || (col.is_pk ? 'box' : col.is_fk ? 'octa' : 'sphere');
            const geom = geometriesRef.current[geomKey];
            if (!geom) return;

            const mesh = new THREE.Mesh(geom, material);
            let baseScale = 1.5;
            if (settings.sizeBy === 'ROWS' && col.rows) baseScale = 1 + (Math.log10(col.rows + 1) * 0.4);
            if (selectedSatellite?.name === col.name) baseScale *= 1.5;

            mesh.scale.set(baseScale, baseScale, baseScale);
            if (override.posOverride) mesh.position.copy(override.posOverride);

            mesh.userData = {
                id: col.name,
                type: 'satellite',
                data: col,
                baseScale,
                orbit: { radius, speed: 0.05 + Math.random() * 0.1, angle, yOffset: (i % 3 - 1) * 2 }
            };
            group.add(mesh);
        });
    }, [columns, sceneReady, settings, selectedSatellite, overrides]);

    // Apply Live Settings
    useEffect(() => {
        if (orbitControlsRef.current) orbitControlsRef.current.autoRotate = settings.autoRotate;
        if (bloomPassRef.current) bloomPassRef.current.strength = settings.glow;
        if (sceneRef.current) sceneRef.current.background.set(settings.bgColor);
    }, [settings]);

    // Click Selection
    useEffect(() => {
        if (!rendererRef.current) return;
        const handleClick = (e) => {
            if (transformControlsRef.current?.dragging) return;
            const intersects = raycasterRef.current.intersectObjects(satellitesGroupRef.current.children);
            if (intersects.length > 0 && intersects[0].object.userData.type === 'satellite') {
                setSelectedSatellite(intersects[0].object.userData.data);
            } else {
                setSelectedSatellite(null);
            }
        };
        const canvas = rendererRef.current.domElement;
        canvas.addEventListener('click', handleClick);
        return () => canvas.removeEventListener('click', handleClick);
    }, [sceneReady]);

    // Move Tool Logic
    useEffect(() => {
        if (transformControlsRef.current && selectedSatellite && moveToolEnabled) {
            const mesh = satellitesGroupRef.current.children.find(c => c.userData.id === selectedSatellite.name);
            if (mesh) transformControlsRef.current.attach(mesh);
        } else if (transformControlsRef.current) {
            transformControlsRef.current.detach();
        }
    }, [selectedSatellite, moveToolEnabled, sceneReady]);

    return (
        <div className="fixed inset-0 z-[9999] bg-[#050505] text-white font-mono flex flex-col overflow-hidden select-none">
            <div ref={mountRef} className="absolute inset-0 z-0" />

            <button onClick={onClose} className="absolute top-6 left-6 z-[10010] p-3 bg-black/40 hover:bg-black/60 border border-white/10 text-white rounded-2xl flex items-center gap-3 backdrop-blur-3xl text-xs font-bold uppercase transition-all shadow-2xl">
                <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-black font-black">←</div>
                Topology View
            </button>

            <div className="absolute top-24 right-6 w-80 flex flex-col gap-4 z-[10005]">
                <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-cyan-400">Visualization</span>
                    </div>
                    <div className="space-y-3">
                        <span className="text-[10px] text-gray-500 font-black uppercase">Scaling Mode</span>
                        <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                            {['UNIFORM', 'ROWS'].map(m => (
                                <button key={m} onClick={() => setSettings({ ...settings, sizeBy: m })}
                                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-all ${settings.sizeBy === m ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                >{m}</button>
                            ))}
                        </div>
                    </div>
                    <ControlRow label="Core Scale" value={settings.scale} min={2} max={15} step={1} onChange={v => setSettings({ ...settings, scale: v })} />
                    <ControlRow label="Orbit Spread" value={settings.spread} min={10} max={80} step={5} onChange={v => setSettings({ ...settings, spread: v })} />
                    <ControlRow label="Orbit Speed" value={settings.orbitSpeed} min={0} max={1} step={0.1} onChange={v => setSettings({ ...settings, orbitSpeed: v })} />
                </div>

                <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-purple-400">Environment</span>
                    </div>
                    <ControlRow label="Bloom Energy" value={settings.glow} min={0} max={5} step={0.1} onChange={v => setSettings({ ...settings, glow: v })} />
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase">
                        <span>Backdrop</span>
                        <input type="color" value={settings.bgColor} onChange={(e) => setSettings({ ...settings, bgColor: e.target.value })} className="w-12 h-6 bg-transparent border-none cursor-pointer rounded-md" />
                    </div>
                    <Toggle label="Auto Pitch" checked={settings.autoRotate} onChange={v => setSettings({ ...settings, autoRotate: v })} />
                    <Toggle label="Levitation" checked={settings.levitation} onChange={v => setSettings({ ...settings, levitation: v })} />
                </div>
            </div>

            {selectedSatellite && (
                <div className="absolute bottom-8 right-6 w-96 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-7 shadow-2xl z-[10010] flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded">Active Field</span>
                            <h2 className="text-3xl font-black tracking-tighter leading-none">{selectedSatellite.name}</h2>
                        </div>
                        <button onClick={() => setSelectedSatellite(null)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400">✕</button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-cyan-400">Reposition Tool</span>
                            <span className="text-[9px] text-gray-500 tracking-tight">Manual 3D Drag & Drop</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {overrides[selectedSatellite.name]?.posOverride && (
                                <button onClick={() => {
                                    const newOv = { ...overrides };
                                    delete newOv[selectedSatellite.name].posOverride;
                                    setOverrides(newOv);
                                }} className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-bold rounded-lg hover:bg-red-500/20 transition-all uppercase">Reset Pos</button>
                            )}
                            <Toggle checked={moveToolEnabled} onChange={setMoveToolEnabled} />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <span className="block text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3">Data Samples</span>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                            {(selectedSatellite.samples || ['Record 011', 'Record 045', 'Record 102']).map((s, i) => (
                                <div key={i} className="px-2 py-1 bg-white/5 border border-white/5 rounded-md text-gray-400 font-mono italic">"{s}"</div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-5 pt-2 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-2">
                            {['sphere', 'box', 'torus', 'capsule', 'octa', 'tetra'].map(s => (
                                <button key={s} onClick={() => setOverrides({ ...overrides, [selectedSatellite.name]: { ...(overrides[selectedSatellite.name] || {}), shape: s } })}
                                    className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase transition-all ${overrides[selectedSatellite.name]?.shape === s || (!overrides[selectedSatellite.name]?.shape && s === (selectedSatellite.is_pk ? 'box' : selectedSatellite.is_fk ? 'octa' : 'sphere')) ? 'bg-white text-black' : 'bg-white/5 text-gray-600 hover:text-white border border-transparent hover:border-white/10'}`}
                                >{s}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-4">
                            <input type="color" value={overrides[selectedSatellite.name]?.color || (selectedSatellite.is_pk ? '#facc15' : selectedSatellite.is_fk ? '#a855f7' : '#00f2ff')} onChange={(e) => setOverrides({ ...overrides, [selectedSatellite.name]: { ...(overrides[selectedSatellite.name] || {}), color: e.target.value } })} className="w-12 h-12 rounded-2xl bg-transparent cursor-pointer ring-1 ring-white/10" />
                            <div className="flex-1 space-y-4">
                                <Toggle label="Glass Effect" checked={overrides[selectedSatellite.name]?.isGlass} onChange={v => setOverrides({ ...overrides, [selectedSatellite.name]: { ...(overrides[selectedSatellite.name] || {}), isGlass: v } })} />
                                <ControlRow label="Substance" value={overrides[selectedSatellite.name]?.metalness ?? 0.8} min={0} max={1} step={0.1} onChange={v => setOverrides({ ...overrides, [selectedSatellite.name]: { ...(overrides[selectedSatellite.name] || {}), metalness: v } })} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10005] flex items-center gap-4 text-[9px] font-black text-gray-600 uppercase tracking-widest pointer-events-none">
                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_cyan]" /> Latent-V4 Active</span>
                <span className="w-1 h-1 rounded-full bg-gray-800" />
                <span>Drilldown: {targetNode?.name}</span>
            </div>
        </div>
    );
};
