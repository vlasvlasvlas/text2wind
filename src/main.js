/* ======================================
   TEXT2WIND — Main Entry Point
   ====================================== */

import { CONFIG } from './config.js';
import { Sky } from './sky.js';
import { Wind } from './wind.js';
import { ParticleSystem } from './particles.js';
import { TextEngine } from './text.js';
import { Weather } from './weather.js';
import { SoundEngine } from './sound.js';
import { SemanticEngine } from './semantic.js';
import { CursorLight } from './cursor.js';
import { UI } from './ui.js';
import { Memory } from './memory.js';
import { ModeDetector } from './modes.js';
import { RainEffect } from './effects/rain.js';
import { GrassEffect } from './effects/grass.js';
import { LightningEffect } from './effects/lightning.js';
import { FogEffect } from './effects/fog.js';

class Text2Wind {
    constructor() {
        this.canvas = document.getElementById('world');
        this.ctx = this.canvas.getContext('2d');
        this.running = false;
        this.started = false;
        this.lastTime = 0;

        // Systems
        this.sky = new Sky();
        this.wind = new Wind();
        this.particles = new ParticleSystem();
        this.text = new TextEngine();
        this.weather = new Weather();
        this.sound = new SoundEngine();
        this.semantic = new SemanticEngine();
        this.cursor = new CursorLight();
        this.ui = new UI();
        this.memory = new Memory();
        this.modes = new ModeDetector();

        // Effects
        this.rain = new RainEffect();
        this.grass = new GrassEffect();
        this.lightning = new LightningEffect();
        this.fog = new FogEffect();

        // Auto-typewriter
        this.autoText = null;
        this.autoIndex = 0;
        this.autoTimer = 0;
        this.autoBPM = CONFIG.AUTO.DEFAULT_BPM;
        this.autoPlaying = false;
        this.strokeInput = {
            active: false,
            pointerId: null,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            moved: false,
        };

        this.resize = this.resize.bind(this);
        this.loop = this.loop.bind(this);
        this.onKey = this.onKey.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
    }

