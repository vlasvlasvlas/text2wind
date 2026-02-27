/* ======================================
   TEXT2WIND — Bugs Effect (Fireflies/Cicadas)
   ======================================
   Fireflies glow at night near grass, 
   cicadas/day bugs flutter randomly.
   ====================================== */

import { CONFIG } from '../config.js';
import { randomRange } from '../utils/math.js';
import { noise } from '../utils/noise.js';

export class BugsEffect {
    constructor() {
        this.bugs = [];
    }

    init(state) { }

    update(dt, state) {
        if (!CONFIG.BUGS.ENABLED || CONFIG.BUGS.INTENSITY === 0) {
            this.bugs = [];
            return;
        }

        const hour = state.weather.getCurrentHour();
        const nightness = state.sky.getNightness(hour);
        const isNight = nightness > 0.3;

        // Check text presence to avoid covering active typing area (optional)
        const targetCount = Math.floor(CONFIG.BUGS.INTENSITY * 0.5);

        // Add bugs
        while (this.bugs.length < targetCount) {
            this.bugs.push(this.createBug(isNight));
        }

        // Remove excess bugs or swap day/night types
        for (let i = this.bugs.length - 1; i >= 0; i--) {
            const bug = this.bugs[i];
            if (this.bugs.length > targetCount || bug.isNight !== isNight) {
                bug.life -= dt;
                if (bug.life <= 0) {
                    this.bugs.splice(i, 1);
                }
            }
        }

        // Update positions
        const w = window.innerWidth;
        const h = window.innerHeight;
        const time = Date.now() * 0.001;

        for (const bug of this.bugs) {
            bug.timeOffset += dt * bug.speed;

            // Noise-based wander + gentle upward drift
            const nx = noise.noise2D(bug.seed, bug.timeOffset * 0.5);
            const ny = noise.noise2D(bug.timeOffset * 0.5, bug.seed);

            bug.x += nx * 1.5;
            bug.y += ny * 1.0;

            // Keep in bottom third/half of screen
            if (bug.y < h * 0.5) bug.y += 1;
            if (bug.y > h) bug.y -= 1;
            if (bug.x < 0) bug.x = w;
            if (bug.x > w) bug.x = 0;

            // Update glow/opacity (pulse)
            bug.glowPhase += dt * bug.pulseSpeed;
        }
    }

    createBug(isNight) {
        return {
            x: randomRange(0, window.innerWidth),
            y: randomRange(window.innerHeight * 0.6, window.innerHeight),
            seed: Math.random() * 1000,
            timeOffset: Math.random() * 1000,
            isNight: isNight,
            life: 1000, // Ms to live after getting fading out
            speed: isNight ? randomRange(0.0005, 0.001) : randomRange(0.002, 0.005),
            glowPhase: Math.random() * Math.PI * 2,
            pulseSpeed: isNight ? randomRange(0.001, 0.003) : randomRange(0.005, 0.015),
            size: isNight ? randomRange(1.5, 3) : randomRange(0.5, 1.5),
        };
    }

    render(ctx, w, h, state) {
        if (this.bugs.length === 0) return;

        ctx.save();
        for (const bug of this.bugs) {
            let alpha = 1;
            if (bug.life < 1000) alpha = Math.max(0, bug.life / 1000); // Fading out

            if (bug.isNight) {
                // Firefly glow
                const glow = 0.3 + 0.7 * Math.abs(Math.sin(bug.glowPhase));
                ctx.fillStyle = `rgba(180, 255, 100, ${glow * alpha * 0.8})`;

                ctx.beginPath();
                ctx.arc(bug.x, bug.y, bug.size, 0, Math.PI * 2);
                ctx.fill();

                // Outer soft glow
                const grad = ctx.createRadialGradient(bug.x, bug.y, 0, bug.x, bug.y, bug.size * 3);
                grad.addColorStop(0, `rgba(150, 255, 50, ${glow * alpha * 0.4})`);
                grad.addColorStop(1, 'rgba(150, 255, 50, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(bug.x - bug.size * 3, bug.y - bug.size * 3, bug.size * 6, bug.size * 6);
            } else {
                // Day bug (dark speck, fast flutter)
                const visibility = 0.4 + 0.6 * Math.abs(Math.sin(bug.glowPhase));
                ctx.fillStyle = `rgba(30, 20, 10, ${visibility * alpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(bug.x, bug.y, bug.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}
