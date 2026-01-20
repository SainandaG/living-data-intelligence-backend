import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Text, ContactShadows, Line } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import soundSystem from '../../utils/SoundSystem';
import { agentService } from '../../services/agentService';
import { SeededRNG, getHash } from '../../utils/mathUtils';

function FormationParticles({ count = 3000, targetRadius = 5, entropy = 0.5, gravity = 1.0, vitality = 50, topology = 'NUCLEUS', seedName = 'genesis' }) {
    const points = useRef();

    // Create initial shape based on TOPOLOGY using DETERMINISTIC MATH
    const particles = useMemo(() => {
        const rng = new SeededRNG(seedName); // Initialize with Table Name

        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const phases = new Float32Array(count);

        const colorBase = new THREE.Color("#00d9ff");
        const colorAnomaly = new THREE.Color("#ff0055");
        const colorValue = new THREE.Color("#fbbf24");

        for (let i = 0; i < count; i++) {
            // Morphological Logic
            // REFACTOR: All Math.random() replaced with rng.next()

            // Init positions
            const theta = rng.next() * Math.PI * 2;
            const phi = Math.acos(2 * rng.next() - 1);
            const startR = 30 + rng.next() * 10;

            positions[i * 3] = startR * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = startR * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = startR * Math.cos(phi);

            phases[i] = rng.next() * Math.PI * 2;

            // Semantic Coloring
            const isAnomaly = rng.chance(entropy * 0.3);
            const isHighValue = rng.chance(vitality / 100);

            let pColor = colorBase;
            if (isAnomaly) pColor = colorAnomaly;
            else if (isHighValue) pColor = colorValue;

            colors[i * 3] = pColor.r;
            colors[i * 3 + 1] = pColor.g;
            colors[i * 3 + 2] = pColor.b;
        }
        return { positions, colors, phases };
    }, [count, entropy, vitality, topology, targetRadius, seedName]);

    useFrame((state) => {
        // ... (Animation logic remains mostly efficient using time, but we use captured phases)
        if (!points.current) return;

        const time = state.clock.getElapsedTime();
        const pos = points.current.geometry.attributes.position.array;
        const jitterIntensity = entropy * 0.05;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            let tx, ty, tz;

            if (topology === 'HELIX') {
                const t = (i / count) * Math.PI * 10 + time * 0.2;
                const rad = 6;
                tx = rad * Math.cos(t);
                tz = rad * Math.sin(t);
                ty = ((i / count) * 20 - 10);
            } else if (topology === 'RING') {
                const u = (i / count) * Math.PI * 2 + time * 0.1;
                const v = particles.phases[i];
                const R = 9;
                const tube = 1.5;
                tx = (R + tube * Math.cos(v)) * Math.cos(u);
                tz = (R + tube * Math.cos(v)) * Math.sin(u);
                ty = tube * Math.sin(v) * 0.5;
            } else {
                const theta = particles.phases[i] + time * 0.1;
                const phi = particles.phases[i] * 2 + time * 0.05;
                const r = targetRadius / (gravity * 0.8 || 1);
                tx = r * Math.sin(phi) * Math.cos(theta);
                ty = r * Math.sin(phi) * Math.sin(theta);
                tz = r * Math.cos(phi);
            }

            pos[i3] += (tx - pos[i3]) * 0.03;
            pos[i3 + 1] += (ty - pos[i3 + 1]) * 0.03;
            pos[i3 + 2] += (tz - pos[i3 + 2]) * 0.03;

            pos[i3] += Math.sin(time * 5 + i) * jitterIntensity;
            pos[i3 + 1] += Math.cos(time * 5 + i) * jitterIntensity;
            pos[i3 + 2] += Math.sin(time * 3 + i) * jitterIntensity;
        }
        points.current.geometry.attributes.position.needsUpdate = true;

        if (topology === 'HELIX') {
            points.current.rotation.y = 0;
        } else {
            points.current.rotation.y += 0.002;
        }
    });

    return (
        <points ref={points} frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particles.positions.length / 3}
                    array={particles.positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={particles.colors.length / 3}
                    array={particles.colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.15}
                vertexColors
                transparent
                opacity={0.9}
                blending={THREE.AdditiveBlending}
                sizeAttenuation
            />
        </points>
    );
}

