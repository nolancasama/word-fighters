// First-play interactive introduction: three tiny steps, each learned by doing.
// Runs on a tutorial Game (no monster attacks, monster cannot be beaten).

import { cloneTuning, ROWS } from "./config";
import { Game, type GameEvent, type GemSpec, type PairSpec } from "./game";
import type { Sprites } from "./art";
import type { Input } from "./input";

type Step = "move" | "crash" | "english" | "done" | "finished";

const N = (color: 0 | 1 | 2 | 3): GemSpec => ({ kind: "normal", color });

export class Tutorial {
  game: Game;
  step: Step = "move";
  private locks = 0;
  private wait = -1;
  private moveBase = { moves: 0, rotations: 0 };
  private tries = 0;

  constructor(
    private card: HTMLElement,
    private sprites: Sprites,
    private input: Input,
    private onDone: () => void
  ) {
    const t = cloneTuning();
    t.englishEvery = 0;
    t.crashEvery = 999;
    t.fallInterval = 1;
    this.game = new Game({ seed: 7, tuning: t, tutorial: true });
    this.game.setUpcoming([pair(N(1), N(1)), pair(N(3), N(0)), pair(N(2), N(2)), pair(N(0), N(3))]);
    this.moveBase = { moves: input.moves, rotations: input.rotations };
    this.show();
  }

  private img(spec: GemSpec): string {
    return `<img src="${this.sprites.url(spec)}" alt="">`;
  }

  private show(extra = ""): void {
    const c = this.card;
    c.hidden = false;
    const skip = `<button class="skip" data-skip>スキップ ▶</button>`;
    if (this.step === "move") {
      c.innerHTML = `<h2>うごかして<br>まわそう！</h2>
        <div class="hint">◀ ▶ うごく <span class="kbd">←</span><span class="kbd">→</span><br>
        ⟳ まわる <span class="kbd">↑</span><br>▼ おとす <span class="kbd">↓</span> <span class="kbd">space</span></div>${skip}`;
    } else if (this.step === "crash") {
      c.innerHTML = `<h2>おなじ いろを<br>あつめよう！</h2>
        <div class="demo">${this.img(N(0))}${this.img(N(0))}${this.img({ kind: "crash", color: 0 })}<span>→</span><span>💥</span></div>
        <div class="hint">★を おなじ いろに くっつけて けそう！</div>${extra}${skip}`;
    } else if (this.step === "english") {
      const word = this.img({ kind: "word", color: 1, animal: "cat" });
      c.innerHTML = `<h2>えいごと えを<br>あわせよう！</h2>
        <div class="demo">${word}${this.img({ kind: "picture", color: 0, animal: "cat" })}<span class="ok">◎</span></div>
        <div class="demo">${word}${this.img({ kind: "picture", color: 3, animal: "dog" })}<span class="ng">×</span></div>
        <div class="hint">あうと パワー アップ！</div>${extra}${skip}`;
    } else {
      c.innerHTML = `<h2>じゅんび OK！</h2>
        <div class="demo">${this.img({ kind: "word", color: 2, animal: "fish" })}${this.img({ kind: "picture", color: 1, animal: "fish" })}<span>⭐</span></div>
        <button class="big" data-go>たたかう！</button>`;
    }
    c.querySelector("[data-skip]")?.addEventListener("click", () => this.finish());
    c.querySelector("[data-go]")?.addEventListener("click", () => this.finish());
  }

  finish(): void {
    if (this.step === ("finished")) return;
    this.step = "finished";
    this.card.hidden = true;
    try {
      localStorage.setItem("wf.tutorialDone", "1");
    } catch {
      /* ignore */
    }
    this.onDone();
  }

  private toCrash(): void {
    this.step = "crash";
    this.locks = 0;
    const g = this.game;
    g.setBoard(["rr..bb", "rrg.bb"]);
    const crash = (): PairSpec => ({ a: { kind: "crash", color: 0 }, b: N(3), tag: "crash" });
    g.setUpcoming(Array.from({ length: 12 }, crash));
    g.discardPiece();
    this.show();
  }

  private setupEnglish(): void {
    const g = this.game;
    g.setBoard([]);
    g.placeGem(2, ROWS - 1, { kind: "word", color: 1, animal: "cat" });
    const wrong = (["dog", "fish", "bird"] as const)[this.tries % 3];
    const right: GemSpec = { kind: "picture", color: 0, animal: "cat" };
    const bad: GemSpec = { kind: "picture", color: 3, animal: wrong };
    const p: PairSpec = this.tries % 2 ? { a: right, b: bad, tag: "picture" } : { a: bad, b: right, tag: "picture" };
    g.setUpcoming([p, p, p]);
    g.discardPiece();
  }

  private toEnglish(): void {
    this.step = "english";
    this.locks = 0;
    this.setupEnglish();
    this.show();
  }

  onEvent(e: GameEvent): void {
    if (e.type === "lock") this.locks++;
    if (this.step === "crash" && e.type === "clear" && this.wait < 0) this.wait = 1.1;
    if (this.step === "english") {
      if (e.type === "match" && this.wait < 0) this.wait = 1.4;
      if (e.type === "mismatch") this.show(`<div class="ng" style="font-size:22px">もういちど！</div>`);
    }
  }

  update(dt: number): void {
    const g = this.game;
    if (this.wait >= 0) {
      this.wait -= dt;
      if (this.wait < 0) {
        if (this.step === "crash") this.toEnglish();
        else if (this.step === "english") {
          this.step = "done";
          this.show();
        }
      }
      return;
    }
    if (this.step === "move") {
      const moved = this.input.moves > this.moveBase.moves && this.input.rotations > this.moveBase.rotations;
      if ((moved && this.locks >= 1) || this.locks >= 3) {
        if (g.phase === "falling" && !g.piece) this.toCrash();
      }
    }
    // English step: after a try without a match, reset the little board for another go.
    if (this.step === "english" && g.phase === "falling" && !g.piece && this.locks > 0) {
      this.locks = 0;
      this.tries++;
      this.setupEnglish();
    }
    if (this.step === "crash" && g.phase === "falling" && !g.piece && this.locks >= 3) {
      this.locks = 0;
      this.toCrash();
    }
  }
}

function pair(a: GemSpec, b: GemSpec): PairSpec {
  return { a, b, tag: "normal" };
}
