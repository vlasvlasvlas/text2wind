/* ======================================
   TEXT2WIND — Living Typography
   ======================================
   Letters appear at mouse cursor position.
   Each has a lifecycle:
   BIRTH → LIFE → EROSION → DEAD
   
   Enter = accelerate erosion + word check
   ====================================== */

import { CONFIG } from './config.js';
import { randomRange, distance, clamp, easeOutCubic } from './utils/math.js';

const PHASE = {
    BIRTH: 'birth',
    LIFE: 'life',
    EROSION: 'erosion',
    DEAD: 'dead',
};

const STROKE_CHARS = ['.', ':', '*', 'o', '+', '#'];

export class TextEngine {
    constructor() {
        this.letters = [];
        this.writeX = 100;
        this.writeY = 100;
        this.cursorBlink = 0;
        this.wordBuffer = '';
        this.lineStartX = 100;
        this.lastStrokeSoundAt = 0;
    }

    init(state) { }
    resize(state) { }

    // Writing position only changes on explicit click
    // (syncCursorPosition removed — mouse move does NOT reposition text)

    // Click = set writing position explicitly
    onCanvasClick(x, y, state) {
        this.writeX = x;
        this.writeY = y;
        this.lineStartX = x;
        // Check pending word
        if (this.wordBuffer.length > 0) {
            this.checkWord(state);
        }
        this.wordBuffer = '';
    }

    getStrokeSpacing() {
        return Math.max(8, Math.round(CONFIG.TEXT.FONT_SIZE * 0.35));
    }

    _createLetter(char, x, y, lifeScale = 1) {
        return {
            char,
            x,
            y,
            phase: PHASE.BIRTH,
            birthTimer: 0,
            lifeTimer: 0,
            erosionTimer: 0,
            maxLife: (CONFIG.TEXT.LIFE_MIN + randomRange(0, CONFIG.TEXT.LIFE_MAX)) * lifeScale,
            maxErosion: CONFIG.TEXT.EROSION_DURATION,
            opacity: 0,
            scale: 1,
            vx: 0, vy: 0,
            contemplated: false,
            contemplateTime: 0,
            shakex: 0, shakey: 0,
        };
    }

