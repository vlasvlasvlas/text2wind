/* ======================================
   TEXT2WIND — Configuration
   ====================================== */

export const CONFIG = {
    // Canvas
    PIXEL_RATIO: Math.min(window.devicePixelRatio, 2),

    // Sky color palettes keyed by hour ranges
    SKY_PALETTES: [
        { hour: 0, top: [0.02, 0.02, 0.06], bottom: [0.04, 0.03, 0.10] },  // Midnight
        { hour: 4, top: [0.04, 0.04, 0.14], bottom: [0.08, 0.06, 0.18] },  // Pre-dawn
        { hour: 5.5, top: [0.12, 0.08, 0.22], bottom: [0.40, 0.18, 0.25] },  // Dawn start
        { hour: 6.5, top: [0.30, 0.25, 0.50], bottom: [0.85, 0.45, 0.25] },  // Dawn golden
        { hour: 8, top: [0.35, 0.55, 0.85], bottom: [0.65, 0.75, 0.90] },  // Morning
        { hour: 12, top: [0.42, 0.62, 0.92], bottom: [0.70, 0.82, 0.95] },  // Noon
        { hour: 16, top: [0.40, 0.55, 0.82], bottom: [0.75, 0.70, 0.65] },  // Afternoon
        { hour: 18, top: [0.30, 0.20, 0.50], bottom: [0.90, 0.40, 0.20] },  // Sunset
        { hour: 19.5, top: [0.15, 0.08, 0.35], bottom: [0.50, 0.15, 0.30] },  // Dusk
        { hour: 21, top: [0.04, 0.03, 0.12], bottom: [0.08, 0.05, 0.16] },  // Night
        { hour: 24, top: [0.02, 0.02, 0.06], bottom: [0.04, 0.03, 0.10] },  // Midnight wrap
    ],

    // Text
    TEXT: {
        FONT_FAMILY: "'JetBrains Mono', monospace",
        FONT_SIZE: 28,
        LINE_HEIGHT: 42,
        MAX_CHARS_PER_LINE: 60,
        MAX_LINES: 20,
        INK_COLOR_DAY: [0.15, 0.12, 0.10],
        INK_COLOR_NIGHT: [0.85, 0.80, 0.72],
        BIRTH_DURATION: 400,       // ms for letter to "draw" itself
        LIFE_MIN: 8000,            // ms minimum before erosion begins
        LIFE_MAX: 25000,           // ms random extra life
        EROSION_DURATION: 4000,    // ms for full erosion
        PARTICLES_PER_LETTER: 60,
    },

    // Wind
    WIND: {
        DEFAULT_INTENSITY: 20,
        DEFAULT_DIRECTION: 90,     // degrees, 0=up, 90=right
        NOISE_SCALE: 0.003,
        NOISE_SPEED: 0.0004,
        TURBULENCE_OCTAVES: 3,
    },

    // Particles
    PARTICLES: {
        MAX_COUNT: 10000,
        DEFAULT_LIFE: 4000,
        MIN_SIZE: 1,
        MAX_SIZE: 4,
        GRAVITY: 0.02,
    },

    // Weather
    WEATHER: {
        TRANSITION_SPEED: 0.005,   // interpolation speed per frame
        RAIN_MAX_DROPS: 2000,
        SNOW_MAX_FLAKES: 1000,
    },

    // Sound
    SOUND: {
        MASTER_VOLUME: -12,        // dB
        DRONE_VOLUME: -20,
        KEY_VOLUME: -18,
        WIND_VOLUME: -24,
        RAIN_VOLUME: -20,
    },

    // Cursor / Candle
    CURSOR: {
        LIGHT_RADIUS: 120,         // px — protection radius
        GLOW_COLOR: [1.0, 0.85, 0.55],
        GLOW_INTENSITY: 0.6,
    },

    // Grass
    GRASS: {
        IDLE_THRESHOLD: 30000,     // ms before grass starts growing
        GROWTH_SPEED: 0.001,
        MAX_BLADES: 500,
        BLADE_HEIGHT_MIN: 8,
        BLADE_HEIGHT_MAX: 30,
        COLOR: [0.25, 0.55, 0.20],
    },

    // Modes
    MODES: {
        WRITER_WPM_THRESHOLD: 5,
        STORM_WPM_THRESHOLD: 60,
        CONTEMPLATOR_IDLE: 5000,    // ms idle to enter contemplator
    },
};
