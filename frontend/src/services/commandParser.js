/**
 * Local Command Parser for Voice Control
 * Intercepts specific navigation commands to bypass the backend AI agent
 * for faster, more deterministic UI responses.
 */

// Helper: Calculate Levenshtein Distance for fuzzy matching
const getLevenshteinDistance = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

// Helper: Fuzzy find node name from available names
const findBestNodeMatch = (spokenName, availableNodes = []) => {
    if (!spokenName || availableNodes.length === 0) return null;
    
    // Normalize spoken name
    let searchName = spokenName.toLowerCase().trim();
    // Common speech-to-text corrections for this domain
    searchName = searchName.replace(/^the /, '');
    
    // First, try exact or simple substring match
    let exactMatch = availableNodes.find(n => 
        (n.name && n.name.toLowerCase() === searchName) ||
        (n.id && n.id.toLowerCase() === searchName) ||
        (n.name && n.name.toLowerCase().includes(searchName)) ||
        (n.id && n.id.toLowerCase().includes(searchName))
    );
    
    if (exactMatch) return exactMatch.name || exactMatch.id;

    // Second, try fuzzy matching (Levenshtein distance <= 2)
    let bestMatch = null;
    let lowestDistance = Infinity;

    for (const node of availableNodes) {
        const nameNode = node.name?.toLowerCase() || '';
        const idNode = node.id?.toLowerCase() || '';
        
        const distName = getLevenshteinDistance(searchName, nameNode);
        const distId = getLevenshteinDistance(searchName, idNode);
        
        const minLocalDist = Math.min(distName, distId);
        
        if (minLocalDist < lowestDistance && minLocalDist <= 2) {
            lowestDistance = minLocalDist;
            bestMatch = node.name || node.id;
        }
    }

    return bestMatch; // Returns null if no match found within distance 2
};

/**
 * Parses a transcript for explicit local commands.
 * @param {string} transcript - The spoken text.
 * @param {Array} uiNodes - Optional array of currently available nodes for fuzzy matching.
 * @returns {Object|null} - The parsed command object or null if it should fallback to backend.
 */
export const parseLocalCommand = (transcript, uiNodes = []) => {
    if (!transcript) return null;
    
    let text = transcript.toLowerCase().trim();
    
    // Remove punctuation
    text = text.replace(/[.,!?]/g, '');

    // 1. CAMERA RESET
    if (
        text === 'reset view' || 
        text === 'reset camera' || 
        text === 'view reset' ||
        text === 'reset the view' ||
        text === 'reset the camera' ||
        text === 'reset'
    ) {
        return {
            type: 'LOCAL_MATCH',
            intent: 'CAMERA_RESET',
            message: 'Resetting view',
            action: 'graph_camera',
            parameters: { instruction: 'reset' }
        };
    }

    // 2. CAMERA ZOOM
    if (text === 'zoom in' || text === 'zoom closer') {
        return {
            type: 'LOCAL_MATCH',
            intent: 'CAMERA_ZOOM_IN',
            message: 'Zooming in',
            action: 'graph_zoom',
            parameters: { target: null, instruction: 'zoom_in', factor: 0.8 } // Custom payload for zoom in
        };
    }
    
    if (text === 'zoom out' || text === 'zoom further') {
        return {
            type: 'LOCAL_MATCH',
            intent: 'CAMERA_ZOOM_OUT',
            message: 'Zooming out',
            action: 'graph_zoom',
            parameters: { target: null, instruction: 'zoom_out', factor: 1.25 } // Custom payload for zoom out
        };
    }

    // 3. SHOW / HIDE EDGES
    if (text === 'show connections' || text === 'show all connections' || text === 'show edges') {
        return {
            type: 'LOCAL_MATCH',
            intent: 'SHOW_ALL_EDGES',
            message: 'Showing connections',
            action: 'graph_edges',
            parameters: { instruction: 'show_all' }
        };
    }
    
    if (text === 'hide connections' || text === 'hide all connections' || text === 'hide edges') {
        return {
            type: 'LOCAL_MATCH',
            intent: 'HIDE_ALL_EDGES',
            message: 'Hiding connections',
            action: 'graph_edges',
            parameters: { instruction: 'hide_all' }
        };
    }

    // 4. SWITCH LENS / SHOW LENS
    const lensMatch = text.match(/show (ops|operations|security|executive|tier 3|tier three|3d tables|energy) lens/i) || 
                      text.match(/switch to (ops|operations|security|executive|tier 3|tier three|3d tables|energy) lens/i);
    if (lensMatch) {
        let lensRaw = lensMatch[1].toLowerCase();
        let lensMap = {
            'operations': 'ops',
            'tier three': 'tier3',
            'tier 3': 'tier3',
            '3d tables': 'tier3'
        };
        let finalLens = lensMap[lensRaw] || lensRaw;
        
        return {
            type: 'LOCAL_MATCH',
            intent: `SWITCH_LENS_${finalLens.toUpperCase()}`,
            message: `Switching to ${finalLens} lens`,
            action: 'graph_lens',
            parameters: { lens: finalLens }
        };
    }

    // 5. FOCUS ON [NODE]
    const focusMatch = text.match(/focus on (.+)/i) || 
                       text.match(/zoom into (.+)/i) || 
                       text.match(/zoom to (.+)/i) ||
                       text.match(/show me (.+)/i);
                       
    // Avoid false positive with "show me connections"
    if (focusMatch && !text.includes('connections') && !text.includes('lens')) {
        const spokenTarget = focusMatch[1];
        
        // Skip if they are likely asking a general question
        if (text.startsWith("show me how") || text.startsWith("show me why")) return null;

        const bestMatch = findBestNodeMatch(spokenTarget, uiNodes);
        
        if (bestMatch) {
            return {
                type: 'LOCAL_MATCH',
                intent: 'FOCUS_NODE',
                message: `Focusing on ${bestMatch}`,
                action: 'graph_zoom',
                parameters: { target: bestMatch, instruction: 'focus' }
            };
        } else {
            return {
                type: 'VOICE_NO_MATCH',
                message: `Could not find table or cluster: "${spokenTarget}"`
            };
        }
    }
    
    // 6. HIGHLIGHT [NODE]
    const highlightMatch = text.match(/highlight (.+)/i);
    if (highlightMatch) {
        const spokenTarget = highlightMatch[1];
        const bestMatch = findBestNodeMatch(spokenTarget, uiNodes);
        
        if (bestMatch) {
            return {
                type: 'LOCAL_MATCH',
                intent: 'HIGHLIGHT_NODE',
                message: `Highlighting ${bestMatch}`,
                action: 'graph_highlight',
                parameters: { target: bestMatch }
            };
        } else {
            return {
                type: 'VOICE_NO_MATCH',
                message: `Could not find table or cluster to highlight: "${spokenTarget}"`
            };
        }
    }

    // No local match, fallback to AI service
    return null;
};
