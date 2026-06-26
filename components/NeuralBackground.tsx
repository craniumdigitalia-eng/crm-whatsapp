'use client';

import { useEffect, useRef } from 'react';

/* ============================================================
   NeuralBackground
   Rede neural ("cerebro") viva em <canvas> 2D — motion da marca
   Cranium na tela de login. Nos flutuam, sinapses pulsam e
   particulas viajam pelas conexoes (o cerebro "disparando").

   - Paleta da marca: roxos sobre deep-violet (#1A0A2E).
   - devicePixelRatio (nitido em retina), redimensiona com a janela.
   - Numero de nos moderado e proporcional a area (~40-70).
   - Respeita prefers-reduced-motion: desenha um frame estatico
     e nao inicia o loop de animacao.
   ============================================================ */

// Cores da marca em componentes RGB (para montar rgba com alpha variavel).
const NODE_RGB = '167, 139, 250'; // --brand-light
const EDGE_RGB = '124, 58, 237'; //  --brand-purple
const SPARK_RGB = '196, 176, 240'; // --neutral-soft (particula viajante)

const CONNECT_DIST = 150; // distancia maxima (px) para desenhar uma sinapse
const PARTICLE_SPAWN_MS = 380; // intervalo medio entre disparos
const MAX_PARTICLES = 14;

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number; // fase do pulso individual
};

type Particle = {
  from: number;
  to: number;
  t: number; // progresso 0 -> 1
  speed: number;
};

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let particles: Particle[] = [];
    let raf = 0;
    let lastSpawn = 0;

    function initNodes() {
      // Um no a cada ~22k px^2, limitado entre 38 e 70.
      const target = Math.round((width * height) / 22000);
      const count = Math.max(38, Math.min(70, target));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
        r: 1 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      }));
      particles = [];
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes();
    }

    function spawnParticle() {
      if (particles.length >= MAX_PARTICLES || nodes.length < 2) return;
      const a = Math.floor(Math.random() * nodes.length);
      // Procura um vizinho dentro da distancia de conexao.
      const candidates: number[] = [];
      for (let b = 0; b < nodes.length; b++) {
        if (b === a) continue;
        const dx = nodes[a].x - nodes[b].x;
        const dy = nodes[a].y - nodes[b].y;
        if (dx * dx + dy * dy < CONNECT_DIST * CONNECT_DIST) candidates.push(b);
      }
      if (candidates.length === 0) return;
      const to = candidates[Math.floor(Math.random() * candidates.length)];
      particles.push({ from: a, to, t: 0, speed: 0.006 + Math.random() * 0.01 });
    }

    function render(time: number) {
      ctx!.clearRect(0, 0, width, height);

      // --- Atualiza posicoes (drift suave, faz wrap nas bordas) ---
      if (!reduceMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) n.x = width + 20;
          else if (n.x > width + 20) n.x = -20;
          if (n.y < -20) n.y = height + 20;
          else if (n.y > height + 20) n.y = -20;
        }
      }

      // --- Sinapses (arestas entre nos proximos) ---
      ctx!.lineWidth = 0.7;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq > CONNECT_DIST * CONNECT_DIST) continue;
          const dist = Math.sqrt(distSq);
          const proximity = 1 - dist / CONNECT_DIST; // 0..1
          // Pulso lento de opacidade — efeito de sinapse respirando.
          const pulse = reduceMotion
            ? 0.6
            : 0.5 + 0.5 * Math.sin(time * 0.0011 + nodes[i].phase + nodes[j].phase);
          const alpha = proximity * 0.34 * (0.55 + 0.45 * pulse);
          ctx!.strokeStyle = `rgba(${EDGE_RGB}, ${alpha.toFixed(3)})`;
          ctx!.beginPath();
          ctx!.moveTo(nodes[i].x, nodes[i].y);
          ctx!.lineTo(nodes[j].x, nodes[j].y);
          ctx!.stroke();
        }
      }

      // --- Particulas viajando pelas conexoes (disparos) ---
      if (!reduceMotion) {
        if (time - lastSpawn > PARTICLE_SPAWN_MS) {
          spawnParticle();
          lastSpawn = time;
        }
        for (let p = particles.length - 1; p >= 0; p--) {
          const part = particles[p];
          part.t += part.speed;
          if (part.t >= 1) {
            particles.splice(p, 1);
            continue;
          }
          const a = nodes[part.from];
          const b = nodes[part.to];
          if (!a || !b) {
            particles.splice(p, 1);
            continue;
          }
          const x = a.x + (b.x - a.x) * part.t;
          const y = a.y + (b.y - a.y) * part.t;
          // Brilho que some nas pontas (fade in/out).
          const edgeFade = Math.sin(part.t * Math.PI);
          const glow = ctx!.createRadialGradient(x, y, 0, x, y, 6);
          glow.addColorStop(0, `rgba(${SPARK_RGB}, ${(0.9 * edgeFade).toFixed(3)})`);
          glow.addColorStop(1, `rgba(${SPARK_RGB}, 0)`);
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(x, y, 6, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // --- Nos (pontos) ---
      for (const n of nodes) {
        const twinkle = reduceMotion
          ? 0.7
          : 0.55 + 0.45 * Math.sin(time * 0.0016 + n.phase);
        ctx!.fillStyle = `rgba(${NODE_RGB}, ${(0.4 + 0.4 * twinkle).toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!reduceMotion) raf = requestAnimationFrame(render);
    }

    resize();
    render(0);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        if (reduceMotion) render(0); // redesenha o frame estatico
      }, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="neural-canvas" aria-hidden="true" />;
}
