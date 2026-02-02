// frontend/src/audio/RhythmGenerator.ts

export class RhythmGenerator {
    static generateRhythmPattern(clusterSize: number): number[] {
        // Generate a sequence of time delays (in seconds)
        // Larger clusters might have denser rhythms

        const pattern: number[] = [];
        const baseBeat = 0.5; // 120 BPM

        for (let i = 0; i < Math.min(clusterSize, 4); i++) {
            pattern.push(baseBeat / (i + 1));
        }

        return pattern;
    }
}
