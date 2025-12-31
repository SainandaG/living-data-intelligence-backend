/**
 * IntelligenceClient - Frontend service for interacting with the Neural Core.
 * Handles interaction signals, action polling, and feedback.
 */
class IntelligenceClient {
    constructor(connectionId) {
        this.connectionId = connectionId;
        this.pollingInterval = null;
        this.lastActionId = null;
    }

    /**
     * Send an interaction signal to the Neural Core
     * @param {string} signalType - The type of signal (node_click, drill_down, etc.)
     * @param {Object} params - Signal metadata
     */
    async sendSignal(signalType, params = {}) {
        if (!this.connectionId) return;

        try {
            const response = await fetch('/api/intelligence/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection_id: this.connectionId,
                    signal_type: signalType,
                    params: params,
                    timestamp: new Date().toISOString()
                })
            });
            return await response.json();
        } catch (error) {
            console.error('❌ IntelligenceClient: Failed to send signal:', error);
        }
    }

    /**
     * Poll for Neural Core actions
     * @param {Function} onAction - Callback for new actions
     * @param {number} intervalMs - Polling interval in ms
     */
    startPolling(onAction, intervalMs = 5000) {
        if (this.pollingInterval) return;

        this.pollingInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/intelligence/action/${this.connectionId}`);
                const action = await response.json();

                if (action && action.id && action.id !== this.lastActionId) {
                    this.lastActionId = action.id;
                    onAction(action);
                }
            } catch (error) {
                console.error('❌ IntelligenceClient: Polling error:', error);
            }
        }, intervalMs);

        console.log('🧠 IntelligenceClient: Started action polling');
    }

    /**
     * Stop action polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('🛑 IntelligenceClient: Stopped action polling');
        }
    }

    /**
     * Send feedback for a Neural Core action
     * @param {string} actionId - The ID of the action
     * @param {Object} feedback - Detailed feedback object (user_clicked, marked_as_helpful, etc.)
     */
    async sendFeedback(actionId, feedback = {}) {
        if (!this.connectionId || !actionId) return;

        try {
            const response = await fetch('/api/intelligence/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection_id: this.connectionId,
                    action_id: actionId,
                    ...feedback,
                    timestamp: new Date().toISOString()
                })
            });
            return await response.json();
        } catch (error) {
            console.error('❌ IntelligenceClient: Failed to send feedback:', error);
        }
    }

    /**
     * Fetch learning metrics
     */
    async getMetrics() {
        try {
            const response = await fetch(`/api/intelligence/metrics/${this.connectionId}`);
            return await response.json();
        } catch (error) {
            console.error('❌ IntelligenceClient: Failed to fetch metrics:', error);
        }
    }
}

export default IntelligenceClient;
