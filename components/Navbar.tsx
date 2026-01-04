
import React from 'react';

export const Navbar: React.FC = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#fdfdfd]/80 backdrop-blur-md border-b border-black/5">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-black rounded-full" />
          <span className="font-semibold tracking-tighter text-xl">The Modern Empathetic</span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8 text-xs font-medium uppercase tracking-widest">
          <button onClick={() => scrollTo('about')} className="hover:line-through">Method</button>
          <button onClick={() => scrollTo('services')} className="hover:line-through">Services</button>
          <button onClick={() => scrollTo('insights')} className="hover:line-through">Notes</button>
          <button onClick={() => scrollTo('contact')} className="hover:line-through bg-black text-white px-4 py-2 rounded-full">Book a Talk</button>
        </div>

        <div className="md:hidden text-xs mono">
          [MENU]
        </div>
      </div>
    </nav>
  );
};
