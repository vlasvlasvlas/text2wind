/* ======================================
   TEXT2WIND — UI Controller
   ======================================
   Panels: Parameters (tabbed), Shortcuts,
   About. Floating bar with buttons.
   Auto-typewriter with BPM control.
   ====================================== */

import { CONFIG } from './config.js';

export class UI {
    constructor() {
        this.performanceMode = false;
        this.app = null;
    }

    init(state, weather, sound, app) {
        this.weather = weather;
        this.sound = sound;
        this.app = app;

        // ── Panel close buttons ──
        document.querySelectorAll('.panel-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelId = btn.dataset.close;
                document.getElementById(panelId)?.classList.add('hidden');
            });
        });

        // ── Floating buttons ──
        this.wireButton('btn-controls', () => this.togglePanel('controls'));
        this.wireButton('btn-shortcuts', () => this.togglePanel('panel-shortcuts'));
        this.wireButton('btn-about', () => this.togglePanel('panel-about'));
        this.wireButton('btn-fullscreen', () => this.toggleFullscreen());

        this.wireButton('btn-sound', async () => {
            const on = await sound.toggle();
            document.getElementById('btn-sound').textContent = on ? '🔊' : '🔇';
        });

        this.wireButton('btn-capture', () => this.captureScreenshot(state.canvas));

        // ── Tabs ──
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Only switch tabs within the same panel
                const panel = tab.closest('.panel');
                panel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                panel.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab)?.classList.add('active');
            });
        });

        // ═══ ATMOSPHERE TAB ═══
        this.wireSlider('ctrl-wind', v => weather.set('wind', v));
        this.wireSlider('ctrl-wind-dir', v => weather.set('windDir', v), v => v + '°');
        this.wireSlider('ctrl-rain', v => weather.set('rain', v));
        this.wireSlider('ctrl-fog', v => weather.set('fog', v));
        this.wireSlider('ctrl-temp', v => weather.set('temperature', v), v => v + '°C');
        this.wireSlider('ctrl-storm', v => weather.set('storm', v));
        this.wireSlider('ctrl-hour', v => {
            weather.set('hourOverride', v < 0 ? -1 : v);
        }, v => v < 0 ? 'Auto' : `${Math.floor(v)}:${String(Math.floor((v % 1) * 60)).padStart(2, '0')}`);

        // ── Text controls ──
        this.wireSlider('ctrl-persist', v => {
            CONFIG.TEXT.LIFE_MIN = v * 1000;
            CONFIG.TEXT.LIFE_MAX = v * 2000;
        }, v => v + 's');

        this.wireSlider('ctrl-explosion', v => {
            CONFIG.TEXT.PARTICLES_PER_LETTER = v;
        }, v => v);

        this.wireSlider('ctrl-ink-hue', v => {
            CONFIG.TEXT._hueOverride = v; // 0 = auto
        }, v => v === 0 ? 'Auto' : v + '°');

        this.wireSelect('ctrl-font', v => {
            CONFIG.TEXT.FONT_FAMILY = v;
        });

        this.wireSlider('ctrl-font-size', v => {
            CONFIG.TEXT.FONT_SIZE = v;
            CONFIG.TEXT.LINE_HEIGHT = Math.round(v * 1.5);
        }, v => v + 'px');

        // ═══ RHYTHM TAB ═══
        this.wireToggle('ctrl-rhythm-mute', checked => sound.setParam('rhythm', 'muted', !checked));
        this.wireSlider('ctrl-rhythm-vol', v => sound.setParam('rhythm', 'volume', v), v => v + ' dB');
        this.wireSlider('ctrl-rhythm-attack', v => sound.setParam('rhythm', 'attack', v), v => v.toFixed(3));
        this.wireSlider('ctrl-rhythm-decay', v => sound.setParam('rhythm', 'decay', v), v => v.toFixed(2));
        this.wireSlider('ctrl-rhythm-release', v => sound.setParam('rhythm', 'release', v), v => v.toFixed(2));
        this.wireToggle('ctrl-wind-mute', checked => sound.setParam('wind', 'muted', !checked));
        this.wireSlider('ctrl-wind-vol', v => sound.setParam('wind', 'volume', v), v => v + ' dB');

        // ═══ DRONE TAB ═══
        this.wireToggle('ctrl-drone-mute', checked => sound.setParam('drone', 'muted', !checked));
        this.wireSlider('ctrl-drone-vol', v => sound.setParam('drone', 'volume', v), v => v + ' dB');
        this.wireSlider('ctrl-drone-filter', v => sound.setParam('drone', 'filterFreq', v), v => v + ' Hz');
        this.wireSlider('ctrl-drone-attack', v => sound.setParam('drone', 'attack', v), v => v.toFixed(1) + 's');
        this.wireSlider('ctrl-drone-release', v => sound.setParam('drone', 'release', v), v => v.toFixed(1) + 's');
        this.wireSelect('ctrl-drone-wave', v => sound.setParam('drone', 'waveform', v));

        // ═══ MELODY TAB ═══
        this.wireToggle('ctrl-melody-mute', checked => sound.setParam('melody', 'muted', !checked));
        this.wireSlider('ctrl-melody-vol', v => sound.setParam('melody', 'volume', v), v => v + ' dB');
        this.wireSelect('ctrl-melody-mode', v => sound.setParam('melody', 'mode', v));
        this.wireSelect('ctrl-melody-wave', v => sound.setParam('melody', 'waveform', v));
        this.wireSlider('ctrl-melody-attack', v => sound.setParam('melody', 'attack', v), v => v.toFixed(3));
        this.wireSlider('ctrl-melody-decay', v => sound.setParam('melody', 'decay', v), v => v.toFixed(2));
        this.wireSlider('ctrl-melody-release', v => sound.setParam('melody', 'release', v), v => v.toFixed(1));
        this.wireSlider('ctrl-melody-reverb', v => sound.setParam('melody', 'reverb', v), v => v.toFixed(2));

        // ═══ AUTO-TYPEWRITER ═══
        this.wireFileImport();
        this.wireSlider('ctrl-auto-bpm', v => {
            if (this.app) this.app.setAutoBPM(v);
        }, v => v + ' BPM');

        this.wireButton('btn-auto-play', () => {
            if (!this.app) return;
            const playing = this.app.toggleAutoPlay();
            const btn = document.getElementById('btn-auto-play');
            if (btn) btn.textContent = playing ? '⏸ Pausar' : '▶ Reproducir';
        });

        this.wireButton('btn-auto-stop', () => {
            if (!this.app) return;
            this.app.stopAutoPlay();
            const btn = document.getElementById('btn-auto-play');
            if (btn) btn.textContent = '▶ Reproducir';
            const status = document.getElementById('auto-status');
            if (status) status.textContent = 'Sin archivo';
        });

        // ── Clock ──
        this.startClock();
    }

    wireButton(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    wireSlider(id, onChange, formatValue) {
        const slider = document.getElementById(id);
        const display = document.querySelector(`[data-for="${id}"]`);
        if (!slider) return;
        const update = () => {
            const v = parseFloat(slider.value);
            onChange(v);
            if (display) display.textContent = formatValue ? formatValue(v) : v;
        };
        slider.addEventListener('input', update);
        update();
    }

    wireToggle(id, onChange) {
        const cb = document.getElementById(id);
        if (cb) cb.addEventListener('change', () => onChange(cb.checked));
    }

    wireSelect(id, onChange) {
        const sel = document.getElementById(id);
        if (sel) sel.addEventListener('change', () => onChange(sel.value));
    }

    wireFileImport() {
        const fileInput = document.getElementById('file-import');
        const btn = document.getElementById('btn-file-import');
        if (!fileInput || !btn) return;

        btn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                if (this.app) {
                    this.app.loadAutoText(text);
                    const status = document.getElementById('auto-status');
                    if (status) status.textContent = `${file.name} (${text.length} chars)`;
                    const playBtn = document.getElementById('btn-auto-play');
                    if (playBtn) playBtn.textContent = '⏸ Pausar';
                }
            };
            reader.readAsText(file, 'UTF-8');
        });
    }

    togglePanel(id) {
        const panel = document.getElementById(id);
        if (!panel) return;

        // Close other panels
        document.querySelectorAll('.panel').forEach(p => {
            if (p.id !== id) p.classList.add('hidden');
        });

        panel.classList.toggle('hidden');
    }

    closeAllPanels() {
        document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    }

    startClock() {
        const clockEl = document.getElementById('clock');
        if (!clockEl) return;
        const update = () => {
            const now = new Date();
            clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        };
        update();
        setInterval(update, 1000);
    }

    togglePerformanceMode() {
        this.performanceMode = !this.performanceMode;
        const els = ['controls', 'panel-shortcuts', 'panel-about', 'clock'];
        const bar = document.querySelector('.floating-bar');

        if (this.performanceMode) {
            els.forEach(id => document.getElementById(id)?.classList.add('hidden'));
            if (bar) bar.style.display = 'none';
            document.documentElement.requestFullscreen?.().catch(() => { });
        } else {
            if (bar) bar.style.display = '';
            document.getElementById('clock')?.classList.remove('hidden');
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { });
        }
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => { });
        } else {
            document.documentElement.requestFullscreen?.().catch(() => { });
        }
    }

    captureScreenshot(canvas) {
        const link = document.createElement('a');
        link.download = `text2wind_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}
