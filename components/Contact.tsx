
import React from 'react';
import { SectionProps } from '../types';
import { GeminiChat } from './GeminiChat';

export const Contact: React.FC<SectionProps> = ({ id, label, index }) => {
  return (
    <section id={id} className="px-6 max-w-[1400px] mx-auto py-32 bg-[#fafafa]">
      <div className="flex justify-between items-start mb-24">
        <span className="mono text-[10px] uppercase tracking-[0.2em]">{index} — {label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
        <div className="md:col-span-6">
          <h2 className="text-7xl md:text-[100px] font-bold tracking-tighter leading-[0.8] mb-16 uppercase">
            READY <br /> TO BE <br /> HEARD?
          </h2>
          
          <div className="space-y-16">
            <p className="text-xl text-gray-600 max-w-sm leading-relaxed">
              Start with a 15-minute chemistry call. It’s free, it’s low pressure, and it’s for us to see if we "click".
            </p>
            
            <form className="space-y-10 max-w-md">
              <div className="border-b border-black/20 pb-4">
                <input type="text" placeholder="YOUR NAME" className="bg-transparent w-full outline-none text-xl font-bold uppercase tracking-widest placeholder:text-black/10" />
              </div>
              <div className="border-b border-black/20 pb-4">
                <input type="email" placeholder="EMAIL ADDRESS" className="bg-transparent w-full outline-none text-xl font-bold uppercase tracking-widest placeholder:text-black/10" />
              </div>
              <button className="w-full bg-black text-white py-7 uppercase tracking-[0.4em] font-black text-[10px] hover:bg-zinc-800 transition-colors">
                Initiate Conversation
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-start-7 md:col-span-6 border border-black/10 p-12 bg-white shadow-2xl shadow-black/[0.02] flex flex-col min-h-[600px]">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="mono text-[10px] uppercase font-black tracking-widest">Real-time Vibe Check (AI)</span>
            </div>
            <span className="mono text-[10px] opacity-20">[BETA]</span>
          </div>
          
          <p className="text-[10px] text-gray-400 mb-12 uppercase tracking-widest font-bold leading-relaxed">
            Not sure if I'm the right fit? Ask me anything about my approach below. My AI twin is trained on my empathy.
          </p>
          
          <GeminiChat />
        </div>
      </div>
    </section>
  );
};
