import apiClient from '../utils/apiClient';
import { logger } from '../utils/logger';

const BASE = '/intelligence';

export const intelligenceService = {
    // System Health
    getHealth: async (connectionId) => {
        try { return await apiClient.get(`${BASE}/health/${connectionId}`); }
        catch (e) { logger.error('getHealth failed:', e); return null; }
    },
    getHealthHistory: async (connectionId) => {
        try { return await apiClient.get(`${BASE}/health/history/${connectionId}`); }
        catch (e) { logger.error('getHealthHistory failed:', e); return null; }
    },

    // Deep Diagnostics
    getDeepStatus: async (connectionId, tableName) => {
        try { return await apiClient.get(`${BASE}/deep-status/${connectionId}/${tableName}`); }
        catch (e) { logger.error('getDeepStatus failed:', e); return null; }
    },

    // Behavior Patterns
    getPatterns: async (connectionId, tableName) => {
        try { return await apiClient.get(`${BASE}/patterns/${connectionId}/${tableName}`); }
        catch (e) { logger.error('getPatterns failed:', e); return null; }
    },

    // Risk Detection
    getAnomalies: async (connectionId) => {
        try { return await apiClient.get(`${BASE}/anomalies/${connectionId}`); }
        catch (e) { logger.error('getAnomalies failed:', e); return null; }
    },

    // Future Forecast
    getPredictions: async (connectionId, tableName) => {
        try { return await apiClient.get(`${BASE}/predictions/${connectionId}/${tableName}`); }
        catch (e) { logger.error('getPredictions failed:', e); return null; }
    },

    // Impact Analysis
    getRootCause: async (connectionId, tableName) => {
        try { return await apiClient.get(`${BASE}/root-cause/${connectionId}/${tableName}`); }
        catch (e) { logger.error('getRootCause failed:', e); return null; }
    },

    // Action Plans
    getRecommendations: async (connectionId, tableName) => {
        const url = tableName
            ? `${BASE}/recommendations/${connectionId}/${tableName}`
            : `${BASE}/recommendations/${connectionId}`;
        try { return await apiClient.get(url); }
        catch (e) { logger.error('getRecommendations failed:', e); return null; }
    },

    // Discovery Search
    semanticSearch: async (connectionId, query = '', categories = [], priority = null) => {
        try {
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            if (categories.length > 0) params.append('categories', categories.join(','));
            if (priority) params.append('priority', priority);
            return await apiClient.get(`${BASE}/semantic-search/${connectionId}?${params.toString()}`);
        } catch (e) { logger.error('semanticSearch failed:', e); return null; }
    },

    // Latent Space
    getLatentProjection: async () => {
        try { return await apiClient.get(`${BASE}/latent/projection`); }
        catch (e) { logger.error('getLatentProjection failed:', e); return null; }
    },
    findSimilar: async (nodeId, k = 5) => {
        try { return await apiClient.get(`${BASE}/latent/similar/${nodeId}?k=${k}`); }
        catch (e) { logger.error('findSimilar failed:', e); return null; }
    },
};
