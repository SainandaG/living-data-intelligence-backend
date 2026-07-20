import React from 'react';
import { Download, Upload, Edit2, RotateCcw, Trash2, Plus, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import './ProjectRoadmap.css';

/* ═══════════════════════════════════════════════════════════════════
   LIVING DATA INTELLIGENCE — Project Roadmap
   IBM Quantum-Style Horizontal Swim-Lane Timeline
   ═══════════════════════════════════════════════════════════════════ */

// ── Timeline Column Definitions ─────────────────────────────────────

const COLUMNS = [
  { id: 'nov25',  year: '2025',  sub: 'Nov–Dec', status: 'done',   desc: 'Launched 3D graph engine and FastAPI + React boilerplate' },
  { id: 'q1_26',  year: '2026',  sub: 'Jan–Mar', status: 'done',   desc: 'Delivered clustering, pattern recognition, and AI chat' },
  { id: 'q2_26',  year: '2026',  sub: 'Apr–Jun', status: 'active', desc: 'ML subsystem, SHAP explainability, security hardening' },
  { id: 'q3_26',  year: '2026',  sub: 'Jul–Sep', status: 'active', desc: 'Multiplayer collaboration, latent space, lineage views' },
  { id: 'q4_26',  year: '2026',  sub: 'Oct–Dec', status: 'future', desc: 'Enterprise hardening, OpenTelemetry tracing' },
  { id: 'h1_27',  year: '2027',  sub: 'Jan–Jun', status: 'future', desc: 'Cloud native deployment with Kubernetes and Helm charts' },
  { id: 'h2_27',  year: '2027',  sub: 'Jul–Dec', status: 'future', desc: 'Plugin architecture and streaming data integrations' },
  { id: 'y28',    year: '2028+', sub: '',         status: 'future', desc: 'Global multi-tenant, ecosystem marketplace' },
];

const COL_COUNT = COLUMNS.length;
const LABEL_W = '180px';

/* Grid template: label column + N equal data columns */
const gridCols = `${LABEL_W} repeat(${COL_COUNT}, 1fr)`;

// ── Default hardcoded data structures as fallbacks ──────────────────

const DEV_LANES = [
  {
    label: 'Graph & 3D\nVisualization',
    theme: 'pink',
    blocks: [
      { text: '3D Schema Viz',     sub: 'Three.js force-directed', colStart: 1, colEnd: 2, status: 'completed' },
      { text: 'Latent Space',      sub: 'UMAP / t-SNE / PCA',     colStart: 3, colEnd: 4, status: 'active' },
      { text: 'Evolution Timeline', sub: 'Schema time-travel',     colStart: 5, colEnd: 5, status: 'planned' },
      { text: 'Plugin Visualizers', sub: 'Community extensions',    colStart: 7, colEnd: 8, status: 'planned' },
    ],
  },
  {
    label: 'AI & Machine\nLearning',
    theme: 'purple',
    blocks: [
      { text: 'NL→SQL Chat',       sub: 'Gemini AI agent',         colStart: 1, colEnd: 2, status: 'completed' },
      { text: 'ML Subsystem',      sub: 'Classification · Regression · Time Series', colStart: 3, colEnd: 4, status: 'active' },
      { text: 'SHAP Explainability', sub: 'Model interpretation',  colStart: 5, colEnd: 5, status: 'planned' },
      { text: 'Streaming AI',      sub: 'Kafka / Kinesis native',  colStart: 7, colEnd: 8, status: 'planned' },
    ],
  },
  {
    label: 'Data Engineering\n& Analytics',
    theme: 'blue',
    blocks: [
      { text: 'Dual Clustering',   sub: 'Heuristic + NetworkX',    colStart: 1, colEnd: 1, status: 'completed' },
      { text: 'Analytics Pipeline', sub: 'TPS monitoring · Metrics', colStart: 2, colEnd: 3, status: 'completed' },
      { text: 'Perspective Lineage', sub: 'Analyst / Business modes', colStart: 4, colEnd: 5, status: 'active' },
      { text: 'Data Governance',    sub: 'Lineage + audit trails', colStart: 6, colEnd: 7, status: 'planned' },
    ],
  },
  {
    label: 'Security &\nOperations',
    theme: 'darkgray',
    blocks: [
      { text: 'JWT Auth + RBAC',   sub: 'Role-based access control', colStart: 3, colEnd: 3, status: 'active' },
      { text: 'SQL Injection Guard', sub: 'AI-to-SQL protection',  colStart: 4, colEnd: 4, status: 'active' },
      { text: 'OpenTelemetry',     sub: 'Distributed tracing',     colStart: 5, colEnd: 6, status: 'planned' },
      { text: 'Cloud Native',      sub: 'K8s Helm + Terraform',   colStart: 7, colEnd: 7, status: 'planned' },
      { text: 'Multi-Tenant',      sub: 'Global isolation',        colStart: 8, colEnd: 8, status: 'planned' },
    ],
  },
  {
    label: 'Collaboration &\nMultiplayer',
    theme: 'darkgray',
    blocks: [
      { text: 'War Rooms',         sub: 'Incident response',       colStart: 3, colEnd: 3, status: 'active' },
      { text: 'Shared Perspectives', sub: 'Cursors + deep-links',  colStart: 4, colEnd: 5, status: 'active' },
      { text: 'Team Workspaces',   sub: 'Multi-user environments', colStart: 7, colEnd: 8, status: 'planned' },
    ],
  },
];

const PROD_RELEASES = [
  { name: 'Genesis',       version: 'v1.0', sub: 'Core graph + AI chat',       colStart: 1, colEnd: 2, status: 'released' },
  { name: 'Neural Core',   version: 'v2.0', sub: 'ML engine + security',       colStart: 3, colEnd: 4, status: 'current' },
  { name: 'Enterprise',    version: 'v3.0', sub: 'Cloud native + tracing',     colStart: 5, colEnd: 6, status: 'upcoming' },
  { name: 'Ecosystem',     version: 'v4.0', sub: 'Plugins + streaming',        colStart: 7, colEnd: 7, status: 'upcoming' },
  { name: 'Global',        version: 'v5.0', sub: 'Multi-tenant + marketplace', colStart: 8, colEnd: 8, status: 'upcoming' },
];

const INNOVATION_LANES = [
  {
    category: 'Software\nInnovation',
    theme: 'software',
    blocks: [
      { text: 'FastAPI + React',    sub: 'Core platform stack',    colStart: 1, colEnd: 2, status: 'completed' },
      { text: 'ML Engine SDK',      sub: 'Scikit-learn + SHAP',   colStart: 3, colEnd: 4, status: 'active' },
      { text: 'Agent Framework',    sub: 'Autonomous AI agents',   colStart: 5, colEnd: 5, status: 'planned' },
      { text: 'Plugin SDK',         sub: 'Extension architecture', colStart: 6, colEnd: 7, status: 'planned' },
      { text: 'Marketplace',        sub: 'Community hub',          colStart: 8, colEnd: 8, status: 'planned' },
    ],
  },
  {
    category: 'Infrastructure\nInnovation',
    theme: 'infrastructure',
    blocks: [
      { text: 'Docker Compose',     sub: 'Local dev stack',        colStart: 1, colEnd: 1, status: 'completed' },
      { text: 'CI/CD Pipeline',     sub: 'Automated deployments',  colStart: 2, colEnd: 3, status: 'completed' },
      { text: 'WebSocket Layer',    sub: 'Real-time data stream',  colStart: 4, colEnd: 4, status: 'active' },
      { text: 'K8s Helm Charts',    sub: 'Container orchestration', colStart: 6, colEnd: 7, status: 'planned' },
      { text: 'Terraform IaC',     sub: 'Multi-cloud provisioning', colStart: 8, colEnd: 8, status: 'planned' },
    ],
  },
];

const FEATURES_STORIES_LANES = [
  {
    label: 'Epics',
    type: 'epic',
    theme: 'pink',
    blocks: [
      { text: '3D Schema Visualization',  sub: 'Three.js + WebGL + Physics',    colStart: 1, colEnd: 3, status: 'completed' },
      { text: 'AI Intelligence Platform', sub: 'Gemini AI + NL→SQL + Agents',   colStart: 3, colEnd: 5, status: 'active' },
      { text: 'Plugin Marketplace',       sub: 'SDK + Community extensions',     colStart: 6, colEnd: 8, status: 'planned' },
    ],
  },
  {
    label: 'Features',
    type: 'feature',
    theme: 'purple',
    blocks: [
      { text: 'Force-Directed Graph',   sub: 'Real-time physics sim',        colStart: 1, colEnd: 1, status: 'completed' },
      { text: 'AI Chat Interface',      sub: 'NL→SQL conversational',        colStart: 2, colEnd: 2, status: 'completed' },
      { text: 'ML Subsystem',           sub: 'Classification · Regression',  colStart: 3, colEnd: 3, status: 'active' },
      { text: 'Latent Space Explorer',  sub: 'UMAP / t-SNE / PCA',          colStart: 4, colEnd: 5, status: 'active' },
      { text: 'Perspective Lineage',    sub: 'Analyst / Business views',     colStart: 6, colEnd: 6, status: 'planned' },
      { text: 'Streaming Integrations', sub: 'Kafka · Kinesis · RabbitMQ',   colStart: 7, colEnd: 8, status: 'planned' },
    ],
  },
  {
    label: 'Stories',
    type: 'story',
    theme: 'blue',
    blocks: [
      { text: 'Dual Clustering',        sub: 'Heuristic + NetworkX',         colStart: 1, colEnd: 1, status: 'completed' },
      { text: 'Schema Drill-Down',      sub: 'Table internals explorer',     colStart: 2, colEnd: 2, status: 'completed' },
      { text: 'War Room Incidents',     sub: 'Real-time collaboration',      colStart: 3, colEnd: 3, status: 'active' },
      { text: 'Evolution Timeline',     sub: 'Schema time-travel',           colStart: 4, colEnd: 4, status: 'active' },
      { text: 'Traffic Dashboard',      sub: 'API monitoring + anomaly',     colStart: 5, colEnd: 5, status: 'planned' },
      { text: 'Team Workspaces',        sub: 'Shared 3D environments',       colStart: 7, colEnd: 8, status: 'planned' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/** SVG Status Icon matching IBM roadmap style */
const StatusIcon = ({ status }) => {
  if (status === 'completed' || status === 'released') {
    return (
      <svg className="rm-block-icon completed-icon" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="7.5" fill="#10b981" />
        <path fill="#ffffff" d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
      </svg>
    );
  }
  if (status === 'active' || status === 'current') {
    return (
      <svg className="rm-block-icon active-icon" viewBox="0 0 16 16" stroke="currentColor" fill="none">
        <circle cx="8" cy="8" r="7" strokeWidth="1.5" />
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8 4.5v3.5h2.5"/>
      </svg>
    );
  }
  return null;
};

/** Single block pill in a lane */
const Block = ({ block, onClick, editMode }) => (
  <div
    className={`rm-block ${block.status} ${editMode ? 'rm-block-editable' : ''}`}
    title={block.sub}
    onClick={onClick}
  >
    <StatusIcon status={block.status} />
    <div style={{ textAlign: 'left', lineHeight: 1.1, flex: 1, overflow: 'hidden' }}>
      <div className="rm-block-text">{block.text}</div>
      <div className="rm-block-sub">{block.sub}</div>
    </div>
    {editMode && <span className="rm-edit-pencil"><Edit2 size={10} /></span>}
  </div>
);

/** A full lane row with label + blocks in positioned cells */
const LaneRow = ({ lane, laneIdx, section, editMode, onEditBlock, onAddBlock, animDelay = 0 }) => {
  // Group blocks by their column positions
  const cellBlocks = Array.from({ length: COL_COUNT }, (_, i) => {
    const col = i + 1; // 1-indexed
    return lane.blocks.filter(b => b.colStart === col);
  });

  return (
    <div
      className={`rm-lane-row rm-theme-${lane.theme || 'darkgray'} rm-animate-in`}
      style={{
        gridTemplateColumns: gridCols,
        display: 'grid',
        animationDelay: `${animDelay}s`,
      }}
    >
      <div className="rm-lane-label-cell" style={{ whiteSpace: 'pre-line', position: 'relative' }}>
        {lane.type && <span className={`rm-type-badge rm-type-${lane.type}`}>{lane.type}</span>}
        {!lane.type && (lane.label || lane.category)}
        
        {editMode && (
          <button 
            className="rm-row-add-btn"
            onClick={() => onAddBlock(section, laneIdx, 1)}
            title="Add block to this lane"
          >
            <Plus size={10} /> Add
          </button>
        )}
      </div>
      {cellBlocks.map((blocks, i) => {
        const col = i + 1;
        return (
          <div key={i} className="rm-lane-cell">
            {blocks.map((b, j) => {
              const spanCols = b.colEnd - b.colStart + 1;
              const blockIdx = lane.blocks.indexOf(b);
              
              if (spanCols > 1) {
                // Spanning block — use absolute positioning
                return (
                  <div
                    key={j}
                    className={`rm-block ${b.status} ${editMode ? 'rm-block-editable' : ''}`}
                    title={b.sub}
                    style={{
                      position: 'absolute',
                      left: 4,
                      right: `calc(-${(spanCols - 1) * 100}% + 4px)`,
                      zIndex: 5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      boxSizing: 'border-box'
                    }}
                    onClick={editMode ? () => onEditBlock(section, laneIdx, b, blockIdx) : undefined}
                  >
                    <StatusIcon status={b.status} />
                    <div style={{ textAlign: 'left', lineHeight: 1.1, flex: 1, overflow: 'hidden' }}>
                      <div className="rm-block-text">{b.text}</div>
                      <div className="rm-block-sub">{b.sub}</div>
                    </div>
                    {editMode && <span className="rm-edit-pencil"><Edit2 size={10} /></span>}
                  </div>
                );
              }
              return (
                <Block 
                  key={j} 
                  block={b} 
                  editMode={editMode}
                  onClick={editMode ? () => onEditBlock(section, laneIdx, b, blockIdx) : undefined}
                />
              );
            })}
            
            {editMode && blocks.length === 0 && (
              <button 
                className="rm-cell-quick-add-btn"
                onClick={() => onAddBlock(section, laneIdx, col)}
                title="Add block here"
              >
                <Plus size={10} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

const ProjectRoadmap = React.memo(() => {
  // Load state from localStorage or defaults
  const [roadmapData, setRoadmapData] = React.useState(() => {
    const saved = localStorage.getItem('living_data_roadmap_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading roadmap data", e);
      }
    }
    return {
      devLanes: DEV_LANES,
      prodReleases: PROD_RELEASES,
      innovationLanes: INNOVATION_LANES,
      featuresStoriesLanes: FEATURES_STORIES_LANES
    };
  });

  // Edit Mode state
  const [editMode, setEditMode] = React.useState(false);

  // Modal control states
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingBlock, setEditingBlock] = React.useState(null); // null if adding
  const [editingLaneIndex, setEditingLaneIndex] = React.useState(-1);
  const [editingSection, setEditingSection] = React.useState(''); // 'devLanes', 'prodReleases', etc.

  // Form input states
  const [formText, setFormText] = React.useState('');
  const [formSub, setFormSub] = React.useState('');
  const [formColStart, setFormColStart] = React.useState(1);
  const [formColEnd, setFormColEnd] = React.useState(1);
  const [formStatus, setFormStatus] = React.useState('planned');
  const [formVersion, setFormVersion] = React.useState('');

  // Compute progress line width (percentage to current active column)
  const activeIdx = COLUMNS.findIndex(c => c.status === 'active');
  const progressPct = ((activeIdx + 0.5) / COL_COUNT) * 100;

  // Save updates helper
  const saveRoadmapData = (newData) => {
    setRoadmapData(newData);
    localStorage.setItem('living_data_roadmap_data', JSON.stringify(newData));
  };

  // Add block trigger
  const handleAddBlock = (section, laneIdx, col = 1) => {
    setEditingBlock(null);
    setEditingSection(section);
    setEditingLaneIndex(laneIdx);
    setFormText('');
    setFormSub('');
    setFormColStart(col);
    setFormColEnd(col);
    setFormStatus(section === 'prodReleases' ? 'upcoming' : 'planned');
    setFormVersion('');
    setModalOpen(true);
  };

  // Edit block trigger
  const handleEditBlock = (section, laneIdx, block, blockIdx) => {
    setEditingBlock({ ...block, index: blockIdx });
    setEditingSection(section);
    setEditingLaneIndex(laneIdx);
    setFormText(block.text || block.name || '');
    setFormSub(block.sub || '');
    setFormColStart(block.colStart);
    setFormColEnd(block.colEnd);
    setFormStatus(block.status);
    setFormVersion(block.version || '');
    setModalOpen(true);
  };

  // Save handler
  const handleSaveBlock = () => {
    if (!formText.trim()) {
      alert("Please enter a title.");
      return;
    }

    const start = parseInt(formColStart);
    const end = Math.max(start, parseInt(formColEnd));

    const updated = { ...roadmapData };

    if (editingSection === 'prodReleases') {
      const newRelease = {
        name: formText,
        version: formVersion,
        sub: formSub,
        colStart: start,
        colEnd: end,
        status: formStatus
      };

      if (editingBlock === null) {
        updated.prodReleases = [...updated.prodReleases, newRelease];
      } else {
        updated.prodReleases = updated.prodReleases.map((r, idx) => 
          idx === editingBlock.index ? newRelease : r
        );
      }
    } else {
      const newBlock = {
        text: formText,
        sub: formSub,
        colStart: start,
        colEnd: end,
        status: formStatus
      };

      updated[editingSection] = updated[editingSection].map((lane, lIdx) => {
        if (lIdx === editingLaneIndex) {
          let newBlocks = [...lane.blocks];
          if (editingBlock === null) {
            newBlocks.push(newBlock);
          } else {
            newBlocks = newBlocks.map((b, bIdx) => 
              bIdx === editingBlock.index ? newBlock : b
            );
          }
          return { ...lane, blocks: newBlocks };
        }
        return lane;
      });
    }

    saveRoadmapData(updated);
    setModalOpen(false);
  };

  // Delete handler
  const handleDeleteBlock = () => {
    if (editingBlock === null) return;
    if (!window.confirm("Are you sure you want to delete this block?")) return;

    const updated = { ...roadmapData };

    if (editingSection === 'prodReleases') {
      updated.prodReleases = updated.prodReleases.filter((_, idx) => idx !== editingBlock.index);
    } else {
      updated[editingSection] = updated[editingSection].map((lane, lIdx) => {
        if (lIdx === editingLaneIndex) {
          return {
            ...lane,
            blocks: lane.blocks.filter((_, bIdx) => bIdx !== editingBlock.index)
          };
        }
        return lane;
      });
    }

    saveRoadmapData(updated);
    setModalOpen(false);
  };

  // Reset defaults handler
  const handleResetToDefault = () => {
    if (window.confirm("Are you sure you want to reset the roadmap data? All custom additions and edits will be cleared.")) {
      const defaults = {
        devLanes: DEV_LANES,
        prodReleases: PROD_RELEASES,
        innovationLanes: INNOVATION_LANES,
        featuresStoriesLanes: FEATURES_STORIES_LANES
      };
      saveRoadmapData(defaults);
    }
  };

  // Download Excel grid handler (AOA layout with merges matching visual timeline)
  const handleDownloadExcel = () => {
    const aoa = [
      ["LIVING DATA INTELLIGENCE PLATFORM — PROJECT ROADMAP", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", ""],
      ["Lane Label / Time Periods", "2025 Nov-Dec (nov25)", "2026 Jan-Mar (q1_26)", "2026 Apr-Jun (q2_26)", "2026 Jul-Sep (q3_26)", "2026 Oct-Dec (q4_26)", "2027 Jan-Jun (h1_27)", "2027 Jul-Dec (h2_27)", "2028+ (y28)"]
    ];

    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } } // Title row merge
    ];

    // Helper to format block for cell
    const formatBlockVal = (block) => {
      return `${block.text}\n(${block.sub})\n[${block.status}]`;
    };

    // Keep track of current row index
    let currentR = aoa.length;

    // ── 1. DEVELOPMENT ROADMAP SECTION ──
    aoa.push(["DEVELOPMENT ROADMAP", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: currentR, c: 0 }, e: { r: currentR, c: 8 } });
    currentR++;

    roadmapData.devLanes.forEach(lane => {
      const row = [lane.label || lane.category || "", "", "", "", "", "", "", "", ""];
      lane.blocks.forEach(block => {
        row[block.colStart] = formatBlockVal(block);
        if (block.colEnd > block.colStart) {
          merges.push({
            s: { r: currentR, c: block.colStart },
            e: { r: currentR, c: block.colEnd }
          });
        }
      });
      aoa.push(row);
      currentR++;
    });

    // ── 2. PRODUCTION RELEASES SECTION ──
    aoa.push(["", "", "", "", "", "", "", "", ""]); // spacer
    currentR++;
    aoa.push(["PRODUCTION RELEASES", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: currentR, c: 0 }, e: { r: currentR, c: 8 } });
    currentR++;

    const releasesRow = ["Release Milestones", "", "", "", "", "", "", "", ""];
    roadmapData.prodReleases.forEach(release => {
      releasesRow[release.colStart] = `${release.name} (${release.sub}) [${release.status}]` + (release.version ? `\nVersion: ${release.version}` : '');
      if (release.colEnd > release.colStart) {
        merges.push({
          s: { r: currentR, c: release.colStart },
          e: { r: currentR, c: release.colEnd }
        });
      }
    });
    aoa.push(releasesRow);
    currentR++;

    // ── 3. INNOVATION ROADMAP SECTION ──
    aoa.push(["", "", "", "", "", "", "", "", ""]); // spacer
    currentR++;
    aoa.push(["INNOVATION ROADMAP", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: currentR, c: 0 }, e: { r: currentR, c: 8 } });
    currentR++;

    roadmapData.innovationLanes.forEach(lane => {
      const row = [lane.label || lane.category || "", "", "", "", "", "", "", "", ""];
      lane.blocks.forEach(block => {
        row[block.colStart] = formatBlockVal(block);
        if (block.colEnd > block.colStart) {
          merges.push({
            s: { r: currentR, c: block.colStart },
            e: { r: currentR, c: block.colEnd }
          });
        }
      });
      aoa.push(row);
      currentR++;
    });

    // ── 4. FEATURES & STORIES SECTION ──
    aoa.push(["", "", "", "", "", "", "", "", ""]); // spacer
    currentR++;
    aoa.push(["FEATURES & STORIES", "", "", "", "", "", "", "", ""]);
    merges.push({ s: { r: currentR, c: 0 }, e: { r: currentR, c: 8 } });
    currentR++;

    roadmapData.featuresStoriesLanes.forEach(lane => {
      const row = [lane.label || lane.category || "", "", "", "", "", "", "", "", ""];
      lane.blocks.forEach(block => {
        row[block.colStart] = formatBlockVal(block);
        if (block.colEnd > block.colStart) {
          merges.push({
            s: { r: currentR, c: block.colStart },
            e: { r: currentR, c: block.colEnd }
          });
        }
      });
      aoa.push(row);
      currentR++;
    });

    try {
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet['!merges'] = merges;
      
      // Auto-fit columns
      const maxLens = Array(9).fill(15);
      aoa.forEach(row => {
        row.forEach((cell, cIdx) => {
          const val = String(cell || "");
          const lines = val.split("\n");
          lines.forEach(line => {
            maxLens[cIdx] = Math.max(maxLens[cIdx], line.length + 3);
          });
        });
      });
      maxLens[0] = Math.min(maxLens[0], 35);
      worksheet["!cols"] = maxLens.map(len => ({ wch: len }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Roadmap Grid");
      XLSX.writeFile(workbook, "living_data_roadmap.xlsx");
    } catch (e) {
      console.error(e);
      alert("Failed to export Excel file.");
    }
  };

  // Upload Excel / Parse XLSX file handler (Reads cell values and merges to rebuild timeline state)
  const handleUploadExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Read sheet as an array of arrays (AOA)
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length === 0) {
          alert("No data rows found in the uploaded file.");
          return;
        }

        // Helper to check merges
        const getCellSpan = (ws, rIdx, cIdx) => {
          if (!ws['!merges']) return { colStart: cIdx, colEnd: cIdx };
          const merge = ws['!merges'].find(m => m.s.r === rIdx && m.s.c === cIdx);
          if (merge) {
            // SheetJS merges are 0-indexed column numbers.
            // B is index 1, C is index 2, etc.
            return { colStart: merge.s.c, colEnd: merge.e.c };
          }
          return { colStart: cIdx, colEnd: cIdx };
        };

        // Helper to parse cell text
        const parseCellValue = (val) => {
          if (!val) return null;
          const str = String(val).trim();
          
          let text = str;
          let sub = "";
          let status = "planned";
          let version = "";

          // Clean up brackets for status
          const statusMatch = str.match(/\[(completed|active|planned|released|current|upcoming)\]$/i);
          if (statusMatch) {
            status = statusMatch[1].toLowerCase();
            text = text.replace(statusMatch[0], "").trim();
          }

          // Clean up version (mainly for releases)
          const versionMatch = text.match(/Version:\s*([^\s]+)/i);
          if (versionMatch) {
            version = versionMatch[1].trim();
            text = text.replace(new RegExp(`\\s*Version:\\s*${version}`, 'i'), "").trim();
          }

          // Clean up subtitle in parentheses
          const subMatch = text.match(/\(([^)]+)\)$/);
          if (subMatch) {
            sub = subMatch[1].trim();
            text = text.replace(subMatch[0], "").trim();
          }

          // Clean up line breaks
          text = text.replace(/\r?\n|\r/g, " ").trim();
          sub = sub.replace(/\r?\n|\r/g, " ").trim();

          return { text, sub, status, version };
        };

        const newDevLanes = [];
        const newProdReleases = [];
        const newInnovationLanes = [];
        const newFeaturesStoriesLanes = [];

        let currentSection = "";

        // Loop through rows starting from row index 3
        for (let rIdx = 3; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx];
          if (!row || row.length === 0) continue;

          const colA = String(row[0] || "").trim();
          if (!colA) continue; // skip empty/spacer rows

          // Detect Section changes
          if (colA === "DEVELOPMENT ROADMAP") {
            currentSection = "devLanes";
            continue;
          } else if (colA === "PRODUCTION RELEASES") {
            currentSection = "prodReleases";
            continue;
          } else if (colA === "INNOVATION ROADMAP") {
            currentSection = "innovationLanes";
            continue;
          } else if (colA === "FEATURES & STORIES") {
            currentSection = "featuresStoriesLanes";
            continue;
          }

          // If we reach here, row represents a lane/milestone row!
          if (currentSection === "devLanes") {
            const lane = { label: colA, theme: "darkgray", blocks: [] };
            // Detect theme based on lane label or default to index-based coloring
            if (colA.toLowerCase().includes("graph")) lane.theme = "pink";
            else if (colA.toLowerCase().includes("ai")) lane.theme = "purple";
            else if (colA.toLowerCase().includes("data")) lane.theme = "blue";
            
            for (let cIdx = 1; cIdx <= 8; cIdx++) {
              const parsed = parseCellValue(row[cIdx]);
              if (parsed) {
                const { colStart, colEnd } = getCellSpan(sheet, rIdx, cIdx);
                lane.blocks.push({
                  text: parsed.text,
                  sub: parsed.sub,
                  colStart,
                  colEnd,
                  status: parsed.status
                });
              }
            }
            newDevLanes.push(lane);
          } else if (currentSection === "prodReleases") {
            for (let cIdx = 1; cIdx <= 8; cIdx++) {
              const parsed = parseCellValue(row[cIdx]);
              if (parsed) {
                const { colStart, colEnd } = getCellSpan(sheet, rIdx, cIdx);
                newProdReleases.push({
                  name: parsed.text,
                  version: parsed.version || `v${newProdReleases.length + 1}.0`,
                  sub: parsed.sub,
                  colStart,
                  colEnd,
                  status: parsed.status === "completed" ? "released" : parsed.status === "active" ? "current" : parsed.status
                });
              }
            }
          } else if (currentSection === "innovationLanes") {
            const lane = { category: colA, theme: "software", blocks: [] };
            if (colA.toLowerCase().includes("infra")) lane.theme = "infrastructure";

            for (let cIdx = 1; cIdx <= 8; cIdx++) {
              const parsed = parseCellValue(row[cIdx]);
              if (parsed) {
                const { colStart, colEnd } = getCellSpan(sheet, rIdx, cIdx);
                lane.blocks.push({
                  text: parsed.text,
                  sub: parsed.sub,
                  colStart,
                  colEnd,
                  status: parsed.status
                });
              }
            }
            newInnovationLanes.push(lane);
          } else if (currentSection === "featuresStoriesLanes") {
            let type = "epic";
            let theme = "pink";
            if (colA.toLowerCase().includes("feature")) {
              type = "feature";
              theme = "purple";
            } else if (colA.toLowerCase().includes("story")) {
              type = "story";
              theme = "blue";
            }

            const lane = { label: colA, type, theme, blocks: [] };

            for (let cIdx = 1; cIdx <= 8; cIdx++) {
              const parsed = parseCellValue(row[cIdx]);
              if (parsed) {
                const { colStart, colEnd } = getCellSpan(sheet, rIdx, cIdx);
                lane.blocks.push({
                  text: parsed.text,
                  sub: parsed.sub,
                  colStart,
                  colEnd,
                  status: parsed.status
                });
              }
            }
            newFeaturesStoriesLanes.push(lane);
          }
        }

        const newData = {
          devLanes: newDevLanes.length > 0 ? newDevLanes : DEV_LANES,
          prodReleases: newProdReleases.length > 0 ? newProdReleases : PROD_RELEASES,
          innovationLanes: newInnovationLanes.length > 0 ? newInnovationLanes : INNOVATION_LANES,
          featuresStoriesLanes: newFeaturesStoriesLanes.length > 0 ? newFeaturesStoriesLanes : FEATURES_STORIES_LANES
        };

        saveRoadmapData(newData);
        alert("Roadmap grid imported successfully! Visual timeline updated.");
      } catch (err) {
        console.error(err);
        alert("Error loading Excel file. Please ensure it follows the format structure of the exported file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="rm-root">
      <div className="rm-inner">

        {/* ── Top Header ──────────────────────────────────────── */}
        <div className="rm-top-header rm-animate-in rm-animate-in-1">
          <div>
            <div className="rm-brand-title">Living Data Intelligence Platform</div>
            <div className="rm-page-title">Project Roadmap</div>
          </div>
          <div className="rm-legend">
            <div className="rm-legend-item">
              <StatusIcon status="completed" />
              Completed
            </div>
            <div className="rm-legend-item">
              <StatusIcon status="active" />
              On Target
            </div>
            <div className="rm-legend-item">
              <span className="rm-legend-planned-dot" />
              Planned
            </div>
          </div>
        </div>

        {/* ── Dashboard Action Toolbar ────────────────────────── */}
        <div className="rm-toolbar rm-animate-in rm-animate-in-1">
          <button className="rm-btn rm-btn-primary" onClick={handleDownloadExcel}>
            <Download size={14} /> Download Excel
          </button>
          
          <label className="rm-btn rm-btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Upload Excel (Import)
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleUploadExcel} 
              style={{ display: 'none' }} 
            />
          </label>

          <button 
            className={`rm-btn ${editMode ? 'rm-btn-active' : 'rm-btn-secondary'}`}
            onClick={() => setEditMode(!editMode)}
          >
            <Edit2 size={14} /> {editMode ? 'Lock Visualizer' : 'Edit Manually'}
          </button>

          {editMode && (
            <button className="rm-btn rm-btn-danger" onClick={handleResetToDefault}>
              <RotateCcw size={14} /> Reset Defaults
            </button>
          )}
        </div>

        {/* ── Year Header — 3 rows: dots, labels, descriptions ─── */}
        <div className="rm-year-header rm-animate-in rm-animate-in-2">
          {/* Row 1: Dots + spine line */}
          <div className="rm-dots-row" style={{ gridTemplateColumns: gridCols, display: 'grid' }}>
            <div />{/* empty label column */}
            {COLUMNS.map((col) => (
              <div key={col.id} className="rm-dot-cell">
                <div className={`rm-year-dot ${col.status}`} />
              </div>
            ))}
            {/* Spine behind dots — spans full width of data columns */}
            <div className="rm-spine-line" style={{ left: LABEL_W, right: 0 }} />
            <div className="rm-spine-progress" style={{ left: LABEL_W, width: `calc((100% - ${LABEL_W}) * ${progressPct / 100})` }} />
          </div>

          {/* Row 2: Year labels */}
          <div className="rm-labels-row" style={{ gridTemplateColumns: gridCols, display: 'grid' }}>
            <div />{/* empty label column */}
            {COLUMNS.map((col) => (
              <div key={col.id} className="rm-label-cell">
                <div className="rm-year-label">
                  {col.year}
                  {col.sub && <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginLeft: 4 }}>{col.sub}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Row 3: Descriptions */}
          <div className="rm-descs-row" style={{ gridTemplateColumns: gridCols, display: 'grid' }}>
            <div />{/* empty label column */}
            {COLUMNS.map((col) => (
              <div key={col.id} className="rm-desc-cell">
                <div className="rm-year-desc">{col.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Development Roadmap Section ═══════════════════════ */}
        <div className="rm-section-header-row rm-animate-in rm-animate-in-3">
          <div className="rm-section-header-title">Development Roadmap</div>
          <div className="rm-section-header-line" />
        </div>

        <div className="rm-section" style={{ position: 'relative' }}>
          {/* Vertical column guide lines */}
          <div className="rm-col-lines" style={{ gridTemplateColumns: gridCols, display: 'grid' }}>
            <div />
            {COLUMNS.map((c) => <div key={c.id} className="rm-col-line" />)}
          </div>

          {roadmapData.devLanes.map((lane, i) => (
            <LaneRow 
              key={lane.label} 
              lane={lane} 
              laneIdx={i}
              section="devLanes"
              editMode={editMode}
              onEditBlock={handleEditBlock}
              onAddBlock={handleAddBlock}
              animDelay={0.15 + i * 0.06} 
            />
          ))}
        </div>

        {/* ═══ Production Track ══════════════════════════════════ */}
        <div className="rm-section-header-row rm-animate-in rm-animate-in-5">
          <div className="rm-section-header-title">Production Releases</div>
          <div className="rm-section-header-line" />
        </div>

        <div className="rm-prod-track rm-animate-in rm-animate-in-6" style={{ gridTemplateColumns: gridCols, display: 'grid' }}>
          <div className="rm-prod-label-cell" style={{ position: 'relative' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', lineHeight: 1.3 }}>
              Release<br />Milestones
            </span>
            {editMode && (
              <button 
                className="rm-row-add-btn"
                onClick={() => handleAddBlock('prodReleases', -1)}
                style={{ position: 'absolute', bottom: 6, left: 0 }}
              >
                <Plus size={10} /> Add
              </button>
            )}
          </div>
          {COLUMNS.map((col, ci) => {
            const releases = roadmapData.prodReleases.filter(r => r.colStart === ci + 1);
            return (
              <div key={col.id} className="rm-prod-cell" style={{ position: 'relative' }}>
                {releases.map((release, ri) => {
                  const releaseIdx = roadmapData.prodReleases.indexOf(release);
                  const spanCols = release.colEnd - release.colStart + 1;
                  return (
                    <div
                      key={ri}
                      className={`rm-prod-box ${release.status} ${editMode ? 'rm-block-editable' : ''}`}
                      onClick={editMode ? () => handleEditBlock('prodReleases', -1, release, releaseIdx) : undefined}
                      style={
                        spanCols > 1
                          ? { width: `calc(${(spanCols - 1) * 100}% - 8px)`, position: 'relative', zIndex: 2 }
                          : {}
                      }
                    >
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <StatusIcon status={release.status === 'released' ? 'completed' : release.status === 'current' ? 'active' : 'planned'} />
                      </div>
                      <div className="rm-prod-name">{release.name}</div>
                      <div className="rm-prod-sub">{release.sub}</div>
                      <div className={`rm-prod-version ${release.status}`}>{release.version}</div>
                      {editMode && <span className="rm-edit-pencil" style={{ right: 8, bottom: 8 }}><Edit2 size={10} /></span>}
                    </div>
                  );
                })}
                {editMode && releases.length === 0 && (
                  <button 
                    className="rm-cell-quick-add-btn"
                    onClick={() => handleAddBlock('prodReleases', -1, ci + 1)}
                    title="Add release milestone here"
                  >
                    <Plus size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ Innovation Roadmap Section ════════════════════════ */}
        <div className="rm-section-header-row rm-animate-in rm-animate-in-7">
          <div className="rm-section-header-title">Innovation Roadmap</div>
          <div className="rm-section-header-line" />
        </div>

        <div className="rm-section" style={{ position: 'relative' }}>
          <div className="rm-col-lines" style={{ gridTemplateColumns: gridCols, display: 'grid' }}>
            <div />
            {COLUMNS.map((c) => <div key={c.id} className="rm-col-line" />)}
          </div>

          {roadmapData.innovationLanes.map((lane, i) => (
            <LaneRow 
              key={lane.category} 
              lane={lane} 
              laneIdx={i}
              section="innovationLanes"
              editMode={editMode}
              onEditBlock={handleEditBlock}
              onAddBlock={handleAddBlock}
              animDelay={0.4 + i * 0.06} 
            />
          ))}
        </div>

        {/* ═══ Features & Stories Section ════════════════════════ */}
        <div className="rm-section-header-row rm-animate-in rm-animate-in-8">
          <div className="rm-section-header-title">Features & Stories</div>
          <div className="rm-section-header-line" />
        </div>

        <div className="rm-section" style={{ position: 'relative' }}>
          <div className="rm-col-lines" style={{ gridTemplateColumns: gridCols, display: 'grid' }}>
            <div />
            {COLUMNS.map((c) => <div key={c.id} className="rm-col-line" />)}
          </div>

          {roadmapData.featuresStoriesLanes.map((lane, i) => (
            <LaneRow 
              key={lane.label} 
              lane={lane} 
              laneIdx={i}
              section="featuresStoriesLanes"
              editMode={editMode}
              onEditBlock={handleEditBlock}
              onAddBlock={handleAddBlock}
              animDelay={0.5 + i * 0.06} 
            />
          ))}
        </div>

        {/* ── Footer Brand ──────────────────────────────────────── */}
        <div className="rm-brand-footer rm-animate-in rm-animate-in-8">
          <div className="rm-brand-logo">
            <span>Living Data</span> Intelligence
          </div>
        </div>

      </div>

      {/* ── Edit Block Modal ──────────────────────────────────── */}
      {modalOpen && (
        <div className="rm-modal-overlay">
          <div className="rm-modal-content">
            <div className="rm-modal-header">
              <h3>{editingBlock ? 'Edit Block' : 'Add Block'}</h3>
              <button className="rm-close-btn" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="rm-modal-body">
              <div className="rm-form-group">
                <label>Title</label>
                <input 
                  type="text" 
                  className="rm-form-control" 
                  value={formText} 
                  onChange={(e) => setFormText(e.target.value)} 
                  placeholder="Enter block title"
                />
              </div>

              <div className="rm-form-group">
                <label>Description / Subtitle</label>
                <input 
                  type="text" 
                  className="rm-form-control" 
                  value={formSub} 
                  onChange={(e) => setFormSub(e.target.value)} 
                  placeholder="Enter short description"
                />
              </div>

              {editingSection === 'prodReleases' && (
                <div className="rm-form-group">
                  <label>Version</label>
                  <input 
                    type="text" 
                    className="rm-form-control" 
                    value={formVersion} 
                    onChange={(e) => setFormVersion(e.target.value)} 
                    placeholder="e.g. v1.0"
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="rm-form-group">
                  <label>Start Column</label>
                  <select 
                    className="rm-form-select" 
                    value={formColStart} 
                    onChange={(e) => setFormColStart(parseInt(e.target.value))}
                  >
                    {COLUMNS.map((col, idx) => (
                      <option key={col.id} value={idx + 1}>
                        {col.year} {col.sub} ({col.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rm-form-group">
                  <label>End Column</label>
                  <select 
                    className="rm-form-select" 
                    value={formColEnd} 
                    onChange={(e) => setFormColEnd(parseInt(e.target.value))}
                  >
                    {COLUMNS.map((col, idx) => (
                      <option key={col.id} value={idx + 1} disabled={idx + 1 < formColStart}>
                        {col.year} {col.sub} ({col.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rm-form-group">
                <label>Status</label>
                <select 
                  className="rm-form-select" 
                  value={formStatus} 
                  onChange={(e) => setFormStatus(e.target.value)}
                >
                  {editingSection === 'prodReleases' ? (
                    <>
                      <option value="released">Released (Completed)</option>
                      <option value="current">Current (Active)</option>
                      <option value="upcoming">Upcoming (Planned)</option>
                    </>
                  ) : (
                    <>
                      <option value="completed">Completed</option>
                      <option value="active">Active (In Progress)</option>
                      <option value="planned">Planned</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="rm-modal-footer">
              {editingBlock && (
                <button className="rm-btn rm-btn-danger" onClick={handleDeleteBlock} style={{ marginRight: 'auto' }}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button className="rm-btn rm-btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="rm-btn rm-btn-primary" onClick={handleSaveBlock}>
                Save Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ProjectRoadmap.displayName = 'ProjectRoadmap';
export default ProjectRoadmap;
