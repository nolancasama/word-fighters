import { describe, expect, it } from "vitest";
import { cloneTuning, COLS, ROWS } from "./config";
import { Game, type GemSpec, type PairSpec } from "./game";

const N = (color: 0 | 1 | 2 | 3): GemSpec => ({ kind: "normal", color });
const C = (color: 0 | 1 | 2 | 3): GemSpec => ({ kind: "crash", color });
const pair = (a: GemSpec, b: GemSpec): PairSpec => ({ a, b, tag: "normal" });

function newGame(over: Partial<ReturnType<typeof cloneTuning>> = {}, seed = 1) {
  const t = { ...cloneTuning(), attacksEnabled: false, ...over };
  return new Game({ seed, tuning: t });
}
/** Runs the loop until the board is waiting for player input again (or the game ends). */
function settle(g: Game, max = 600) {
  for (let i = 0; i < max; i++) {
    g.update(1 / 30);
    if (g.over || (g.phase === "falling" && g.piece)) return;
  }
  throw new Error("did not settle");
}
const kinds = (g: Game) => g.grid.map((r) => r.map((c) => (c ? "rbgy"[c.color] : ".")).join(""));

describe("movement and rotation", () => {
  it("moves within walls", () => {
    const g = newGame();
    settle(g);
    for (let i = 0; i < 10; i++) g.move(-1);
    expect(g.piece!.x).toBe(0);
    for (let i = 0; i < 10; i++) g.move(1);
    expect(g.piece!.x).toBe(COLS - 1);
  });

  it("rotates through all four orientations in open space", () => {
    const g = newGame();
    settle(g);
    const seen = new Set<number>();
    for (let i = 0; i < 4; i++) {
      expect(g.rotate(1)).toBe(true);
      seen.add(g.piece!.rot);
    }
    expect(seen.size).toBe(4);
  });

  it("kicks off the right wall when rotating", () => {
    const g = newGame();
    settle(g);
    for (let i = 0; i < 10; i++) g.move(1);
    expect(g.piece!.x).toBe(5);
    expect(g.rotate(1)).toBe(true); // b would be at x=6 -> pivot kicks to x=4
    const c = g.pieceCells()!;
    expect(c.a.x).toBe(4);
    expect(c.b.x).toBe(5);
  });

  it("kicks off the left wall when rotating counter-clockwise", () => {
    const g = newGame();
    settle(g);
    for (let i = 0; i < 10; i++) g.move(-1);
    expect(g.rotate(-1)).toBe(true);
    const c = g.pieceCells()!;
    expect(Math.min(c.a.x, c.b.x)).toBe(0);
    expect(c.a.x).toBe(1);
  });

  it("swaps the pair inside a one-wide well", () => {
    const g = newGame();
    g.setBoard(Array(ROWS).fill("rr.rrr").map((r, i) => (i < 2 ? "......" : r)));
    settle(g);
    for (let i = 0; i < 80; i++) g.update(1 / 30);
    const before = g.piece!.rot;
    expect(g.rotate(1)).toBe(true);
    expect(g.piece!.rot).toBe((before + 2) % 4);
  });

  it("hard drop locks and stacks, pairs split under gravity", () => {
    const g = newGame();
    g.setUpcoming([pair(N(0), N(1)), pair(N(2), N(3)), pair(N(2), N(3))]);
    settle(g);
    g.rotate(1); // horizontal: a at x=2, b at x=3
    g.hardDrop();
    settle(g);
    expect(kinds(g)[ROWS - 1]).toBe("..rb..");
    // place a vertical pair over column 2: it stacks
    g.hardDrop();
    settle(g);
    expect(g.get(2, ROWS - 2)!.color).toBe(2);
    expect(g.get(2, ROWS - 3)!.color).toBe(3);
  });

  it("splits a horizontal pair over uneven ground", () => {
    const g = newGame();
    g.setBoard(["..r...", "..r..."]);
    g.setUpcoming([pair(N(1), N(3)), pair(N(1), N(1))]);
    settle(g);
    g.rotate(1);
    g.hardDrop();
    settle(g);
    expect(g.get(2, ROWS - 3)!.color).toBe(1);
    expect(g.get(3, ROWS - 1)!.color).toBe(3);
  });
});

