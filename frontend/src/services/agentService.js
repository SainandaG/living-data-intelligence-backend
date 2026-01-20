/**
 * Agent Service
 * Handles API communication with the backend T0/T1 agent system.
 */

const API_BASE = '/api/agent';

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
            const response = await fetch(`${API_BASE}/intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, ui_context: uiContext, context })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to process intent');
            }

            return await response.json();
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
            const response = await fetch(`${API_BASE}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command_id: commandId, action, parameters })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to execute action');
            }

            return await response.json();
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
            const response = await fetch(`${API_BASE}/state`);
            if (!response.ok) throw new Error('Failed to fetch agent state');
            return await response.json();
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
            const response = await fetch(`${API_BASE}/logs?limit=${limit}`);
            if (!response.ok) throw new Error('Failed to fetch command logs');
            return await response.json();
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
            const response = await fetch(`${API_BASE}/commands`);
            if (!response.ok) throw new Error('Failed to fetch available commands');
            return await response.json();
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
            const response = await fetch(`${API_BASE}/reset`, { method: 'POST' });
            if (!response.ok) throw new Error('Failed to reset agents');
            return await response.json();
        } catch (error) {
            console.error('AgentService.resetAgents error:', error);
            throw error;
        }
    }
};
