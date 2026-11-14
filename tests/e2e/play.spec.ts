import { expect, test, type Page } from "@playwright/test";

// In-page greedy planner (same idea as src/sim.test.ts). Returns the target {x, rot} for the current piece.
const PLAN = `(() => {
  const g = window.__wf.game;
  if (!g || !g.piece || g.phase !== "falling") return null;
  const p = g.piece;
  let best = -1e18, pick = null;
  for (let rot = 0; rot < 4; rot++) for (let x = 0; x < 6; x++) {
    const save = { x: p.x, y: p.y, rot: p.rot };
    p.x = x; p.rot = rot; p.y = 0;
    const ok = g.canPlace(x, 0, rot) || g.canPlace(x, 1, rot);
    const gh = ok ? g.ghost() : null;
    Object.assign(p, save);
    if (!gh) continue;
    let s = Math.random();
    for (const [gem, c] of [[p.a, gh.a], [p.b, gh.b]]) {
      if (c.y < 1) { s -= 1e8; continue; }
      const h = 12 - c.y; s -= h * h * 0.15;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1]]) {
        const o = g.get(c.x + dx, c.y + dy); if (!o) continue;
        if (o.color === gem.color && o.kind !== "garbage") s += gem.kind === "crash" ? 6 : 2.5;
        if (gem.kind === "picture" && o.kind === "word" && !o.charged) s += o.animal === gem.animal ? 40 : -10;
        if (gem.kind === "word" && o.kind === "picture" && !o.charged && o.animal === gem.animal) s += 40;
      }
    }
    if (s > best) { best = s; pick = { x, rot }; }
  }
  return pick;
})()`;

async function state(page: Page) {
  return page.evaluate(() => {
    const w = (window as any).__wf;
    const g = w.game;
    return {
      mode: w.mode as string,
      phase: g?.phase as string,
      x: g?.piece?.x as number | undefined,
      rot: g?.piece?.rot as number | undefined,
      hp: g?.monsterHp as number,
      stats: g ? { ...g.stats } : null
    };
  });
}

/** Plays one piece with real key presses. Returns false if there was no piece to play. */
async function playPiece(page: Page): Promise<boolean> {
  const target = (await page.evaluate(PLAN)) as { x: number; rot: number } | null;
  if (!target) return false;
  for (let i = 0; i < 4; i++) {
    const s = await state(page);
    if (s.rot === undefined || s.rot === target.rot) break;
    await page.keyboard.press("ArrowUp");
  }
  for (let i = 0; i < 8; i++) {
    const s = await state(page);
    if (s.x === undefined || s.x === target.x) break;
    await page.keyboard.press(s.x > target.x ? "ArrowLeft" : "ArrowRight");
  }
  await page.keyboard.press("Space");
  return true;
}

async function boot(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem("wf.tutorialDone", "1"));
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as any).__wf?.mode === "title");
  return errors;
}

test("keyboard: full battle to victory, results, play again resets", async ({ page }, info) => {
  test.skip(info.project.name !== "chromebook");
  test.setTimeout(400_000);
  const errors = await boot(page, "?seed=11");
  await page.click("[data-start]");
  await expect.poll(async () => (await state(page)).mode).toBe("battle");
  const t0 = Date.now();
  let pieces = 0;
  let sawWarn = false;
  while (Date.now() - t0 < 330_000) {
    const s = await state(page);
    if (s.mode !== "battle") break;
    if (!sawWarn) sawWarn = await page.locator("#warn").isVisible();
    // Child-like pace (about 1.5 s per piece) so monster attacks and garbage really happen.
    if (await playPiece(page)) {
      pieces++;
      await page.waitForTimeout(1200);
    } else await page.waitForTimeout(60);
  }
  const s = await state(page);
  console.log(`battle: ${Math.round((Date.now() - t0) / 1000)}s real, game ${Math.round(s.stats!.time)}s, pieces ${pieces}, phase ${s.phase}`, s.stats);
  expect(s.phase).toBe("won");
  expect(s.stats!.correct).toBeGreaterThan(0);
  expect(s.stats!.englishBonusDamage).toBeGreaterThan(0);
  expect(sawWarn).toBe(true);
  await page.waitForSelector('[data-screen="results"]');
  await expect(page.locator('[data-result="won"]')).toBeVisible();
  await page.screenshot({ path: "shots/e2e-results-win.png" });
  await page.click("[data-again]");
  const r = await state(page);
  expect(r.mode).toBe("battle");
  expect(r.stats!.score).toBe(0);
  expect(r.hp).toBe(100);
  expect(r.stats!.correct).toBe(0);
  expect(errors).toEqual([]);
});