describe("crash gems, gravity and chains", () => {
  it("crash gem destroys the connected same-color group only", () => {
    const g = newGame();
    g.setBoard(["......", "bb....", "rrrb.."]);
    g.setUpcoming([pair(C(0), N(1)), pair(N(2), N(2))]);
    settle(g);
    for (let i = 0; i < 3; i++) g.move(-1);
    g.hardDrop(); // crash red at (0, 10)? no: a (crash) lands on top of column 0
    settle(g);
    // Column 0: r at 11, b at 10, crash at 9 -> crash touches blue? no; red crash touches nothing red
    expect(g.stats.gemsCleared).toBe(0);
  });

  it("clears a group touched by a crash gem and applies gravity", () => {
    const g = newGame();
    g.setBoard(["..b...", "rrrb.."]);
    g.setUpcoming([pair(C(0), N(3)), pair(N(2), N(2))]);
    settle(g);
    g.rotate(1); // crash at x=2, yellow at x=3
    g.move(-1); // crash at x=1, yellow at x=2
    g.hardDrop();
    settle(g);
    expect(g.stats.gemsCleared).toBe(4); // 3 red + crash
    // the blue above column 2 and the yellow fall down
    expect(kinds(g)[ROWS - 1]).toBe("..bb..");
    expect(g.get(2, ROWS - 2)!.color).toBe(3);
    expect(g.monsterHp).toBeLessThan(g.monsterMax);
  });

  it("runs multi-stage chain reactions with a growing multiplier", () => {
    const g = newGame();
    // Clearing the red row drops the blue crash onto the blue gems.
    g.setBoard(["B.....", "R.....", "rbb..."]);
    g.setUpcoming([pair(N(3), N(3)), pair(N(3), N(3))]);
    // Trigger: the red crash already touches red, so the first resolve happens on the first lock.
    settle(g);
    g.move(1);
    g.move(1);
    g.move(1);
    g.hardDrop();
    const clears: number[] = [];
    for (let i = 0; i < 300 && !(g.phase === "falling" && g.piece); i++) {
      g.update(1 / 30);
      for (const e of g.drainEvents()) if (e.type === "clear") clears.push(e.chain);
    }
    expect(clears).toEqual([1, 2]);
    expect(g.stats.largestChain).toBe(2);
    expect(kinds(g)[ROWS - 1]).toBe(".....y");
    expect(g.get(0, ROWS - 1)).toBeNull();
    expect(g.get(1, ROWS - 1)).toBeNull();
  });

  it("chain damage beats the same gems cleared without a chain", () => {
    const g = newGame();
    g.setBoard(["B.....", "R.....", "rbb..."]);
    g.setUpcoming([pair(N(3), N(3)), pair(N(3), N(3))]);
    settle(g);
    for (let i = 0; i < 3; i++) g.move(1);
    g.hardDrop();
    settle(g);
    // 2 red (1+1) + chain x1.5 on 3 blue = 2 + 4.5 -> 2 + 5 (rounded) = 7
    expect(g.stats.totalDamage).toBe(7);
  });
});

describe("English gems", () => {
  function englishGame(pics: [GemSpec, GemSpec]) {
    const g = newGame({ englishEvery: 0 });
    g.placeGem(0, ROWS - 1, { kind: "word", color: 1, animal: "cat" });
    g.setUpcoming([pair(pics[0], pics[1]), pair(N(2), N(2)), pair(N(2), N(2))]);
    settle(g);
    return g;
  }
  const cat: GemSpec = { kind: "picture", color: 0, animal: "cat" };
  const dog: GemSpec = { kind: "picture", color: 3, animal: "dog" };

  it("charges word and matching picture when adjacent", () => {
    const g = englishGame([cat, dog]);
    g.rotate(1); // cat at x=2, dog at x=3
    g.move(-1); // cat at x=1 next to the word at x=0
    g.hardDrop();
    const ev: string[] = [];
    for (let i = 0; i < 200 && !(g.phase === "falling" && g.piece); i++) {
      g.update(1 / 30);
      ev.push(...g.drainEvents().map((e) => e.type));
    }
    expect(ev).toContain("match");
    expect(g.get(0, ROWS - 1)!.charged).toBe(true);
    expect(g.get(1, ROWS - 1)!.charged).toBe(true);
    expect(g.get(2, ROWS - 1)!.charged).toBe(false);
    expect(g.stats.correct).toBe(1);
    expect(g.power).toBe(1);
    // charged gems stay on the board
    expect(g.get(0, ROWS - 1)!.kind).toBe("word");
  });

  it("wrong picture gives one incorrect, counted once", () => {
    const g = englishGame([dog, cat]);
    g.rotate(1);
    g.move(-1); // dog next to the word
    g.hardDrop();
    settle(g);
    expect(g.stats.incorrect).toBe(1);
    expect(g.stats.correct).toBe(0);
    expect(g.get(0, ROWS - 1)!.charged).toBe(false);
    // further pieces elsewhere do not re-count the same pair
    for (let i = 0; i < 3; i++) g.move(1);
    g.hardDrop();
    settle(g);
    expect(g.stats.incorrect).toBe(1);
  });

  it("correct wins when both pictures touch the word", () => {
    const g = newGame({ englishEvery: 0 });
    g.placeGem(2, ROWS - 1, { kind: "word", color: 1, animal: "cat" });
    g.setUpcoming([pair(dog, cat), pair(N(2), N(2))]);
    settle(g);
    g.rotate(1); // dog at 2, cat at 3 (horizontal) -> dog lands on the word, cat next to it
    g.move(-1); // dog at 1, cat at 2: cat lands on top of the word
    g.hardDrop();
    settle(g);
    expect(g.stats.correct).toBe(1);
    expect(g.stats.incorrect).toBe(0);
  });

  it("charged gems add bonus damage when cleared", () => {
    const plain = newGame();
    plain.setBoard(["rr...."]);
    const charged = newGame();
    charged.setBoard(["rr...."]);
    charged.grid[ROWS - 1][0]!.charged = true;
    for (const g of [plain, charged]) {
      g.setUpcoming([pair(C(0), N(2)), pair(N(2), N(2))]);
      settle(g);
      g.rotate(1);
      g.hardDrop(); // crash at x=2 touches red at x=1
      settle(g);
    }
    expect(plain.stats.gemsCleared).toBe(3);
    expect(charged.stats.totalDamage - plain.stats.totalDamage).toBe(3);
    expect(charged.stats.englishBonusDamage).toBe(3);
  });

  it("filling the power meter fires a blast", () => {
    const g = newGame({ englishEvery: 0, powerMax: 1 });
    g.placeGem(0, ROWS - 1, { kind: "word", color: 1, animal: "cat" });
    g.setUpcoming([pair(cat, dog), pair(N(2), N(2))]);
    settle(g);
    g.rotate(1);
    g.move(-1);
    g.hardDrop();
    settle(g);
    expect(g.stats.blasts).toBe(1);
    expect(g.power).toBe(0);
    expect(g.monsterHp).toBe(g.monsterMax - g.tuning.blastDamage);
  });

  it("word pair is followed by a picture pair with exactly one right picture", () => {
    const g = newGame({ englishEvery: 5 });
    const tags: string[] = [];
    let word = "";
    for (let i = 0; i < 12; i++) {
      settle(g);
      const p = g.piece!;
      tags.push(p.a.kind === "word" || p.b.kind === "word" ? "W" : p.a.kind === "picture" ? "P" : ".");
      if (p.a.kind === "word") word = p.a.animal!;
      if (p.b.kind === "word") word = p.b.animal!;
      if (p.a.kind === "picture") {
        const animals = [p.a.animal, p.b.animal];
        expect(animals.filter((a) => a === word).length).toBe(1);
        expect(p.b.kind).toBe("picture");
      }
      // keep the board from filling
      g.forEachGem((_, x, y) => (g.grid[y][x] = null));
      g.hardDrop();
    }
    expect(tags.join("")).toBe("....WP...WP.");
  });
});

