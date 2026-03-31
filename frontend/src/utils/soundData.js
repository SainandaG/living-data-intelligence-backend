// Sound system — uses Web Audio API for procedural sounds
// No placeholder files needed

export const SOUND_DATA = {
    // Generated via Web Audio API at runtime — these keys are used as identifiers
    click: null,
    pulse: null,
    confirm: null,
    ambient: null
};

// Procedural sound generator using Web Audio API
export function playSound(type, { volume = 0.3, duration = 0.1 } = {}) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const freqMap = { click: 800, pulse: 440, confirm: 1000, ambient: 220 };
        osc.frequency.value = freqMap[type] || 440;
        osc.type = type === 'ambient' ? 'sine' : 'square';

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        // Audio not supported — silently skip
    }
}
