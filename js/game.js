/**
 * Simulação do 1945: jogador, ondas, chefes, tiros, bônus e colisões.
 */
import {
  W,
  H,
  PLAYER_HIT_R,
  PLAYER_FIRE,
  PLAYER_FIRE_RAPID,
  INVULN_TIME,
  COMBO_WINDOW,
  START_LIVES,
  START_BOMBS,
  MAX_SPREAD,
  MAX_BOMBS,
  clamp,
  circleHit,
  angleTo,
  scoreKill,
  extraLifeEarned,
  PICKUPS,
  WEAPON_DROPS,
  STAGE_META,
  BOSS_NAMES,
  BOSS_META,
  fireIntervalScale,
  vespaFires,
  softenShot,
  moveSpeed,
  ENEMY_BULLET_R,
  BOMB_SCORE,
  BOMB_DAMAGE,
  BOMB_COOLDOWN,
  BOMB_INVULN,
  EMPTY_FILL_SEC,
} from "./core.js";
import { STAGES } from "./stages.js";
import { FX } from "./particles.js";
import { STORAGE_HIGH } from "./version.js";

const KIND = {
  vespa: { hp: 2, r: 14, speed: 72, score: 120, fire: 2.6, shot: "down" },
  gaviao: { hp: 3, r: 15, speed: 124, score: 220, fire: 1.85, shot: "aim" },
  bufalo: { hp: 10, r: 22, speed: 48, score: 400, fire: 1.55, shot: "spread" },
  artilheiro: { hp: 4, r: 15, speed: 58, score: 260, fire: 1.7, shot: "aim" },
  ninho: { hp: 8, r: 19, speed: 0, score: 350, fire: 1.7, shot: "up" },
  as: { hp: 6, r: 16, speed: 86, score: 600, fire: 1.5, shot: "aim", drop: true },
};

const BOSS = {
  albatroz: { hp: 100, r: 38, score: 5500, attacks: ["spread", "aimed", "rain", "fan"] },
  sentinela: { hp: 130, r: 40, score: 7500, attacks: ["aimed", "ring", "sweep", "burst"] },
  serpente: { hp: 150, r: 36, score: 9000, attacks: ["spread", "ring", "rain", "spiral"] },
  tempestade: { hp: 175, r: 42, score: 11000, attacks: ["ring", "aimed", "sweep", "spiral", "fan"] },
  nadir: { hp: 240, r: 48, score: 16000, attacks: ["spread", "aimed", "ring", "rain", "sweep", "spiral", "burst", "fan"] },
};

