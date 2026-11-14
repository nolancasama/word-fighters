// Balance simulation. Run with: SIM=1 npx vitest run src/sim.test.ts
// A simple greedy bot plays at "child speed" (one piece every `think` seconds)
// with and without matching English, so we can see battle length and the English edge.
import { describe, expect, it } from "vitest";
import { cloneTuning, COLS, ROWS, type Tuning } from "./config";
import { Game, type Gem } from "./game";

function landing(g: Game, x: number, rot: number) {
  const p = g.piece!;
  const save = { x: p.x, rot: p.rot, y: p.y };
  p.x = x;
  p.rot = rot;
  p.y = 0;
  const ok = g.canPlace(x, 0, rot) || g.canPlace(x, 1, rot);
  const gh = ok ? g.ghost() : null;
  Object.assign(p, save);
  return gh;
}

function score(g: Game, x: number, rot: number, english: boolean, rnd: () => number): number {
  const gh = landing(g, x, rot);
  if (!gh) return -1e9;
  const p = g.piece!;
  let s = rnd() * 2;
  for (const [gem, c] of [
    [p.a, gh.a],
    [p.b, gh.b]
  ] as [Gem, { x: number; y: number }][]) {
    if (c.y < 1) return -1e8;
    const height = ROWS - c.y;
    s -= height * height * 0.15;
    if (x === 2 || x === 3) s -= height > 8 ? 30 : 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1]
    ]) {
      const o = g.get(c.x + dx, c.y + dy);
      if (!o) continue;
      if (o.color === gem.color && o.kind !== "garbage") s += gem.kind === "crash" ? 6 : 2.5;
      if (english && gem.kind === "picture" && o.kind === "word" && !o.charged) s += o.animal === gem.animal ? 40 : -10;
      if (english && gem.kind === "word" && o.kind === "picture" && !o.charged && o.animal === gem.animal) s += 40;
    }
  }
  return s;
}

function play(seed: number, english: boolean, think: number, tuning: Tuning) {
  const g = new Game({ seed, tuning });
  let r = seed * 7 + 1;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let wait = 0;
  while (!g.over && g.time < 600) {
    g.update(1 / 30);
    if (g.phase === "falling" && g.piece) {
      wait += 1 / 30;
      if (wait < think) continue;
      wait = 0;
      let best = -Infinity;
      let pick = { x: 2, rot: 0 };
      for (let x = 0; x < COLS; x++)
        for (let rot = 0; rot < 4; rot++) {
          const s = score(g, x, rot, english, rnd);
          if (s > best) {
            best = s;
            pick = { x, rot };
          }
        }
      const p = g.piece;
      if (g.canPlace(pick.x, p.y, pick.rot)) {
        p.x = pick.x;
        p.rot = pick.rot;
      }
      g.hardDrop();
    }
  }
  return g;
}

describe.runIf(process.env.SIM)("balance sim", () => {
  it("reports", () => {
    const t = { ...cloneTuning(), ...JSON.parse(process.env.SIM_T ?? "{}") };
    for (const think of [2, 3.5]) {
      for (const english of [true, false]) {
        const rows: string[] = [];
        let wins = 0;
        let time = 0;
        for (let seed = 1; seed <= 20; seed++) {
          const g = play(seed, english, think, t);
          if (g.phase === "won") {
            wins++;
            time += g.time;
          }
          rows.push(`${g.phase[0]}${Math.round(g.time)}:${g.stats.correct}/${g.stats.blasts}/${Math.round((g.stats.gemsCleared / (2 * g.stats.piecesPlaced)) * 100)}%`);
        }
        console.log(`think=${think}s english=${english} wins=${wins}/20 avgWin=${Math.round(time / Math.max(1, wins))}s  ${rows.join(" ")}`);
      }
    }
    expect(true).toBe(true);
  });
});
