/** Minimal graph node shape needed for frequency mapping */
interface GraphNode {
  degree?: number;
  centrality?: number;
  importance_score?: number;
  [key: string]: unknown;
}

/** Minimal graph edge shape needed for interval mapping */
interface GraphEdge {
  weight?: number;
  trafficIntensity?: number;
  [key: string]: unknown;
}

// frontend/src/audio/FrequencyMapper.ts

export class FrequencyMapper {
    static mapNodeToFrequency(node: GraphNode): number {
        // Example: Map node centrality or degree to pitch
        // Higher degree = Higher pitch
        const degree = node.degree || 1;

        // Base 220Hz (A3), max 880Hz (A5)
        const minFreq = 220;
        const maxFreq = 880;

        // Logarithmic mapping often sounds better
        const freq = minFreq + (Math.log2(degree) * 100);

        return Math.min(freq, maxFreq);
    }

    static mapEdgeToInterval(edge: GraphEdge): number {
        // Map edge weight to musical interval ratio
        return 1.5; // Perfect fifth as placeholder
    }
}