function pool() {
  return [];
}

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.fx = new FX();
    this.mode = "title";
    this.high = Number(localStorage.getItem(STORAGE_HIGH) || 0);
    this.resetRun();
  }

  resetRun() {
    this.score = 0;
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.stageIndex = 0;
    this.loop = 0;
    this.combo = 0;
    this.comboT = 0;
    this.waveT = 0;
    this.waveI = 0;
    this.pendingBoss = false;
    this.boss = null;
    this.banner = "";
    this.bannerSub = "";
    this.bannerT = 0;
    this.bannerKind = "stage";
    this.cleared = false;
    this.introT = 0;
    this.runT = 0;
    this.emptyT = 0;
    this.bombCd = 0;
    this.hitStop = 0;
    this.player = this._player();
    this.enemies = pool();
    this.pBullets = pool();
    this.eBullets = pool();
    this.pickups = pool();
    this.bgScroll = 0;
    this.fx.reset();
  }

  _player() {
    return {
      x: W / 2,
      y: H - 78,
      fireCd: 0,
      spread: 1,
      rapidT: 0,
      spreadT: 0,
      shield: 0,
      invuln: 0,
      alive: true,
      focus: false,
    };
  }

  start(fromStage = 0) {
    this.resetRun();
    this.stageIndex = clamp(fromStage, 0, STAGES.length - 1);
    this.mode = "playing";
    this.introT = 2.2;
    this._announceStage();
    this.spawnPlayer();
  }

  spawnPlayer() {
    this.player.x = W / 2;
    const touchSpawn =
      typeof matchMedia !== "undefined" &&
      matchMedia("(max-width: 720px), (pointer: coarse)").matches;
    this.player.y = touchSpawn ? Math.floor(H * 0.68) : H - 78;
    this.player.invuln = INVULN_TIME;
    this.player.alive = true;
    this.player.fireCd = 0.2;
  }

  _announceStage() {
    const meta = STAGE_META[this.stageIndex];
    const loop = this.loop ? ` · ciclo ${this.loop + 1}` : "";
    this.banner = `${meta.name}${loop}`;
    this.bannerSub = meta.subtitle;
    this.bannerT = 2.6;
    this.bannerKind = "stage";
    this.waveT = 0;
    this.waveI = 0;
    this.pendingBoss = false;
    this.boss = null;
    this.cleared = false;
    try {
      this.audio.setStage?.(this.stageIndex, meta.palette);
      this.audio.stage();
    } catch (_) {}
  }

  pause() {
    if (this.mode === "playing") this.mode = "paused";
  }

  resume() {
    if (this.mode === "paused") this.mode = "playing";
  }

  update(dt, input) {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.15;
    }
    this.bgScroll += dt * this._scrollSpeed();
    this.fx.update(dt);
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.mode !== "playing") {
      input.clearPlay?.();
      return;
    }
    this.runT += dt;

    if (this.introT > 0) this.introT -= dt;

    const p = this.player;
    this.bombCd = Math.max(0, this.bombCd - dt);
    this.bombShieldT = Math.max(0, (this.bombShieldT || 0) - dt);
    if (this.bombShieldT > 0) this.eBullets.length = 0;
    if (p.alive) {
      p.focus = !!input.focusHeld;
      const spd = moveSpeed(p.focus);
      // no celular os botões Fogo/Bomba ficam na base — zona segura acima deles
      const touchUI =
        !!input.touchEnabled ||
        (typeof matchMedia !== "undefined" &&
          matchMedia("(max-width: 720px), (pointer: coarse)").matches);
      const yMax = touchUI ? H - 150 : H - 28;
      if (input.aimActive) {
        // finger-follow absoluto (suave) + delta relativo — toque e arraste funcionam
        if (input.aimAbsOn && input.aimAbsX != null) {
          const k = Math.min(1, 14 * dt);
          p.x = clamp(p.x + (input.aimAbsX - p.x) * k, 16, W - 16);
          p.y = clamp(p.y + (input.aimAbsY - p.y) * k, 40, yMax);
        }
        p.x = clamp(p.x + (input.aimDX || 0), 16, W - 16);
        p.y = clamp(p.y + (input.aimDY || 0), 40, yMax);
        input.aimDX = 0;
        input.aimDY = 0;
        input.aimFresh = false;
      } else {
        p.x = clamp(p.x + input.moveX * spd * dt, 16, W - 16);
        p.y = clamp(p.y + input.moveY * spd * dt, 40, yMax);
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.rapidT = Math.max(0, p.rapidT - dt);
      p.spreadT = Math.max(0, p.spreadT - dt);
      if (p.spreadT <= 0) p.spread = 1;
      p.fireCd -= dt;
      if (input.fireHeld && p.fireCd <= 0) {
        this._playerShoot();
        p.fireCd = p.rapidT > 0 ? PLAYER_FIRE_RAPID : PLAYER_FIRE;
        this.audio.shoot();
      }
      if (input.consumeBomb() && this.bombCd <= 0) this._bomb();
      if (Math.random() < dt * 4) this.fx.trail(p.x + (Math.random() - 0.5) * 8, p.y + 16);
    }

    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;

    this._director(dt);
    this._updateEnemies(dt);
    this._updateBullets(dt);
    this._updatePickups(dt);
    this._collide();
    this._checkStage();
  }

  _stageSpeedMul() {
    // ritmo de movimento inimigo por identidade da fase
    const pal = STAGE_META[this.stageIndex].palette;
    let m = 1;
    if (this.loop === 0 && this.stageIndex === 0) m *= 0.84;
    if (pal === "tropic") m *= 0.92;
    if (pal === "overcast") m *= 0.95;
    if (pal === "dusk") m *= 1.0;
    if (pal === "storm") m *= 1.22;
    if (pal === "fortress") m *= 0.88;
    return m;
  }

    _scrollSpeed() {
    const pal = STAGE_META[this.stageIndex].palette;
    // cada fase com “velocidade de mundo” bem distinta
    if (pal === "tropic") return 48 + this.loop * 6;
    if (pal === "overcast") return 62 + this.loop * 7;
    if (pal === "dusk") return 74 + this.loop * 8;
    if (pal === "storm") return 108 + this.loop * 10;
    if (pal === "fortress") return 56 + this.loop * 5;
    return 60 + this.stageIndex * 6 + this.loop * 8;
  }

  _playerShoot() {
    const p = this.player;
    const n = p.spreadT > 0 ? Math.max(p.spread, 3) : p.spread;
    const shots = n >= 5 ? 5 : n >= 3 ? 3 : 1;
    const speed = 500;
    this.fx.muzzle(p.x, p.y - 18);
    p.y += 1.6;
    if (shots === 1) this._pbullet(p.x, p.y - 18, 0, -speed);
    else if (shots === 3) {
      this._pbullet(p.x, p.y - 18, 0, -speed);
      this._pbullet(p.x - 8, p.y - 12, -90, -speed + 10);
      this._pbullet(p.x + 8, p.y - 12, 90, -speed + 10);
    } else {
      for (let i = -2; i <= 2; i++) {
        this._pbullet(p.x + i * 6, p.y - 16, i * 70, -speed + Math.abs(i) * 12);
      }
    }
  }

  _pbullet(x, y, vx, vy) {
    this.pBullets.push({ x, y, vx, vy, r: 3.2, dmg: 1 });
  }

  _ebullet(x, y, vx, vy, r = ENEMY_BULLET_R) {
    this.eBullets.push({ x, y, vx, vy, r });
  }

  _bomb() {
    if (this.bombs <= 0 || !this.player.alive || this.bombCd > 0) return;
    this.bombs--;
    this.bombCd = BOMB_COOLDOWN;
    this.audio.bigBoom();
    this.fx.boom(this.player.x, this.player.y, 36, "#9ad4ff");
    this.fx.boom(this.player.x, this.player.y - 20, 14, "#ffe08a");
    this.fx.shake = 8;
    this.fx.flash = Math.max(this.fx.flash, 0.28);
    this.fx.floatText(this.player.x, this.player.y - 40, "BOMBA!", "#9ad4ff");
    // limpa balas + i-frames pra não perder vida no mesmo instante
    this.eBullets.length = 0;
    this.bombShieldT = 0.55;
    this.player.invuln = Math.max(this.player.invuln, BOMB_INVULN);
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hp -= BOMB_DAMAGE;
      e.flash = 0.18;
      if (e.hp <= 0) this._kill(e, true);
    }
  }

  _director(dt) {
    // Tempo lógico (segundos de jogo), igual no PC e no celular — nunca usa
    // largura/altura CSS do canvas. Letterbox não atrasa nem cancela ondas.
    if (this.cleared || this.pendingBoss) return;
    this.waveT += dt;
    const script = STAGES[this.stageIndex].waves;
    while (this.waveI < script.length && script[this.waveI].at <= this.waveT) {
      const ev = script[this.waveI++];
      this._spawnEvent(ev);
      this.emptyT = 0;
    }
    const busy =
      this.enemies.some((e) => !e.dead) || this.pickups.length > 0 || this.bannerT > 0.4;
    if (busy) {
      this.emptyT = 0;
      return;
    }
    this.emptyT += dt;
    if (this.emptyT >= EMPTY_FILL_SEC && this.waveI < script.length) {
      this.emptyT = 0;
      const si = this.stageIndex;
      if (si === 0) {
        this._enemy("vespa", 60, -22, "sine", 1, 1);
        this._enemy("vespa", 300, -22, "sine", 1, 2);
      } else if (si === 1) {
        this._enemy("artilheiro", 90, -22, "aim", 1, 0);
        this._enemy("artilheiro", 270, -22, "aim", 1, 1);
        this._enemy("ninho", 180, 8, "ground", 1, 0, { gy: 100 });
      } else if (si === 2) {
        this._enemy("bufalo", 120, -28, "down", 1, 0);
        this._enemy("vespa", 240, -22, "down", 1, 1);
      } else if (si === 3) {
        this._enemy("gaviao", 40, -30, "dive", 1 + this.loop * 0.1, 0);
        this._enemy("gaviao", 320, -30, "dive", 1 + this.loop * 0.1, 1);
        this._enemy("gaviao", W / 2, -40, "dive", 1 + this.loop * 0.1, 2);
      } else {
        this._enemy("artilheiro", 70, -22, "aim", 1, 0);
        this._enemy("artilheiro", 290, -22, "aim", 1, 1);
        this._enemy("vespa", 180, -22, "down", 1, 2);
      }
    }
  }

  _spawnEvent(ev) {
    const diff = 1 + this.stageIndex * 0.08 + this.loop * 0.22;
    if (ev.spawn === "line") {
      for (let i = 0; i < ev.n; i++) {
        this._enemy(ev.kind, ev.x0 + i * ev.gap, -18 - i * 10, ev.pattern, diff, i);
      }
    } else if (ev.spawn === "v") {
      const mid = (ev.n - 1) / 2;
      for (let i = 0; i < ev.n; i++) {
        const d = Math.abs(i - mid);
        this._enemy(ev.kind, W / 2 + (i - mid) * 36, -20 - d * 16, "down", diff, i);
      }
    } else if (ev.spawn === "swoop") {
      for (let i = 0; i < ev.n; i++) {
        const left = ev.side === "left";
        this._enemy(ev.kind, left ? -20 : W + 20, 40 + i * 22, "swoop", diff, i, {
          sx: left ? -20 : W + 20,
          sy: 50 + i * 18,
          ex: left ? W + 30 : -30,
          ey: 220 + i * 20,
        });
      }
    } else if (ev.spawn === "wall") {
      const n = ev.n | 0;
      const gap = (W - 80) / Math.max(1, n - 1);
      for (let i = 0; i < n; i++) {
        this._enemy(ev.kind, 40 + i * gap, ev.y ?? -20, ev.pattern || "down", diff, i);
      }
    } else if (ev.spawn === "diag") {
      const fromLeft = ev.from !== "right";
      for (let i = 0; i < ev.n; i++) {
        const x = fromLeft ? 40 + i * 48 : W - 40 - i * 48;
        this._enemy(ev.kind, x, -18 - i * 22, ev.pattern || "down", diff, i);
      }
    } else if (ev.spawn === "pinch") {
      const n = ev.n | 0;
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        this._enemy(ev.kind, left ? -20 : W + 20, 30 + (i >> 1) * 28, "swoop", diff, i, {
          sx: left ? -20 : W + 20,
          sy: 40 + (i >> 1) * 24,
          ex: left ? W + 30 : -30,
          ey: 200 + (i >> 1) * 30,
        });
      }
    } else if (ev.spawn === "rain") {
      for (let i = 0; i < ev.n; i++) {
        const x = 28 + ((i * 97) % (W - 56));
        this._enemy(ev.kind, x, -20 - i * 14, ev.pattern || "down", diff, i);
      }
    } else if (ev.spawn === "single") {
      this._enemy(ev.kind, ev.x, -24, ev.pattern || "down", diff, 0);
    } else if (ev.spawn === "ground") {
      this._enemy("ninho", ev.x, 8, "ground", diff, 0, { gy: 86 + (ev.x % 40) });
    } else if (ev.spawn === "boss") {
      this.pendingBoss = true;
    }
  }

  _enemy(kind, x, y, pattern, diff, phase, extra = {}) {
    const k = KIND[kind];
    const e = {
      kind,
      x,
      y,
      homeX: x,
      vx: 0,
      vy: 0,
      r: k.r,
      hp: Math.round(k.hp * diff),
      maxHp: Math.round(k.hp * diff),
      speed: k.speed * (1 + this.loop * 0.08) * this._stageSpeedMul(),
      score: k.score,
      fireCd: 0.8 + phase * 0.18,
      fireEvery:
        k.fire *
        fireIntervalScale(this.stageIndex, this.loop, this.runT) /
        (1 + this.loop * 0.1 + this.stageIndex * 0.04),
      shot: softenShot(kind, k.shot, this.stageIndex, this.loop),
      muteFire: kind === "vespa" && !vespaFires(this.stageIndex, this.loop, phase),
      pattern,
      t: 0,
      phase,
      flash: 0,
      dead: false,
      drop: k.drop ? PICKUPS[phase % PICKUPS.length] : null,
      boss: false,
      telegraph: 0,
      attack: null,
      atkT: 1.2,
      gy: extra.gy || 90,
      sx: extra.sx,
      sy: extra.sy,
      ex: extra.ex,
      ey: extra.ey,
    };
    this.enemies.push(e);
    return e;
  }

  _spawnBoss() {
    const id = STAGES[this.stageIndex].boss;
    const b = BOSS[id];
    const diff = 1 + this.loop * 0.35;
    const e = {
      kind: id,
      x: W / 2,
      y: -40,
      homeX: W / 2,
      r: b.r,
      hp: Math.round(b.hp * diff),
      maxHp: Math.round(b.hp * diff),
      speed: 40,
      score: b.score,
      fireCd: 0,
      fireEvery: 1.1,
      shot: "boss",
      pattern: "boss",
      t: 0,
      phase: 0,
      flash: 0,
      dead: false,
      drop: "medal",
      boss: true,
      bossId: id,
      telegraph: 0,
      attack: null,
      atkT: this.loop === 0 && this.stageIndex === 0 ? 2.4 : 1.4,
      attacks: b.attacks,
      entered: false,
      raged: false,
      frenzied: false,
    };
    this.enemies.push(e);
    this.boss = e;
    this.audio.warning();
    this.audio.setIntense(1);
    this.banner = BOSS_NAMES[id];
    this.bannerSub = (BOSS_META[id] && BOSS_META[id].subtitle) || "Chefe à frente.";
    this.bannerT = 2.8;
    this.bannerKind = "boss";
    this.fx.shake = Math.max(this.fx.shake, 6);
    this.fx.flash = 0.22;
    this.fx.floatText(W / 2, 120, "ALERTA", "#ff6a4a");
  }

  _updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        continue;
      }
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.pattern === "down") {
        e.y += e.speed * dt;
        e.x = e.homeX + Math.sin(e.t * 2.2 + e.phase) * 18;
      } else if (e.pattern === "sine") {
        const amp = this.stageIndex === 0 && this.loop === 0 ? 26 : 54;
        e.y += e.speed * dt;
        e.x = e.homeX + Math.sin(e.t * 3 + e.phase) * amp;
      } else if (e.pattern === "aim") {
        e.y += e.speed * 0.7 * dt;
        e.x = e.homeX + Math.sin(e.t * 1.4) * 40;
      } else if (e.pattern === "hover") {
        if (e.y < 120) e.y += e.speed * dt;
        else e.x = e.homeX + Math.sin(e.t * 1.3) * 80;
      } else if (e.pattern === "dive") {
        if (e.y < 160) e.y += e.speed * dt;
        else {
          const a = angleTo(e.x, e.y, p.x, p.y);
          e.x += Math.cos(a) * e.speed * 1.35 * dt;
          e.y += Math.sin(a) * e.speed * 1.35 * dt;
        }
      } else if (e.pattern === "swoop") {
        const u = Math.min(1, e.t / 2.4);
        e.x = e.sx + (e.ex - e.sx) * u;
        e.y = e.sy + (e.ey - e.sy) * u + Math.sin(u * Math.PI) * 90;
        if (u >= 1) e.dead = true;
      } else if (e.pattern === "ground") {
        if (e.y < e.gy) e.y += 50 * dt;
        else e.y = e.gy;
      } else if (e.pattern === "boss") {
        this._bossAI(e, dt);
      }

      if (!e.boss && (e.y > H + 50 || e.x < -70 || e.x > W + 70)) {
        e.dead = true;
        continue;
      }

      if (e.y > 8 && e.y < H - 30 && !e.dead) {
        if (e.boss) continue;
        if (e.muteFire) continue;
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          this._enemyFire(e);
          e.fireCd = e.fireEvery;
        }
      }
    }
  }

  _bossAI(e, dt) {
    if (e.y < 96) {
      e.y += 55 * dt;
      return;
    }
    e.entered = true;
    const hpRatio = e.hp / e.maxHp;
    const rage = hpRatio < 0.5;
    const frenzy = hpRatio < 0.25;
    if (rage && !e.raged) {
      e.raged = true;
      e.phase = 2;
      this.banner = "FASE 2";
      this.bannerSub = "O chefe enlouquece.";
      this.bannerT = 1.6;
      this.bannerKind = "boss";
      this.fx.flash = 0.18;
      this.audio.warning();
    }
    if (frenzy && !e.frenzied) {
      e.frenzied = true;
      e.phase = 3;
      this.banner = "FASE FINAL";
      this.bannerSub = "Sobreviva ao fogo.";
      this.bannerT = 1.6;
      this.bannerKind = "boss";
      this.fx.shake = Math.max(this.fx.shake, 5);
      this.audio.warning();
    }
    const sway = (e.kind === "serpente" ? 110 : 88) * (frenzy ? 1.25 : rage ? 1.1 : 1);
    const swaySpd = (frenzy ? 1.05 : rage ? 0.85 : 0.65);
    e.x = e.homeX + Math.sin(e.t * swaySpd) * sway;
    if (e.kind === "serpente") e.y = 96 + Math.sin(e.t * 1.1) * 18;

    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) this._bossAttack(e);
      return;
    }
    e.atkT -= dt;
    if (e.atkT <= 0) {
      let poolAtk = e.attacks;
      if (frenzy) poolAtk = e.attacks;
      else if (rage) poolAtk = e.attacks.filter((a) => a !== "rain").concat(["fan", "burst"]);
      e.attack = poolAtk[(Math.random() * poolAtk.length) | 0];
      e.telegraph = frenzy ? 0.48 : rage ? 0.58 : 0.72;
      e.atkT = frenzy
        ? 0.62
        : rage
          ? 0.78
          : this.loop === 0 && this.stageIndex === 0
            ? 1.55
            : 1.15;
      this.audio.warning();
    }
  }

  _bossAttack(e) {
    const p = this.player;
    const rage = e.hp / e.maxHp < 0.5;
    let spd = 120 + this.loop * 18 + this.stageIndex * 6 + (rage ? 16 : 0);
    if (this.loop === 0 && this.stageIndex === 0) spd *= 0.82;
    if (e.attack === "spread") {
      for (let i = -5; i <= 5; i++) {
        this._ebullet(e.x, e.y + 16, i * 34, spd);
      }
    } else if (e.attack === "aimed") {
      const a = angleTo(e.x, e.y, p.x, p.y);
      for (let i = -2; i <= 2; i++) {
        const ang = a + i * 0.14;
        this._ebullet(e.x, e.y + 10, Math.cos(ang) * (spd + 36), Math.sin(ang) * (spd + 36));
      }
    } else if (e.attack === "ring") {
      const n = rage ? 16 : 14;
      for (let i = 0; i < n; i++) {
        if (!rage && (i === 3 || i === 10)) continue;
        const a = (i / n) * Math.PI * 2 + e.t;
        this._ebullet(e.x, e.y, Math.cos(a) * spd, Math.sin(a) * spd);
      }
    } else if (e.attack === "rain") {
      for (let i = 0; i < 9; i++) {
        this._ebullet(24 + i * 38, 8, (i - 4) * 6, spd * 0.9);
      }
    } else if (e.attack === "sweep") {
      for (let i = 0; i < 8; i++) {
        const a = 0.3 + i * 0.17;
        this._ebullet(e.x, e.y + 12, Math.cos(a) * spd, Math.sin(a) * spd);
      }
    } else if (e.attack === "spiral") {
      for (let i = 0; i < 10; i++) {
        const a = e.t * 2.2 + i * 0.55;
        this._ebullet(e.x, e.y, Math.cos(a) * spd, Math.sin(a) * spd);
      }
    } else if (e.attack === "fan") {
      const a = angleTo(e.x, e.y, p.x, p.y);
      for (let i = -3; i <= 3; i++) {
        const ang = a + i * 0.22;
        this._ebullet(e.x, e.y + 8, Math.cos(ang) * spd, Math.sin(ang) * spd);
      }
    } else if (e.attack === "burst") {
      for (let wave = 0; wave < 2; wave++) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + wave * 0.4;
          const s = spd * (0.85 + wave * 0.2);
          this._ebullet(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s);
        }
      }
    }
  }

  _enemyFire(e) {
    if (e.muteFire) return;
    const p = this.player;
    const base = this.stageIndex === 0 && this.loop === 0 ? 86 : 110;
    const spd = base + this.stageIndex * 10 + this.loop * 16;
    if (e.shot === "down") {
      this._ebullet(e.x, e.y + 10, 0, spd);
    } else if (e.shot === "up") {
      const a = angleTo(e.x, e.y, p.x, p.y);
      this._ebullet(e.x, e.y - 6, Math.cos(a) * spd, Math.sin(a) * spd);
    } else if (e.shot === "aim") {
      const a = angleTo(e.x, e.y, p.x, p.y);
      this._ebullet(e.x, e.y + 8, Math.cos(a) * spd, Math.sin(a) * spd);
    } else if (e.shot === "spread") {
      this._ebullet(e.x - 10, e.y + 10, -30, spd);
      this._ebullet(e.x, e.y + 12, 0, spd);
      this._ebullet(e.x + 10, e.y + 10, 30, spd);
    }
    if (e.kind !== "vespa" || (e.phase & 1) === 0) this.audio.enemyShot();
  }

  _updateBullets(dt) {
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -10 || b.x < -10 || b.x > W + 10) this.pBullets.splice(i, 1);
    }
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > H + 12 || b.y < -20 || b.x < -16 || b.x > W + 16) this.eBullets.splice(i, 1);
    }
    if (this.eBullets.length > 180) this.eBullets.splice(0, 60);
    if (this.pBullets.length > 120) this.pBullets.splice(0, 20);
  }

  _updatePickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      u.t += dt;
      u.y += 48 * dt;
      u.x += Math.sin(u.t * 3) * 18 * dt;
      // magnet divertido quando perto
      if (p && p.alive) {
        const dx = p.x - u.x;
        const dy = p.y - u.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110) {
          const d = Math.sqrt(d2) || 1;
          const pull = d2 < 55 * 55 ? 280 : 160;
          u.x += (dx / d) * pull * dt;
          u.y += (dy / d) * pull * dt;
        }
      }
      if (u.y > H + 20) this.pickups.splice(i, 1);
    }
  }

  _collide() {
    const p = this.player;
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      let hit = false;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (circleHit(b.x, b.y, b.r, e.x, e.y, e.r)) {
          e.hp -= b.dmg;
          e.flash = 0.12;
          hit = true;
          this.fx.impact(b.x, b.y);
          try { this.audio.hit(); } catch (_) {}
          if (e.boss) this.hitStop = Math.max(this.hitStop, 0.05);
          else if (e.hp <= 0) this.hitStop = Math.max(this.hitStop, 0.035);
          if (e.hp <= 0) this._kill(e, false);
          break;
        }
      }
      if (hit) this.pBullets.splice(i, 1);
    }

    if (!p.alive) return;

    const vulnerable = p.invuln <= 0;
    if (vulnerable) {
      for (let i = this.eBullets.length - 1; i >= 0; i--) {
        const b = this.eBullets[i];
        if (circleHit(p.x, p.y, PLAYER_HIT_R, b.x, b.y, b.r)) {
          this.eBullets.splice(i, 1);
          this._playerHit();
          if (!p.alive) return;
          break;
        }
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (circleHit(p.x, p.y, PLAYER_HIT_R, e.x, e.y, e.r * 0.78)) {
          this._playerHit();
          if (!p.alive) return;
          break;
        }
      }
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      if (circleHit(p.x, p.y, 16, u.x, u.y, 12)) {
        this._applyPickup(u.kind, u.x, u.y);
        this.pickups.splice(i, 1);
      }
    }
  }

  _kill(e, fromBomb) {
    e.dead = true;
    if (!e.boss) {
      this.fx.boom(e.x, e.y, 18, "#e8c070");
      this.audio.explosion();
    }
    if (fromBomb) {
      this._addScore(BOMB_SCORE);
      this.fx.floatText(e.x, e.y - 10, `+${BOMB_SCORE}`, "#9ad4ff");
    } else {
      this.combo += 1;
      this.comboT = COMBO_WINDOW;
      const pts = scoreKill(e.score, this.combo, this.loop);
      this._addScore(pts);
      this.fx.floatText(e.x, e.y - 10, `+${pts}`, this.combo > 3 ? "#ff9a4a" : "#ffe08a");
      if (this.combo >= 3) {
        this.fx.floatText(e.x, e.y - 24, `COMBO x${this.combo}`, "#fff");
      }
      if (this.combo === 5 || this.combo === 10 || this.combo === 15 || this.combo === 20) {
        try { this.audio.combo(this.combo); } catch (_) {}
        this.fx.flash = Math.max(this.fx.flash, 0.18);
        this.fx.shake = Math.max(this.fx.shake, 4.5);
        this.fx.floatText(e.x, e.y - 40, this.combo >= 15 ? "INSANO!" : this.combo >= 10 ? "ÉPICO!" : "BOM!", "#ff6a4a");
      }
      // combo high: rajada curta de brinde
      if (this.combo === 8) {
        this.player.rapidT = Math.max(this.player.rapidT, 3.5);
        this.fx.floatText(this.player.x, this.player.y - 36, "RAJADA!", "#ff9a4a");
      }
    }
    if (e.kind === "as" || e.drop) {
      const kind = e.kind === "as"
        ? WEAPON_DROPS[(Math.random() * WEAPON_DROPS.length) | 0]
        : e.drop;
      this.pickups.push({ x: e.x, y: e.y, kind, t: 0 });
    } else if (!fromBomb && Math.random() < 0.24) {
      this.pickups.push({
        x: e.x,
        y: e.y,
        kind: WEAPON_DROPS[(Math.random() * WEAPON_DROPS.length) | 0],
        t: 0,
      });
    }
    if (e.boss) {
      const bx = e.x, by = e.y;
      this.boss = null;
      this.pendingBoss = false;
      this.cleared = true;
      this.eBullets.length = 0;
      this.pBullets.length = 0;
      this.pickups.length = 0;
      for (const x of this.enemies) {
        if (x !== e) x.dead = true;
      }
      this.enemies.length = 0;
      this.fx.reset();
      // celebração leve (evita bigBoom no mobile)
      this.fx.boom(bx, by, 18, "#e0b84a");
      this.fx.boom(bx - 12, by + 6, 10, "#ff9a4a");
      this.fx.shake = 9;
      this.fx.flash = 0.24;
      try { this.audio.explosion(); this.audio.stage(); } catch (_) {}
      this.mode = "stageclear";
      this._saveHigh();
    }
  }

  _playerHit() {
    const p = this.player;
    if (p.invuln > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 0.8;
      this.fx.boom(p.x, p.y, 10, "#9ad4ff");
      this.audio.hit();
      this.fx.floatText(p.x, p.y - 16, "ESCUDO", "#9ad4ff");
      return;
    }
    this.lives--;
    this.audio.hurt();
    this.fx.playerHurt();
    this.fx.boom(p.x, p.y, 22, "#e85d4c");
    this.fx.flash = Math.max(this.fx.flash, 0.32);
    this.fx.floatText(p.x, p.y - 28, "HIT!", "#ff6a4a");
    p.spread = 1;
    p.spreadT = 0;
    p.rapidT = 0;
    if (this.lives <= 0) {
      this.lives = 0;
      p.alive = false;
      this.mode = "gameover";
      this._saveHigh();
      this.audio.gameover();
      return;
    }
    this.spawnPlayer();
  }

  _applyPickup(kind, x, y) {
    const p = this.player;
    this.audio.pickup();
    if (kind === "shot") {
      p.spread = Math.min(MAX_SPREAD, p.spread + 2);
      p.spreadT = Math.max(p.spreadT, 14);
      this.fx.floatText(x, y, "TIRO+", "#ffe08a");
    } else if (kind === "spread") {
      p.spread = Math.min(MAX_SPREAD, p.spread + 2);
      p.spreadT = 14;
      this.fx.floatText(x, y, "LEQUE", "#ffd36a");
    } else if (kind === "rapid") {
      p.rapidT = 10;
      this.fx.floatText(x, y, "RAJADA", "#ff9a4a");
    } else if (kind === "shield") {
      p.shield = Math.min(3, p.shield + 1);
      this.fx.floatText(x, y, "ESCUDO", "#9ad4ff");
    } else if (kind === "bomb") {
      this.bombs = Math.min(MAX_BOMBS, this.bombs + 1);
      this.fx.floatText(x, y, "+", "#9ad4ff");
    } else {
      this._addScore(1000);
      this.fx.floatText(x, y, "+1000", "#ffe08a");
    }
  }

  _addScore(n) {
    const prev = this.score;
    this.score += n;
    const extra = extraLifeEarned(prev, this.score);
    if (extra) {
      this.lives += extra;
      this.audio.extraLife();
      this.fx.floatText(this.player.x, this.player.y - 28, "VIDA +1", "#7dce9a");
    }
    if (this.score > this.high) {
      this.high = this.score;
      this._saveHigh();
    }
  }

  _saveHigh() {
    localStorage.setItem(STORAGE_HIGH, String(this.high | 0));
  }

  _checkStage() {
    const script = STAGES[this.stageIndex].waves;
    if (this.waveI < script.length) return;
    const alive = this.enemies.some((e) => !e.dead);
    if (this.pendingBoss && !this.boss && !alive) {
      this._spawnBoss();
      return;
    }
    if (!this.pendingBoss && !alive && this.eBullets.length < 4) {
      this.cleared = true;
    }
    if (this.cleared && !alive) {
      this.eBullets.length = 0;
      this.pBullets.length = 0;
      this.pickups.length = 0;
      this.enemies.length = 0;
      this.fx.reset();
      this.mode = "stageclear";
      // sem audio.stage() pesado aqui — UI toca bip leve
      this._saveHigh();
    }
  }

  nextStage() {
    this.enemies.length = 0;
    this.eBullets.length = 0;
    this.pBullets.length = 0;
    this.pickups.length = 0;
    this.boss = null;
    this.pendingBoss = false;
    this.cleared = false;
    this.stageIndex++;
    if (this.stageIndex >= STAGES.length) {
      this.stageIndex = 0;
      this.loop++;
    }
    this.mode = "playing";
    this.introT = 1.8;
    this.player.invuln = 1.4;
    this._announceStage();
  }

  palette() {
    return STAGE_META[this.stageIndex].palette;
  }
}
