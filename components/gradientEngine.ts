// ============================================================
// Gradient Engine — Complex Designer Gradient Renderer
// Uses Canvas pixel manipulation for rich, multi-layered effects
// ============================================================

// ---- Seeded PRNG (Mulberry32) ----
export function createRng(seed: number) {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Noise ----
function hashFloat(ix: number, iy: number, seed: number): number {
  let h = seed ^ (ix * 374761393) ^ (iy * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), -1494211461);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function smootherStep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smootherStep(x - ix);
  const fy = smootherStep(y - iy);
  const n00 = hashFloat(ix, iy, seed);
  const n10 = hashFloat(ix + 1, iy, seed);
  const n01 = hashFloat(ix, iy + 1, seed);
  const n11 = hashFloat(ix + 1, iy + 1, seed);
  return n00 * (1 - fx) * (1 - fy) + n10 * fx * (1 - fy) + n01 * (1 - fx) * fy + n11 * fx * fy;
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq, seed + i * 31);
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return value / max;
}

// ---- Color utilities ----
type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  return [Math.round(a[0] + (b[0] - a[0]) * c), Math.round(a[1] + (b[1] - a[1]) * c), Math.round(a[2] + (b[2] - a[2]) * c)];
}

function paletteAt(colors: RGB[], t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  const n = colors.length - 1;
  const i = Math.min(Math.floor(c * n), n - 1);
  const f = c * n - i;
  return lerpColor(colors[i], colors[i + 1], f);
}

// Soft-light blend for richer colors
function softLight(base: number, blend: number): number {
  const b = base / 255;
  const s = blend / 255;
  const r = s < 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (b < 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b) - b);
  return Math.round(Math.max(0, Math.min(255, r * 255)));
}

