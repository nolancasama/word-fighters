// A simple, cute procedural monster ("Gobble") drawn on its own small canvas.

export class Monster {
  private c: CanvasRenderingContext2D;
  private w = 300;
  private h = 260;
  private dpr = 1;
  private hurtT = 9;
  private attackT = 9;
  private cheerT = 9;
  warning = false;
  outcome: "won" | "lost" | null = null;
  private outcomeT = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.c = canvas.getContext("2d")!;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  reset(): void {
    this.hurtT = this.attackT = this.cheerT = 9;
    this.warning = false;
    this.outcome = null;
    this.outcomeT = 0;
  }

  hit(): void {
    this.hurtT = 0;
  }
  throwGems(): void {
    this.attackT = 0;
  }
  dizzy(): void {
    this.cheerT = 0;
  }

  center(): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.52 };
  }

  draw(now: number, dt: number, hpFrac: number): void {
    this.hurtT += dt;
    this.attackT += dt;
    this.cheerT += dt;
    if (this.outcome) this.outcomeT += dt;
    const c = this.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const s = Math.min(this.w, this.h) / 260;
    const cx = this.w / 2;
    const base = this.h * 0.9;

    const hurt = this.hurtT < 0.35;
    const defeated = this.outcome === "won";
    const laughing = this.outcome === "lost";
    let bob = Math.sin(now * 2.4) * 5 * s;
    let squashX = 1 + Math.sin(now * 2.4) * 0.02;
    let squashY = 1 - Math.sin(now * 2.4) * 0.02;
    let shake = 0;
    if (hurt) {
      const k = 1 - this.hurtT / 0.35;
      shake = Math.sin(this.hurtT * 70) * 8 * s * k;
      squashX += 0.12 * k;
      squashY -= 0.12 * k;
    }
    if (this.warning) {
      squashX += 0.05 + 0.03 * Math.sin(now * 14);
      squashY += 0.05;
    }
    if (this.attackT < 0.4) {
      const k = Math.sin((this.attackT / 0.4) * Math.PI);
      squashY += 0.15 * k;
      bob -= 18 * s * k;
    }
    if (laughing) bob = -Math.abs(Math.sin(this.outcomeT * 8)) * 16 * s;
    if (defeated) {
      const k = Math.min(1, this.outcomeT / 0.6);
      squashY = 1 - 0.55 * k;
      squashX = 1 + 0.35 * k;
      bob = 0;
    }

    // shadow
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.beginPath();
    c.ellipse(cx, base, 90 * s * squashX, 14 * s, 0, 0, Math.PI * 2);
    c.fill();

    c.save();
    c.translate(cx + shake, base + bob);
    c.scale(squashX, squashY);
    const body = hurt ? "#f5f3ff" : this.warning ? "#c026d3" : "#a855f7";
    const dark = "#6b21a8";

    // feet
    c.fillStyle = dark;
    for (const fx of [-48, 48]) {
      c.beginPath();
      c.ellipse(fx * s, -6 * s, 26 * s, 14 * s, 0, 0, Math.PI * 2);
      c.fill();
    }
    // horns
    c.fillStyle = "#fde68a";
    c.strokeStyle = "#92400e";
    c.lineWidth = 3 * s;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 40 * s, -158 * s);
      c.quadraticCurveTo(side * 70 * s, -200 * s, side * 62 * s, -212 * s);
      c.quadraticCurveTo(side * 52 * s, -180 * s, side * 22 * s, -170 * s);
      c.closePath();
      c.fill();
      c.stroke();
    }
    // body blob
    c.fillStyle = body;
    c.strokeStyle = dark;
    c.lineWidth = 5 * s;
    c.beginPath();
    c.moveTo(-95 * s, -10 * s);
    c.bezierCurveTo(-110 * s, -120 * s, -70 * s, -185 * s, 0, -185 * s);
    c.bezierCurveTo(70 * s, -185 * s, 110 * s, -120 * s, 95 * s, -10 * s);
    c.quadraticCurveTo(0, 8 * s, -95 * s, -10 * s);
    c.closePath();
    c.fill();
    c.stroke();
    // belly
    c.fillStyle = "rgba(255,255,255,0.28)";
    c.beginPath();
    c.ellipse(0, -55 * s, 55 * s, 42 * s, 0, 0, Math.PI * 2);
    c.fill();
    // spots
    c.fillStyle = "rgba(107,33,168,0.35)";
    for (const [x, y, r] of [
      [-62, -110, 9],
      [66, -90, 7],
      [-50, -60, 6]
    ])
      (c.beginPath(), c.arc(x * s, y * s, r * s, 0, Math.PI * 2), c.fill());

    // eyes
    const eyeY = -118 * s;
    const look = -6 * s; // looks toward the player's board (left)
    for (const ex of [-34, 34]) {
      const x = ex * s;
      if (defeated) {
        c.strokeStyle = "#1f2937";
        c.lineWidth = 6 * s;
        c.beginPath();
        c.moveTo(x - 12 * s, eyeY - 12 * s);
        c.lineTo(x + 12 * s, eyeY + 12 * s);
        c.moveTo(x + 12 * s, eyeY - 12 * s);
        c.lineTo(x - 12 * s, eyeY + 12 * s);
        c.stroke();
        continue;
      }
      if (hurt) {
        c.strokeStyle = "#1f2937";
        c.lineWidth = 6 * s;
        c.beginPath();
        const d = ex < 0 ? 1 : -1;
        c.moveTo(x - 12 * s * d, eyeY - 10 * s);
        c.lineTo(x + 10 * s * d, eyeY);
        c.lineTo(x - 12 * s * d, eyeY + 10 * s);
        c.stroke();
        continue;
      }
      c.fillStyle = "#fff";
      c.strokeStyle = dark;
      c.lineWidth = 3 * s;
      c.beginPath();
      c.ellipse(x, eyeY, 22 * s, 26 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      const blink = Math.sin(now * 0.9 + ex) > 0.985;
      if (blink) {
        c.fillStyle = body;
        c.fillRect(x - 23 * s, eyeY - 27 * s, 46 * s, 52 * s);
        c.strokeStyle = "#1f2937";
        c.beginPath();
        c.moveTo(x - 16 * s, eyeY);
        c.lineTo(x + 16 * s, eyeY);
        c.stroke();
      } else {
        c.fillStyle = "#1f2937";
        c.beginPath();
        c.arc(x + look, eyeY + 4 * s, 11 * s, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(x + look - 4 * s, eyeY - 1 * s, 4 * s, 0, Math.PI * 2);
        c.fill();
      }
      // worried / angry brows
      c.strokeStyle = dark;
      c.lineWidth = 5 * s;
      c.beginPath();
      const angry = this.warning || laughing;
      const worried = hpFrac < 0.35 && !angry;
      const d = ex < 0 ? 1 : -1;
      const tilt = angry ? 8 : worried ? -8 : 0;
      c.moveTo(x - 18 * s * d, eyeY - 34 * s - tilt * s * -1);
      c.lineTo(x + 16 * s * d, eyeY - 34 * s + tilt * s);
      c.stroke();
    }

    // mouth
    c.fillStyle = "#3b0764";
    c.beginPath();
    if (defeated || hurt) c.ellipse(0, -66 * s, 16 * s, 12 * s, 0, 0, Math.PI * 2);
    else if (laughing || this.warning) c.ellipse(0, -66 * s, 26 * s, 18 * s, 0, 0, Math.PI);
    else {
      c.moveTo(-26 * s, -72 * s);
      c.quadraticCurveTo(0, -46 * s, 26 * s, -72 * s);
      c.closePath();
    }
    c.fill();
    if (!defeated) {
      c.fillStyle = "#fff";
      c.beginPath();
      c.moveTo(-16 * s, -71 * s);
      c.lineTo(-10 * s, -60 * s);
      c.lineTo(-5 * s, -71 * s);
      c.moveTo(16 * s, -71 * s);
      c.lineTo(10 * s, -60 * s);
      c.lineTo(5 * s, -71 * s);
      c.fill();
    }
    // cheeks
    c.fillStyle = "rgba(244,114,182,0.5)";
    for (const x of [-62, 62]) (c.beginPath(), c.ellipse(x * s, -82 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2), c.fill());
    c.restore();

    // dizzy stars after an English Blast or defeat
    if (this.cheerT < 2.5 || defeated) {
      const r = 70 * s;
      for (let i = 0; i < 3; i++) {
        const a = now * 4 + (i * Math.PI * 2) / 3;
        const x = cx + Math.cos(a) * r;
        const y = base - (defeated ? 90 : 215) * s + Math.sin(a) * r * 0.25;
        star(c, x, y, 11 * s, "#fde047");
      }
    }
  }
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill;
  c.strokeStyle = "#a16207";
  c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
  c.fill();
  c.stroke();
}
