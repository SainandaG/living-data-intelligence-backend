import { mapRange } from './mathUtils';

export class ProceduralSoundGenerator {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private enabled: boolean = true;

    constructor() {
        if (typeof window !== 'undefined') {
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
                this.masterGain = this.ctx!.createGain();
                this.masterGain.connect(this.ctx!.destination);
                this.masterGain.gain.value = 0.3;
            }
        }
    }

    public init() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Procedural Pulse: Generates a high-tech rhythmic blip
     * Drives rhythmic data discovery.
     */
    public playPulse(frequency: number = 440, duration: number = 0.1, decay: number = 0.05) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, t);
        osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, t + duration);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + duration);
    }

    /**
     * Sonify Metric: Maps data metrics to sound timbre
     * Section: "Advanced UI - Sound Design"
     */
    public sonifyMetric(value: number, type: 'entropy' | 'gravity' | 'load') {
        if (!this.ctx || !this.enabled) return;
        this.init();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Complex FM Synthesis placeholder for high-end procedural audio
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();

        if (type === 'entropy') {
            osc.frequency.value = mapRange(value, 0, 1, 200, 800);
            modulator.frequency.value = mapRange(value, 0, 1, 10, 50);
            modGain.gain.value = 50;
        } else if (type === 'gravity') {
            osc.frequency.value = mapRange(value, 0, 10, 100, 400);
            osc.type = 'triangle';
        }

        modulator.connect(modGain);
        modGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(this.masterGain!);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);

        osc.start(t);
        modulator.start(t);
        osc.stop(t + 0.5);
        modulator.stop(t + 0.5);
    }
}

export const proceduralSound = new ProceduralSoundGenerator();
