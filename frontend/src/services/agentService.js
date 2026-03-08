import apiClient from '../utils/apiClient';

const API_BASE = '/agent'; // apiClient handles /api prefix

export const agentService = {
    /**
     * Process voice command text and classify intent (T0)
     * @param {string} text - The transcribed voice command
     * @param {Object} uiContext - Current UI context (view, table, etc.)
     * @param {Array<string>} context - Recent command context
     * @returns {Promise<Object>} - Classification result
     */
    async processIntent(text, uiContext = {}, context = []) {
        try {
            return await apiClient.post(`${API_BASE}/intent`, {
                text,
                ui_context: uiContext,
                context
            });
        } catch (error) {
            console.error('AgentService.processIntent error:', error);
            throw error;
        }
    },

    /**
     * Execute a platform action based on classified intent (T1)
     * @param {string} commandId - The ID of the classified command
     * @param {string} action - Action string (e.g., 'graph.highlight')
     * @param {Object} parameters - Action parameters
     * @returns {Promise<Object>} - Execution result
     */
    async executeAction(commandId, action, parameters = {}) {
        try {
            return await apiClient.post(`${API_BASE}/execute`, {
                command_id: commandId,
                action,
                parameters
            });
        } catch (error) {
            console.error('AgentService.executeAction error:', error);
            throw error;
        }
    },

    /**
     * Get current state of T0 and T1 agents
     * @returns {Promise<Object>} - Current state
     */
    async getAgentState() {
        try {
            return await apiClient.get(`${API_BASE}/state`);
        } catch (error) {
            console.error('AgentService.getAgentState error:', error);
            throw error;
        }
    },

    /**
     * Get recent command logs
     * @param {number} limit - Number of logs to retrieve
     * @returns {Promise<Object>} - Command history
     */
    async getCommandLogs(limit = 10) {
        try {
            return await apiClient.get(`${API_BASE}/logs?limit=${limit}`);
        } catch (error) {
            console.error('AgentService.getCommandLogs error:', error);
            throw error;
        }
    },

    /**
     * Get all available voice commands
     * @returns {Promise<Object>} - Commands registry
     */
    async getAvailableCommands() {
        try {
            return await apiClient.get(`${API_BASE}/commands`);
        } catch (error) {
            console.error('AgentService.getAvailableCommands error:', error);
            throw error;
        }
    },

    /**
     * Reset agents to IDLE state
     * @returns {Promise<Object>} - Reset result
     */
    async resetAgents() {
        try {
            return await apiClient.post(`${API_BASE}/reset`);
        } catch (error) {
            console.error('AgentService.resetAgents error:', error);
            throw error;
        }
    }
};
