
import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── Section Audio Configuration ──────────────────────────────────────────────
// Each section maps to an ambient drone with unique tonal character.
// To use real audio files instead, add a `src` property with the URL
// and the component will use HTMLAudioElement for that section.

interface AmbientConfig {
  baseFreq: number;
  filterFreq: number;
  volume: number;
}

interface SectionAudio {
  sectionId: string;
  label: string;
  src?: string;
  ambient: AmbientConfig;
}

const SECTION_AUDIO: SectionAudio[] = [
  {
    sectionId: 'hero',
    label: '01',
    ambient: { baseFreq: 174, filterFreq: 600, volume: 0.07 },
  },
  {
    sectionId: 'about',
    label: '02',
    ambient: { baseFreq: 220, filterFreq: 700, volume: 0.07 },
  },
  {
    sectionId: 'philosophy',
    label: '03',
    ambient: { baseFreq: 261, filterFreq: 550, volume: 0.06 },
  },
  {
    sectionId: 'services',
    label: '04',
    ambient: { baseFreq: 293, filterFreq: 750, volume: 0.07 },
  },
  {
    sectionId: 'insights',
    label: '05',
    ambient: { baseFreq: 329, filterFreq: 800, volume: 0.06 },
  },
  {
    sectionId: 'contact',
    label: '06',
    ambient: { baseFreq: 349, filterFreq: 650, volume: 0.07 },
  },
];

// ─── Ambient Sound Engine ─────────────────────────────────────────────────────

interface AmbientNodes {
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  master: GainNode;
}

function createAmbientDrone(ctx: AudioContext, config: AmbientConfig): AmbientNodes {
  const { baseFreq, filterFreq, volume } = config;

  // Low-pass filter for warmth
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.7;

  // Master gain (starts at 0 for fade-in)
  const master = ctx.createGain();
  master.gain.value = 0;
  filter.connect(master);
  master.connect(ctx.destination);

  const oscillators: OscillatorNode[] = [];

  // Fundamental
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = baseFreq;
  const g1 = ctx.createGain();
  g1.gain.value = volume;
  osc1.connect(g1);
  g1.connect(filter);
  oscillators.push(osc1);

  // Detuned copy for chorus warmth
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = baseFreq;
  osc2.detune.value = 6;
  const g2 = ctx.createGain();
  g2.gain.value = volume * 0.7;
  osc2.connect(g2);
  g2.connect(filter);
  oscillators.push(osc2);

  // Sub-octave for depth
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = baseFreq / 2;
  const g3 = ctx.createGain();
  g3.gain.value = volume * 0.35;
  osc3.connect(g3);
  g3.connect(filter);
  oscillators.push(osc3);

  // Soft fifth harmonic
  const osc4 = ctx.createOscillator();
  osc4.type = 'sine';
  osc4.frequency.value = baseFreq * 1.498;
  const g4 = ctx.createGain();
  g4.gain.value = volume * 0.15;
  osc4.connect(g4);
  g4.connect(filter);
  oscillators.push(osc4);

  // LFO for slow movement on filter frequency
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.06 + Math.random() * 0.04;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = filterFreq * 0.15;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  // Start everything
  oscillators.forEach((o) => o.start());
  lfo.start();

  return { oscillators, lfo, master };
}

function fadeIn(ctx: AudioContext, master: GainNode, duration = 2.5) {
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(0.001, now);
  master.gain.exponentialRampToValueAtTime(1, now + duration);
}

function fadeOut(ctx: AudioContext, master: GainNode, duration = 1.5): Promise<void> {
  return new Promise((resolve) => {
    const now = ctx.currentTime;
    const current = master.gain.value;
    if (current < 0.002) {
      resolve();
      return;
    }
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(current, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + duration);
    setTimeout(resolve, duration * 1000 + 50);
  });
}

function destroyNodes(nodes: AmbientNodes) {
  nodes.oscillators.forEach((o) => {
    try { o.stop(); o.disconnect(); } catch {}
  });
  try { nodes.lfo.stop(); nodes.lfo.disconnect(); } catch {}
  try { nodes.master.disconnect(); } catch {}
}

// ─── HTML Audio for file-based playback ───────────────────────────────────────

interface FileAudioState {
  element: HTMLAudioElement;
  sectionId: string;
}

// ─── AudioPlayer Component ────────────────────────────────────────────────────

