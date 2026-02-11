
import React, { useState, useCallback } from 'react';

// ==================== SEEDED PRNG ====================

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==================== NOISE GENERATION ====================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(
  width: number,
  height: number,
  scale: number,
  rng: () => number
): number[][] {
  const s = Math.max(scale, 1);
  const gridW = Math.ceil(width / s) + 2;
  const gridH = Math.ceil(height / s) + 2;

  const values: number[][] = [];
  for (let y = 0; y < gridH; y++) {
    values[y] = [];
    for (let x = 0; x < gridW; x++) {
      values[y][x] = rng();
    }
  }

  const result: number[][] = [];
  for (let py = 0; py < height; py++) {
    result[py] = [];
    for (let px = 0; px < width; px++) {
      const gx = px / s;
      const gy = py / s;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = smoothstep(gx - x0);
      const fy = smoothstep(gy - y0);

      const v00 = values[y0]?.[x0] ?? 0;
      const v10 = values[y0]?.[x0 + 1] ?? 0;
      const v01 = values[y0 + 1]?.[x0] ?? 0;
      const v11 = values[y0 + 1]?.[x0 + 1] ?? 0;

      result[py][px] = lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
    }
  }

  return result;
}

// ==================== PATTERN GENERATION ====================

function generatePattern(
  width: number,
  height: number,
  fillPercent: number
): boolean[][] {
  const seed = Math.floor(Math.random() * 999999);
  const rng = mulberry32(seed);

  // --- Layer 1: low-frequency "shape" noise (map-like silhouettes) ---
  const baseScale = Math.max(width, height) / (2 + rng() * 5);
  const octaves = 2 + Math.floor(rng() * 3);
  const useWarp = rng() > 0.3;
  const warpStrength = useWarp ? 0.5 + rng() * 3 : 0;

  let noise: number[][] = Array.from({ length: height }, () =>
    new Array(width).fill(0)
  );
  let amplitude = 1;
  let totalAmplitude = 0;

  for (let o = 0; o < octaves; o++) {
    const scale = baseScale / Math.pow(2, o);
    const layer = valueNoise2D(width, height, scale, rng);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        noise[y][x] += layer[y][x] * amplitude;
      }
    }
    totalAmplitude += amplitude;
    amplitude *= 0.5;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      noise[y][x] /= totalAmplitude;
    }
  }

  // Domain warping for organic, swirly shapes
  if (useWarp) {
    const warpNoiseX = valueNoise2D(width, height, baseScale * 0.7, rng);
    const warpNoiseY = valueNoise2D(width, height, baseScale * 0.7, rng);
    const warped: number[][] = Array.from({ length: height }, () =>
      new Array(width).fill(0)
    );
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const wx = Math.min(
          width - 1,
          Math.max(
            0,
            Math.round(
              x + (warpNoiseX[y][x] - 0.5) * warpStrength * baseScale
            )
          )
        );
        const wy = Math.min(
          height - 1,
          Math.max(
            0,
            Math.round(
              y + (warpNoiseY[y][x] - 0.5) * warpStrength * baseScale
            )
          )
        );
        warped[y][x] = noise[wy][wx];
      }
    }
    noise = warped;
  }

  // --- Layer 2: high-frequency "detail" noise (holes & texture) ---
  const detailScale = Math.max(width, height) / (12 + rng() * 18);
  const detailOctaves = 3 + Math.floor(rng() * 3);
  let detail: number[][] = Array.from({ length: height }, () =>
    new Array(width).fill(0)
  );
  let dAmp = 1;
  let dTotal = 0;
  for (let o = 0; o < detailOctaves; o++) {
    const scale = detailScale / Math.pow(2, o);
    const layer = valueNoise2D(width, height, scale, rng);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        detail[y][x] += layer[y][x] * dAmp;
      }
    }
    dTotal += dAmp;
    dAmp *= 0.6;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      detail[y][x] /= dTotal;
    }
  }

  // --- Blend: shape provides silhouette, detail carves texture inside ---
  const detailWeight = 0.3 + rng() * 0.15; // 30-45% detail influence
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      noise[y][x] =
        noise[y][x] * (1 - detailWeight) + detail[y][x] * detailWeight;
    }
  }

  // Determine threshold to achieve the desired fill percentage
  const allValues: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      allValues.push(noise[y][x]);
    }
  }
  allValues.sort((a, b) => a - b);

  const totalPixels = width * height;
  const targetFilled = Math.floor((totalPixels * fillPercent) / 100);
  const thresholdIndex = Math.max(0, totalPixels - targetFilled);
  const threshold = allValues[thresholdIndex] ?? 0.5;

  const grid: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = noise[y][x] >= threshold;
    }
  }

  return grid;
}

