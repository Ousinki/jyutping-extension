'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface ParticleBauhiniaLogoProps {
  onSelectTab: (tabId: string) => void;
}

interface Particle {
  // Relative offset from center of flower
  ox: number;
  oy: number;
  // Current coordinates
  x: number;
  y: number;
  // Velocity & force
  vx: number;
  vy: number;
  // Target position
  tx: number;
  ty: number;
  // Noise / flight parameters
  scatterAngle: number;
  scatterSpeed: number;
  noiseOffset: number;
  size: number;
  color: string;
  alpha: number;
}

export const ParticleBauhiniaLogo: React.FC<ParticleBauhiniaLogoProps> = ({ onSelectTab }) => {
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const isLoadedRef = useRef(false);

  // Exact Canvas Coordinate Anchors
  // Canvas width: 220px, height: 60px
  const POS_LEFT = { x: 26, y: 30 }; // Left standalone position
  const POS_JYUT = { x: 104, y: 30 }; // Exact center of JYUT

  // 1. Pixel Extraction from SVG
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = '/logo-flower.svg';

    img.onload = () => {
      const size = 52;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = size;
      offCanvas.height = size;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0, size, size);
      const imgData = offCtx.getImageData(0, 0, size, size).data;

      const particles: Particle[] = [];
      const step = 1.6; // High density sampling: ~450 crisp micro-particles

      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const px = Math.floor(x);
          const py = Math.floor(y);
          const idx = (py * size + px) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const a = imgData[idx + 3];

          if (a > 60) {
            const ox = x - size / 2;
            const oy = y - size / 2;
            const seed = (x * 37 + y * 59) % 1000;
            const angle = (seed / 1000) * Math.PI * 2;

            particles.push({
              ox,
              oy,
              x: POS_JYUT.x + ox,
              y: POS_JYUT.y + oy,
              vx: 0,
              vy: 0,
              tx: POS_JYUT.x + ox,
              ty: POS_JYUT.y + oy,
              scatterAngle: angle,
              scatterSpeed: 0.8 + (seed % 10) * 0.25,
              noiseOffset: seed,
              size: 1.1 + (seed % 5) * 0.1,
              color: `rgba(${r || 234}, ${g || 40}, ${b || 59}, 1)`,
              alpha: 0.35,
            });
          }
        }
      }

      particlesRef.current = particles;
      isLoadedRef.current = true;
    };
  }, []);

  // 2. Smooth, Luxurious Particle Morphing Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const loop = () => {
      time += 0.016;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      if (!isLoadedRef.current) {
        animRef.current = requestAnimationFrame(loop);
        ctx.restore();
        return;
      }

      const targetCenter = isHovered ? POS_LEFT : POS_JYUT;
      const targetAlpha = isHovered ? 0.95 : 0.35;
      const particles = particlesRef.current;

      particles.forEach((p) => {
        // Compute home destination
        const destX = targetCenter.x + p.ox;
        const destY = targetCenter.y + p.oy;

        // Distance to target
        const dx = destX - p.x;
        const dy = destY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Smooth luxurious spring force (slow, silky, no rush)
        const spring = 0.042;
        const friction = 0.84;

        // Subtle airflow / floating noise while in transit
        if (dist > 3) {
          const noiseX = Math.sin(time * 3 + p.noiseOffset) * 0.4;
          const noiseY = Math.cos(time * 3 + p.noiseOffset) * 0.4;
          p.vx += (dx * spring) + noiseX * 0.2;
          p.vy += (dy * spring) + noiseY * 0.2;
        } else {
          p.vx += dx * spring;
          p.vy += dy * spring;
        }

        p.vx *= friction;
        p.vy *= friction;

        p.x += p.vx;
        p.y += p.vy;

        // Alpha smooth linear interpolation
        p.alpha += (targetAlpha - p.alpha) * 0.05;

        // Render Particle Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(loop);
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    loop();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isHovered]);

  return (
    <div
      onClick={() => onSelectTab('home')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex items-center group cursor-pointer select-none py-1 min-w-[240px]"
    >
      <div className="relative flex items-center pl-[56px]">
        {/* Continuous 60FPS Particle Canvas (Always active, no image swaps, no flickering!) */}
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{ width: '220px', height: '60px' }}
        />

        {/* Text Block: 100% Fixed & Stationary */}
        <div className="relative z-20 flex items-center gap-2">
          {/* Large JYUT in Cinzel Serif */}
          <span
            style={{ fontFamily: 'var(--font-cinzel), "Times New Roman", serif' }}
            className="font-bold text-3xl sm:text-[34px] tracking-wide text-slate-900 dark:text-white leading-none"
          >
            JYUT
          </span>

          {/* Right: Stacked .HK on top and 粵語學習空間 on bottom */}
          <div className="flex flex-col justify-center">
            <span
              style={{ fontFamily: 'var(--font-cinzel), "Times New Roman", serif' }}
              className="font-bold text-sm sm:text-[15px] text-amber-500 dark:text-amber-400 leading-none tracking-wider group-hover:text-amber-400 transition-colors"
            >
              .HK
            </span>
            <span className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 font-medium leading-none tracking-tight whitespace-nowrap pt-1.5 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
              粵語學習空間
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
