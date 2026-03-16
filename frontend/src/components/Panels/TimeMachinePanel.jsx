import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Clock, Database, Trash2, Edit3, PlusCircle } from 'lucide-react';
import { getSnapshots, getSnapshot } from '../../utils/apiClient';
import { cn } from '../../utils/cn';

// --- STABLE VARIANTS ---
const panelVariants = {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 100, opacity: 0 }
};

const diffVariants = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 }
};

const TimeMachinePanel = ({ connectionId, onSnapshotSelect, onClose }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1); // 0.5, 1, 2
    const [loading, setLoading] = useState(true);
    const [diff, setDiff] = useState(null);

    const playIntervalRef = useRef(null);

    // Fetch snapshots on mount
    useEffect(() => {
        if (!connectionId) return;
        const fetchSnapshots = async () => {
            setLoading(true);
            try {
                // Adjusting endpoint if needed based on actual backend implementation.
                // Assuming it returns an array of { id, timestamp, ... }
                const data = await getSnapshots(connectionId);
                // Sort chronologically (oldest first if desired, or newest first)
                // Assuming newest is last for timeline flow
                const sorted = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                setSnapshots(sorted);
                if (sorted.length > 0) {
                    setCurrentIndex(sorted.length - 1);
                }
            } catch (err) {
                console.error("Failed to load snapshots:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSnapshots();
    }, [connectionId]);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => stopPlayback();
    }, []);

    // Handle Playback Logic
    useEffect(() => {
        if (isPlaying) {
            const intervalMs = (2000) / speed; // Base 2 seconds divided by speed
            playIntervalRef.current = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= snapshots.length - 1) {
                        stopPlayback();
                        return prev;
                    }
                    return prev + 1;
                });
            }, intervalMs);
        } else {
            stopPlayback();
        }

        return () => stopPlayback();
    }, [isPlaying, speed, snapshots.length]);

    // Handle Snapshot Selection Change
    useEffect(() => {
        if (currentIndex >= 0 && snapshots[currentIndex]) {
            const loadSnapshotData = async () => {
                try {
                    const snapMeta = snapshots[currentIndex];
                    // Fetch full payload
                    const fullData = await getSnapshot(connectionId, snapMeta.id);
                    onSnapshotSelect(fullData, snapMeta);
                    calculateDiff(currentIndex);
                } catch (err) {
                    console.error("Failed to load snapshot detailed data", err);
                }
            };
            loadSnapshotData();
        }
    }, [currentIndex]);

    const stopPlayback = () => {
        if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };

    const handlePlayPause = () => setIsPlaying(!isPlaying);
    const handleNext = () => setCurrentIndex(p => Math.min(p + 1, snapshots.length - 1));
    const handlePrev = () => setCurrentIndex(p => Math.max(p - 1, 0));

    // Calculate Diff (Added, Removed, Changed)
    const calculateDiff = (index) => {
        if (index <= 0) {
            setDiff(null);
            return;
        }
        
        const currentMeta = snapshots[index];
        const prevMeta = snapshots[index - 1];
        
        // This relies on the backend returning basic table counts/lists in the getSnapshots array
        // If not, we would need to compare fullGraph payloads. Assuming fullGraph for accuracy:
        
        // Quick extraction to compute metrics. If full data isn't in meta, we show diff based on available stats
        // To keep it simple and fast without 2 API calls per step, we use the `summary` or `metrics` if present in the snapshot list.
        // Fallback: Just show relative changes if available.
        const cTables = currentMeta.tables_count || 0;
        const pTables = prevMeta.tables_count || 0;
        
        const changes = [];
        if (cTables > pTables) changes.push({ type: 'added', msg: `+${cTables - pTables} Tables` });
        if (cTables < pTables) changes.push({ type: 'removed', msg: `-${pTables - cTables} Tables` });
        
        // Let's assume we also have total_rows in meta
        const cRows = currentMeta.total_rows || 0;
        const pRows = prevMeta.total_rows || 0;
        const rowDiff = cRows - pRows;

        if (rowDiff !== 0) {
            changes.push({ 
                type: 'changed', 
                msg: `${rowDiff > 0 ? '+' : ''}${rowDiff.toLocaleString()} Rows`
            });
        }
        
        setDiff(changes.length > 0 ? changes : [{ type: 'none', msg: 'No structural changes' }]);
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const formatShortTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    if (!connectionId) return null;

    return (
        <motion.div 
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-[800px] bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 rounded-xl shadow-2xl p-4 shadow-blue-900/20"
        >
            {/* Header & Controls */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Clock className="text-blue-400 w-5 h-5" />
                    <h3 className="text-white font-bold tracking-wider uppercase text-sm">Time Machine</h3>
                    {snapshots.length > 0 && currentIndex >= 0 && (
                        <span className="ml-2 text-xs text-slate-400">
                            Snapshot {currentIndex + 1} of {snapshots.length} — {formatDate(snapshots[currentIndex].timestamp)}
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Speed Selector */}
                    <div className="flex items-center bg-slate-800 rounded-lg p-1">
                        {[0.5, 1, 2].map(s => (
                            <button 
                                key={s} 
                                onClick={() => setSpeed(s)}
                                className={cn(
                                    "px-2 py-1 text-xs font-bold rounded",
                                    speed === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                                )}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>

                    <button onClick={onClose} className="text-slate-500 hover:text-white">
                        <Trash2 className="w-5 h-5 rotate-45 transform" /> {/* Close icon lookalike */}
                    </button>
                </div>
            </div>

            {/* Diff View */}
            <AnimatePresence mode="wait">
                {diff && (
                    <motion.div 
                        key={currentIndex}
                        variants={diffVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex items-center gap-3 mb-4 text-xs font-mono"
                    >
                        {diff.map((d, i) => (
                            <span key={i} className={cn(
                                "px-2 py-1 rounded flex items-center gap-1",
                                d.type === 'added' ? 'bg-green-500/20 text-green-400' :
                                d.type === 'removed' ? 'bg-rose-500/20 text-rose-400' :
                                d.type === 'changed' ? 'bg-amber-500/20 text-amber-400' :
                                'text-slate-500'
                            )}>
                                {d.type === 'added' && <PlusCircle className="w-3 h-3"/>}
                                {d.type === 'removed' && <Trash2 className="w-3 h-3"/>}
                                {d.type === 'changed' && <Edit3 className="w-3 h-3"/>}
                                {d.msg}
                            </span>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Timeline Scrubber */}
            <div className="relative h-12 flex items-center mb-2 px-4">
                <div className="absolute left-4 right-4 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${snapshots.length > 1 ? (currentIndex / (snapshots.length - 1)) * 100 : 0}%` }}
                    />
                </div>

                <div className="absolute left-4 right-4 flex justify-between">
                    {snapshots.map((snap, i) => {
                        const isPast = i <= currentIndex;
                        const isCurrent = i === currentIndex;
                        return (
                            <button
                                key={snap.id}
                                onClick={() => { setIsPlaying(false); setCurrentIndex(i); }}
                                className="relative flex flex-col items-center group outline-none"
                                style={{
                                    left: `${(i / (snapshots.length - 1)) * 100}%`,
                                    position: 'absolute',
                                    transform: 'translateX(-50%)'
                                }}
                            >
                                <div className={cn(
                                    "w-3 h-3 rounded-full transition-all duration-300",
                                    isCurrent ? 'bg-white scale-150 shadow-[0_0_10px_#fff]' : 
                                    isPast ? 'bg-blue-400' : 'bg-slate-600'
                                )} />
                                
                                {/* Tooltip */}
                                <div className="absolute top-4 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-1 rounded text-[10px] text-white pointer-events-none mt-1 z-10 border border-slate-700">
                                    {formatDate(snap.timestamp)}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-6 mt-4">
                <button 
                    onClick={handlePrev} 
                    disabled={currentIndex <= 0}
                    className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                    <SkipBack className="fill-current w-5 h-5"/>
                </button>

                <button 
                    onClick={handlePlayPause}
                    disabled={loading || snapshots.length === 0}
                    className="w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all"
                >
                    {isPlaying ? <Pause className="fill-current w-6 h-6"/> : <Play className="fill-current w-6 h-6 ml-1"/>}
                </button>

                <button 
                    onClick={handleNext}
                    disabled={currentIndex >= snapshots.length - 1} 
                    className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                    <SkipForward className="fill-current w-5 h-5"/>
                </button>
            </div>
            
            {loading && (
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            )}
        </motion.div>
    );
};

export default React.memo(TimeMachinePanel);
