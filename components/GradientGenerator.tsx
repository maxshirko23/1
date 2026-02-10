import React, { useState, useCallback, useRef, useEffect } from 'react';

interface GradientLayer {
  type: 'radial' | 'linear' | 'conic';
  x: number;
  y: number;
  color: string;
  size: number;
  angle?: number;
  opacity: number;
}

interface GradientConfig {
  layers: GradientLayer[];
  blurAmount: number;
  contrast: number;
  saturate: number;
  hueRotate: number;
  bgColor: string;
  blendMode: string;
  noiseOpacity: number;
}

const PALETTES = [
  ['#ff006e', '#3a86ff', '#8338ec', '#fb5607', '#ffbe0b'],
  ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'],
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
  ['#606c38', '#283618', '#fefae0', '#dda15e', '#bc6c25'],
  ['#003049', '#d62828', '#f77f00', '#fcbf49', '#eae2b7'],
  ['#10002b', '#240046', '#3c096c', '#5a189a', '#7b2cbf'],
  ['#d9ed92', '#b5e48c', '#76c893', '#34a0a4', '#168aad'],
  ['#ff0a54', '#ff477e', '#ff5c8a', '#ff7096', '#ff85a1'],
  ['#0d1b2a', '#1b263b', '#415a77', '#778da9', '#e0e1dd'],
  ['#590d22', '#800f2f', '#a4133c', '#c9184a', '#ff4d6d'],
  ['#03071e', '#370617', '#6a040f', '#9d0208', '#dc2f02'],
  ['#7400b8', '#6930c3', '#5e60ce', '#5390d9', '#4ea8de'],
  ['#ffcbf2', '#f3c4fb', '#ecbcfd', '#e5b3fe', '#e2afff'],
  ['#2d00f7', '#6a00f4', '#8900f2', '#a100f2', '#b100e8'],
  ['#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff'],
  ['#001219', '#005f73', '#0a9396', '#94d2bd', '#e9d8a6'],
];

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'soft-light',
  'hard-light', 'color-dodge', 'color-burn', 'difference',
];

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max));
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function generateConfig(): GradientConfig {
  const palette = randomPick(PALETTES);
  const layerCount = randomInt(4, 9);
  const layers: GradientLayer[] = [];

  for (let i = 0; i < layerCount; i++) {
    const type = randomPick(['radial', 'radial', 'radial', 'linear', 'conic'] as const);
    layers.push({
      type,
      x: randomRange(5, 95),
      y: randomRange(5, 95),
      color: randomPick(palette),
      size: randomRange(25, 80),
      angle: randomRange(0, 360),
      opacity: randomRange(0.4, 1),
    });
  }

  return {
    layers,
    blurAmount: randomRange(30, 80),
    contrast: randomRange(1.0, 1.5),
    saturate: randomRange(1.0, 2.0),
    hueRotate: randomRange(0, 30),
    bgColor: randomPick(palette),
    blendMode: randomPick(BLEND_MODES),
    noiseOpacity: randomRange(0.02, 0.08),
  };
}

function buildGradientCSS(config: GradientConfig): string {
  const gradients = config.layers.map((layer) => {
    const color = hexToRgba(layer.color, layer.opacity);
    if (layer.type === 'radial') {
      return `radial-gradient(ellipse ${layer.size}% ${layer.size * randomRange(0.6, 1.4)}% at ${layer.x}% ${layer.y}%, ${color} 0%, transparent 70%)`;
    } else if (layer.type === 'conic') {
      return `conic-gradient(from ${layer.angle}deg at ${layer.x}% ${layer.y}%, ${color}, transparent, ${hexToRgba(layer.color, layer.opacity * 0.5)}, transparent)`;
    } else {
      return `linear-gradient(${layer.angle}deg, ${color} 0%, transparent 60%)`;
    }
  });
  return gradients.join(',\n    ');
}

function buildFilterCSS(config: GradientConfig): string {
  return `blur(${config.blurAmount}px) contrast(${config.contrast.toFixed(2)}) saturate(${config.saturate.toFixed(2)}) hue-rotate(${config.hueRotate.toFixed(0)}deg)`;
}

