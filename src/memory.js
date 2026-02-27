/* ======================================
   TEXT2WIND — Memory / Palimpsest
   ======================================
   Records where letters lived and died.
   Creates invisible traces that can be
   revealed by cursor proximity or
   special words. Persistent aging via
   localStorage.
   ====================================== */

import { clamp } from './utils/math.js';
import { CONFIG } from './config.js';

const STORAGE_KEY = 'text2wind_memory';

export class Memory {
    constructor() {
        this.traces = [];      // { x, y, char, intensity, timestamp }
        this.revealTimer = 0;
        this.agingLevel = 0;   // 0-1, accumulated wear
        this.accelerateTimer = 0;
        this.loaded = false;
    }

    init(state) {
        this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                this.agingLevel = parsed.agingLevel || 0;
                this.traces = parsed.traces || [];
                // Cap traces to prevent unbounded growth
                if (this.traces.length > 500) {
                    this.traces = this.traces.slice(-500);
                }
                this.loaded = true;
            }
        } catch (e) {
            // Fresh start
        }
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                agingLevel: this.agingLevel,
                traces: this.traces.slice(-200), // Keep last 200 traces
            }));
        } catch (e) { }
    }

    recordLetter(letter) {
        this.traces.push({
            x: letter.x,
            y: letter.y,
            char: letter.char,
            intensity: letter.contemplated ? 0.8 : 0.4,
            timestamp: Date.now(),
        });

        // Age the interface
        this.agingLevel = clamp(this.agingLevel + 0.001, 0, 1);

        // Periodic save
        if (this.traces.length % 20 === 0) {
            this.save();
        }
    }

    reveal(duration) {
        this.revealTimer = duration;
    }

    accelerateAging(duration) {
        this.accelerateTimer = duration;
    }

    update(dt, state) {
        if (!CONFIG.MEMORY.ENABLED) return;

        if (this.revealTimer > 0) {
            this.revealTimer -= dt;
        }
        if (this.accelerateTimer > 0) {
            this.accelerateTimer -= dt;
            this.agingLevel = clamp(this.agingLevel + 0.0005 * dt, 0, 1);
        }

        // Natural aging modified by retention multiplier
        // Higher retention = slower aging
        const ageSpeed = 0.000001 / Math.max(0.1, CONFIG.MEMORY.RETENTION);
        this.agingLevel = clamp(this.agingLevel + ageSpeed * dt, 0, 1);

        // Let individual traces fade out fully based on retention to save memory
        for (let i = this.traces.length - 1; i >= 0; i--) {
            const ageMs = Date.now() - this.traces[i].timestamp;
            // E.g., at 1.0 retention, traces last roughly 10 minutes fully visible
            if (ageMs > 600000 * CONFIG.MEMORY.RETENTION) {
                this.traces.splice(i, 1);
            }
        }
    }

    render(ctx, w, h, state) {
        if (!CONFIG.MEMORY.ENABLED) return;

        const cursor = state.cursor;

        // Aging overlay (subtle paper texture darkening)
        if (this.agingLevel > 0.01) {
            ctx.fillStyle = `rgba(30, 25, 15, ${this.agingLevel * 0.08})`;
            ctx.fillRect(0, 0, w, h);
        }

        // Render traces (palimpsest)
        const isRevealing = this.revealTimer > 0;

        for (const trace of this.traces) {
            let alpha = 0;

            if (isRevealing) {
                // Full reveal during special word trigger
                alpha = trace.intensity * 0.4 * Math.min(this.revealTimer / 1000, 1);
            } else {
                // Reveal near cursor
                const dx = trace.x - cursor.x;
                const dy = trace.y - cursor.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 80) {
                    alpha = trace.intensity * 0.3 * (1 - dist / 80);
                }
            }

            if (alpha > 0.01) {
                ctx.fillStyle = `rgba(180, 170, 140, ${alpha})`;
                ctx.font = '28px "JetBrains Mono", monospace';
                ctx.fillText(trace.char, trace.x, trace.y);
            }
        }
    }
}