    onKey(e, state) {
        const key = e.key;

        if (key === 'Enter') {
            e.preventDefault();
            this.checkWord(state);
            this.accelerateErosion(state);
            this.newLine();
            return;
        }

        if (key === ' ') {
            this.addLetter(' ', state);
            this.checkWord(state);
            return;
        }

        if (key === 'Backspace') {
            this.eraseLastLetter(state);
            return;
        }

        if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
            this.addLetter(key, state);
            this.wordBuffer += key.toLowerCase();
        }
    }

    eraseLastLetter(state) {
        for (let i = this.letters.length - 1; i >= 0; i--) {
            const l = this.letters[i];
            if (l.phase === PHASE.LIFE || l.phase === PHASE.BIRTH) {
                l.phase = PHASE.EROSION;
                l.erosionTimer = 0;
                l.maxErosion = CONFIG.TEXT.EROSION_DURATION * 0.3;
                const ctx = state.ctx;
                ctx.font = `${CONFIG.TEXT.FONT_SIZE}px ${CONFIG.TEXT.FONT_FAMILY}`;
                this.writeX -= (ctx.measureText(l.char).width + 2);
                state.sound?.onLetterErosion?.(l);
                break;
            }
        }
        if (this.wordBuffer.length > 0) {
            this.wordBuffer = this.wordBuffer.slice(0, -1);
        }
    }

    accelerateErosion(state) {
        const currentY = this.writeY;
        const threshold = CONFIG.TEXT.LINE_HEIGHT * 0.6;
        let count = 0;

        for (const l of this.letters) {
            if (Math.abs(l.y - currentY) < threshold) {
                if (l.phase === PHASE.LIFE || l.phase === PHASE.BIRTH) {
                    l.phase = PHASE.EROSION;
                    l.erosionTimer = -count * 80; // Cascade
                    l.maxErosion = CONFIG.TEXT.EROSION_DURATION * (0.3 + Math.random() * 0.4);
                    count++;
                    state.sound?.onLetterErosion?.(l);
                }
            }
        }
    }

    checkWord(state) {
        if (this.wordBuffer.length >= 2) {
            const word = this.wordBuffer.trim();
            if (word) {
                const result = state.semantic.lookup(word);
                if (result) {
                    state.weather.applySemanticEffects(result.effects, word);
                    if (result.special) this.triggerSpecialEffect(result.special, state);
                    this.markWordForContemplation(word);
                }
            }
        }
        this.wordBuffer = '';
    }

    markWordForContemplation(word) {
        let count = 0;
        for (let i = this.letters.length - 1; i >= 0 && count < word.length + 1; i--) {
            const l = this.letters[i];
            if (l.phase !== PHASE.DEAD && l.char !== ' ') {
                l.contemplated = true;
                l.contemplateTime = 2000;
                count++;
            }
        }
    }

    triggerSpecialEffect(effect, state) {
        switch (effect.effect) {
            case 'gleaning_mode':
                state.particles.emit(window.innerWidth * 0.5, window.innerHeight * 0.9, 200,
                    { spread: window.innerWidth * 0.4, life: 5000, velocityScale: -2 });
                break;
            case 'palimpsest_reveal': state.memory.reveal(3000); break;
            case 'suspension': state.modes.triggerSuspension(5000); break;
            case 'time_lapse': state.weather.triggerTimeLapse(6); break;
            case 'heart_formation': this.emitHeartParticles(state); break;
            case 'erosion_burst': this.erodeAllLetters(state); break;
            case 'rapid_aging': state.memory.accelerateAging(5000); break;
            case 'full_reveal':
                state.memory.reveal(8000);
                state.modes.triggerSuspension(8000);
                break;
        }
    }

    emitHeartParticles(state) {
        const cx = window.innerWidth * 0.5, cy = window.innerHeight * 0.4;
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
            const hx = cx + 60 * 16 * Math.pow(Math.sin(a), 3);
            const hy = cy - 60 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
            state.particles.emit(cx + (hx - cx) * 0.18, cy + (hy - cy) * 0.18, 1,
                { color: [220, 120, 130], life: 4000, sizeMin: 2, sizeMax: 4 });
        }
    }

    erodeAllLetters(state) {
        let count = 0;
        for (const l of this.letters) {
            if (l.phase === PHASE.LIFE || l.phase === PHASE.BIRTH) {
                l.phase = PHASE.EROSION;
                l.erosionTimer = -count * 30;
                count++;
                state.sound?.onLetterErosion?.(l);
            }
        }
    }

    addLetter(char, state) {
        const w = window.innerWidth;

        // Wrap line
        if (this.writeX > w - 60) {
            this.newLine();
        }

        const letter = this._createLetter(char, this.writeX, this.writeY, 1);

        this.letters.push(letter);

        // Advance writing position
        const ctx = state.ctx;
        ctx.font = `${CONFIG.TEXT.FONT_SIZE}px ${CONFIG.TEXT.FONT_FAMILY}`;
        this.writeX += ctx.measureText(char).width + 2;
        this.cursorBlink = 0;
    }

    addStrokePoint(x, y, state, intensity = 0.4) {
        const i = clamp(Math.round(clamp(intensity, 0, 1) * (STROKE_CHARS.length - 1)), 0, STROKE_CHARS.length - 1);
        const char = STROKE_CHARS[i];
        const letter = this._createLetter(char, x, y, 0.55);
        letter.scale = 0.8 + Math.random() * 0.25;
        this.letters.push(letter);

        this.writeX = x;
        this.writeY = y;
        this.lineStartX = x;
        this.cursorBlink = 0;

        const now = Date.now();
        if (state?.sound && state?.weather && now - this.lastStrokeSoundAt > 65) {
            state.sound.onKey({ key: char }, state.weather);
            this.lastStrokeSoundAt = now;
        }
    }

    newLine() {
        this.writeX = this.lineStartX;
        this.writeY += CONFIG.TEXT.LINE_HEIGHT;

        const maxY = window.innerHeight - 60;
        if (this.writeY > maxY) {
            const shift = CONFIG.TEXT.LINE_HEIGHT;
            this.writeY -= shift;
            for (const l of this.letters) l.y -= shift;
        }
    }

    update(dt, state) {
        const cursor = state.cursor;
        const wind = state.wind;
        const weather = state.weather;
        const windIntensity = weather.get('wind') / 100;

        for (let i = this.letters.length - 1; i >= 0; i--) {
            const l = this.letters[i];

            if (l.phase === PHASE.DEAD) {
                state.memory.recordLetter(l);
                this.letters.splice(i, 1);
                continue;
            }

            const distToCursor = distance(l.x, l.y, cursor.x, cursor.y);
            const isProtected = distToCursor < CONFIG.CURSOR.LIGHT_RADIUS;

            switch (l.phase) {
                case PHASE.BIRTH:
                    l.birthTimer += dt;
                    l.opacity = easeOutCubic(clamp(l.birthTimer / CONFIG.TEXT.BIRTH_DURATION, 0, 1));
                    if (l.birthTimer >= CONFIG.TEXT.BIRTH_DURATION) {
                        l.phase = PHASE.LIFE;
                        l.opacity = 1;
                    }
                    break;

                case PHASE.LIFE:
                    if (l.contemplated && l.contemplateTime > 0) {
                        l.contemplateTime -= dt;
                        l.scale = 1 + Math.sin(Date.now() * 0.005) * 0.03;
                        break;
                    }
                    if (!isProtected) l.lifeTimer += dt;
                    l.scale = 1 + Math.sin(Date.now() * 0.002 + l.x) * 0.01;

                    const lifeProgress = l.lifeTimer / l.maxLife;
                    if (lifeProgress > 0.7) {
                        const t = (lifeProgress - 0.7) / 0.3;
                        l.shakex = (Math.random() - 0.5) * t * 3 * (1 + windIntensity * 2);
                        l.shakey = (Math.random() - 0.5) * t * 2;
                    }

                    if (l.lifeTimer >= l.maxLife * (1 - windIntensity * 0.5)) {
                        l.phase = PHASE.EROSION;
                        l.erosionTimer = 0;
                        state.sound?.onLetterErosion?.(l);
                    }
                    break;

                case PHASE.EROSION:
                    l.erosionTimer += dt;
                    if (l.erosionTimer < 0) break;

                    const dur = l.maxErosion || CONFIG.TEXT.EROSION_DURATION;
                    const prog = l.erosionTimer / dur;
                    l.opacity = 1 - prog;
                    l.shakex = (Math.random() - 0.5) * 4 * (1 + windIntensity * 3);
                    l.shakey = (Math.random() - 0.5) * 3;

                    const force = wind.getForceAt(l.x, l.y);
                    l.vx += force.fx * dt * 0.003;
                    l.vy += force.fy * dt * 0.003;
                    l.x += l.vx;
                    l.y += l.vy;

                    if (prog > 0.2 && Math.random() < 0.15) {
                        state.particles.emit(l.x, l.y, 2, {
                            color: this.getInkColor(weather.getCurrentHour()),
                            spread: 10 + windIntensity * 30,
                            life: 3000 + windIntensity * 4000, sizeMin: 1, sizeMax: 3,
                        });
                    }

                    if (prog >= 1) {
                        state.particles.emit(l.x, l.y, CONFIG.TEXT.PARTICLES_PER_LETTER, {
                            color: this.getInkColor(weather.getCurrentHour()),
                            spread: 20 + windIntensity * 40, life: 4000,
                        });
                        l.phase = PHASE.DEAD;
                    }
                    break;
            }

            // Rain ink run
            const rainInt = weather.get('rain') / 100;
            if (rainInt > 0.3 && l.phase === PHASE.LIFE) {
                l.y += rainInt * 0.02 * dt * 0.01;
                l.opacity *= (1 - rainInt * 0.0001 * dt);
                if (l.opacity < 0.05) l.phase = PHASE.DEAD;
            }
        }

        this.cursorBlink += dt;
    }

    getInkColor(hour) {
        const n = hour < 6 || hour > 20 ? 1 : hour < 8 ? (8 - hour) / 2 : hour > 18 ? (hour - 18) / 2 : 0;
        const d = CONFIG.TEXT.INK_COLOR_DAY.map(v => v * 255);
        const ni = CONFIG.TEXT.INK_COLOR_NIGHT.map(v => v * 255);
        return [Math.round(d[0] + (ni[0] - d[0]) * n), Math.round(d[1] + (ni[1] - d[1]) * n), Math.round(d[2] + (ni[2] - d[2]) * n)];
    }

    render(ctx, w, h, state) {
        const hour = state.weather.getCurrentHour();
        const hueOverride = CONFIG.TEXT._hueOverride || 0;
        const ink = hueOverride > 0 ? this.hueToRGB(hueOverride, hour) : this.getInkColor(hour);

        ctx.font = `${CONFIG.TEXT.FONT_SIZE}px ${CONFIG.TEXT.FONT_FAMILY}`;
        ctx.textBaseline = 'top';

        for (const l of this.letters) {
            if (l.phase === PHASE.DEAD || l.opacity < 0.01) continue;
            ctx.save();
            ctx.translate(l.x + l.shakex, l.y + l.shakey);
            ctx.scale(l.scale, l.scale);

            if (l.contemplated && l.contemplateTime > 0) {
                ctx.shadowColor = 'rgba(255,220,150,0.5)';
                ctx.shadowBlur = 8;
            }

            ctx.fillStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${l.opacity})`;
            ctx.fillText(l.char, 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Blinking cursor at write position
        if (Math.sin(this.cursorBlink * 0.003) > 0) {
            ctx.fillStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.5)`;
            ctx.fillRect(this.writeX, this.writeY, 2, CONFIG.TEXT.FONT_SIZE);
        }
    }

    hueToRGB(hue, hour) {
        // Brightness adapts to day/night
        const isNight = hour < 6 || hour > 20;
        const lightness = isNight ? 0.78 : 0.25;
        const saturation = 0.6;
        const h = hue / 360;
        const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
        const p = 2 * lightness - q;
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        return [
            Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
            Math.round(hue2rgb(p, q, h) * 255),
            Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
        ];
    }
}
