/**
 * SoundSystem - Centralized audio manager for the application.
 * All ambient state is stored as instance properties (no window globals).
 */

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.3;
        this._currentAmbient = null; // Ambient drone state (was window._currentAmbient)
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
                this._startAmbient();
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

        // Map Gravity (1.0 - 5.0) to frequency (150Hz - 600Hz) - More bassy/premium
        const freq = 150 + (gravity * 100);
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.4); // Subtle pitch drop
        osc.type = 'sine';

        // LFO for "Shimmer/Pulse" effect
        lfo.frequency.value = 2 + (entropy * 20); // Pulse rate
        lfoGain.gain.value = freq * 0.1 * entropy; // Modulation depth

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Sharper "Pulse" Envelope
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2 * this.volume, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        osc.start(t);
        lfo.start(t);
        osc.stop(t + 0.6);
        setTimeout(() => {
            try { lfo.stop(); } catch (e) { /* ignore */ }
        }, 600);
    }

    stop(soundName) {
        if (soundName === 'formationAmbient') {
            if (this._currentAmbient) {
                try {
                    this._currentAmbient.stop();
                    this._currentAmbient = null;
                } catch (e) { /* ignore */ }
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

    // Ambient drone - instance method instead of standalone function
    _startAmbient() {
        if (this._currentAmbient) return; // Already playing

        const ctx = this.ctx;
        const vol = this.volume;

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

        // Store stop closure on instance
        this._currentAmbient = {
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
