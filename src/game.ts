// Pure game logic: no DOM, no timers. Everything advances through update(dt),
// so a restart is just a new Game and tests can drive it deterministically.

import { ANIMALS, ATTACK_PATTERN, COLS, ROWS, SPAWN_COL, type Animal, type Tuning } from "./config";
import { Rng } from "./rng";

export type Color = 0 | 1 | 2 | 3; // red, blue, green, yellow
export type Kind = "normal" | "crash" | "word" | "picture" | "garbage";

export interface GemSpec {
  kind: Kind;
  color: Color;
  animal?: Animal;
}

export interface Gem extends GemSpec {
  id: number;
  charged: boolean;
  /** Garbage only: pieces left before it turns into a colored gem. */
  timer: number;
  /** Visual row (animates toward the real row during the fall step). */
  vy: number;
  clearing: boolean;
  /** Seconds since landing (squash), since a wrong match (wobble), since charging (glow). */
  landT: number;
  wrongT: number;
  chargeT: number;
}

export interface PairSpec {
  a: GemSpec; // pivot
  b: GemSpec; // orbits the pivot, starts above it
  tag: "normal" | "crash" | "word" | "picture";
}

export interface Piece {
  x: number;
  y: number;
  rot: number; // 0: b above, 1: b right, 2: b below, 3: b left
  a: Gem;
  b: Gem;
  groundT: number;
  resets: number;
}

export interface Cell {
  x: number;
  y: number;
}

export type GameEvent =
  | { type: "spawn"; tag: PairSpec["tag"] }
  | { type: "move" }
  | { type: "rotate" }
  | { type: "lock" }
  | { type: "land"; cells: Cell[] }
  | { type: "clear"; cells: (Cell & { gem: Gem })[]; chain: number; damage: number; englishBonus: number; biggest: number }
  | { type: "match"; animal: Animal; word: Cell; picture: Cell }
  | { type: "mismatch"; word: Cell; picture: Cell }
  | { type: "power"; value: number }
  | { type: "blast"; damage: number }
  | { type: "attackWarn"; count: number; cols: number[] }
  | { type: "attackCancel" }
  | { type: "garbage"; cells: Cell[] }
  | { type: "convert"; cells: Cell[] }
  | { type: "won" }
  | { type: "lost" };

export interface Stats {
  time: number;
  gemsCleared: number;
  largestChain: number;
  correct: number;
  incorrect: number;
  englishBonusDamage: number;
  totalDamage: number;
  score: number;
  blasts: number;
  piecesPlaced: number;
}

export type Phase = "falling" | "resolving" | "won" | "lost";

export interface AttackState {
  state: "idle" | "warning" | "ready";
  timer: number;
  count: number;
  cols: number[];
  index: number;
}

const OFF: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];
const NEIGHBORS: readonly Cell[] = OFF;
/** Visual fall speed of settling gems, rows per second. */
const SETTLE_SPEED = 18;
const FLASH_TIME = 0.32;
const MAX_LOCK_RESETS = 12;

export interface GameOptions {
  seed: number;
  tuning: Tuning;
  /** Tutorial: no monster attacks, monster cannot be defeated, pairs may be scripted. */
  tutorial?: boolean;
}

export class Game {
  readonly tuning: Tuning;
  readonly tutorial: boolean;
  readonly seed: number;
  grid: (Gem | null)[][];
  piece: Piece | null = null;
  queue: PairSpec[] = [];
  phase: Phase = "falling";
  time = 0;
  monsterHp: number;
  monsterMax: number;
  power = 0;
  chain = 0;
  softDrop = false;
  attack: AttackState;
  stats: Stats;
  events: GameEvent[] = [];

  private rng: Rng;
  private nextId = 1;
  private fallT = 0;
  private step: "fall" | "flash" = "fall";
  private flashT = 0;
  private pairCount = 0;
  private crashDue = 1;
  private pendingPicture = false;
  private lastWord: Animal = "cat";
  private wordBag: Animal[] = [];
  private evaluated = new Set<string>();
  private justPlaced = new Set<number>();
  private script: PairSpec[] = [];

