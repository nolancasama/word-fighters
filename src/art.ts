// Original art: animal SVGs and pre-rendered gem sprites (drawn once per cell size,
// then blitted with drawImage so low-powered Chromebooks only do cheap copies).

import { ANIMALS, type Animal } from "./config";
import type { Color, GemSpec } from "./game";

export const GEM_COLORS: Record<Color, { base: string; light: string; dark: string; name: string }> = {
  0: { base: "#ef4444", light: "#fca5a5", dark: "#b91c1c", name: "red" },
  1: { base: "#3b82f6", light: "#93c5fd", dark: "#1d4ed8", name: "blue" },
  2: { base: "#22c55e", light: "#86efac", dark: "#15803d", name: "green" },
  3: { base: "#facc15", light: "#fef08a", dark: "#ca8a04", name: "yellow" }
};

const O = 'stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"';

export const ANIMAL_SVG: Record<Animal, string> = {
  cat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M18 44 L22 10 L44 30 Z" fill="#9ca3af" ${O}/><path d="M82 44 L78 10 L56 30 Z" fill="#9ca3af" ${O}/>
    <path d="M24 32 L25 18 L36 28 Z" fill="#f9a8d4"/><path d="M76 32 L75 18 L64 28 Z" fill="#f9a8d4"/>
    <ellipse cx="50" cy="56" rx="36" ry="32" fill="#9ca3af" ${O}/>
    <path d="M38 30 L42 40 M50 27 L50 39 M62 30 L58 40" stroke="#6b7280" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="36" cy="54" rx="6" ry="8" fill="#1f2937"/><ellipse cx="64" cy="54" rx="6" ry="8" fill="#1f2937"/>
    <circle cx="38" cy="51" r="2.2" fill="#fff"/><circle cx="66" cy="51" r="2.2" fill="#fff"/>
    <path d="M45 65 L55 65 L50 71 Z" fill="#f472b6"/>
    <path d="M50 71 Q44 78 39 74 M50 71 Q56 78 61 74" fill="none" stroke="#3b2a20" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M10 60 L30 63 M10 70 L30 68 M90 60 L70 63 M90 70 L70 68" stroke="#3b2a20" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  dog: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="52" rx="32" ry="33" fill="#d69e5c" ${O}/>
    <path d="M22 26 Q6 30 10 62 Q20 66 28 50 Z" fill="#7c4a24" ${O}/><path d="M78 26 Q94 30 90 62 Q80 66 72 50 Z" fill="#7c4a24" ${O}/>
    <ellipse cx="50" cy="68" rx="19" ry="14" fill="#f5deb3" ${O}/>
    <ellipse cx="38" cy="48" rx="5.5" ry="7" fill="#1f2937"/><ellipse cx="62" cy="48" rx="5.5" ry="7" fill="#1f2937"/>
    <circle cx="40" cy="45" r="2" fill="#fff"/><circle cx="64" cy="45" r="2" fill="#fff"/>
    <ellipse cx="50" cy="61" rx="7" ry="5" fill="#1f2937"/>
    <path d="M50 66 L50 71 M42 71 Q50 77 58 71" fill="none" stroke="#3b2a20" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M46 74 Q50 86 54 74 Z" fill="#f87171" stroke="#3b2a20" stroke-width="2"/>
  </svg>`,
  fish: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M70 50 L96 26 L92 50 L96 74 Z" fill="#fb923c" ${O}/>
    <path d="M40 24 Q52 12 62 28 Z" fill="#fdba74" ${O}/>
    <ellipse cx="44" cy="52" rx="36" ry="25" fill="#f97316" ${O}/>
    <path d="M50 30 Q60 52 50 74" fill="none" stroke="#c2410c" stroke-width="3"/>
    <path d="M36 66 Q44 78 52 70 Z" fill="#fdba74" ${O}/>
    <circle cx="26" cy="46" r="8" fill="#fff" ${O}/><circle cx="24" cy="46" r="4.5" fill="#1f2937"/>
    <path d="M10 58 Q16 62 20 58" fill="none" stroke="#3b2a20" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  bird: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M30 70 L14 86 L34 80 Z" fill="#2563eb" ${O}/>
    <ellipse cx="50" cy="58" rx="30" ry="26" fill="#60a5fa" ${O}/>
    <circle cx="62" cy="34" r="20" fill="#60a5fa" ${O}/>
    <path d="M56 18 Q60 6 66 16" fill="#2563eb" ${O}/>
    <ellipse cx="52" cy="66" rx="16" ry="12" fill="#dbeafe"/>
    <path d="M28 52 Q44 44 56 60 Q40 74 26 64 Z" fill="#2563eb" ${O}/>
    <path d="M80 32 L95 38 L80 44 Z" fill="#facc15" ${O}/>
    <circle cx="67" cy="31" r="5" fill="#1f2937"/><circle cx="68.5" cy="29.5" r="1.8" fill="#fff"/>
    <path d="M44 84 L44 94 M56 84 L56 94" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
  </svg>`
};

export const animalImages = {} as Record<Animal, HTMLImageElement>;

export function animalUrl(a: Animal): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ANIMAL_SVG[a]);
}

export async function loadArt(): Promise<void> {
  await Promise.all(
    ANIMALS.map(
      (a) =>
        new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => res();
          img.onerror = () => res();
          img.src = animalUrl(a);
          animalImages[a] = img;
        })
    )
  );
}

export const FONT = '"Arial Rounded MT Bold", "Arial Black", Arial, "Helvetica Neue", sans-serif';

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
export { rr as roundRect };

