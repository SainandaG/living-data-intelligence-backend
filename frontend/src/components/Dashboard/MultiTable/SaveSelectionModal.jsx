import React, { useState } from 'react';

export default function SaveSelectionModal({ isOpen, onClose, onSave, recordCount, metricCount }) {
    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!title.trim()) return;
        setIsSaving(true);
        try {
            await onSave(title);
            setTitle('');
            onClose();
        } catch (error) {
            console.error("Failed to save selection:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                width: 420, background: '#0f172a', border: '1px solid #1e293b',
                borderRadius: 16, padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <style>
                    {`
                        @keyframes modalIn {
                            from { opacity: 0; transform: scale(0.95) translateY(10px); }
                            to { opacity: 1; transform: scale(1) translateY(0); }
                        }
                    `}
                </style>

                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', letterSpacing: 2, marginBottom: 4 }}>
                        BOOKMARK SELECTION
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>
                        Save current investigation
                    </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
                        Selection Name
                    </label>
                    <input
                        autoFocus
                        type="text"
                        placeholder="e.g. Unusual Voltage Drop Group"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b',
                            borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#fff',
                            outline: 'none', transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.target.style.borderColor = '#fbbf24'}
                        onBlur={e => e.target.style.borderColor = '#1e293b'}
                    />
                </div>

                <div style={{ 
                    display: 'flex', gap: 12, padding: '12px', background: 'rgba(255,255,255,0.02)', 
                    borderRadius: 8, marginBottom: 24, border: '1px solid rgba(255,255,255,0.03)' 
                }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Records</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{recordCount}</div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Metrics</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{metricCount}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, background: 'transparent', border: '1px solid #334155',
                            color: '#94a3b8', borderRadius: 8, padding: '10px',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.03)'; e.target.style.color = '#fff'; }}
                        onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#94a3b8'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !title.trim()}
                        style={{
                            flex: 2, background: isSaving ? '#475569' : '#fbbf24', border: 'none',
                            color: '#000', borderRadius: 8, padding: '10px',
                            fontSize: 12, fontWeight: 800, cursor: isSaving ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(251, 191, 36, 0.2)'
                        }}
                        onMouseEnter={e => { if(!isSaving) e.target.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { if(!isSaving) e.target.style.transform = 'translateY(0)'; }}
                    >
                        {isSaving ? 'Saving...' : 'Save Selection'}
                    </button>
                </div>
            </div>
        </div>
    );
}