export function AudioPlayer() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSection, setCurrentSection] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<AmbientNodes | null>(null);
  const activeFileRef = useRef<FileAudioState | null>(null);
  const activeSectionRef = useRef<string | null>(null);
  const isSwitchingRef = useRef(false);

  // ── Enable audio on first user click (mobile requirement) ──
  const handleEnable = useCallback(async () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume();

      // Preload any file-based audio elements with user gesture context
      SECTION_AUDIO.forEach((s) => {
        if (s.src) {
          const audio = new Audio(s.src);
          audio.load();
        }
      });

      ctxRef.current = ctx;
      setIsEnabled(true);
    } catch (err) {
      console.error('AudioPlayer: failed to initialize AudioContext', err);
    }
  }, []);

  // ── Switch to a section's audio ──
  const switchToSection = useCallback(async (sectionId: string) => {
    if (activeSectionRef.current === sectionId) return;
    if (isSwitchingRef.current) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    const config = SECTION_AUDIO.find((s) => s.sectionId === sectionId);
    if (!config) return;

    isSwitchingRef.current = true;

    // Fade out current ambient nodes
    if (activeNodesRef.current) {
      const old = activeNodesRef.current;
      await fadeOut(ctx, old.master, 1.2);
      destroyNodes(old);
      activeNodesRef.current = null;
    }

    // Fade out current file audio
    if (activeFileRef.current) {
      const el = activeFileRef.current.element;
      el.pause();
      el.currentTime = 0;
      activeFileRef.current = null;
    }

    activeSectionRef.current = sectionId;
    setCurrentSection(sectionId);

    if (config.src) {
      // File-based playback
      const audio = new Audio(config.src);
      audio.loop = true;
      audio.volume = 0.5;
      try {
        await audio.play();
        activeFileRef.current = { element: audio, sectionId };
      } catch (err) {
        console.error('AudioPlayer: failed to play audio file', err);
      }
    } else {
      // Generated ambient drone
      const nodes = createAmbientDrone(ctx, config.ambient);
      activeNodesRef.current = nodes;
      fadeIn(ctx, nodes.master, 2.5);
    }

    isSwitchingRef.current = false;
  }, []);

  // ── Toggle mute ──
  const toggleMute = useCallback(() => {
    const ctx = ctxRef.current;
    const nodes = activeNodesRef.current;
    const fileAudio = activeFileRef.current;

    if (isMuted) {
      // Unmute
      if (ctx && nodes) {
        fadeIn(ctx, nodes.master, 0.5);
      }
      if (fileAudio) {
        fileAudio.element.volume = 0.5;
      }
    } else {
      // Mute
      if (ctx && nodes) {
        nodes.master.gain.cancelScheduledValues(ctx.currentTime);
        nodes.master.gain.setValueAtTime(nodes.master.gain.value, ctx.currentTime);
        nodes.master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      }
      if (fileAudio) {
        fileAudio.element.volume = 0;
      }
    }
    setIsMuted((prev) => !prev);
  }, [isMuted]);

  // ── Disable audio completely ──
  const handleDisable = useCallback(() => {
    if (activeNodesRef.current) {
      destroyNodes(activeNodesRef.current);
      activeNodesRef.current = null;
    }
    if (activeFileRef.current) {
      activeFileRef.current.element.pause();
      activeFileRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
    activeSectionRef.current = null;
    setIsEnabled(false);
    setIsMuted(false);
    setCurrentSection(null);
  }, []);

  // ── IntersectionObserver: scroll-triggered section detection ──
  useEffect(() => {
    if (!isEnabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry;
            }
          }
        }
        if (best) {
          switchToSection(best.target.id);
        }
      },
      {
        threshold: [0.2, 0.4, 0.6],
        rootMargin: '-5% 0px -5% 0px',
      }
    );

    SECTION_AUDIO.forEach((track) => {
      const el = document.getElementById(track.sectionId);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isEnabled, switchToSection]);

  // ── Resume AudioContext on tab visibility change (mobile Safari) ──
  useEffect(() => {
    if (!isEnabled) return;

    const handleVisibility = () => {
      const ctx = ctxRef.current;
      if (document.visibilityState === 'visible' && ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isEnabled]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (activeNodesRef.current) destroyNodes(activeNodesRef.current);
      if (activeFileRef.current) activeFileRef.current.element.pause();
      if (ctxRef.current) ctxRef.current.close();
    };
  }, []);

  // ── Render: Enable button ──
  if (!isEnabled) {
    return (
      <button
        onClick={handleEnable}
        className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3 mono text-[11px] tracking-[0.15em] uppercase hover:bg-neutral-900 transition-colors duration-300 border border-white/10"
        style={{ cursor: 'pointer' }}
        aria-label="Enable ambient sound"
      >
        <span className="flex items-center gap-2.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          Sound
        </span>
      </button>
    );
  }

  // ── Render: Active player ──
  const currentConfig = SECTION_AUDIO.find((s) => s.sectionId === currentSection);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-black text-white px-4 py-3 mono text-[11px] tracking-[0.15em] uppercase flex items-center gap-3 border border-white/10">
        {/* Section index */}
        <span className="text-white/40 min-w-[18px]">
          {currentConfig ? currentConfig.label : '—'}
        </span>

        {/* Audio visualization bars */}
        <div className="flex items-end gap-[3px] h-[14px]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[2px] bg-white/80 rounded-full"
              style={{
                height: !isMuted && currentSection ? undefined : '3px',
                animation:
                  !isMuted && currentSection
                    ? `audioBar${i} ${0.6 + i * 0.15}s ease-in-out infinite alternate`
                    : 'none',
              }}
            />
          ))}
        </div>

        {/* Mute / Unmute button */}
        <button
          onClick={toggleMute}
          className="hover:opacity-60 transition-opacity duration-200 ml-1"
          style={{ cursor: 'pointer' }}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>

        {/* Close / Disable button */}
        <button
          onClick={handleDisable}
          className="hover:opacity-60 transition-opacity duration-200 ml-0.5"
          style={{ cursor: 'pointer' }}
          aria-label="Disable sound"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
