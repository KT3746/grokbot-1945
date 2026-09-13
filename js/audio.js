/**
 * Áudio procedural premium (Web Audio) — sem samples com copyright.
 */
import { STORAGE_MUTE } from "./version.js";

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.comp = null;
    this.unlocked = false;
    this.muted = localStorage.getItem(STORAGE_MUTE) === "1";
    this._pad = null;
    this._beat = 0;
    this._step = 0;
    this._intense = 0;
    this._bassStep = 0;
    this._stageId = 0;
    this._palette = "tropic";
    this._comboHype = 0;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.92;

    // compressor suave = sensação mais "mixada"/premium
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 18;
    this.comp.ratio.value = 3.2;
    this.comp.attack.value = 0.01;
    this.comp.release.value = 0.22;
    this.comp.connect(this.master);
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.38;
    this.musicGain.connect(this.comp);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.92;
    this.sfxGain.connect(this.comp);

    this.unlocked = true;
    this._startBed();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(STORAGE_MUTE, m ? "1" : "0");
    if (this.master) this.master.gain.value = m ? 0 : 0.92;
    if (this.ctx && this.ctx.state === "suspended" && !m) this.ctx.resume();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setIntense(v) {
    this._intense = v;
    if (this._pad && this._pad.f && this.ctx) {
      const t = this.ctx.currentTime;
      const base = this._paletteFilter();
      this._pad.f.frequency.setTargetAtTime(v ? Math.max(base, 2600) : base, t, 0.4);
      this._pad.drive.gain.setTargetAtTime(v ? 0.12 : 0.06, t, 0.4);
      this._pad.sparkleG.gain.setTargetAtTime(v ? 0.034 : 0.014, t, 0.4);
    }
  }

  _paletteFilter() {
    const p = this._palette;
    if (p === "storm") return 1600;
    if (p === "fortress") return 900;
    if (p === "bronze") return 1250;
    if (p === "cloud") return 1400;
    return 1100;
  }

  _stageTempo() {
    const p = this._palette;
    if (p === "tropic") return 0.52;
    if (p === "overcast") return 0.44;
    if (p === "dusk") return 0.38;
    if (p === "storm") return 0.28;
    if (p === "fortress") return 0.36;
    return 0.44;
  }

  setStage(index, palette) {
    this._stageId = index | 0;
    this._palette = palette || "tropic";
    if (!this._pad || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bass = 48 + this._stageId * 4;
    const mid = 98 + this._stageId * 8;
    try {
      this._pad.bass.frequency.setTargetAtTime(bass, t, 0.5);
      this._pad.sub.frequency.setTargetAtTime(bass * 0.5, t, 0.5);
      this._pad.mid.frequency.setTargetAtTime(mid, t, 0.5);
      this._pad.mid2.frequency.setTargetAtTime(mid * 1.5, t, 0.5);
      if (!this._intense) {
        this._pad.f.frequency.setTargetAtTime(this._paletteFilter(), t, 0.6);
      }
    } catch (_) {}
  }

  update(dt) {
    if (!this.unlocked || this.muted || !this.ctx) return;
    this._beat -= dt;
    if (this._beat <= 0) {
      this._groove();
      const tempo = this._stageTempo();
      const hype = this._intense ? tempo * 0.72 : tempo;
      this._beat = this._comboHype > 0 ? Math.min(hype, tempo * 0.65) : hype;
      if (this._comboHype > 0) this._comboHype -= 1;
    }
  }

  _startBed() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const bass = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const bassG = ctx.createGain();
    bass.type = "sine";
    sub.type = "sine";
    bass.frequency.value = 55;
    sub.frequency.value = 27.5;
    bassG.gain.value = 0.09;
    bass.connect(bassG);
    sub.connect(bassG);

    const mid = ctx.createOscillator();
    const mid2 = ctx.createOscillator();
    const midG = ctx.createGain();
    const f = ctx.createBiquadFilter();
    mid.type = "sawtooth";
    mid2.type = "triangle";
    mid.frequency.value = 110;
    mid2.frequency.value = 164.8;
    f.type = "lowpass";
    f.frequency.value = 1100;
    f.Q.value = 0.85;
    midG.gain.value = 0.032;
    mid.connect(f);
    mid2.connect(f);
    f.connect(midG);

    // shimmer / sparkle
    const sparkle = ctx.createOscillator();
    const sparkleG = ctx.createGain();
    const sf = ctx.createBiquadFilter();
    sparkle.type = "sine";
    sparkle.frequency.value = 880;
    sf.type = "highpass";
    sf.frequency.value = 600;
    sparkleG.gain.value = 0.014;
    sparkle.connect(sf);
    sf.connect(sparkleG);

    const nLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < nLen; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 520;
    nf.Q.value = 0.55;
    const ng = ctx.createGain();
    ng.gain.value = 0.02;
    noise.connect(nf);
    nf.connect(ng);

    const drive = ctx.createGain();
    drive.gain.value = 0.06;
    bassG.connect(drive);
    midG.connect(drive);
    sparkleG.connect(drive);
    ng.connect(drive);
    drive.connect(this.musicGain);

    bass.start(t);
    sub.start(t);
    mid.start(t);
    mid2.start(t);
    sparkle.start(t);
    noise.start(t);
    this._pad = { bass, sub, mid, mid2, sparkle, noise, f, drive, sparkleG };
  }

  _groove() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const intense = !!this._intense || this._comboHype > 0;
    const stage = this._stageId | 0;
    const pal = this._palette || "tropic";

    // kick — timbre por fase
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = pal === "fortress" ? "square" : pal === "storm" ? "sawtooth" : "sine";
    const kickF = pal === "tropic" ? 110 : pal === "storm" ? 180 : pal === "dusk" ? 140 : 122;
    o.frequency.setValueAtTime(intense ? kickF + 40 : kickF, t);
    o.frequency.exponentialRampToValueAtTime(pal === "fortress" ? 48 : 38, t + 0.12);
    const kickV = pal === "storm" ? 0.14 : pal === "fortress" ? 0.13 : 0.11;
    g.gain.setValueAtTime(intense ? kickV + 0.05 : kickV, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.15);

    this._step++;
    // snare / clap — mais denso na tempestade
    const snareEvery = pal === "storm" ? 1 : 2;
    if (this._step % snareEvery === 0) {
      this.noise(0.045, intense ? 0.055 : pal === "overcast" ? 0.04 : 0.032, pal === "dusk" ? 2800 : 4200);
      this.tone(pal === "dusk" ? 220 : 180, "triangle", 0.04, 0.03, -40);
    }
    // hi-hat — tropical aberto, fortaleza metálica
    const hatF = pal === "tropic" ? 11000 : pal === "fortress" ? 6000 : 9000;
    this.noise(0.015, intense ? 0.03 : pal === "storm" ? 0.028 : 0.018, hatF);

    // melodic pluck — escala + onda por estágio
    const melEvery = pal === "tropic" ? 2 : pal === "storm" ? 1 : 2;
    if (this._step % melEvery === 0) {
      const scales = [
        [294, 349, 392, 440, 523],       // tropic major alegre
        [277, 330, 370, 415, 494],       // overcast menor
        [311, 370, 415, 466, 554],       // dusk brilhante
        [262, 311, 349, 415, 494],       // storm tenso
        [233, 294, 349, 415, 466],       // fortress grave
      ];
      const hypeScale = [392, 466, 523, 622, 698, 784];
      const scale = intense ? hypeScale : scales[stage % scales.length];
      const f0 = scale[this._bassStep % scale.length];
      this._bassStep++;
      const pl = ctx.createOscillator();
      const pl2 = ctx.createOscillator();
      const pg = ctx.createGain();
      const pf = ctx.createBiquadFilter();
      pl.type = pal === "fortress" ? "square" : pal === "storm" ? "sawtooth" : "triangle";
      pl2.type = "sine";
      pl.frequency.value = f0;
      pl2.frequency.value = f0 * (pal === "dusk" ? 1.5 : 2.01);
      pf.type = "lowpass";
      pf.frequency.setValueAtTime(intense ? 4200 : pal === "tropic" ? 3600 : 3000, t);
      pf.frequency.exponentialRampToValueAtTime(650, t + 0.22);
      pg.gain.setValueAtTime(intense ? 0.07 : 0.058, t);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      pl.connect(pf);
      pl2.connect(pf);
      pf.connect(pg);
      pg.connect(this.musicGain);
      pl.start(t);
      pl2.start(t);
      pl.stop(t + 0.26);
      pl2.stop(t + 0.26);
    }

    // offbeat bass stab
    if (this._step % (pal === "fortress" ? 2 : 4) === 0) {
      this.tone(intense ? 98 : pal === "fortress" ? 70 : 82, "sine", 0.12, intense ? 0.08 : 0.055, -20);
    }

    this.noise(0.018, intense ? 0.03 : 0.016, pal === "storm" ? 12000 : 8500);
  }

  _env(g, t, a, d, vol) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.max(0.004, a));
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq, type, dur, vol = 0.1, slide = 0) {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = type;
    o2.type = "sine";
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o2.frequency.setValueAtTime(freq * 2.01, ctx.currentTime);
    if (slide) {
      const end = Math.max(40, freq + slide);
      o.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + dur);
      o2.frequency.exponentialRampToValueAtTime(Math.max(40, end * 2), ctx.currentTime + dur);
    }
    f.type = "lowpass";
    f.frequency.value = Math.min(9000, freq * 5);
    this._env(g, ctx.currentTime, 0.006, dur, vol);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    o.start();
    o2.start();
    o.stop(ctx.currentTime + dur + 0.06);
    o2.stop(ctx.currentTime + dur + 0.06);
  }

  noise(dur, vol = 0.1, filterFreq = 1400) {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const n = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    this._env(g, ctx.currentTime, 0.002, dur, vol);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  shoot() {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dest = this.sfxGain;
    const jit = (Math.random() - 0.5) * 80;

    // Transient mecânico (click) — bandpass curto
    {
      const n = Math.max(1, (ctx.sampleRate * 0.018) | 0);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 4200;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(t);
    }

    // Corpo do blaster — saw + triangle com pitch drop
    {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o2.type = "triangle";
      o.frequency.setValueAtTime(1180 + jit, t);
      o.frequency.exponentialRampToValueAtTime(220 + jit * 0.2, t + 0.05);
      o2.frequency.setValueAtTime(2360 + jit * 2, t);
      o2.frequency.exponentialRampToValueAtTime(440 + jit * 0.3, t + 0.045);
      f.type = "lowpass";
      f.frequency.setValueAtTime(5200, t);
      f.frequency.exponentialRampToValueAtTime(900, t + 0.06);
      f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.078, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(dest);
      o.start(t);
      o2.start(t);
      o.stop(t + 0.09);
      o2.stop(t + 0.09);
    }

    // Whoosh de ar (highpass curto)
    {
      const n = Math.max(1, (ctx.sampleRate * 0.035) | 0);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(hp);
      hp.connect(g);
      g.connect(dest);
      src.start(t);
    }

    // Peso baixo (sub tick)
    {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.04);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.055, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + 0.06);
    }
  }

  enemyShot() {
    this.tone(280, "sawtooth", 0.055, 0.042, -90);
    this.tone(420, "triangle", 0.04, 0.025, -160);
    this.noise(0.03, 0.022, 2400);
  }

  explosion() {
    this.noise(0.26, 0.24, 1000);
    this.noise(0.14, 0.13, 3800);
    this.tone(64, "sine", 0.28, 0.16, -22);
    this.tone(130, "sawtooth", 0.14, 0.075, -55);
    this.tone(240, "triangle", 0.09, 0.045, -90);
    this.tone(90, "sine", 0.18, 0.06, -30);
  }

  bigBoom() {
    this.noise(0.6, 0.34, 700);
    this.noise(0.4, 0.2, 2000);
    this.tone(44, "sine", 0.7, 0.22, -10);
    this.tone(100, "sawtooth", 0.4, 0.12, -45);
    this.tone(210, "triangle", 0.22, 0.07, -80);
  }

  hit() {
    this.tone(150, "sawtooth", 0.09, 0.12, -45);
    this.noise(0.06, 0.13, 1000);
  }

  hurt() {
    this.tone(240, "sawtooth", 0.22, 0.15, -170);
    this.tone(170, "square", 0.16, 0.07, -95);
    this.noise(0.15, 0.15, 750);
  }

  combo(n = 4) {
    if (!this.unlocked || this.muted) return;
    this._comboHype = Math.min(12, 4 + (n / 2) | 0);
    const base = 520 + Math.min(8, n) * 40;
    this.tone(base, "triangle", 0.06, 0.09);
    setTimeout(() => this.tone(base * 1.25, "sine", 0.07, 0.08), 45);
    setTimeout(() => this.tone(base * 1.5, "triangle", 0.1, 0.07), 95);
    if (n >= 8) setTimeout(() => this.tone(base * 2, "sine", 0.14, 0.06), 150);
  }

  pickup() {
    this.tone(659, "sine", 0.05, 0.1);
    this.tone(988, "triangle", 0.04, 0.05);
    setTimeout(() => this.tone(880, "triangle", 0.07, 0.09), 35);
    setTimeout(() => this.tone(1174, "sine", 0.12, 0.085), 80);
    setTimeout(() => this.tone(1480, "sine", 0.1, 0.05), 130);
  }

  ui() {
    this.tone(780, "triangle", 0.045, 0.06);
    this.tone(1040, "sine", 0.035, 0.03);
  }

  warning() {
    this.tone(520, "sawtooth", 0.09, 0.09, -40);
    this.noise(0.08, 0.05, 2400);
    setTimeout(() => this.tone(390, "square", 0.14, 0.08, -30), 90);
    setTimeout(() => this.tone(310, "sawtooth", 0.16, 0.07), 180);
  }

  stage() {
    const root = 280 + (this._stageId % 5) * 28;
    this.tone(root, "triangle", 0.12, 0.1);
    setTimeout(() => this.tone(root * 1.25, "triangle", 0.12, 0.095), 75);
    setTimeout(() => this.tone(root * 1.5, "sine", 0.18, 0.1), 150);
    setTimeout(() => this.tone(root * 2, "sine", 0.28, 0.08), 240);
    this.noise(0.06, 0.03, 1800);
  }

  gameover() {
    this.tone(208, "sawtooth", 0.32, 0.13, -40);
    setTimeout(() => this.tone(155, "triangle", 0.42, 0.11, -30), 150);
    setTimeout(() => this.tone(103, "sine", 0.58, 0.11), 300);
  }

  extraLife() {
    this.tone(466, "sine", 0.08, 0.1);
    setTimeout(() => this.tone(587, "sine", 0.1, 0.1), 65);
    setTimeout(() => this.tone(698, "triangle", 0.12, 0.1), 130);
    setTimeout(() => this.tone(932, "sine", 0.18, 0.09), 210);
  }
}
