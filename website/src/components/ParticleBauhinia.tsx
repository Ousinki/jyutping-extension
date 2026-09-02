'use client';

import React, { useEffect, useRef } from 'react';

interface ParticleBauhiniaProps {
  isHovered: boolean;
  className?: string;
}

interface Particle {
  // Relative offset from flower center (in [-22, +22] px)
  ox: number;
  oy: number;
  // Current dynamic position
  x: number;
  y: number;
  // Scatter velocity / random burst vectors
  scatterVx: number;
  scatterVy: number;
  delay: number;
  size: number;
  color: string;
  alpha: number;
}

export const ParticleBauhinia: React.FC<ParticleBauhiniaProps> = ({ isHovered, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const progressRef = useRef(0); // 0 = at JYUT center, 1 = assembled at left

  // Position Configuration (in canvas coordinate space)
  const CENTER_A = { x: 98, y: 27 }; // Directly behind JYUT
  const CENTER_B = { x: 26, y: 27 }; // Assembled at Left position

  // Sample authentic Bauhinia petal coordinates
  useEffect(() => {
    const rawPetal: [number, number][] = [];
    const petalCount = 5;
    const samplesPerPetal = 22;

    // Parametric approximation of the Hong Kong Bauhinia petal curve
    for (let i = 0; i < samplesPerPetal; i++) {
      const u = (i / samplesPerPetal) * Math.PI * 2;
      // Heart/drop-like petal curve
      const r = 20 * Math.sin(u / 2) * (1 + 0.3 * Math.sin(2 * u));
      const angle = (u / 2) * 1.8 - 0.4;
      const px = r * Math.cos(angle);
      const py = r * Math.sin(angle);
      rawPetal.push([px, py]);
    }

    const particles: Particle[] = [];
    const palette = ['#EA283B', '#D83131', '#F59E0B', '#FF4D6D', '#E05353'];

    for (let p = 0; p < petalCount; p++) {
      const rot = (p * 72 * Math.PI) / 180;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      rawPetal.forEach(([px, py], idx) => {
        // Rotate petal by 72 deg intervals
        const ox = px * cosR - py * sinR;
        const oy = px * sinR + py * cosR;

        // Random dispersion physics parameters for explosion
        const burstAngle = Math.random() * Math.PI * 2;
        const burstSpeed = 15 + Math.random() * 35;

        particles.push({
          ox,
          oy,
          x: CENTER_A.x + ox,
          y: CENTER_A.y + oy,
          scatterVx: Math.cos(burstAngle) * burstSpeed - 15, // bias drift to the left
          scatterVy: Math.sin(burstAngle) * burstSpeed,
          delay: Math.random() * 0.2, // staggered dispersal
          size: 1.6 + Math.random() * 1.4,
          color: palette[(p + idx) % palette.length],
          alpha: 0.35,
        });
      });
    }

    particlesRef.current = particles;
  }, []);

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let targetProgress = isHovered ? 1 : 0;

    const render = () => {
      // Smooth lerp progress (0 -> 1 on hover, 1 -> 0 on leave)
      const speed = isHovered ? 0.045 : 0.055;
      progressRef.current += (targetProgress - progressRef.current) * speed;
      const p = progressRef.current;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;

      particles.forEach((pt, i) => {
        // Timeline stages:
        // p < 0.15: in-place rotation & brightness boost
        // 0.15 <= p <= 0.65: burst scattering & flowing particles drifting left
        // p > 0.65: magnetic attraction snapping to Left target position

        let posX = CENTER_A.x + pt.ox;
        let posY = CENTER_A.y + pt.oy;
        let currentAlpha = 0.35;
        let currentScale = 1;

        if (p < 0.15) {
          // Stage 1: Spin in place + brighten
          const localP = p / 0.15;
          const spin = localP * 0.4;
          const cosS = Math.cos(spin);
          const sinS = Math.sin(spin);
          posX = CENTER_A.x + (pt.ox * cosS - pt.oy * sinS);
          posY = CENTER_A.y + (pt.ox * sinS + pt.oy * cosS);
          currentAlpha = 0.35 + localP * 0.5;
        } else if (p <= 0.7) {
          // Stage 2: Dissolution & Swirling Particle Flight
          const localP = (p - 0.15) / 0.55;
          const easeOut = Math.sin((localP * Math.PI) / 2);

          // Interpolate between Center A and Center B with curved arc
          const baseX = CENTER_A.x + (CENTER_B.x - CENTER_A.x) * easeOut;
          const baseY = CENTER_A.y + Math.sin(localP * Math.PI) * -12; // arc upward

          // Add dynamic turbulence/scatter
          const scatterMagnitude = Math.sin(localP * Math.PI);
          const turbulenceX = Math.sin(localP * 12 + i) * 6;
          const turbulenceY = Math.cos(localP * 12 + i) * 8;

          posX = baseX + pt.ox * (1 - scatterMagnitude * 0.5) + pt.scatterVx * scatterMagnitude * 0.6 + turbulenceX;
          posY = baseY + pt.oy * (1 - scatterMagnitude * 0.5) + pt.scatterVy * scatterMagnitude * 0.6 + turbulenceY;

          currentAlpha = 0.85 + Math.sin(localP * Math.PI) * 0.15;
          currentScale = 1 + scatterMagnitude * 0.5;
        } else {
          // Stage 3: Magnetic Convergence & Solidification into Left Logo
          const localP = (p - 0.7) / 0.3;
          // Spring snap easing
          const snapEase = 1 - Math.pow(1 - localP, 3);

          const fromX = CENTER_A.x + (CENTER_B.x - CENTER_A.x) * 0.7 + pt.ox * 0.8;
          const fromY = CENTER_A.y + pt.oy * 0.8;

          const toX = CENTER_B.x + pt.ox;
          const toY = CENTER_B.y + pt.oy;

          posX = fromX + (toX - fromX) * snapEase;
          posY = fromY + (toY - fromY) * snapEase;

          currentAlpha = 0.9 + snapEase * 0.1;
          currentScale = 1.3 - snapEase * 0.3;
        }

        // Draw glowing particle dot
        ctx.beginPath();
        ctx.arc(posX, posY, pt.size * currentScale, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.min(1, Math.max(0, currentAlpha));

        // Soft glow for leading particles
        if (p > 0.15 && p < 0.85 && i % 3 === 0) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = pt.color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    targetProgress = isHovered ? 1 : 0;
    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isHovered]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className || ''}`}
      style={{ width: '180px', height: '54px' }}
    />
  );
};
