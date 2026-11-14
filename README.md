# Word Fighters

A small falling-gem puzzle battle for Japanese Grade 3 ESL students. Stack colored gems, use ★ crash gems to
break same-color groups, and put each English word gem next to its matching picture to charge it. Charged gems
deal bonus damage, and three matches fire an English Blast at the monster.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (relative paths: works from any folder or GitHub Pages)
npm run preview    # serve the build
```

No backend, accounts, webfonts or CDNs. Works offline once built.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | ← → (hold to repeat) | ◀ ▶ (hold to repeat) |
| Rotate | ↑ or X (Z rotates the other way) | ⟳ |
| Soft drop | ↓ (hold) | ▼ (hold: falls fast, locks on landing) |
| Hard drop | Space | (none: hold ▼) |

## For teachers / testing

- **Teacher mode** (checkbox on the title screen): a four-question word→picture check runs before play, and a
  post-check button appears on the results screen. Scores are kept for this browser session only.
- **Tutorial** runs on first play; replay it with **あそびかた**.
- **Developer panel**: press <kbd>`</kbd> or open with `?dev`. It changes fall speed, crash/English frequency,
  English bonus, blast damage, monster HP, attacks on/off and the seed, and can restart the battle.
- **Reproducible battles**: `?seed=123`.
- All tuning defaults live in `src/config.ts`.

## Tests

```bash
npm test                                                     # unit tests (game rules)
SIM=1 npx vitest run src/sim.test.ts --reporter=verbose      # balance bot report
npm run e2e                                                  # Playwright: keyboard battle, touch, tutorial, teacher mode
node scripts/shots.mjs                                       # screenshots at Chromebook sizes (after build)
```
