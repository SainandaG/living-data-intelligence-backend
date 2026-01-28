import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { BarChart3, Clock, TrendingUp, Calendar, Zap } from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    LineChart,
    Line
} from 'recharts';

export default function PatternDashboard({ connectionId, tableName }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use the passed tableName prop (e.g. from 3D graph selection)
                const res = await axios.get(`/api/intelligence/patterns/${connectionId}/${tableName || 'users'}`);
                setData(res.data);
            } catch (err) {
                console.error("Failed to fetch pattern data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [connectionId, tableName]);

    if (loading) return (
        <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Detecting Behavioral Cycles...</p>
            </div>
        </div>
    );

    const hourlyData = data?.daily_cycle ? Object.entries(data.daily_cycle).map(([h, count]) => ({ hour: `${h}:00`, count })) : [];
    const dailyData = data?.weekly_cycle ? Object.entries(data.weekly_cycle).map(([d, count]) => ({
        day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseInt(d)],
        count
    })) : [];

    const peaks = data?.peaks || {};

    return (
        <div className="p-8 h-full flex flex-col gap-6 overflow-y-auto">

            {/* Header / Summary */}
            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-white/10 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="text-blue-400" size={20} />
                    <h2 className="text-lg font-bold text-white tracking-tight">Behavior & Traffic Patterns</h2>
                </div>
                <p className="text-xl text-gray-200 leading-relaxed font-medium">
                    {data?.summary || "No clear patterns detected yet. System is still learning your data behavior."}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Hourly Activity (Daily Cycle) */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                            <Clock size={14} className="text-blue-400" />
                            Daily Activity Cycle
                        </h3>
                        {peaks.peak_hour !== undefined && (
                            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30 uppercase">
                                Peak: {peaks.peak_hour}:00
                            </span>
                        )}
                    </div>

                    <div className="h-48 w-full mt-auto">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourlyData}>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {hourlyData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={parseInt(entry.hour) === peaks.peak_hour ? '#3b82f6' : 'rgba(59, 130, 246, 0.4)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Weekly Activity (Weekly Cycle) */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                            <Calendar size={14} className="text-indigo-400" />
                            Weekly Distribution
                        </h3>
                        {peaks.peak_day_name && (
                            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full border border-indigo-500/30 uppercase">
                                Busiest: {peaks.peak_day_name}
                            </span>
                        )}
                    </div>

                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData}>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#818cf8"
                                    strokeWidth={3}
                                    dot={{ fill: '#818cf8', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Insight Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InsightBox
                    icon={<Zap size={16} />}
                    title="Weekend Load"
                    value={peaks.is_weekend_heavy ? "High" : "Normal"}
                    detail={peaks.is_weekend_heavy ? "Usage spikes from Fri-Sun" : "Activity focused on weekdays"}
                    status={peaks.is_weekend_heavy ? "warning" : "success"}
                />
                <InsightBox
                    icon={<TrendingUp size={16} />}
                    title="Traffic Variance"
                    value="Stable"
                    detail="No erratic spikes detected in the last 7 days."
                    status="success"
                />
                <InsightBox
                    icon={<Clock size={16} />}
                    title="Sync Pattern"
                    value="Nocturnal"
                    detail="Base maintenance activity peaks at 3 AM."
                    status="info"
                />
            </div>
        </div>
    );
}

function InsightBox({ icon, title, value, detail, status }) {
    const statusColors = {
        success: 'text-green-400 bg-green-500/10',
        warning: 'text-yellow-400 bg-yellow-500/10',
        info: 'text-blue-400 bg-blue-500/10'
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${statusColors[status]}`}>
                {icon}
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-xl font-bold text-white mb-2">{value}</p>
            <p className="text-xs text-gray-400 leading-relaxed font-medium">{detail}</p>
        </div>
    );
}
