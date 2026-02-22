
import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { Services } from './components/Services';
import { Philosophy } from './components/Philosophy';
import { Insights } from './components/Insights';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { AudioPlayer } from './components/AudioPlayer';

function App() {
  return (
    <div className="min-h-screen selection:bg-black selection:text-white">
      <Navbar />
      
      <main className="pt-20">
        <Hero id="hero" label="Home" index="01" />
        <About id="about" label="Approach" index="02" />
        <Philosophy id="philosophy" label="Method" index="03" />
        <Services id="services" label="Support" index="04" />
        <Insights id="insights" label="Notes" index="05" />
        <Contact id="contact" label="Connect" index="06" />
      </main>

      <Footer />
      <AudioPlayer />
    </div>
  );
}

export default App;
