import { useState, useEffect, useCallback } from 'react';

// Generates a random color for the persona
const generateColor = () => {
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316'];
    return colors[Math.floor(Math.random() * colors.length)];
};

// Generates a stable random name
const generateName = () => {
    const adjs = ['Quantum', 'Lunar', 'Cosmic', 'Nebula', 'Stellar', 'Astral', 'Nexus', 'Cyber', 'Neon', 'Echo'];
    const nouns = ['Panda', 'Fox', 'Wolf', 'Owl', 'Hawk', 'Tiger', 'Bear', 'Lynx', 'Viper', 'Raven'];
    return `${adjs[Math.floor(Math.random() * adjs.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

export const useMultiplayer = (sendMessage, isConnected, appState) => {
    const [persona, setPersona] = useState(() => {
        const stored = localStorage.getItem('multiplayer_persona');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                // reset if parse fails
            }
        }

        const newPersona = {
            id: `usr_${Math.random().toString(36).substring(2, 9)}`,
            name: generateName(),
            color: generateColor()
        };
        localStorage.setItem('multiplayer_persona', JSON.stringify(newPersona));
        return newPersona;
    });

    const [activePeers, setActivePeers] = useState({});

    // Process incoming presence data
    const handlePresenceMessage = useCallback((data) => {
        if (!data || data.type !== 'presence_update') return;

        // Ignore our own messages reflected back
        if (data.user_id === persona.id) return;

        setActivePeers(prev => ({
            ...prev,
            [data.user_id]: {
                name: data.name,
                color: data.color,
                camera: data.camera,
                selected_node: data.selected_node,
                lens: data.lens,
                last_seen: Date.now()
            }
        }));
    }, [persona.id]);

    // Send presence heartbeat continually
    useEffect(() => {
        if (!isConnected) return;

        const intervalId = setInterval(() => {
            let cameraState = null;
            if (appState.getCurrentCameraState) {
                cameraState = appState.getCurrentCameraState();
            }

            sendMessage({
                type: 'presence_update',
                user_id: persona.id,
                name: persona.name,
                color: persona.color,
                camera: cameraState,
                selected_node: appState.selectedNodeId,
                lens: appState.currentLens,
                timestamp: Date.now()
            });
        }, 1000); // 1-second heartbeat

        return () => clearInterval(intervalId);
    }, [isConnected, sendMessage, persona, appState]);

    // Cleanup stale peers
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setActivePeers(prev => {
                const next = { ...prev };
                let changed = false;
                for (const [id, peer] of Object.entries(next)) {
                    if (now - peer.last_seen > 10000) { // 10 seconds timeout
                        delete next[id];
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return { persona, activePeers, handlePresenceMessage };
};
