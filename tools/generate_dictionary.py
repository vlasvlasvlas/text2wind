#!/usr/bin/env python3
"""
Text2Wind — Semantic Dictionary Generator
==========================================

Generates a semantic dictionary that maps Spanish words to environmental
effects (weather, atmosphere, time) using word vector similarity from spaCy.

Inspired by Agnès Varda's "Les Glaneurs et la Glaneuse" (2000):
words become material to be gleaned, contemplated, and released to the wind.

Usage:
    # Generate full dictionary
    python generate_dictionary.py

    # Extend with custom words
    python generate_dictionary.py --extend --words "soledad,espiga,ceniza"

    # Use custom poles config
    python generate_dictionary.py --poles custom_poles.json

    # Test coverage
    python generate_dictionary.py --test

    # Verbose output
    python generate_dictionary.py -v
"""

import argparse
import json
import sys
import os
import time
from pathlib import Path

import numpy as np

try:
    import spacy
except ImportError:
    print("❌ spaCy not installed. Run: pip install spacy")
    print("   Then download model: python -m spacy download es_core_news_lg")
    sys.exit(1)


# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
DEFAULT_POLES_PATH = SCRIPT_DIR / "semantic_poles.json"
DEFAULT_OUTPUT_PATH = SCRIPT_DIR.parent / "data" / "semantic_dict.json"
DEFAULT_WORDLIST_PATH = SCRIPT_DIR / "wordlist_es.txt"

# A rich curated word list. These are words likely to be typed by a
# Spanish-speaking user in a poetic/contemplative context, plus common
# everyday words. The generator processes them through spaCy's pipeline
# to get vectors even for words not in the model's base vocab.
CURATED_WORDS = """
agua lluvia mar océano río lago gota charco inundación cascada arroyo manantial
rocío humedad vapor niebla llovizna torrente marea ola naufragio sumergir ahogar
sed playa costa profundidad corriente caudal estanque acequia riachuelo diluvio
fuego sol verano desierto fiebre calor llama ardiente incendio brasa horno
sofocante tropical lava ceniza candente quemar hervir sudor caliente calentar
llameante fogata hoguera lumbre volcán erupción fundir derretir abrasar
hielo nieve invierno frío escarcha glaciar congelar helado polar gélido tundra
blanco cristal témpano neblina aliento tiritar páramo ventisca avalancha
viento tormenta huracán ráfaga vendaval ciclón tornado brisa soplar tempestad
borrasca remolino turbulencia oleaje azote silbar rugir grito escape huida
correr caos aullar bramar relinchar explosión estallido estruendo trueno
paz calma reposo jardín respirar lento musgo tranquilo sereno quietud silencio
meditación contemplar descanso suave tibio armonía equilibrio pluma suspiro
cuna abrazo caricia espera pausa paciencia ternura dulzura suavidad delicado
noche sombra oscuro oscuridad olvido profundo cueva ceguera abismo vacío negro
tiniebla penumbra eclipse crepúsculo ocaso apagar enterrar secreto cripta
sótano pozo fondo subterráneo laberinto túnel gruta sepulcro hondura
amanecer luz brillo aurora alba dorado resplandor destello fulgor luminoso
claro radiante centelleo chispa estrella faro espejo reflejo mirada revelación
despertar abrir nacer brillante solar fosforescer llamarada relucir destello
espiga espigar espigadora memoria recuerdo olvido tiempo reloj corazón mano
varda desecho basura obsoleto muerte nacer papa recolectar recoger rescatar
abandonar perder encontrar buscar caminar mirar observar contemplar atender
descartar tirar arrojar dejar soltar liberar volar flotar caer hundirse
crecer brotar florecer marchitar secar morir vivir respirar existir soñar
despertar dormir soñar pensar sentir tocar oler escuchar ver mirar oír
palabra letra texto frase verso poema historia cuento relato narración
escribir leer borrar dibujar pintar trazar marcar grabar inscribir tallar
papel tinta pluma lápiz pincel trazo línea curva punto mancha gota
color rojo azul verde amarillo violeta naranja rosa blanco negro gris
dorado plateado púrpura carmesí turquesa índigo ámbar marfil coral
casa hogar habitación ventana puerta techo pared piso escalera pasillo
calle camino sendero ruta vereda huella paso puente cruce esquina plaza
ciudad pueblo aldea barrio campo pradera bosque selva montaña valle colina
cielo nube horizonte atardecer madrugada mediodía medianoche estación otoño
primavera verano invierno luna sol tierra piedra roca arena polvo barro
hierba flor árbol hoja rama raíz tronco semilla fruto cosecha siembra
pájaro paloma cuervo gaviota búho lechuza gorrión mariposa abeja
perro gato caballo lobo zorro ciervo conejo ratón serpiente pez
persona hombre mujer niño niña anciano anciana madre padre hijo hija
hermano hermana amigo amiga vecino extraño forastero viajero caminante
amor odio miedo esperanza tristeza alegría dolor placer angustia nostalgia
soledad compañía presencia ausencia distancia cercanía lejanía inmensidad
infinito eterno fugaz efímero permanente transitorio momentáneo duradero
grande pequeño alto bajo ancho estrecho largo corto grueso delgado
rápido lento fuerte débil duro blando pesado liviano denso ligero
viejo nuevo antiguo moderno joven gastado roto usado desgastado frágil
bello feo hermoso horrible sublime terrible magnífico miserable
silencio ruido sonido murmullo susurro grito canto melodía ritmo eco
música nota acorde disonancia armonía vibración resonancia frecuencia tono
""".split()


