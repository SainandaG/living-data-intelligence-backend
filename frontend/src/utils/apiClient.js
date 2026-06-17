import axios from 'axios';
import { logger } from '../utils/logger';

// --- CONFIGURATION ---
// Use empty string in dev so requests go through Vite's proxy (vite.config.js)
// which forwards /api/* to localhost:8001 — this avoids all CORS issues.
// In production, set VITE_API_URL to the actual backend URL.
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// --- STATE TRACKING ---
export let activeRequests = 0;
let asyncErrorHandler = null;
let isRefreshing = false;
let failedQueue = [];
const MAX_QUEUE_SIZE = 50; // prevent unbounded growth during slow refresh

export const registerAsyncErrorHandler = (handler) => {
    asyncErrorHandler = handler;
};

// --- HELPER FUNCTIONS ---
const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

const normalizeError = (error) => {
    let message = "Something went wrong, please try again";
    let code = "INTERNAL_ERROR";
    let status = error.response ? error.response.status : (error.code === 'ECONNABORTED' ? 0 : null);

    // Timeout Error
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return { message: "Request timed out", code: "TIMEOUT", status: 0 };
    }

    // Network / No Response
    if (!error.response && error.request) {
        return { message: "Could not connect to the server", code: "NETWORK_ERROR", status: 0 };
    }

    // Extract Backend Structured Error
    const backendData = error.response?.data || {};
    const backendCode = backendData?.code || backendData?.error_code || "UNKNOWN";
    const backendMessage = backendData?.error || backendData?.message || backendData?.detail;

    if (backendCode && backendCode !== "UNKNOWN") {
        code = backendCode;
        // Map common codes to friendly messages
        switch (backendCode) {
            case "DB_CONNECTION_FAILED":
                message = "Could not connect to the database";
                break;
            case "VALIDATION_ERROR":
                message = "Invalid request data";
                break;
            default:
                message = backendMessage || message;
        }
    } else if (backendMessage) {
        // Fallback to backend message if no code provided
        if (typeof backendMessage === 'string') {
            message = backendMessage;
        } else {
            // Handle validation arrays (e.g. FastAPI 422 standard)
            message = JSON.stringify(backendMessage);
        }
    }

    // Status overrides for unmapped backend errors
    if (!backendData || !backendData.code) {
        if (status === 503) {
            code = "SERVICE_UNAVAILABLE";
            message = "Service is temporarily unavailable";
        } else if (status === 401) {
            code = "UNAUTHORIZED";
            message = "Session expired. Please log in again.";
        } else if (status === 403) {
            code = "FORBIDDEN";
            message = "You do not have permission for this action.";
        } else if (status === 404) {
            code = "NOT_FOUND";
            message = "Resource not found.";
        }
    }

    return { message, code, status };
};

