
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="px-6 max-w-[1400px] mx-auto py-24 border-t border-black/10">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pt-12">
        <div className="md:col-span-5">
          <div className="text-4xl font-black tracking-tighter mb-6 uppercase leading-none">THE MODERN <br /> EMPATHETIC®</div>
          <p className="mono text-[10px] uppercase opacity-40 tracking-widest">EST. 2024 / WORLDWIDE SUPPORT</p>
        </div>
        
        <div className="md:col-start-7 md:col-span-2 space-y-8">
          <span className="mono text-[10px] uppercase opacity-40 block tracking-[0.2em]">Navigation</span>
          <ul className="text-[10px] uppercase tracking-[0.2em] space-y-4 font-black">
            <li className="hover:line-through cursor-pointer">Approach</li>
            <li className="hover:line-through cursor-pointer">Support</li>
            <li className="hover:line-through cursor-pointer">Notes</li>
            <li className="hover:line-through cursor-pointer">Legal</li>
          </ul>
        </div>

        <div className="md:col-start-9 md:col-span-2 space-y-8">
          <span className="mono text-[10px] uppercase opacity-40 block tracking-[0.2em]">Connect</span>
          <ul className="text-[10px] uppercase tracking-[0.2em] space-y-4 font-black">
            <li className="hover:line-through cursor-pointer">Instagram</li>
            <li className="hover:line-through cursor-pointer">LinkedIn</li>
            <li className="hover:line-through cursor-pointer">Substack</li>
          </ul>
        </div>

        <div className="md:col-start-11 md:col-span-2 text-right">
          <div className="text-[10px] mono uppercase opacity-40 mb-6 tracking-widest">BASED IN LONDON</div>
          <div className="text-sm font-bold uppercase tracking-widest border-b border-black/10 pb-2 inline-block">hello@modernempathetic.com</div>
        </div>
      </div>
      
      <div className="mt-40 flex justify-between items-end overflow-hidden">
        <div className="text-[15vw] font-black tracking-tighter leading-none opacity-[0.03] pointer-events-none select-none -mb-10 -ml-4 uppercase">
          EMPATHY
        </div>
        <div className="text-[9px] mono uppercase opacity-20 pb-4 tracking-widest">© 2024 Modern Empathetic. All rights reserved.</div>
      </div>
    </footer>
  );
};
