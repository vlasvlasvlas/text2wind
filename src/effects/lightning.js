/* ======================================
   TEXT2WIND — Lightning Effect
   ====================================== */

import { randomRange } from '../utils/math.js';

export class LightningEffect {
    constructor() {
        this.flashTimer = 0;
        this.flashIntensity = 0;
        this.bolt = null;
    }

    init(state) { }

    update(dt, state) {
        const storm = state.weather.get('storm') / 100;

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            return;
        }

        // Random lightning during storms
        if (storm > 0.3 && Math.random() < storm * 0.0003 * dt) {
            this.flash(storm);
            state.sound?.playThunder?.(storm);
        }
    }

    flash(intensity) {
        this.flashTimer = 150 + intensity * 200;
        this.flashIntensity = 0.3 + intensity * 0.5;

        // Generate bolt path
        const w = window.innerWidth;
        const startX = randomRange(w * 0.2, w * 0.8);
        const segments = [];
        let x = startX;
        let y = 0;

        while (y < window.innerHeight * 0.7) {
            x += randomRange(-30, 30);
            y += randomRange(20, 60);
            segments.push({ x, y });
        }

        this.bolt = segments;
    }

    render(ctx, w, h, state) {
        if (this.flashTimer <= 0) return;

        // Screen flash
        const alpha = this.flashIntensity * (this.flashTimer / 300);
        ctx.fillStyle = `rgba(220, 220, 255, ${alpha * 0.3})`;
        ctx.fillRect(0, 0, w, h);

        // Draw bolt
        if (this.bolt && this.flashTimer > 100) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(200, 200, 255, 0.8)';
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.moveTo(this.bolt[0].x, 0);
            for (const seg of this.bolt) {
                ctx.lineTo(seg.x, seg.y);
            }
            ctx.stroke();

            ctx.shadowBlur = 0;
        }
    }
}
