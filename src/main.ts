// Wires the pure Game to the screen: layout, loop, effects, HUD, screens.

import { cloneTuning, COLS, ROWS } from "./config";
import { Game, type GameEvent, type GemSpec } from "./game";
import { BoardView, NextView } from "./render";
import { Monster } from "./monster";
import { Fx } from "./fx";
import { Input } from "./input";
import { GEM_COLORS, loadArt } from "./art";
import { isMuted, setMuted, sfx, speakWord, stopSpeech, unlockAudio } from "./audio";
import { Tutorial } from "./tutorial";
import { runQuiz, type QuizResult } from "./quiz";
import { setupDev } from "./dev";
import { randomSeed } from "./rng";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const app = $("app");
const screen = $("screen");
const tuning = cloneTuning();
const params = new URLSearchParams(location.search);
const seedParam = params.has("seed") ? Number(params.get("seed")) >>> 0 : null;

const boardView = new BoardView($<HTMLCanvasElement>("board"));
const nextView = new NextView($<HTMLCanvasElement>("next"));
const monster = new Monster($<HTMLCanvasElement>("monster"));
const fx = new Fx($<HTMLCanvasElement>("fx"), $("stage"));

type Mode = "title" | "tutorial" | "battle" | "end" | "menu";
let mode: Mode = "title";
let game: Game | null = null;
let tutorial: Tutorial | null = null;
let currentSeed = 0;
let endT = 0;
let hpShown = 0;
let matchWord = 0;
let teacher = false;
let preDone = false;
const quizLog: QuizResult[] = [];
const history: { won: boolean; time: number }[] = [];

