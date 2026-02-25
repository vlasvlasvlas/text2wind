/* ======================================
   TEXT2WIND — Wind Field
   ======================================
   Perlin noise-based vector field that
   drives particle movement and letter
   erosion. Parametrizable direction
   and intensity.
   ====================================== */

import { CONFIG } from './config.js';
import { noise } from './utils/noise.js';
import { degToRad, clamp } from './utils/math.js';

export class Wind {
    constructor() {
        this.intensity = CONFIG.WIND.DEFAULT_INTENSITY;
        this.direction = CONFIG.WIND.DEFAULT_DIRECTION;
        this.time = 0;
    }

    init(state) { }

    setIntensity(v) { this.intensity = clamp(v, 0, 100); }
    setDirection(v) { this.direction = v % 360; }

    update(dt, state) {
        this.time += dt * CONFIG.WIND.NOISE_SPEED;

        // Sync from weather
        const weather = state.weather;
        this.intensity = weather.get('wind');
        this.direction = weather.get('windDir');
    }

    /**
     * Get wind force vector at position (x, y).
     * Returns { fx, fy } — force components.
     */
    getForceAt(x, y) {
        const scale = CONFIG.WIND.NOISE_SCALE;
        const octaves = CONFIG.WIND.TURBULENCE_OCTAVES;
        const power = this.intensity / 100;

        // Base direction
        const rad = degToRad(this.direction);
        const baseFx = Math.cos(rad) * power;
        const baseFy = Math.sin(rad) * power;

        // Turbulence from noise field
        const turbX = noise.fbm3D(x * scale, y * scale, this.time, octaves);
        const turbY = noise.fbm3D(x * scale + 100, y * scale + 100, this.time, octaves);

        const turbulenceStrength = power * 0.6;

        return {
            fx: baseFx + turbX * turbulenceStrength,
            fy: baseFy + turbY * turbulenceStrength,
        };
    }

    /**
     * Get wind speed magnitude at position
     */
    getSpeedAt(x, y) {
        const f = this.getForceAt(x, y);
        return Math.sqrt(f.fx * f.fx + f.fy * f.fy);
    }
}
