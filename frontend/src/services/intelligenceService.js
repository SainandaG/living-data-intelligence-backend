
const API_BASE_URL = 'http://localhost:8001/api'; // Ensure this matches your backend port

export const intelligenceService = {
    getLatentProjection: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/intelligence/latent/projection`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching latent projection:', error);
            return null;
        }
    },

    findSimilar: async (nodeId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/intelligence/latent/similar/${nodeId}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching similar nodes:', error);
            return null;
        }
    }
};
