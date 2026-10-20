// Screen-feel: coin pops, particles, rings, flying coins and shake. Purely presentation: the
// renderer turns the sim's events into these, and they never touch the sim. Pooled arrays, no
// allocation per frame once warm.
import { C } from '../data/palette';

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
export interface Pop { x: number; y: number; text: string; color: string; life: number; max: number; value: number; key: string; icon: string | null; big: boolean }
export interface Ring { x: number; y: number; life: number; max: number; color: string; r0: number; r1: number }
/** a coin flying from the world (screen px) to the HUD counter */
export interface Flyer { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; arc: number }

export class Fx {
  parts: Particle[] = [];
  pops: Pop[] = [];
  rings: Ring[] = [];
  flyers: Flyer[] = [];
  shake = 0;
  /** reduced motion: no shake, fewer particles */
  calm = false;

  burst(x: number, y: number, n: number, colors: string[], speed = 30, grav = 60, size = 1, life = 0.6) {
    if (this.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 600) this.parts.shift();
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.5, life: life * (0.6 + Math.random() * 0.6), max: life, color: colors[i % colors.length], size, grav });
    }
  }

  /** A "+N" pop. Pops with the same key close together merge (a busy Dock shows one growing number). */
  pop(x: number, y: number, value: number, key: string, color: string = C.gold, icon: string | null = null, prefix = '+', big = false) {
    for (const p of this.pops) {
      if (p.key === key && p.max - p.life < 0.35) {
        p.value += value;
        p.text = prefix + fmtShort(p.value);
        p.life = p.max;
        return;
      }
    }
    if (this.pops.length > 60) this.pops.shift();
    this.pops.push({ x, y, text: prefix + fmtShort(value), color, life: 1.1, max: 1.1, value, key, icon, big });
  }

  text(x: number, y: number, text: string, color: string, life = 1.4, big = false) {
    if (this.pops.length > 60) this.pops.shift();
    this.pops.push({ x, y, text, color, life, max: life, value: 0, key: '', icon: null, big });
  }

  ring(x: number, y: number, color: string, r1 = 12, life = 0.5, r0 = 2) {
    this.rings.push({ x, y, life, max: life, color, r0, r1 });
  }

  fly(x0: number, y0: number, x1: number, y1: number) {
    if (this.flyers.length > 24) return;
    this.flyers.push({ x0, y0, x1, y1, t: 0, dur: 0.55 + Math.random() * 0.2, arc: 30 + Math.random() * 40 });
  }

  kick(amount: number) {
    if (!this.calm) this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): number {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) p.life -= dt;
    this.pops = this.pops.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    let landed = 0;
    for (const f of this.flyers) {
      f.t += dt;
      if (f.t >= f.dur) landed++;
    }
    this.flyers = this.flyers.filter((f) => f.t < f.dur);
    this.shake = Math.max(0, this.shake - dt * 30);
    return landed;
  }
}

export function fmtShort(v: number): string {
  if (v < 10 && v !== Math.floor(v)) return v.toFixed(1);
  if (v < 1e4) return String(Math.floor(v));
  if (v < 1e6) return (v / 1e3).toFixed(v < 1e5 ? 1 : 0) + 'K';
  return (v / 1e6).toFixed(2) + 'M';
}
