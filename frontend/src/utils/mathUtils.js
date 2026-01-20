/**
 * Mathematical Utilities for Deterministic "Living" UI
 * Eliminates static randomness in favor of data-driven chaos.
 */

// Simple Linear Congruential Generator (LCG)
// Ensures that for a given seed, the sequence of "random" numbers is always identical.
export class SeededRNG {
    constructor(seed) {
        // If seed is a string, hash it. If number, use directly.
        if (typeof seed === 'string') {
            this.seed = this._hashString(seed);
        } else {
            this.seed = seed || 123456;
        }
        this.modulus = 2147483647;
        this.multiplier = 1664525;
        this.increment = 1013904223;
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    }

    // Returns a float between 0 and 1
    next() {
        this.seed = (this.multiplier * this.seed + this.increment) % this.modulus;
        return (this.seed - 1) / this.modulus;
    }

    // Returns float between min and max
    range(min, max) {
        return min + this.next() * (max - min);
    }

    // Returns true/false based on probability (0-1)
    chance(probability) {
        return this.next() < probability;
    }
}

// Global deterministic hash helper
export const getHash = (str) => {
    let hash = 0;
    if (!str) return 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
};

// Maps a value from one range to another (Math.map equivalent)
export const mapRange = (value, inMin, inMax, outMin, outMax) => {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};