  constructor(opts: GameOptions) {
    this.tuning = opts.tuning;
    this.tutorial = !!opts.tutorial;
    this.seed = opts.seed;
    this.rng = new Rng(opts.seed);
    this.grid = Array.from({ length: ROWS }, () => Array<Gem | null>(COLS).fill(null));
    this.monsterMax = this.tutorial ? 9999 : this.tuning.monsterHp;
    this.monsterHp = this.monsterMax;
    this.attack = { state: "idle", timer: 12, count: 0, cols: [], index: 0 };
    this.stats = {
      time: 0,
      gemsCleared: 0,
      largestChain: 0,
      correct: 0,
      incorrect: 0,
      englishBonusDamage: 0,
      totalDamage: 0,
      score: 0,
      blasts: 0,
      piecesPlaced: 0
    };
    this.queue.push(this.genPair());
  }

  // ---------------------------------------------------------------- queries

  get over(): boolean {
    return this.phase === "won" || this.phase === "lost";
  }

  get(x: number, y: number): Gem | null {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
    return this.grid[y][x];
  }

  pieceCells(p: Piece | null = this.piece): { a: Cell; b: Cell } | null {
    if (!p) return null;
    const o = OFF[p.rot];
    return { a: { x: p.x, y: p.y }, b: { x: p.x + o.x, y: p.y + o.y } };
  }

  /** Where each gem of the falling pair would come to rest (pairs split, like the genre). */
  ghost(): { a: Cell; b: Cell } | null {
    const c = this.pieceCells();
    if (!c) return null;
    const top = (x: number) => {
      let y = ROWS - 1;
      while (y >= 0 && this.grid[y][x]) y--;
      return y;
    };
    if (c.a.x === c.b.x) {
      const t = top(c.a.x);
      const lowerIsA = c.a.y > c.b.y;
      return lowerIsA ? { a: { x: c.a.x, y: t }, b: { x: c.a.x, y: t - 1 } } : { a: { x: c.a.x, y: t - 1 }, b: { x: c.a.x, y: t } };
    }
    return { a: { x: c.a.x, y: top(c.a.x) }, b: { x: c.b.x, y: top(c.b.x) } };
  }

