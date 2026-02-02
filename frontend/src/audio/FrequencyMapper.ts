// frontend/src/audio/FrequencyMapper.ts

export class FrequencyMapper {
    static mapNodeToFrequency(node: any): number {
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

    static mapEdgeToInterval(edge: any): number {
        // Map edge weight to musical interval ratio
        return 1.5; // Perfect fifth as placeholder
    }
}