// ---- Palettes ----
export const PALETTES = [
  { name: 'Neon Dreams', colors: ['#ff006e', '#8338ec', '#3a86ff', '#06d6a0', '#ffd166'] },
  { name: 'Deep Ocean', colors: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'] },
  { name: 'Cosmic Purple', colors: ['#10002b', '#240046', '#3c096c', '#7b2cbf', '#e0aaff'] },
  { name: 'Sunset Blaze', colors: ['#ff6b35', '#ff006e', '#c9184a', '#f77f00', '#fcbf49'] },
  { name: 'Forest Magic', colors: ['#004b23', '#007200', '#38b000', '#70e000', '#9ef01a'] },
  { name: 'Arctic Ice', colors: ['#caf0f8', '#ade8f4', '#90e0ef', '#48cae4', '#0077b6'] },
  { name: 'Volcano', colors: ['#03071e', '#370617', '#6a040f', '#d00000', '#faa307'] },
  { name: 'Golden Hour', colors: ['#001219', '#005f73', '#0a9396', '#e9d8a6', '#ee9b00'] },
  { name: 'Tropical', colors: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'] },
  { name: 'Pastel Dream', colors: ['#ffadad', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff'] },
  { name: 'Northern Lights', colors: ['#0d1b2a', '#2d6a4f', '#40916c', '#52b788', '#95d5b2'] },
  { name: 'Cyberpunk', colors: ['#0d0221', '#0f084b', '#26408b', '#ff006e', '#fe00fe'] },
  { name: 'Fire & Ice', colors: ['#03045e', '#0077b6', '#d00000', '#e85d04', '#f48c06'] },
  { name: 'Berry Burst', colors: ['#590d22', '#800f2f', '#a4133c', '#c9184a', '#ff4d6d'] },
  { name: 'Rose Gold', colors: ['#590d22', '#b5838d', '#e5989b', '#ffb4a2', '#ffcdb2'] },
  { name: 'Emerald Night', colors: ['#0b090a', '#161a1d', '#006466', '#0b525b', '#144552'] },
  { name: 'Candy Pop', colors: ['#7400b8', '#6930c3', '#5e60ce', '#5390d9', '#48bfe3'] },
  { name: 'Desert Sand', colors: ['#603808', '#9e6b38', '#d4a373', '#e9c99b', '#fefae0'] },
  { name: 'Midnight', colors: ['#000814', '#001d3d', '#003566', '#ffc300', '#ffd60a'] },
  { name: 'Lavender Haze', colors: ['#7b2cbf', '#9d4edd', '#c77dff', '#e0aaff', '#f2e6ff'] },
];

export type GradientStyle = 'mesh' | 'liquid' | 'aurora' | 'nebula' | 'plasma' | 'crystal' | 'marble' | 'sunset';

export const STYLES: { id: GradientStyle; name: string; desc: string }[] = [
  { id: 'mesh', name: 'Mesh', desc: 'Apple-style multi-point color blend' },
  { id: 'liquid', name: 'Liquid', desc: 'Domain-warped fluid shapes' },
  { id: 'aurora', name: 'Aurora', desc: 'Flowing northern lights waves' },
  { id: 'nebula', name: 'Nebula', desc: 'Cosmic cloud layers' },
  { id: 'plasma', name: 'Plasma', desc: 'Interference wave patterns' },
  { id: 'crystal', name: 'Crystal', desc: 'Voronoi crystalline cells' },
  { id: 'marble', name: 'Marble', desc: 'Turbulent stone veins' },
  { id: 'sunset', name: 'Sunset', desc: 'Atmospheric layered bands' },
];

export const SIZE_PRESETS = [
  { label: '1080 x 1080', w: 1080, h: 1080 },
  { label: '1920 x 1080', w: 1920, h: 1080 },
  { label: '1080 x 1920', w: 1080, h: 1920 },
  { label: '2560 x 1440', w: 2560, h: 1440 },
  { label: '3840 x 2160', w: 3840, h: 2160 },
  { label: '800 x 600', w: 800, h: 600 },
  { label: '1200 x 630', w: 1200, h: 630 },
];

export interface GradientParams {
  style: GradientStyle;
  paletteIndex: number;
  seed: number;
  grain: number;
  vignette: number;
}

// ================================================================
// RENDERERS
// ================================================================

// ---- Mesh Gradient: multi-point IDW with noise displacement ----
function renderMesh(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const count = 5 + Math.floor(rng() * 5);
  const points: { x: number; y: number; color: RGB }[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: rng() * 1.4 - 0.2,
      y: rng() * 1.4 - 0.2,
      color: palette[Math.floor(rng() * palette.length)],
    });
  }
  const noiseScale = 1.5 + rng() * 2.5;
  const noiseAmt = 0.12 + rng() * 0.28;
  const power = 2.0 + rng() * 1.8;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / w;
      const ny = py / h;
      const dx = fbm(nx * noiseScale, ny * noiseScale, 5, seed) * noiseAmt;
      const dy = fbm(nx * noiseScale + 97, ny * noiseScale + 97, 5, seed + 3) * noiseAmt;
      const x = nx + dx;
      const y = ny + dy;
      let tw = 0, r = 0, g = 0, b = 0;
      for (const pt of points) {
        const d = Math.sqrt((x - pt.x) ** 2 + (y - pt.y) ** 2);
        const wt = 1 / (Math.pow(d, power) + 1e-4);
        r += pt.color[0] * wt;
        g += pt.color[1] * wt;
        b += pt.color[2] * wt;
        tw += wt;
      }
      const idx = (py * w + px) * 4;
      data[idx] = Math.min(255, Math.round(r / tw));
      data[idx + 1] = Math.min(255, Math.round(g / tw));
      data[idx + 2] = Math.min(255, Math.round(b / tw));
      data[idx + 3] = 255;
    }
  }
}

// ---- Liquid: multi-pass domain warping ----
function renderLiquid(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const scale = 2.5 + rng() * 3;
  const warp = 0.35 + rng() * 0.55;
  const iters = 2 + Math.floor(rng() * 2);
  const ox = rng() * 100;
  const oy = rng() * 100;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let x = (px / w) * scale + ox;
      let y = (py / h) * scale + oy;
      for (let it = 0; it < iters; it++) {
        const nx = fbm(x, y, 6, seed + it * 17) * warp;
        const ny = fbm(x + 5.2, y + 1.3, 6, seed + it * 17 + 7) * warp;
        x += nx;
        y += ny;
      }
      const v = fbm(x, y, 6, seed + 100);
      const c = paletteAt(palette, v);
      const idx = (py * w + px) * 4;
      data[idx] = c[0];
      data[idx + 1] = c[1];
      data[idx + 2] = c[2];
      data[idx + 3] = 255;
    }
  }
}

