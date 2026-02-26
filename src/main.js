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
        this.autoBPM = 120;
        this.autoPlaying = false;

        this.resize = this.resize.bind(this);
        this.loop = this.loop.bind(this);
        this.onKey = this.onKey.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
    }

    async init() {
        this.resize();
        window.addEventListener('resize', this.resize);
        await this.semantic.load();

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

        // Canvas click
        this.canvas.addEventListener('click', e => {
            if (!this.started) { this.startApp(); return; }
            if (e.target !== this.canvas) return;
            this.text.onCanvasClick(e.clientX, e.clientY, this.getState());
        });

        // Intro
        document.getElementById('intro').addEventListener('click', () => this.startApp());

        // Paste (Ctrl+V)
        window.addEventListener('paste', e => {
            if (!this.started) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
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
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop);

            // Auto-enable sound (browser allows audio after user click)
            this.sound.toggle().then(on => {
                const btn = document.getElementById('btn-sound');
                if (btn) btn.textContent = on ? '🔊' : '🔇';
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

        this.text.onKey(e, this.getState());
        this.modes.onKey(e);
        this.sound.onKey(e, this.weather);
    }

    onMouseMove(e) {
        this.cursor.update(e.clientX, e.clientY);
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
