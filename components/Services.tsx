
import React from 'react';
import { SectionProps } from '../types';

export const Services: React.FC<SectionProps> = ({ id, label, index }) => {
  const items = [
    "Crisis Support",
    "Identity Shifts",
    "Grief & Loss",
    "Relationship Burnout",
    "Executive Loneliness",
    "Existential Dread"
  ];

  return (
    <section id={id} className="px-6 max-w-[1400px] mx-auto py-32 border-t border-black/5">
      <div className="flex justify-between items-start mb-24">
        <span className="mono text-[10px] uppercase tracking-[0.2em]">{index} — {label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-6">
          <h2 className="text-4xl font-bold tracking-tighter mb-6 uppercase">Areas we <br /> explore.</h2>
          <p className="text-gray-400 text-sm max-w-xs mono uppercase tracking-widest leading-relaxed">
            Specific situations require a specific kind of listening. I specialize in the "messy middle" of life where textbook answers fail.
          </p>
        </div>
        <div className="md:col-start-7 md:col-span-6">
          <div className="grid grid-cols-1 gap-y-16">
            <div className="grid grid-cols-2 gap-x-8 gap-y-24">
              {items.map((item, i) => (
                <div key={i} className="flex items-start space-x-4 group relative">
                  <span className="mono text-[10px] opacity-20 pt-2">[{i+1}]</span>
                  <span className="text-3xl md:text-5xl font-bold tracking-tighter leading-none hover:italic transition-all cursor-default">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
