/**
 * Learning Metrics Dashboard
 * Displays Neural Core learning progress and statistics.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const LearningMetricsDashboard = ({ connectionId, intelligenceClient }) => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!intelligenceClient) return;

            const data = await intelligenceClient.getMetrics();
            setMetrics(data);
            setLoading(false);
        };

        fetchMetrics();

        // Refresh every 10 seconds
        const interval = setInterval(fetchMetrics, 10000);
        return () => clearInterval(interval);
    }, [intelligenceClient]);

    if (loading) {
        return (
            <div style={{ padding: '20px', color: '#94a3b8' }}>
                Loading metrics...
            </div>
        );
    }

    if (!metrics) {
        return (
            <div style={{ padding: '20px', color: '#94a3b8' }}>
                No metrics available
            </div>
        );
    }

    const avgReward = metrics.avg_reward || 0;
    const recentRewards = metrics.recent_rewards || [];
    const actionStats = metrics.action_stats || {};

    return (
        <div style={{ padding: '20px', color: '#fff' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: '#22d3ee' }}>
                🧠 Neural Core Learning Metrics
            </h2>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <MetricCard
                    title="Total Actions"
                    value={metrics.total_actions}
                    icon="🎯"
                    color="#22d3ee"
                />
                <MetricCard
                    title="Average Reward"
                    value={avgReward.toFixed(3)}
                    icon="⭐"
                    color="#fbbf24"
                />
                <MetricCard
                    title="Exploration Rate"
                    value={`${(metrics.epsilon * 100).toFixed(1)}%`}
                    icon="🔍"
                    color="#a78bfa"
                />
                <MetricCard
                    title="Model State"
                    value={metrics.model_state}
                    icon="🤖"
                    color="#34d399"
                />
            </div>

            {/* Recent Rewards Trend */}
            <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#cbd5e1' }}>
                    Recent Reward Trend
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
                    {recentRewards.map((reward, idx) => {
                        const height = Math.abs(reward) * 30;
                        const color = reward > 0 ? '#34d399' : '#f87171';

                        return (
                            <motion.div
                                key={idx}
                                initial={{ height: 0 }}
                                animate={{ height: `${height}px` }}
                                style={{
                                    flex: 1,
                                    background: color,
                                    borderRadius: '4px 4px 0 0',
                                    minHeight: '2px',
                                    opacity: 0.7 + (idx / recentRewards.length) * 0.3
                                }}
                                title={`Reward: ${reward.toFixed(2)}`}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Action Statistics */}
            <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#cbd5e1' }}>
                    Action Performance
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(actionStats).map(([actionType, stats]) => {
                        const successRate = stats.attempts > 0 ? (stats.successes / stats.attempts) * 100 : 0;

                        return (
                            <div
                                key={actionType}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', color: '#cbd5e1', textTransform: 'capitalize' }}>
                                        {actionType.replace(/_/g, ' ')}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                        {stats.attempts} attempts
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                                    <div>
                                        <span style={{ color: '#64748b' }}>Success: </span>
                                        <span style={{ color: '#34d399' }}>{successRate.toFixed(1)}%</span>
                                    </div>
                                    <div>
                                        <span style={{ color: '#64748b' }}>Avg Reward: </span>
                                        <span style={{ color: stats.avg_reward > 0 ? '#34d399' : '#f87171' }}>
                                            {stats.avg_reward.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div style={{ marginTop: '8px', height: '4px', background: 'rgba(148, 163, 184, 0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${successRate}%` }}
                                        style={{
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #22d3ee, #34d399)',
                                            borderRadius: '2px'
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Connection Metrics */}
            {metrics.connection_metrics && (
                <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 211, 238, 0.3)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#22d3ee' }}>
                        Connection Statistics
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
                        <div>
                            <span style={{ color: '#94a3b8' }}>Interactions: </span>
                            <span style={{ color: '#fff' }}>{metrics.connection_metrics.total_interactions}</span>
                        </div>
                        <div>
                            <span style={{ color: '#94a3b8' }}>Learning Epoch: </span>
                            <span style={{ color: '#fff' }}>{metrics.connection_metrics.learning_epoch}</span>
                        </div>
                        <div>
                            <span style={{ color: '#94a3b8' }}>Nodes: </span>
                            <span style={{ color: '#fff' }}>{metrics.connection_metrics.nodes_count}</span>
                        </div>
                        <div>
                            <span style={{ color: '#94a3b8' }}>Edges: </span>
                            <span style={{ color: '#fff' }}>{metrics.connection_metrics.edges_count}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MetricCard = ({ title, value, icon, color }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
            background: 'rgba(30, 41, 59, 0.5)',
            padding: '16px',
            borderRadius: '12px',
            border: `1px solid ${color}40`,
            boxShadow: `0 0 20px ${color}20`
        }}
    >
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: color, marginBottom: '4px' }}>
            {value}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
        </div>
    </motion.div>
);

export default LearningMetricsDashboard;
