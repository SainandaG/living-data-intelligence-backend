/**
 * Evolution Service API Client
 * Handles communication with the Temporal Genesis endpoints.
 */
import axios from 'axios';

const API_BASE = 'http://localhost:8001/api/evolution';

const evolutionService = {
    /**
     * Analyze the database evolution for a connection
     */
    async analyzeEvolution(connectionId) {
        const response = await axios.get(`${API_BASE}/analyze/${connectionId}`);
        return response.data;
    },

    /**
     * Get the full timeline for a connection
     */
    async getTimeline(connectionId) {
        const response = await axios.get(`${API_BASE}/timeline/${connectionId}`);
        return response.data;
    },

    /**
     * Get a state snapshot for a specific timestamp
     */
    async getSnapshot(connectionId, timestamp) {
        const response = await axios.get(`${API_BASE}/snapshot/${connectionId}`, {
            params: { timestamp }
        });
        return response.data;
    },

    /**
     * Get pre-generated keyframes for smooth playback
     */
    async getPlaybackKeyframes(connectionId, steps = 50) {
        const response = await axios.get(`${API_BASE}/playback/${connectionId}`, {
            params: { steps }
        });
        return response.data;
    }
};

export default evolutionService;
