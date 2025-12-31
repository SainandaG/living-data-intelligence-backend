/**
 * Intelligence Action Overlay
 * Displays Neural Core suggestions to the user.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IntelligenceActionOverlay = ({ action, onAccept, onDismiss }) => {
    const [timeRemaining, setTimeRemaining] = useState(15);

    useEffect(() => {
        // Countdown timer
        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    onDismiss();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onDismiss]);

    if (!action) return null;

    // Determine icon and color based on action type
    const getActionStyle = (type) => {
        const styles = {
            suggest_drill_down: { icon: '🔍', color: '#22d3ee', label: 'Suggestion' },
            suggest_related_node: { icon: '🔗', color: '#a78bfa', label: 'Related' },
            explain_anomaly: { icon: '⚠️', color: '#fbbf24', label: 'Anomaly' },
            suggest_view_change: { icon: '👁️', color: '#60a5fa', label: 'View' },
            highlight_node: { icon: '✨', color: '#34d399', label: 'Highlight' },
            default: { icon: '💡', color: '#64748b', label: 'Insight' }
        };

        return styles[type] || styles.default;
    };

    const style = getActionStyle(action.type);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="intelligence-action-overlay"
                style={{
                    position: 'fixed',
                    top: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10000,
                    maxWidth: '500px',
                    width: '90%'
                }}
            >
                <div
                    className="action-card"
                    style={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: `2px solid ${style.color}`,
                        borderRadius: '16px',
                        padding: '20px',
                        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${style.color}40`,
                        color: '#fff'
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '24px', marginRight: '12px' }}>{style.icon}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', color: style.color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Neural Core {style.label}
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                Confidence: {Math.round(action.confidence * 100)}%
                            </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {timeRemaining}s
                        </div>
                    </div>

                    {/* Reasoning */}
                    <div style={{ marginBottom: '16px', fontSize: '14px', lineHeight: '1.5', color: '#e2e8f0' }}>
                        {action.reasoning}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={onAccept}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                background: `linear-gradient(135deg, ${style.color}, ${style.color}dd)`,
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                            ✓ Accept
                        </button>

                        <button
                            onClick={onDismiss}
                            style={{
                                padding: '10px 16px',
                                background: 'rgba(71, 85, 105, 0.5)',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#cbd5e1',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(71, 85, 105, 0.8)';
                                e.target.style.borderColor = '#64748b';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'rgba(71, 85, 105, 0.5)';
                                e.target.style.borderColor = '#475569';
                            }}
                        >
                            ✕ Dismiss
                        </button>
                    </div>

                    {/* Feedback buttons */}
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', fontSize: '12px' }}>
                        <button
                            onClick={() => {
                                onAccept({ marked_as_helpful: true });
                            }}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                background: 'transparent',
                                border: '1px solid #34d399',
                                borderRadius: '6px',
                                color: '#34d399',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            👍 Helpful
                        </button>
                        <button
                            onClick={() => {
                                onDismiss({ marked_as_unhelpful: true });
                            }}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                background: 'transparent',
                                border: '1px solid #f87171',
                                borderRadius: '6px',
                                color: '#f87171',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            👎 Not Helpful
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default IntelligenceActionOverlay;
