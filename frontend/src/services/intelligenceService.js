import apiClient from '../utils/apiClient';

const API_BASE_URL = '/intelligence'; // apiClient handles /api prefix

export const intelligenceService = {
    getLatentProjection: async () => {
        try {
            return await apiClient.get(`${API_BASE_URL}/latent/projection`);
        } catch (error) {
            console.error('Error fetching latent projection:', error);
            return null;
        }
    },

    findSimilar: async (nodeId) => {
        try {
            return await apiClient.get(`${API_BASE_URL}/latent/similar/${nodeId}`);
        } catch (error) {
            console.error('Error fetching similar nodes:', error);
            return null;
        }
    }
};
