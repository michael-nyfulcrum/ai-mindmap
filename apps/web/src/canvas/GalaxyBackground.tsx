import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: [number, number, number];
  phase: number;
  twinkleSpeed: number;
  bright: boolean;
};

// Cosmic palette — cyan, violet, magenta, electric blue — for a "galaxy brain" feel.
const PALETTE: Array<[number, number, number]> = [
  [69, 220, 255],
  [126, 87, 255],
  [255, 95, 206],
  [90, 171, 255],
];

const LINK_DISTANCE = 122;

/**
 * Full-bleed animated backdrop: drifting nodes wired together by glowing
 * synapse lines when they pass close to each other — an ambient neural network.
 * Sits behind the canvas/flow and is purely decorative (pointer-events: none).
 */
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;

    const random = (min: number, max: number) => min + Math.random() * (max - min);

    function spawn(): Particle {
      const bright = Math.random() < 0.24;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: random(-0.14, 0.14),
        vy: random(-0.14, 0.14),
        radius: bright ? random(1.5, 2.7) : random(0.6, 1.4),
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: random(0.6, 1.8),
        bright,
      };
    }

    function seed() {
      const target = Math.round((width * height) / 12500);
      const count = Math.max(48, Math.min(150, target));
      particles = Array.from({ length: count }, spawn);
    }

    function measure() {
      const parent = canvas?.parentElement;
      const nextWidth = canvas?.clientWidth || parent?.clientWidth || window.innerWidth;
      const nextHeight = canvas?.clientHeight || parent?.clientHeight || window.innerHeight;
      if (nextWidth <= 0 || nextHeight <= 0 || !canvas || !ctx) {
        return;
      }
      width = nextWidth;
      height = nextHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particles.length === 0) {
        seed();
      }
      if (reduceMotion) {
        render(0);
      }
    }

    function drawLinks() {
      if (!ctx) {
        return;
      }
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DISTANCE * LINK_DISTANCE) {
            continue;
          }
          const dist = Math.sqrt(distSq);
          const strength = 1 - dist / LINK_DISTANCE;
          const r = Math.round((a.color[0] + b.color[0]) / 2);
          const g = Math.round((a.color[1] + b.color[1]) / 2);
          const bl = Math.round((a.color[2] + b.color[2]) / 2);
          // Kept faint so the ambient mesh never competes with real node edges.
          ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${strength * 0.2})`;
          ctx.lineWidth = strength * 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    function drawParticle(p: Particle, time: number) {
      const twinkle = 0.55 + 0.45 * Math.sin(time * p.twinkleSpeed + p.phase);
      const [r, g, b] = p.color;
      if (p.bright) {
        const halo = p.radius * 6;
        const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.45 * twinkle})`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, halo, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.85 * twinkle})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx!.fill();
    }

    function render(time: number) {
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, width, height);
      // Additive blending makes overlapping synapses and stars bloom with light.
      ctx.globalCompositeOperation = "lighter";
      drawLinks();
      for (const p of particles) {
        drawParticle(p, time);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function update() {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -24) {
          p.x = width + 24;
        } else if (p.x > width + 24) {
          p.x = -24;
        }
        if (p.y < -24) {
          p.y = height + 24;
        } else if (p.y > height + 24) {
          p.y = -24;
        }
      }
    }

    function loop(t: number) {
      update();
      render(t / 1000);
      if (running) {
        raf = requestAnimationFrame(loop);
      }
    }

    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(canvas.parentElement ?? canvas);

    function onVisibility() {
      const visible = document.visibilityState === "visible";
      running = visible && !reduceMotion;
      if (running) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    if (!reduceMotion) {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="galaxy-background" aria-hidden="true">
      <div className="galaxy-background-fallback" />
      <canvas ref={canvasRef} className="galaxy-canvas" />
    </div>
  );
}