const NoiseOverlay: React.FC<{ opacity: number }> = ({ opacity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;

    const imageData = ctx.createImageData(200, 200);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 255;
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
};

export const GradientGenerator: React.FC = () => {
  const [config, setConfig] = useState<GradientConfig>(generateConfig);
  const [history, setHistory] = useState<GradientConfig[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const generate = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      const newConfig = generateConfig();
      setConfig(newConfig);
      setHistory(prev => [...prev.slice(0, historyIndex + 1), newConfig]);
      setHistoryIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 500);
    }, 150);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setConfig(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setConfig(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  const cssCode = `background: ${config.bgColor};
background-image:
    ${buildGradientCSS(config)};
filter: ${buildFilterCSS(config)};
mix-blend-mode: ${config.blendMode};`;

  const copyCSS = useCallback(() => {
    navigator.clipboard.writeText(cssCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [cssCode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        generate();
      }
      if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
        setShowCode(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generate, undo, redo]);

  const gradientStyle: React.CSSProperties = {
    background: config.bgColor,
    backgroundImage: config.layers.map((layer) => {
      const color = hexToRgba(layer.color, layer.opacity);
      if (layer.type === 'radial') {
        const h = layer.size * (0.6 + Math.random() * 0.8);
        return `radial-gradient(ellipse ${layer.size}% ${h}% at ${layer.x}% ${layer.y}%, ${color} 0%, transparent 70%)`;
      } else if (layer.type === 'conic') {
        return `conic-gradient(from ${layer.angle}deg at ${layer.x}% ${layer.y}%, ${color}, transparent, ${hexToRgba(layer.color, layer.opacity * 0.5)}, transparent)`;
      } else {
        return `linear-gradient(${layer.angle}deg, ${color} 0%, transparent 60%)`;
      }
    }).join(', '),
    filter: buildFilterCSS(config),
    mixBlendMode: config.blendMode as any,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff006e, #3a86ff, #8338ec)',
            filter: 'blur(1px)',
          }} />
          <span style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}>
            Gradient Mixer
          </span>
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'rgba(255,255,255,0.4)',
        }}>
          <span>[Space] generate</span>
          <span>[C] code</span>
          <span>[Ctrl+Z] undo</span>
        </div>
      </header>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        padding: 24,
        gap: 24,
        minHeight: 0,
      }}>
        {/* Preview */}
        <div style={{
          flex: 1,
          position: 'relative',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div
            ref={previewRef}
            style={{
              ...gradientStyle,
              position: 'absolute',
              inset: -100,
              transition: isAnimating ? 'none' : 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: isAnimating ? 0 : 1,
            }}
          />
          <NoiseOverlay opacity={config.noiseOpacity} />

          {/* Layer indicators */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            display: 'flex',
            gap: 6,
            zIndex: 5,
          }}>
            {config.layers.map((layer, i) => (
              <div
                key={i}
                title={`${layer.type} — ${layer.color}`}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: layer.color,
                  border: '2px solid rgba(255,255,255,0.3)',
                  boxShadow: `0 0 12px ${layer.color}80`,
                  cursor: 'default',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
          </div>

          {/* Info badge */}
          <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'rgba(255,255,255,0.7)',
            zIndex: 5,
          }}>
            {config.layers.length} layers / blur: {config.blurAmount.toFixed(0)}px / blend: {config.blendMode}
          </div>
        </div>

        {/* Side Panel */}
        <div style={{
          width: showCode ? 400 : 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          transition: 'width 0.3s ease',
        }}>
          {/* Generate Button */}
          <button
            onClick={generate}
            style={{
              padding: '16px 24px',
              background: 'linear-gradient(135deg, #ff006e, #8338ec)',
              border: 'none',
              borderRadius: 14,
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'Inter', sans-serif",
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(131,56,236,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Generate New Mix
          </button>

          {/* History controls */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              style={{
                flex: 1,
                padding: '10px',
                background: historyIndex > 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: historyIndex > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                fontSize: 13,
                cursor: historyIndex > 0 ? 'pointer' : 'default',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              style={{
                flex: 1,
                padding: '10px',
                background: historyIndex < history.length - 1 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: historyIndex < history.length - 1 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                fontSize: 13,
                cursor: historyIndex < history.length - 1 ? 'pointer' : 'default',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Redo
            </button>
          </div>

          {/* Layer Details */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            padding: 16,
            flex: 1,
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {showCode ? 'CSS Code' : 'Effect Layers'}
            </div>

            {showCode ? (
              <div style={{ position: 'relative' }}>
                <pre style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                }}>
                  {cssCode}
                </pre>
                <button
                  onClick={copyCSS}
                  style={{
                    marginTop: 12,
                    padding: '8px 16px',
                    background: copied ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8,
                    color: copied ? '#34d399' : 'rgba(255,255,255,0.6)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy CSS'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {config.layers.map((layer, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: layer.color,
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'rgba(255,255,255,0.6)',
                      }}>
                        {layer.type}
                      </div>
                      <div style={{
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'rgba(255,255,255,0.25)',
                      }}>
                        {layer.color} / {layer.opacity.toFixed(2)} / {layer.size.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: 'rgba(255,255,255,0.15)',
                    }}>
                      #{i + 1}
                    </div>
                  </div>
                ))}

                {/* Effect params */}
                <div style={{
                  marginTop: 8,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 6,
                  }}>
                    Post-Processing
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.8,
                  }}>
                    blur: {config.blurAmount.toFixed(0)}px<br/>
                    contrast: {config.contrast.toFixed(2)}<br/>
                    saturate: {config.saturate.toFixed(2)}<br/>
                    hue-rotate: {config.hueRotate.toFixed(0)}deg<br/>
                    blend: {config.blendMode}<br/>
                    noise: {(config.noiseOpacity * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toggle code button */}
          <button
            onClick={() => setShowCode(prev => !prev)}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              color: 'rgba(255,255,255,0.5)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >
            {showCode ? 'Show Layers' : 'Show CSS Code'}
          </button>
        </div>
      </div>
    </div>
  );
};