describe("garbage, win and lose", () => {
  it("telegraphs, drops garbage after the next lock, and converts it", () => {
    const g = newGame({ attacksEnabled: true, garbageTurns: 2, attackWarning: 1, crashEvery: 99, englishEvery: 0 });
    g.attack.timer = 0.01;
    const seen: string[] = [];
    for (let i = 0; i < 200; i++) {
      g.update(1 / 30);
      for (const e of g.drainEvents()) {
        seen.push(e.type);
      }
      if (g.attack.state === "ready") break;
    }
    expect(seen).toContain("attackWarn");
    expect(g.attack.state).toBe("ready");
    g.move(-1);
    g.move(-1);
    g.hardDrop();
    settle(g);
    const garbage = () => {
      let n = 0;
      g.forEachGem((gem) => (n += gem.kind === "garbage" ? 1 : 0));
      return n;
    };
    expect(garbage()).toBe(1);
    g.hardDrop();
    settle(g);
    g.hardDrop();
    settle(g);
    expect(garbage()).toBe(0);
  });

  it("garbage next to an exploding group breaks", () => {
    const g = newGame();
    g.setBoard(["x.....", "rr...."]);
    g.setUpcoming([pair(C(0), N(2)), pair(N(2), N(2))]);
    settle(g);
    g.rotate(1);
    g.hardDrop();
    settle(g);
    let n = 0;
    g.forEachGem((gem) => (n += gem.kind === "garbage" ? 1 : 0));
    expect(n).toBe(0);
  });

  it("wins when monster HP reaches zero", () => {
    const g = newGame({ monsterHp: 2 });
    g.setBoard(["rr...."]);
    g.setUpcoming([pair(C(0), N(2)), pair(N(2), N(2))]);
    settle(g);
    g.rotate(1);
    g.hardDrop();
    settle(g);
    expect(g.phase).toBe("won");
  });

  it("loses when the spawn column tops out", () => {
    const g = newGame();
    for (let i = 0; i < 20 && !g.over; i++) {
      settle(g);
      if (g.over) break;
      g.hardDrop();
    }
    expect(g.phase).toBe("lost");
  });

  it("restart is a fresh game with the same seed", () => {
    const a = newGame({}, 42);
    const b = newGame({}, 42);
    for (const g of [a, b])
      for (let i = 0; i < 6; i++) {
        settle(g);
        g.move(i % 3 - 1);
        g.hardDrop();
      }
    settle(a);
    settle(b);
    expect(kinds(a)).toEqual(kinds(b));
  });
});