  fallInterval(): number {
    const t = this.tuning;
    const k = Math.min(1, Math.max(0, (this.time - t.rampStart) / Math.max(1, t.rampDuration)));
    return t.fallInterval + (t.fallIntervalMin - t.fallInterval) * k;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- input

  move(dx: number): boolean {
    const p = this.piece;
    if (!p || this.phase !== "falling") return false;
    if (!this.canPlace(p.x + dx, p.y, p.rot)) return false;
    p.x += dx;
    this.afterAdjust();
    this.events.push({ type: "move" });
    return true;
  }

  rotate(dir: 1 | -1 = 1): boolean {
    const p = this.piece;
    if (!p || this.phase !== "falling") return false;
    const nr = (p.rot + dir + 4) % 4;
    const o = OFF[nr];
    const tries: Cell[] = [
      { x: 0, y: 0 },
      { x: -o.x, y: -o.y } // wall/floor kick: push the pivot away from where b would go
    ];
    for (const k of tries) {
      if (this.canPlace(p.x + k.x, p.y + k.y, nr)) {
        p.x += k.x;
        p.y += k.y;
        p.rot = nr;
        this.afterAdjust();
        this.events.push({ type: "rotate" });
        return true;
      }
    }
    // Narrow well: swap the two gems in place (a half-turn) so rotating always does something.
    const flip = (p.rot + 2) % 4;
    for (const k of [{ x: 0, y: 0 }, { x: -OFF[flip].x, y: -OFF[flip].y }]) {
      if (this.canPlace(p.x + k.x, p.y + k.y, flip)) {
        p.x += k.x;
        p.y += k.y;
        p.rot = flip;
        this.afterAdjust();
        this.events.push({ type: "rotate" });
        return true;
      }
    }
    return false;
  }

  hardDrop(): void {
    const p = this.piece;
    if (!p || this.phase !== "falling") return;
    while (this.canPlace(p.x, p.y + 1, p.rot)) p.y++;
    this.lock();
  }

  setSoftDrop(on: boolean): void {
    this.softDrop = on;
  }

  // ---------------------------------------------------------------- loop

  update(dt: number): void {
    if (this.over) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.stats.time = this.time;
    for (const row of this.grid)
      for (const g of row)
        if (g) {
          g.landT += dt;
          g.wrongT += dt;
          g.chargeT += dt;
        }
    if (this.piece) {
      this.piece.a.chargeT += dt;
      this.piece.b.chargeT += dt;
    }
    this.updateAttack(dt);
    if (this.phase === "falling") this.updateFalling(dt);
    else if (this.phase === "resolving") this.updateResolve(dt);
  }

  private updateFalling(dt: number): void {
    if (!this.piece) {
      this.spawn();
      return;
    }
    const p = this.piece;
    if (!this.canPlace(p.x, p.y + 1, p.rot)) {
      p.groundT += dt;
      this.fallT = 0;
      if (p.groundT >= (this.softDrop ? 0.05 : this.tuning.lockDelay)) this.lock();
      return;
    }
    p.groundT = 0;
    const interval = this.softDrop ? this.tuning.softDropInterval : this.fallInterval();
    this.fallT += dt;
    while (this.fallT >= interval) {
      this.fallT -= interval;
      if (this.canPlace(p.x, p.y + 1, p.rot)) p.y++;
      else break;
    }
  }

  private spawn(): void {
    const spec = this.queue.shift()!;
    this.queue.push(this.genPair());
    if (this.grid[0][SPAWN_COL]) {
      this.lose();
      return;
    }
    const a = this.makeGem(spec.a, 0);
    const b = this.makeGem(spec.b, -1);
    this.piece = { x: SPAWN_COL, y: 0, rot: 0, a, b, groundT: 0, resets: 0 };
    this.fallT = 0;
    this.events.push({ type: "spawn", tag: spec.tag });
  }

  private lock(): void {
    const p = this.piece;
    const c = this.pieceCells();
    if (!p || !c) return;
    this.piece = null;
    this.stats.piecesPlaced++;
    this.events.push({ type: "lock" });
    for (const [gem, cell] of [
      [p.a, c.a],
      [p.b, c.b]
    ] as const) {
      if (cell.y < 0) {
        this.lose();
        return;
      }
      gem.vy = cell.y;
      this.grid[cell.y][cell.x] = gem;
      this.justPlaced.add(gem.id);
    }
    // Garbage counts down once per placed piece, then becomes an ordinary gem.
    const converted: Cell[] = [];
    this.forEachGem((g, x, y) => {
      if (g.kind === "garbage" && !this.justPlaced.has(g.id)) {
        g.timer--;
        if (g.timer <= 0) {
          g.kind = "normal";
          g.color = this.rng.int(4) as Color;
          converted.push({ x, y });
        }
      }
    });
    if (converted.length) this.events.push({ type: "convert", cells: converted });
    this.applyGravity();
    if (this.attack.state === "ready") this.dropGarbage();
    this.phase = "resolving";
    this.step = "fall";
    this.chain = 0;
  }

  private updateResolve(dt: number): void {
    if (this.step === "fall") {
      let done = true;
      const landed: Cell[] = [];
      this.forEachGem((g, x, y) => {
        if (g.vy < y) {
          g.vy = Math.min(y, g.vy + SETTLE_SPEED * dt);
          if (g.vy >= y) {
            g.landT = 0;
            landed.push({ x, y });
          } else done = false;
        }
      });
      if (landed.length) this.events.push({ type: "land", cells: landed });
      if (!done) return;
      this.evaluateEnglish();
      if (!this.findAndStartClear()) this.finishResolve();
    } else {
      this.flashT -= dt;
      if (this.flashT > 0) return;
      this.forEachGem((g, x, y) => {
        if (g.clearing) this.grid[y][x] = null;
      });
      this.applyGravity();
      this.step = "fall";
    }
  }

  private finishResolve(): void {
    this.justPlaced.clear();
    if (this.monsterHp <= 0 && !this.tutorial) {
      this.phase = "won";
      this.events.push({ type: "won" });
      return;
    }
    this.phase = "falling";
  }

  private lose(): void {
    this.piece = null;
    this.phase = "lost";
    this.events.push({ type: "lost" });
  }

  // ---------------------------------------------------------------- rules

  canPlace(x: number, y: number, rot: number): boolean {
    const o = OFF[rot];
    for (const c of [
      { x, y },
      { x: x + o.x, y: y + o.y }
    ]) {
      if (c.x < 0 || c.x >= COLS || c.y >= ROWS || c.y < -2) return false;
      if (c.y >= 0 && this.grid[c.y][c.x]) return false;
    }
    return true;
  }

  private afterAdjust(): void {
    const p = this.piece!;
    // Moving a grounded piece buys a little more time (capped) so children can slide it into place.
    if (p.groundT > 0 && p.resets < MAX_LOCK_RESETS) {
      p.groundT = 0;
      p.resets++;
    }
  }

  /** Compacts every column downward. Gems keep their old visual row so they animate down. */
  applyGravity(): boolean {
    let moved = false;
    for (let x = 0; x < COLS; x++) {
      let write = ROWS - 1;
      for (let y = ROWS - 1; y >= 0; y--) {
        const g = this.grid[y][x];
        if (!g) continue;
        if (write !== y) {
          this.grid[write][x] = g;
          this.grid[y][x] = null;
          moved = true;
        }
        write--;
      }
    }
    return moved;
  }

  /** Charges word+picture pairs that are orthogonally adjacent. */
  private evaluateEnglish(): void {
    this.forEachGem((w, x, y) => {
      if (w.kind !== "word" || w.charged) return;
      const pics: { g: Gem; c: Cell }[] = [];
      for (const n of NEIGHBORS) {
        const g = this.get(x + n.x, y + n.y);
        if (g && g.kind === "picture" && !g.charged) pics.push({ g, c: { x: x + n.x, y: y + n.y } });
      }
      if (!pics.length) return;
      const right = pics.find((p) => p.g.animal === w.animal);
      if (right) {
        w.charged = right.g.charged = true;
        w.chargeT = right.g.chargeT = 0;
        for (const p of pics) this.evaluated.add(`${w.id}:${p.g.id}`);
        this.stats.correct++;
        this.stats.score += 100;
        this.events.push({ type: "match", animal: w.animal!, word: { x, y }, picture: right.c });
        this.power++;
        if (this.power >= this.tuning.powerMax) this.fireBlast();
        else this.events.push({ type: "power", value: this.power });
        return;
      }
      // Wrong pictures: each word/picture pairing is judged once, and only when the player
      // just placed one of them (not when a cascade happens to push them together).
      let counted = false;
      for (const p of pics) {
        const key = `${w.id}:${p.g.id}`;
        if (this.evaluated.has(key)) continue;
        this.evaluated.add(key);
        if (!this.justPlaced.has(w.id) && !this.justPlaced.has(p.g.id)) continue;
        p.g.wrongT = 0;
        if (!counted) {
          counted = true;
          this.stats.incorrect++;
          this.events.push({ type: "mismatch", word: { x, y }, picture: p.c });
        }
      }
    });
  }

  private fireBlast(): void {
    this.power = 0;
    const dmg = this.tuning.blastDamage;
    this.dealDamage(dmg);
    this.stats.blasts++;
    this.stats.englishBonusDamage += dmg;
    this.events.push({ type: "blast", damage: dmg });
    this.events.push({ type: "power", value: 0 });
    // The blast also knocks the monster off balance: any pending attack is cancelled.
    const a = this.attack;
    if (a.state !== "idle") this.events.push({ type: "attackCancel" });
    a.state = "idle";
    a.cols = [];
    a.timer = Math.max(a.timer, this.tuning.blastStun);
  }

  private findAndStartClear(): boolean {
    const seen = new Set<Gem>();
    const groups: (Cell & { gem: Gem })[][] = [];
    this.forEachGem((g, x, y) => {
      if (g.kind !== "crash" || seen.has(g)) return;
      const touches = NEIGHBORS.some((n) => {
        const o = this.get(x + n.x, y + n.y);
        return o && o.kind !== "garbage" && o.color === g.color;
      });
      if (!touches) return;
      const group: (Cell & { gem: Gem })[] = [];
      const stack: Cell[] = [{ x, y }];
      seen.add(g);
      while (stack.length) {
        const c = stack.pop()!;
        const cg = this.get(c.x, c.y)!;
        group.push({ ...c, gem: cg });
        for (const n of NEIGHBORS) {
          const o = this.get(c.x + n.x, c.y + n.y);
          if (o && !seen.has(o) && o.kind !== "garbage" && o.color === g.color) {
            seen.add(o);
            stack.push({ x: c.x + n.x, y: c.y + n.y });
          }
        }
      }
      groups.push(group);
    });
    if (!groups.length) return false;

    const cells = groups.flat();
    // Gray garbage next to an exploding group breaks too (forgiving for children).
    const broken: (Cell & { gem: Gem })[] = [];
    for (const c of cells)
      for (const n of NEIGHBORS) {
        const o = this.get(c.x + n.x, c.y + n.y);
        if (o && o.kind === "garbage" && !seen.has(o)) {
          seen.add(o);
          broken.push({ x: c.x + n.x, y: c.y + n.y, gem: o });
        }
      }
    const all = cells.concat(broken);
    for (const c of all) c.gem.clearing = true;

    this.chain++;
    const t = this.tuning;
    const mult = t.chainMultipliers[Math.min(this.chain - 1, t.chainMultipliers.length - 1)];
    let pts = broken.length * 0.5;
    let biggest = 0;
    for (const g of groups) {
      pts += g.length + Math.max(0, g.length - 4) * 0.5;
      biggest = Math.max(biggest, g.length);
    }
    const charged = cells.filter((c) => c.gem.charged).length;
    const bonus = charged * t.chargedBonus;
    const damage = Math.max(1, Math.round((pts + bonus) * mult));
    const englishBonus = Math.round(bonus * mult);
    this.dealDamage(damage);
    this.stats.gemsCleared += all.length;
    this.stats.englishBonusDamage += englishBonus;
    this.stats.largestChain = Math.max(this.stats.largestChain, this.chain);
    this.stats.score += damage * 10;
    this.events.push({ type: "clear", cells: all, chain: this.chain, damage, englishBonus, biggest });
    this.step = "flash";
    this.flashT = FLASH_TIME;
    return true;
  }

  private dealDamage(n: number): void {
    this.stats.totalDamage += n;
    this.monsterHp = Math.max(this.tutorial ? 1 : 0, this.monsterHp - n);
  }

  // ---------------------------------------------------------------- monster

  private updateAttack(dt: number): void {
    const a = this.attack;
    if (this.tutorial || !this.tuning.attacksEnabled) return;
    if (a.state === "idle") {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.count = ATTACK_PATTERN[a.index++ % ATTACK_PATTERN.length];
        a.cols = this.chooseGarbageCols(a.count, []);
        if (!a.cols.length) {
          a.timer = 3;
          return;
        }
        a.state = "warning";
        a.timer = this.tuning.attackWarning;
        this.events.push({ type: "attackWarn", count: a.cols.length, cols: [...a.cols] });
      }
    } else if (a.state === "warning") {
      a.timer -= dt;
      if (a.timer <= 0) a.state = "ready"; // lands right after the next piece locks
    }
  }

