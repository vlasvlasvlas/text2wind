/* ======================================
   TEXT2WIND — Cursor Light (Firefly)
   ======================================
   The cursor is a warm candlelight that
   leaves glowing firefly trails as it
   moves. Click to position writing.
   ====================================== */

import { CONFIG } from './config.js';
import { clamp, randomRange } from './utils/math.js';

export class CursorLight {
    constructor() {
        this.x = -100;
        this.y = -100;
        this.targetX = -100;
        this.targetY = -100;
        this.visible = false;

        // Firefly trail
        this.trail = []; // { x, y, life, maxLife, size, hue }
        this.maxTrail = 80;
        this.lastTrailTime = 0;

        // Movement tracking
        this.lastX = 0;
        this.lastY = 0;
        this.speed = 0;
    }

    init(state) { }

    update(mx, my) {
        this.targetX = mx;
        this.targetY = my;
        this.visible = true;

        // Calculate speed
        const dx = mx - this.lastX;
        const dy = my - this.lastY;
        this.speed = Math.sqrt(dx * dx + dy * dy);
        this.lastX = mx;
        this.lastY = my;

        // Smooth follow
        this.x += (this.targetX - this.x) * 0.2;
        this.y += (this.targetY - this.y) * 0.2;

        // Emit trail particles when moving
        const now = Date.now();
        if (this.speed > 1.5 && now - this.lastTrailTime > 20) {
            this.lastTrailTime = now;

            // More particles when moving faster
            const count = Math.min(3, Math.floor(this.speed / 8) + 1);
            for (let i = 0; i < count; i++) {
                this.trail.push({
                    x: this.x + randomRange(-3, 3),
                    y: this.y + randomRange(-3, 3),
                    vx: randomRange(-0.5, 0.5) - dx * 0.05,
                    vy: randomRange(-0.5, 0.5) - dy * 0.05 - randomRange(0.1, 0.4), // slight float up
                    life: randomRange(800, 2000),
                    maxLife: randomRange(800, 2000),
                    size: randomRange(1.5, 4),
                    pulse: randomRange(0, Math.PI * 2),
                    pulseSpeed: randomRange(3, 8),
                });
            }

            // Cap trail length
            while (this.trail.length > this.maxTrail) {
                this.trail.shift();
            }
        }
    }

    render(ctx, w, h, hour) {
        if (!this.visible) return;

        const nightness = hour < 6 || hour > 20 ? 1 : hour < 8 ? (8 - hour) / 2 : hour > 18 ? (hour - 18) / 2 : 0;
        const r = CONFIG.CURSOR.LIGHT_RADIUS;
        const color = CONFIG.CURSOR.GLOW_COLOR;
        const intensity = CONFIG.CURSOR.GLOW_INTENSITY * (0.5 + nightness * 0.5);
        const time = Date.now() * 0.001;

        // ── Firefly trails ──
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const t = this.trail[i];
            t.life -= 16; // ~60fps
            t.x += t.vx;
            t.y += t.vy;
            t.vy -= 0.003; // gentle float up

            if (t.life <= 0) {
                this.trail.splice(i, 1);
                continue;
            }

            const lifeRatio = t.life / t.maxLife;
            const pulse = 0.5 + 0.5 * Math.sin(time * t.pulseSpeed + t.pulse);
            const alpha = lifeRatio * pulse * intensity * 0.7;
            const size = t.size * (0.5 + lifeRatio * 0.5);

            if (alpha < 0.01) continue;

            // Warm glow per particle
            const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size * 3);
            grad.addColorStop(0, `rgba(255, 230, 150, ${alpha * 0.8})`);
            grad.addColorStop(0.4, `rgba(255, 200, 100, ${alpha * 0.3})`);
            grad.addColorStop(1, `rgba(255, 180, 80, 0)`);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(t.x, t.y, size * 3, 0, Math.PI * 2);
            ctx.fill();

            // Bright core
            ctx.fillStyle = `rgba(255, 245, 220, ${alpha * 0.9})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── Main cursor glow ──
        const flicker = 0.9 + 0.1 * Math.sin(time * 6) * Math.sin(time * 9.7);
        const glowIntensity = intensity * flicker;

        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
        grad.addColorStop(0, `rgba(${color[0] * 255 | 0}, ${color[1] * 255 | 0}, ${color[2] * 255 | 0}, ${glowIntensity * 0.25})`);
        grad.addColorStop(0.3, `rgba(${color[0] * 255 | 0}, ${color[1] * 255 | 0}, ${color[2] * 255 | 0}, ${glowIntensity * 0.1})`);
        grad.addColorStop(0.6, `rgba(${color[0] * 255 | 0}, ${color[1] * 255 | 0}, ${color[2] * 255 | 0}, ${glowIntensity * 0.03})`);
        grad.addColorStop(1, `rgba(${color[0] * 255 | 0}, ${color[1] * 255 | 0}, ${color[2] * 255 | 0}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Bright cursor core with candle flicker
        const coreSize = 3 + Math.sin(time * 7) * 0.5;
        ctx.fillStyle = `rgba(255, 235, 190, ${0.7 + nightness * 0.3})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, coreSize, 0, Math.PI * 2);
        ctx.fill();

        // Outer halo
        ctx.fillStyle = `rgba(255, 220, 150, ${glowIntensity * 0.08})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}