// ---- Aurora: layered sine-wave light bands ----
function renderAurora(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const waveCount = 5 + Math.floor(rng() * 5);
  const waves: { yC: number; amp: number; freq: number; thick: number; color: RGB; phase: number }[] = [];
  for (let i = 0; i < waveCount; i++) {
    waves.push({
      yC: 0.15 + rng() * 0.7,
      amp: 0.04 + rng() * 0.16,
      freq: 1 + rng() * 5,
      thick: 0.04 + rng() * 0.14,
      color: palette[Math.floor(rng() * palette.length)],
      phase: rng() * Math.PI * 2,
    });
  }
  const bg: RGB = [Math.round(palette[0][0] * 0.12), Math.round(palette[0][1] * 0.12), Math.round(palette[0][2] * 0.12)];

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / w;
      const ny = py / h;
      let r = bg[0], g = bg[1], b = bg[2];
      for (const wv of waves) {
        const nv = fbm(nx * 3.5, ny * 2.5, 4, seed + 50) * 0.1;
        const waveY = wv.yC + Math.sin(nx * wv.freq * Math.PI * 2 + wv.phase) * wv.amp + nv;
        const dist = Math.abs(ny - waveY);
        const base = Math.exp(-(dist * dist) / (2 * wv.thick * wv.thick));
        const ni = base * (0.4 + 0.6 * fbm(nx * 9, ny * 9, 3, seed + 200));
        r = Math.min(255, r + wv.color[0] * ni * 0.75);
        g = Math.min(255, g + wv.color[1] * ni * 0.75);
        b = Math.min(255, b + wv.color[2] * ni * 0.75);
      }
      const idx = (py * w + px) * 4;
      data[idx] = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = 255;
    }
  }
}

// ---- Nebula: layered fbm with additive blending ----
function renderNebula(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const layerCount = 3 + Math.floor(rng() * 3);
  const layers: { scale: number; ox: number; oy: number; color: RGB; bright: number }[] = [];
  for (let i = 0; i < layerCount; i++) {
    layers.push({
      scale: 2 + rng() * 4,
      ox: rng() * 100,
      oy: rng() * 100,
      color: palette[Math.floor(rng() * palette.length)],
      bright: 0.3 + rng() * 0.55,
    });
  }
  const bg: RGB = [Math.round(palette[0][0] * 0.08), Math.round(palette[0][1] * 0.08), Math.round(palette[0][2] * 0.08)];

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / w;
      const ny = py / h;
      let r = bg[0], g = bg[1], b = bg[2];
      for (const l of layers) {
        const x = nx * l.scale + l.ox;
        const y = ny * l.scale + l.oy;
        const wx = x + fbm(x, y, 4, seed + 10) * 0.6;
        const wy = y + fbm(x + 3.7, y + 2.1, 4, seed + 20) * 0.6;
        const v = Math.pow(fbm(wx, wy, 6, seed + 30) * l.bright, 1.4);
        r = Math.min(255, r + l.color[0] * v);
        g = Math.min(255, g + l.color[1] * v);
        b = Math.min(255, b + l.color[2] * v);
      }
      const idx = (py * w + px) * 4;
      data[idx] = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = 255;
    }
  }
}

