/* ======================================
   TEXT2WIND — Weather State Machine
   ======================================
   Manages atmospheric parameters with
   smooth interpolation. Receives semantic
   effects from word recognition.
   ====================================== */

import { CONFIG } from './config.js';
import { clamp, lerp } from './utils/math.js';

export class Weather {
    constructor() {
        const weatherDefaults = CONFIG.DEFAULTS.weather;

        // Current values (smoothly interpolated)
        this.current = {
            wind: weatherDefaults.wind,
            windDir: weatherDefaults.windDir,
            rain: weatherDefaults.rain,
            fog: weatherDefaults.fog,
            temperature: weatherDefaults.temperature,
            storm: weatherDefaults.storm,
            snow: weatherDefaults.snow,
            hourOverride: weatherDefaults.hourOverride, // -1 = use real time
        };

        // Target values (what we're interpolating toward)
        this.target = { ...this.current };

        // Semantic accumulator (gradual effects from words)
        this.semanticPush = {
            temperature: 0, heat_haze: 0, snow: 0,
            wind_intensity: 0, storm: 0, rain: 0,
            fog: 0, letter_life: 0, hour_shift: 0,
            luminosity: 0,
        };

        this.timeLapse = null; // { startHour, targetHour, progress }
    }

    init(state) { }

    get(param) {
        return this.current[param] ?? 0;
    }

    set(param, value) {
        this.target[param] = value;
    }

    getCurrentHour() {
        const now = new Date();
        let hour = now.getHours() + now.getMinutes() / 60;

        // Apply hour override
        if (this.current.hourOverride >= 0 && this.current.hourOverride <= 24) {
            hour = this.current.hourOverride;
        }

        // Apply semantic hour shift (strong multiplier so words like "noche" are noticeable)
        hour += this.semanticPush.hour_shift * 8;

        // Time lapse
        if (this.timeLapse) {
            hour = this.timeLapse.currentHour;
        }

        // Wrap
        return ((hour % 24) + 24) % 24;
    }

    applySemanticEffects(effects, word) {
        const DECAY = 0.95; // How quickly semantic effects fade

        for (const [param, value] of Object.entries(effects)) {
            if (param in this.semanticPush) {
                this.semanticPush[param] += value * 0.3; // Gradual push
            }
        }

        // Map semantic push to weather targets
        this.target.rain = clamp(
            this.target.rain + this.semanticPush.rain * 20, 0, 100
        );
        this.target.wind = clamp(
            this.target.wind + this.semanticPush.wind_intensity * 15, 0, 100
        );
        this.target.storm = clamp(
            this.target.storm + this.semanticPush.storm * 20, 0, 100
        );
        this.target.fog = clamp(
            this.target.fog + this.semanticPush.fog * 25, 0, 100
        );
        this.target.temperature = clamp(
            this.target.temperature + this.semanticPush.temperature * 5, -10, 45
        );
    }

    triggerTimeLapse(hoursForward) {
        const currentHour = this.getCurrentHour();
        this.timeLapse = {
            startHour: currentHour,
            targetHour: currentHour + hoursForward,
            currentHour: currentHour,
            progress: 0,
            duration: 2500, // Very fast 2.5 second lapse
        };
    }

    update(dt, state) {
        const speed = CONFIG.WEATHER.TRANSITION_SPEED;

        // Interpolate current toward target
        for (const key in this.current) {
            if (key === 'hourOverride') continue;
            this.current[key] = lerp(this.current[key], this.target[key], speed * dt * 0.06);
        }
        this.current.hourOverride = this.target.hourOverride;

        // Decay semantic push (hour_shift decays slower for lasting effect)
        for (const key in this.semanticPush) {
            this.semanticPush[key] *= key === 'hour_shift' ? 0.9985 : 0.999;
        }

        // Update time lapse
        if (this.timeLapse) {
            this.timeLapse.progress += dt / this.timeLapse.duration;
            if (this.timeLapse.progress >= 1) {
                this.timeLapse = null;
            } else {
                const t = this.timeLapse.progress;
                this.timeLapse.currentHour = lerp(
                    this.timeLapse.startHour,
                    this.timeLapse.targetHour,
                    t
                );
            }
        }

        // Auto-generate storm lightning
        if (this.current.storm > 40 && Math.random() < this.current.storm * 0.00005 * dt) {
            state.sound?.playThunder?.(this.current.storm / 100);
        }
    }
}
