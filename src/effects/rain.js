/* ======================================
   TEXT2WIND — Rain Effect
   ====================================== */

import { randomRange, clamp } from '../utils/math.js';

export class RainEffect {
    constructor() {
        this.drops = [];
        this.maxDrops = 2000;
    }

    init(state) { }
    resize(state) { }

    update(dt, state) {
        const intensity = state.weather.get('rain') / 100;
        if (intensity < 0.05) {
            this.drops = [];
            return;
        }

        const w = window.innerWidth;
        const h = window.innerHeight;
        const windDir = state.weather.get('windDir');
        const windSpeed = state.weather.get('wind') / 100;

        // Spawn new drops
        const targetCount = Math.floor(intensity * this.maxDrops);
        while (this.drops.length < targetCount) {
            this.drops.push({
                x: randomRange(-50, w + 50),
                y: randomRange(-50, -10),
                speed: randomRange(8, 16) * (0.5 + intensity),
                length: randomRange(10, 25) * intensity,
                opacity: randomRange(0.1, 0.4) * intensity,
                windOffset: Math.sin(windDir * Math.PI / 180) * windSpeed * 3,
            });
        }

        // Move drops
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.y += d.speed * dt * 0.1;
            d.x += d.windOffset * dt * 0.05;

            if (d.y > h + 20) {
                if (this.drops.length > targetCount) {
                    this.drops.splice(i, 1);
                } else {
                    d.y = randomRange(-50, -10);
                    d.x = randomRange(-50, w + 50);
                }
            }
        }
    }

    render(ctx, w, h, state) {
        if (this.drops.length === 0) return;

        const windAngle = state.weather.get('windDir') * Math.PI / 180;
        const windTilt = Math.sin(windAngle) * (state.weather.get('wind') / 100) * 10;

        ctx.strokeStyle = 'rgba(180, 200, 220, 0.3)';
        ctx.lineWidth = 1;

        for (const d of this.drops) {
            ctx.globalAlpha = d.opacity;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x + windTilt, d.y + d.length);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }
}
