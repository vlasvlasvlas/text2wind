/* ======================================
   TEXT2WIND — Procedural Sky
   ======================================
   Renders a gradient sky that changes
   with time of day. Stars at night,
   organic soft clouds.
   ====================================== */

import { CONFIG } from './config.js';
import { lerp, lerpColor, clamp, smoothstep, randomRange } from './utils/math.js';
import { noise } from './utils/noise.js';

export class Sky {
    constructor() {
        this.starField = [];
        this.cloudOffset = 0;

        // Offscreen cloud canvas for smooth rendering
        this.cloudCanvas = null;
        this.cloudCtx = null;
        this.cloudNeedsUpdate = true;
        this.cloudUpdateTimer = 0;

        // Pre-generated cloud "puff" positions
        this.cloudPuffs = [];
    }

    init(state) {
        // Pre-generate star positions
        this.starField = [];
        for (let i = 0; i < 200; i++) {
            this.starField.push({
                x: Math.random(),
                y: Math.random() * 0.7,
                size: 0.5 + Math.random() * 1.5,
                flicker: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 2,
            });
        }

        // Create offscreen canvas for clouds
        this.cloudCanvas = document.createElement('canvas');
        this.cloudCtx = this.cloudCanvas.getContext('2d');

        // Generate cloud puff formations
        this.generateCloudFormations();
    }

    generateCloudFormations() {
        // Generate organic cloud shapes as collections of overlapping circles
        this.cloudPuffs = [];
        const numClouds = 12;

        for (let c = 0; c < numClouds; c++) {
            const cx = randomRange(0, 1.4) - 0.2; // Allow overflow for seamless scrolling
            const cy = randomRange(0.05, 0.4);
            const cloudSize = randomRange(0.06, 0.18);
            const numPuffs = Math.floor(randomRange(5, 15));
            const layer = Math.floor(randomRange(0, 3));

            for (let p = 0; p < numPuffs; p++) {
                const angle = randomRange(0, Math.PI * 2);
                const dist = randomRange(0, cloudSize * 0.7);
                this.cloudPuffs.push({
                    x: cx + Math.cos(angle) * dist,
                    y: cy + Math.sin(angle) * dist * 0.5, // Flatter clouds
                    radius: randomRange(cloudSize * 0.3, cloudSize * 0.9),
                    opacity: randomRange(0.15, 0.5),
                    layer: layer,
                    noisePhase: randomRange(0, 100),
                });
            }
        }

        // Sort by layer for depth
        this.cloudPuffs.sort((a, b) => a.layer - b.layer);
    }

    resize(state) {
        if (this.cloudCanvas) {
            this.cloudCanvas.width = Math.floor(window.innerWidth * 0.5);
            this.cloudCanvas.height = Math.floor(window.innerHeight * 0.5);
        }
    }

    getColorsForHour(hour) {
        const palettes = CONFIG.SKY_PALETTES;
        let lower = palettes[0];
        let upper = palettes[1];

        for (let i = 0; i < palettes.length - 1; i++) {
            if (hour >= palettes[i].hour && hour < palettes[i + 1].hour) {
                lower = palettes[i];
                upper = palettes[i + 1];
                break;
            }
        }

        const range = upper.hour - lower.hour;
        const t = range > 0 ? (hour - lower.hour) / range : 0;
        const smoothT = smoothstep(0, 1, t);

        return {
            top: lerpColor(lower.top, upper.top, smoothT),
            bottom: lerpColor(lower.bottom, upper.bottom, smoothT),
        };
    }