  private columnSpace(x: number): number {
    let n = 0;
    while (n < ROWS && !this.grid[n][x]) n++;
    return n;
  }

  /** Never drops into nearly-full columns, and keeps the spawn columns clear when they are high. */
  private chooseGarbageCols(count: number, prefer: number[]): number[] {
    const ok = (x: number) => {
      const space = this.columnSpace(x);
      if (space <= 3) return false;
      if ((x === SPAWN_COL || x === SPAWN_COL + 1) && space <= 6) return false;
      return true;
    };
    const out = prefer.filter(ok).slice(0, count);
    const rest = this.rng.shuffle([...Array(COLS).keys()].filter((x) => ok(x) && !out.includes(x)));
    while (out.length < count && rest.length) out.push(rest.pop()!);
    return out;
  }

  private dropGarbage(): void {
    const a = this.attack;
    const cols = this.chooseGarbageCols(a.cols.length, a.cols);
    const cells: Cell[] = [];
    cols.forEach((x, i) => {
      const y = this.columnSpace(x) - 1;
      if (y < 0) return;
      const g = this.makeGem({ kind: "garbage", color: 0 }, -1.5 - i * 0.7);
      g.timer = this.tuning.garbageTurns;
      this.grid[y][x] = g;
      cells.push({ x, y });
    });
    this.events.push({ type: "garbage", cells });
    a.state = "idle";
    a.cols = [];
    a.timer = this.rng.range(this.tuning.attackIntervalMin, this.tuning.attackIntervalMax);
  }

