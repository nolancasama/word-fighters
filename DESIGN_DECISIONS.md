# Design Decisions

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

---

## 2026-11-09 — Initial prototype decisions

- **Stack: vanilla TypeScript + Vite, Canvas 2D, no runtime deps.** No existing framework to reuse; React would add weight
  for no benefit on Chromebooks. Gem sprites are pre-rendered once per cell size and only blitted.
- **Game logic is pure (`src/game.ts`), driven only by `update(dt)`.** No setTimeout anywhere in gameplay, so a restart is a new
  `Game` with no leftover timers, and unit tests and the balance bot can drive it deterministically from a seed.
- **Crash gems every 2nd pair, not every 4th as the plan suggested.** A balance bot at child speed topped out in about 100 s
  with crashes every 4 (or 3) pairs, so the board fills faster than it clears. At every 2 pairs, a bot placing one piece every
  3.5 s wins in about 129 s with English matching and about 167 s without, which is the 2–3 min target with a clear English edge.
- **Monster HP 100; damage = gems (+0.5 per gem over 4 in a group) × chain multiplier [1, 1.5, 2, 2.5, 3]; charged gem +3.**
- **English power meter: 3 correct matches fire an "English Blast"** (15 damage, and it cancels any pending monster attack).
  This gives the meter a concrete, visible payoff beyond the charged-gem bonus.
- **Word/picture flow:** a word gem arrives in a pair with a normal gem (pair 5, then every 5 pairs). The very next pair holds two
  pictures (one right, one wrong, random order, colors independent of the word so color never gives the answer away).
  Word and picture never share a falling pair.
- **Match judging:** a correct adjacency charges both gems at any time. A wrong adjacency counts as one incorrect attempt
  only when the player just placed one of the two gems (not when a cascade happens to push them together), and each
  word/picture pair is judged only once. If both pictures touch the word, the correct one wins and no wrong attempt is counted.
- **Garbage:** telegraphed for 4 s (red column arrows + monster bubble countdown), then lands right after the next piece locks,
  never into the falling piece. It never targets nearly full columns, or the spawn columns when they are high. It converts to a
  color after 5 pieces and breaks if next to an exploding group (forgiving). Sizes cycle through 1,2,1,1,2,2: learnable but varied.
- **Touch DROP = hold to fast-fall (locks on contact while held); keyboard Space = instant hard drop.** A tap on a touch button
  cannot accidentally slam a piece down, which is more forgiving for 8-year-olds.
- **Ghost landing preview** for each gem of the pair (pairs split): cheap, and it helps children aim pictures at words.
- **Tutorial** is three do-it-yourself steps in the monster panel (it never covers the board), in hiragana only. Shown once per
  browser (`localStorage wf.tutorialDone`). It can be replayed from "あそびかた" and skipped at any time.
- **Teacher check** gives no right/wrong feedback (it is a measurement). It runs once before play when teacher mode is switched on,
  and a post-check button sits on every results screen. Results stay in memory for the session only.
- **TTS** says the matched word only (rate-limited, en-US, never awaited). Saying the word when it appears would turn word
  *reading* into *listening*, which is not what we want to measure.