# ─────────────────────────────────────────────
# Core: Semantic Pole Engine
# ─────────────────────────────────────────────

class SemanticPoleEngine:
    """
    Maps words to environmental effects by computing their similarity
    to predefined semantic poles using word embeddings.
    """

    def __init__(self, model_name="es_core_news_lg", verbose=False):
        self.verbose = verbose
        self.nlp = None
        self.model_name = model_name
        self.poles = {}
        self.special_words = {}
        self.config = {}
        self.pole_vectors = {}  # centroid vector for each pole
        self._vector_cache = {}

    def load_model(self):
        """Load spaCy model with word vectors."""
        self.log(f"📦 Loading spaCy model: {self.model_name}")
        try:
            self.nlp = spacy.load(self.model_name)
        except OSError:
            print(f"❌ Model '{self.model_name}' not found.")
            print(f"   Install it with: python -m spacy download {self.model_name}")
            sys.exit(1)

        self.log(f"   ✅ Loaded.")
        return self

    def load_poles(self, poles_path):
        """Load semantic poles configuration from JSON."""
        self.log(f"📄 Loading poles from: {poles_path}")
        with open(poles_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.poles = data.get("poles", {})
        self.special_words = data.get("special_words", {})
        self.config = data.get("config", {})
        self.log(f"   ✅ {len(self.poles)} poles, {len(self.special_words)} special words")
        return self

    def get_vector(self, word):
        """Get word vector using the pipeline (not just vocab lookup)."""
        if word in self._vector_cache:
            return self._vector_cache[word]

        doc = self.nlp(word)
        if doc.has_vector and np.linalg.norm(doc.vector) > 0:
            vec = doc.vector.copy()
            self._vector_cache[word] = vec
            return vec

        self._vector_cache[word] = None
        return None

    def compute_pole_centroids(self):
        """
        Compute centroid vector for each pole from its seed words.
        The centroid is the average of all valid seed word vectors.
        """
        self.log("🧭 Computing pole centroids...")
        for pole_name, pole_data in self.poles.items():
            seeds = pole_data.get("seeds", [])
            vectors = []
            missing = []

            for seed in seeds:
                vec = self.get_vector(seed)
                if vec is not None:
                    vectors.append(vec)
                else:
                    missing.append(seed)

            if vectors:
                centroid = np.mean(vectors, axis=0)
                norm = np.linalg.norm(centroid)
                if norm > 0:
                    centroid = centroid / norm
                self.pole_vectors[pole_name] = centroid
                self.log(f"   {pole_data.get('emoji', '•')} {pole_name}: "
                         f"{len(vectors)}/{len(seeds)} seeds valid")
                if missing and self.verbose:
                    self.log(f"      Missing: {', '.join(missing)}")
            else:
                print(f"   ⚠️  {pole_name}: No valid seed vectors! Skipping.")

        return self

    def compute_word_affinities(self, word):
        """
        Compute a word's affinity to each semantic pole.
        Returns dict of {pole_name: similarity_score} for scores above threshold.
        """
        word_vec = self.get_vector(word)
        if word_vec is None:
            return None

        word_norm = np.linalg.norm(word_vec)
        if word_norm == 0:
            return None

        word_vec_normalized = word_vec / word_norm
        threshold = self.config.get("similarity_threshold", 0.35)
        affinities = {}

        for pole_name, centroid in self.pole_vectors.items():
            similarity = float(np.dot(word_vec_normalized, centroid))
            if similarity >= threshold:
                scaled = (similarity - threshold) / (1.0 - threshold)
                affinities[pole_name] = round(min(scaled, 1.0), 3)

        return affinities if affinities else None

    def compute_environmental_effects(self, affinities):
        """
        Convert pole affinities into concrete environmental parameter changes.
        """
        effects = {}
        for pole_name, strength in affinities.items():
            pole_data = self.poles.get(pole_name, {})
            pole_affects = pole_data.get("affects", {})
            for param, weight in pole_affects.items():
                if param not in effects:
                    effects[param] = 0.0
                effects[param] += weight * strength

        for param in effects:
            effects[param] = round(max(-1.0, min(1.0, effects[param])), 3)

        return effects

    def generate_dictionary(self, extra_words=None):
        """
        Process curated word list + any extra words and build the semantic dictionary.
        """
        self.log(f"🔍 Building dictionary from curated word list...")

        candidates = set()

        # Curated words
        for w in CURATED_WORDS:
            w = w.strip().lower()
            if len(w) >= 2:
                candidates.add(w)

        # Extra words from --words flag
        if extra_words:
            for w in extra_words:
                w = w.strip().lower()
                if len(w) >= 2:
                    candidates.add(w)

        # External wordlist file
        if DEFAULT_WORDLIST_PATH.exists():
            self.log(f"   📂 Loading external wordlist: {DEFAULT_WORDLIST_PATH}")
            with open(DEFAULT_WORDLIST_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    w = line.strip().lower()
                    if len(w) >= 2 and w.isalpha():
                        candidates.add(w)

        self.log(f"   📝 {len(candidates):,} candidate words")

        dictionary = {}
        word_count = 0
        no_vector = 0
        no_affinity = 0
        start_time = time.time()

        for word in sorted(candidates):
            affinities = self.compute_word_affinities(word)
            if affinities is None:
                no_vector += 1
                continue
            effects = self.compute_environmental_effects(affinities)
            if effects:
                dictionary[word] = {
                    "poles": affinities,
                    "effects": effects
                }
                word_count += 1
            else:
                no_affinity += 1

        elapsed = time.time() - start_time
        self.log(f"   ✅ {word_count:,} words mapped in {elapsed:.1f}s")
        if self.verbose:
            self.log(f"      {no_vector} words without vectors, {no_affinity} below threshold")

        return dictionary

    def generate_output(self, dictionary):
        """Build the final output JSON structure consumed by the JS frontend."""
        pole_meta = {}
        for name, data in self.poles.items():
            pole_meta[name] = {
                "emoji": data.get("emoji", "•"),
                "label": data.get("label", name),
                "affects": data.get("affects", {})
            }

        output = {
            "_meta": {
                "generator": "Text2Wind Semantic Dictionary Generator",
                "version": "1.0.0",
                "description": "Maps Spanish words to environmental effects via word embeddings",
                "concept": "Inspired by Agnès Varda's 'Les Glaneurs et la Glaneuse' (2000)",
                "total_words": len(dictionary),
                "poles": list(self.poles.keys()),
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "model": self.model_name
            },
            "poles": pole_meta,
            "words": dictionary
        }

        return output

    def log(self, msg):
        print(msg)


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Text2Wind — Semantic Dictionary Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_dictionary.py                    Generate full dictionary
  python generate_dictionary.py --extend --words "soledad,ceniza"
  python generate_dictionary.py --poles custom.json
  python generate_dictionary.py --test
  python generate_dictionary.py -v
        """
    )

    parser.add_argument("--poles", type=str, default=str(DEFAULT_POLES_PATH),
                        help="Path to semantic poles JSON config")
    parser.add_argument("--output", type=str, default=str(DEFAULT_OUTPUT_PATH),
                        help="Output path for semantic dictionary JSON")
    parser.add_argument("--model", type=str, default="es_core_news_lg",
                        help="spaCy model to use (must have word vectors)")
    parser.add_argument("--extend", action="store_true",
                        help="Extend existing dictionary instead of replacing")
    parser.add_argument("--words", type=str, default=None,
                        help="Comma-separated list of words to add")
    parser.add_argument("--test", action="store_true",
                        help="Test mode: check poles, show sample mappings")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Verbose output")

    args = parser.parse_args()

    print("=" * 50)
    print("  Text2Wind — Semantic Dictionary Generator")
    print("  'Nada es realmente un desecho si se mira")
    print("   con la atención adecuada.' — Agnès Varda")
    print("=" * 50)
    print()

    engine = SemanticPoleEngine(model_name=args.model, verbose=args.verbose)
    engine.load_model()
    engine.load_poles(args.poles)
    engine.compute_pole_centroids()

    if args.test:
        run_tests(engine)
        return

    extra_words = args.words.split(",") if args.words else None

    if args.extend and os.path.exists(args.output):
        print(f"📂 Extending existing dictionary: {args.output}")
        with open(args.output, "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_words = existing.get("words", {})
    else:
        existing_words = {}

    dictionary = engine.generate_dictionary(extra_words=extra_words)

    if args.extend:
        existing_words.update(dictionary)
        dictionary = existing_words

    output = engine.generate_output(dictionary)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Dictionary saved: {output_path}")
    print(f"   {len(dictionary):,} words → {output_path.stat().st_size / 1024:.1f} KB")

    # Write special words separately
    special_output = output_path.parent / "special_words.json"
    with open(special_output, "w", encoding="utf-8") as f:
        json.dump(engine.special_words, f, ensure_ascii=False, indent=2)
    print(f"💾 Special words saved: {special_output}")
    print(f"   {len(engine.special_words)} special words")

    # Show sample mappings
    print("\n🌾 Sample mappings:")
    sample_words = ["lluvia", "fuego", "silencio", "olvido", "jardín",
                    "tormenta", "paz", "noche", "amanecer", "lágrima",
                    "esperanza", "soledad", "viento", "muerte", "nacer"]
    for word in sample_words:
        if word in dictionary:
            entry = dictionary[word]
            poles_str = ", ".join(
                f"{engine.poles[k].get('emoji', '•')}{v:.2f}"
                for k, v in sorted(entry["poles"].items(), key=lambda x: -x[1])
                if v > 0.05
            )
            print(f"   {word:14s} → {poles_str}")
        else:
            print(f"   {word:14s} → (not mapped)")

    print(f"\n✅ Done! Dictionary ready for Text2Wind frontend.")


def run_tests(engine):
    """Test mode: verify poles work and show detailed mappings."""
    print("\n🧪 TEST MODE")
    print("─" * 60)

    test_words = [
        "lluvia", "fuego", "nieve", "sol", "noche", "amanecer",
        "tormenta", "paz", "olvido", "grito", "susurro", "mar",
        "jardín", "desierto", "sombra", "brillo", "silencio",
        "lágrima", "calor", "hielo", "viento", "abrazo",
        "espiga", "memoria", "basura", "corazón", "mano",
        "amor", "odio", "miedo", "esperanza", "muerte", "vida",
        "soledad", "nostalgia", "ternura", "angustia", "ceniza",
        "polvo", "hierba", "flor", "mariposa", "horizonte"
    ]

    print(f"\nTesting {len(test_words)} words:\n")
    mapped = 0

    for word in test_words:
        affinities = engine.compute_word_affinities(word)
        if affinities:
            effects = engine.compute_environmental_effects(affinities)
            poles_str = " ".join(
                f"{engine.poles[k].get('emoji', '•')}{v:.2f}"
                for k, v in sorted(affinities.items(), key=lambda x: -x[1])
                if v > 0.02
            )
            print(f"  ✅ {word:14s} │ {poles_str}")
            mapped += 1
        else:
            print(f"  ❌ {word:14s} │ (no affinity)")

    # Special words
    print(f"\n{'─' * 60}")
    print(f"Special words ({len(engine.special_words)}):")
    for word, data in engine.special_words.items():
        effect = data.get("effect", "?")
        desc = data.get("description", "")
        print(f"  ⭐ {word:14s} → {effect:20s} │ {desc}")

    print(f"\n{'─' * 60}")
    print(f"Coverage: {mapped}/{len(test_words)} ({mapped/len(test_words)*100:.0f}%)")


if __name__ == "__main__":
    main()