// --- AXIOS INSTANCE ---
const apiClient = axios.create({
    baseURL: `${BASE_URL}/api`,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- REQUEST INTERCEPTOR ---
apiClient.interceptors.request.use(
    (config) => {
        activeRequests++;

        // Centralized URL normalization to strip leading slashes
        // so that Axios correctly prepends baseURL ('/api')
        if (config.url && config.url.startsWith('/') && !config.url.startsWith('/api/') && !config.url.startsWith('http://') && !config.url.startsWith('https://')) {
            config.url = config.url.substring(1);
        }

        // Skip auth for /auth/* endpoints
        const isAuthRoute = config.url && (config.url.startsWith('/auth/') || config.url.startsWith('auth/'));

        if (!isAuthRoute) {
            const token = localStorage.getItem('token'); // Preserved existing token pattern
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }

        logger.debug(`[API] ↗️ ${config.method?.toUpperCase()} ${config.url}`, config.params || '');
        return config;
    },
    (error) => {
        activeRequests = Math.max(0, activeRequests - 1);
        logger.error('[API] Request Error:', error);
        return Promise.reject(error);
    }
);

// --- RESPONSE INTERCEPTOR ---
apiClient.interceptors.response.use(
    (response) => {
        activeRequests--;
        return response.data; // Return data directly
    },
    async (error) => {
        activeRequests = Math.max(0, activeRequests - 1);
        const originalRequest = error.config;
        const normalizedError = normalizeError(error);

        // Notify global error handler (excluding 401s handled by auth logic)
        if (asyncErrorHandler && normalizedError.status !== 401) {
            asyncErrorHandler(normalizedError);
        }

        // Global 401 interceptor
        if (normalizedError.status === 401) {
            const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register');
            if (!isAuthEndpoint) {
                logger.warn('[API] Session expired, clearing tokens');
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                
                try {
                    const { useRealtimeStore } = await import('../stores/realtimeStore');
                    useRealtimeStore.getState().showSimToast("Session expired — please sign in again", 5000);
                } catch (e) {
                    console.error("Failed to show session expiry toast", e);
                }

                if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                }
            }
        }

        logger.error(`[API] ❌ ${normalizedError.code} (${normalizedError.status || 'N/A'}): ${normalizedError.message}`);

        // --- 401 Token Refresh Logic ---
        if (normalizedError.status === 401 && !originalRequest._retry && !originalRequest.url?.startsWith('/auth/')) {
            if (isRefreshing) {
                // Wait for the active refresh to complete
                if (failedQueue.length >= MAX_QUEUE_SIZE) {
                    return Promise.reject({ message: 'Too many pending requests', code: 'QUEUE_FULL', status: 0 });
                }
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        // Use apiClient so the response interceptor runs and activeRequests is decremented
                        return apiClient(originalRequest);
                    })
                    .catch(err => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refresh_token');

            if (!refreshToken) {
                isRefreshing = false;
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                // Only redirect if we are not already at the login root to prevent infinite refresh loops
                if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                }
                return Promise.reject(normalizedError);
            }

            try {
                logger.warn('[API] Attempting token refresh...');
                // Note: Not using apiClient here to avoid circular interceptor dependencies
                const refreshResponse = await axios.post(`${BASE_URL}/api/auth/refresh`, {
                    refresh_token: refreshToken
                });

                const newToken = refreshResponse.data.access_token;
                localStorage.setItem('token', newToken);

                // If backend returns new refresh token, update it
                if (refreshResponse.data.refresh_token) {
                    localStorage.setItem('refresh_token', refreshResponse.data.refresh_token);
                }

                apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                processQueue(null, newToken);

                // Retry the original request (must use axios direct to get full response object for interceptor compat, but apiClient expects .data return)
                const retryResponse = await axios(originalRequest);
                return retryResponse.data;
            } catch (err) {
                logger.error('[API] Token refresh failed');
                processQueue(err, null);
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
                if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                }
                return Promise.reject(normalizedError);
            } finally {
                isRefreshing = false;
            }
        }

        // --- Automatic Retry Logic for Network Errors / 503 / Timeouts ---
        const isNetworkError = !error.response;
        const is503 = normalizedError.status === 503;
        const isTimeout = normalizedError.status === 0;

        if ((isNetworkError || is503 || isTimeout) && !originalRequest._retryCount) {
            originalRequest._retryCount = 0;
        }

        if ((isNetworkError || is503 || isTimeout) && originalRequest._retryCount < 2) {
            originalRequest._retryCount++;
            logger.warn(`[API] Retrying failed request (${originalRequest._retryCount}/2)...`);

            // Exponential backoff: 1s → 2s
            const backoffMs = 1000 * Math.pow(2, originalRequest._retryCount - 1);

            return new Promise(resolve => setTimeout(resolve, backoffMs)).then(() => {
                // Ensure auth header is current
                const token = localStorage.getItem('token');
                if (token && !originalRequest.url?.startsWith('/auth/')) {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                }

                // Use apiClient so the response interceptor runs (decrements activeRequests, returns .data)
                activeRequests++;
                return apiClient(originalRequest);
            });
        }

        return Promise.reject(normalizedError);
    }
);

// --- SNAPSHOT METHODS ---
export const getSnapshots = async (connectionId) => {
    // FIXED: Was '/snapshots/{cid}' which doesn't exist.
    // Backend serves evolution timeline at /api/evolution/timeline/{cid}
    const res = await apiClient.get(`/evolution/timeline/${connectionId}`);
    // The timeline response contains table evolution data — normalize to snapshot-like array
    if (res?.tables) {
        return res.tables.map(t => ({
            id: t.name,
            timestamp: t.estimated_creation || new Date().toISOString(),
            table_count: res.tables.length,
            summary: t,
        }));
    }
    return res.snapshots || res || [];
};

export const getSnapshot = async (connectionId, snapshotId) => {
    // FIXED: Was '/snapshot/{cid}/{snapshotId}' which doesn't exist.
    // Backend serves snapshots at /api/evolution/snapshot/{cid}?timestamp=...
    // snapshotId here is typically a timestamp or we use it as one
    const timestamp = snapshotId instanceof Date ? snapshotId.toISOString() : snapshotId;
    return apiClient.get(`/evolution/snapshot/${connectionId}`, { params: { timestamp } });
};

export default apiClient;

/**
 * Authenticated fetch() wrapper — drop-in replacement for raw fetch().
 * Automatically injects the JWT Bearer token from localStorage.
 * Use this anywhere you'd normally use fetch() for /api/ calls.
 *
 * Usage:
 *   import { authFetch } from '../utils/apiClient';
 *   const response = await authFetch(`/api/drilldown/${id}/table/${name}`);
 */
export function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...(options.headers || {}) };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    // Always send JSON content-type for POST/PUT/PATCH unless overridden
    // FIX: Do NOT set application/json if we are sending FormData (browser needs to set boundary)
    if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
}
