import React, { useRef, useMemo, useEffect, useState, useCallback, useReducer } from 'react';
import apiClient from '../../utils/apiClient';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Text, ContactShadows, Line } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import soundSystem from '../../utils/SoundSystem';
import { agentService } from '../../services/agentService';
import { SeededRNG, getHash } from '../../utils/mathUtils';
import { logger } from '../../utils/logger';
import { FORMATION_POLL_INTERVAL } from '../../config/timing';
import ErrorBoundary from '../ErrorBoundary';

// --- STATE MANAGEMENT ---
const initialSimState = {
    progress: 0,
    metrics: { gravity: 1.0, entropy: 0.5, vitality: 50, in_degree: 0, out_degree: 0, row_count: 0 },
    proofs: { gravity: '', entropy: '' },
    isHudOpen: false,
    isLegendOpen: false,
    isStructuralOpen: false,
    selectedSatellite: null,
    aiInsight: null,
    isInsightLoading: false,
    neuralMetrics: null,
    isNeuralLoading: false,
    agentState: { t0_state: 'idle', t1_state: 'idle' },
    simulateAgents: false,
    muted: false
};

function simReducer(state, action) {
    switch (action.type) {
        case 'SET_PROGRESS': return { ...state, progress: action.payload };
        case 'SET_METRICS': return { ...state, metrics: { ...state.metrics, ...action.payload } };
        case 'SET_PROOFS': return { ...state, proofs: { ...state.proofs, ...action.payload } };
        case 'TOGGLE_HUD': return { ...state, isHudOpen: !state.isHudOpen };
        case 'SET_HUD_OPEN': return { ...state, isHudOpen: action.payload };
        case 'TOGGLE_LEGEND': return { ...state, isLegendOpen: !state.isLegendOpen };
        case 'TOGGLE_STRUCTURAL': return { ...state, isStructuralOpen: !state.isStructuralOpen };
        case 'SET_SELECTED_SATELLITE': return { ...state, selectedSatellite: action.payload };
        case 'SET_AI_INSIGHT': return { ...state, aiInsight: action.payload };
        case 'SET_INSIGHT_LOADING': return { ...state, isInsightLoading: action.payload };
        case 'SET_NEURAL_METRICS': return { ...state, neuralMetrics: action.payload };
        case 'SET_NEURAL_LOADING': return { ...state, isNeuralLoading: action.payload };
        case 'SET_AGENT_STATE': return { ...state, agentState: action.payload };
        case 'TOGGLE_SIMULATE_AGENTS': return { ...state, simulateAgents: !state.simulateAgents };
        case 'SET_MUTED': return { ...state, muted: action.payload };
        default: return state;
    }
}

// --- 3D SUB-COMPONENTS ---

function SatelliteNode({ position, name, onSelect, isSelected }) {
    const mesh = useRef();
    useFrame((state) => {
        if (mesh.current) {
            mesh.current.rotation.y += 0.01;
            mesh.current.rotation.z += 0.005;
        }
    });

    return (
        <group position={position}>
            <mesh
                ref={mesh}
                onClick={(e) => { e.stopPropagation(); onSelect(name); }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = 'auto')}
            >
                <octahedronGeometry args={[1.5, 0]} />
                <meshStandardMaterial
                    color={isSelected ? "#fbbf24" : "#4299e1"}
                    emissive={isSelected ? "#fbbf24" : "#4299e1"}
                    emissiveIntensity={isSelected ? 5 : 1}
                    wireframe
                />
            </mesh>
            <Text
                position={[0, 2.5, 0]}
                fontSize={0.8}
                color="white"
                anchorX="center"
                anchorY="middle"
            >
                {name}
            </Text>
        </group>
    );
}

