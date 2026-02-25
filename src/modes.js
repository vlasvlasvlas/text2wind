/* ======================================
   TEXT2WIND — Mode Detector
   ======================================
   Detects user behavior and smoothly
   transitions between modes:
   Writer / Contemplator / Storm
   ====================================== */

import { CONFIG } from './config.js';
import { clamp, lerp } from './utils/math.js';

export class ModeDetector {
    constructor() {
        this.mode = 'contemplator'; // 'writer' | 'contemplator' | 'storm'
        this.keyTimestamps = [];
        this.idleTime = 0;
        this.wpm = 0;
        this.blend = { writer: 0, contemplator: 1, storm: 0 };
        this.suspensionTimer = 0;
    }

    init(state) { }

    onKey(e) {
        if (e.key.length === 1) {
            this.keyTimestamps.push(Date.now());
            this.idleTime = 0;

            // Keep only last 30 seconds
            const cutoff = Date.now() - 30000;
            this.keyTimestamps = this.keyTimestamps.filter(t => t > cutoff);
        }
    }

    triggerSuspension(duration) {
        this.suspensionTimer = duration;
    }

    getMode() { return this.mode; }
    getBlend() { return this.blend; }
    isSuspended() { return this.suspensionTimer > 0; }

    update(dt, state) {
        this.idleTime += dt;

        // Suspension
        if (this.suspensionTimer > 0) {
            this.suspensionTimer -= dt;
            return;
        }

        // Calculate WPM (words per minute from last 15 seconds)
        const recent = Date.now() - 15000;
        const recentKeys = this.keyTimestamps.filter(t => t > recent).length;
        this.wpm = (recentKeys / 5) * 4; // chars→words×4 to scale to per-minute

        // Determine mode
        const thresholds = CONFIG.MODES;

        if (this.wpm >= thresholds.STORM_WPM_THRESHOLD) {
            this.mode = 'storm';
        } else if (this.wpm >= thresholds.WRITER_WPM_THRESHOLD) {
            this.mode = 'writer';
        } else if (this.idleTime > thresholds.CONTEMPLATOR_IDLE) {
            this.mode = 'contemplator';
        }

        // Smooth blend toward target
        const targetBlend = { writer: 0, contemplator: 0, storm: 0 };
        targetBlend[this.mode] = 1;

        for (const key in this.blend) {
            this.blend[key] = lerp(this.blend[key], targetBlend[key], 0.002 * dt);
        }
    }
}
