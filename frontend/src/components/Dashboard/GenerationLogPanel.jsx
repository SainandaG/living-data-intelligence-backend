import React, { useState, useEffect, useRef } from 'react';
import { useWindowManager } from '../../context/WindowManagerContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { cn } from '../../utils/cn';

export const GenerationLogPanel = () => {
    const { connectionId } = useWindowManager();
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const scrollRef = useRef(null);
    const autoHideTimeout = useRef(null);
    
    // Subscribe to generation logs
    const { lastMessage } = useWebSocket(
        connectionId ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/logs/${connectionId}` : null
    );

    useEffect(() => {
        if (lastMessage && lastMessage.type === 'generation_log') {
            const entry = lastMessage.data;
            
            // Auto-show when activity starts
            setIsVisible(true);
            setMinimized(false);
            
            setLogs(prev => {
                const updated = [...prev, entry];
                return updated.slice(-100); // Keep last 100
            });
            
            if (entry.progress !== undefined) {
                setProgress(entry.progress);
            }

            // Auto-hide after 15s of inactivity if 100% complete
            if (autoHideTimeout.current) clearTimeout(autoHideTimeout.current);
            if (entry.progress === 100) {
                autoHideTimeout.current = setTimeout(() => {
                    setIsVisible(false);
                }, 15000);
            }
        }
    }, [lastMessage]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (!connectionId || !isVisible) return null;

    return (
        <div className={cn("generation-log-panel glass-card", minimized && 'minimized')}>
            <div className="panel-header" onClick={() => setMinimized(!minimized)}>
                <div className="flex items-center gap-2">
                    <span className={cn("text-emerald-400", progress < 100 && 'animate-pulse')}>●</span>
                    <span className="text-xs font-bold tracking-widest uppercase opacity-70">
                        {progress < 100 ? 'Core Processing...' : 'Processing Complete'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-[10px] font-mono opacity-50">{progress}%</div>
                    <button className="text-white/50 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}>×</button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="progress-container">
                <div 
                    className="progress-bar" 
                    style={{ 
                        width: `${progress}%`,
                        background: progress === 100 ? '#10b981' : 'linear-gradient(90deg, #22d3ee, #60a5fa)'
                    }}
                />
            </div>

            {/* Log Output */}
            <div className="log-output custom-scrollbar" ref={scrollRef}>
                {logs.length === 0 ? (
                    <div className="text-center py-8 opacity-30 text-xs italic">
                        Waiting for core initialization...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={cn("log-entry", log.level)}>
                            <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                            <span className="log-message">{log.message}</span>
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .generation-log-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 320px;
                    height: 240px;
                    display: flex;
                    flex-direction: column;
                    z-index: 1000;
                    overflow: hidden;
                    padding: 0 !important;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(10, 15, 25, 0.9); backdrop-filter: blur(12px);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .generation-log-panel.minimized {
                    height: 40px;
                    width: 200px;
                }

                .panel-header {
                    padding: 10px 15px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.02);
                    cursor: pointer;
                }

                .progress-container {
                    height: 2px;
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                }

                .progress-bar {
                    height: 100%;
                    transition: width 0.3s ease;
                    box-shadow: 0 0 10px currentColor;
                }

                .log-output {
                    flex: 1;
                    padding: 10px;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 10px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .log-entry {
                    line-height: 1.4;
                    display: flex;
                    gap: 8px;
                }

                .log-time {
                    opacity: 0.4;
                    flex-shrink: 0;
                }

                .log-message {
                    opacity: 0.9;
                }

                .log-entry.error .log-message { color: #f87171; }
                .log-entry.warning .log-message { color: #fbbf24; }
                .log-entry.success .log-message { color: #34d399; }
                .log-entry.info .log-message { color: #e2e8f0; }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
};