// ==================== ANIMATED FRAME GENERATION ====================

function generateAnimatedFrames(
  width: number,
  height: number,
  fillPercent: number,
  numFrames: number = 8
): boolean[][][] {
  const seed = Math.floor(Math.random() * 999999);
  const rng = mulberry32(seed);

  // Drift radius: how far the "camera" slides through the noise field
  const driftRadius = Math.max(2, Math.round(Math.max(width, height) * 0.06));
  const pad = driftRadius * 2 + 2;
  const totalW = width + pad;
  const totalH = height + pad;

  // --- Layer 1: low-frequency shape noise ---
  const baseScale = Math.max(totalW, totalH) / (2 + rng() * 5);
  const octaves = 2 + Math.floor(rng() * 3);
  const useWarp = rng() > 0.3;
  const warpStrength = useWarp ? 0.5 + rng() * 3 : 0;

  let noise: number[][] = Array.from({ length: totalH }, () =>
    new Array(totalW).fill(0)
  );
  let amplitude = 1;
  let totalAmplitude = 0;

  for (let o = 0; o < octaves; o++) {
    const scale = baseScale / Math.pow(2, o);
    const layer = valueNoise2D(totalW, totalH, scale, rng);
    for (let y = 0; y < totalH; y++) {
      for (let x = 0; x < totalW; x++) {
        noise[y][x] += layer[y][x] * amplitude;
      }
    }
    totalAmplitude += amplitude;
    amplitude *= 0.5;
  }

  for (let y = 0; y < totalH; y++) {
    for (let x = 0; x < totalW; x++) {
      noise[y][x] /= totalAmplitude;
    }
  }

  if (useWarp) {
    const warpNoiseX = valueNoise2D(totalW, totalH, baseScale * 0.7, rng);
    const warpNoiseY = valueNoise2D(totalW, totalH, baseScale * 0.7, rng);
    const warped: number[][] = Array.from({ length: totalH }, () =>
      new Array(totalW).fill(0)
    );
    for (let y = 0; y < totalH; y++) {
      for (let x = 0; x < totalW; x++) {
        const wx = Math.min(
          totalW - 1,
          Math.max(
            0,
            Math.round(
              x + (warpNoiseX[y][x] - 0.5) * warpStrength * baseScale
            )
          )
        );
        const wy = Math.min(
          totalH - 1,
          Math.max(
            0,
            Math.round(
              y + (warpNoiseY[y][x] - 0.5) * warpStrength * baseScale
            )
          )
        );
        warped[y][x] = noise[wy][wx];
      }
    }
    noise = warped;
  }

  // --- Layer 2: high-frequency detail noise ---
  const detailScale = Math.max(totalW, totalH) / (12 + rng() * 18);
  const detailOctaves = 3 + Math.floor(rng() * 3);
  const detail: number[][] = Array.from({ length: totalH }, () =>
    new Array(totalW).fill(0)
  );
  let dAmp = 1;
  let dTotal = 0;
  for (let o = 0; o < detailOctaves; o++) {
    const scale = detailScale / Math.pow(2, o);
    const layer = valueNoise2D(totalW, totalH, scale, rng);
    for (let y = 0; y < totalH; y++) {
      for (let x = 0; x < totalW; x++) {
        detail[y][x] += layer[y][x] * dAmp;
      }
    }
    dTotal += dAmp;
    dAmp *= 0.6;
  }
  for (let y = 0; y < totalH; y++) {
    for (let x = 0; x < totalW; x++) {
      detail[y][x] /= dTotal;
    }
  }

  // --- Blend ---
  const detailWeight = 0.3 + rng() * 0.15;
  for (let y = 0; y < totalH; y++) {
    for (let x = 0; x < totalW; x++) {
      noise[y][x] =
        noise[y][x] * (1 - detailWeight) + detail[y][x] * detailWeight;
    }
  }

  // --- Sample frames by sliding a window in a circle ---
  const frames: boolean[][][] = [];
  const cx = Math.floor(pad / 2);
  const cy = Math.floor(pad / 2);

  for (let f = 0; f < numFrames; f++) {
    const angle = (2 * Math.PI * f) / numFrames;
    const ox = cx + Math.round(Math.cos(angle) * driftRadius);
    const oy = cy + Math.round(Math.sin(angle) * driftRadius);

    // Compute per-frame threshold for consistent fill %
    const vals: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        vals.push(noise[oy + y][ox + x]);
      }
    }
    vals.sort((a, b) => a - b);
    const total = width * height;
    const threshold =
      vals[Math.max(0, total - Math.floor((total * fillPercent) / 100))] ?? 0.5;

    const grid: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = noise[oy + y][ox + x] >= threshold;
      }
    }
    frames.push(grid);
  }

  return frames;
}

