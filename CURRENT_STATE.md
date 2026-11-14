# Current State

## Status
Playable vertical slice, complete as of 2026-11-09. All automated checks pass. Not yet played by a human or by children.
GitHub: https://github.com/nolancasama/word-fighters (public). Live: https://nolancasama.github.io/word-fighters/
Every push to `main` builds and deploys via `.github/workflows/pages.yml` (GitHub Actions).

## What Exists
Vite + TypeScript, vanilla DOM + Canvas 2D, no runtime dependencies. See README.md for run, controls and test commands.

- `src/config.ts`: all tuning defaults (the dev panel edits a live copy).
- `src/game.ts`: pure rules with no DOM or timers (`update(dt)`): pairs, rotation/kicks, gravity, crash, chains,
  word/picture charging, power meter + English Blast, monster HP, telegraphed garbage, conversion, win/lose,
  seeded RNG, scripting helpers (`setBoard`, `setUpcoming`, `placeGem`, `discardPiece`).
- Presentation: `render.ts` (board, ghost, next), `monster.ts`, `fx.ts`, `art.ts` (original animal SVGs, gem sprites),
  `audio.ts` (synth sfx, mute, optional TTS of the matched word), `input.ts` (keyboard + touch buttons with hold-repeat),
  `main.ts` (layout, loop, title/results screens, HUD).
- `tutorial.ts` (3 interactive steps, first play only), `quiz.ts` (teacher pre/post check), `dev.ts` (`` ` `` key or `?dev`).
- Tests: `src/game.test.ts` (22 unit tests), `src/sim.test.ts` (balance bot, `SIM=1`),
  `tests/e2e/play.spec.ts` (Playwright at 1366x657 and 1280x689 touch: full keyboard battle to victory,
  lose → Play Again with clean state, touch buttons incl. hold-repeat and hold-drop, tutorial, teacher mode),
  `scripts/shots.mjs` (screenshots incl. a staged charged/garbage/warning state).

## Verified
- Unit 22/22, e2e 5/5 passing, no page errors.
- Screenshots checked at 1366x657 and 1280x689: layout fits without scrolling, word gems are legible,
  charged gems, garbage countdown and attack telegraph are visible.
- Balance (bot): at child pace, about 2:10 to win with English and about 2:50 without.

## Known Issues
- Portrait/phone layout is a minimal untuned fallback.
- Balance is tuned against a greedy bot only. Real child play may need slower falling or lower HP
  (dev panel / `config.ts`).
- Sound and TTS were not verified by ear (headless browser).
- Not tested on a physical Chromebook (performance should be fine: about 80 sprite blits per frame, no WebGL).

## Next Steps
1. Human playtest (the user, then a class); adjust `DEFAULT_TUNING` from observations.
2. `git init` + baseline commit and a GitHub repo, if the user wants one (siblings are public repos under nolancasama).
3. Possible follow-ups (not requested): more words, per-round CSV export for the teacher check.
