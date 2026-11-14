// Board and "next" preview drawing. One 2D canvas, sprite blits only.

import { COLS, ROWS } from "./config";
import { roundRect, Sprites, FONT } from "./art";
import type { Game, Gem, PairSpec } from "./game";

export class BoardView {
  readonly canvas: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  cell = 40;
  private dpr = 1;
  sprites!: Sprites;
  private bg: HTMLCanvasElement | null = null;
  private pv = { x: 2, y: 0, rot: 0, id: -1 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d")!;
  }

  resize(cell: number, dpr: number): void {
    this.cell = cell;
    this.dpr = dpr;
    const w = cell * COLS;
    const h = cell * ROWS;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.sprites = new Sprites(cell, dpr);
    this.bg = null;
  }

  /** Screen position of a board cell's center (for effects). */
  cellCenter(x: number, y: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (x + 0.5) * this.cell, y: r.top + (y + 0.5) * this.cell };
  }

  private background(): HTMLCanvasElement {
    if (this.bg) return this.bg;
    const cv = document.createElement("canvas");
    cv.width = this.canvas.width;
    cv.height = this.canvas.height;
    const c = cv.getContext("2d")!;
    c.scale(this.dpr, this.dpr);
    const s = this.cell;
    const g = c.createLinearGradient(0, 0, 0, s * ROWS);
    g.addColorStop(0, "#1e1b4b");
    g.addColorStop(1, "#312e81");
    c.fillStyle = g;
    c.fillRect(0, 0, s * COLS, s * ROWS);
    c.fillStyle = "rgba(255,255,255,0.045)";
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if ((x + y) % 2 === 0) c.fillRect(x * s, y * s, s, s);
    // spawn marker
    c.fillStyle = "rgba(255,255,255,0.08)";
    c.fillRect(2 * s, 0, s, s * 0.12);
    this.bg = cv;
    return cv;
  }

  draw(game: Game, now: number): void {
    const c = this.c;
    const s = this.cell;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.background(), 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Telegraphed garbage columns.
    const a = game.attack;
    if (a.state !== "idle" && a.cols.length) {
      const blink = 0.35 + 0.25 * Math.sin(now * (a.state === "ready" ? 18 : 8));
      for (const x of a.cols) {
        const grad = c.createLinearGradient(0, 0, 0, s * 4);
        grad.addColorStop(0, `rgba(248,113,113,${blink})`);
        grad.addColorStop(1, "rgba(248,113,113,0)");
        c.fillStyle = grad;
        c.fillRect(x * s, 0, s, s * 4);
        c.fillStyle = "#fff";
        c.beginPath();
        const cx = x * s + s / 2;
        const ty = s * 0.25 + (now * 30) % (s * 0.4);
        c.moveTo(cx - s * 0.22, ty);
        c.lineTo(cx + s * 0.22, ty);
        c.lineTo(cx, ty + s * 0.3);
        c.closePath();
        c.fill();
      }
    }

    // Ghost landing spots.
    const gh = game.ghost();
    if (gh && game.piece) {
      c.globalAlpha = 0.28;
      c.drawImage(this.sprites.get(game.piece.a), gh.a.x * s, gh.a.y * s, s, s);
      c.drawImage(this.sprites.get(game.piece.b), gh.b.x * s, gh.b.y * s, s, s);
      c.globalAlpha = 1;
    }

    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const g = game.grid[y][x];
        if (g) this.drawGem(g, x * s, g.vy * s, now);
      }

    // Falling pair, smoothed toward its grid position.
    const p = game.piece;
    if (p) {
      if (this.pv.id !== p.a.id) this.pv = { x: p.x, y: p.y, rot: p.rot, id: p.a.id };
      const k = 0.4;
      this.pv.x += (p.x - this.pv.x) * k;
      this.pv.y += (p.y - this.pv.y) * k;
      const cells = game.pieceCells()!;
      const dx = this.pv.x - p.x;
      const dy = this.pv.y - p.y;
      const english = p.a.kind === "word" || p.a.kind === "picture" || p.b.kind === "word" || p.b.kind === "picture";
      for (const [gem, cell] of [
        [p.a, cells.a],
        [p.b, cells.b]
      ] as const) {
        const px = (cell.x + dx) * s;
        const py = (cell.y + dy) * s;
        if (english) {
          c.fillStyle = `rgba(255,255,255,${0.25 + 0.15 * Math.sin(now * 6)})`;
          roundRect(c, px - 2, py - 2, s + 4, s + 4, s * 0.22);
          c.fill();
        }
        this.drawGem(gem, px, py, now);
      }
    }

    if (game.phase === "lost") {
      c.fillStyle = "rgba(17,24,39,0.55)";
      c.fillRect(0, 0, s * COLS, s * ROWS);
    }
  }

  private drawGem(g: Gem, px: number, py: number, now: number): void {
    const c = this.c;
    const s = this.cell;
    let sx = 1;
    let sy = 1;
    let ox = 0;
    if (g.landT < 0.14) {
      const t = g.landT / 0.14;
      sy = 0.82 + 0.18 * t;
      sx = 1.1 - 0.1 * t;
    }
    if (g.chargeT < 0.45) {
      const t = g.chargeT / 0.45;
      const k = 1 + 0.3 * Math.sin(t * Math.PI);
      sx *= k;
      sy *= k;
    }
    if (g.wrongT < 0.5) ox = Math.sin(g.wrongT * 40) * s * 0.08 * (1 - g.wrongT / 0.5);
    if (g.kind === "crash") {
      const k = 1 + 0.05 * Math.sin(now * 7 + g.id);
      sx *= k;
      sy *= k;
    }
    const w = s * sx;
    const h = s * sy;
    const x = px + (s - w) / 2 + ox;
    const y = py + (s - h);
    if (g.charged) {
      const pulse = 0.55 + 0.35 * Math.sin(now * 5 + g.id);
      c.fillStyle = `rgba(253,224,71,${pulse})`;
      roundRect(c, x - s * 0.06, y - s * 0.06, w + s * 0.12, h + s * 0.12, s * 0.24);
      c.fill();
    }
    c.drawImage(this.sprites.get(g), x, y, w, h);
    if (g.charged) {
      c.strokeStyle = `rgba(253,224,71,${0.75 + 0.25 * Math.sin(now * 5 + g.id)})`;
      c.lineWidth = Math.max(3, s * 0.09);
      roundRect(c, x + s * 0.03, y + s * 0.03, w - s * 0.06, h - s * 0.06, s * 0.2);
      c.stroke();
      // little sparkle star in the corner
      const cx = x + w * 0.85;
      const cy = y + h * 0.15;
      const r = s * (0.12 + 0.03 * Math.sin(now * 8 + g.id));
      c.fillStyle = "#fff7a8";
      c.strokeStyle = "#b45309";
      c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 ? r * 0.4 : r;
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      c.closePath();
      c.fill();
      c.stroke();
    }
    if (g.kind === "garbage") {
      c.fillStyle = "#fff";
      c.font = `900 ${s * 0.46}px ${FONT}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(Math.max(0, g.timer)), x + w / 2, y + h / 2 + 1);
    }
    if (g.clearing) {
      c.fillStyle = `rgba(255,255,255,${0.45 + 0.45 * Math.sin(now * 40)})`;
      roundRect(c, x, y, w, h, s * 0.2);
      c.fill();
    }
  }
}

export class NextView {
  private c: CanvasRenderingContext2D;
  private sprites!: Sprites;
  private cell = 40;
  private dpr = 1;
  private last = "";
  constructor(private canvas: HTMLCanvasElement) {
    this.c = canvas.getContext("2d")!;
  }
  resize(cell: number, dpr: number): void {
    this.cell = cell;
    this.dpr = dpr;
    this.canvas.width = Math.round(cell * dpr);
    this.canvas.height = Math.round(cell * 2 * dpr);
    this.canvas.style.width = `${cell}px`;
    this.canvas.style.height = `${cell * 2}px`;
    this.sprites = new Sprites(cell, dpr);
    this.last = "";
  }
  draw(next: PairSpec | undefined): void {
    const key = next ? JSON.stringify(next) : "";
    if (key === this.last) return;
    this.last = key;
    const c = this.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!next) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.sprites.get(next.b), 0, 0, this.cell, this.cell);
    c.drawImage(this.sprites.get(next.a), 0, this.cell, this.cell, this.cell);
  }
}