function AgentPacket({ start, end, color = "#10b981", speed = 1 }) {
    const mesh = useRef();
    const [progress, setProgress] = useState(0);

    useFrame((state, delta) => {
        if (!mesh.current) return;

        let newProg = progress + delta * speed;
        if (newProg > 1) newProg = 0;
        setProgress(newProg);

        mesh.current.position.x = THREE.MathUtils.lerp(start[0], end[0], newProg);
        mesh.current.position.y = THREE.MathUtils.lerp(start[1], end[1], newProg);
        mesh.current.position.z = THREE.MathUtils.lerp(start[2], end[2], newProg);
    });

    return (
        <mesh ref={mesh}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color={color} />
            <pointLight distance={5} intensity={1} color={color} />
        </mesh>
    );
}

function SatelliteNode({ position, name, onSelect, isSelected }) {
    const mesh = useRef();

    useFrame((state) => {
        if (mesh.current) {
            mesh.current.rotation.y += 0.002;
        }
    });

    return (
        <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(name); }}>
            {/* Connection Beam - HIGHLIGHTED IF SELECTED */}
            <Line
                points={[[0, 0, 0], [-position[0], -position[1], -position[2]]]}
                color={isSelected ? "#fbbf24" : "Fuchsia"}
                lineWidth={isSelected ? 4 : 1}
                transparent
                opacity={isSelected ? 1 : 0.2}
            />
            {isSelected && (
                <AgentPacket start={[-position[0], -position[1], -position[2]]} end={[0, 0, 0]} color="#fbbf24" speed={2} />
            )}

            <mesh ref={mesh}>
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshPhongMaterial
                    color={isSelected ? "#fbbf24" : "#ff0080"}
                    wireframe
                    transparent
                    opacity={isSelected ? 0.8 : 0.3}
                />
            </mesh>
            <Text
                position={[0, 2, 0]}
                fontSize={isSelected ? 1.2 : 0.8}
                color={isSelected ? "#fbbf24" : "#ff0080"}
                anchorX="center"
                anchorY="bottom"
                outlineWidth={isSelected ? 0.05 : 0}
                outlineColor="#000000"
            >
                {name}
            </Text>
        </group>
    );
}

function AgentTrafficController({ satellites, active, t0Active, t1Active }) {
    if (!active && !t0Active && !t1Active) return null;

    return (
        <group>
            {satellites.map((sat, i) => {
                // Use deterministic speeds for each satellite based on its ID
                const sitRng = new SeededRNG(sat.id);

                return (
                    <group key={`traffic-${sat.id}`}>
                        {/* T0: Analyzer Agents (Indigo) - Inbound to Core */}
                        {(active || t0Active) && (
                            <>
                                <AgentPacket
                                    start={sat.position}
                                    end={[0, 0, 0]}
                                    color="#6366f1" // Indigo-500
                                    speed={0.8 + sitRng.next() * 0.5}
                                />
                                <AgentPacket
                                    start={sat.position}
                                    end={[0, 0, 0]}
                                    color="#818cf8"
                                    speed={1.2 + sitRng.next() * 0.5}
                                />
                            </>
                        )}

                        {/* T1: Optimizer Agents (Green) - Outbound from Core */}
                        {(active || t1Active) && (
                            <>
                                <AgentPacket
                                    start={[0, 0, 0]}
                                    end={sat.position}
                                    color="#10b981" // Emerald-500
                                    speed={1.0 + sitRng.next() * 0.5}
                                />
                                <AgentPacket
                                    start={[0, 0, 0]}
                                    end={sat.position}
                                    color="#34d399"
                                    speed={1.5 + sitRng.next() * 0.5}
                                />
                            </>
                        )}
                    </group>
                )
            })}
        </group>
    );
}