    async init() {
        this.resize();
        window.addEventListener('resize', this.resize);
        await this.semantic.load();

        // Pre-warm sound module/assets so first user gesture only needs audio unlock.
        await this.sound.init().catch(err => console.warn('Sound prewarm failed:', err));

        const state = this.getState();
        this.sky.init(state);
        this.wind.init(state);
        this.particles.init(state);
        this.text.init(state);
        this.weather.init(state);
        this.cursor.init(state);
        this.memory.init(state);
        this.modes.init(state);
        this.rain.init(state);
        this.grass.init(state);
        this.lightning.init(state);
        this.fog.init(state);

        this.ui.init(state, this.weather, this.sound, this);

        // Events
        window.addEventListener('keydown', this.onKey);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('touchmove', e => {
            if (e.touches.length > 0) {
                this.cursor.update(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        this.canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
        this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
        window.addEventListener('pointerup', this.onPointerUp, { passive: false });
        window.addEventListener('pointercancel', this.onPointerUp, { passive: false });
        this.canvas.addEventListener('touchstart', () => this.sound.primeFromGesture?.(), { passive: true });

        // Canvas click
        this.canvas.addEventListener('click', e => {
            if (this.isMobileInput()) return;
            if (!this.started) { this.startApp(); return; }
            if (e.target !== this.canvas) return;
            this.text.onCanvasClick(e.clientX, e.clientY, this.getState());
        });

        // Intro
        const introEl = document.getElementById('intro');
        introEl.addEventListener('click', () => this.startApp());
        introEl.addEventListener('touchstart', () => this.sound.primeFromGesture?.(), { passive: true });

        // Paste (Cmd+V / Ctrl+V)
        document.addEventListener('paste', e => {
            if (!this.started) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            if (!text) return;
            const state = this.getState();
            for (const char of text) {
                if (char === '\n') {
                    this.text.checkWord(state);
                    this.text.newLine();
                } else if (char === ' ') {
                    this.text.addLetter(' ', state);
                    this.text.checkWord(state);
                } else if (char.length === 1) {
                    this.text.addLetter(char, state);
                    this.text.wordBuffer += char.toLowerCase();
                    this.sound.onKey({ key: char }, this.weather);
                }
            }
        });

        console.log('🌾 Text2Wind initialized');
    }

    startApp() {
        if (!this.started) {
            this.started = true;
            this.running = true;
            document.getElementById('intro').classList.add('hidden');
            this.sound.primeFromGesture?.();
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop);

            // Ensure sound is ON by default after first user gesture.
            this.sound.enable().then(() => {
                const btn = document.getElementById('btn-sound');
                if (btn) btn.textContent = '🔊';
            }).catch(() => {
                const btn = document.getElementById('btn-sound');
                if (btn) btn.textContent = '🔇';
            });
        }
    }

    getState() {
        return {
            canvas: this.canvas, ctx: this.ctx,
            width: this.canvas.width, height: this.canvas.height,
            weather: this.weather, wind: this.wind,
            cursor: this.cursor, particles: this.particles,
            memory: this.memory, semantic: this.semantic,
            text: this.text, modes: this.modes, sound: this.sound,
        };
    }

    resize() {
        const dpr = CONFIG.PIXEL_RATIO;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        const state = this.getState();
        this.sky.resize(state);
        this.particles.resize(state);
        this.text.resize(state);
        this.rain.resize(state);
    }

    onKey(e) {
        if (!this.started) return;

        // F11 — performance mode
        if (e.key === 'F11') {
            e.preventDefault();
            this.ui.togglePerformanceMode();
            return;
        }

        // Escape
        if (e.key === 'Escape') {
            this.ui.closeAllPanels();
            if (document.fullscreenElement) document.exitFullscreen?.();
            return;
        }

        // Don't capture if UI is focused
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        this.sound.onKey(e, this.weather);
        this.text.onKey(e, this.getState());
        this.modes.onKey(e);
    }

    onMouseMove(e) {
        this.cursor.update(e.clientX, e.clientY);
    }

    async ensureSoundEnabledFromGesture() {
        this.sound.primeFromGesture?.();
        if (this.sound?.enabled) return true;
        try {
            await this.sound.enable();
            const btn = document.getElementById('btn-sound');
            if (btn) btn.textContent = '🔊';
            return !!this.sound?.enabled;
        } catch (e) {
            const btn = document.getElementById('btn-sound');
            if (btn) btn.textContent = '🔇';
            return false;
        }
    }

    isMobileInput() {
        return window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
    }

    async onPointerDown(e) {
        if (!this.isMobileInput() || e.pointerType === 'mouse') return;
        if (e.target !== this.canvas) return;
        if (!this.started) this.startApp();
        if (!this.started) return;

        if (e.cancelable) e.preventDefault();
        this.sound.primeFromGesture?.();
        await this.ensureSoundEnabledFromGesture();
        const x = e.clientX;
        const y = e.clientY;
        const state = this.getState();
        this.cursor.update(x, y);
        this.text.onCanvasClick(x, y, state);

        this.strokeInput.active = true;
        this.strokeInput.pointerId = e.pointerId;
        this.strokeInput.startX = x;
        this.strokeInput.startY = y;
        this.strokeInput.lastX = x;
        this.strokeInput.lastY = y;
        this.strokeInput.moved = false;
        this.canvas.setPointerCapture?.(e.pointerId);
    }

    onPointerMove(e) {
        if (!this.strokeInput.active || e.pointerId !== this.strokeInput.pointerId) return;
        if (!this.isMobileInput() || e.pointerType === 'mouse') return;

        if (e.cancelable) e.preventDefault();
        const x = e.clientX;
        const y = e.clientY;
        this.cursor.update(x, y);

        const startDx = x - this.strokeInput.startX;
        const startDy = y - this.strokeInput.startY;
        if (Math.hypot(startDx, startDy) > 6) {
            this.strokeInput.moved = true;
        }

        const spacing = this.text.getStrokeSpacing();
        const dx = x - this.strokeInput.lastX;
        const dy = y - this.strokeInput.lastY;
        const dist = Math.hypot(dx, dy);
        if (dist < spacing) return;

        const steps = Math.max(1, Math.floor(dist / spacing));
        const state = this.getState();
        const stepDx = dx / steps;
        const stepDy = dy / steps;
        const stepSpeed = dist / steps;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = this.strokeInput.lastX + dx * t;
            const py = this.strokeInput.lastY + dy * t;
            this.text.addStrokePoint(px, py, state, { dx: stepDx, dy: stepDy, speed: stepSpeed });
        }
        this.strokeInput.lastX = x;
        this.strokeInput.lastY = y;
    }

    onPointerUp(e) {
        if (!this.strokeInput.active || e.pointerId !== this.strokeInput.pointerId) return;
        if (!this.isMobileInput() || e.pointerType === 'mouse') return;

        if (e.cancelable) e.preventDefault();
        const x = e.clientX;
        const y = e.clientY;
        this.cursor.update(x, y);

        const spacing = this.text.getStrokeSpacing();
        const dx = x - this.strokeInput.lastX;
        const dy = y - this.strokeInput.lastY;
        const dist = Math.hypot(dx, dy);
        if (dist > spacing * 0.5) {
            const state = this.getState();
            this.text.addStrokePoint(x, y, state, { dx, dy, speed: dist });
        }

        this.strokeInput.active = false;
        this.strokeInput.pointerId = null;
        this.canvas.releasePointerCapture?.(e.pointerId);
    }

    // ── Auto-typewriter ──

    loadAutoText(text) {
        this.autoText = text;
        this.autoIndex = 0;
        this.autoTimer = 0;
        this.autoPlaying = true;
        console.log(`📖 Auto-typewriter: ${text.length} chars loaded`);
    }

    setAutoBPM(bpm) {
        this.autoBPM = Math.max(10, Math.min(600, bpm));
    }

    toggleAutoPlay() {
        if (!this.autoText) return false;
        this.autoPlaying = !this.autoPlaying;
        return this.autoPlaying;
    }

    stopAutoPlay() {
        this.autoPlaying = false;
        this.autoText = null;
        this.autoIndex = 0;
        this.autoTimer = 0;
        // Clean up text engine state so manual typing works
        this.text.wordBuffer = '';
    }

    updateAutoTypewriter(dt) {
        if (!this.autoPlaying || !this.autoText || this.autoIndex >= this.autoText.length) {
            if (this.autoText && this.autoIndex >= this.autoText.length) {
                this.autoPlaying = false;
            }
            return;
        }

        this.autoTimer += dt;
        const interval = 60000 / this.autoBPM; // ms per character

        if (this.autoTimer >= interval) {
            this.autoTimer -= interval;

            const char = this.autoText[this.autoIndex];
            const state = this.getState();

            if (char === '\n') {
                this.text.checkWord(state);
                this.text.newLine();
            } else if (char === ' ') {
                this.text.addLetter(' ', state);
                this.text.checkWord(state);
            } else {
                this.text.addLetter(char, state);
                this.text.wordBuffer += char.toLowerCase();
                this.sound.onKey({ key: char }, this.weather);
            }

            this.autoIndex++;
        }
    }

    loop(timestamp) {
        if (!this.running) return;
        const dt = Math.min(timestamp - this.lastTime, 50);
        this.lastTime = timestamp;

        const state = this.getState();
        const w = window.innerWidth;
        const h = window.innerHeight;
        const hour = this.weather.getCurrentHour();

        // Update
        this.weather.update(dt, state);
        this.wind.update(dt, state);
        this.modes.update(dt, state);
        this.text.update(dt, state);
        this.particles.update(dt, state);
        this.grass.update(dt, state);
        this.rain.update(dt, state);
        this.lightning.update(dt, state);
        this.memory.update(dt, state);
        this.sound.update(dt, state);
        this.updateAutoTypewriter(dt);

        // Render
        this.ctx.save();
        this.sky.render(this.ctx, w, h, hour, this.weather);
        this.memory.render(this.ctx, w, h, state);
        this.grass.render(this.ctx, w, h, state);
        this.text.render(this.ctx, w, h, state);
        this.particles.render(this.ctx, w, h, state);
        this.rain.render(this.ctx, w, h, state);
        this.lightning.render(this.ctx, w, h, state);
        this.fog.render(this.ctx, w, h, state);
        this.cursor.render(this.ctx, w, h, hour);
        this.ctx.restore();

        requestAnimationFrame(this.loop);
    }
}

const app = new Text2Wind();
app.init().catch(err => console.error('Text2Wind init error:', err));
