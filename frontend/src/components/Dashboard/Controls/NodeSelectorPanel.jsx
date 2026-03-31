import React, { useState } from 'react';

const s = {
    panel: {
        background: 'rgba(10,15,30,0.75)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        width: '100%',
        marginBottom: '10px'
    },
    panelHead: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
    },
    panelTitle: {
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.15em',
        color: '#fff',
        textTransform: 'uppercase',
        fontFamily: '"Rajdhani", sans-serif'
    },
    panelBody: { padding: '12px 14px' },
    closeBtn: { cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '16px', lineHeight: 1 },
};

const NodeSelectorPanel = ({ dataClusters, multiSelectedNodes, setMultiSelectedNodes, showMultiConnections, setShowMultiConnections }) => {
    const [expanded, setExpanded] = useState(true);

    return (
        <div style={s.panel}>
            <div style={s.panelHead}>
                <span style={s.panelTitle}>Node Selector</span>
                <span style={s.closeBtn} onClick={() => setExpanded(!expanded)}>{expanded ? '−' : '+'}</span>
            </div>
            {expanded && (
                <div style={{ ...s.panelBody, maxHeight: '200px', overflowY: 'auto' }}>
                    {(dataClusters || []).map(node => {
                        const isSelected = multiSelectedNodes?.includes(node.id);
                        return (
                            <div key={node.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', overflow: 'hidden' }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setMultiSelectedNodes?.(prev => [...(prev || []), node.id]);
                                            } else {
                                                setMultiSelectedNodes?.(prev => (prev || []).filter(id => id !== node.id));
                                            }
                                        }}
                                        style={{ cursor: 'pointer', accentColor: '#818cf8', flexShrink: 0 }}
                                    />
                                    <span style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={node.name || node.id}>
                                        {node.name || node.id}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => setShowMultiConnections?.(!showMultiConnections)}
                            style={{
                                flex: 2, padding: '6px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', cursor: 'pointer',
                                background: showMultiConnections ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99,102,241,0.2)',
                                border: `1px solid ${showMultiConnections ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99,102,241,0.4)'}`,
                                color: showMultiConnections ? '#34d399' : '#c7d2fe',
                                borderRadius: '4px', transition: 'all 0.2s',
                                fontFamily: '"Rajdhani", sans-serif'
                            }}
                        >
                            {showMultiConnections ? 'DISABLE ISOLATION' : 'ISOLATE CONNECTIONS'}
                        </button>
                        {(multiSelectedNodes?.length > 0) && (
                            <button
                                onClick={() => {
                                    setMultiSelectedNodes?.([]);
                                    setShowMultiConnections?.(false);
                                }}
                                style={{
                                    flex: 1, padding: '6px', fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#f87171', borderRadius: '4px', transition: 'all 0.2s',
                                    fontFamily: '"Rajdhani", sans-serif'
                                }}
                                title="Clear Selection"
                            >
                                CLEAR
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NodeSelectorPanel;