// ---- Plasma: interference patterns ----
function renderPlasma(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const f1 = 1.5 + rng() * 4;
  const f2 = 1.5 + rng() * 4;
  const f3 = 0.5 + rng() * 2.5;
  const f4 = 0.5 + rng() * 3;
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const p4 = rng() * Math.PI * 2;
  const ni = 0.2 + rng() * 0.45;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / w;
      const ny = py / h;
      let v = Math.sin(nx * f1 * Math.PI * 2 + p1);
      v += Math.sin(ny * f2 * Math.PI * 2 + p2);
      v += Math.sin((nx + ny) * f3 * Math.PI * 2 + p3);
      v += Math.sin(Math.sqrt(nx * nx + ny * ny) * f4 * Math.PI * 2 + p4);
      v += fbm(nx * 5, ny * 5, 4, seed) * ni * 4;
      v = (v + 4 + ni * 2) / (8 + ni * 4);
      v = Math.max(0, Math.min(1, v));
      const c = paletteAt(palette, v);
      const idx = (py * w + px) * 4;
      data[idx] = c[0];
      data[idx + 1] = c[1];
      data[idx + 2] = c[2];
      data[idx + 3] = 255;
    }
  }
}

// ---- Crystal: Voronoi-based cells ----
function renderCrystal(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const count = 10 + Math.floor(rng() * 18);
  const pts: { x: number; y: number; color: RGB }[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({ x: rng(), y: rng(), color: palette[Math.floor(rng() * palette.length)] });
  }
  const noiseScale = 2.5 + rng() * 3;
  const distort = 0.02 + rng() * 0.06;
  const edgeW = 0.004 + rng() * 0.012;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let nx = px / w + fbm((px / w) * noiseScale, (py / h) * noiseScale, 3, seed) * distort;
      let ny = py / h + fbm((px / w) * noiseScale + 50, (py / h) * noiseScale + 50, 3, seed) * distort;
      let d1 = Infinity, d2 = Infinity;
      let c1: RGB = [0, 0, 0], c2: RGB = [0, 0, 0];
      for (const pt of pts) {
        const d = Math.sqrt((nx - pt.x) ** 2 + (ny - pt.y) ** 2);
        if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = pt.color; }
        else if (d < d2) { d2 = d; c2 = pt.color; }
      }
      const edge = d2 - d1;
      const blend = Math.min(1, edge / (edgeW * 3));
      let c = lerpColor(lerpColor(c1, c2, 0.5), c1, blend);
      if (edge < edgeW) {
        c = lerpColor(c, [20, 20, 20], (1 - edge / edgeW) * 0.5);
      }
      const glow = Math.exp(-d1 * 10);
      c = lerpColor(c, [255, 255, 255], glow * 0.08);
      const idx = (py * w + px) * 4;
      data[idx] = c[0]; data[idx + 1] = c[1]; data[idx + 2] = c[2]; data[idx + 3] = 255;
    }
  }
}

// ---- Marble: turbulence + sine veins ----
function renderMarble(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const turbulence = 3 + rng() * 5;
  const veinFreq = 3 + rng() * 8;
  const veinAngle = rng() * Math.PI;
  const layers = 2 + Math.floor(rng() * 3);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / w;
      const ny = py / h;
      const rx = nx * Math.cos(veinAngle) + ny * Math.sin(veinAngle);
      let acc = 0;
      for (let l = 0; l < layers; l++) {
        const turb = fbm(nx * turbulence + l * 7.3, ny * turbulence + l * 3.1, 6, seed + l * 13) * 2 - 1;
        acc += Math.sin((rx + turb) * veinFreq * Math.PI) * 0.5 + 0.5;
      }
      const v = Math.max(0, Math.min(1, acc / layers));
      const c = paletteAt(palette, v);
      const idx = (py * w + px) * 4;
      data[idx] = c[0]; data[idx + 1] = c[1]; data[idx + 2] = c[2]; data[idx + 3] = 255;
    }
  }
}

