import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Calendar, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import evolutionService from '../../services/evolutionService';

const TimelinePlayer = ({ connectionId, onSnapshotUpdate }) => {
    const [timeline, setTimeline] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [currentDate, setCurrentDate] = useState(null);
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);

    const timerRef = useRef(null);
    const lastUpdateRef = useRef(0);

    // Initialize timeline
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                const data = await evolutionService.getTimeline(connectionId);
                setTimeline(data);
                setMilestones(data.milestones || []);
                setCurrentDate(new Date(data.start_date));
            } catch (err) {
                console.error("Failed to load evolution timeline:", err);
            } finally {
                setLoading(false);
            }
        };
        if (connectionId) init();
    }, [connectionId]);

    // Handle playback
    useEffect(() => {
        if (isPlaying) {
            timerRef.current = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        setIsPlaying(false);
                        return 100;
                    }
                    return prev + (0.1 * playbackSpeed);
                });
            }, 50);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isPlaying, playbackSpeed]);

    // Update current date and trigger snapshot update when progress changes
    useEffect(() => {
        if (!timeline || !timeline.start_date || !timeline.end_date) return;

        const start = new Date(timeline.start_date).getTime();
        const end = new Date(timeline.end_date).getTime();

        // Defensive check for invalid dates
        if (isNaN(start) || isNaN(end)) {
            console.warn("[TimelinePlayer] Invalid timeline dates provided:", timeline.start_date, timeline.end_date);
            return;
        }

        const currentTs = start + (end - start) * (progress / 100);
        const newDate = new Date(currentTs);

        if (isNaN(newDate.getTime())) return;

        // CRITICAL: Clamp to end date to prevent requesting future snapshots
        const clampedDate = new Date(Math.min(newDate.getTime(), end));

        setCurrentDate(clampedDate);

        // Throttle snapshot updates for performance
        // FIX: Replaced debounce (setTimeout) with Throttle to ensure updates happen DURING playback
        const now = Date.now();
        if (!lastUpdateRef.current || now - lastUpdateRef.current > 150) { // Update every 150ms
            lastUpdateRef.current = now;
            updateSnapshot(clampedDate);
        }
    }, [progress, timeline, connectionId]);

    const updateSnapshot = async (targetDate) => {
        try {
            const snapshot = await evolutionService.getSnapshot(connectionId, targetDate.toISOString());
            onSnapshotUpdate(snapshot);
        } catch (err) {
            console.warn("Snapshot update failed", err);
        }
    };

    if (loading) return null;
    if (!timeline) return null;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[800px] z-50">
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
                {/* Controls Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                        </button>

                        <div className="flex flex-col">
                            <span className="text-white font-bold text-lg">
                                {currentDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-slate-400 text-xs flex items-center gap-1">
                                <Clock size={12} /> {currentDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
                        {[1, 2, 5, 10].map(speed => (
                            <button
                                key={speed}
                                onClick={() => setPlaybackSpeed(speed)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${playbackSpeed === speed ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {speed}x
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeline Slider */}
                <div className="relative h-12 flex items-center">
                    {/* Milestone Markers */}
                    {milestones.map((m, idx) => {
                        const mDate = new Date(m.date).getTime();
                        const start = new Date(timeline.start_date).getTime();
                        const end = new Date(timeline.end_date).getTime();
                        const mPos = ((mDate - start) / (end - start)) * 100;

                        return (
                            <div
                                key={idx}
                                className="absolute top-1/2 -translate-y-1/2 group"
                                style={{ left: `${mPos}%` }}
                            >
                                <div className={`w-2 h-2 rounded-full cursor-help ${m.importance === 'critical' ? 'bg-rose-500 scale-125' : 'bg-indigo-400'}`} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    <div className="bg-slate-800 border border-white/10 p-2 rounded-lg text-[10px] shadow-xl">
                                        <div className="text-indigo-300 font-bold mb-1 uppercase tracking-tighter">{m.type.replace('_', ' ')}</div>
                                        <div className="text-white font-medium">{m.title}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.01"
                        value={progress}
                        onChange={(e) => setProgress(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>

                {/* Legend / Info */}
                <div className="flex justify-between mt-1 text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                    <span>Genesis: {new Date(timeline.start_date).getFullYear()}</span>
                    <span>Database Evolution Timeline</span>
                    <span>Present Day</span>
                </div>
            </motion.div>
        </div>
    );
};

export default TimelinePlayer;