    render(ctx, w, h, hour, weather) {
        const colors = this.getColorsForHour(hour);

        const stormIntensity = weather.get('storm') / 100;
        const fogIntensity = weather.get('fog') / 100;
        const rainIntensity = weather.get('rain') / 100;

        const stormDarken = stormIntensity * 0.5;
        const rainDarken = rainIntensity * 0.2;

        let topR = clamp((colors.top[0] - stormDarken - rainDarken) * 255, 0, 255);
        let topG = clamp((colors.top[1] - stormDarken - rainDarken) * 255, 0, 255);
        let topB = clamp((colors.top[2] - stormDarken * 0.3) * 255, 0, 255);
        let botR = clamp((colors.bottom[0] - stormDarken - rainDarken) * 255, 0, 255);
        let botG = clamp((colors.bottom[1] - stormDarken - rainDarken) * 255, 0, 255);
        let botB = clamp((colors.bottom[2] - stormDarken * 0.3) * 255, 0, 255);

        // Sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
        grad.addColorStop(1, `rgb(${botR},${botG},${botB})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Stars
        const nightness = this.getNightness(hour);
        if (nightness > 0.05) {
            this.renderStars(ctx, w, h, nightness, fogIntensity);
        }

        // Clouds
        const cloudiness = clamp(
            (rainIntensity * 0.7 + stormIntensity * 0.9 + fogIntensity * 0.3) + 0.1,
            0, 1
        );
        if (cloudiness > 0.05) {
            this.renderClouds(ctx, w, h, hour, cloudiness, weather);
        }

        // Ambient wind particles
        this.renderWindParticles(ctx, w, h, weather);
    }

    getNightness(hour) {
        if (hour < 5) return 1;
        if (hour < 7) return 1 - (hour - 5) / 2;
        if (hour < 18) return 0;
        if (hour < 20) return (hour - 18) / 2;
        return 1;
    }

    renderStars(ctx, w, h, nightness, fog) {
        const alpha = nightness * (1 - fog * 0.8);
        if (alpha < 0.02) return;

        const time = Date.now() * 0.001;

        for (const star of this.starField) {
            const flicker = 0.5 + 0.5 * Math.sin(time * star.speed + star.flicker);
            const a = alpha * flicker * 0.8;
            if (a < 0.02) continue;

            ctx.fillStyle = `rgba(220, 215, 200, ${a})`;
            ctx.beginPath();
            ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderClouds(ctx, w, h, hour, cloudiness, weather) {
        const time = Date.now() * 0.00005;
        const windSpeed = weather.get('wind') / 100;

        // Scroll clouds with wind
        this.cloudOffset += windSpeed * 0.0003;

        const nightness = this.getNightness(hour);
        const stormIntensity = weather.get('storm') / 100;

        // Cloud color palette
        let cloudR, cloudG, cloudB;
        if (nightness > 0.5) {
            // Night clouds: dark grey-blue
            cloudR = lerp(60, 30, stormIntensity);
            cloudG = lerp(60, 30, stormIntensity);
            cloudB = lerp(75, 40, stormIntensity);
        } else {
            // Day clouds: white to grey (stormy)
            cloudR = lerp(240, 120, stormIntensity);
            cloudG = lerp(240, 115, stormIntensity);
            cloudB = lerp(250, 130, stormIntensity);
        }

        ctx.save();

        for (const puff of this.cloudPuffs) {
            // Animated position with wind scroll and noise wobble
            const wobbleX = noise.noise2D(puff.noisePhase + time * 2, 0) * 0.02;
            const wobbleY = noise.noise2D(0, puff.noisePhase + time * 1.5) * 0.01;

            const px = ((puff.x + this.cloudOffset * (1 + puff.layer * 0.3) + wobbleX) % 1.6) - 0.2;
            const py = puff.y + wobbleY;

            const screenX = px * w;
            const screenY = py * h;
            const screenR = puff.radius * Math.min(w, h);

            if (screenX < -screenR * 2 || screenX > w + screenR * 2) continue;
            if (screenY < -screenR * 2 || screenY > h) continue;

            // Density modulated by cloudiness
            const alpha = puff.opacity * cloudiness * (0.4 + stormIntensity * 0.4);

            // Soft radial gradient for each puff — organic, no hard edges
            const grad = ctx.createRadialGradient(
                screenX, screenY, screenR * 0.1,
                screenX, screenY, screenR
            );
            grad.addColorStop(0, `rgba(${cloudR},${cloudG},${cloudB},${alpha})`);
            grad.addColorStop(0.4, `rgba(${cloudR},${cloudG},${cloudB},${alpha * 0.6})`);
            grad.addColorStop(0.7, `rgba(${cloudR},${cloudG},${cloudB},${alpha * 0.2})`);
            grad.addColorStop(1, `rgba(${cloudR},${cloudG},${cloudB},0)`);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, screenR, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // ── Ambient Wind Particles ──
    // Visible dust/pollen that shows wind flow

    renderWindParticles(ctx, w, h, weather) {
        const windIntensity = weather.get('wind') / 100;
        if (windIntensity < 0.05) return;

        if (!this._windMotes) {
            this._windMotes = [];
            for (let i = 0; i < 300; i++) {
                this._windMotes.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    size: randomRange(0.5, 2.5),
                    speed: randomRange(0.3, 1.0),
                    opacity: randomRange(0.05, 0.2),
                    phase: Math.random() * Math.PI * 2,
                    drift: randomRange(-0.3, 0.3),
                });
            }
        }

        const windDir = weather.get('windDir') * Math.PI / 180;
        const vx = Math.cos(windDir);
        const vy = Math.sin(windDir);
        const time = Date.now() * 0.001;
        const hour = weather.getCurrentHour();
        const nightness = this.getNightness(hour);

        // Number of visible motes based on wind intensity
        const visibleCount = Math.floor(windIntensity * 300);

        // Mote color (lighter during day, subtle at night)
        const mr = nightness > 0.5 ? 160 : 220;
        const mg = nightness > 0.5 ? 155 : 215;
        const mb = nightness > 0.5 ? 170 : 200;

        for (let i = 0; i < visibleCount && i < this._windMotes.length; i++) {
            const m = this._windMotes[i];

            // Move with wind + slight sine drift
            const drift = Math.sin(time * 0.5 + m.phase) * m.drift;
            m.x += (vx * windIntensity * m.speed * 2 + drift);
            m.y += (vy * windIntensity * m.speed * 2 + Math.sin(time + m.phase) * 0.2);

            // Wrap around screen
            if (m.x > w + 10) m.x = -10;
            if (m.x < -10) m.x = w + 10;
            if (m.y > h + 10) m.y = -10;
            if (m.y < -10) m.y = h + 10;

            const alpha = m.opacity * windIntensity;
            if (alpha < 0.01) continue;

            ctx.fillStyle = `rgba(${mr},${mg},${mb},${alpha})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
