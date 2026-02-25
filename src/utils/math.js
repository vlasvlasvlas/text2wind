/* ======================================
   TEXT2WIND — Math Utilities
   ====================================== */

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function map(value, inMin, inMax, outMin, outMax) {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

export function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function lerpColor(a, b, t) {
    return [
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t),
    ];
}

export function degToRad(deg) {
    return deg * (Math.PI / 180);
}

export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}
