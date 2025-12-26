import React, { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { ArrowLeft, Loader, Database, GitBranch } from 'lucide-react';
import * as THREE from 'three';

export default function DrillDownView({ connectionId, tableName, onBack }) {
    const [flowData, setFlowData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [recordData, setRecordData] = useState(null);

    useEffect(() => {
        if (!connectionId || !tableName) return;

        const fetchFlowData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/data-flow/${connectionId}/${tableName}`);
                if (!response.ok) throw new Error('Failed to fetch flow data');
                const data = await response.json();
                setFlowData(data);
                setError(null);

                // Auto-fetch records for the primary table
                setSelectedNode(tableName);
                const recordsResponse = await fetch(`/api/drilldown/${connectionId}/table/${tableName}?limit=10`);
                if (recordsResponse.ok) {
                    const recordsData = await recordsResponse.json();
                    setRecordData(recordsData);
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

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">Error: {error}</p>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 bg-[var(--primary-cyan)]/20 border border-[var(--primary-cyan)] rounded-lg hover:bg-[var(--primary-cyan)]/30 transition-all"
                    >
                        ← Back to Overview
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <button
                onClick={onBack}
                className="absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 bg-[var(--bg-primary)]/90 backdrop-blur-md border border-white/10 rounded-lg hover:border-[var(--primary-cyan)] transition-all"
            >
                <ArrowLeft size={16} />
                <span className="font-mono text-xs uppercase">Back to Overview</span>
            </button>

            <div className="absolute top-4 right-4 z-10 bg-[var(--bg-primary)]/90 backdrop-blur-md border border-white/10 rounded-lg p-4 max-w-xs">
                <h3 className="text-[var(--primary-cyan)] font-mono text-xs uppercase mb-2 flex items-center gap-2">
                    <GitBranch size={14} />
                    Data Flow Analysis
                </h3>
                <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                    <p><span className="text-[var(--text-primary)]">Table:</span> {tableName}</p>
                    <p><span className="text-[var(--text-primary)]">Connected Nodes:</span> {flowData?.nodes?.length || 0}</p>
                    <p><span className="text-[var(--text-primary)]">Relationships:</span> {flowData?.edges?.length || 0}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-[var(--text-primary)] font-mono text-xs mb-2">Relationship Types:</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-[var(--primary-cyan)]"></div>
                            <span className="text-xs">Foreign Key</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-yellow-400"></div>
                            <span className="text-xs">AI Inferred</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-purple-400"></div>
                            <span className="text-xs">Semantic</span>
                        </div>
                    </div>
                </div>

                {hoveredNode && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-[var(--primary-cyan)] font-mono text-xs mb-1">Hovered Node:</p>
                        <p className="text-[var(--text-primary)] text-sm font-semibold">{hoveredNode.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                            {hoveredNode.row_count?.toLocaleString() || 0} records
                        </p>
                    </div>
                )}
            </div>

            {selectedNode && recordData && (
                <div className="absolute bottom-4 left-4 right-4 z-10 bg-[var(--bg-primary)]/95 backdrop-blur-md border border-white/10 rounded-lg p-4 max-h-64 overflow-auto">
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

            <Canvas camera={{ position: [0, 0, 500], fov: 75 }}>
                <color attach="background" args={['#0a0e1a']} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />

                <FlowGraph
                    data={flowData}
                    tableName={tableName}
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
    );
}

function FlowGraph({ data, tableName, onNodeHover, onNodeClick }) {
    const groupRef = useRef();

    if (!data || !data.nodes || data.nodes.length === 0) {
        return null;
    }

    const centerNode = data.nodes.find(n => n.id === tableName);
    const relatedNodes = data.nodes.filter(n => n.id !== tableName);

    const radius = 200;
    const angleStep = (2 * Math.PI) / Math.max(relatedNodes.length, 1);

    const nodePositions = {};
    nodePositions[tableName] = { x: 0, y: 0, z: 0 };

    relatedNodes.forEach((node, index) => {
        const angle = index * angleStep;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const y = (index % 2) * 50 - 25;
        nodePositions[node.id] = { x, y, z };
    });

    return (
        <group ref={groupRef}>
            {centerNode && (
                <group position={[0, 0, 0]}>
                    <mesh
                        onPointerOver={() => onNodeHover(centerNode)}
                        onPointerOut={() => onNodeHover(null)}
                        onClick={() => onNodeClick(centerNode.id)}
                    >
                        <sphereGeometry args={[20, 32, 32]} />
                        <meshStandardMaterial
                            color="#00d9ff"
                            emissive="#00d9ff"
                            emissiveIntensity={0.5}
                        />
                    </mesh>
                    <Text
                        position={[0, -30, 0]}
                        fontSize={8}
                        color="#00d9ff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {centerNode.name}
                    </Text>
                </group>
            )}

            {relatedNodes.map((node) => {
                const pos = nodePositions[node.id];
                const size = Math.min(12 + (node.row_count || 0) / 10000, 18);

                return (
                    <group key={node.id} position={[pos.x, pos.y, pos.z]}>
                        <mesh
                            onPointerOver={() => onNodeHover(node)}
                            onPointerOut={() => onNodeHover(null)}
                            onClick={() => onNodeClick(node.id)}
                        >
                            <sphereGeometry args={[size, 32, 32]} />
                            <meshStandardMaterial
                                color={node.type === 'primary' ? '#00d9ff' : '#64748b'}
                                emissive={node.type === 'primary' ? '#00d9ff' : '#64748b'}
                                emissiveIntensity={0.3}
                            />
                        </mesh>
                        <Text
                            position={[0, -size - 8, 0]}
                            fontSize={6}
                            color="#ffffff"
                            anchorX="center"
                            anchorY="middle"
                        >
                            {node.name}
                        </Text>
                    </group>
                );
            })}

            {data.edges && data.edges.map((edge, index) => {
                const sourcePos = nodePositions[edge.source];
                const targetPos = nodePositions[edge.target];

                if (!sourcePos || !targetPos) return null;

                const start = new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z);
                const end = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
                const points = [start, end];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);

                const color = edge.type === 'fk' ? '#00d9ff'
                    : edge.type === 'inferred' ? '#fbbf24'
                        : '#a855f7';

                const midpoint = new THREE.Vector3().lerpVectors(start, end, 0.5);

                return (
                    <group key={`edge-${index}`}>
                        <line geometry={geometry}>
                            <lineBasicMaterial color={color} opacity={0.6} transparent linewidth={2} />
                        </line>
                        {edge.column && (
                            <Text
                                position={[midpoint.x, midpoint.y + 10, midpoint.z]}
                                fontSize={4}
                                color={color}
                                anchorX="center"
                                anchorY="middle"
                            >
                                {edge.column}
                            </Text>
                        )}
                    </group>
                );
            })}
        </group>
    );
}
