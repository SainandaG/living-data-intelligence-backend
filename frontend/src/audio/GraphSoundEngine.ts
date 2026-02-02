// frontend/src/audio/GraphSoundEngine.ts

import { FEATURE_FLAGS } from '../config/features';

// Optional import logic for legacy system would be handled by build system or just assumed
// For now we mock the interface of the legacy system to avoid build errors if missing during this phase
class LegacySoundSystem {
    play(sound: string) { console.log("Legacy play:", sound); }
}

export class GraphSoundEngine {
    private legacySystem: any;
    private audioContext: AudioContext | null = null;

    constructor() {
        // In a real app, importing the actua file is better, but consistent with non-disruptive
        // we assume it is globally available or imported if needed.
        this.legacySystem = new LegacySoundSystem();

        if (FEATURE_FLAGS.ENABLE_ADVANCED_AUDIO) {
            try {
                // @ts-ignore - AudioContext window handling
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContextClass();
            } catch (e) {
                console.warn('Advanced audio failed, using legacy system');
                this.audioContext = null;
            }
        }
    }

    generateSoundFromPath(path: any[]) {
        // Try advanced frequency generation
        if (FEATURE_FLAGS.ENABLE_ADVANCED_AUDIO && this.audioContext) {
            try {
                return this.generateAdvancedSound(path);
            } catch (e) {
                console.warn('Advanced sound failed, using legacy');
            }
        }

        // Fallback to existing pre-defined samples
        // return this.legacySystem.play('path_traversal');
        console.log("Fallback to legacy sound: path_traversal");
    }

    private generateAdvancedSound(path: any[]) {
        if (!this.audioContext) return;

        // f = f₀ + Σw_i
        // Simple generative logic
        const baseFrequency = 440;
        const frequency = baseFrequency + (path.length * 50); // Simpler heuristic for now

        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }
}