  // ---------------------------------------------------------------- pairs

  private makeGem(s: GemSpec, vy: number): Gem {
    return {
      ...s,
      id: this.nextId++,
      charged: false,
      timer: 0,
      vy,
      clearing: false,
      landT: 9,
      wrongT: 9,
      chargeT: 9
    };
  }

  private color(): Color {
    return this.rng.int(4) as Color;
  }

  private genPair(): PairSpec {
    this.pairCount++;
    if (this.script.length) return this.script.shift()!;
    const n = this.pairCount;
    const t = this.tuning;
    this.crashDue++;
    if (this.pendingPicture) {
      this.pendingPicture = false;
      return this.picturePair(this.lastWord);
    }
    if (t.englishEvery > 0 && n >= 5 && (n - 5) % t.englishEvery === 0) {
      this.pendingPicture = true;
      return this.wordPair();
    }
    if (this.crashDue >= t.crashEvery) {
      this.crashDue = 0;
      return this.crashPair();
    }
    return { a: { kind: "normal", color: this.color() }, b: { kind: "normal", color: this.color() }, tag: "normal" };
  }

  private wordPair(): PairSpec {
    if (!this.wordBag.length) this.wordBag = this.rng.shuffle([...ANIMALS]);
    const animal = this.wordBag.pop()!;
    this.lastWord = animal;
    const word: GemSpec = { kind: "word", color: this.color(), animal };
    const other: GemSpec = { kind: "normal", color: this.color() };
    return this.rng.next() < 0.5 ? { a: word, b: other, tag: "word" } : { a: other, b: word, tag: "word" };
  }