// ==================== SVG MERGING ====================

interface MergedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Greedy rectangle merging: scan each row for horizontal runs of filled pixels,
 * then extend each run downward as far as possible. This produces the minimal
 * number of rectangles, all combined into a single <path>.
 */
function mergePixelsToRects(
  grid: boolean[][],
  width: number,
  height: number
): MergedRect[] {
  const used: boolean[][] = Array.from({ length: height }, () =>
    new Array(width).fill(false)
  );
  const rects: MergedRect[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] && !used[y][x]) {
        // Find max horizontal run
        let w = 0;
        while (x + w < width && grid[y][x + w] && !used[y][x + w]) w++;

        // Extend downward
        let h = 1;
        let canExtend = true;
        while (y + h < height && canExtend) {
          for (let dx = 0; dx < w; dx++) {
            if (!grid[y + h][x + dx] || used[y + h][x + dx]) {
              canExtend = false;
              break;
            }
          }
          if (canExtend) h++;
        }

        // Mark cells as used
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            used[y + dy][x + dx] = true;
          }
        }

        rects.push({ x, y, w, h });
      }
    }
  }

  return rects;
}

function rectsToPathD(rects: MergedRect[]): string {
  return rects
    .map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}z`)
    .join('');
}

function buildSVGString(
  grid: boolean[][],
  gridW: number,
  gridH: number,
  pixelColor: string,
  bgColor: string,
  extraAttrs: string = ''
): string {
  const rects = mergePixelsToRects(grid, gridW, gridH);
  const pathD = rectsToPathD(rects);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridW} ${gridH}" shape-rendering="crispEdges"${extraAttrs ? ' ' + extraAttrs : ''}>`,
    `<rect width="${gridW}" height="${gridH}" fill="${bgColor}"/>`,
    `<path d="${pathD}" fill="${pixelColor}"/>`,
    `</svg>`,
  ].join('\n');
}

function buildAnimatedSVGString(
  frames: boolean[][][],
  gridW: number,
  gridH: number,
  pixelColor: string,
  bgColor: string,
  duration: number,
  extraAttrs: string = ''
): string {
  const pathDs = frames.map((grid) => {
    const rects = mergePixelsToRects(grid, gridW, gridH);
    return rectsToPathD(rects);
  });

  // Loop back to first frame for seamless repeat
  const values = [...pathDs, pathDs[0]].join(';\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridW} ${gridH}" shape-rendering="crispEdges"${extraAttrs ? ' ' + extraAttrs : ''}>`,
    `<rect width="${gridW}" height="${gridH}" fill="${bgColor}"/>`,
    `<path d="${pathDs[0]}" fill="${pixelColor}">`,
    `<animate attributeName="d" calcMode="discrete" dur="${duration}s" repeatCount="indefinite" values="${values}"/>`,
    `</path>`,
    `</svg>`,
  ].join('\n');
}

// ==================== APP COMPONENT ====================

