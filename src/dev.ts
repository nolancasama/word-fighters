// Hidden developer panel: press ` (backquote) or open with ?dev in the URL.
// Edits the live tuning object; HP and seed apply on restart.

import type { Tuning } from "./config";

interface DevHooks {
  tuning: Tuning;
  restart(seed: number | null): void;
  seed(): number;
  hurtMonster(): void;
}

export function setupDev(panel: HTMLElement, button: HTMLElement, hooks: DevHooks): void {
  const t = hooks.tuning;
  const num = (key: keyof Tuning, label: string, step = 1) =>
    `<label>${label}<input type="number" step="${step}" data-k="${key}" value="${t[key]}"></label>`;
  panel.innerHTML = `
    <b>Developer</b>
    ${num("fallInterval", "Fall s/row", 0.05)}
    ${num("crashEvery", "Crash every N pairs")}
    ${num("englishEvery", "English every N pairs (0=off)")}
    ${num("chargedBonus", "Charged gem bonus")}
    ${num("blastDamage", "Blast damage")}
    ${num("powerMax", "Matches per blast")}
    ${num("monsterHp", "Monster HP (restart)")}
    ${num("attackIntervalMin", "Attack every min s")}
    ${num("attackIntervalMax", "Attack every max s")}
    <label>Monster attacks<input type="checkbox" data-k="attacksEnabled" ${t.attacksEnabled ? "checked" : ""}></label>
    <label>Seed<input type="text" id="devSeed" placeholder="random"></label>
    <div><button data-restart>Restart battle</button><button data-hurt>HP → 1</button><button data-close>Close</button></div>
    <div id="devInfo" style="opacity:.7"></div>`;
  panel.querySelectorAll<HTMLInputElement>("[data-k]").forEach((inp) =>
    inp.addEventListener("change", () => {
      const k = inp.dataset.k as keyof Tuning;
      if (inp.type === "checkbox") (t as unknown as Record<string, unknown>)[k] = inp.checked;
      else (t as unknown as Record<string, unknown>)[k] = Number(inp.value);
    })
  );
  const info = panel.querySelector("#devInfo")!;
  const refresh = () => (info.textContent = `current seed: ${hooks.seed()}`);
  const toggle = (open?: boolean) => {
    panel.hidden = open === undefined ? !panel.hidden : !open;
    button.hidden = false;
    refresh();
  };
  panel.querySelector("[data-restart]")!.addEventListener("click", () => {
    const v = (panel.querySelector("#devSeed") as HTMLInputElement).value.trim();
    hooks.restart(v ? Number(v) >>> 0 : null);
    refresh();
  });
  panel.querySelector("[data-hurt]")!.addEventListener("click", () => hooks.hurtMonster());
  panel.querySelector("[data-close]")!.addEventListener("click", () => toggle(false));
  button.addEventListener("click", () => toggle());
  addEventListener("keydown", (e) => {
    if (e.key === "`") toggle();
  });
  if (new URLSearchParams(location.search).has("dev")) button.hidden = false;
}
