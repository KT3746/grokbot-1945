/** Fundo em camadas, entidades e suco visual. */
import { W, H } from "./core.js";
import { bakeSprites, drawProp } from "./sprites.js";

const PAL = {
  tropic: { sea0: "#0b3a58", sea1: "#1a7aa0", sea2: "#3ec0c8", foam: "#c8f0f4", sky: "#7ec8e8" },
  overcast: { sea0: "#1a2a38", sea1: "#2a4458", sea2: "#4a6a78", foam: "#b0c4cc", sky: "#6a8494" },
  dusk: { sea0: "#1a1838", sea1: "#6a3060", sea2: "#d47848", foam: "#f0d0a0", sky: "#f0a060" },
  storm: { sea0: "#081018", sea1: "#163040", sea2: "#2a5060", foam: "#80c0d0", sky: "#2a4050" },
  fortress: { sea0: "#0a1018", sea1: "#1a2838", sea2: "#3a3040", foam: "#d0a070", sky: "#2a2030" },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sprites = bakeSprites();
    this.islands = this._scatter(11, 0);
    this.clouds = this._scatter(14, 1);
    this.birds = this._scatter(6, 2);
    this.debris = this._scatter(8, 3);
    this.time = 0;
  }

  _scatter(n, layer) {
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({
        x: (i * 97 + layer * 40) % W,
        y: ((i * 173 + 50) % (H + 160)) - 80,
        i: i % 3,
        s: 0.7 + (i % 5) * 0.08,
      });
    }
    return list;
  }

  draw(game) {
    const ctx = this.ctx;
    this.time += 0.016;
    const pal = PAL[game.palette()] || PAL.tropic;
    const shakeX = (Math.random() - 0.5) * game.fx.shake;
    const shakeY = (Math.random() - 0.5) * game.fx.shake;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = pal.sea0;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(shakeX, shakeY);
    const key = game.palette();
    this._sea(ctx, pal, game.bgScroll, key);
    this._islands(ctx, game.bgScroll * 0.55, key);
    this._clouds(ctx, game.bgScroll * 0.35, pal, key);
    this._stageFX(ctx, game.bgScroll, key);

    if (game.mode !== "title" && game.mode !== "howto") {
      try { this._pickups(ctx, game); } catch (_) {}
      try { this._player(ctx, game); } catch (_) {}
      try { this._enemies(ctx, game); } catch (_) {}
      try { this._bullets(ctx, game); } catch (_) {}
      try { game.fx.draw(ctx); } catch (_) {}
      try { this._combo(ctx, game); } catch (_) {}
      try { this._status(ctx, game); } catch (_) {}
      try { this._banner(ctx, game); } catch (_) {}
    }
    ctx.restore();

    if (game.fx.flash > 0) {
      const a = game.fx.flash;
      ctx.fillStyle = `rgba(255,240,200,${a * 0.38})`;
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.72);
      g.addColorStop(0, "rgba(255,200,120,0)");
      g.addColorStop(1, `rgba(255,160,40,${a * 0.22})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.fx.hurt > 0) {
      ctx.fillStyle = `rgba(200,30,20,${game.fx.hurt * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    {
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.player.invuln > 0 && game.mode === "playing") {
      const pulse = 0.35 + Math.sin(this.time * 14) * 0.2;
      ctx.strokeStyle = `rgba(180,230,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(game.player.x + shakeX, game.player.y + shakeY, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _sea(ctx, pal, scroll, key) {
    if (key === "tropic") {
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.38);
      sky.addColorStop(0, "#6ec8f0");
      sky.addColorStop(0.55, "#3aa0c8");
      sky.addColorStop(1, pal.sea0);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.36);
      const sea = ctx.createLinearGradient(0, H * 0.3, 0, H);
      sea.addColorStop(0, "#1a8ab0");
      sea.addColorStop(0.4, pal.sea1);
      sea.addColorStop(1, "#062838");
      ctx.fillStyle = sea;
      ctx.fillRect(0, H * 0.32, W, H);
      // sol / brilho
      ctx.fillStyle = "#fff6c0";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(W * 0.78, H * 0.12, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(W * 0.78, H * 0.12, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // faixa turquesa rasa
      ctx.fillStyle = "#5ee0d0";
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 4; i++) {
        const y = H * 0.55 + ((i * 70 + scroll * 0.3) % 120);
        ctx.fillRect(0, y, W, 18);
      }
      ctx.globalAlpha = 1;
    } else if (key === "overcast") {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#4a5a68");
      sky.addColorStop(0.25, "#2a3a48");
      sky.addColorStop(1, "#152028");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3a4a58";
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < 6; i++) {
        const y = ((i * 110 + scroll * 0.4) % (H + 110)) - 55;
        ctx.fillRect(0, y, W, 40);
      }
      ctx.globalAlpha = 1;
    } else if (key === "dusk") {
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      sky.addColorStop(0, "#1a1040");
      sky.addColorStop(0.35, "#c44860");
      sky.addColorStop(0.7, "#e87838");
      sky.addColorStop(1, "#3a1840");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.48);
      const sea = ctx.createLinearGradient(0, H * 0.42, 0, H);
      sea.addColorStop(0, "#6a2858");
      sea.addColorStop(0.5, "#2a1848");
      sea.addColorStop(1, "#0a0818");
      ctx.fillStyle = sea;
      ctx.fillRect(0, H * 0.45, W, H);
      // sol poente
      ctx.fillStyle = "#ffb048";
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.42, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#ff6030";
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.42, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#ff9040";
      ctx.fillRect(0, H * 0.4, W, 24);
      ctx.globalAlpha = 1;
    } else if (key === "storm") {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0a1018");
      sky.addColorStop(0.3, "#152838");
      sky.addColorStop(1, "#061018");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#1a3048";
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 5; i++) {
        const y = ((i * 140 + scroll * 0.85) % (H + 140)) - 70;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= W; x += 16) {
          ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 10);
        }
        ctx.lineTo(W, y + 50);
        ctx.lineTo(0, y + 50);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // fortress
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#120c20");
      g.addColorStop(0.35, "#1a1428");
      g.addColorStop(0.7, "#0c1018");
      g.addColorStop(1, "#08060e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // grade industrial de fundo
      ctx.strokeStyle = "#ffffff08";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    }

    // ondulação comum (parâmetros por fase)
    const foamA = key === "tropic" ? 0.18 : key === "storm" ? 0.1 : 0.12;
    const amp = key === "storm" ? 4 : key === "tropic" ? 2.6 : key === "fortress" ? 1.2 : 2;
    const waves = key === "storm" ? 16 : key === "fortress" ? 6 : 11;
    ctx.strokeStyle = pal.foam;
    ctx.lineWidth = key === "tropic" ? 1.5 : 1;
    for (let i = 0; i < waves; i++) {
      const y = ((i * 58 + scroll * (key === "storm" ? 1.15 : key === "fortress" ? 0.4 : 0.9)) % (H + 58)) - 28;
      ctx.globalAlpha = foamA;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += key === "storm" ? 12 : 18) {
        ctx.lineTo(x, y + Math.sin(x * 0.07 + i + scroll * 0.012) * amp);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _islands(ctx, scroll, key) {
    const pack =
      key === "tropic" ? this.sprites.islandPalm :
      key === "overcast" ? this.sprites.islandRock :
      key === "dusk" ? this.sprites.islandDusk :
      key === "storm" ? this.sprites.islandRock :
      key === "fortress" ? this.sprites.plat :
      this.sprites.island;
    const list = key === "storm" ? this.islands.slice(0, 5) : this.islands;
    const mul = key === "fortress" ? 0.75 : key === "storm" ? 0.9 : 0.55;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const y = (it.y + scroll * (mul / 0.55)) % (H + 170) - 85;
      const spr = pack[it.i % pack.length];
      const s = it.s * (key === "tropic" ? 1.05 : key === "fortress" ? 1.15 : 1);
      if (key === "storm") ctx.globalAlpha = 0.55;
      ctx.drawImage(spr, it.x - spr.width * s * 0.5, y, spr.width * s, spr.height * s);
      if (key === "storm") {
        ctx.fillStyle = "rgba(10,20,40,0.35)";
        ctx.fillRect(it.x - spr.width * s * 0.5, y, spr.width * s, spr.height * s);
      }
      ctx.globalAlpha = 1;
      // sombra na água
      if (key !== "fortress") {
        ctx.fillStyle = "#00000033";
        ctx.beginPath();
        ctx.ellipse(it.x, y + spr.height * s * 0.85, spr.width * s * 0.35, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // pássaros só no trópico / dusk
    if (key === "tropic" || key === "dusk") {
      ctx.strokeStyle = key === "dusk" ? "#2a1018" : "#1a3040";
      ctx.lineWidth = 1.5;
      for (const b of this.birds) {
        const y = (b.y + scroll * 0.25) % (H + 100) - 40;
        const x = (b.x + this.time * 12 + b.i * 20) % (W + 40) - 20;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.quadraticCurveTo(x, y - 4, x + 5, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  _clouds(ctx, scroll, pal, key) {
    if (key === "fortress") return;
    const pack =
      key === "storm" || key === "overcast" ? this.sprites.cloudDark :
      key === "dusk" ? this.sprites.cloudDusk :
      this.sprites.cloud;
    let a = key === "tropic" ? 0.24 : key === "storm" ? 0.5 : key === "overcast" ? 0.42 : 0.28;
    const spd = key === "storm" ? 1.5 : key === "overcast" ? 0.7 : 1;
    ctx.globalAlpha = a;
    for (const it of this.clouds) {
      const y = (it.y + scroll * spd) % (H + 200) - 100;
      const spr = pack[it.i % pack.length];
      const sc = key === "storm" ? 1.45 : key === "overcast" ? 1.25 : 1;
      ctx.drawImage(spr, it.x - 24, y, spr.width * sc, spr.height * sc);
    }
    ctx.globalAlpha = 1;
  }

  _stageFX(ctx, scroll, key) {
    if (key === "tropic") {
      // brilho na água + flare quente
      ctx.fillStyle = "#fff8c0";
      for (let i = 0; i < 18; i++) {
        const x = (i * 41 + scroll * 0.2) % W;
        const y = H * 0.5 + ((i * 73 + scroll * 0.5) % (H * 0.45));
        ctx.globalAlpha = 0.14 + (i % 3) * 0.05;
        ctx.fillRect(x, y, 2 + (i % 2), 2);
      }
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ffe08a";
      ctx.fillRect(0, H * 0.08, W, 40);
      ctx.globalAlpha = 1;
    } else if (key === "overcast") {
      ctx.fillStyle = "rgba(30,45,60,0.32)";
      ctx.fillRect(0, 0, W, H);
      // névoa em faixas
      ctx.fillStyle = "rgba(160,180,200,0.08)";
      for (let i = 0; i < 5; i++) {
        const y = ((i * 130 + scroll * 0.35) % (H + 80)) - 40;
        ctx.fillRect(0, y, W, 36);
      }
      // chuvisco leve
      ctx.strokeStyle = "rgba(180,200,220,0.16)";
      for (let i = 0; i < 30; i++) {
        const x = (i * 29 + scroll * 1.2) % W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 4, H);
        ctx.stroke();
      }
    } else if (key === "dusk") {
      ctx.fillStyle = "rgba(255,60,20,0.16)";
      ctx.fillRect(0, 0, W, H);
      // reflexo do sol no mar
      const rg = ctx.createRadialGradient(W / 2, H * 0.55, 4, W / 2, H * 0.55, 110);
      rg.addColorStop(0, "rgba(255,180,80,0.35)");
      rg.addColorStop(1, "rgba(255,100,40,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(W / 2 - 110, H * 0.42, 220, 180);
      // silhuetas de frota no horizonte
      ctx.fillStyle = "#1a0818";
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 90 + Math.sin(scroll * 0.01 + i) * 6;
        const y = H * 0.38;
        ctx.fillRect(x, y, 28, 6);
        ctx.fillRect(x + 8, y - 10, 4, 10);
      }
      ctx.globalAlpha = 1;
    } else if (key === "storm") {
      if (Math.random() < 0.04) {
        ctx.fillStyle = "rgba(210,230,255,0.35)";
        ctx.fillRect(0, 0, W, H);
      }
      // chuva forte
      ctx.strokeStyle = "rgba(170,200,230,0.28)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 42; i++) {
        const x = (i * 19 + scroll * 4.0) % (W + 30) - 15;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 14, H);
        ctx.stroke();
      }
      // nuvem baixa + vinheta lateral
      ctx.fillStyle = "#00000055";
      ctx.fillRect(0, 0, W, 60);
      const vg = ctx.createLinearGradient(0, 0, W, 0);
      vg.addColorStop(0, "rgba(0,0,0,0.35)");
      vg.addColorStop(0.5, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    } else if (key === "fortress") {
      // holofotes
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = "#e0b84a";
      const sway = Math.sin(scroll * 0.02) * 45;
      ctx.beginPath();
      ctx.moveTo(50, H);
      ctx.lineTo(90 + sway, 0);
      ctx.lineTo(150 + sway, 0);
      ctx.lineTo(100, H);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(260, H);
      ctx.lineTo(220 - sway * 0.7, 0);
      ctx.lineTo(290 - sway * 0.7, 0);
      ctx.lineTo(310, H);
      ctx.fill();
      ctx.restore();
      // faíscas / brasas
      for (let i = 0; i < 10; i++) {
        const x = (i * 53 + scroll * 0.35) % W;
        const y = (i * 89 + scroll * 0.9) % H;
        ctx.globalAlpha = 0.25 + (i % 3) * 0.1;
        ctx.fillStyle = i % 2 ? "#ff9a4a" : "#e0b84a";
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
      // névoa inferior
      const fog = ctx.createLinearGradient(0, H * 0.7, 0, H);
      fog.addColorStop(0, "rgba(20,10,30,0)");
      fog.addColorStop(1, "rgba(20,10,30,0.45)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, H * 0.7, W, H * 0.3);
      // destroços flutuando
      ctx.fillStyle = "#3a3048";
      for (const d of this.debris) {
        const y = (d.y + scroll * 0.5) % (H + 80) - 40;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(d.x, y, 10 + d.i * 3, 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  _player(ctx, game) {
    const p = game.player;
    if (!p || !p.alive) return;
    const x = p.x;
    const y = p.y;
    if (!(x >= -40 && x <= W + 40 && y >= -40 && y <= H + 40)) return;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const blink = p.invuln > 0 && ((p.invuln * 12) | 0) % 2 === 0;
    if (blink && p.invuln > 0.2) ctx.globalAlpha = 0.55;

    // afterburner (paths only — sem drawImage)
    const flame = 7 + Math.sin(this.time * 28) * 3;
    ctx.fillStyle = "rgba(180,230,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 14);
    ctx.lineTo(x + 4, y + 14);
    ctx.lineTo(x, y + 16 + flame);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,220,120,0.75)";
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 14);
    ctx.lineTo(x + 2, y + 14);
    ctx.lineTo(x, y + 14 + flame * 0.7);
    ctx.closePath();
    ctx.fill();

    // fuselagem
    ctx.fillStyle = "#2a3418";
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 7, y - 4);
    ctx.lineTo(x + 6, y + 12);
    ctx.lineTo(x, y + 16);
    ctx.lineTo(x - 6, y + 12);
    ctx.lineTo(x - 7, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a9a48";
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x + 5, y - 4);
    ctx.lineTo(x + 4, y + 10);
    ctx.lineTo(x, y + 13);
    ctx.lineTo(x - 4, y + 10);
    ctx.lineTo(x - 5, y - 4);
    ctx.closePath();
    ctx.fill();

    // asas
    ctx.fillStyle = "#4a5c28";
    ctx.fillRect(x - 16, y - 2, 32, 8);
    ctx.fillStyle = "#d4c24a";
    ctx.fillRect(x - 16, y - 2, 6, 8);
    ctx.fillRect(x + 10, y - 2, 6, 8);
    ctx.fillStyle = "#1a2010";
    ctx.fillRect(x - 10, y + 1, 20, 1.5);

    // marca
    ctx.fillStyle = "#b33a2a";
    ctx.fillRect(x - 2, y + 3, 4, 5);
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(x - 1, y + 4, 2, 3);

    // cockpit
    ctx.fillStyle = "#7ec8e8";
    ctx.beginPath();
    ctx.arc(x, y - 8, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8f0ff";
    ctx.beginPath();
    ctx.arc(x - 0.5, y - 9, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // cauda
    ctx.fillStyle = "#3a4a20";
    ctx.fillRect(x - 1.5, y + 12, 3, 6);
    ctx.fillStyle = "#d4c24a";
    ctx.fillRect(x - 7, y + 12, 14, 3);

    // outline
    ctx.strokeStyle = "#0a1008";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - 16, y - 2, 32, 8);

    // hitbox core (sempre visível)
    const core = p.focus ? 5.2 : 3.4;
    ctx.fillStyle = p.focus ? "#fff8e0" : "#ff3d6e";
    ctx.strokeStyle = "#140810";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, core, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (p.focus) {
      ctx.strokeStyle = "rgba(255,244,180,0.9)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(120,200,255,0.85)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(x, y, 18 + Math.sin(this.time * 6) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // hélice simples
    try {
      drawProp(ctx, x, y - 16, this.time, "rgba(240,240,220,0.7)");
    } catch (_) {}

    ctx.restore();
  }

  _enemyWash(key) {
    // vinheta leve por fase (sem ctx.filter — quebra sprites no iOS/Safari)
    if (key === "tropic") return "rgba(80,200,160,0.14)";
    if (key === "overcast") return "rgba(40,60,80,0.22)";
    if (key === "dusk") return "rgba(255,100,40,0.18)";
    if (key === "storm") return "rgba(60,120,200,0.2)";
    if (key === "fortress") return "rgba(180,140,60,0.16)";
    return null;
  }

  _enemies(ctx, game) {
    const wash = this._enemyWash(game.palette());
    ctx.globalAlpha = 1;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const spr = this.sprites[e.kind] || this.sprites.vespa;
      if (e.telegraph > 0) {
        const pulse = 0.45 + Math.sin(this.time * 18) * 0.2;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = "#ff9a4a";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        const ring = e.r + 12 + (0.72 - e.telegraph) * 28;
        ctx.beginPath();
        ctx.arc(e.x, e.y, ring, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#ff6a4a";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 6, 0, Math.PI * 2);
        ctx.fill();
        if (e.attack === "aimed" || e.attack === "sweep" || e.attack === "spread") {
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = "#ffe08a";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y + e.r);
          ctx.lineTo(game.player.x, game.player.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      const sc = 1.35;
      let dw = 28, dh = 28;
      try {
        dw = spr.width * sc;
        dh = spr.height * sc;
        ctx.drawImage(spr, e.x - dw / 2, e.y - dh / 2, dw, dh);
      } catch (_) {
        // fallback vetorial (Chrome Android às vezes falha no drawImage de canvas)
        dw = e.r * 2.2;
        dh = e.r * 2.2;
        ctx.fillStyle = e.kind === "bufalo" ? "#6a5030" : e.kind === "gaviao" ? "#8a3030" : "#c43a28";
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + dh * 0.45);
        ctx.lineTo(e.x + dw * 0.45, e.y - dh * 0.1);
        ctx.lineTo(e.x, e.y - dh * 0.45);
        ctx.lineTo(e.x - dw * 0.45, e.y - dh * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#c9a227";
        ctx.fillRect(e.x - dw * 0.4, e.y - 2, dw * 0.8, 4);
      }
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(0.85, e.flash * 4);
        ctx.fillStyle = "#fff8e0";
        ctx.fillRect(e.x - dw / 2, e.y - dh / 2, dw, dh);
        ctx.globalAlpha = 1;
      } else if (wash) {
        ctx.fillStyle = wash;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, dw * 0.42, dh * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.kind === "vespa" || e.kind === "gaviao" || e.kind === "as" || e.kind === "artilheiro") {
        drawProp(ctx, e.x, e.y + spr.height / 2 - 4, this.time * 1.2 + e.phase, "rgba(200,200,180,0.35)");
      }
    }
    ctx.globalAlpha = 1;
  }

  _bullets(ctx, game) {
    for (const b of game.pBullets) {
      // rastro
      ctx.strokeStyle = "rgba(255,200,80,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 10);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 9);
      glow.addColorStop(0, "rgba(255,250,200,0.95)");
      glow.addColorStop(0.5, "rgba(255,200,80,0.4)");
      glow.addColorStop(1, "rgba(255,160,40,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 2.6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.fillRect(b.x - 1.2, b.y - 1, 2.4, 9);
    }
    const key = game.palette();
    const bc =
      key === "tropic" ? ["#e8fff0", "#2ad0a0", "#064028"] :
      key === "overcast" ? ["#e0e8f0", "#7890a8", "#203040"] :
      key === "dusk" ? ["#ffe0a0", "#ff6a30", "#601010"] :
      key === "storm" ? ["#d0f0ff", "#50a0ff", "#102848"] :
      ["#ffe08a", "#c07020", "#301808"];
    for (const b of game.eBullets) {
      ctx.fillStyle = "#1a0610";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2);
      ctx.fill();
      const eg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r + 2);
      eg.addColorStop(0, bc[0]);
      eg.addColorStop(0.55, bc[1]);
      eg.addColorStop(1, bc[2]);
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bc[0];
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(1.8, b.r * 0.38), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _pickups(ctx, game) {
    for (const u of game.pickups) {
      const bob = Math.sin(u.t * 6) * 2.5;
      const set = this.sprites.pickup || {};
      const spr = set[u.kind] || this.sprites.bomb;
      if (spr) {
        const pulse = 10 + Math.sin(u.t * 8) * 2;
        const aura = ctx.createRadialGradient(u.x, u.y + bob, 0, u.x, u.y + bob, pulse);
        aura.addColorStop(0, "rgba(255,220,120,0.45)");
        aura.addColorStop(0.55, "rgba(255,180,60,0.15)");
        aura.addColorStop(1, "rgba(255,160,40,0)");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(u.x, u.y + bob, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(u.x, u.y + bob + 12, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(spr, u.x - spr.width / 2, u.y + bob - spr.height / 2);
      }
    }
  }

  _banner(ctx, game) {
    if (game.bannerT <= 0) return;
    const fade = game.bannerT > 0.45 ? 1 : Math.max(0, game.bannerT / 0.45);
    const boss = game.bannerKind === "boss";
    const x = 10;
    const y = 22;
    const w = W - 20;
    const h = boss ? 66 : 58;
    ctx.save();
    ctx.globalAlpha = fade;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    if (boss) {
      g.addColorStop(0, "#2a1010ee");
      g.addColorStop(1, "#140808f2");
    } else {
      g.addColorStop(0, "#0c2230ee");
      g.addColorStop(1, "#061018f2");
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = boss ? "#ff6a4a" : "#e0b84a";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = boss ? "#ff6a4a88" : "#e0b84a66";
    ctx.shadowBlur = 14;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = boss ? "#ffb0a0" : "#ffe7b3";
    ctx.font = "800 19px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(game.banner, W / 2, y + (boss ? 28 : 26));
    ctx.fillStyle = "#f4f7fa";
    ctx.font = "700 12px Barlow, sans-serif";
    ctx.fillText(game.bannerSub || "", W / 2, y + (boss ? 50 : 46));
    ctx.restore();
  }

  _combo(ctx, game) {
    if (game.combo < 2) return;
    const label = `COMBO x${game.combo}`;
    ctx.save();
    ctx.textAlign = "right";
    ctx.font = "800 15px Oswald, sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#00000099";
    ctx.fillStyle = "#ffe08a";
    ctx.shadowColor = "#e0b84a88";
    ctx.shadowBlur = 12;
    ctx.strokeText(label, W - 12, 36);
    ctx.fillText(label, W - 12, 36);
    ctx.restore();
  }

  _status(ctx, game) {
    if (game.mode === "title" || game.mode === "howto") return;
    const bits = [];
    if (game.player.spreadT > 0) bits.push(game.player.spread >= 5 ? "TIRO++" : "TIRO+");
    if (game.player.rapidT > 0) bits.push("RAJADA");
    if (game.player.shield > 0) bits.push(`ESCUDO ${game.player.shield}`);
    if (game.player.focus) bits.push("FOCO");
    if (!bits.length) return;
    ctx.save();
    ctx.fillStyle = "#ffe08a";
    ctx.font = "700 11px Oswald, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(bits.join(" · "), W - 10, H - 14);
    ctx.restore();
  }
}