test("keyboard: topping out loses, restart has no leftover state", async ({ page }, info) => {
  test.skip(info.project.name !== "chromebook");
  const errors = await boot(page, "?seed=4");
  await page.click("[data-start]");
  await expect.poll(async () => (await state(page)).mode).toBe("battle");
  for (let i = 0; i < 60; i++) {
    const s = await state(page);
    if (s.mode !== "battle") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('[data-result="lost"]', { timeout: 20_000 });
  await page.screenshot({ path: "shots/e2e-results-lose.png" });
  await page.click("[data-again]");
  await page.waitForTimeout(400);
  const r = await state(page);
  expect(r.mode).toBe("battle");
  expect(r.phase).toBe("falling");
  const empty = await page.evaluate(() => {
    let n = 0;
    (window as any).__wf.game.forEachGem(() => n++);
    return n;
  });
  expect(empty).toBe(0);
  expect(await page.locator("#warn").isVisible()).toBe(false);
  expect(errors).toEqual([]);
});

test("touch: buttons move, rotate, hold-repeat and drop", async ({ page }, info) => {
  test.skip(info.project.name !== "chromebook-touch");
  const errors = await boot(page, "?seed=2");
  await page.tap("[data-start]");
  await expect.poll(async () => (await state(page)).mode).toBe("battle");
  await page.waitForFunction(() => !!(window as any).__wf.game.piece);
  const btn = (act: string) => page.locator(`[data-act="${act}"]`);
  const x0 = (await state(page)).x!;
  await btn("left").tap();
  expect((await state(page)).x).toBe(x0 - 1);
  await btn("right").tap();
  await btn("right").tap();
  expect((await state(page)).x).toBe(x0 + 1);
  const r0 = (await state(page)).rot!;
  await btn("rotate").tap();
  expect((await state(page)).rot).not.toBe(r0);
  // hold LEFT: repeats to the wall
  await btn("left").dispatchEvent("pointerdown", { pointerId: 7, pointerType: "touch", isPrimary: true });
  await page.waitForTimeout(900);
  await btn("left").dispatchEvent("pointerup", { pointerId: 7, pointerType: "touch", isPrimary: true });
  const sx = await state(page);
  expect(Math.min(sx.x!, sx.rot === 3 ? sx.x! - 1 : sx.x!)).toBe(0);
  // hold DROP: piece locks quickly
  const placed0 = (await state(page)).stats!.piecesPlaced;
  await btn("drop").dispatchEvent("pointerdown", { pointerId: 8, pointerType: "touch", isPrimary: true });
  await page.waitForTimeout(900);
  await btn("drop").dispatchEvent("pointerup", { pointerId: 8, pointerType: "touch", isPrimary: true });
  expect((await state(page)).stats!.piecesPlaced).toBeGreaterThan(placed0);
  // page did not scroll
  expect(await page.evaluate(() => scrollY + document.scrollingElement!.scrollTop)).toBe(0);
  await page.screenshot({ path: "shots/e2e-touch.png" });
  expect(errors).toEqual([]);
});

test("tutorial: three steps, then battle", async ({ page }, info) => {
  test.skip(info.project.name !== "chromebook");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__wf?.mode === "title");
  await page.click("[data-start]");
  await expect.poll(async () => (await state(page)).mode).toBe("tutorial");
  const step = () => page.evaluate(() => (document.querySelector("#tutorialCard h2")?.textContent ?? "").trim());
  expect(await step()).toContain("うごかして");
  await page.waitForFunction(() => !!(window as any).__wf.game.piece);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect.poll(step, { timeout: 8000 }).toContain("あつめよう");
  await page.screenshot({ path: "shots/e2e-tut-crash.png" });
  // crash step: red crash (pivot) + yellow above. Rotate so crash is left, move it next to the reds.
  for (let i = 0; i < 6 && !(await step()).includes("えいご"); i++) {
    await page.waitForFunction(() => !!(window as any).__wf.game.piece);
    await page.keyboard.press("ArrowUp"); // b right of crash
    await page.keyboard.press("ArrowLeft"); // crash at x=1 over the reds
    await page.keyboard.press("Space");
    await page.waitForTimeout(1600);
  }
  await expect.poll(step, { timeout: 8000 }).toContain("えいご");
  await page.screenshot({ path: "shots/e2e-tut-english.png" });
  // english: word CAT at x=2 bottom. First try: wrong picture onto it, then correct.
  for (let i = 0; i < 6 && !(await step()).includes("OK"); i++) {
    await page.waitForFunction(() => !!(window as any).__wf.game.piece);
    const pos = await page.evaluate(() => {
      const p = (window as any).__wf.game.piece;
      return { aCat: p.a.animal === "cat" };
    });
    // vertical pair dropped on x=2: the bottom gem (a) touches the word.
    if (i === 0 ? pos.aCat : !pos.aCat) await page.keyboard.press("ArrowUp"), await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Space");
    await page.waitForTimeout(1800);
  }
  await expect.poll(step, { timeout: 8000 }).toContain("OK");
  await page.click("[data-go]");
  await expect.poll(async () => (await state(page)).mode).toBe("battle");
  expect(await page.evaluate(() => localStorage.getItem("wf.tutorialDone"))).toBe("1");
  expect(errors).toEqual([]);
});

test("teacher mode: pre-check before battle, post-check after", async ({ page }, info) => {
  test.skip(info.project.name !== "chromebook");
  await boot(page, "?seed=4");
  await page.check("[data-teacher]");
  await page.click("[data-start]");
  for (let i = 0; i < 4; i++) {
    await page.waitForSelector('[data-quiz="pre"]');
    const word = await page.getAttribute(".quiz-word", "data-word");
    await page.click(`[data-pick="${word}"]`);
  }
  await page.click("[data-next]");
  await expect.poll(async () => (await state(page)).mode).toBe("battle");
  for (let i = 0; i < 60; i++) {
    if ((await state(page)).mode !== "battle") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('[data-screen="results"]', { timeout: 20_000 });
  await expect(page.locator(".teacher-line").first()).toContainText("before: 4/4");
  await page.click("[data-post]");
  for (let i = 0; i < 4; i++) {
    await page.waitForSelector('[data-quiz="post"]');
    await page.click("[data-pick]"); // first picture, whatever it is
  }
  await page.click("[data-next]");
  await expect(page.locator(".teacher-line").first()).toContainText("after:");
  await page.screenshot({ path: "shots/e2e-teacher.png" });
});
