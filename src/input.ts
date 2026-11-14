// Keyboard + large touch buttons, with our own hold-to-repeat (ignores OS key repeat
// so movement speed is the same on every Chromebook).

export interface Controls {
  move(dx: number): void;
  rotate(dir: 1 | -1): void;
  hardDrop(): void;
  softDrop(on: boolean): void;
}

const DAS = 0.2; // seconds before a held direction repeats
const ARR = 0.085; // seconds between repeats

export class Input {
  private held: { dir: number; t: number; next: number; src: string } | null = null;
  private softSources = new Set<string>();
  enabled = false;
  /** Counters the tutorial watches. */
  moves = 0;
  rotations = 0;

  constructor(private target: () => Controls | null) {
    addEventListener("keydown", (e) => this.key(e, true));
    addEventListener("keyup", (e) => this.key(e, false));
    addEventListener("blur", () => this.releaseAll());
  }

  private key(e: KeyboardEvent, down: boolean): void {
    const k = e.key;
    const game = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "x", "X", "z", "Z"].includes(k);
    if (!game) return;
    // Keep arrows/space from scrolling or pressing focused buttons during play.
    if (this.enabled) e.preventDefault();
    if (!this.enabled) return;
    if (down && e.repeat) return;
    if (k === "ArrowLeft") down ? this.press(-1, "kL") : this.release("kL");
    else if (k === "ArrowRight") down ? this.press(1, "kR") : this.release("kR");
    else if (k === "ArrowDown") this.soft(down, "kD");
    else if (!down) return;
    else if (k === "ArrowUp" || k === "x" || k === "X") this.doRotate(1);
    else if (k === "z" || k === "Z") this.doRotate(-1);
    else if (k === " ") this.target()?.hardDrop();
  }

  bindButton(el: HTMLElement, action: "left" | "right" | "rotate" | "drop"): void {
    const id = `b-${action}`;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      if (!this.enabled) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.classList.add("pressed");
      if (action === "left") this.press(-1, id);
      else if (action === "right") this.press(1, id);
      else if (action === "rotate") this.doRotate(1);
      else this.soft(true, id);
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      el.classList.remove("pressed");
      if (action === "left" || action === "right") this.release(id);
      else if (action === "drop") this.soft(false, id);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private doRotate(dir: 1 | -1): void {
    this.rotations++;
    this.target()?.rotate(dir);
  }

  private press(dir: number, src: string): void {
    this.held = { dir, t: 0, next: DAS, src };
    this.moves++;
    this.target()?.move(dir);
  }

  private release(src: string): void {
    if (this.held?.src === src) this.held = null;
  }

  private soft(on: boolean, src: string): void {
    if (on) this.softSources.add(src);
    else this.softSources.delete(src);
    this.target()?.softDrop(this.softSources.size > 0);
  }

  releaseAll(): void {
    this.held = null;
    this.softSources.clear();
    this.target()?.softDrop(false);
    document.querySelectorAll(".pressed").forEach((b) => b.classList.remove("pressed"));
  }

  update(dt: number): void {
    const h = this.held;
    if (!h || !this.enabled) return;
    h.t += dt;
    while (h.t >= h.next) {
      h.next += ARR;
      this.target()?.move(h.dir);
    }
  }
}
