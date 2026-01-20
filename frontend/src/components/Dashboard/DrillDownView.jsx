import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRegisterCommand } from '../../context/CommandRegistryContext';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Billboard } from '@react-three/drei';
import { ArrowLeft, Loader, Database, GitBranch, Binary, BrainCircuit, Play } from 'lucide-react';
import * as THREE from 'three';
import IntelligencePanel from './IntelligencePanel';
import NodeFormationSimulation from '../Evolution/NodeFormationSimulation';
import soundSystem from '../../utils/SoundSystem';

// Intelligence Panel Integration - Deep Analysis Feature
export default function DrillDownView({ connectionId, tableName, onBack, initialShowSimulation = false }) {
    const [flowData, setFlowData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [recordData, setRecordData] = useState(null);
    const [showSimulation, setShowSimulation] = useState(initialShowSimulation);

    useEffect(() => {
        if (initialShowSimulation) {
            console.log(`[DrillDownView] Auto-starting simulation for ${tableName}`);
            setShowSimulation(true);
        }
    }, [initialShowSimulation, tableName]);

    // --- VOICE COMMAND REGISTRATION ---
    const handleNav = useCallback(({ instruction, target }) => {
        if (instruction === 'go_back') {
            console.log("[DrillDownView] Voice Command: Going back to overview");
            onBack();
        } else if (instruction === 'drill_down' && (!target || target === tableName)) {
            console.log("[DrillDownView] Voice Command: Cascaded drill down detected. Triggering simulation.");
            setShowSimulation(true);
        }
    }, [onBack, tableName]);

    const handleEvolution = useCallback(({ instruction }) => {
        if (instruction === 'simulate_formation') {
            console.log("[DrillDownView] Voice Command: Simulating formation");
            setShowSimulation(true);
        }
    }, []);

    useRegisterCommand('ui_navigation', handleNav);
    useRegisterCommand('graph_evolution', handleEvolution);

    useEffect(() => {
        if (!connectionId || !tableName) return;

        const fetchFlowData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/data-flow/${connectionId}/${tableName}`);
                if (!response.ok) throw new Error('Failed to fetch flow data');
                const data = await response.json();
                setFlowData(data);

                // If the backend returned an error in the JSON but status 200/OK (defensive)
                if (data.error) {
                    setError(data.error);
                } else {
                    setError(null);
                }

                // Auto-fetch records for the primary table
                setSelectedNode(tableName);
                const recordsResponse = await fetch(`/api/drilldown/${connectionId}/table/${tableName}?limit=10`);
                if (recordsResponse.ok) {
                    const recordsData = await recordsResponse.json();
                    if (recordsData.error) {
                        setRecordData({ columns: [], records: [], error: recordsData.error });
                    } else {
                        setRecordData(recordsData);
                    }
                }
            } catch (err) {
                console.error('Flow data fetch error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchFlowData();
    }, [connectionId, tableName]);

    const handleNodeClick = async (nodeId) => {
        setSelectedNode(nodeId);
        try {
            const response = await fetch(`/api/drilldown/${connectionId}/table/${nodeId}?limit=10`);
            if (response.ok) {
                const data = await response.json();
                setRecordData(data);
            }
        } catch (err) {
            console.error('Failed to fetch records:', err);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader className="animate-spin text-[var(--primary-cyan)]" size={32} />
                    <p className="text-[var(--text-secondary)] font-mono text-sm">
                        Analyzing data flow for {tableName}...
                    </p>
                </div>
            </div>
        );
    }

    if (error && !flowData) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#0a0e1a]">
                <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 p-8 rounded-2xl text-center backdrop-blur-xl">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Binary className="text-red-400" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 uppercase font-mono tracking-tighter">Relation Not Found</h2>
                    <p className="text-[var(--text-secondary)] mb-6 text-sm leading-relaxed">
                        The neural topology is referencing a node <span className="text-red-400 font-mono">'{tableName}'</span> that does not physically exist in the current database snapshot.
                    </p>
                    <button
                        onClick={onBack}
                        className="w-full px-6 py-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-100 font-bold uppercase text-xs hover:bg-red-500/30 transition-all"
                    >
                        ← Return to Overview
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative bg-[var(--bg-primary)] overflow-hidden">
            {/* 1. UI Layer (Top) */}
            <div className="absolute top-4 left-4 z-50 flex items-center gap-4 pointer-events-auto">
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-[var(--bg-secondary)]/80 backdrop-blur-md border border-white/10 rounded-lg hover:bg-[var(--bg-secondary)] transition-all flex items-center gap-2 cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    <span className="font-mono text-xs uppercase">Back to Overview</span>
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent event bubbling
                        soundSystem.play('nodeClick');
                        setShowSimulation(true);
                    }}
                    className="px-6 py-3 bg-[var(--primary-cyan)] text-black font-bold uppercase text-xs rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,217,255,0.5)] flex items-center gap-2 cursor-pointer"
                >
                    <Play size={14} fill="currentColor" />
                    Simulate Node Formation
                </button>
            </div>

            {/* 2. Sidebar Layer (Top-Right) */}
            <div className="absolute top-4 right-4 z-40 w-80 space-y-4 pointer-events-auto">
                {/* Global Data Flow Info */}
                <div className="bg-[var(--bg-primary)]/90 backdrop-blur-md border border-white/10 rounded-lg p-4">
                    <h3 className="text-[var(--primary-cyan)] font-mono text-xs uppercase mb-2 flex items-center gap-2">
                        <GitBranch size={14} />
                        Topology Context
                    </h3>
                    <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                        <p><span className="text-[var(--text-primary)]">Table:</span> <span className="text-[var(--primary-cyan)]">{tableName}</span></p>
                        <p><span className="text-[var(--text-primary)]">Connected Nodes:</span> {flowData?.nodes?.length || 0}</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-[var(--text-primary)] font-mono text-xs mb-2">Relationship Types:</p>
                        <div className="grid grid-cols-2 gap-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[var(--primary-cyan)]"></div>
                                <span className="text-[10px] uppercase">FK</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                <span className="text-[10px] uppercase">AI Link</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integration Node Analysis */}
                <div className="bg-[var(--bg-primary)]/90 backdrop-blur-md border border-white/10 rounded-lg p-4">
                    <h3 className="text-white font-mono text-xs uppercase mb-4 flex items-center gap-2">
                        <BrainCircuit size={14} className="text-[var(--primary-cyan)]" />
                        Deep Analysis
                    </h3>
                    <IntelligencePanel
                        connectionId={connectionId}
                        tableName={tableName}
                        onSimulate={() => setShowSimulation(true)}
                    />
                </div>

                {hoveredNode && (
                    <div className="bg-[var(--bg-primary)]/90 backdrop-blur-md border border-white/10 rounded-lg p-3 animate-in fade-in slide-in-from-right-4">
                        <p className="text-[var(--primary-cyan)] font-mono text-[10px] uppercase mb-1">Hovered Node:</p>
                        <p className="text-[var(--text-primary)] text-sm font-semibold truncate">{hoveredNode.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                            {hoveredNode.row_count?.toLocaleString() || 0} records
                        </p>
                    </div>
                )}
            </div>

            {selectedNode && recordData && (
                <div className="absolute bottom-4 left-4 right-4 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-md border border-white/10 rounded-lg p-4 max-h-64 overflow-auto">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[var(--primary-cyan)] font-mono text-xs uppercase flex items-center gap-2">
                            <Database size={14} />
                            Sample Records: {selectedNode}
                        </h3>
                        <button
                            onClick={() => setSelectedNode(null)}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs"
                        >
                            Close
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/10">
                                    {recordData.columns?.map((col, i) => (
                                        <th key={i} className="text-left p-2 text-[var(--text-secondary)] font-mono">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recordData.records?.slice(0, 5).map((record, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                        {recordData.columns?.map((col, j) => (
                                            <td key={j} className="p-2 text-[var(--text-primary)]">
                                                {String(record[col] ?? 'NULL').substring(0, 50)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. 3D Canvas Layer (Background) */}
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 500], fov: 75 }}>
                    <color attach="background" args={['#0a0e1a']} />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} />

                    <FlowGraph
                        data={flowData}
                        tableName={tableName}
                        columns={recordData?.columns}
                        onNodeHover={setHoveredNode}
                        onNodeClick={handleNodeClick}
                    />

                    <OrbitControls
                        enableDamping
                        dampingFactor={0.05}
                        minDistance={100}
                        maxDistance={1000}
                    />
                </Canvas>
            </div>

            {showSimulation && (
                <NodeFormationSimulation
                    connectionId={connectionId}
                    tableName={tableName}
                    flowData={flowData}
                    onExit={() => setShowSimulation(false)}
                />
            )}
        </div>
    );
}

function FlowGraph({ data, tableName, columns, onNodeHover, onNodeClick }) {
    const groupRef = useRef();

    if (!data || !data.nodes || data.nodes.length === 0) {
        return null;
    }

    const centerNode = data.nodes.find(n => n.id === tableName);

    // --- Layout Logic ---
    // Center: The Selected Table
    // Primary Ring (Inner): The Table's Columns (Schema Structure)
    // Secondary Ring (Outer): Connected Foreign Key Tables

    // 1. Prepare Column Nodes (Primary Ring)
    // We create artificial nodes for the columns if provided
    const primaryRingNodes = (columns || []).map(colName => ({
        id: `col-${colName}`,
        name: colName,
        type: 'column',
        row_count: 0 // Columns don't have row counts, they get a fixed/small size
    }));

    // 2. Prepare Related Table Nodes (Secondary Ring)
    // All nodes from the data flow that Aren't the center table are related tables
    const secondaryRingNodes = data.nodes.filter(n => n.id !== tableName);

    const nodePositions = {};
    nodePositions[tableName] = { x: 0, y: 0, z: 0 };

    // --- Circle Packing Layout positions ---

    // 1. Primary Ring (Columns) - Radius 120 (Close orbit)
    // Pearl white, small nodes representing the internal structure
    const r1 = 120;
    const step1 = primaryRingNodes.length > 0 ? (2 * Math.PI) / primaryRingNodes.length : 0;
    primaryRingNodes.forEach((node, i) => {
        const angle = i * step1;
        nodePositions[node.id] = {
            x: r1 * Math.cos(angle),
            y: (i % 2 === 0 ? 1 : -1) * 10, // Minimal wave
            z: r1 * Math.sin(angle)
        };
    });

    // 2. Secondary Ring (Related Tables) - Radius 300 (Outer orbit)
    // Gold nodes representing external connections
    const r2 = 300;
    const step2 = secondaryRingNodes.length > 0 ? (2 * Math.PI) / secondaryRingNodes.length : 0;
    secondaryRingNodes.forEach((node, i) => {
        // Offset angle to stagger nicely against gaps if any
        const angle = i * step2;
        nodePositions[node.id] = {
            x: r2 * Math.cos(angle),
            y: (i % 2 === 0 ? 1 : -1) * 40, // Larger wave
            z: r2 * Math.sin(angle)
        };
    });

    return (
        <group ref={groupRef}>
            {/* Center Node */}
            {centerNode && (
                <group position={[0, 0, 0]}>
                    <mesh
                        onPointerOver={() => onNodeHover(centerNode)}
                        onPointerOut={() => onNodeHover(null)}
                        onClick={() => onNodeClick(centerNode.id)}
                    >
                        <sphereGeometry args={[Math.min(25 + ((centerNode.row_count || 0) / 10000), 50), 32, 32]} />
                        <meshPhysicalMaterial
                            color="#00d9ff"
                            emissive="#00d9ff"
                            emissiveIntensity={0.8}
                            metalness={0.2}
                            roughness={0.1}
                            clearcoat={1.0}
                        />
                    </mesh>
                    <Billboard>
                        <Text
                            position={[0, -40, 0]}
                            fontSize={10}
                            color="#00d9ff"
                            anchorX="center"
                            anchorY="middle"
                        >
                            {centerNode.name}
                        </Text>
                    </Billboard>
                </group>
            )}

            {/* Primary Ring: Columns */}
            {primaryRingNodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;

                return (
                    <group key={node.id} position={[pos.x, pos.y, pos.z]}>
                        <mesh
                            onPointerOver={() => onNodeHover(node)}
                            onPointerOut={() => onNodeHover(null)}
                        >
                            {/* Columns are small, uniform pearls */}
                            <sphereGeometry args={[8, 16, 16]} />
                            <meshStandardMaterial
                                color="#ffffff"
                                emissive="#ffffff"
                                emissiveIntensity={0.2}
                                roughness={0.3}
                            />
                        </mesh>
                        <Billboard>
                            <Text
                                position={[0, -14, 0]}
                                fontSize={4}
                                color="#a3b3cc" // Muted text for columns
                                anchorX="center"
                                anchorY="middle"
                            >
                                {node.name}
                            </Text>
                        </Billboard>
                    </group>
                );
            })}

            {/* Secondary Ring: Related Tables */}
            {secondaryRingNodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;

                const size = Math.min(12 + ((node.row_count || 0) / 5000), 30);
                // Gold for related tables
                const color = '#fbbf24';

                return (
                    <group key={node.id} position={[pos.x, pos.y, pos.z]}>
                        <mesh
                            onPointerOver={() => onNodeHover(node)}
                            onPointerOut={() => onNodeHover(null)}
                            onClick={() => onNodeClick(node.id)}
                        >
                            <sphereGeometry args={[size, 32, 32]} />
                            <meshStandardMaterial
                                color={color}
                                emissive={color}
                                emissiveIntensity={0.4}
                            />
                        </mesh>
                        <Billboard>
                            <Text
                                position={[0, -size - 10, 0]}
                                fontSize={6}
                                color="#ffffff"
                                anchorX="center"
                                anchorY="middle"
                            >
                                {node.name}
                            </Text>
                            <Text
                                position={[0, -size - 18, 0]}
                                fontSize={4}
                                color={color}
                                anchorX="center"
                                anchorY="middle"
                            >
                                Relation
                            </Text>
                        </Billboard>
                    </group>
                );
            })}

            {/* Edges */}
            {data.edges && data.edges.map((edge, index) => {
                const sourcePos = nodePositions[edge.source];
                const targetPos = nodePositions[edge.target];

                if (!sourcePos || !targetPos) return null;

                const start = new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z);
                const end = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
                const points = [start, end];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);

                // Blue for FK, Gold for Inferred
                const color = edge.type === 'fk' ? '#00ff88' : '#fbbf24';

                return (
                    <group key={`edge-${index}`}>
                        <line geometry={geometry}>
                            <lineBasicMaterial color={color} opacity={0.3} transparent linewidth={1} />
                        </line>
                    </group>
                );
            })}
        </group>
    );
}
