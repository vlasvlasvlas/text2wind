/* ======================================
   TEXT2WIND — Grass Effect
   ======================================
   Grass grows where text was abandoned.
   Nature reclaims the digital space.
   ====================================== */

import { CONFIG } from '../config.js';
import { randomRange, clamp } from '../utils/math.js';
import { noise } from '../utils/noise.js';

export class GrassEffect {
    constructor() {
        this.blades = [];
        this.lastTextTime = Date.now();
    }

    init(state) { }

    update(dt, state) {
        if (!CONFIG.GRASS.ENABLED) {
            // Trim blades away immediately if disabled
            if (this.blades.length > 0) this.blades.length = 0;
            return;
        }

        // Track text activity
        const textLetters = state.text.letters?.length || 0;
        if (textLetters > 0) {
            this.lastTextTime = Date.now();
        }

        const idleTime = Date.now() - this.lastTextTime;
        const shouldGrow = idleTime > CONFIG.GRASS.IDLE_THRESHOLD;

        if (shouldGrow && this.blades.length < CONFIG.GRASS.MAX_BLADES) {
            // Grow new blades near dead letter positions OR along the bottom edge
            const memory = state.memory;
            const useMemoryTrace = memory.traces.length > 0 && Math.random() < 0.6; // 60% chance to use memory trace if available

            if (useMemoryTrace) {
                const trace = memory.traces[Math.floor(Math.random() * memory.traces.length)];
                this.blades.push({
                    x: trace.x + randomRange(-15, 15),
                    y: trace.y + randomRange(-5, 5),
                    height: 0,
                    maxHeight: randomRange(CONFIG.GRASS.BLADE_HEIGHT_MIN, CONFIG.GRASS.BLADE_HEIGHT_MAX),
                    width: randomRange(1, 3),
                    growSpeed: randomRange(0.001, 0.003),
                    phase: Math.random() * Math.PI * 2,
                });
            } else {
                // Random position along bottom
                this.blades.push({
                    x: randomRange(40, window.innerWidth - 40),
                    y: randomRange(window.innerHeight * 0.7, window.innerHeight - 20),
                    height: 0,
                    maxHeight: randomRange(CONFIG.GRASS.BLADE_HEIGHT_MIN, CONFIG.GRASS.BLADE_HEIGHT_MAX),
                    width: randomRange(1, 3),
                    growSpeed: randomRange(0.001, 0.003),
                    phase: Math.random() * Math.PI * 2,
                });
            }
        }

        // Grow blades
        const windIntensity = state.weather.get('wind') / 100;
        for (const blade of this.blades) {
            if (blade.height < blade.maxHeight) {
                blade.height += blade.growSpeed * dt;
            }
        }
    }

    render(ctx, w, h, state) {
        if (!CONFIG.GRASS.ENABLED || this.blades.length === 0) return;

        const time = Date.now() * 0.001;
        const windIntensity = state.weather.get('wind') / 100;
        const windDir = state.weather.get('windDir');
        const hour = state.weather.getCurrentHour();

        // Grass color based on time of day
        const nightness = hour < 6 || hour > 20 ? 1 : hour < 8 ? (8 - hour) / 2 : hour > 18 ? (hour - 18) / 2 : 0;
        const color = CONFIG.GRASS.COLOR;
        const r = Math.round((color[0] * (1 - nightness * 0.6)) * 255);
        const g = Math.round((color[1] * (1 - nightness * 0.4)) * 255);
        const b = Math.round((color[2] * (1 - nightness * 0.5)) * 255);

        for (const blade of this.blades) {
            if (blade.height < 1) continue;

            // Wind sway
            const sway = Math.sin(time * 2 + blade.phase) * windIntensity * blade.height * 0.3
                + Math.sin(windDir * 0.017) * windIntensity * blade.height * 0.2;

            const alpha = clamp(blade.height / blade.maxHeight, 0.3, 0.8);

            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.lineWidth = blade.width;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(blade.x, blade.y);
            ctx.quadraticCurveTo(
                blade.x + sway * 0.5,
                blade.y - blade.height * 0.5,
                blade.x + sway,
                blade.y - blade.height
            );
            ctx.stroke();
        }
    }
}