function App() {
  const [gridWidth, setGridWidth] = useState(32);
  const [gridHeight, setGridHeight] = useState(32);
  const [fillPercent, setFillPercent] = useState(60);
  const [pixelColor, setPixelColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [pngWidth, setPngWidth] = useState(1024);
  const [pngHeight, setPngHeight] = useState(1024);
  const [animDuration, setAnimDuration] = useState(3);

  const [grid, setGrid] = useState<boolean[][] | null>(null);
  const [frames, setFrames] = useState<boolean[][][] | null>(null);
  const [displaySVG, setDisplaySVG] = useState('');
  const [rectCount, setRectCount] = useState(0);
  const [filledCount, setFilledCount] = useState(0);

  const handleGenerate = useCallback(() => {
    const w = Math.max(1, Math.min(512, gridWidth));
    const h = Math.max(1, Math.min(512, gridHeight));
    const newFrames = generateAnimatedFrames(w, h, fillPercent, 8);
    const firstFrame = newFrames[0];
    setFrames(newFrames);
    setGrid(firstFrame);

    // Count filled pixels (from first frame)
    let filled = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (firstFrame[y][x]) filled++;
      }
    }
    setFilledCount(filled);

    const rects = mergePixelsToRects(firstFrame, w, h);
    setRectCount(rects.length);

    const svg = buildAnimatedSVGString(
      newFrames,
      w,
      h,
      pixelColor,
      bgColor,
      animDuration,
      'style="width:100%;height:100%;display:block"'
    );
    setDisplaySVG(svg);
  }, [gridWidth, gridHeight, fillPercent, pixelColor, bgColor, animDuration]);

  // Update display when colors or duration change without regenerating
  const updateDisplay = useCallback(
    (newPixelColor: string, newBgColor: string, newDuration: number) => {
      if (!frames) return;
      const w = Math.max(1, Math.min(512, gridWidth));
      const h = Math.max(1, Math.min(512, gridHeight));
      const svg = buildAnimatedSVGString(
        frames,
        w,
        h,
        newPixelColor,
        newBgColor,
        newDuration,
        'style="width:100%;height:100%;display:block"'
      );
      setDisplaySVG(svg);
    },
    [frames, gridWidth, gridHeight]
  );

  const handlePixelColorChange = (color: string) => {
    setPixelColor(color);
    updateDisplay(color, bgColor, animDuration);
  };

  const handleBgColorChange = (color: string) => {
    setBgColor(color);
    updateDisplay(pixelColor, color, animDuration);
  };

  const handleDurationChange = (dur: number) => {
    setAnimDuration(dur);
    updateDisplay(pixelColor, bgColor, dur);
  };

  const handleDownloadSVG = useCallback(() => {
    if (!frames) return;
    const w = Math.max(1, Math.min(512, gridWidth));
    const h = Math.max(1, Math.min(512, gridHeight));
    const svg = buildAnimatedSVGString(
      frames,
      w,
      h,
      pixelColor,
      bgColor,
      animDuration,
      `width="${w}" height="${h}"`
    );

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixel-art-${w}x${h}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [frames, gridWidth, gridHeight, pixelColor, bgColor, animDuration]);

  const handleDownloadPNG = useCallback(() => {
    if (!grid) return;
    const w = Math.max(1, Math.min(512, gridWidth));
    const h = Math.max(1, Math.min(512, gridHeight));

    // PNG uses first frame (static snapshot)
    const svg = buildSVGString(
      grid,
      w,
      h,
      pixelColor,
      bgColor,
      `width="${pngWidth}" height="${pngHeight}"`
    );

    const canvas = document.createElement('canvas');
    canvas.width = pngWidth;
    canvas.height = pngHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svg], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, pngWidth, pngHeight);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `pixel-art-${pngWidth}x${pngHeight}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.src = url;
  }, [grid, gridWidth, gridHeight, pixelColor, bgColor, pngWidth, pngHeight]);

  const totalPixels = Math.max(1, Math.min(512, gridWidth)) * Math.max(1, Math.min(512, gridHeight));

  return (
    <div className="h-screen flex bg-slate-950 text-white">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-bold tracking-tight">
            Pixel Art SVG
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Abstract pattern generator
          </p>
        </div>

        <div className="p-5 flex flex-col gap-5 flex-1">
          {/* Grid Size */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Grid Size
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-1">
                  Width
                </label>
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={gridWidth}
                  onChange={(e) =>
                    setGridWidth(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex items-end pb-2 text-slate-600">
                &times;
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-1">
                  Height
                </label>
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={gridHeight}
                  onChange={(e) =>
                    setGridHeight(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Fill Percentage */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Fill Density
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={30}
                max={90}
                value={fillPercent}
                onChange={(e) => setFillPercent(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500 h-1.5"
              />
              <span className="mono text-sm text-indigo-400 w-12 text-right">
                {fillPercent}%
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>Sparse</span>
              <span>Dense</span>
            </div>
          </div>

          {/* Colors */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Colors
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={pixelColor}
                  onChange={(e) => handlePixelColorChange(e.target.value)}
                  className="w-9 h-9 rounded-md cursor-pointer bg-transparent border border-slate-700"
                />
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-500 mb-0.5">
                    Pixel Color
                  </label>
                  <input
                    type="text"
                    value={pixelColor}
                    onChange={(e) => handlePixelColorChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  className="w-9 h-9 rounded-md cursor-pointer bg-transparent border border-slate-700"
                />
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-500 mb-0.5">
                    Background
                  </label>
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => handleBgColorChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Animation Speed */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Animation Speed
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={animDuration}
                onChange={(e) =>
                  handleDurationChange(parseFloat(e.target.value))
                }
                className="flex-1 accent-indigo-500 h-1.5"
              />
              <span className="mono text-sm text-indigo-400 w-12 text-right">
                {animDuration}s
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>Fast</span>
              <span>Slow</span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-lg py-3 font-semibold text-sm tracking-wide cursor-pointer"
          >
            Generate Pattern
          </button>

          {/* Stats */}
          {grid && (
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Filled pixels</span>
                <span className="mono text-slate-300">
                  {filledCount} / {totalPixels} (
                  {Math.round((filledCount / totalPixels) * 100)}%)
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Merged rects</span>
                <span className="mono text-slate-300">{rectCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Compression</span>
                <span className="mono text-emerald-400">
                  {filledCount > 0
                    ? Math.round((1 - rectCount / filledCount) * 100)
                    : 0}
                  %
                </span>
              </div>
              {frames && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Animation</span>
                  <span className="mono text-sky-400">
                    {frames.length} frames / {animDuration}s
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Separator */}
          <hr className="border-slate-800" />

          {/* PNG Export */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              PNG Export Size
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-1">
                  Width (px)
                </label>
                <input
                  type="number"
                  min={1}
                  max={8192}
                  value={pngWidth}
                  onChange={(e) =>
                    setPngWidth(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex items-end pb-2 text-slate-600">
                &times;
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-1">
                  Height (px)
                </label>
                <input
                  type="number"
                  min={1}
                  max={8192}
                  value={pngHeight}
                  onChange={(e) =>
                    setPngHeight(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDownloadSVG}
              disabled={!frames}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors rounded-lg py-2.5 font-semibold text-sm cursor-pointer"
            >
              SVG
            </button>
            <button
              onClick={handleDownloadPNG}
              disabled={!grid}
              className="flex-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors rounded-lg py-2.5 font-semibold text-sm cursor-pointer"
            >
              PNG
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600 text-center">
          Animated pixel-art SVG output
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center checkerboard p-8">
        {displaySVG ? (
          <div
            className="max-w-full max-h-full"
            style={{
              imageRendering: 'pixelated',
              width: `min(80vh, 80%)`,
              aspectRatio: `${gridWidth} / ${gridHeight}`,
            }}
            dangerouslySetInnerHTML={{ __html: displaySVG }}
          />
        ) : (
          <div className="text-center select-none">
            <div className="text-7xl text-slate-700 mb-6 leading-none">
              &#9638;
            </div>
            <p className="text-slate-500 text-sm">
              Set parameters and click{' '}
              <span className="text-indigo-400 font-medium">
                Generate Pattern
              </span>
            </p>
            <p className="text-slate-600 text-xs mt-2">
              Each generation creates a unique abstract pattern
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
