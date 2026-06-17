import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const slides = [
  { id: 1, src: '/slider/slide1.png', alt: 'Dashboard' },
  { id: 2, src: '/slider/slide2.png', alt: 'Dashboard Financeiro' },
  { id: 3, src: '/slider/slide3.png', alt: 'Despesas' },
  { id: 4, src: '/slider/slide4.png', alt: 'Evolução do Aluno' },
  { id: 5, src: '/slider/slide5.png', alt: 'Mensalidades e Aulas' },
  { id: 6, src: '/slider/slide6.png', alt: 'Configurações do Sistema' },
  { id: 7, src: '/slider/slide7.png', alt: 'Visualização de Alunos' },
  { id: 8, src: '/slider/slide8.png', alt: 'Relatório Completo' },
  { id: 9, src: '/slider/slide9.png', alt: 'Gestão Escolar' },
  { id: 10, src: '/slider/slide10.png', alt: 'Agenda e Frequência' },
];

const AUTOPLAY_INTERVAL = 5000;

export function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));
    }, AUTOPLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [isHovered]);

  const nextSlide = () => setCurrent(current === slides.length - 1 ? 0 : current + 1);
  const prevSlide = () => setCurrent(current === 0 ? slides.length - 1 : current - 1);

  return (
    <div 
      className="relative w-full max-w-7xl mx-auto rounded-3xl overflow-hidden shadow-2xl aspect-[21/9] bg-slate-900 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={current}
          src={slides[current].src}
          alt={slides[current].alt}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>

      {/* OVERLAY GRADIENTE PARA CONTRASTE */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

      {/* SETAS */}
      <button 
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/30 hover:bg-primary text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-10"
      >
        <ChevronLeft size={28} />
      </button>
      
      <button 
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/30 hover:bg-primary text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-10"
      >
        <ChevronRight size={28} />
      </button>

      {/* DOTS PONTINHOS INFERIORES */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`transition-all duration-300 rounded-full ${
              current === idx 
                ? 'w-10 h-2.5 bg-primary' 
                : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
