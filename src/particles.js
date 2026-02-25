/* ======================================
   TEXT2WIND — Particle System
   ======================================
   Pool-based particle system for letter
   erosion fragments. Particles follow
   the wind field and fade over time.
   ====================================== */

import { CONFIG } from './config.js';
import { randomRange, clamp } from './utils/math.js';

export class ParticleSystem {
    constructor() {
        this.pool = [];
        this.activeCount = 0;
    }

    init(state) {
        // Pre-allocate particle pool
        this.pool = new Array(CONFIG.PARTICLES.MAX_COUNT);
        for (let i = 0; i < this.pool.length; i++) {
            this.pool[i] = {
                active: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                life: 0, maxLife: 0,
                size: 1,
                r: 200, g: 190, b: 170,
                opacity: 1,
                type: 'dust', // 'dust' | 'ink' | 'debris'
            };
        }
        this.activeCount = 0;
    }

    resize(state) { }

    /**
     * Emit particles at position (x, y) with given properties.
     */
    emit(x, y, count, options = {}) {
        const {
            color = [200, 190, 170],
            sizeMin = CONFIG.PARTICLES.MIN_SIZE,
            sizeMax = CONFIG.PARTICLES.MAX_SIZE,
            life = CONFIG.PARTICLES.DEFAULT_LIFE,
            spread = 30,
            velocityScale = 1,
            type = 'dust',
        } = options;

        let emitted = 0;
        for (let i = 0; i < this.pool.length && emitted < count; i++) {
            const p = this.pool[i];
            if (p.active) continue;

            p.active = true;
            p.x = x + randomRange(-spread * 0.3, spread * 0.3);
            p.y = y + randomRange(-spread * 0.3, spread * 0.3);
            p.vx = randomRange(-spread, spread) * 0.02 * velocityScale;
            p.vy = randomRange(-spread, spread) * 0.02 * velocityScale;
            p.life = life + randomRange(-life * 0.3, life * 0.3);
            p.maxLife = p.life;
            p.size = randomRange(sizeMin, sizeMax);
            p.r = color[0];
            p.g = color[1];
            p.b = color[2];
            p.opacity = 1;
            p.type = type;
            emitted++;
            this.activeCount++;
        }
        return emitted;
    }

    update(dt, state) {
        const wind = state.wind;
        const gravity = CONFIG.PARTICLES.GRAVITY;

        this.activeCount = 0;

        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (!p.active) continue;

            // Age
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                continue;
            }

            this.activeCount++;

            // Life ratio (1 = just born, 0 = about to die)
            const lifeRatio = p.life / p.maxLife;
            p.opacity = Math.min(lifeRatio * 3, 1); // fade in last third

            // Wind force
            const force = wind.getForceAt(p.x, p.y);
            p.vx += force.fx * dt * 0.005;
            p.vy += force.fy * dt * 0.005;

            // Gravity (slight downward pull)
            p.vy += gravity * dt * 0.01;

            // Damping
            p.vx *= 0.998;
            p.vy *= 0.998;

            // Move
            p.x += p.vx * dt * 0.1;
            p.y += p.vy * dt * 0.1;

            // Shrink slightly as it ages
            p.size *= (1 - 0.0001 * dt);
        }
    }

    render(ctx, w, h, state) {
        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (!p.active) continue;

            // Skip offscreen
            if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
                p.active = false;
                this.activeCount--;
                continue;
            }

            const a = clamp(p.opacity, 0, 1);
            if (a < 0.01) continue;

            ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
