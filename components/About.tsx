
import React from 'react';
import { SectionProps } from '../types';

export const About: React.FC<SectionProps> = ({ id, label, index }) => {
  return (
    <section id={id} className="px-6 max-w-[1400px] mx-auto py-32">
      <div className="flex justify-between items-start mb-16">
        <span className="mono text-[10px] uppercase tracking-[0.2em]">{index} — {label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-6">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.9] uppercase">
            I’M NOT YOUR DOCTOR. <br /> I’M YOUR ALLY.
          </h2>
        </div>
        <div className="md:col-start-7 md:col-span-6">
          <p className="text-2xl md:text-3xl font-light leading-snug text-gray-800 tracking-tight">
            Classic psychology often focuses on "fixing" what’s broken. I focus on walking through the fog with you. Many of my clients describe our sessions as talking to a deeply empathetic, highly observant friend who happens to understand the human mind.
          </p>
          
          <div className="mt-20 grid grid-cols-2 gap-12 border-t border-black/10 pt-8">
            <div>
              <span className="mono text-[10px] uppercase opacity-40 block mb-4 tracking-widest">My focus</span>
              <p className="text-sm font-bold uppercase tracking-widest">Complex Life Transitions</p>
            </div>
            <div>
              <span className="mono text-[10px] uppercase opacity-40 block mb-4 tracking-widest">My style</span>
              <p className="text-sm font-bold uppercase tracking-widest">Unfiltered Empathy</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
