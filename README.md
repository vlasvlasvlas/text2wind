# Text2Wind — Interfaz Espigadora

> *"Nada es realmente un desecho si se mira con la atención adecuada."*
> — Agnès Varda, *Los espigadores y la espigadora* (2000)

Una experiencia web inmersiva donde las palabras escritas nacen como tipografía viva, respiran en un paisaje atmosférico sincronizado con la hora real del día, y se disuelven en viento, sonido y silencio.

**Las palabras que escribís afectan el mundo.** Escribir *"lluvia"* nubla el cielo. *"Silencio"* detiene el viento. *"Memoria"* revela las huellas de todo lo que fue escrito antes.

🔗 **[GitHub](https://github.com/vlasvlasvlas/text2wind)**

---

## Concepto

Text2Wind transpone el gesto del **espigueo** de Varda a una interfaz digital:

1. **Espigar materia** — Las letras destruidas se acumulan como restos tipográficos. De esos restos crece hierba. El desecho alimenta nueva vida.
2. **Espigar imágenes** — Cuando el sistema detecta una palabra con carga semántica, la contempla un instante antes de liberarla al viento.
3. **Espigar el tiempo** — La interfaz envejece con el uso real. Cada sesión deja marcas persistentes (palimpsesto digital).

---

## Características

### Visuales
- 🌅 **Cielo procedural** sincronizado con la hora real (amanecer, día, atardecer, noche, estrellas)
- ☁️ **Nubes orgánicas** renderizadas con gradientes radiales y animación de ruido
- 💨 **Campo de viento** basado en Perlin noise con turbulencias orgánicas
- 🌫️ **Partículas de viento** (polvo/polen) que visualizan la dirección y fuerza del viento
- ✍️ **Tipografía viva** con ciclo de vida: nacimiento → reposo → erosión → disolución
- 🌧️ **Clima parametrizable**: viento, dirección, lluvia, niebla, tormenta, temperatura
- ⚡ **Efectos meteorológicos**: lluvia con gotas, relámpagos, niebla volumétrica
- 🕯️ **Cursor-vela** con estela de luciérnagas: tu atención protege las letras del olvido
- 🌿 **Hierba que crece** sobre el texto abandonado
- 📜 **Palimpsesto digital**: huellas invisibles de texto pasado, revelables

### Sonido — 3 Capas Generativas
- 🥁 **Ritmo**: percusión generada por la erosión de letras + clicks al teclear
- 🎵 **Drone**: tono FM continuo que cambia con la hora del día, temperatura y clima
- 🎹 **Melodía**: notas al teclear con dos modos:
  - **Random**: notas basadas en la escala musical activa (pentatónica, frigia, lidia…)
  - **Piano QWERTY**: el teclado mapeado como un piano (Z-M = C3, Q-P = C5)
- Cada capa tiene controles independientes de **volumen, mute, waveform, ADSR, reverb**
- La escala musical cambia con el clima: pentatónica → frigia (tormenta) → lidia (calor)

### Interacción
- 🧠 **360 palabras en español** mapeadas semánticamente a efectos ambientales
- ⭐ **16 palabras especiales** con efectos únicos vinculados a Varda
- 📖 **Auto-typewriter**: importá un archivo `.txt` y se escribe solo al BPM elegido (10–400)
- 🎭 **Modo performance** (F11) para instalación/galería sin UI
- 📷 **Captura de pantalla** como PNG

### UI
- 🕐 **Reloj** sincronizado con la hora del sistema
- ⚙️ **Panel de parámetros** con 5 tabs: Clima · Ritmo · Drone · Melodía · Auto
- ❓ **Panel "¿Qué es esto?"** con la teoría y link a GitHub
- ⌨️ **Panel de atajos** de teclado
- ⛶ **Botón de pantalla completa**
- Barra de botones flotantes con acceso rápido a cada panel

---

## Instalación

```bash
# Clonar
git clone https://github.com/vlasvlasvlas/text2wind.git
cd text2wind

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

Abrir **http://localhost:5173**

### Build de producción

```bash
npm run build     # Genera dist/
npm run preview   # Previsualiza el build
```

### Generar / Regenerar el diccionario semántico

```bash
# Instalar dependencias Python
pip install -r tools/requirements.txt
python -m spacy download es_core_news_lg

# Generar diccionario (360 palabras + 16 especiales)
python tools/generate_dictionary.py

# Extender con palabras custom
python tools/generate_dictionary.py --extend --words "soledad,ceniza,horizonte"

# Testear cobertura
python tools/generate_dictionary.py --test
```

---

## Uso

### Controles básicos

| Acción | Cómo |
|--------|------|
| Iniciar | Click en la pantalla de inicio |
| Escribir | Teclear — las letras aparecen donde hiciste click |
| Posicionar cursor | Click en el canvas |
| Erosionar línea | `Enter` — las letras se disuelven en cascada |
| Borrar última letra | `Backspace` — erosión instantánea |
| Pantalla completa | Botón ⛶ en la barra flotante |
| Modo performance | `F11` — oculta toda la UI |
| Cerrar panel | `Escape` |
| Capturar imagen | Botón 📷 |
| Activar sonido | Botón 🔇/🔊 |

### Auto-typewriter

1. Abrí el panel ⚙️ → tab **📖 Auto**
2. Click en **📂 Importar archivo .txt**
3. Ajustá el **BPM** (velocidad de tipeo: 10–400)
4. **▶ Reproducir** / **⏸ Pausar** / **⏹ Stop**

El texto importado se escribe automáticamente, caracter por caracter, con sonido y detección semántica.

### Palabras especiales

| Palabra | Efecto |
|---------|--------|
| *espigar* / *espiga* / *desecho* / *basura* | Partículas muertas se levantan del suelo |
| *memoria* / *recuerdo* | El palimpsesto se hace visible |
| *silencio* | Todo se detiene — suspensión contemplativa |
| *reloj* / *tiempo* | Time-lapse del cielo (6 horas) |
| *corazón* / *papa* | Partículas forman un corazón (la papa de Varda) |
| *varda* | Revelación total + suspensión |
| *muerte* | Erosión simultánea de todas las letras |
| *obsoleto* | La interfaz envejece rápidamente |
| *nacer* | Hierba brota de los restos tipográficos |

### Modo Piano QWERTY

Cuando el modo de melodía está en **Piano (QWERTY)**, el teclado se mapea como un piano:

```
Octava alta (C5):  Q W E R T Y U I O P
Teclas negras:     2 3   5 6 7   9 0

Octava media (C4): (misma distribución con el segundo mapeo)

Octava baja  (C3): Z X C V B N M
Teclas negras:     S D   G H J
```

---

## Arquitectura

```
text2wind/
├── index.html              # Estructura + paneles UI (5 tabs, 3 paneles flotantes)
├── styles.css              # Diseño glassmorphism + tabs + toggles + floating bar
├── vite.config.js          # Configuración Vite
├── package.json            # Dependencias (Three.js, Tone.js, Vite)
│
├── src/
│   ├── main.js             # Orquestador: loop, eventos, auto-typewriter
│   ├── config.js           # Constantes globales
│   │
│   ├── sky.js              # Cielo procedural + nubes + estrellas + partículas de viento
│   ├── wind.js             # Campo de viento Perlin noise
│   ├── weather.js          # Estado meteorológico (máquina de estados)
│   │
│   ├── text.js             # Tipografía viva (ciclo de vida de letras)
│   ├── particles.js        # Partículas de erosión
│   ├── cursor.js           # Cursor-vela + estela de luciérnagas
│   ├── memory.js           # Palimpsesto + envejecimiento
│   │
│   ├── sound.js            # 3 capas de sonido (ritmo/drone/melodía)
│   ├── semantic.js         # Consumidor de diccionario semántico
│   ├── modes.js            # Detección de modo (escritor/contemplador/tormenta)
│   ├── ui.js               # Controlador UI (tabs, sliders, toggles, file import)
│   │
│   ├── effects/
│   │   ├── rain.js         # Efecto lluvia
│   │   ├── lightning.js    # Relámpagos
│   │   ├── fog.js          # Niebla volumétrica
│   │   └── grass.js        # Hierba sobre texto abandonado
│   │
│   └── utils/
│       ├── math.js         # Funciones matemáticas (lerp, clamp, noise, etc.)
│       └── noise.js        # Implementación Perlin noise
│
├── data/
│   ├── semantic_dict.json  # Diccionario semántico (360 palabras → efectos)
│   └── special_words.json  # 16 palabras especiales (Varda, memoria, etc.)
│
└── tools/
    ├── generate_dictionary.py  # Generador CLI del diccionario con spaCy
    ├── semantic_poles.json     # Configuración de polos semánticos
    └── requirements.txt        # Dependencias Python
```

### Flujo de datos

```
Teclado → TextEngine → SoundEngine (melodía)
                     → SemanticEngine → Weather (efectos)
                     → ParticleSystem (erosión)
                     → Memory (palimpsesto)

Tiempo real → Weather → Sky (cielo/nubes)
                     → Wind (campo de viento)
                     → SoundEngine (drone/escala)
                     → RainEffect / LightningEffect / FogEffect

Archivo .txt → Auto-typewriter → TextEngine (al BPM elegido)
```

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Rendering | Canvas 2D con animación procedural a 60fps |
| Audio | Tone.js (Web Audio API) — FM Synth, PolySynth, Noise, Reverb, Delay |
| Build | Vite 6.x |
| NLP offline | spaCy + es_core_news_lg (Python, solo para generar diccionario) |
| Deploy | Archivos estáticos (`dist/`) — GitHub Pages, Vercel, Netlify |

### Dependencias runtime

```json
{
  "three": "^0.170.0",
  "tone": "^15.1.3"
}
```

---

## Parámetros de sonido

Cada capa de sonido es independientemente configurable desde la UI:

### 🥁 Ritmo
| Parámetro | Rango | Default | Descripción |
|-----------|-------|---------|-------------|
| Volumen | -40 a 0 dB | -14 dB | Volumen de percusión |
| Attack | 0.001 – 0.5s | 0.002s | Ataque del golpe percusivo |
| Decay | 0.01 – 1.0s | 0.15s | Decaimiento |
| Release | 0.01 – 2.0s | 0.10s | Release |
| Viento (audio) | -50 a -10 dB | -35 dB | Volumen del ruido de viento |

### 🎵 Drone
| Parámetro | Rango | Default | Descripción |
|-----------|-------|---------|-------------|
| Volumen | -40 a -5 dB | -22 dB | Volumen del drone |
| Filtro LP | 50 – 2000 Hz | 400 Hz | Frecuencia del filtro low-pass |
| Attack | 0.5 – 10s | 4s | Ataque (fade in lento) |
| Release | 1 – 15s | 6s | Release (fade out) |
| Onda | sine / triangle / fatsine / fatsawtooth | sine | Forma de onda |

### 🎹 Melodía
| Parámetro | Rango | Default | Descripción |
|-----------|-------|---------|-------------|
| Volumen | -40 a 0 dB | -16 dB | Volumen de notas |
| Modo | Random / Piano | Random | Mapeo de teclas a notas |
| Onda | triangle / sine / square / sawtooth | triangle | Forma de onda |
| Attack | 0.001 – 2.0s | 0.05s | Ataque de nota |
| Decay | 0.05 – 3.0s | 0.60s | Decaimiento |
| Release | 0.1 – 5.0s | 1.5s | Release |
| Reverb | 0 – 1 | 0.35 | Wet del reverb |

---

## Escalas musicales

La escala activa cambia automáticamente con el clima:

| Condición | Escala | Carácter |
|-----------|--------|----------|
| Normal (20°C, sin tormenta) | Pentatónica | Sereno, abierto |
| Tormenta > 50% | Frigia | Tenso, oscuro |
| Temperatura < 5°C | Eólica | Melancólico |
| Temperatura > 30°C | Lidia | Luminoso, expansivo |

La nota raíz del drone cambia con la hora del día: C2 (medianoche) → E2 (mañana) → A2 (mediodía) → D2 (noche).

---

## Deploy

### GitHub Pages

```bash
npm run build
# Subir contenido de dist/ a la rama gh-pages
```

### Vercel / Netlify

Conectar el repositorio directamente. Build command: `npm run build`. Output: `dist/`.

---

## Inspiración

**Agnès Varda**, *Les Glaneurs et la Glaneuse* (2000)

> El acto de espigar — recoger lo que otros descartan — como metáfora de la creación digital. En Text2Wind, las letras no se "borran": se disuelven, sus partículas alimentan el suelo, y de ese suelo crece hierba. Nada se pierde.

---

## Licencia

MIT
