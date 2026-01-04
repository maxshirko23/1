
import React from 'react';
import { SectionProps } from '../types';

export const Hero: React.FC<SectionProps> = ({ id, label, index }) => {
  return (
    <section id={id} className="min-h-[90vh] flex flex-col justify-end px-6 max-w-[1400px] mx-auto py-12">
      <div className="flex justify-between items-start mb-12">
        <span className="mono text-[10px] uppercase tracking-[0.2em]">{index} — {label}</span>
        <span className="mono text-[10px] uppercase tracking-[0.2em] opacity-40">Available for Session 2024</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-6">
          <h1 className="text-6xl md:text-[120px] font-bold leading-[0.85] tracking-tighter mb-8">
            EMPATHY <br /> OVER <br /> ANALYSIS.
          </h1>
        </div>
        <div className="md:col-start-7 md:col-span-5 pt-4">
          <p className="text-lg md:text-xl leading-snug tracking-tight text-gray-700 mb-10">
            Navigating life's hardest turns with a human approach. No clipboards, no clinical distance. Just two people talking, honestly.
          </p>
          <div className="flex space-x-6 items-center">
            <button className="bg-black text-white text-[10px] uppercase tracking-[0.2em] px-10 py-5 font-black hover:bg-zinc-800 transition-colors">
              LET'S TALK (FREE)
            </button>
            <span className="mono text-[9px] uppercase tracking-widest opacity-40 border-b border-black/20 pb-1">Scroll to explore</span>
          </div>
        </div>
      </div>
      
      <div className="mt-24 w-full h-[1px] bg-black/10" />
    </section>
  );
};
