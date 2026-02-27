/* ======================================
   TEXT2WIND — Semantic Engine
   ======================================
   Loads the pre-generated dictionary 
   and special words. Looks up typed  
   words and returns environmental effects.
   ====================================== */

export class SemanticEngine {
    constructor() {
        this.dictionary = {};
        this.specialWords = {};
        this.poles = {};
        this.loaded = false;
    }

    async load() {
        try {
            const [dictRes, specialRes] = await Promise.all([
                fetch('./data/semantic_dict.json'),
                fetch('./data/special_words.json'),
            ]);

            if (dictRes.ok) {
                const data = await dictRes.json();
                const rawDict = data.words || {};
                this.poles = data.poles || {};

                // Normalize dictionary keys to ignore accents
                for (const [key, val] of Object.entries(rawDict)) {
                    const normKey = this.normalizeWord(key);
                    this.dictionary[normKey] = val;
                }
                console.log(`📖 Semantic dict: ${Object.keys(this.dictionary).length} words`);
            }

            if (specialRes.ok) {
                const rawSpecial = await specialRes.json();

                // Normalize special words
                for (const [key, val] of Object.entries(rawSpecial)) {
                    const normKey = this.normalizeWord(key);
                    this.specialWords[normKey] = val;
                }
                console.log(`⭐ Special words: ${Object.keys(this.specialWords).length}`);
            }

            this.loaded = true;
        } catch (err) {
            console.warn('⚠️ Could not load semantic dictionary:', err.message);
            console.log('   The experience will work without word recognition.');
        }
    }

    normalizeWord(str) {
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    /**
     * Look up a word. Returns { effects, special? } or null.
     */
    lookup(word) {
        if (!this.loaded) return null;

        const w = this.normalizeWord(word);
        if (w.length < 2) return null;

        const result = {};

        // Check dictionary
        const entry = this.dictionary[w];
        if (entry) {
            result.effects = entry.effects;
            result.poles = entry.poles;
        }

        // Check special words
        const special = this.specialWords[w];
        if (special) {
            result.special = special;
            if (!result.effects) result.effects = {};
        }

        return (result.effects || result.special) ? result : null;
    }
}
