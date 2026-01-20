import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useWindowManager } from '../../context/WindowManagerContext';

export const Header = ({ onConnect }) => {
    const { openWindow, connectionId } = useWindowManager();
    const [seeding, setSeeding] = useState(false);

    const handleSeed = async () => {
        if (!connectionId) return;
        setSeeding(true);
        try {
            const resp = await fetch(`/api/seed/${connectionId}`, { method: 'POST' });
            if (resp.ok) {
                alert("Database seeded successfully with temporal data!");
                // Reload to see new tables
                window.location.reload();
            } else {
                alert("Seeding failed. See console for details.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="header glass-card">
            <div className="logo-modern">🧬</div>
            <div className="brand-info">
                <h1>Living Data Network</h1>
                <p>Real-time Banking Intelligence Visualization</p>
            </div>
            <div className="btn-container">
                {connectionId && (
                    <button
                        className={`modern-btn ${seeding ? 'opacity-50 cursor-wait' : 'btn-gradient'}`}
                        onClick={handleSeed}
                        disabled={seeding}
                        style={{ marginRight: '10px', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
                    >
                        <span>🌱</span> {seeding ? 'Seeding...' : 'Seed Data'}
                    </button>
                )}
                <button className="modern-btn btn-gradient" onClick={onConnect}>
                    <span>🔗</span> {connectionId ? 'Connected' : 'Connect DB'}
                </button>
            </div>
        </div>
    );
};

export const StatsDashboard = ({ stats }) => {
    const [collapsed, setCollapsed] = useState({
        live: false,
        metrics: false,
        health: false
    });

    const toggle = (section) => {
        setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="stats-dashboard">
            {/* Hero Stat */}
            <div className={`glass-card hero-stat ${collapsed.live ? 'collapsed' : ''}`}>
                <div className="section-header" onClick={() => toggle('live')}>
                    <div className="stat-badge">
                        <div className="pulse-indicator"></div>
                        LIVE DATA
                    </div>
                    <span className="toggle-icon">{collapsed.live ? '+' : '−'}</span>
                </div>
                {!collapsed.live && (
                    <>
                        <div className="mega-number">{(stats.totalTransactions / 1e9).toFixed(2)}B</div>
                        <div className="stat-label">Total Transactions Processed</div>
                        <div className="stat-trend positive">
                            <span>↗️</span> +{stats.tps} tx/sec
                        </div>
                    </>
                )}
            </div>

            {/* Metrics Grid */}
            <div className={`glass-card metrics-grid-container ${collapsed.metrics ? 'collapsed' : ''}`}>
                <div className="section-header" onClick={() => toggle('metrics')} style={{ padding: '10px 0' }}>
                    <div className="stat-badge" style={{ marginBottom: 0 }}>METRICS & ALERTS</div>
                    <span className="toggle-icon">{collapsed.metrics ? '+' : '−'}</span>
                </div>
                {!collapsed.metrics && (
                    <div className="metrics-grid">
                        <MetricItem name="Fraud Alerts" icon="⚠️" value={stats.fraudAlerts} change="+2 today" trend={stats.fraudAlerts > 5 ? "negative" : "positive"} />
                        <MetricItem name="Avg Amount" icon="💰" value={`$${stats.avgAmount}K`} change="+5.2%" trend="positive" />
                        <MetricItem name="Failed" icon="❌" value={stats.failedTx} change="Stable" trend="warning" />
                        <MetricItem name="Active Nodes" icon="🔗" value={stats.activeNodes} change="+12" trend="positive" />
                    </div>
                )}
            </div>

            {/* Health Card */}
            <div className={`glass-card health-card ${collapsed.health ? 'collapsed' : ''}`}>
                <div className="section-header" onClick={() => toggle('health')} style={{ paddingBottom: '10px' }}>
                    <div className="health-title" style={{ margin: 0 }}>System Health</div>
                    <span className="toggle-icon">{collapsed.health ? '+' : '−'}</span>
                </div>
                {!collapsed.health && (
                    <div className="health-items">
                        <HealthItem name="API Response" value="18ms" percent={95} color="cyan" />
                        <HealthItem name="Database Load" value={`${stats.health.score}%`} percent={stats.health.score} color="yellow" />
                        <HealthItem name="Throughput" value="92%" percent={92} color="cyan" />
                    </div>
                )}
            </div>
        </div>
    );
};

const MetricItem = ({ name, icon, value, change, trend }) => (
    <div className="metric-item">
        <div className="metric-header">
            <span className="metric-name">{name}</span>
            <span className="metric-icon">{icon}</span>
        </div>
        <div className="metric-value">{value}</div>
        <div className={`metric-change ${trend}`}>
            <span>{trend === 'positive' ? '↗️' : '→'}</span> {change}
        </div>
    </div>
);

const HealthItem = ({ name, value, percent, color }) => (
    <div className="health-item">
        <div className="health-header">
            <span className="health-name">{name}</span>
            <span className="health-value" style={{ color: color === 'yellow' ? '#fbbf24' : '#22d3ee' }}>{value}</span>
        </div>
        <div className="progress-track">
            <div className={`progress-fill ${color}`} style={{ width: `${percent}%` }}></div>
        </div>
    </div>
);

export const Legend = () => (
    <div className="legend glass-card">
        <div className="legend-title">Node Types</div>
        <div className="legend-items">
            <LegendItem color="#fbbf24" label="Fact Tables (Transactions)" />
            <LegendItem color="#34d399" label="Dimension Tables (Entities)" />
            <LegendItem color="#f87171" label="Risk/Alert Nodes" />
            <LegendItem color="#22d3ee" label="Network Core" />
        </div>
    </div>
);

const LegendItem = ({ color, label }) => (
    <div className="legend-item">
        <div className="legend-dot" style={{ background: color, boxShadow: `0 0 10px ${color}66` }}></div>
        <span className="legend-label">{label}</span>
    </div>
);

export const NodeDetails = ({ node, onClose, onDrillDown }) => {
    if (!node) return null;
    return (
        <div className="node-details glass-card visible">
            <div className="node-header">
                <div className="node-title">{node.name}</div>
                <button className="close-button" onClick={onClose}>×</button>
            </div>

            <div className="detail-section">
                <div className="detail-label">Entity Type</div>
                <div className="detail-value">{node.table_type || node.entity || 'table'}</div>
            </div>

            <div className="detail-section">
                <div className="detail-label">Total Records</div>
                <div className="detail-value">{node.row_count}</div>
            </div>

            <div className="detail-section">
                <div className="detail-label">Key Columns</div>
                <div className="tags-container">
                    {(node.primary_keys || []).map(pk => (
                        <span key={pk} className="tag">{pk}</span>
                    ))}
                    {(node.foreign_keys || []).map(fk => (
                        <span key={fk.column} className="tag text-indigo-300">{fk.column}</span>
                    ))}
                </div>
            </div>

            <div className="detail-section">
                <div className="detail-label">Actions</div>
                <button className="modern-btn btn-gradient" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onDrillDown(node)}>
                    <span>🔍</span> Explore Internal Structure
                </button>
            </div>
        </div>
    );
};

export const CirclePackOverlay = ({ node, visible, onClose, onColumnClick }) => {
    const containerRef = useRef(null);

    // Helper: Convert flat node schema (columns, pks, fks) to hierarchy for D3
    const transformDataToHierarchy = (node) => {
        if (!node) return { name: "Root", children: [] };

        // 1. Primary Keys
        const pkChildren = (node.primary_keys || []).map(pk => ({
            name: pk,
            value: 100,
            type: 'PK'
        }));

        // 2. Foreign Keys
        // Handle explicit foreign_keys objects from App.jsx
        const fkChildren = (node.foreign_keys || []).map(fk => ({
            name: fk.column ? `${fk.column} → ${fk.referenced_table}` : fk,
            value: 80,
            type: 'FK'
        }));

        // 3. Data Columns (Other columns)
        const pks = new Set(node.primary_keys || []);
        // Handle string or object structure for FKs
        const fks = new Set((node.foreign_keys || []).map(fk => fk.column || fk));

        const dataChildren = (node.columns || [])
            .filter(col => !pks.has(col.name) && !fks.has(col.name))
            .map(col => ({
                name: col.name,
                value: 50,
                type: col.data_type || 'data'
            }));

        return {
            name: node.name,
            children: [
                { name: "Primary Keys", children: pkChildren },
                { name: "Foreign Keys", children: fkChildren },
                { name: "Data Columns", children: dataChildren }
            ]
        };
    };

    useEffect(() => {
        if (!visible || !node || !containerRef.current) return;

        // Clear previous
        containerRef.current.innerHTML = '';

        // Create Tooltip if not exists
        let tooltip = document.getElementById('d3-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'd3-tooltip';
            tooltip.className = 'circle-tooltip'; // Use class from check.html CSS (needs to be defined globally or inline)
            // Add inline styles matching check.html since CSS might be missing
            Object.assign(tooltip.style, {
                position: 'absolute',
                background: 'rgba(0, 0, 0, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                padding: '12px 18px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '600',
                pointerEvents: 'none',
                opacity: '0',
                transition: 'opacity 0.2s',
                zIndex: '2500',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
            });
            document.body.appendChild(tooltip);
        }

        const width = 800;
        const height = 800;
        const data = transformDataToHierarchy(node);

        // Color Scale matching check.html
        const color = d3.scaleOrdinal()
            .domain(["PK", "FK", "data", "index"])
            .range(["#22d3ee", "#fbbf24", "#34d399", "#a78bfa"]);

        // Pack Layout
        const pack = d3.pack()
            .size([width, height])
            .padding(4);

        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);

        pack(root);

        // Derive background color
        let hexColor = 0x667eea; // Default int
        if (node.color && typeof node.color === 'number') hexColor = node.color;
        // Convert int to hex string for CSS
        const hexString = '#' + hexColor.toString(16).padStart(6, '0');

        const svg = d3.create("svg")
            .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
            .attr("width", width)
            .attr("height", height)
            .style("background", `${hexString}15`)
            .style("border-radius", "20px")
            .style("cursor", "pointer")
            .style("box-shadow", "0 30px 80px rgba(0,0,0,0.6)");

        // Circles
        const circle = svg.append("g")
            .selectAll("circle")
            .data(root.descendants().slice(1))
            .join("circle")
            .attr("fill", d => {
                if (d.data.type === 'PK') return color('PK');
                if (d.data.type === 'FK') return color('FK');
                return d.children ? hexString : "white";
            })
            .attr("fill-opacity", d => d.children ? 0.4 : 0.8)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 3);

                // Tooltip Logic
                let tooltipText = `<strong>${d.data.name}</strong>`;
                if (d.data.type) tooltipText += `<br><em style="color:#ffffff99">${d.data.type}</em>`;

                tooltip.innerHTML = tooltipText;
                tooltip.style.opacity = 1;
                tooltip.style.left = (event.pageX + 15) + 'px';
                tooltip.style.top = (event.pageY - 40) + 'px';
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", null);
                tooltip.style.opacity = 0;
            });

        // Labels
        const label = svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .style("font-family", "Inter, sans-serif")
            .selectAll("text")
            .data(root.descendants())
            .join("text")
            .style("fill-opacity", d => d.parent === root ? 1 : 0)
            .style("display", d => d.parent === root ? "inline" : "none")
            .style("fill", d => {
                if (d.data.type === 'PK') return '#22d3ee'; // Cyan
                if (d.data.type === 'FK') return '#fbbf24'; // Amber
                return d.children ? "#fff" : "#000";
            })
            .style("font-weight", d => d.children ? "700" : "500")
            .style("font-size", d => d.children ? "14px" : "11px")
            .text(d => d.data.name);

        // Zoom Logic
        let focus = root;
        let view; // [x, y, r*2]

        const zoomTo = (v) => {
            const k = width / v[2];
            view = v;
            label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            label.style("display", d => d.parent === focus || (d === focus && !d.children) ? "inline" : "none");
            circle.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            circle.attr("r", d => d.r * k);
        };

        const zoom = (event, d) => {
            focus = d;
            const transition = svg.transition()
                .duration(750)
                .tween("zoom", () => {
                    const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                    return t => zoomTo(i(t));
                });

            label
                .filter(function (d) { return d.parent === focus || this.style.display === "inline"; })
                .transition(transition)
                .style("fill-opacity", d => d.parent === focus ? 1 : 0)
                .on("start", function (d) { if (d.parent === focus) this.style.display = "inline"; })
                .on("end", function (d) { if (d.parent !== focus) this.style.display = "none"; });
        };

        svg.on("click", (event) => zoom(event, root));
        circle.on("click", (event, d) => {
            if (focus !== d) {
                if (!d.children && d.data.type !== 'PK' && d.data.type !== 'FK') {
                    // Triggers Record Gravity View
                    onColumnClick(d.data.name);
                } else {
                    zoom(event, d);
                }
                event.stopPropagation();
            }
        });

        zoomTo([root.x, root.y, root.r * 2]);
        containerRef.current.appendChild(svg.node());

        return () => {
            // Cleanup tooltip on unmount if we were the only user, but simpler to just hide it
            if (tooltip) tooltip.style.opacity = 0;
        }

    }, [visible, node]);

    if (!visible || !node) return null;

    return (
        <div className={`circle-pack-overlay ${visible ? 'visible' : ''}`}>
            <div className="circle-pack-header glass-card">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="circle-pack-title">{node.name}</div>
                        <div className="circle-pack-subtitle">{node.table_type || node.entity} • {node.row_count} rows</div>
                    </div>
                    <button
                        onClick={() => {
                            const targetCol = (node.primary_keys && node.primary_keys.length > 0)
                                ? node.primary_keys[0]
                                : (node.columns && node.columns.length > 0 ? node.columns[0].name : null);

                            if (targetCol) onColumnClick(targetCol);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 text-xs font-bold hover:from-cyan-500 hover:to-blue-500 hover:text-white transition-all flex items-center gap-2 shadow-lg hover:shadow-cyan-500/50"
                    >
                        <span>🪐</span> View 3D Records
                    </button>
                </div>
                <div className="circle-pack-info mt-4">
                    <div className="info-item">
                        <div className="info-icon">📊</div>
                        <div className="info-text">
                            <div className="info-label">Columns</div>
                            <div className="info-value">{(node.columns || []).length}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div ref={containerRef} id="circle-pack-container" className="animate-scale-in"></div>

            <button className="circle-pack-close" onClick={onClose}>×</button>
        </div>
    );
};
