
import React from 'react';
import { SectionProps } from '../types';

export const Philosophy: React.FC<SectionProps> = ({ id, label, index }) => {
  const points = [
    { title: "No clinical jargon", desc: "We speak in plain language about things that hurt." },
    { title: "Radical Presence", desc: "I don't just 'listen' — I am fully there with you." },
    { title: "Non-Judgmental Space", desc: "Everything is welcome here. No exceptions." },
    { title: "Real Conversations", desc: "Expect questions that challenge and comfort in equal measure." }
  ];

  return (
    <section id={id} className="bg-black text-white px-6 py-32">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-start mb-16">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">{index} — {label}</span>
        </div>

        <h2 className="text-5xl md:text-8xl font-bold tracking-tighter mb-24 leading-[0.9]">
          WHY FRIENDSHIP <br /> HEALS BETTER <br /> THAN DISTANCE.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-t border-white/20">
          {points.map((p, idx) => (
            <div key={idx} className="border-r border-white/10 p-8 last:border-r-0 hover:bg-white/5 transition-colors">
              <span className="mono text-xs mb-8 block">0{idx + 1}</span>
              <h3 className="text-xl font-bold mb-4 uppercase tracking-tight leading-none">{p.title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