  picturePair(animal: Animal): PairSpec {
    const wrong = this.rng.pick(ANIMALS.filter((a) => a !== animal));
    const right: GemSpec = { kind: "picture", color: this.color(), animal };
    const bad: GemSpec = { kind: "picture", color: this.color(), animal: wrong };
    return this.rng.next() < 0.5 ? { a: right, b: bad, tag: "picture" } : { a: bad, b: right, tag: "picture" };
  }

  /** Crash color favours colors that already form big groups, so a useful clear is possible. */
  private crashPair(): PairSpec {
    const best = [0, 0, 0, 0];
    const seen = new Set<Gem>();
    this.forEachGem((g, x, y) => {
      if (g.kind === "garbage" || seen.has(g)) return;
      let size = 0;
      const stack: Cell[] = [{ x, y }];
      seen.add(g);
      while (stack.length) {
        const c = stack.pop()!;
        size++;
        for (const n of NEIGHBORS) {
          const o = this.get(c.x + n.x, c.y + n.y);
          if (o && !seen.has(o) && o.kind !== "garbage" && o.kind !== "crash" && o.color === g.color) {
            seen.add(o);
            stack.push({ x: c.x + n.x, y: c.y + n.y });
          }
        }
      }
      best[g.color] = Math.max(best[g.color], size);
    });
    const w = best.map((s) => 1 + s * s);
    let r = this.rng.next() * w.reduce((a, b) => a + b, 0);
    let color: Color = 0;
    for (let i = 0; i < 4; i++) {
      r -= w[i];
      if (r <= 0) {
        color = i as Color;
        break;
      }
    }
    let other = this.color();
    if (other === color) other = ((other + 1 + this.rng.int(3)) % 4) as Color;
    const crash: GemSpec = { kind: "crash", color };
    const norm: GemSpec = { kind: "normal", color: other };
    return this.rng.next() < 0.5 ? { a: crash, b: norm, tag: "crash" } : { a: norm, b: crash, tag: "crash" };
  }

  // ---------------------------------------------------------------- scripting (tutorial, tests)

  /** Drops the falling pair without placing it (tutorial step changes); the next pair spawns. */
  discardPiece(): void {
    this.piece = null;
    this.softDrop = false;
  }

  /** Replaces the upcoming pairs (the visible "next" included). */
  setUpcoming(pairs: PairSpec[]): void {
    this.script = pairs.slice(1);
    this.queue = [pairs[0]];
  }

  /** Board from strings, top row first: . empty, rbgy normal, RBGY crash, x garbage. */
  setBoard(rows: string[]): void {
    const map: Record<string, GemSpec> = {
      r: { kind: "normal", color: 0 },
      b: { kind: "normal", color: 1 },
      g: { kind: "normal", color: 2 },
      y: { kind: "normal", color: 3 },
      R: { kind: "crash", color: 0 },
      B: { kind: "crash", color: 1 },
      G: { kind: "crash", color: 2 },
      Y: { kind: "crash", color: 3 },
      x: { kind: "garbage", color: 0 }
    };
    const off = ROWS - rows.length;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) this.grid[y][x] = null;
    rows.forEach((row, i) => {
      [...row].forEach((ch, x) => {
        const s = map[ch];
        if (!s) return;
        const g = this.makeGem(s, off + i);
        if (s.kind === "garbage") g.timer = this.tuning.garbageTurns;
        this.grid[off + i][x] = g;
      });
    });
  }

  placeGem(x: number, y: number, s: GemSpec): Gem {
    const g = this.makeGem(s, y);
    this.grid[y][x] = g;
    return g;
  }

  forEachGem(fn: (g: Gem, x: number, y: number) => void): void {
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const g = this.grid[y][x];
        if (g) fn(g, x, y);
      }
  }
}
