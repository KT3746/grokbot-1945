/** Particulas, rastros, flashes e textos de combo — premium. */

export class FX {
  constructor() {
    this.bits = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
    this.hurt = 0;
    this.reduced = false;
  }

  reset() {
    this.bits.length = 0;
    this.texts.length = 0;
    this.shake = 0;
    this.flash = 0;
    this.hurt = 0;
  }

  _cap(max) {
    if (this.bits.length > max) this.bits.splice(0, this.bits.length - max);
  }

  boom(x, y, n = 18, color = "#e8c070") {
    this._cap(90);
    n = Math.min(n, 28);
    if (this.reduced) n = Math.max(4, Math.floor(n * 0.4));
    // flash central
    this.bits.push({
      x, y, vx: 0, vy: 0,
      life: 0.22, max: 0.22, r: 14 + Math.random() * 8,
      color: "#fff8e0", kind: "glow",
    });
    this.bits.push({
      x, y, vx: 0, vy: 0,
      life: 0.28, max: 0.28, r: 22,
      color: "rgba(255,200,100,0.35)", kind: "glow",
    });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 70 + Math.random() * 260;
      this.bits.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5,
        max: 0.7,
        r: 1.4 + Math.random() * 3.6,
        color: i % 4 === 0 ? "#fff4d0" : i % 3 === 0 ? "#ff9a4a" : color,
        kind: i % 4 === 0 ? "streak" : "spark",
      });
    }
    for (let i = 0; i < 6; i++) {
      this.bits.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 50,
        life: 0.5 + Math.random() * 0.3,
        max: 0.7,
        r: 4 + Math.random() * 6,
        color: "#c9d4e0aa",
        kind: "puff",
      });
    }
    // anel de impacto
    this.bits.push({
      x, y, vx: 0, vy: 0,
      life: 0.28, max: 0.28, r: 10,
      color: "#fff6c8", kind: "ring",
    });
    if (!this.reduced) {
      this.shake = Math.min(14, this.shake + 4.5);
      this.flash = Math.max(this.flash, 0.2);
    }
  }

  trail(x, y, color = "#9ad4ff") {
    this._cap(80);
    this.bits.push({
      x, y,
      vx: (Math.random() - 0.5) * 14,
      vy: 35 + Math.random() * 40,
      life: 0.28, max: 0.28, r: 1.8 + Math.random(),
      color, kind: "spark",
    });
    if (Math.random() < 0.35) {
      this.bits.push({
        x, y: y + 4,
        vx: (Math.random() - 0.5) * 8,
        vy: 20,
        life: 0.18, max: 0.18, r: 3,
        color: "#ffe08a55", kind: "glow",
      });
    }
  }

  impact(x, y) {
    this._cap(80);
    const n = this.reduced ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      this.bits.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.12 + Math.random() * 0.1,
        max: 0.22,
        r: 1.2,
        color: i % 2 ? "#fff4d0" : "#ff9a4a",
        kind: "spark",
      });
    }
  }

  /** Hit flash + soft shake (respeita reduced-motion). */
  softHit(x, y) {
    this.impact(x, y);
    if (this.reduced) {
      this.flash = Math.max(this.flash, 0.06);
      return;
    }
    this.shake = Math.max(this.shake, 1.6);
    this.flash = Math.max(this.flash, 0.09);
  }

  /** Faíscas de rasante (tiro quase acertou). */
  graze(x, y) {
    this._cap(70);
    const n = this.reduced ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 110;
      this.bits.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.14 + Math.random() * 0.12,
        max: 0.26,
        r: 1.3 + Math.random(),
        color: i % 2 ? "#9ad4ff" : "#fff8e0",
        kind: "spark",
      });
    }
    if (!this.reduced) {
      this.bits.push({
        x, y, vx: 0, vy: 0,
        life: 0.16, max: 0.16, r: 14,
        color: "rgba(154,212,255,0.35)", kind: "glow",
      });
      this.flash = Math.max(this.flash, 0.04);
    }
  }

  softShake(amt) {
    if (this.reduced) return;
    this.shake = Math.max(this.shake, amt);
  }

  softFlash(amt) {
    const a = this.reduced ? Math.min(amt, 0.1) : amt;
    this.flash = Math.max(this.flash, a);
  }

  /** Anel de combo/multikill (respeita reduced-motion). */
  comboRing(x, y, tier = 1) {
    this._cap(90);
    const hot = tier >= 3;
    if (this.reduced) {
      this.bits.push({
        x, y, vx: 0, vy: 0,
        life: 0.18, max: 0.18, r: 16 + tier * 2,
        color: hot ? "#ff6a4a" : "#ffe08a", kind: "ring",
      });
      this.flash = Math.max(this.flash, 0.05);
      return;
    }
    this.bits.push({
      x, y, vx: 0, vy: 0,
      life: 0.32, max: 0.32, r: 12 + tier * 3,
      color: hot ? "#ff6a4a" : "#fff6c8", kind: "ring",
    });
    this.bits.push({
      x, y, vx: 0, vy: 0,
      life: 0.2, max: 0.2, r: 18 + tier * 4,
      color: hot ? "rgba(255,100,60,0.35)" : "rgba(255,220,120,0.3)", kind: "glow",
    });
    this.flash = Math.max(this.flash, hot ? 0.16 : 0.1);
    this.shake = Math.max(this.shake, hot ? 3.2 : 1.8);
  }


  muzzle(x, y) {
    this._cap(90);
    this.bits.push({
      x, y, vx: 0, vy: -50,
      life: 0.1, max: 0.1, r: 9,
      color: "#fff8e0", kind: "glow",
    });
    this.bits.push({
      x, y: y - 4, vx: 0, vy: -30,
      life: 0.08, max: 0.08, r: 5,
      color: "#9ad4ff", kind: "glow",
    });
    for (let i = 0; i < 5; i++) {
      this.bits.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y - 2,
        vx: (Math.random() - 0.5) * 80,
        vy: -90 - Math.random() * 80,
        life: 0.14 + Math.random() * 0.1,
        max: 0.24,
        r: 1.4,
        color: i % 2 ? "#9ad4ff" : "#ffe08a",
        kind: "spark",
      });
    }
  }

    puff(x, y, color = "#c9d4e0") {
    this._cap(60);
    this.bits.push({
      x, y,
      vx: (Math.random() - 0.5) * 20,
      vy: -10,
      life: 0.4, max: 0.4,
      r: 4 + Math.random() * 4,
      color, kind: "puff",
    });
  }

  floatText(x, y, text, color = "#ffe08a", opts = {}) {
    const life = opts.life || 0.85;
    this.texts.push({
      x, y, text, color,
      life, max: life,
      pop: !!opts.pop && !this.reduced,
    });
  }

  playerHurt() {
    if (!this.reduced) this.shake = Math.max(this.shake, 6);
    this.hurt = this.reduced ? 0.18 : 0.35;
    this.softFlash(0.22);
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 18);
    this.flash = Math.max(0, this.flash - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const p = this.bits[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind !== "glow" && p.kind !== "ring") p.vy += 40 * dt;
      else p.r *= 1 + dt * 2.2;
      if (p.life <= 0) this.bits.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 28 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.bits) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + (1 - a) * 36, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "glow") {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (0.6 + a));
        g.addColorStop(0, "rgba(255,246,200,0.9)");
        g.addColorStop(0.45, "rgba(255,160,60,0.35)");
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.7 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "puff") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.5 - a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "streak") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-p.r * 2.2, -p.r * 0.4, p.r * 4.4, p.r * 0.8);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.max);
      const pop = t.pop ? (1 + Math.max(0, (t.life / t.max - 0.55) * 1.15)) : 1;
      const size = Math.round(13 * pop);
      ctx.font = `800 ${size}px Oswald, Barlow, sans-serif`;
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#00000088";
      ctx.fillStyle = t.color;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}
