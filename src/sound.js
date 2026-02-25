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

import { clamp, lerp } from './utils/math.js';

// ── Musical scales ──
const SCALES = {
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

// ── QWERTY piano mapping ──
// Bottom row (ZXCV...) = C3-B3, Middle row (ASDF...) = C4-B4, Top row (QWER...) = C5-B5
const PIANO_MAP = {
    // Lower octave (C3 = MIDI 48)
    'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52, 'v': 53, 'g': 54,
    'b': 55, 'h': 56, 'n': 57, 'j': 58, 'm': 59,
    // Middle octave (C4 = MIDI 60)
    'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64, 'r': 65, '5': 66,
    't': 67, '6': 68, 'y': 69, '7': 70, 'u': 71,
    // Upper octave (C5 = MIDI 72)
    'i': 72, '9': 73, 'o': 74, '0': 75, 'p': 76,
};

// ── Hour → root note mapping ──
const HOUR_ROOTS = {
    0: 'C2', 4: 'D2', 6: 'E2', 8: 'G2',
    12: 'A2', 16: 'F2', 18: 'E2', 20: 'D2', 22: 'C2',
};

// ── Waveform presets ──
const RHYTHM_WAVES = ['membrane', 'metal', 'noise'];
const MELODY_WAVES = ['triangle', 'sine', 'square', 'sawtooth', 'fmsine'];
const DRONE_WAVES = ['sine', 'triangle', 'fatsine', 'fatsawtooth'];

export class SoundEngine {
    constructor() {
        this.initialized = false;
        this.enabled = false;
        this.Tone = null;

        // Layer params (controllable from UI)
        this.params = {
            rhythm: {
                volume: -14, muted: false,
                waveform: 'membrane',  // membrane | metal | noise
                attack: 0.002, decay: 0.15, release: 0.1,
            },
            drone: {
                volume: -22, muted: false,
                waveform: 'sine',
                attack: 4, release: 6,
                filterFreq: 400,
            },
            melody: {
                volume: -16, muted: false,
                waveform: 'triangle',
                attack: 0.05, decay: 0.6, release: 1.5,
                mode: 'random', // 'random' | 'piano'
                reverb: 0.35,
            },
            wind: {
                volume: -35, muted: false,
            },
        };

        // Current musical state
        this.currentScale = 'pentatonic';
        this.droneFreq = 65.41;
        this.lastNoteTime = 0;
        this.noteIndex = 0;

        // Tone.js nodes
        this.rhythmSynth = null;
        this.rhythmNoiseSynth = null;
        this.droneSynth = null;
        this.droneFilter = null;
        this.melodySynth = null;
        this.windNoise = null;
        this.windGain = null;
        this.masterGain = null;
        this.reverb = null;
        this.delay = null;
        this.thunderSynth = null;
        this.rainSynth = null;
    }

    async init() {
        try {
            this.Tone = await import('tone');
        } catch (e) {
            console.warn('⚠️ Tone.js not available, sound disabled');
            return;
        }
    }

    async enable() {
        if (!this.Tone) {
            await this.init();
            if (!this.Tone) return;
        }

        const Tone = this.Tone;
        await Tone.start();

        // Master FX chain
        this.reverb = new Tone.Reverb({ decay: 6, wet: this.params.melody.reverb }).toDestination();
        this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.15 }).connect(this.reverb);
        this.masterGain = new Tone.Gain(0.8).connect(this.delay);

        // ─── LAYER 1: RHYTHM ───
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

        // ─── LAYER 2: DRONE ───
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
        this.startDrone();

        // Wind noise
        this.windNoise = new Tone.Noise('brown').start();
        this.windFilter = new Tone.AutoFilter({
            frequency: 0.15, baseFrequency: 60, octaves: 3,
        }).connect(this.masterGain).start();
        this.windGain = new Tone.Gain(Tone.dbToGain(this.params.wind.volume)).connect(this.windFilter);
        this.windNoise.connect(this.windGain);

        // ─── LAYER 3: MELODY ───
        this.melodySynth = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 8,
            voice0: {
                oscillator: { type: this.params.melody.waveform + '8' },
                envelope: { attack: this.params.melody.attack, decay: this.params.melody.decay, sustain: 0.15, release: this.params.melody.release },
                volume: this.params.melody.volume,
            },
        }).connect(this.masterGain);

        // Thunder + Rain
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
        this.enabled = true;
        console.log('🔊 Sound: 3 layers active (rhythm + drone + melody)');
    }

    startDrone() {
        if (!this.droneSynth || !this.Tone || this.params.drone.muted) return;
        try {
            const root = this.Tone.Frequency(this.droneFreq).toNote();
            const fifth = this.Tone.Frequency(this.droneFreq * 1.5).toNote();
            this.droneSynth.triggerAttack([root, fifth]);
        } catch (e) { }
    }

    // ── Parameter updates from UI ──

    setParam(layer, param, value) {
        if (!this.params[layer]) return;
        this.params[layer][param] = value;
        this.applyParams(layer);
    }

    applyParams(layer) {
        if (!this.initialized || !this.Tone) return;

        switch (layer) {
            case 'rhythm':
                if (this.rhythmSynth) {
                    this.rhythmSynth.volume.value = this.params.rhythm.muted ? -Infinity : this.params.rhythm.volume;
                }
                if (this.rhythmNoiseSynth) {
                    this.rhythmNoiseSynth.volume.value = this.params.rhythm.muted ? -Infinity : this.params.rhythm.volume - 8;
                }
                break;
            case 'drone':
                if (this.droneSynth) {
                    this.droneSynth.volume.value = this.params.drone.muted ? -Infinity : this.params.drone.volume;
                    if (this.droneFilter) {
                        this.droneFilter.frequency.rampTo(this.params.drone.filterFreq, 1);
                    }
                }
                break;
            case 'melody':
                if (this.melodySynth) {
                    this.melodySynth.volume.value = this.params.melody.muted ? -Infinity : this.params.melody.volume;
                }
                break;
            case 'wind':
                if (this.windGain) {
                    const vol = this.params.wind.muted ? -80 : this.params.wind.volume;
                    this.windGain.gain.rampTo(this.Tone.dbToGain(vol), 0.3);
                }
                break;
        }
    }

    disable() {
        this.enabled = false;
        if (this.droneSynth) {
            try { this.droneSynth.releaseAll(); } catch (e) { }
        }
    }

    toggle() {
        if (this.enabled) { this.disable(); return false; }
        else { this.enable(); return true; }
    }

    // ── Key input → Melody layer ──

    onKey(e, weather) {
        if (!this.enabled || !this.melodySynth) return;
        const key = e.key;
        if (key.length !== 1) return;
        if (key === ' ') return; // Space = typing only, no sound
        if (this.params.melody.muted) return;

        let midiNote;

        if (this.params.melody.mode === 'piano') {
            // QWERTY piano layout
            midiNote = PIANO_MAP[key.toLowerCase()];
            if (midiNote === undefined) return; // Not a piano key
        } else {
            // Random/scale-based mapping
            const scale = SCALES[this.currentScale];
            const charCode = key.toLowerCase().charCodeAt(0);
            const scaleIndex = charCode % scale.length;
            const octaveOffset = Math.floor((charCode % 26) / scale.length);
            midiNote = 60 + scale[scaleIndex] + octaveOffset * 12;
        }

        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
        try {
            const note = this.Tone.Frequency(freq).toNote();
            this.melodySynth.triggerAttackRelease(note, '8n');
        } catch (err) { }

        // Rhythm tick on keystroke
        if (!this.params.rhythm.muted) {
            const now = Date.now();
            if (now - this.lastNoteTime > 50) {
                try { this.rhythmNoiseSynth.triggerAttackRelease('32n'); } catch (err) { }
                this.lastNoteTime = now;
            }
        }

        this.noteIndex++;
    }

    // ── Letter erosion → Rhythm layer ──

    onLetterErosion(letter) {
        if (!this.enabled || !this.rhythmSynth || this.params.rhythm.muted) return;

        const scale = SCALES[this.currentScale];
        const charCode = (letter.char || 'a').toLowerCase().charCodeAt(0);
        const scaleIndex = charCode % scale.length;
        const midiNote = 36 + scale[scaleIndex];
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

        try {
            this.rhythmSynth.triggerAttackRelease(freq, '16n');
        } catch (err) { }
    }

    playThunder(intensity) {
        if (!this.enabled || !this.thunderSynth) return;
        try {
            this.thunderSynth.volume.value = -12 + intensity * 8;
            this.thunderSynth.triggerAttackRelease('2n');
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
                setTimeout(() => this.startDrone(), 100);
            } catch (e) { }
        }

        // Filter responds to temperature
        const temp = weather.get('temperature');
        const baseFilter = this.params.drone.filterFreq;
        const tempFilter = lerp(Math.max(baseFilter * 0.3, 100), baseFilter, clamp((temp + 10) / 55, 0, 1));
        if (this.droneFilter) {
            this.droneFilter.frequency.rampTo(tempFilter, 2);
        }

        // Storm resonance
        const storm = weather.get('storm') / 100;
        if (this.droneFilter) {
            this.droneFilter.Q.rampTo(storm * 8, 1);
        }
    }

    update(dt, state) {
        if (!this.enabled || !this.initialized) return;

        const weather = state.weather;
        const windIntensity = weather.get('wind') / 100;
        const rainIntensity = weather.get('rain') / 100;
        const hour = weather.getCurrentHour();

        this.updateDrone(hour, weather);

        // Wind noise volume (combined with wind.muted)
        if (this.windGain && this.Tone && !this.params.wind.muted) {
            const baseVol = this.params.wind.volume;
            const windVol = baseVol + windIntensity * 15;
            this.windGain.gain.rampTo(this.Tone.dbToGain(windVol), 0.5);
        }

        // Rain drops
        if (rainIntensity > 0.1 && this.rainSynth && !this.params.rhythm.muted) {
            if (Math.random() < rainIntensity * 0.04) {
                try { this.rainSynth.triggerAttackRelease('64n'); } catch (err) { }
            }
        }

        // Scale shifts with weather
        const storm = weather.get('storm') / 100;
        const temp = weather.get('temperature');
        if (storm > 0.5) this.currentScale = 'phrygian';
        else if (temp < 5) this.currentScale = 'aeolian';
        else if (temp > 30) this.currentScale = 'lydian';
        else this.currentScale = 'pentatonic';
    }
}