export default function NodeFormationSimulation({ connectionId, tableName, flowData, onExit }) {
    const [metrics, setMetrics] = useState({ gravity: 1.0, entropy: 0.1, vitality: 50, row_count: 0, in_degree: 0, out_degree: 0 });
    const [proofs, setProofs] = useState(null);
    const [isHudOpen, setIsHudOpen] = useState(true);
    const [isLegendOpen, setIsLegendOpen] = useState(true);
    const [isStructuralOpen, setIsStructuralOpen] = useState(true); // Default open to show shape logic
    const [selectedSatellite, setSelectedSatellite] = useState(null);
    const [aiInsight, setAiInsight] = useState(null);
    const [isInsightLoading, setIsInsightLoading] = useState(false);

    // Agent State for Visualization
    const [agentState, setAgentState] = useState({ t0_state: 'idle', t1_state: 'idle' });
    const [simulateAgents, setSimulateAgents] = useState(false); // Demo toggle

    useEffect(() => {
        const fetchData = async () => {
            if (!connectionId) return;
            try {
                const res = await fetch(`/api/evolution/analysis/table/${connectionId}/${tableName}`);
                const data = await res.json();
                if (data.metrics) {
                    setMetrics(data.metrics);
                    setProofs(data.proofs);
                }
            } catch (e) {
                console.error("Simulation data fetch failed", e);
            }
        };

        const fetchAgentState = async () => {
            // In a real scenario, we'd fetch from backend. 
            // For this visual simulation, we can also rely on the prop or a separate service call.
            // We'll trust the simulation toggle for visual drama, but also try to read real state.
            try {
                const realState = await agentService.getAgentState();
                setAgentState(prev => ({ ...prev, ...realState }));
            } catch (e) {
                // silent fail
            }
        };

        fetchData();
        const interval = setInterval(fetchAgentState, 2000);
        soundSystem.play('formationAmbient');

        return () => {
            clearInterval(interval);
            soundSystem.stop('formationAmbient');
        };
    }, [connectionId, tableName]);

    const [muted, setMuted] = useState(false);
    const toggleSound = () => {
        const isEnabled = soundSystem.toggle();
        setMuted(!isEnabled);
    };

    const handleExit = () => {
        if (!muted) soundSystem.play('nodeClick');
        onExit();
    };

    const handleSatelliteClick = (name) => {
        soundSystem.play('scanPulse'); // Use pulse sound for selection
        setSelectedSatellite(name);
        setIsHudOpen(true); // Auto-open HUD to show impact
    };

    const handleRequestInsight = async () => {
        setIsInsightLoading(true);
        try {
            soundSystem.play('scanPulse');
            const res = await fetch(`/api/evolution/analysis/insight/${connectionId}/${tableName}`);
            const data = await res.json();
            if (data.insight) {
                setAiInsight(data.insight);
            }
        } catch (e) {
            console.error("AI Insight failed", e);
            setAiInsight("Neural Link Interrupted. Retry connection.");
        } finally {
            setIsInsightLoading(false);
        }
    };

    const satellites = useMemo(() => {
        if (!flowData?.nodes) return [];
        const neighbors = flowData.nodes.filter(n => n.id !== tableName).slice(0, 6);
        return neighbors.map((n, i) => {
            const angle = (i / neighbors.length) * Math.PI * 2;
            const radius = 20;
            return {
                ...n,
                position: [
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius * 0.5,
                    Math.sin(angle) * radius
                ]
            };
        });
    }, [flowData, tableName]);

    const topologyInfo = useMemo(() => {
        const inD = metrics.in_degree || 0;
        const outD = metrics.out_degree || 0;

        if (inD > outD) {
            return {
                type: 'NUCLEUS',
                desc: 'Central Authority (Hub Structure)',
                reason: 'High In-Degree indicates this node acts as a central storage for many references.',
                math_reason: `In-Degree (${inD}) > Out-Degree (${outD})`
            };
        } else if (outD > inD + 1) {
            return {
                type: 'HELIX',
                desc: 'Transactional Stream (Flow Structure)',
                reason: 'High Out-Degree indicates this node generates many outbound references over time.',
                math_reason: `Out-Degree (${outD}) Dominant`
            };
        } else {
            return {
                type: 'RING',
                desc: 'Reference Entity (Stable Loop)',
                reason: 'Balanced or Low connectivity indicates stable reference data.',
                math_reason: 'Balanced Connectivity'
            };
        }
    }, [metrics]);

    // Calculate dynamic impact for selected satellite
    const selectedImpact = useMemo(() => {
        if (!selectedSatellite) return null;
        const satHash = getHash(selectedSatellite);
        // Deterministic random mass for satellite based on name hash (0.5 to 2.0)
        const satMass = (satHash % 15) / 10 + 0.5;
        const centralMass = metrics.gravity || 1.0;
        const r_sq = 400; // Radius approx 20^2
        const force = (centralMass * satMass) / r_sq * 100; // Scaled for readability
        return {
            force: force.toFixed(4),
            mass: satMass.toFixed(2)
        };
    }, [selectedSatellite, metrics.gravity]);


    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0e1a]/95 backdrop-blur-2xl flex flex-col items-center justify-center">

            <div className="absolute top-8 left-8 flex flex-col gap-1 w-full max-w-7xl px-8 flex-row justify-between items-start pointer-events-none">
                <div className="pointer-events-auto">
                    <h2 className="text-2xl font-bold text-white font-mono uppercase tracking-tighter">
                        Neural Formation: <span className="text-[var(--primary-cyan)]">{tableName}</span>
                    </h2>
                    <div className="text-[var(--text-secondary)] text-xs uppercase font-mono flex flex-col gap-1">
                        <span className="text-emerald-400 font-bold">Detected Topology: {topologyInfo.type}</span>
                        <span className="opacity-70">Role: {topologyInfo.desc}</span>
                    </div>
                </div>

                <button
                    onClick={toggleSound}
                    className={`pointer-events-auto px-4 py-2 rounded-full border flex items-center gap-2 transition-all backdrop-blur-md ${muted ? 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20' : 'bg-emerald-500/10 border-emerald-500 text-emerald-500 hover:bg-emerald-500/20'}`}
                >
                    {muted ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <span className="text-xs font-bold font-mono tracking-wider">AUDIO OFF</span>
                        </>
                    ) : (
                        <>
                            <div className="relative">
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-75"></span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                            </div>
                            <span className="text-xs font-bold font-mono tracking-wider">AUDIO ONLINE</span>
                        </>
                    )}
                </button>
            </div>

            <button
                onClick={handleExit}
                className="absolute bottom-8 right-8 px-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all font-mono uppercase text-xs pointer-events-auto"
            >
                Close Visualization
            </button>

            {/* Structural Explanation Sidebar - RIGHT SIDE */}
            <div className="absolute right-8 top-32 flex flex-col items-end pointer-events-none z-[50]">
                <button
                    onClick={() => setIsStructuralOpen(!isStructuralOpen)}
                    className="pointer-events-auto bg-[#fbbf24]/10 border border-[#fbbf24] text-[#fbbf24] rounded-l-lg px-4 py-2 hover:bg-[#fbbf24]/20 transition-all flex items-center gap-2 backdrop-blur-md shadow-[0_0_20px_rgba(251,191,36,0.2)] mb-2"
                >
                    <motion.div animate={{ rotate: isStructuralOpen ? 0 : 180 }}>
                        <svg width="8" height="4" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.div>
                    <span className="text-[10px] font-bold font-mono uppercase tracking-widest">
                        {isStructuralOpen ? "Hide Structure Logic" : "Why this Shape?"}
                    </span>
                </button>

                <AnimatePresence>
                    {isStructuralOpen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "auto", opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-3 pointer-events-auto overflow-hidden w-64 shadow-lg origin-right"
                        >
                            <h4 className="text-[10px] font-bold text-[#fbbf24] uppercase opacity-90 mb-1 border-b border-[#fbbf24]/30 pb-1">
                                Pattern Detected: {topologyInfo.type}
                            </h4>
                            <p className="text-[10px] text-slate-300 font-mono leading-relaxed">
                                {topologyInfo.reason}
                            </p>
                            <div className="mt-2 p-2 bg-[#fbbf24]/5 rounded border border-[#fbbf24]/10">
                                <p className="text-[9px] text-[#fbbf24] font-mono mb-1">Logic Proof:</p>
                                <code className="text-[9px] text-white block">
                                    {topologyInfo.math_reason}
                                </code>
                            </div>

                            {/* AI INSIGHT SECTION */}
                            <div className="mt-4 pt-4 border-t border-white/10">
                                {!aiInsight ? (
                                    <button
                                        onClick={handleRequestInsight}
                                        disabled={isInsightLoading}
                                        className="w-full py-2 bg-[var(--primary-cyan)]/10 border border-[var(--primary-cyan)] text-[var(--primary-cyan)] rounded hover:bg-[var(--primary-cyan)]/20 transition-all text-[10px] font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2"
                                    >
                                        {isInsightLoading ? (
                                            <>
                                                <span className="animate-spin h-3 w-3 border-2 border-[var(--primary-cyan)] border-t-transparent rounded-full"></span>
                                                ANALYZING...
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" /><path d="M12 6v6l4 2" /></svg>
                                                REQUEST AI INSIGHT
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="p-3 bg-[var(--primary-cyan)]/5 border border-[var(--primary-cyan)]/20 rounded relative"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--primary-cyan)]/50"></div>
                                        <h5 className="text-[9px] font-bold text-[var(--primary-cyan)] uppercase mb-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-cyan)] animate-pulse"></span>
                                            NEURAL CORE ANALYSIS
                                        </h5>
                                        <p className="text-[10px] text-slate-300 leading-relaxed font-mono italic">
                                            "{aiInsight}"
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="w-full h-full">
                <Canvas camera={{ position: [0, 10, 40], fov: 45 }} onPointerMissed={() => setSelectedSatellite(null)}>
                    <color attach="background" args={['#0a0e1a']} />
                    <ambientLight intensity={0.4} />
                    <pointLight position={[10, 10, 10]} intensity={2} color="#00d9ff" />

                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
                        <group>
                            <FormationParticles
                                count={3000}
                                targetRadius={8}
                                entropy={metrics.entropy}
                                gravity={metrics.gravity}
                                vitality={metrics.vitality}
                                topology={topologyInfo.type}
                            />
                            {topologyInfo.type === 'NUCLEUS' && (
                                <mesh>
                                    <sphereGeometry args={[7.8 / (metrics.gravity || 1), 64, 64]} />
                                    <meshPhongMaterial
                                        color="#00d9ff"
                                        transparent
                                        opacity={0.1}
                                        wireframe
                                    />
                                </mesh>
                            )}

                            <Text
                                position={[0, 0, 0]}
                                fontSize={1.2}
                                color="white"
                                anchorX="center"
                                anchorY="middle"
                                maxWidth={10}
                                textAlign="center"
                            >
                                {tableName.toUpperCase()}
                            </Text>
                        </group>

                        {satellites.map((sat, i) => (
                            <SatelliteNode
                                key={sat.id}
                                position={sat.position}
                                name={sat.id}
                                onSelect={handleSatelliteClick}
                                isSelected={selectedSatellite === sat.id}
                            />
                        ))}

                        {/* Agent Traffic System */}
                        <AgentTrafficController
                            satellites={satellites}
                            active={simulateAgents}
                            t0Active={agentState.t0_state !== 'idle'}
                            t1Active={agentState.t1_state !== 'idle'}
                        />

                    </Float>

                    <ContactShadows position={[0, -15, 0]} opacity={0.4} scale={50} blur={2} far={20} />
                    <OrbitControls enableZoom={true} autoRotate autoRotateSpeed={0.2} minDistance={20} maxDistance={100} />
                </Canvas>
            </div>

            {/* Agent Traffic Control Toggle */}
            <div className="absolute top-32 left-8 pointer-events-none">
                <button
                    onClick={() => setSimulateAgents(!simulateAgents)}
                    className={`pointer-events-auto px-4 py-2 rounded-lg border flex items-center gap-2 transition-all backdrop-blur-md mb-2 shadow-lg ${simulateAgents ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                >
                    <span className="text-[10px] font-bold font-mono uppercase tracking-widest">
                        {simulateAgents ? "Stop Agent Traffic" : "Simulate Agent Swarm"}
                    </span>
                    {simulateAgents && <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>}
                </button>
            </div>

            {/* Scientific HUD - Collapsible */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8 pointer-events-none flex flex-col items-center">
                <button
                    onClick={() => setIsHudOpen(!isHudOpen)}
                    className="pointer-events-auto bg-black/60 border border-white/10 border-b-0 rounded-t-xl px-6 py-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 backdrop-blur-md mb-[-1px] z-10"
                >
                    <span className="text-[10px] font-mono uppercase tracking-widest">
                        {isHudOpen ? "Minimize Intelligence" : "Deep Analysis"}
                    </span>
                    <motion.div animate={{ rotate: isHudOpen ? 180 : 0 }}>
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.div>
                </button>

                <AnimatePresence>
                    {isHudOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-black/80 border border-white/20 p-6 rounded-2xl backdrop-blur-xl w-full pointer-events-auto overflow-hidden shadow-2xl origin-bottom"
                        >
                            {!selectedSatellite ? (
                                // GLOBAL METRICS VIEW
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">Structural Gravity</p>
                                        <div className="text-3xl font-bold text-white font-mono">
                                            {Number(metrics.gravity).toFixed(4)} <span className="text-sm font-normal text-slate-500">N</span>
                                        </div>
                                        <p className="text-[10px] text-fuchsia-400 font-mono opacity-80 mt-1">
                                            {satellites.length} Active Integrity Links
                                        </p>
                                        {proofs?.gravity && (
                                            <div className="mt-2 p-2 bg-white/5 rounded border border-white/5">
                                                <p className="text-[10px] text-slate-400 font-mono mb-1">Calculation Proof:</p>
                                                <code className="text-[10px] text-[var(--primary-cyan)] block">{proofs.gravity}</code>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2 text-right">
                                        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">Shannon Entropy</p>
                                        <div className="text-3xl font-bold text-white font-mono">
                                            {Number(metrics.entropy).toFixed(4)} <span className="text-sm font-normal text-slate-500">H(x)</span>
                                        </div>
                                        <p className="text-[10px] text-emerald-400 font-mono opacity-80 mt-1">
                                            Live Scanner: ONLINE
                                        </p>
                                        {proofs?.entropy && (
                                            <div className="mt-2 p-2 bg-white/5 rounded border border-white/5 text-right flex flex-col items-end">
                                                <p className="text-[10px] text-slate-400 font-mono mb-1">Calculation Proof:</p>
                                                <code className="text-[10px] text-pink-400 block">{proofs.entropy}</code>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 mt-2 pt-4 border-t border-white/10 flex items-center justify-between">
                                        <div className="text-[10px] text-slate-400 font-mono">
                                            RELATIONAL DENS: {(metrics.row_count / (metrics.gravity || 1)).toFixed(2)} ops/unit
                                        </div>
                                        <div className="h-1 bg-white/5 w-1/2 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 2 }}
                                                className="h-full bg-gradient-to-r from-[var(--primary-cyan)] to-pink-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // SATELLITE IMPACT VIEW (DYNAMIC FORCE)
                                <div className="grid grid-cols-2 gap-8 relative">
                                    <button
                                        onClick={() => setSelectedSatellite(null)}
                                        className="absolute -top-4 -right-2 text-[10px] text-slate-400 hover:text-white px-2 py-1 bg-white/5 rounded border border-white/10"
                                    >BACK TO GLOBAL</button>

                                    <div className="space-y-2">
                                        <p className="text-[10px] text-[var(--primary-cyan)] uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-[var(--primary-cyan)] animate-pulse"></span>
                                            Incoming Influence
                                        </p>
                                        <div className="text-xl font-bold text-white font-mono flex items-center gap-2">
                                            {selectedSatellite} <span className="text-slate-500">→</span> {tableName}
                                        </div>
                                        <p className="text-[10px] text-amber-400 font-mono opacity-90 mt-1">
                                            Mass Est: {selectedImpact?.mass} M
                                        </p>
                                        <div className="mt-2 p-3 bg-amber-500/10 rounded border border-amber-500/20">
                                            <p className="text-[10px] text-amber-200 font-mono mb-1">Impact Mechanics (Newtonian):</p>
                                            <code className="text-[10px] text-amber-400 block">
                                                F = G * ({metrics.gravity.toFixed(2)} * {selectedImpact?.mass}) / r² <br />
                                                Val = <span className="text-white font-bold">{selectedImpact?.force} N</span>
                                            </code>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-right">
                                        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">Constraint Logic</p>
                                        <div className="text-xs text-slate-300 font-mono leading-relaxed">
                                            Enforces referential integrity. <br />
                                            Prevents orphan records.
                                        </div>
                                        <p className="text-[10px] text-emerald-400 font-mono opacity-80 mt-1">
                                            Dependency Strength: STRONG
                                        </p>
                                        <div className="mt-2 p-3 bg-emerald-500/10 rounded border border-emerald-500/20 text-right">
                                            <p className="text-[10px] text-emerald-200 font-mono mb-1">Stability Contribution:</p>
                                            <code className="text-[10px] text-emerald-400 block">
                                                +{(metrics.entropy * 0.5 * (selectedImpact?.mass || 1)).toFixed(4)} Bits
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Visual Legend */}
            <div className="absolute bottom-32 left-8 flex flex-col items-start pointer-events-none z-[50]">
                <button
                    onClick={() => setIsLegendOpen(!isLegendOpen)}
                    className="pointer-events-auto bg-[#00d9ff]/10 border border-[#00d9ff] text-[#00d9ff] rounded px-4 py-2 hover:bg-[#00d9ff]/20 transition-all flex items-center gap-2 backdrop-blur-md shadow-[0_0_20px_rgba(0,217,255,0.2)]"
                >
                    <span className="text-[10px] font-bold font-mono uppercase tracking-widest">
                        {isLegendOpen ? "Hide Visual Key" : "Show Visual Key"}
                    </span>
                    <motion.div animate={{ rotate: isLegendOpen ? 180 : 0 }}>
                        <svg width="8" height="4" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.div>
                </button>

                <AnimatePresence>
                    {isLegendOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-2 pointer-events-auto overflow-hidden w-64 shadow-lg origin-top-left"
                        >
                            <h4 className="text-[10px] font-bold text-white uppercase opacity-70 mb-2">Insight Decoder</h4>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[var(--primary-cyan)]"></div>
                                <span className="text-[10px] text-slate-300 font-mono uppercase">Cyan = Standard Row</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#fbbf24]"></div>
                                <span className="text-[10px] text-amber-300 font-mono uppercase">Gold = High Vitality (Top 5%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#ff0055]"></div>
                                <span className="text-[10px] text-rose-400 font-mono uppercase">Red = Entropy Spike (Anomaly)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                <span className="text-[10px] text-slate-300 font-mono uppercase">Pulse = Integrity Scan</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    <span className="text-[10px] text-indigo-300 font-mono uppercase">Indigo = T0 Analyzer (Inbound)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-[10px] text-emerald-300 font-mono uppercase">Green = T1 Optimizer (Outbound)</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div >
    );
}
