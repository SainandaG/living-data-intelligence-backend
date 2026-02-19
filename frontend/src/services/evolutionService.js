/**
 * Evolution Service API Client
 * Handles communication with the Temporal Genesis endpoints.
 */
import apiClient from '../utils/apiClient';

const API_URL = '/evolution';

const evolutionService = {
    /**
     * Analyze the database evolution for a connection
     */
    async analyzeEvolution(connectionId) {
        const response = await apiClient.get(`${API_URL}/analyze/${connectionId}`);
        return response;
    },

    /**
     * Get the full timeline for a connection
     */
    async getTimeline(connectionId) {
        const response = await apiClient.get(`${API_URL}/timeline/${connectionId}`);
        return response;
    },

    /**
     * Get a state snapshot for a specific timestamp
     */
    async getSnapshot(connectionId, timestamp) {
        const response = await apiClient.get(`${API_URL}/snapshot/${connectionId}`, {
            params: { timestamp }
        });
        return response;
    },

    /**
     * Get pre-generated keyframes for smooth playback
     */
    async getPlaybackKeyframes(connectionId, steps = 50) {
        const response = await apiClient.get(`${API_URL}/playback/${connectionId}`, {
            params: { steps }
        });
        return response;
    }
};

export default evolutionService;