// ---- Sunset: atmospheric banded layers with glow ----
function renderSunset(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], seed: number) {
  const rng = createRng(seed);
  const bandCount = palette.length;
  const sunX = 0.3 + rng() * 0.4;
  const sunY = 0.3 + rng() * 0.35;
  const sunRadius = 0.06 + rng() * 0.08;
  const glowSize = 0.2 + rng() * 0.3;
  const noiseStr = 0.08 + rng() * 0.12;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = px / w;
      const ny = py / h;
      // Banded background
      const noiseBand = fbm(nx * 4, ny * 2, 5, seed) * noiseStr;
      const bandPos = Math.max(0, Math.min(1, ny + noiseBand));
      let c = paletteAt(palette, bandPos);
      // Sun disc
      const dx = nx - sunX;
      const dy = ny - sunY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < sunRadius) {
        const edge = 1 - Math.pow(dist / sunRadius, 3);
        c = lerpColor(c, [255, 250, 230], edge * 0.95);
      }
      // Glow around sun
      const glowFactor = Math.exp(-(dist * dist) / (2 * glowSize * glowSize));
      const glowColor = palette[Math.min(1, palette.length - 1)];
      c = [
        Math.min(255, Math.round(c[0] + glowColor[0] * glowFactor * 0.5)),
        Math.min(255, Math.round(c[1] + glowColor[1] * glowFactor * 0.5)),
        Math.min(255, Math.round(c[2] + glowColor[2] * glowFactor * 0.5)),
      ];
      // Horizontal streaks
      const streak = fbm(nx * 12, ny * 60, 3, seed + 77) * 0.1 * Math.exp(-dist * 3);
      c = [
        Math.min(255, Math.round(c[0] + 255 * streak)),
        Math.min(255, Math.round(c[1] + 200 * streak)),
        Math.min(255, Math.round(c[2] + 150 * streak)),
      ];
      const idx = (py * w + px) * 4;
      data[idx] = c[0]; data[idx + 1] = c[1]; data[idx + 2] = c[2]; data[idx + 3] = 255;
    }
  }
}

// ================================================================
// Post-processing
// ================================================================

function applyGrain(data: Uint8ClampedArray, w: number, h: number, amount: number, seed: number) {
  const rng = createRng(seed + 9999);
  const str = amount * 50;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * str;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
}

function applyVignette(data: Uint8ClampedArray, w: number, h: number, strength: number) {
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / maxD;
      const v = 1 - Math.pow(d, 1.8) * strength;
      const idx = (py * w + px) * 4;
      data[idx] = Math.round(data[idx] * v);
      data[idx + 1] = Math.round(data[idx + 1] * v);
      data[idx + 2] = Math.round(data[idx + 2] * v);
    }
  }
}

// Color boost — subtle soft-light overlay with palette mid-color
function applyColorBoost(data: Uint8ClampedArray, w: number, h: number, palette: RGB[], strength: number) {
  if (strength <= 0) return;
  const mid = palette[Math.floor(palette.length / 2)];
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] + (softLight(data[i], mid[0]) - data[i]) * strength * 0.3);
    data[i + 1] = Math.round(data[i + 1] + (softLight(data[i + 1], mid[1]) - data[i + 1]) * strength * 0.3);
    data[i + 2] = Math.round(data[i + 2] + (softLight(data[i + 2], mid[2]) - data[i + 2]) * strength * 0.3);
  }
}

// ================================================================
// Public API
// ================================================================

export function renderGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: GradientParams,
): void {
  const palette = PALETTES[params.paletteIndex].colors.map(hexToRgb);
  const imageData = ctx.createImageData(width, height);
  const d = imageData.data;

  switch (params.style) {
    case 'mesh': renderMesh(d, width, height, palette, params.seed); break;
    case 'liquid': renderLiquid(d, width, height, palette, params.seed); break;
    case 'aurora': renderAurora(d, width, height, palette, params.seed); break;
    case 'nebula': renderNebula(d, width, height, palette, params.seed); break;
    case 'plasma': renderPlasma(d, width, height, palette, params.seed); break;
    case 'crystal': renderCrystal(d, width, height, palette, params.seed); break;
    case 'marble': renderMarble(d, width, height, palette, params.seed); break;
    case 'sunset': renderSunset(d, width, height, palette, params.seed); break;
  }

  applyColorBoost(d, width, height, palette, 0.5);
  if (params.grain > 0) applyGrain(d, width, height, params.grain, params.seed);
  if (params.vignette > 0) applyVignette(d, width, height, params.vignette);

  ctx.putImageData(imageData, 0, 0);
}

export async function exportPNG(params: GradientParams, exportW: number, exportH: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = exportW;
  canvas.height = exportH;
  const ctx = canvas.getContext('2d')!;
  renderGradient(ctx, exportW, exportH, params);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
