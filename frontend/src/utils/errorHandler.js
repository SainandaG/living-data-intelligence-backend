/**
 * Centralized Error Handler Utility
 * 
 * Provides consistent error handling across the application with:
 * - Standardized error messages
 * - Severity levels
 * - Console logging
 * - Pluggable external error reporter (Sentry, LogRocket, etc.)
 */

/**
 * Pluggable error reporter — call setErrorReporter() at app init to wire up
 * an external service. Example: setErrorReporter((err, log) => Sentry.captureException(err, { extra: log }))
 */
let _errorReporter = null;
export const setErrorReporter = (reporterFn) => { _errorReporter = reporterFn; };

/**
 * Handle API errors with consistent formatting
 * 
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred (e.g., 'LatentWorld', 'ThreeGraph')
 * @returns {Object} Formatted error object with message and severity
 */
export const handleApiError = (error, context) => {
    // Extract meaningful error message
    let message = 'An unexpected error occurred';
    let severity = 'error';

    if (error.response) {
        // HTTP error response
        const status = error.response.status;
        message = error.response.data?.message || error.response.statusText || `HTTP ${status} error`;

        // Determine severity based on status code
        if (status >= 500) {
            severity = 'error'; // Server error
        } else if (status >= 400) {
            severity = 'warning'; // Client error
        }
    } else if (error.request) {
        // Network error (no response received)
        message = 'Network error - please check your connection';
        severity = 'error';
    } else if (error.message) {
        // JavaScript error
        message = error.message;
        severity = 'warning';
    }

    // Log to console with context
    console.error(`[${context}] Error:`, {
        message,
        severity,
        originalError: error
    });

    return {
        message,
        severity,
        context,
        timestamp: new Date().toISOString()
    };
};

/**
 * Handle fetch errors specifically
 * 
 * @param {Response} response - Fetch response object
 * @param {string} context - Context where error occurred
 * @returns {Object} Formatted error object
 */
export const handleFetchError = async (response, context) => {
    let message = `HTTP ${response.status}: ${response.statusText}`;

    // Try to extract error message from response body
    try {
        const data = await response.json();
        if (data.message || data.error || data.detail) {
            message = data.message || data.error || data.detail;
        }
    } catch (e) {
        // Response is not JSON, use status text
    }

    const severity = response.status >= 500 ? 'error' : 'warning';

    console.error(`[${context}] Fetch Error:`, {
        status: response.status,
        message,
        severity
    });

    return {
        message,
        severity,
        context,
        status: response.status,
        timestamp: new Date().toISOString()
    };
};

/**
 * Create user-friendly error messages
 * 
 * @param {string} technicalMessage - Technical error message
 * @returns {string} User-friendly message
 */
export const getUserFriendlyMessage = (technicalMessage) => {
    const friendlyMessages = {
        'Network error': 'Unable to connect to the server. Please check your internet connection.',
        'HTTP 404': 'The requested resource was not found.',
        'HTTP 500': 'Server error. Please try again later.',
        'HTTP 503': 'Service temporarily unavailable. Please try again in a few moments.',
        'Timeout': 'Request timed out. Please try again.',
        'Unauthorized': 'You are not authorized to perform this action.',
        'Forbidden': 'Access to this resource is forbidden.'
    };

    // Check if technical message contains any known patterns
    for (const [pattern, friendly] of Object.entries(friendlyMessages)) {
        if (technicalMessage.includes(pattern)) {
            return friendly;
        }
    }

    // Default fallback
    return 'An error occurred. Please try again or contact support if the problem persists.';
};

/**
 * Log error for debugging (can be extended to send to error tracking service)
 * 
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @param {Object} metadata - Additional metadata
 */
export const logError = (error, context, metadata = {}) => {
    const errorLog = {
        timestamp: new Date().toISOString(),
        context,
        message: error.message,
        stack: error.stack,
        metadata,
        userAgent: navigator.userAgent,
        url: window.location.href
    };

    console.error('[Error Log]', errorLog);

    // Forward to external error tracker if configured via setErrorReporter()
    if (_errorReporter) {
        try { _errorReporter(error, errorLog); } catch (_) { /* silent */ }
    }
};

/**
 * Retry a failed async operation
 * 
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} delay - Delay between retries in ms (default: 1000)
 * @returns {Promise} Result of the function
 */
export const retryOperation = async (fn, maxRetries = 3, delay = 1000) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }

    // All retries failed
    throw lastError;
};

/**
 * Example usage:
 * 
 * import { handleApiError, retryOperation } from '@/utils/errorHandler';
 * 
 * try {
 *   const data = await retryOperation(async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 *   });
 * } catch (err) {
 *   const { message, severity } = handleApiError(err, 'MyComponent');
 *   setError(message);
 * }
 */
