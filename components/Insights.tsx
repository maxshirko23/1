
import React from 'react';
import { SectionProps } from '../types';

export const Insights: React.FC<SectionProps> = ({ id, label, index }) => {
  const articles = [
    { title: "The power of saying 'I don't know'", category: "Growth", date: "Nov 20" },
    { title: "Why we mistake loneliness for failure", category: "Mindset", date: "Dec 01" },
    { title: "The art of being a human first", category: "Connection", date: "Jan 15" }
  ];

  return (
    <section id={id} className="px-6 max-w-[1400px] mx-auto py-32 border-t border-black/10">
      <div className="flex justify-between items-start mb-24">
        <span className="mono text-[10px] uppercase tracking-[0.2em]">{index} — {label}</span>
        <button className="text-[10px] uppercase tracking-[0.2em] font-black underline underline-offset-4">SEE ALL THOUGHTS</button>
      </div>

      <div className="space-y-0">
        {articles.map((art, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-4 py-16 border-b border-black/10 items-center group cursor-pointer hover:bg-gray-50/50 transition-colors">
            <div className="md:col-span-1 mono text-[10px] opacity-30">{art.date}</div>
            <div className="md:col-start-2 md:col-span-5 text-4xl md:text-5xl font-bold tracking-tighter leading-none group-hover:pl-4 transition-all">
              {art.title}
            </div>
            <div className="md:col-start-7 md:col-span-5 flex justify-between items-center px-4">
              <span className="mono text-[10px] uppercase opacity-40 tracking-widest">/ {art.category}</span>
              <div className="text-2xl font-light opacity-0 group-hover:opacity-100 transition-opacity">→</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
