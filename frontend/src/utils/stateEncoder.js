// Utility functions for serializing and deserializing application state into/from URLs

/**
 * Compresses the current view state into a Base64 string.
 * @param {Object} state - The current view state (e.g., selectedNodeId, cameraPos, currentLens).
 * @returns {string} - The Base64 encoded state string.
 */
export const encodeViewState = (state) => {
    try {
        const jsonString = JSON.stringify(state);
        // Use btoa for Base64 encoding. Note: unescape/encodeURIComponent handles Unicode characters properly if needed.
        return btoa(unescape(encodeURIComponent(jsonString)));
    } catch (error) {
        console.error("Failed to encode view state:", error);
        return null;
    }
};

/**
 * Decompresses a Base64 string back into the view state object.
 * Safely wraps in a try/catch so corrupted URLs fail gracefully.
 * @param {string} encodedString - The Base64 string from the URL query parameter.
 * @returns {Object|null} - The parsed state object, or null if invalid.
 */
export const decodeViewState = (encodedString) => {
    if (!encodedString) return null;

    try {
        const jsonString = decodeURIComponent(escape(atob(encodedString)));
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn("Invalid or corrupted deep link detected. Falling back to default dashboard state.", error);
        return null;
    }
};
