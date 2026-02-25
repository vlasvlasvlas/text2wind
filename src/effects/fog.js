/* ======================================
   TEXT2WIND — Fog Effect
   ====================================== */

import { clamp } from '../utils/math.js';

export class FogEffect {
    constructor() { }
    init(state) { }

    render(ctx, w, h, state) {
        const fog = state.weather.get('fog') / 100;
        if (fog < 0.05) return;

        // Progressive fog overlay
        const alpha = fog * 0.5;
        const hour = state.weather.getCurrentHour();
        const nightness = hour < 6 || hour > 20 ? 1 : hour < 8 ? (8 - hour) / 2 : hour > 18 ? (hour - 18) / 2 : 0;

        const r = nightness > 0.5 ? 30 : 200;
        const g = nightness > 0.5 ? 30 : 195;
        const b = nightness > 0.5 ? 40 : 190;

        // Layered fog (denser at bottom)
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.3})`);
        grad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.5})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.8})`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }
}
