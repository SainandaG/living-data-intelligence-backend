import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { TrendingUp, Calendar, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function PredictionDashboard({ connectionId, tableName }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`/api/intelligence/predictions/${connectionId}/${tableName || 'orders'}`);
                setData(res.data);
            } catch (err) {
                console.error("Failed to fetch predictions:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [connectionId, tableName]);

    if (loading) return (
        <div className="p-8 flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
                <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Computing Future States...</p>
            </div>
        </div>
    );

    const forecastData = data?.forecast || [];
    const growth = data?.growth_percentage_30d || 0;
    const risk = data?.risk_level || 'Low';

    return (
        <div className="p-8 h-full flex flex-col gap-6 overflow-y-auto">

            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <TrendingUp className="text-yellow-400" size={24} />
                        Future Predictor
                    </h2>
                    <p className="text-gray-400 mt-1">Growth forecasts and storage capacity planning</p>
                </div>

                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-colors">30-Day View</button>
                    <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-500 cursor-not-allowed">90-Day View (Beta)</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Growth Stats Column */}
                <div className="flex flex-col gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Predicted Growth</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white">+{growth}%</span>
                            <span className="text-xs text-gray-400">Next 30 Days</span>
                        </div>
                    </div>

                    <div className={`rounded-3xl p-6 border ${risk === 'High' ? 'bg-red-500/10 border-red-500/20' :
                        risk === 'Medium' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-green-500/10 border-green-500/20'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                            {risk === 'High' ? <AlertTriangle className="text-red-400" size={16} /> : <ShieldCheck className="text-green-400" size={16} />}
                            <p className="text-[10px] font-bold uppercase tracking-widest">{risk} RISK ALERT</p>
                        </div>
                        <p className="text-sm text-gray-200 font-medium leading-relaxed">
                            {data?.summary}
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex-1 flex flex-col justify-center gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Current Records</span>
                            <span className="text-sm font-mono text-white">{(data?.current_size || 0).toLocaleString()}</span>
                        </div>
                        <div className="w-full h-px bg-white/5" />
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-bold text-yellow-500/60 uppercase tracking-tighter">Predicted (30d)</span>
                            <span className="text-sm font-mono text-yellow-400 font-bold">{(data?.predicted_size_30d || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Main Forecast Chart */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-8 flex items-center gap-2">
                        <Calendar size={14} className="text-yellow-400" />
                        30-Day Load Forecast
                    </h3>

                    <div className="flex-1 min-h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={forecastData}>
                                <defs>
                                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ffd60a" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#ffd60a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="rgba(255,255,255,0.2)"
                                    fontSize={10}
                                    tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="rgba(255,255,255,0.2)"
                                    fontSize={10}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => val > 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#ffd60a', fontSize: '10px', fontWeight: 'bold' }}
                                />
                                <Area
                                    type="stepAfter"
                                    dataKey="predicted_count"
                                    stroke="#ffd60a"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    strokeDasharray="5 5"
                                    fill="url(#colorForecast)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 flex items-center gap-6 text-[10px] font-bold text-gray-500 border-t border-white/5 pt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 border-t-2 border-dashed border-yellow-400" />
                            <span>PREDICTED TREND</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <Zap size={10} className="text-yellow-400" />
                            <span>CONFIDENCE: 89%</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
