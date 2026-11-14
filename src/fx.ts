// Lightweight screen-space effects on one full-window overlay canvas
// (pointer-events: none). Capped particle count for weak GPUs.

import { FONT } from "./art";

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
interface Text { x: number; y: number; vy: number; text: string; color: string; size: number; life: number; max: number }
interface Shot { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; color: string; r: number; onHit: () => void; trail: number }
interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string }

const MAX_SPARKS = 260;

export class Fx {
  private c: CanvasRenderingContext2D;
  private dpr = 1;
  private sparks: Spark[] = [];
  private texts: Text[] = [];
  private shots: Shot[] = [];
  private rings: Ring[] = [];
  private dirty = false;
  private shakeT = 0;
  private shakeAmp = 0;
  private flashT = 0;
  private flashColor = "#fff";

  constructor(
    private canvas: HTMLCanvasElement,
    private shakeEl: HTMLElement
  ) {
    this.c = canvas.getContext("2d")!;
  }

  resize(dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
    this.dirty = true;
  }

  clear(): void {
    this.sparks = [];
    this.texts = [];
    this.shots = [];
    this.rings = [];
    this.shakeT = 0;
    this.flashT = 0;
    this.shakeEl.style.transform = "";
    this.dirty = true;
  }

  burst(x: number, y: number, color: string, n = 10, speed = 260): void {
    for (let i = 0; i < n && this.sparks.length < MAX_SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0, max: 0.45 + Math.random() * 0.35, color, r: 3 + Math.random() * 4 });
    }
  }

  ring(x: number, y: number, color: string, r1 = 70, max = 0.4): void {
    this.rings.push({ x, y, r0: 6, r1, life: 0, max, color });
  }

  text(x: number, y: number, text: string, color: string, size = 34, max = 0.9): void {
    this.texts.push({ x, y, vy: -60, text, color, size, life: 0, max });
  }

  shoot(from: { x: number; y: number }, to: { x: number; y: number }, color: string, r: number, delay: number, onHit: () => void): void {
    this.shots.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: -delay, dur: 0.42, color, r, onHit, trail: 0 });
  }

  shake(amp: number, dur = 0.25): void {
    this.shakeAmp = Math.max(this.shakeAmp * (this.shakeT > 0 ? 1 : 0), amp);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  flash(color: string, dur = 0.18): void {
    this.flashColor = color;
    this.flashT = dur;
  }

  update(dt: number): void {
    for (const s of this.sparks) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 600 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.life < s.max);
    for (const t of this.texts) {
      t.life += dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
    }
    this.texts = this.texts.filter((t) => t.life < t.max);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.max);
    const hit: Shot[] = [];
    for (const s of this.shots) {
      s.t += dt;
      if (s.t >= s.dur) hit.push(s);
      else if (s.t > 0 && this.sparks.length < MAX_SPARKS && (s.trail += dt) > 0.03) {
        s.trail = 0;
        const p = this.shotPos(s);
        this.sparks.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0, max: 0.3, color: s.color, r: s.r * 0.5 });
      }
    }
    if (hit.length) {
      this.shots = this.shots.filter((s) => !hit.includes(s));
      for (const s of hit) {
        this.burst(s.x1, s.y1, s.color, 12, 300);
        s.onHit();
      }
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeT > 0 ? this.shakeAmp * Math.min(1, this.shakeT / 0.15) : 0;
      this.shakeEl.style.transform = a ? `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)` : "";
    }
    if (this.flashT > 0) this.flashT -= dt;
  }

  get busy(): boolean {
    return this.shots.length > 0;
  }

  private shotPos(s: Shot): { x: number; y: number } {
    const t = Math.max(0, s.t / s.dur);
    const e = t * t * (3 - 2 * t);
    const arc = Math.sin(t * Math.PI) * -90;
    return { x: s.x0 + (s.x1 - s.x0) * e, y: s.y0 + (s.y1 - s.y0) * e + arc };
  }

  draw(): void {
    const empty = !this.sparks.length && !this.texts.length && !this.shots.length && !this.rings.length && this.flashT <= 0;
    if (empty && !this.dirty) return;
    const c = this.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = !empty;
    if (empty) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.flashT > 0) {
      c.globalAlpha = Math.min(0.35, this.flashT * 2);
      c.fillStyle = this.flashColor;
      c.fillRect(0, 0, innerWidth, innerHeight);
      c.globalAlpha = 1;
    }
    for (const r of this.rings) {
      const t = r.life / r.max;
      c.globalAlpha = 1 - t;
      c.strokeStyle = r.color;
      c.lineWidth = 6 * (1 - t) + 1;
      c.beginPath();
      c.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * t, 0, Math.PI * 2);
      c.stroke();
    }
    for (const s of this.sparks) {
      c.globalAlpha = 1 - s.life / s.max;
      c.fillStyle = s.color;
      c.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
    }
    c.globalAlpha = 1;
    for (const s of this.shots) {
      if (s.t < 0) continue;
      const p = this.shotPos(s);
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(p.x, p.y, s.r + 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = s.color;
      c.beginPath();
      c.arc(p.x, p.y, s.r, 0, Math.PI * 2);
      c.fill();
    }
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : k < 0.25 ? 1.1 - ((k - 0.15) / 0.1) * 0.1 : 1;
      c.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      c.font = `900 ${t.size * pop}px ${FONT}`;
      c.lineWidth = Math.max(4, t.size * 0.18);
      c.strokeStyle = "#1e1b4b";
      c.strokeText(t.text, t.x, t.y);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
  }
}
