import React, { useState, useEffect } from 'react';

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
    input: {
        background: 'rgba(5, 10, 25, 0.9)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#fff',
        fontSize: '11px',
        padding: '6px',
        borderRadius: '6px',
        width: '100%',
        outline: 'none',
        appearance: 'none',
        cursor: 'pointer'
    }
};

const DataLensPanel = ({ dataClusters, connectionId, onFilterChange, activeFilters = {} }) => {
    const [selectedTable, setSelectedTable] = useState('');
    const [selectedCol, setSelectedCol] = useState('');
    const [distinctValues, setDistinctValues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [error, setError] = useState(null);

    // Fetch distinct values when table/col changes
    useEffect(() => {
        if (!selectedTable || !selectedCol) {
            setDistinctValues([]);
            return;
        }

        const fetchValues = async () => {
            setLoading(true);
            setError(null);
            try {
                // Use default connection if none provided (backend handles this too)
                const url = `/api/data/distinct/${encodeURIComponent(selectedTable)}/${encodeURIComponent(selectedCol)}${connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : ''}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.success) {
                    setDistinctValues(data.values || []);
                } else {
                    setError(data.detail || 'Failed to fetch values');
                }
            } catch (err) {
                console.error('Failed to fetch distinct values:', err);
                setError('Discovery failed');
            } finally {
                setLoading(false);
            }
        };

        fetchValues();
    }, [selectedTable, selectedCol, connectionId]);

    const handleValueToggle = (val) => {
        const valueStr = String(val);
        const filterKey = `cat:${selectedTable.toLowerCase()}:${selectedCol.toLowerCase()}:${valueStr.toLowerCase()}`;
        const isActive = activeFilters[filterKey] === true;
        onFilterChange?.(filterKey, !isActive);
    };

    return (
        <div style={s.panel}>
            <div style={s.panelHead}>
                <span style={s.panelTitle}>Data Lens (Categorical)</span>
                <span style={s.closeBtn} onClick={() => setExpanded(!expanded)}>{expanded ? '−' : '+'}</span>
            </div>
            {expanded && (
                <div style={s.panelBody}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Table Selector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={s.panelTitle}>Target Table</span>
                            <select
                                value={selectedTable}
                                onChange={(e) => { setSelectedTable(e.target.value); setSelectedCol(''); setDistinctValues([]); setError(null); }}
                                style={s.input}
                            >
                                <option value="">Select Table...</option>
                                {dataClusters?.map(node => (
                                    <option key={node.id} value={node.id}>{node.name || node.id}</option>
                                ))}
                            </select>
                        </div>

                        {/* Column Selector */}
                        {selectedTable && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={s.panelTitle}>Target Column</span>
                                <select
                                    value={selectedCol}
                                    onChange={(e) => setSelectedCol(e.target.value)}
                                    style={s.input}
                                >
                                    <option value="">Select Column...</option>
                                    {(() => {
                                        const node = dataClusters?.find(n => n.id === selectedTable);
                                        const cols = node?.columns || [];
                                        const fkCols = (node?.foreign_keys || []).map(f => f.column);
                                        const allCols = Array.from(new Set([...cols.map(c => typeof c === 'string' ? c : (c.name || '')), ...fkCols])).filter(Boolean);

                                        return allCols.map(colName => (
                                            <option key={colName} value={colName}>{colName.toUpperCase()}</option>
                                        ));
                                    })()}
                                </select>
                            </div>
                        )}

                        {/* Values List */}
                        {loading ? (
                            <div style={{ fontSize: '9px', opacity: 0.5, textAlign: 'center', padding: '10px' }}>DISCOVERING VALUES...</div>
                        ) : error ? (
                            <div style={{ fontSize: '9px', color: '#f87171', textAlign: 'center', padding: '10px' }}>{error.toUpperCase()}</div>
                        ) : distinctValues.length > 0 ? (
                            <div style={{ marginTop: '5px', maxHeight: '120px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                                {distinctValues.map((val, i) => {
                                    const valueStr = String(val);
                                    const filterKey = `cat:${selectedTable.toLowerCase()}:${selectedCol.toLowerCase()}:${valueStr.toLowerCase()}`;
                                    const isActive = activeFilters[filterKey] === true;
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => handleValueToggle(val)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                                                fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                background: isActive ? 'rgba(99,102,241,0.3)' : 'transparent',
                                                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                                                transition: 'all 0.2s ease',
                                                fontWeight: isActive ? 700 : 400
                                            }}
                                        >
                                            <div style={{
                                                width: '12px', height: '12px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.3)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isActive ? '#818cf8' : 'rgba(255,255,255,0.05)',
                                                boxShadow: isActive ? '0 0 10px rgba(129,140,248,0.5)' : 'none'
                                            }}>
                                                {isActive && <div style={{ width: '4px', height: '4px', background: '#fff', borderRadius: '1px' }} />}
                                            </div>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : selectedCol && (
                            <div style={{ fontSize: '9px', opacity: 0.3, textAlign: 'center', padding: '10px' }}>NO DATA DISCOVERED</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataLensPanel;
