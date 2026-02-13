
import axios from 'axios';

// Create Axios Instance
const apiClient = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor (Logger)
apiClient.interceptors.request.use(
    (config) => {
        // You can add auth tokens here if needed
        // const token = localStorage.getItem('token');
        // if (token) config.headers.Authorization = `Bearer ${token}`;

        console.debug(`[API] ↗️ ${config.method?.toUpperCase()} ${config.url}`, config.params || '');
        return config;
    },
    (error) => {
        console.error('[API] Request Error:', error);
        return Promise.reject(error);
    }
);

// Response Interceptor (Global Error Handling)
apiClient.interceptors.response.use(
    (response) => {
        // console.debug(`[API] ↙️ ${response.status} ${response.config.url}`);
        return response.data; // Return data directly to simplify calls
    },
    (error) => {
        if (error.response) {
            // Server responded with a status code outside 2xx range
            console.error(`[API] ❌ Error ${error.response.status}:`, error.response.data);
            if (error.response.status === 401) {
                // Handle Unauthorized
                console.warn('[API] Unauthorized. Redirecting to login...');
            }
        } else if (error.request) {
            // Request made but no response received
            console.error('[API] ❌ No Response:', error.request);
        } else {
            // Something happened in setting up the request
            console.error('[API] ❌ Config Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default apiClient;