function tutorialDone(): boolean {
  try {
    return localStorage.getItem("wf.tutorialDone") === "1";
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ input

const input = new Input(() => {
  const g = game;
  if (!g || (mode !== "battle" && mode !== "tutorial")) return null;
  return {
    move: (dx) => g.move(dx),
    rotate: (d) => g.rotate(d),
    hardDrop: () => g.hardDrop(),
    softDrop: (on) => g.setSoftDrop(on)
  };
});
document.querySelectorAll<HTMLElement>("[data-act]").forEach((b) => input.bindButton(b, b.dataset.act as "left"));
document.addEventListener(
  "touchmove",
  (e) => {
    if (!(e.target as HTMLElement).closest?.(".sheet")) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("pointerdown", () => unlockAudio(), { capture: true });
document.addEventListener("keydown", () => unlockAudio(), { capture: true });
document.addEventListener("visibilitychange", () => input.releaseAll());

const muteBtn = $("muteBtn");
const syncMute = () => (muteBtn.textContent = isMuted() ? "🔇" : "🔊");
muteBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  syncMute();
  muteBtn.blur();
});
syncMute();

// ------------------------------------------------------------------ layout

function layout(): void {
  const W = innerWidth;
  const H = innerHeight;
  const portrait = W < H * 1.15 || W < 760;
  app.classList.toggle("portrait", portrait);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let cell: number;
  let side: number;
  if (!portrait) {
    cell = Math.floor(Math.min((H - 34) / ROWS, 66));
    side = Math.min(360, (W - cell * COLS - 70) / 2);
    if (side < 230) {
      side = 230;
      cell = Math.floor(Math.min(cell, (W - 2 * side - 70) / COLS));
    }
  } else {
    side = W - 16;
    cell = Math.floor(Math.min((H - 400) / ROWS, (W - 24) / COLS));
  }
  cell = Math.max(24, cell);
  app.style.setProperty("--cell", `${cell}px`);
  app.style.setProperty("--side", `${side}px`);
  boardView.resize(cell, dpr);
  nextView.resize(Math.round(Math.min(cell * 0.85, 56)), dpr);
  const padH = Math.max(88, Math.min(150, H * 0.22));
  const mw = portrait ? 200 : side - 24;
  const mh = portrait ? 130 : Math.max(120, Math.min(mw * 0.9, H - 24 - 46 - 10 - 52 - 10 - padH - 14));
  monster.resize(Math.floor(mw), Math.floor(mh), dpr);
  fx.resize(dpr);
}
addEventListener("resize", layout);

// ------------------------------------------------------------------ flow

function hideScreen(): void {
  screen.hidden = true;
  screen.innerHTML = "";
}

function resetView(): void {
  fx.clear();
  monster.reset();
  input.releaseAll();
  stopSpeech();
  $("warn").hidden = true;
  lastHud = "";
}

function showTitle(): void {
  mode = "title";
  input.enabled = false;
  const s = boardView.sprites;
  const img = (g: GemSpec) => `<img src="${s.url(g)}" alt="">`;
  screen.hidden = false;
  screen.innerHTML = `<div class="sheet" data-screen="title">
    <h1 class="title">Word <span>Fighters</span></h1>
    <div class="title-demo">${img({ kind: "word", color: 1, animal: "dog" })}${img({ kind: "picture", color: 0, animal: "dog" })}
      ${img({ kind: "normal", color: 2 })}${img({ kind: "normal", color: 2 })}${img({ kind: "crash", color: 2 })}</div>
    <h2>えいごの ちからで モンスターを たおそう！</h2>
    <button class="big" data-start>スタート！</button><br>
    <button class="small-btn" data-howto>あそびかた</button>
    <label class="toggle"><input type="checkbox" data-teacher ${teacher ? "checked" : ""}> せんせい モード (teacher check)</label>
  </div>`;
  screen.querySelector("[data-start]")!.addEventListener("click", () => start(false));
  screen.querySelector("[data-howto]")!.addEventListener("click", () => start(true));
  screen.querySelector<HTMLInputElement>("[data-teacher]")!.addEventListener("change", (e) => {
    teacher = (e.target as HTMLInputElement).checked;
    preDone = false;
  });
}

function start(forceTutorial: boolean): void {
  unlockAudio();
  sfx.tap();
  if (teacher && !preDone) {
    mode = "menu";
    runQuiz(screen, "pre", (r) => {
      quizLog.push(r);
      preDone = true;
      start(forceTutorial);
    });
    return;
  }
  if (forceTutorial || !tutorialDone()) startTutorial();
  else startBattle();
}

function startTutorial(): void {
  hideScreen();
  resetView();
  mode = "tutorial";
  tutorial = new Tutorial($("tutorialCard"), boardView.sprites, input, () => startBattle());
  game = tutorial.game;
  hpShown = game.monsterHp;
  input.enabled = true;
}

function startBattle(seed: number | null = null): void {
  hideScreen();
  resetView();
  $("tutorialCard").hidden = true;
  tutorial = null;
  currentSeed = seed ?? seedParam ?? randomSeed();
  game = new Game({ seed: currentSeed, tuning });
  hpShown = game.monsterHp;
  mode = "battle";
  input.enabled = true;
}

function fmtTime(t: number): string {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function showResults(): void {
  const g = game!;
  mode = "menu";
  input.enabled = false;
  const s = g.stats;
  const won = g.phase === "won";
  const tries = s.correct + s.incorrect;
  const acc = tries ? `${Math.round((s.correct / tries) * 100)}%` : "-";
  const pre = [...quizLog].reverse().find((q) => q.kind === "pre");
  const post = [...quizLog].reverse().find((q) => q.kind === "post");
  const wins = history.filter((h) => h.won).length;
  const teacherBlock = teacher
    ? `<div class="teacher-line">Teacher check — before: <b>${pre ? pre.score + "/4" : "-"}</b> · after: <b>${post ? post.score + "/4" : "-"}</b>
       <button class="small-btn" data-post>あと テスト (post-check)</button></div>`
    : "";
  screen.hidden = false;
  screen.innerHTML = `<div class="sheet" data-screen="results" data-result="${won ? "won" : "lost"}">
    <h1>${won ? "かち！ 🎉" : "ざんねん！"}</h1>
    <h2>${won ? "YOU WIN!" : "もういちど がんばろう！"}</h2>
    <div class="stats">
      <div><span>じかん Time</span><b>${fmtTime(s.time)}</b></div>
      <div><span>けした ジェム Gems</span><b data-stat="gems">${s.gemsCleared}</b></div>
      <div><span>れんさ Best chain</span><b data-stat="chain">${s.largestChain}</b></div>
      <div><span>スコア Score</span><b>${s.score}</b></div>
      <div class="en"><span>えいご ◎ Correct</span><b data-stat="correct">${s.correct}</b></div>
      <div class="en"><span>えいご × Incorrect</span><b data-stat="incorrect">${s.incorrect}</b></div>
      <div class="en"><span>せいかい Accuracy</span><b>${acc}</b></div>
      <div class="en"><span>えいご ボーナス Bonus dmg</span><b data-stat="bonus">${s.englishBonusDamage}</b></div>
    </div>
    ${teacherBlock}
    <button class="big" data-again>もういちど！ Play Again</button><br>
    <button class="small-btn" data-title>タイトル</button>
    <div class="teacher-line">This session: ${history.length} battle${history.length === 1 ? "" : "s"}, ${wins} win${wins === 1 ? "" : "s"}</div>
  </div>`;
  screen.querySelector("[data-again]")!.addEventListener("click", () => {
    sfx.tap();
    startBattle();
  });
  screen.querySelector("[data-title]")!.addEventListener("click", () => showTitle());
  screen.querySelector("[data-post]")?.addEventListener("click", () =>
    runQuiz(screen, "post", (r) => {
      quizLog.push(r);
      showResults();
    })
  );
}

// ------------------------------------------------------------------ events -> effects

const GOLD = "#fde047";
const praise = ["Great!", "Nice!", "Super!"];

function boardCenter() {
  const r = boardView.canvas.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 };
}

function handle(e: GameEvent): void {
  const g = game!;
  tutorial?.onEvent(e);
  switch (e.type) {
    case "move":
      sfx.move();
      break;
    case "rotate":
      sfx.rotate();
      break;
    case "land":
      sfx.land();
      break;
    case "clear": {
      sfx.clear(e.chain);
      let cx = 0;
      let cy = 0;
      for (const c of e.cells) {
        const p = boardView.cellCenter(c.x, c.y);
        cx += p.x;
        cy += p.y;
        const col = c.gem.kind === "garbage" ? "#9ca3af" : GEM_COLORS[c.gem.color].base;
        fx.burst(p.x, p.y, c.gem.charged ? GOLD : col, e.cells.length > 12 ? 4 : 7);
      }
      cx /= e.cells.length;
      cy /= e.cells.length;
      fx.ring(cx, cy, "#fff", 40 + e.cells.length * 8);
      if (e.chain >= 2) fx.text(cx, cy - 30, `${e.chain} れんさ!`, "#f0abfc", 32 + e.chain * 4, 1.1);
      if (e.cells.length >= 7 || e.chain >= 2) {
        fx.shake(6 + e.chain * 3);
        fx.flash("#fff", 0.12);
      }
      const dmg = e.damage;
      const english = e.englishBonus > 0;
      const first = e.cells.find((c) => c.gem.kind !== "garbage")?.gem ?? e.cells[0].gem;
      const color = english ? GOLD : GEM_COLORS[first.color].base;
      fx.shoot({ x: cx, y: cy }, monster.center(), color, 8 + Math.min(16, dmg), 0.1, () => {
        hpShown = Math.max(0, hpShown - dmg);
        monster.hit();
        sfx.hit();
        const mc = monster.center();
        fx.text(mc.x + (Math.random() - 0.5) * 60, mc.y - 50, `-${dmg}`, english ? GOLD : "#fff", 30 + Math.min(30, dmg * 2), 1);
        if (english) fx.text(mc.x, mc.y + 10, "★ English!", GOLD, 24, 1);
        if (dmg >= 8) fx.shake(8);
      });
      break;
    }
    case "match": {
      const a = boardView.cellCenter(e.word.x, e.word.y);
      const b = boardView.cellCenter(e.picture.x, e.picture.y);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      sfx.match();
      speakWord(e.animal);
      fx.burst(a.x, a.y, GOLD, 12);
      fx.burst(b.x, b.y, GOLD, 12);
      fx.ring(m.x, m.y, GOLD, 80, 0.5);
      fx.text(m.x, m.y - 30, praise[matchWord++ % praise.length], GOLD, 40, 1.1);
      break;
    }
    case "mismatch": {
      const p = boardView.cellCenter(e.picture.x, e.picture.y);
      sfx.wrong();
      fx.text(p.x, p.y - 20, "?", "#e0e7ff", 34, 0.7);
      break;
    }
    case "power": {
      const card = $("powerCard");
      card.classList.remove("pulse");
      void card.offsetWidth;
      card.classList.add("pulse");
      break;
    }
    case "blast": {
      const card = $("powerCard");
      card.classList.remove("full");
      void card.offsetWidth;
      card.classList.add("full");
      const r = card.getBoundingClientRect();
      const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      sfx.blast();
      const bc = boardCenter();
      fx.text(bc.x, bc.y, "ENGLISH POWER!", GOLD, 40, 1.4);
      fx.flash(GOLD, 0.25);
      const dmg = e.damage;
      fx.shoot(from, monster.center(), GOLD, 24, 0.25, () => {
        hpShown = Math.max(0, hpShown - dmg);
        monster.hit();
        monster.dizzy();
        monster.warning = false;
        sfx.hit();
        const mc = monster.center();
        fx.ring(mc.x, mc.y, GOLD, 140, 0.6);
        fx.text(mc.x, mc.y - 60, `-${dmg}`, GOLD, 58, 1.2);
        fx.shake(14, 0.35);
      });
      break;
    }
    case "attackWarn":
      monster.warning = true;
      sfx.warn();
      break;
    case "attackCancel": {
      monster.warning = false;
      const mc = monster.center();
      fx.text(mc.x, mc.y - 100, "ストップ！", "#a7f3d0", 30, 1.2);
      break;
    }
    case "garbage":
      monster.warning = false;
      monster.throwGems();
      sfx.garbage();
      fx.shake(5);
      for (const c of e.cells) {
        const p = boardView.cellCenter(c.x, 0);
        fx.burst(p.x, p.y, "#9ca3af", 6, 160);
      }
      break;
    case "convert":
      for (const c of e.cells) {
        const p = boardView.cellCenter(c.x, c.y);
        fx.burst(p.x, p.y, "#fff", 6, 120);
      }
      break;
    case "won": {
      monster.outcome = "won";
      monster.warning = false;
      sfx.win();
      const bc = boardCenter();
      fx.text(bc.x, bc.y, "WIN!", GOLD, 80, 2.2);
      for (let i = 0; i < 5; i++) fx.burst(bc.x + (Math.random() - 0.5) * 200, bc.y + (Math.random() - 0.5) * 200, ["#f472b6", GOLD, "#60a5fa", "#4ade80"][i % 4], 16, 380);
      endGame(true);
      break;
    }
    case "lost": {
      monster.outcome = "lost";
      monster.warning = false;
      sfx.lose();
      const bc = boardCenter();
      fx.text(bc.x, bc.y, "ざんねん！", "#e0e7ff", 54, 2.2);
      endGame(false);
      break;
    }
  }
  void g;
}

function endGame(won: boolean): void {
  if (mode !== "battle") {
    // A tutorial top-out just restarts the tutorial board.
    if (mode === "tutorial" && !won) startTutorial();
    return;
  }
  mode = "end";
  input.enabled = false;
  input.releaseAll();
  endT = 2.2;
  history.push({ won, time: game!.stats.time });
}

// ------------------------------------------------------------------ HUD

let lastHud = "";
function hud(): void {
  const g = game;
  if (!g) return;
  const a = g.attack;
  const warnOn = a.state !== "idle" && a.cols.length > 0 && !g.over;
  const warnTxt = a.state === "ready" ? "!" : String(Math.max(1, Math.ceil(a.timer)));
  const key = `${g.stats.score}|${g.power}|${g.tuning.powerMax}|${Math.round(hpShown)}|${warnOn}|${warnTxt}|${a.cols.length}|${mode}`;
  if (key === lastHud) return;
  lastHud = key;
  $("score").textContent = String(g.stats.score);
  const stars = $("power");
  if (stars.childElementCount !== g.tuning.powerMax) stars.innerHTML = "<i>★</i>".repeat(g.tuning.powerMax);
  [...stars.children].forEach((s, i) => s.classList.toggle("on", i < g.power));
  const frac = Math.max(0, hpShown / g.monsterMax);
  $("hpFill").style.width = `${frac * 100}%`;
  $("hpLag").style.width = `${frac * 100}%`;
  $("hpText").textContent = g.tutorial ? "∞" : String(Math.ceil(hpShown));
  const warn = $("warn");
  warn.hidden = !warnOn;
  if (warnOn) {
    $("warnGems").innerHTML = "<i></i>".repeat(a.cols.length);
    $("warnTime").textContent = warnTxt;
  }
}

// ------------------------------------------------------------------ loop

let last = performance.now();
function frame(ts: number): void {
  const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
  last = ts;
  const now = ts / 1000;
  input.update(dt);
  if (game) {
    if (mode === "battle" || mode === "tutorial") game.update(dt);
    for (const e of game.drainEvents()) handle(e);
    if (mode === "tutorial") tutorial?.update(dt);
  }
  if (mode === "end") {
    endT -= dt;
    if (endT <= 0 && !fx.busy) showResults();
  }
  fx.update(dt);
  if (game) {
    boardView.draw(game, now);
    nextView.draw(game.over ? undefined : game.queue[0]);
    monster.draw(now, dt, hpShown / game.monsterMax);
    hud();
  }
  fx.draw();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot

async function boot(): Promise<void> {
  layout();
  await loadArt();
  layout(); // rebuild sprites now that animal pictures are loaded
  // An idle demo board behind the title screen.
  game = new Game({ seed: 3, tuning: { ...tuning, attacksEnabled: false } });
  game.setBoard(["......", "......", ".b..y.", "rbg.yy", "rrggby"]);
  game.update(0.016);
  game.drainEvents();
  hpShown = game.monsterHp;
  setupDev($("dev"), $("devBtn"), {
    tuning,
    restart: (seed) => startBattle(seed),
    seed: () => currentSeed,
    hurtMonster: () => {
      if (game && mode === "battle") {
        game.monsterHp = 1;
        hpShown = 1;
      }
    }
  });
  showTitle();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

// Test/debug hooks (harmless in production: they only read or restart local state).
(window as unknown as Record<string, unknown>).__wf = {
  get game() {
    return game;
  },
  get mode() {
    return mode;
  },
  get hpShown() {
    return hpShown;
  },
  tuning,
  startBattle,
  skipTutorial: () => tutorial?.finish()
};

void boot();