function FormationParticles({ count = 3000, targetRadius = 5, entropy = 0.5, gravity = 1.0, vitality = 50, topology = 'NUCLEUS', seedName = 'genesis' }) {
    const points = useRef();

    const particles = useMemo(() => {
        const rng = new SeededRNG(seedName);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const phases = new Float32Array(count);

        const colorBase = new THREE.Color("#00d9ff");
        const colorAnomaly = new THREE.Color("#ff0055");
        const colorValue = new THREE.Color("#fbbf24");

        for (let i = 0; i < count; i++) {
            const theta = rng.next() * Math.PI * 2;
            const phi = Math.acos(2 * rng.next() - 1);
            const startR = 30 + rng.next() * 10;

            positions[i * 3] = startR * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = startR * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = startR * Math.cos(phi);

            phases[i] = rng.next() * Math.PI * 2;

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
            } else if (topology === 'DISTRIBUTED') {
                const angle = particles.phases[i] + time * 0.05;
                const r = targetRadius * (2 + Math.sin(time * 0.2 + i * 0.01));
                const spread = 15;
                tx = r * Math.sin(angle) + (Math.sin(i * 0.05) * spread * entropy);
                ty = (Math.cos(i * 0.02) * spread * entropy);
                tz = r * Math.cos(angle) + (Math.cos(i * 0.05) * spread * entropy);
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

            // Disturbed Jitter based on Entropy
            const disturbance = Math.sin(time * 10 + i) * (jitterIntensity * 2);
            pos[i3] += disturbance;
            pos[i3 + 1] += Math.cos(time * 8 + i) * (jitterIntensity * 2);
            pos[i3 + 2] += disturbance;
        }
        points.current.geometry.attributes.position.needsUpdate = true;
        points.current.rotation.y += 0.002;
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

function AgentTrafficController({ satellites, active, t0Active, t1Active }) {
    // Traffic simulation placeholder
    return null; 
}

// --- MAIN COMPONENT ---

const NodeFormationSimulation = ({ connectionId, tableName, onExit }) => {
    const [simState, dispatch] = useReducer(simReducer, initialSimState);
    const { progress, metrics, proofs, isHudOpen, isLegendOpen, isStructuralOpen,
        selectedSatellite, aiInsight, isInsightLoading, neuralMetrics, isNeuralLoading,
        agentState, simulateAgents, muted } = simState;
    const [flowData, setFlowData] = useState(null);

    // Dispatch helpers
    const setIsHudOpen = (v) => dispatch({ type: 'SET_HUD_OPEN', payload: v });
    const setMuted = (v) => dispatch({ type: 'SET_MUTED', payload: v });
    const setAiInsight = (v) => dispatch({ type: 'SET_AI_INSIGHT', payload: v });
    const setIsInsightLoading = (v) => dispatch({ type: 'SET_INSIGHT_LOADING', payload: v });
    const setNeuralMetrics = (v) => dispatch({ type: 'SET_NEURAL_METRICS', payload: v });
    const setIsNeuralLoading = (v) => dispatch({ type: 'SET_NEURAL_LOADING', payload: v });
    const setSelectedSatellite = (v) => dispatch({ type: 'SET_SELECTED_SATELLITE', payload: v });

    useEffect(() => {
        const loadInitialData = async () => {
             try {
                const data = await apiClient.get(`/graph/flow/${connectionId}/${tableName}`);
                setFlowData(data);
                if (data.metrics) {
                    dispatch({ type: 'SET_METRICS', payload: data.metrics });
                }
             } catch (e) {
                logger.error("Failed to load formation data", e);
             }
        };
        if (connectionId && tableName) loadInitialData();
    }, [connectionId, tableName]);

    const toggleSound = () => {
        const isEnabled = soundSystem.toggle();
        setMuted(!isEnabled);
    };

    const handleExit = () => {
        if (!muted) soundSystem.play('nodeClick');
        onExit();
    };

    const handleSatelliteClick = (name) => {
        soundSystem.play('scanPulse');
        setSelectedSatellite(name);
        setIsHudOpen(true);
    };

    const handleRequestInsight = async () => {
        setIsInsightLoading(true);
        try {
            soundSystem.play('scanPulse');
            const data = await apiClient.get(`/evolution/analysis/insight/${connectionId}/${tableName}`);
            if (data.insight) setAiInsight(data.insight);
        } catch (e) {
            logger.error("AI Insight failed", e);
            setAiInsight("Neural Link Interrupted. Retry connection.");
        } finally {
            setIsInsightLoading(false);
        }
    };

    const handleNeuralAnalysis = async () => {
        if (!tableName) return;
        setIsNeuralLoading(true);
        try {
            soundSystem.play('scanPulse');
            const data = await apiClient.post('/ml/gnn/predict', { node_id: tableName, node_type: 'table' });
            setNeuralMetrics(data);
            soundSystem.play('formationAmbient');
        } catch (e) {
            logger.error("GNN Analysis failed", e);
        } finally {
            setIsNeuralLoading(false);
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
        const ent = metrics.entropy || 0;

        if (ent > 0.8) {
            return {
                type: 'DISTRIBUTED',
                desc: 'Whole Distributed Network',
                reason: 'High Entropy Dispersion indicates a decentralized state.',
                math_reason: 'Ent > 0.8'
            };
        }
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

    const selectedImpact = useMemo(() => {
        if (!selectedSatellite) return null;
        const satHash = getHash(selectedSatellite);
        const satMass = (satHash % 15) / 10 + 0.5;
        const centralMass = metrics.gravity || 1.0;
        const r_sq = 400;
        const force = (centralMass * satMass) / r_sq * 100;
        return {
            force: force.toFixed(4),
            mass: satMass.toFixed(2)
        };
    }, [selectedSatellite, metrics.gravity]);

    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0e1a]/95 backdrop-blur-2xl flex flex-col items-center justify-center">
            <div className="absolute top-8 left-8 flex flex-row w-full max-w-7xl px-8 justify-between items-start pointer-events-none">
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
                    {muted ? "AUDIO OFF" : "AUDIO ONLINE"}
                </button>
            </div>

            <button
                onClick={handleExit}
                className="absolute bottom-8 right-8 px-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all font-mono uppercase text-xs pointer-events-auto"
            >
                Close Visualization
            </button>

            <div className="absolute right-8 top-32 flex flex-col items-end pointer-events-none z-[50]">
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_STRUCTURAL' })}
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
                                Pattern: {topologyInfo.type}
                            </h4>
                            <p className="text-[10px] text-slate-300 font-mono italic">
                                "{aiInsight || 'Waiting for AI Insight...'}"
                            </p>
                            {!aiInsight && (
                                <button
                                    onClick={handleRequestInsight}
                                    disabled={isInsightLoading}
                                    className="w-full py-2 bg-cyan-500/10 border border-cyan-500 text-cyan-500 rounded text-[10px] font-bold"
                                >
                                    {isInsightLoading ? "ANALYZING..." : "REQUEST AI INSIGHT"}
                                </button>
                            )}
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
                                seedName={tableName}
                            />
                            <Text position={[0, 0, 0]} fontSize={1.2} color="white" anchorX="center" anchorY="middle" maxWidth={10} textAlign="center">
                                {tableName.toUpperCase()}
                            </Text>
                        </group>

                        {satellites.map((sat) => (
                            <SatelliteNode
                                key={sat.id}
                                position={sat.position}
                                name={sat.id}
                                onSelect={handleSatelliteClick}
                                isSelected={selectedSatellite === sat.id}
                            />
                        ))}

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

            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8 pointer-events-none flex flex-col items-center">
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_HUD' })}
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
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Structural Gravity</p>
                                        <div className="text-3xl font-bold text-white font-mono">
                                            {Number(metrics.gravity).toFixed(4)} <span className="text-sm font-normal text-slate-500">N</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Shannon Entropy</p>
                                        <div className="text-3xl font-bold text-white font-mono">
                                            {Number(metrics.entropy).toFixed(4)} <span className="text-sm font-normal text-slate-500">H(x)</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 pt-4 border-t border-white/10 flex justify-between">
                                        <button
                                            onClick={handleNeuralAnalysis}
                                            disabled={isNeuralLoading}
                                            className="text-[10px] text-indigo-400 font-mono uppercase hover:text-indigo-300 transition-colors"
                                        >
                                            {isNeuralLoading ? "SCANNING..." : "RUN GNN ANALYSIS"}
                                        </button>
                                        {neuralMetrics && (
                                            <span className="text-[10px] text-emerald-400 font-mono uppercase">
                                                Impact Prob: {(neuralMetrics.importance * 100).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-8 relative">
                                    <button
                                        onClick={() => setSelectedSatellite(null)}
                                        className="absolute -top-4 -right-2 text-[10px] text-slate-400 hover:text-white px-2 py-1 bg-white/5 rounded border border-white/10"
                                    >BACK TO GLOBAL</button>
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-[var(--primary-cyan)] uppercase tracking-widest">Influence: {selectedSatellite}</p>
                                        <div className="text-xl font-bold text-white font-mono">{selectedImpact?.force} N</div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default NodeFormationSimulation;
