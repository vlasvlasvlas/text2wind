/* ======================================
   TEXT2WIND — Sound Engine (3 Layers)
   ======================================
   Layer 1: RHYTHM — Eroding letters
     produce percussive drops/clicks
   Layer 2: DRONE — Continuous tone tied
     to hour, temperature, weather
   Layer 3: MELODY — Two modes:
     - "random": scale-based from char
     - "piano": QWERTY mapped as keyboard

   All layers independently parametrizable
   (volume, mute, waveform, attack/release)
   ====================================== */

import { CONFIG } from './config.js';
import { clamp, lerp } from './utils/math.js';

const SCALES = {
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const SCALE_LABELS = {
    aeolian: 'Menor Natural (Eólica)',
    dorian: 'Dórica',
    pentatonic: 'Pentatónica',
    phrygian: 'Frigia',
    lydian: 'Lidia',
    chromatic: 'Cromática',
};

const PIANO_MAP = {
    'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52, 'v': 53, 'g': 54,
    'b': 55, 'h': 56, 'n': 57, 'j': 58, 'm': 59,
    'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64, 'r': 65, '5': 66,
    't': 67, '6': 68, 'y': 69, '7': 70, 'u': 71,
    'i': 72, '9': 73, 'o': 74, '0': 75, 'p': 76,
};

const WEATHER_SCALE_MAP = {
    default: 'pentatonic',
    storm: 'phrygian',
    cold: 'aeolian',
    hot: 'lydian',
};

const HOUR_ROOTS = {
    0: 'C2', 4: 'D2', 6: 'E2', 8: 'G2',
    12: 'A2', 16: 'F2', 18: 'E2', 20: 'D2', 22: 'C2',
};

export class SoundEngine {
    constructor() {
        this.initialized = false;
        this.enabled = false;
        this.Tone = null;
        this.initPromise = null;
        const runtimeSound = CONFIG.DEFAULTS?.sound || {};
        const runtimeLayers = runtimeSound.layers || {};

        this.params = {
            rhythm: {
                volume: -14, muted: false,
                waveform: 'membrane',
                attack: 0.002, decay: 0.15, release: 0.1,
                ...(runtimeLayers.rhythm || {}),
            },
            drone: {
                volume: -22, muted: false,
                waveform: 'sine',
                attack: 4, release: 6,
                filterFreq: 400,
                ...(runtimeLayers.drone || {}),
            },
            melody: {
                volume: -16, muted: false,
                waveform: 'triangle',
                attack: 0.005, decay: 0.6, release: 1.5,
                mode: 'random',
                reverb: 0.35,
                ...(runtimeLayers.melody || {}),
            },
            wind: {
                volume: -35, muted: false,
                ...(runtimeLayers.wind || {}),
            },
        };

        this.masterLevel = CONFIG.SOUND?.MASTER_LINEAR ?? 0.8;
        this.scaleMode = runtimeSound.scaleMode || 'auto';
        this.scalesLoaded = false;
        this.scalesData = Object.fromEntries(
            Object.entries(SCALES).map(([key, notes]) => [key, { label: SCALE_LABELS[key] || key, notes }])
        );
        const initialScale = runtimeSound.initialScale || 'pentatonic';
        this.currentScale = this.scalesData[initialScale] ? initialScale : 'pentatonic';
        this.pianoMap = { ...PIANO_MAP };
        this.weatherScaleMap = { ...WEATHER_SCALE_MAP };
        this.droneFreq = 65.41;
        this.lastNoteTime = 0;
        this.noteIndex = 0;

        this.rhythmSynth = null;
        this.rhythmNoiseSynth = null;
        this.droneSynth = null;
        this.droneFilter = null;
        this.melodySynth = null;
        this.windNoise = null;
        this.windGain = null;
        this.melodyDryGain = null;
        this.melodyFxSendGain = null;
        this.masterGain = null;
        this.reverb = null;
        this.delay = null;
        this.thunderSynth = null;
        this.rainSynth = null;
    }

    async init() {
        if (this.Tone) {
            return;
        }
        if (this.initPromise) {
            await this.initPromise;
            return;
        }

        this.initPromise = (async () => {
            try {
                this.Tone = await import('tone');

                // Lowest practical scheduling delay for interactive typing.
                this._tuneAudioContextForRealtime();

                // Async config load; never block audio startup.
                void this.loadScales();
            } catch (e) {
                console.warn('⚠️ Tone.js not available, sound disabled');
                this.Tone = null;
                this.scalesLoaded = true;
            } finally {
                this.initPromise = null;
            }
        })();

        await this.initPromise;
    }

    async loadScales() {
        if (this.scalesLoaded) return;
        try {
            const resp = await fetch('/data/scales.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.scales) this.scalesData = data.scales;
            if (data.pianoMappings?.default?.keys) this.pianoMap = data.pianoMappings.default.keys;
            if (data.weatherScaleMap) this.weatherScaleMap = data.weatherScaleMap;
            const preferredScale = this.scaleMode === 'auto' ? this.currentScale : this.scaleMode;
            if (preferredScale && this.scalesData[preferredScale]) {
                this.currentScale = preferredScale;
            }
        } catch (e) {
            // Keep fallbacks silently for performance path.
        } finally {
            this.scalesLoaded = true;
        }
    }

    buildAudioGraph() {
        if (!this.Tone || this.initialized) return;

        const Tone = this.Tone;

        this.reverb = new Tone.Reverb({ decay: 6, wet: this.params.melody.reverb }).toDestination();
        this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.15 }).connect(this.reverb);
        this.masterGain = new Tone.Gain(0).toDestination();
        this.masterGain.connect(this.delay);
        // Zero-latency dry path for typed notes.
        this.melodyDryGain = new Tone.Gain(0).toDestination();
        this.melodyFxSendGain = new Tone.Gain(0).connect(this.masterGain);

        this.rhythmSynth = new Tone.MembraneSynth({
            pitchDecay: 0.08, octaves: 3,
            envelope: { attack: this.params.rhythm.attack, decay: this.params.rhythm.decay, sustain: 0, release: this.params.rhythm.release },
            volume: this.params.rhythm.volume,
        }).connect(this.masterGain);

        this.rhythmNoiseSynth = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
            volume: this.params.rhythm.volume - 8,
        }).connect(this.masterGain);

        this.droneFilter = new Tone.Filter({
            frequency: this.params.drone.filterFreq,
            type: 'lowpass', rolloff: -24,
        }).connect(this.masterGain);

        this.droneSynth = new Tone.PolySynth(Tone.FMSynth, {
            maxPolyphony: 4,
            voice0: {
                harmonicity: 1.5, modulationIndex: 0.8,
                oscillator: { type: this.params.drone.waveform },
                envelope: { attack: this.params.drone.attack, decay: 1, sustain: 0.8, release: this.params.drone.release },
                modulation: { type: 'triangle' },
                modulationEnvelope: { attack: 3, decay: 0.5, sustain: 0.7, release: 5 },
                volume: this.params.drone.volume,
            },
        }).connect(this.droneFilter);

        this.windNoise = new Tone.Noise('brown').start();
        this.windFilter = new Tone.AutoFilter({
            frequency: 0.15, baseFrequency: 60, octaves: 3,
        }).connect(this.masterGain).start();
        this.windGain = new Tone.Gain(Tone.dbToGain(this.params.wind.volume)).connect(this.windFilter);
        this.windNoise.connect(this.windGain);

        this.melodySynth = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 8,
            voice0: {
                oscillator: { type: this.params.melody.waveform + '8' },
                envelope: { attack: this.params.melody.attack, decay: this.params.melody.decay, sustain: 0.15, release: this.params.melody.release },
                volume: this.params.melody.volume,
            },
        });
        this.melodySynth.connect(this.melodyDryGain);
        this.melodySynth.connect(this.melodyFxSendGain);

        this.thunderSynth = new Tone.NoiseSynth({
            noise: { type: 'brown' },
            envelope: { attack: 0.02, decay: 2, sustain: 0, release: 1 },
            volume: -8,
        }).connect(this.reverb);

        this.rainSynth = new Tone.MetalSynth({
            frequency: 1200,
            envelope: { attack: 0.001, decay: 0.015, release: 0.01 },
            harmonicity: 15, modulationIndex: 30, volume: -28,
        }).connect(this.masterGain);

        this.initialized = true;
        this.applyAllParams();
    }

    getAvailableScales() {
        return Object.entries(this.scalesData).map(([key, scale]) => ({
            key,
            label: scale?.label || SCALE_LABELS[key] || key,
        }));
    }

    setScale(scaleName) {
        this.scaleMode = scaleName;
        if (scaleName !== 'auto' && this.scalesData[scaleName]) {
            this.currentScale = scaleName;
        }
    }

    _tuneAudioContextForRealtime() {
        if (!this.Tone) return;
        const contexts = [this.Tone.getContext?.(), this.Tone.context].filter(Boolean);
        for (const ctx of contexts) {
            try { ctx.lookAhead = 0; } catch (e) { }
            try { ctx.updateInterval = 0.01; } catch (e) { }
            try { ctx.latencyHint = 'interactive'; } catch (e) { }
        }
    }

    _getMelodyFxSend() {
        if (this.params.melody.muted) return 0;
        return clamp(this.params.melody.reverb * 0.2, 0, 0.25);
    }

    _now() {
        return this.Tone?.immediate ? this.Tone.immediate() : undefined;
    }

    _getScale(scaleName) {
        const scale = this.scalesData[scaleName];
        if (Array.isArray(scale)) return scale;
        return scale?.notes || SCALES.pentatonic;
    }

    primeFromGesture() {
        if (!this.Tone) return false;

        try {
            // iOS/WebKit is strict: call start() directly in gesture call stack.
            const startPromise = this.Tone.start?.();
            if (startPromise?.catch) startPromise.catch(() => { });
            this._tuneAudioContextForRealtime();
            if (!this.initialized) {
                this.buildAudioGraph();
            }

            this.enabled = true;
            if (this.masterGain) this.masterGain.gain.value = this.masterLevel;
            if (this.melodyDryGain) this.melodyDryGain.gain.value = this.params.melody.muted ? 0 : 1;
            if (this.melodyFxSendGain) this.melodyFxSendGain.gain.value = this._getMelodyFxSend();
            this.applyAllParams();
            if (!this.params.drone.muted) this.startDrone();

            return true;
        } catch (e) {
            return false;
        }
    }

    async enable() {
        await this.init();
        if (!this.Tone) return;

        await this.Tone.start();
        this._tuneAudioContextForRealtime();
        if (!this.initialized) {
            try {
                this.buildAudioGraph();
            } catch (e) {
                console.error('⚠️ Sound graph init failed', e);
                return;
            }
        }

        this.enabled = true;
        if (this.masterGain) this.masterGain.gain.value = this.masterLevel;
        if (this.melodyDryGain) this.melodyDryGain.gain.value = this.params.melody.muted ? 0 : 1;
        if (this.melodyFxSendGain) this.melodyFxSendGain.gain.value = this._getMelodyFxSend();
        if (!this.params.drone.muted) this.startDrone();
        this.applyAllParams();
    }

    startDrone() {
        if (!this.droneSynth || !this.Tone || this.params.drone.muted) return;
        try {
            const root = this.Tone.Frequency(this.droneFreq).toNote();
            const fifth = this.Tone.Frequency(this.droneFreq * 1.5).toNote();
            this.droneSynth.triggerAttack([root, fifth], this._now());
        } catch (e) { }
    }

    setParam(layer, param, value) {
        if (!this.params[layer]) return;
        const prevValue = this.params[layer][param];
        this.params[layer][param] = value;
        this.applyParams(layer);

        if (layer === 'drone' && param === 'muted' && prevValue !== value && this.droneSynth) {
            if (value) {
                try { this.droneSynth.releaseAll(); } catch (e) { }
            } else if (this.enabled) {
                this.startDrone();
            }
        }
    }

    applyAllParams() {
        this.applyParams('rhythm');
        this.applyParams('drone');
        this.applyParams('melody');
        this.applyParams('wind');
    }

    applyParams(layer) {
        if (!this.initialized || !this.Tone) return;

        switch (layer) {
            case 'rhythm':
                if (this.rhythmSynth) {
                    this.rhythmSynth.volume.value = this.params.rhythm.muted ? -Infinity : this.params.rhythm.volume;
                    try {
                        this.rhythmSynth.set({
                            envelope: {
                                attack: this.params.rhythm.attack,
                                decay: this.params.rhythm.decay,
                                release: this.params.rhythm.release,
                            },
                        });
                    } catch (e) { }
                }
                if (this.rhythmNoiseSynth) {
                    this.rhythmNoiseSynth.volume.value = this.params.rhythm.muted ? -Infinity : this.params.rhythm.volume - 8;
                }
                break;
            case 'drone':
                if (this.droneSynth) {
                    this.droneSynth.volume.value = this.params.drone.muted ? -Infinity : this.params.drone.volume;
                    try {
                        this.droneSynth.set({
                            voice0: {
                                oscillator: { type: this.params.drone.waveform },
                                envelope: {
                                    attack: this.params.drone.attack,
                                    release: this.params.drone.release,
                                },
                            },
                        });
                    } catch (e) { }
                }
                if (this.droneFilter) {
                    this.droneFilter.frequency.value = this.params.drone.filterFreq;
                }
                break;
            case 'melody':
                if (this.melodySynth) {
                    this.melodySynth.volume.value = this.params.melody.muted ? -Infinity : this.params.melody.volume;
                    try {
                        this.melodySynth.set({
                            voice0: {
                                oscillator: { type: this.params.melody.waveform + '8' },
                                envelope: {
                                    attack: this.params.melody.attack,
                                    decay: this.params.melody.decay,
                                    release: this.params.melody.release,
                                },
                            },
                        });
                    } catch (e) { }
                }
                if (this.reverb) {
                    this.reverb.wet.value = this.params.melody.reverb;
                }
                if (this.melodyDryGain) {
                    this.melodyDryGain.gain.value = this.params.melody.muted ? 0 : 1;
                }
                if (this.melodyFxSendGain) {
                    this.melodyFxSendGain.gain.value = this._getMelodyFxSend();
                }
                break;
            case 'wind':
                if (this.windGain) {
                    const vol = this.params.wind.muted ? -80 : this.params.wind.volume;
                    this.windGain.gain.value = this.Tone.dbToGain(vol);
                }
                break;
        }
    }

    disable() {
        this.enabled = false;
        if (this.masterGain) this.masterGain.gain.value = 0;
        if (this.melodyDryGain) this.melodyDryGain.gain.value = 0;
        if (this.melodyFxSendGain) this.melodyFxSendGain.gain.value = 0;
        if (this.droneSynth) {
            try { this.droneSynth.releaseAll(); } catch (e) { }
        }
        if (this.melodySynth) {
            try { this.melodySynth.releaseAll(); } catch (e) { }
        }
    }

    async toggle() {
        if (this.enabled) {
            this.disable();
            return false;
        }
        await this.enable();
        return this.enabled;
    }

    playGestureTone(index = 0, intensity = 0.5) {
        if (!this.enabled || !this.melodySynth || !this.Tone) return false;
        if (this.params.melody.muted) return false;

        const degrees = [0, 2, 4, 5, 7, 9, 11, 12];
        const octaveIndex = ((Math.round(index) % degrees.length) + degrees.length) % degrees.length;
        const midiNote = 60 + degrees[octaveIndex];
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
        const duration = 0.07 + clamp(intensity, 0, 1) * 0.09;
        try {
            this.melodySynth.triggerAttackRelease(freq, duration, this._now());
            return true;
        } catch (e) {
            return false;
        }
    }

    onKey(e, weather) {
        if (!this.enabled || !this.melodySynth || !this.Tone) return;
        const key = e.key;
        if (key.length !== 1) return;
        if (this.params.melody.muted) return;

        let midiNote;

        if (this.params.melody.mode === 'piano') {
            midiNote = this.pianoMap[key.toLowerCase()];
            if (midiNote === undefined) return;
        } else {
            const scale = this._getScale(this.currentScale);
            const charCode = key.toLowerCase().charCodeAt(0);
            const scaleIndex = charCode % scale.length;
            const octaveOffset = Math.floor((charCode % 26) / scale.length);
            midiNote = 60 + scale[scaleIndex] + octaveOffset * 12;
        }

        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
        try {
            this.melodySynth.triggerAttackRelease(freq, 0.12, this._now());
        } catch (err) { }

        if (!this.params.rhythm.muted && this.rhythmNoiseSynth) {
            const now = Date.now();
            if (now - this.lastNoteTime > 50) {
                try { this.rhythmNoiseSynth.triggerAttackRelease('32n', this._now()); } catch (err) { }
                this.lastNoteTime = now;
            }
        }

        this.noteIndex++;
    }

    onLetterErosion(letter) {
        if (!this.enabled || !this.rhythmSynth || this.params.rhythm.muted || !this.Tone) return;

        const scale = this._getScale(this.currentScale);
        const charCode = (letter.char || 'a').toLowerCase().charCodeAt(0);
        const scaleIndex = charCode % scale.length;
        const midiNote = 36 + scale[scaleIndex];
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

        try {
            this.rhythmSynth.triggerAttackRelease(freq, 0.08, this._now());
        } catch (err) { }
    }

    playThunder(intensity) {
        if (!this.enabled || !this.thunderSynth) return;
        try {
            this.thunderSynth.volume.value = -12 + intensity * 8;
            this.thunderSynth.triggerAttackRelease('2n', this._now());
        } catch (err) { }
    }

    updateDrone(hour, weather) {
        if (!this.droneSynth || !this.Tone || this.params.drone.muted) return;

        const hourKeys = Object.keys(HOUR_ROOTS).map(Number).sort((a, b) => a - b);
        let rootNote = HOUR_ROOTS[0];
        for (const h of hourKeys) {
            if (hour >= h) rootNote = HOUR_ROOTS[h];
        }
        const newFreq = this.Tone.Frequency(rootNote).toFrequency();

        if (Math.abs(this.droneFreq - newFreq) > 1) {
            this.droneFreq = newFreq;
            try {
                this.droneSynth.releaseAll();
                setTimeout(() => this.startDrone(), 40);
            } catch (e) { }
        }

        const temp = weather.get('temperature');
        const baseFilter = this.params.drone.filterFreq;
        const tempFilter = lerp(Math.max(baseFilter * 0.3, 100), baseFilter, clamp((temp + 10) / 55, 0, 1));
        if (this.droneFilter) {
            this.droneFilter.frequency.value = tempFilter;
        }

        const storm = weather.get('storm') / 100;
        if (this.droneFilter) {
            this.droneFilter.Q.value = storm * 8;
        }
    }

    update(dt, state) {
        if (!this.enabled || !this.initialized || !this.Tone) return;

        const weather = state.weather;
        const windIntensity = weather.get('wind') / 100;
        const rainIntensity = weather.get('rain') / 100;
        const hour = weather.getCurrentHour();

        this.updateDrone(hour, weather);

        if (this.windGain && !this.params.wind.muted) {
            const baseVol = this.params.wind.volume;
            const windVol = baseVol + windIntensity * 15;
            this.windGain.gain.value = this.Tone.dbToGain(windVol);
        }

        if (rainIntensity > 0.1 && this.rainSynth && !this.params.rhythm.muted) {
            if (Math.random() < rainIntensity * 0.04) {
                try { this.rainSynth.triggerAttackRelease('64n', this._now()); } catch (err) { }
            }
        }

        if (this.scaleMode === 'auto') {
            const storm = weather.get('storm') / 100;
            const temp = weather.get('temperature');
            const wm = this.weatherScaleMap;
            if (storm > 0.5) this.currentScale = wm.storm || 'phrygian';
            else if (temp < 5) this.currentScale = wm.cold || 'aeolian';
            else if (temp > 30) this.currentScale = wm.hot || 'lydian';
            else this.currentScale = wm.default || 'pentatonic';
        }
    }
}
