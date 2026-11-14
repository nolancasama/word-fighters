// Screenshot pass at Chromebook sizes. Usage: npm run build && node scripts/shots.mjs
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const port = 4182;
const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { shell: true, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const errors = [];
try {
  for (const [w, h] of [[1366, 657], [1280, 689]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`http://localhost:${port}/?seed=5`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `shots/${w}-title.png` });
    await page.click("[data-start]");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `shots/${w}-tutorial.png` });
    await page.click("[data-skip]");
    await page.waitForTimeout(300);
    // play a little: drop a few pieces
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight");
      if (i % 3 === 0) await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Space");
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `shots/${w}-battle.png` });
    // Staged state: charged word+picture, garbage, and a telegraphed attack.
    await page.evaluate(() => {
      const g = window.__wf.game;
      g.setBoard(["......", "x.....", "rr.gby", "rbggby", "yrbbgg"]);
      const wd = g.placeGem(3, 7, { kind: "word", color: 1, animal: "bird" });
      const pc = g.placeGem(4, 7, { kind: "picture", color: 0, animal: "bird" });
      wd.charged = pc.charged = true;
      g.placeGem(5, 7, { kind: "picture", color: 2, animal: "cat" });
      g.power = 2;
      g.attack.timer = 0.01;
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `shots/${w}-staged.png` });
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
  process.exit(0);
}
