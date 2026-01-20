/**
 * Sound System - Centralized audio manager for the application
 */

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.3;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            console.log('[SoundSystem] Audio Context Initialized');
        } catch (e) {
            console.error('[SoundSystem] Audio Not Supported');
        }
    }

    play(soundName) {
        if (!this.enabled || !this.ctx) {
            // Try enabling if not enabled yet (user interaction requirement)
            if (this.enabled && !this.ctx) this.init();
            if (!this.ctx) return;
        }

        // Resume context if suspended (common browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Sound Synthesis Profiles
        switch (soundName) {
            case 'nodeClick':
                // High-tech blip: High pitch short burst
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(400, t + 0.1);
                gain.gain.setValueAtTime(0.3 * this.volume, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;

            case 'scanPulse':
                // Soft radar ping
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, t);
                gain.gain.setValueAtTime(0.1 * this.volume, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
                osc.start(t);
                osc.stop(t + 0.3);
                break;

            case 'formationAmbient':
                // Deep drone for simulation
                handleAmbient(this.ctx, this.volume);
                break;

            case 'voiceConfirm':
                // Success chime
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, t);
                osc.frequency.linearRampToValueAtTime(800, t + 0.1);
                gain.gain.setValueAtTime(0.2 * this.volume, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.3);
                osc.start(t);
                osc.stop(t + 0.3);
                break;
        }
    }

    /**
     * Map neural metrics to audio oscillation (Sonification)
     * Gravity -> Frequency (Pitch)
     * Entropy -> LFO Modulation (Static/Distortion)
     */
    playMetricOscillation(gravity = 1.0, entropy = 0.5) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();

        // Map Gravity (1-5) to frequency (200Hz - 800Hz)
        const freq = 200 + (gravity * 120);
        osc.frequency.setValueAtTime(freq, t);
        osc.type = 'sine';

        // Map Entropy (0-1) to modulation speed and intensity
        lfo.frequency.value = 5 + (entropy * 50);
        lfoGain.gain.value = 10 + (entropy * 40);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15 * this.volume, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        osc.start(t);
        lfo.start(t);
        osc.stop(t + 0.5);
        setTimeout(() => lfo.stop(), 500);
    }

    stop(soundName) {
        if (soundName === 'formationAmbient') {
            // Stop logic handles by the ambient function closure if we stored it, 
            // but for simple MVP we'll just kill the specific global ambient node if we assign it.
            if (window._currentAmbient) {
                try {
                    window._currentAmbient.stop();
                    window._currentAmbient = null;
                } catch (e) { }
            }
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Helper for ambient drone
function handleAmbient(ctx, vol) {
    if (window._currentAmbient) return; // Already playing

    // Low frequency drone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, ctx.currentTime); // 60Hz hum

    // LFO for modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2; // Slow pulse
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 50;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3 * vol, ctx.currentTime + 2); // Fade in

    osc.start();
    lfo.start();

    // Store to stop later - hacked onto window for simple singleton behavior
    window._currentAmbient = {
        stop: () => {
            const t = ctx.currentTime;
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(0, t + 1); // Fade out
            setTimeout(() => {
                osc.stop();
                lfo.stop();
            }, 1000);
        }
    };
}

// Global instance
export const soundSystem = new SoundSystem();

// Auto-initialize on first user interaction
if (typeof window !== 'undefined') {
    const initOnInteraction = () => {
        soundSystem.init();
        document.removeEventListener('click', initOnInteraction);
        document.removeEventListener('keydown', initOnInteraction);
    };
    document.addEventListener('click', initOnInteraction);
    document.addEventListener('keydown', initOnInteraction);
}

export default soundSystem;
