/**
 * TrafficDashboard.jsx
 * Location: frontend/src/components/Dashboard/TrafficDashboard/index.jsx
 *
 * Full-page Traffic Intelligence Dashboard.
 * Completely separate from the main graph — triggered via sidebar button.
 * Works with or without live backend data (graceful fallback to demo data).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import apiClient from '../../../utils/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  Activity, TrendingUp, AlertTriangle, CheckCircle, Zap,
  RefreshCw, X, ChevronRight, BarChart2, Cpu, Database,
  AlertCircle, Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  critical: { color: '#ff2d2d', bg: 'rgba(255,45,45,0.12)', border: 'rgba(255,45,45,0.3)', label: 'Critical', range: '80-100' },
  high:     { color: '#ff9900', bg: 'rgba(255,153,0,0.12)',  border: 'rgba(255,153,0,0.3)',  label: 'High',     range: '60-80' },
  moderate: { color: '#ffd700', bg: 'rgba(255,215,0,0.10)',  border: 'rgba(255,215,0,0.25)', label: 'Moderate', range: '30-60' },
  low:      { color: '#00ff88', bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.2)',  label: 'Low',      range: '0-30' },
};

// ─── Demo data (mirrors backend _demo_nodes) ─────────────────────────────────

const DEMO_NODES = [
  { table: 'orders',    score: 92, level: 'critical' },
  { table: 'payments',  score: 85, level: 'critical' },
  { table: 'invoices',  score: 71, level: 'high' },
  { table: 'customers', score: 68, level: 'high' },
  { table: 'refunds',   score: 63, level: 'high' },
  { table: 'inventory', score: 49, level: 'moderate' },
  { table: 'products',  score: 45, level: 'moderate' },
  { table: 'shipments', score: 28, level: 'low' },
  { table: 'users',     score: 22, level: 'low' },
];

const DEMO_ALERTS = [
  { id: 'a1', level: 'critical', title: 'High Traffic Detected',  message: 'orders table traffic is critical (92)',          time: '10:24:31 AM', icon: '🔴' },
  { id: 'a2', level: 'high',     title: 'Slow Query Detected',    message: 'Query on payments table taking longer than usual', time: '10:23:45 AM', icon: '⚠️' },
  { id: 'a3', level: 'moderate', title: 'Anomaly Detected',       message: 'Unusual increase in refunds table activity',      time: '10:22:18 AM', icon: '📊' },
];

const DEMO_DIST = { critical: 18, high: 32, moderate: 45, low: 33, total: 128 };

function genDemoHistory(table, pts = 60) {
  const bases = { orders: 88, payments: 82, invoices: 68, customers: 65, refunds: 60, inventory: 46, products: 42, shipments: 25, users: 20 };
  const base = bases[table] ?? 30;
  return Array.from({ length: pts }, (_, i) => ({
    ts: Date.now() / 1000 - (pts - i) * 10,
    score: Math.max(0, Math.min(100, base + Math.sin(i * 0.3) * 8 + (Math.random() - 0.5) * 8)),
  }));
}

// ─── Traffic Graph (sparkline / full line chart) ─────────────────────────────

function TrafficLineChart({ history, color, height = 80 }) {
  const svgRef = useRef(null);
  const W = 400, H = height;

  const points = useMemo(() => {
    if (!history || history.length < 2) return '';
    const min = 0, max = 100;
    return history.map((p, i) => {
      const x = (i / (history.length - 1)) * W;
      const y = H - ((p.score - min) / (max - min)) * H;
      return `${x},${y}`;
    }).join(' ');
  }, [history, H]);

  const areaPoints = useMemo(() => {
    if (!points) return '';
    return `${points} ${W},${H} 0,${H}`;
  }, [points, H, W]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`tg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[25, 50, 75].map(v => (
        <line key={v} x1={0} y1={H - (v/100)*H} x2={W} y2={H - (v/100)*H}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {/* Area fill */}
      {areaPoints && (
        <polygon points={areaPoints} fill={`url(#tg-${color.replace('#','')})`} />
      )}
      {/* Line */}
      {points && (
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />
      )}
      {/* Latest dot */}
      {history && history.length > 0 && (() => {
        const last = history[history.length - 1];
        const x = W;
        const y = H - (last.score / 100) * H;
        return (
          <g>
            <circle cx={x} cy={y} r={4} fill={color} opacity={0.9} />
            <circle cx={x} cy={y} r={7} fill="none" stroke={color} strokeWidth={1} opacity={0.4}>
              <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })()}
    </svg>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({ distribution }) {
  const total = distribution.total || 1;
  const segments = [
    { key: 'critical', value: distribution.critical, ...LEVEL_CONFIG.critical },
    { key: 'high',     value: distribution.high,     ...LEVEL_CONFIG.high },
    { key: 'moderate', value: distribution.moderate, ...LEVEL_CONFIG.moderate },
    { key: 'low',      value: distribution.low,      ...LEVEL_CONFIG.low },
  ];

  const R = 70, r = 48, cx = 80, cy = 80;
  let cumAngle = -Math.PI / 2;

  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const angle = pct * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cumAngle);
    const y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle);
    const y2 = cy + R * Math.sin(cumAngle);
    const xi1 = cx + r * Math.cos(cumAngle);
    const yi1 = cy + r * Math.sin(cumAngle);
    const xi2 = cx + r * Math.cos(cumAngle - angle);
    const yi2 = cy + r * Math.sin(cumAngle - angle);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi2} ${yi2} Z`;
    return { ...seg, d, pct };
  });

  return (
    <svg viewBox="0 0 160 160" className="w-full max-w-[160px]">
      {arcs.map(arc => (
        <path key={arc.key} d={arc.d} fill={arc.color} opacity={0.9}
          style={{ filter: `drop-shadow(0 0 4px ${arc.color}50)` }} />
      ))}
      <circle cx={cx} cy={cy} r={r - 2} fill="rgba(5,10,15,0.95)" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="monospace">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" letterSpacing="1">
        TOTAL TABLES
      </text>
    </svg>
  );
}

// ─── 3D-style node graph (canvas) ────────────────────────────────────────────

function TrafficGraph({ nodes, selectedNode, onSelectNode }) {
  if (!nodes.length) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Scene nodes={nodes} selectedNode={selectedNode} onSelectNode={onSelectNode} />
        
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}

function Scene({ nodes, selectedNode, onSelectNode }) {
  const hubNode = nodes[0];
  const surroundingNodes = nodes.slice(1);

  return (
    <>
      {/* Hub Node */}
      <NodeMesh 
        node={hubNode} 
        position={[0, 0, 0]} 
        isHub={true}
        isSelected={selectedNode?.table === hubNode.table}
        onClick={() => onSelectNode(hubNode)}
      />

      {/* Surrounding Nodes */}
      {surroundingNodes.map((node, i) => {
        const angle = (i / surroundingNodes.length) * Math.PI * 2;
        const radius = 2.5 + (node.score / 100) * 0.5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.6;
        const z = Math.sin(angle) * radius * 0.3;

        return (
          <React.Fragment key={node.table}>
            {/* Edge */}
            <Line
              points={[[0, 0, 0], [x, y, z]]}
              color={LEVEL_CONFIG[node.level]?.color || '#00ff88'}
              lineWidth={1.5}
              transparent
              opacity={0.6}
            />
            
            {/* Moving Particle */}
            <MovingParticle start={[0,0,0]} end={[x,y,z]} color={LEVEL_CONFIG[node.level]?.color} />

            {/* Node */}
            <NodeMesh
              node={node}
              position={[x, y, z]}
              isSelected={selectedNode?.table === node.table}
              onClick={() => onSelectNode(node)}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

function NodeMesh({ node, position, isHub, isSelected, onClick }) {
  const cfg = LEVEL_CONFIG[node.level] || LEVEL_CONFIG.low;
  const size = isHub ? 0.4 : 0.2 + (node.score / 100) * 0.1;
  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      const pulse = 1 + Math.sin(t * (isHub ? 2 : 3)) * 0.05;
      ref.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref} onClick={onClick}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial 
          color={isHub ? '#ff2d2d' : cfg.color} 
          emissive={isHub ? '#ff2d2d' : cfg.color}
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      
      {/* Selected Ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size + 0.05, size + 0.08, 32]} />
          <meshBasicMaterial color={cfg.color} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Label */}
      {!isHub && (
        <Html distanceFactor={10} position={[0, size + 0.2, 0]} center>
          <div style={{
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '8px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            background: 'rgba(5, 10, 18, 0.9)',
            padding: '4px 8px',
            borderRadius: '4px',
            border: `1px solid ${cfg.border}`,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          }}>
            <span style={{ fontSize: '9px', color: 'white', fontWeight: 800 }}>{node.table}</span>
            <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.6)' }}>Score: {Math.round(node.score)}</span>
            <span style={{ fontSize: '7px', color: cfg.color, fontWeight: '800' }}>{node.level ? node.level.toUpperCase() : 'LOW'}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function MovingParticle({ start, end, color }) {
  const ref = useRef();
  
  useFrame((state) => {
    if (ref.current) {
      const t = (state.clock.getElapsedTime() * 0.5) % 1;
      ref.current.position.set(
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t
      );
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

// ─── Panel components ─────────────────────────────────────────────────────────

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        {title}
      </span>
      {action && (
        <button onClick={onAction} style={{ fontSize: 10, color: '#0de7f2', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
          {action}
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function TrafficDashboard({ connectionId, onClose }) {
  const [nodes, setNodes] = useState(DEMO_NODES);
  const [distribution, setDistribution] = useState(DEMO_DIST);
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [selectedNode, setSelectedNode] = useState(DEMO_NODES[0]);
  const [history, setHistory] = useState(() => genDemoHistory('orders'));
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showFullReport, setShowFullReport] = useState(false);

  // Fetch live data
  useEffect(() => {
    if (!connectionId) return;
    
    const fetchData = async () => {
      try {
        const scoresRes = await apiClient.get(`/traffic/scores?connection_id=${connectionId}`);
        if (scoresRes.data) setNodes(scoresRes.data);
        
        const distRes = await apiClient.get(`/traffic/distribution?connection_id=${connectionId}`);
        if (distRes.data) setDistribution(distRes.data);
        
        const alertsRes = await apiClient.get(`/traffic/alerts?connection_id=${connectionId}`);
        if (alertsRes.alerts) setAlerts(alertsRes.alerts);
        
        setLastUpdated(new Date());
      } catch (e) {
        console.error('Failed to fetch traffic data:', e);
      }
    };
    
    fetchData();
    const tick = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(tick);
  }, [connectionId]);

  // Update history when selected node changes
  useEffect(() => {
    if (selectedNode && connectionId) {
      const fetchHistory = async () => {
        try {
          const res = await apiClient.get(`/traffic/history/${selectedNode.table}?connection_id=${connectionId}`);
          if (res.history) setHistory(res.history);
        } catch (e) {
          console.error('Failed to fetch history:', e);
          setHistory(genDemoHistory(selectedNode.table)); // fallback
        }
      };
      fetchHistory();
    }
  }, [selectedNode?.table, connectionId]);

  // Compute insights for selected node
  useEffect(() => {
    if (!selectedNode) return;
    const fetchInsights = async () => {
      try {
        const res = await apiClient.get(`/traffic/insights/${selectedNode.table}?score=${selectedNode.score}&level=${selectedNode.level}`);
        if (res.data) setInsights(res.data);
      } catch (e) {
        console.error('Failed to fetch insights:', e);
        const level = selectedNode.level;
        const rootCauses = {
          critical: 'High insert rate and slow queries causing backlog in order processing.',
          high:     'Elevated read/write concurrency with suboptimal index coverage.',
          moderate: 'Moderate load with occasional query spikes detected.',
          low:      'Table is operating within normal parameters.',
        };
        const recs = {
          critical: ['Add index on (customer_id, created_at)', 'Optimize slow queries (3 detected)', 'Consider partitioning by date', 'Enable caching for read-heavy queries'],
          high:     ['Review N+1 query patterns', 'Add missing FK indexes', 'Monitor autovacuum settings', 'Consider read replicas'],
          moderate: ['Schedule ANALYZE off-peak', 'Review index usage stats', 'Consider archiving old data'],
          low:      ['Table is operating normally', 'Continue monitoring for trend changes'],
        };
        setInsights({
          root_cause: rootCauses[level] || 'Unable to compute recommendations at this time.',
          recommendations: recs[level] || ['Monitor table health and retry.'],
        });
      }
    };
    fetchInsights();
  }, [selectedNode?.table, selectedNode?.score, selectedNode?.level]);

  const sortedNodes = useMemo(() =>
    [...nodes].sort((a, b) => b.score - a.score),
  [nodes]);

  const topNodes = sortedNodes.filter(n => n.score > 60);

  const panelStyle = {
    background: 'rgba(5, 10, 18, 0.85)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 16,
    backdropFilter: 'blur(20px)',
  };

  const cfg = selectedNode ? (LEVEL_CONFIG[selectedNode.level] || LEVEL_CONFIG.low) : LEVEL_CONFIG.low;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(2, 6, 12, 0.97)',
        display: 'grid',
        gridTemplateColumns: '220px 1fr 260px',
        gridTemplateRows: 'auto 1fr auto',
        gap: 10,
        padding: 10,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* ── TOP BAR ────────────────────────────────────────────────────── */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        ...panelStyle, padding: '10px 16px',
      }}>
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '0.1em' }}>
            Traffic Level
          </span>
          {Object.entries(LEVEL_CONFIG).map(([key, c]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                {c.label} ({c.range})
              </span>
            </div>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(13,231,242,0.08)', border: '1px solid rgba(13,231,242,0.2)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0de7f2', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 9, color: '#0de7f2', fontWeight: 700, letterSpacing: '0.1em' }}>
              LIVE · {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── LEFT: TOP TRAFFIC TABLES ───────────────────────────────────── */}
      <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SectionHeader title="Top Traffic Tables" action="View All" />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedNodes.map((node, i) => {
            const c = LEVEL_CONFIG[node.level] || LEVEL_CONFIG.low;
            const isSelected = selectedNode?.table === node.table;
            return (
              <motion.button
                key={node.table}
                whileHover={{ x: 2 }}
                onClick={() => setSelectedNode(node)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8,
                  background: isSelected ? c.bg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? c.border : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, width: 12 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 11, color: isSelected ? c.color : 'white', fontWeight: 700, truncate: true }}>
                  {node.table}
                </span>
                {/* Score bar */}
                <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${node.score}%`, height: '100%', background: c.color, borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: c.color, minWidth: 26, textAlign: 'right' }}>
                  {Math.round(node.score)}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── CENTER: 3D GRAPH + CHARTS ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 3D Graph */}
        <div style={{ ...panelStyle, flex: 2, position: 'relative', overflow: 'hidden', minHeight: 300 }}>
          <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 8, zIndex: 1 }}>
            {['Drag to rotate', 'Scroll to zoom', 'Click on node for details'].map(hint => (
              <span key={hint} style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 4 }}>
                {hint}
              </span>
            ))}
          </div>
          <TrafficGraph
            nodes={sortedNodes.slice(0, 10)}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        </div>

        {/* Bottom panels row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
          {/* Traffic Over Time */}
          <div style={{ ...panelStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Traffic Over Time ({selectedNode?.table || '–'} Table)
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#ff2d2d', background: 'rgba(255,45,45,0.15)', padding: '2px 7px', borderRadius: 4 }}>
                Live
              </span>
            </div>
            {/* Y axis labels */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: 16 }}>
                {[100, 75, 50, 25, 0].map(v => (
                  <span key={v} style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{v}</span>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <TrafficLineChart history={history} color={cfg.color} height={90} />
                {/* X axis */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {[0, 1, 2, 3, 4, 5].map(i => {
                    const t = new Date((history[Math.floor(i * (history.length - 1) / 5)]?.ts || 0) * 1000);
                    return <span key={i} style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>{t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Distribution */}
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
            <SectionHeader title="Traffic Distribution" />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
              <DonutChart distribution={distribution} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {Object.entries(LEVEL_CONFIG).map(([key, c]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', flex: 1, fontWeight: 600 }}>
                      {c.label} ({c.range})
                    </span>
                    <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>
                      {distribution[key] || 0}
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                      ({Math.round(((distribution[key] || 0) / (distribution.total || 1)) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: AI INSIGHTS + ALERTS ────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* AI Insights */}
        <div style={{ ...panelStyle, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="AI Insights & Recommendations" />
          {selectedNode && insights && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Node header */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{selectedNode.table}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
                    textTransform: 'capitalize',
                  }}>
                    {selectedNode.level}
                  </span>
                  <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
                    <ArrowUpRight size={12} />
                  </button>
                </div>

                {/* Score gauge */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Traffic Score</span>
                    <span style={{ fontSize: 12, color: cfg.color, fontWeight: 800 }}>{Math.round(selectedNode.score)}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div
                      animate={{ width: `${selectedNode.score}%` }}
                      transition={{ duration: 0.8 }}
                      style={{ height: '100%', background: `linear-gradient(90deg, ${cfg.color}aa, ${cfg.color})`, borderRadius: 2 }}
                    />
                  </div>
                </div>

                {/* Root cause */}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', marginBottom: 4 }}>ROOT CAUSE</div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: 0 }}>
                    {insights.root_cause}
                  </p>
                </div>

                {/* Recommendations */}
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', marginBottom: 8 }}>
                  RECOMMENDATIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {insights.recommendations.map((rec, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <CheckCircle size={11} style={{ color: '#00ff88', flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button 
                onClick={() => setShowFullReport(true)}
                style={{
                width: '100%', padding: '8px 0',
                background: 'linear-gradient(135deg, #0de7f2, #0891b2)',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                color: 'black', fontWeight: 800, fontSize: 11, letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                View Full Analysis <ArrowUpRight size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Real-Time Alerts */}
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', maxHeight: 220, overflow: 'hidden' }}>
          <SectionHeader title="Real-Time Alerts" action="View All" />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map(alert => {
              const c = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.low;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ x: 10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: c.bg, border: `1px solid ${c.border}`,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{alert.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.color, marginBottom: 2 }}>{alert.title}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{alert.message}</div>
                  </div>
                  {alert.time && (
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>{alert.time}</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ──────────────────────────────────────────── */}
      <div style={{
        gridColumn: '1 / -1',
        ...panelStyle, padding: '6px 16px',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.15em' }}>
          TRAFFIC INTELLIGENCE v1.0 · PHASE 2 ACTIVE · CONNECTION: {connectionId || 'DEMO'}
        </span>
        <div style={{ flex: 1 }} />
        {sortedNodes.slice(0, 3).map(n => {
          const c = LEVEL_CONFIG[n.level];
          return (
            <div key={n.table} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{n.table}: {Math.round(n.score)}</span>
            </div>
          );
        })}
      </div>

      {showFullReport && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(2, 6, 12, 0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: 'rgba(5, 10, 18, 0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, width: '100%', maxWidth: 600,
            padding: 24, position: 'relative',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}>
            <button 
              onClick={() => setShowFullReport(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
            
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#0de7f2', letterSpacing: '0.15em' }}>DEEP ANALYSIS REPORT</span>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '4px 0 0 0' }}>{selectedNode?.table}</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>CURRENT SCORE</div>
                <div style={{ fontSize: 20, color: cfg.color, fontWeight: 800 }}>{Math.round(selectedNode?.score || 0)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>TRAFFIC LEVEL</div>
                <div style={{ fontSize: 20, color: cfg.color, fontWeight: 800, textTransform: 'capitalize' }}>{selectedNode?.level}</div>
              </div>
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', marginBottom: 8 }}>ROOT CAUSE ANALYSIS</div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
                {insights?.root_cause || "No analysis available."}
              </p>
            </div>
            
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', marginBottom: 8 }}>ACTIONABLE RECOMMENDATIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {insights?.recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(0,255,136,0.03)', padding: 10, borderRadius: 8 }}>
                    <CheckCircle size={14} style={{ color: '#00ff88', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </motion.div>
  );
}
