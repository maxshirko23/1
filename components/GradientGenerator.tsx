import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  renderGradient,
  exportPNG,
  PALETTES,
  STYLES,
  SIZE_PRESETS,
  type GradientParams,
  type GradientStyle,
} from './gradientEngine';

const PREVIEW_MAX = 640; // max preview dimension for performance

function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

function randomStyle(): GradientStyle {
  return STYLES[Math.floor(Math.random() * STYLES.length)].id;
}

function randomPaletteIndex(): number {
  return Math.floor(Math.random() * PALETTES.length);
}

function makeParams(): GradientParams {
  return {
    style: randomStyle(),
    paletteIndex: randomPaletteIndex(),
    seed: randomSeed(),
    grain: 0.15 + Math.random() * 0.25,
    vignette: 0.2 + Math.random() * 0.4,
  };
}

export const GradientGenerator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [params, setParams] = useState<GradientParams>(makeParams);
  const [history, setHistory] = useState<GradientParams[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const [exportW, setExportW] = useState(1920);
  const [exportH, setExportH] = useState(1080);
  const [sizePreset, setSizePreset] = useState(1);
  const [customSize, setCustomSize] = useState(false);

  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  // ---- Render preview on canvas ----
  const renderPreview = useCallback(
    (p: GradientParams) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const cw = container.clientWidth || 800;
      const ch = container.clientHeight || 600;
      // keep aspect ratio of export, fit into container
      const aspect = exportW / exportH;
      let pw: number, ph: number;
      if (cw / ch > aspect) {
        ph = Math.min(ch, PREVIEW_MAX);
        pw = Math.round(ph * aspect);
      } else {
        pw = Math.min(cw, PREVIEW_MAX);
        ph = Math.round(pw / aspect);
      }
      canvas.width = pw;
      canvas.height = ph;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      setIsRendering(true);
      // use rAF to not block the UI
      requestAnimationFrame(() => {
        renderGradient(ctx, pw, ph, p);
        setIsRendering(false);
        setFadeIn(true);
        setTimeout(() => setFadeIn(false), 400);
      });
    },
    [exportW, exportH],
  );

  useEffect(() => {
    renderPreview(params);
  }, [params, renderPreview]);

  // ---- Generate ----
  const generate = useCallback(() => {
    const np = makeParams();
    setParams(np);
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), np]);
    setHistoryIdx((prev) => prev + 1);
  }, [historyIdx]);

  // ---- Generate keeping current style ----
  const regenerate = useCallback(() => {
    const np: GradientParams = {
      ...params,
      seed: randomSeed(),
      paletteIndex: randomPaletteIndex(),
      grain: 0.15 + Math.random() * 0.25,
      vignette: 0.2 + Math.random() * 0.4,
    };
    setParams(np);
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), np]);
    setHistoryIdx((prev) => prev + 1);
  }, [params, historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      setHistoryIdx((i) => i - 1);
      setParams(history[historyIdx - 1]);
    }
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx((i) => i + 1);
      setParams(history[historyIdx + 1]);
    }
  }, [history, historyIdx]);

  // ---- Set style ----
  const setStyle = useCallback(
    (s: GradientStyle) => {
      const np = { ...params, style: s, seed: randomSeed() };
      setParams(np);
      setHistory((prev) => [...prev.slice(0, historyIdx + 1), np]);
      setHistoryIdx((prev) => prev + 1);
      setShowStylePicker(false);
    },
    [params, historyIdx],
  );

  // ---- Set palette ----
  const setPalette = useCallback(
    (idx: number) => {
      const np = { ...params, paletteIndex: idx, seed: randomSeed() };
      setParams(np);
      setHistory((prev) => [...prev.slice(0, historyIdx + 1), np]);
      setHistoryIdx((prev) => prev + 1);
      setShowPalettePicker(false);
    },
    [params, historyIdx],
  );

  // ---- Export PNG ----
  const downloadPNG = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await exportPNG(params, exportW, exportH);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gradient-${params.style}-${exportW}x${exportH}-${params.seed}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [params, exportW, exportH]);

  // ---- Size preset ----
  const selectSizePreset = useCallback(
    (idx: number) => {
      if (idx === -1) {
        setCustomSize(true);
        setShowSizePicker(false);
        return;
      }
      const p = SIZE_PRESETS[idx];
      setExportW(p.w);
      setExportH(p.h);
      setSizePreset(idx);
      setCustomSize(false);
      setShowSizePicker(false);
    },
    [],
  );

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') { e.preventDefault(); generate(); }
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) regenerate();
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        downloadPNG();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generate, regenerate, undo, redo, downloadPNG]);

  // close pickers on outside click
  useEffect(() => {
    const onClick = () => {
      setShowStylePicker(false);
      setShowPalettePicker(false);
      setShowSizePicker(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const currentStyle = STYLES.find((s) => s.id === params.style)!;
  const currentPalette = PALETTES[params.paletteIndex];

  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.logoWrap}>
          <div style={S.logo} />
          <span style={S.logoText}>Gradient Mixer</span>
          <span style={S.badge}>PRO</span>
        </div>
        <div style={S.shortcuts}>
          <span>[Space] random</span>
          <span>[R] reseed</span>
          <span>[Ctrl+S] save</span>
          <span>[Ctrl+Z] undo</span>
        </div>
      </header>

      {/* Canvas area */}
      <div ref={containerRef} style={S.canvasArea}>
        <canvas
          ref={canvasRef}
          style={{
            ...S.canvas,
            opacity: fadeIn ? 0.7 : 1,
            transition: 'opacity 0.4s ease',
          }}
        />
        {isRendering && <div style={S.renderingBadge}>Rendering...</div>}

        {/* Info overlay */}
        <div style={S.infoBadge}>
          {currentStyle.name} / {currentPalette.name} / seed: {params.seed}
        </div>
      </div>

      {/* Controls toolbar */}
      <div style={S.toolbar}>
        {/* Generate */}
        <button onClick={generate} style={S.btnPrimary}>
          Generate
        </button>

        {/* Style picker */}
        <div style={S.dropdownWrap}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowStylePicker((v) => !v); setShowPalettePicker(false); setShowSizePicker(false); }}
            style={S.btnSecondary}
          >
            {currentStyle.name} ▾
          </button>
          {showStylePicker && (
            <div style={S.dropdown} onClick={(e) => e.stopPropagation()}>
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  style={{
                    ...S.dropdownItem,
                    background: s.id === params.style ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                >
                  <span style={S.dropdownTitle}>{s.name}</span>
                  <span style={S.dropdownDesc}>{s.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Palette picker */}
        <div style={S.dropdownWrap}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowPalettePicker((v) => !v); setShowStylePicker(false); setShowSizePicker(false); }}
            style={S.btnSecondary}
          >
            <span style={S.palettePreview}>
              {currentPalette.colors.slice(0, 5).map((c, i) => (
                <span key={i} style={{ ...S.paletteDot, background: c }} />
              ))}
            </span>
            {currentPalette.name} ▾
          </button>
          {showPalettePicker && (
            <div style={{ ...S.dropdown, ...S.paletteDropdown }} onClick={(e) => e.stopPropagation()}>
              {PALETTES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setPalette(idx)}
                  style={{
                    ...S.dropdownItem,
                    background: idx === params.paletteIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                >
                  <span style={S.palettePreview}>
                    {p.colors.map((c, i) => (
                      <span key={i} style={{ ...S.paletteDot, background: c }} />
                    ))}
                  </span>
                  <span style={S.dropdownTitle}>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={S.separator} />

        {/* Size picker */}
        <div style={S.dropdownWrap}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSizePicker((v) => !v); setShowStylePicker(false); setShowPalettePicker(false); }}
            style={S.btnSecondary}
          >
            {exportW} x {exportH} ▾
          </button>
          {showSizePicker && (
            <div style={S.dropdown} onClick={(e) => e.stopPropagation()}>
              {SIZE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => selectSizePreset(idx)}
                  style={{
                    ...S.dropdownItem,
                    background: !customSize && idx === sizePreset ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                >
                  <span style={S.dropdownTitle}>{p.label}</span>
                </button>
              ))}
              <button
                onClick={() => selectSizePreset(-1)}
                style={{
                  ...S.dropdownItem,
                  background: customSize ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
              >
                <span style={S.dropdownTitle}>Custom...</span>
              </button>
            </div>
          )}
        </div>

        {customSize && (
          <div style={S.customSizeRow}>
            <input
              type="number"
              value={exportW}
              onChange={(e) => setExportW(Math.max(100, Math.min(7680, parseInt(e.target.value) || 100)))}
              style={S.sizeInput}
              min={100}
              max={7680}
            />
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>x</span>
            <input
              type="number"
              value={exportH}
              onChange={(e) => setExportH(Math.max(100, Math.min(7680, parseInt(e.target.value) || 100)))}
              style={S.sizeInput}
              min={100}
              max={7680}
            />
          </div>
        )}

        <div style={S.separator} />

        {/* Undo / Redo */}
        <button onClick={undo} disabled={historyIdx <= 0} style={{ ...S.btnIcon, opacity: historyIdx > 0 ? 1 : 0.3 }}>
          ↶
        </button>
        <button onClick={redo} disabled={historyIdx >= history.length - 1} style={{ ...S.btnIcon, opacity: historyIdx < history.length - 1 ? 1 : 0.3 }}>
          ↷
        </button>

        <div style={{ flex: 1 }} />

        {/* Download */}
        <button onClick={downloadPNG} disabled={isExporting} style={S.btnDownload}>
          {isExporting ? 'Exporting...' : `Save PNG ${exportW}x${exportH}`}
        </button>
      </div>
    </div>
  );
};

// ================================================================
// Styles
// ================================================================

const S: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    overflow: 'hidden',
  },
  header: {
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff006e, #3a86ff, #8338ec)',
    filter: 'blur(0.5px)',
  },
  logoText: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' },
  badge: {
    fontSize: 9,
    fontWeight: 700,
    background: 'linear-gradient(135deg, #ff006e, #8338ec)',
    padding: '2px 6px',
    borderRadius: 4,
    letterSpacing: '0.08em',
  },
  shortcuts: {
    display: 'flex',
    gap: 12,
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    color: 'rgba(255,255,255,0.3)',
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: '#050505',
  },
  canvas: {
    maxWidth: '95%',
    maxHeight: '95%',
    borderRadius: 12,
    boxShadow: '0 8px 60px rgba(0,0,0,0.6)',
    imageRendering: 'auto',
  },
  renderingBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    padding: '8px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    color: 'rgba(255,255,255,0.6)',
  },
  infoBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(12px)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    color: 'rgba(255,255,255,0.5)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(15,15,15,0.95)',
    backdropFilter: 'blur(12px)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #ff006e, #8338ec)',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '-0.01em',
    transition: 'transform 0.15s, box-shadow 0.15s',
    flexShrink: 0,
  },
  btnSecondary: {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  btnIcon: {
    width: 36,
    height: 36,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnDownload: {
    padding: '10px 22px',
    background: 'rgba(52,211,153,0.15)',
    border: '1px solid rgba(52,211,153,0.3)',
    borderRadius: 10,
    color: '#34d399',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  separator: {
    width: 1,
    height: 24,
    background: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  dropdownWrap: { position: 'relative' as const, flexShrink: 0 },
  dropdown: {
    position: 'absolute' as const,
    bottom: '110%',
    left: 0,
    background: 'rgba(20,20,20,0.97)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 6,
    minWidth: 220,
    maxHeight: 360,
    overflowY: 'auto' as const,
    zIndex: 100,
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(20px)',
  },
  paletteDropdown: {
    minWidth: 260,
    maxHeight: 400,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    textAlign: 'left' as const,
    transition: 'background 0.1s',
  },
  dropdownTitle: { fontWeight: 500 },
  dropdownDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4 },
  palettePreview: { display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 },
  paletteDot: { width: 14, height: 14, borderRadius: 4, flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' },
  customSizeRow: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  sizeInput: {
    width: 72,
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    textAlign: 'center' as const,
  },
};