function drawNormal(c: CanvasRenderingContext2D, s: number, col: Color) {
  const k = GEM_COLORS[col];
  const p = s * 0.06;
  const grad = c.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, k.light);
  grad.addColorStop(0.45, k.base);
  grad.addColorStop(1, k.dark);
  rr(c, p, p, s - 2 * p, s - 2 * p, s * 0.2);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = Math.max(1.5, s * 0.04);
  c.strokeStyle = k.dark;
  c.stroke();
  // faceted center
  const m = s / 2;
  const q = s * 0.24;
  c.beginPath();
  c.moveTo(m, m - q);
  c.lineTo(m + q, m);
  c.lineTo(m, m + q);
  c.lineTo(m - q, m);
  c.closePath();
  c.fillStyle = "rgba(255,255,255,0.35)";
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.beginPath();
  c.ellipse(s * 0.3, s * 0.26, s * 0.1, s * 0.06, -0.6, 0, Math.PI * 2);
  c.fill();
}

function drawCrash(c: CanvasRenderingContext2D, s: number, col: Color) {
  const k = GEM_COLORS[col];
  const m = s / 2;
  const grad = c.createRadialGradient(m * 0.75, m * 0.7, s * 0.05, m, m, s * 0.46);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, k.light);
  grad.addColorStop(1, k.dark);
  c.beginPath();
  c.arc(m, m, s * 0.44, 0, Math.PI * 2);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = Math.max(2, s * 0.05);
  c.strokeStyle = "#fff";
  c.stroke();
  // star
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.12 : s * 0.27;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
  }
  c.closePath();
  c.fillStyle = "#fff";
  c.fill();
  c.lineWidth = Math.max(1, s * 0.025);
  c.strokeStyle = k.dark;
  c.stroke();
}

function drawWord(c: CanvasRenderingContext2D, s: number, col: Color, animal: Animal) {
  const k = GEM_COLORS[col];
  const p = s * 0.04;
  rr(c, p, p, s - 2 * p, s - 2 * p, s * 0.16);
  c.fillStyle = k.base;
  c.fill();
  const b = s * 0.09;
  rr(c, b, b, s - 2 * b, s - 2 * b, s * 0.1);
  c.fillStyle = "#fffdf5";
  c.fill();
  // Narrow bold face, stretched a little taller: the largest legible size for 4 letters in a cell.
  const word = animal.toUpperCase();
  c.fillStyle = "#111827";
  c.textAlign = "center";
  c.textBaseline = "middle";
  const WORD_FONT = 'Arial, "Helvetica Neue", "Liberation Sans", sans-serif';
  let size = s * 0.5;
  c.font = `bold ${size}px ${WORD_FONT}`;
  const max = s - 2 * b - s * 0.04;
  const w = c.measureText(word).width;
  if (w > max) {
    size *= max / w;
    c.font = `bold ${size}px ${WORD_FONT}`;
  }
  c.save();
  c.translate(s / 2, s / 2 + size * 0.04);
  c.scale(1, 1.25);
  c.fillText(word, 0, 0);
  c.restore();
}

function drawPicture(c: CanvasRenderingContext2D, s: number, col: Color, animal: Animal) {
  const k = GEM_COLORS[col];
  const p = s * 0.04;
  c.beginPath();
  c.arc(s / 2, s / 2, s / 2 - p, 0, Math.PI * 2);
  c.fillStyle = k.base;
  c.fill();
  c.beginPath();
  c.arc(s / 2, s / 2, s / 2 - s * 0.11, 0, Math.PI * 2);
  c.fillStyle = "#ffffff";
  c.fill();
  const img = animalImages[animal];
  const i = s * 0.15;
  if (img && img.complete) c.drawImage(img, i, i, s - 2 * i, s - 2 * i);
}

function drawGarbage(c: CanvasRenderingContext2D, s: number) {
  const p = s * 0.06;
  const grad = c.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#9ca3af");
  grad.addColorStop(1, "#4b5563");
  rr(c, p, p, s - 2 * p, s - 2 * p, s * 0.12);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = Math.max(1.5, s * 0.04);
  c.strokeStyle = "#374151";
  c.stroke();
  c.strokeStyle = "rgba(31,41,55,0.5)";
  c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath();
  c.moveTo(s * 0.2, s * 0.3);
  c.lineTo(s * 0.38, s * 0.42);
  c.lineTo(s * 0.32, s * 0.6);
  c.moveTo(s * 0.72, s * 0.7);
  c.lineTo(s * 0.62, s * 0.82);
  c.stroke();
}

export class Sprites {
  private cache = new Map<string, HTMLCanvasElement>();
  constructor(
    public size: number,
    private dpr: number
  ) {}

  get(spec: GemSpec): HTMLCanvasElement {
    const key = `${spec.kind}:${spec.color}:${spec.animal ?? ""}`;
    let cv = this.cache.get(key);
    if (cv) return cv;
    cv = document.createElement("canvas");
    const px = Math.ceil(this.size * this.dpr);
    cv.width = cv.height = px;
    const c = cv.getContext("2d")!;
    c.scale(px / this.size, px / this.size);
    const s = this.size;
    switch (spec.kind) {
      case "normal":
        drawNormal(c, s, spec.color);
        break;
      case "crash":
        drawCrash(c, s, spec.color);
        break;
      case "word":
        drawWord(c, s, spec.color, spec.animal!);
        break;
      case "picture":
        drawPicture(c, s, spec.color, spec.animal!);
        break;
      case "garbage":
        drawGarbage(c, s);
        break;
    }
    this.cache.set(key, cv);
    return cv;
  }

  /** A data URL of a sprite, for HTML demo pictures in the tutorial. */
  url(spec: GemSpec): string {
    return this.get(spec).toDataURL();
  }
}
