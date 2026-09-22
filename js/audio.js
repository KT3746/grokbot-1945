/**
 * Áudio procedural premium (Web Audio) — sem samples com copyright.
 * Mix mais cheio: pad + delay, groove em camadas, SFX com corpo.
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
    this._noisePool = null;
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
    this.master.gain.value = this.muted ? 0 : 1;

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -22;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 3.8;
    this.comp.attack.value = 0.008;
    this.comp.release.value = 0.18;
    this.comp.connect(this.master);
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.comp);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.comp);

    // delay curto na música = sensação de sala / arcade
    this._delay = this.ctx.createDelay(0.5);
    this._delay.delayTime.value = 0.18;
    this._delayFb = this.ctx.createGain();
    this._delayFb.gain.value = 0.28;
    this._delayWet = this.ctx.createGain();
    this._delayWet.gain.value = 0.22;
    this.musicGain.connect(this._delay);
    this._delay.connect(this._delayFb);
    this._delayFb.connect(this._delay);
    this._delay.connect(this._delayWet);
    this._delayWet.connect(this.comp);

    this._makeNoisePool();
    this.unlocked = true;
    this._startBed();
  }

  _makeNoisePool() {
    const ctx = this.ctx;
    const n = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    this._noisePool = buf;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(STORAGE_MUTE, m ? "1" : "0");
    if (this.master) this.master.gain.value = m ? 0 : 1;
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
      try {
        this._pad.f.frequency.setTargetAtTime(v ? Math.max(base, 2800) : base, t, 0.35);
        this._pad.drive.gain.setTargetAtTime(v ? 0.14 : 0.075, t, 0.35);
        this._pad.sparkleG.gain.setTargetAtTime(v ? 0.04 : 0.018, t, 0.35);
        if (this._delayWet) this._delayWet.gain.setTargetAtTime(v ? 0.3 : 0.22, t, 0.4);
      } catch (_) {}
    }
  }

  _paletteFilter() {
    const p = this._palette;
    if (p === "tropic") return 1400;
    if (p === "overcast") return 1000;
    if (p === "dusk") return 1600;
    if (p === "storm") return 2000;
    if (p === "fortress") return 850;
    return 1200;
  }

  _stageTempo() {
    const p = this._palette;
    if (p === "tropic") return 0.48;
    if (p === "overcast") return 0.42;
    if (p === "dusk") return 0.36;
    if (p === "storm") return 0.26;
    if (p === "fortress") return 0.34;
    return 0.42;
  }

  setStage(index, palette) {
    this._stageId = index | 0;
    this._palette = palette || "tropic";
    if (!this._pad || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bass = 46 + this._stageId * 5;
    const mid = 92 + this._stageId * 10;
    try {
      this._pad.bass.frequency.setTargetAtTime(bass, t, 0.45);
      this._pad.sub.frequency.setTargetAtTime(bass * 0.5, t, 0.45);
      this._pad.mid.frequency.setTargetAtTime(mid, t, 0.45);
      this._pad.mid2.frequency.setTargetAtTime(mid * 1.5, t, 0.45);
      if (!this._intense) {
        this._pad.f.frequency.setTargetAtTime(this._paletteFilter(), t, 0.55);
      }
      // delay time por vibe
      if (this._delay) {
        const d =
          this._palette === "storm" ? 0.12 :
          this._palette === "tropic" ? 0.22 :
          this._palette === "fortress" ? 0.15 : 0.18;
        this._delay.delayTime.setTargetAtTime(d, t, 0.4);
      }
    } catch (_) {}
  }

  update(dt) {
    if (!this.unlocked || this.muted || !this.ctx) return;
    this._beat -= dt;
    if (this._beat <= 0) {
      this._groove();
      const tempo = this._stageTempo();
      const hype = this._intense ? tempo * 0.7 : tempo;
      this._beat = this._comboHype > 0 ? Math.min(hype, tempo * 0.62) : hype;
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
    bassG.gain.value = 0.11;
    bass.connect(bassG);
    sub.connect(bassG);

    const mid = ctx.createOscillator();
    const mid2 = ctx.createOscillator();
    const mid3 = ctx.createOscillator();
    const midG = ctx.createGain();
    const f = ctx.createBiquadFilter();
    mid.type = "sawtooth";
    mid2.type = "triangle";
    mid3.type = "sine";
    mid.frequency.value = 110;
    mid2.frequency.value = 164.8;
    mid3.frequency.value = 220.5;
    f.type = "lowpass";
    f.frequency.value = 1200;
    f.Q.value = 0.9;
    midG.gain.value = 0.04;
    mid.connect(f);
    mid2.connect(f);
    mid3.connect(f);
    f.connect(midG);

    const sparkle = ctx.createOscillator();
    const sparkleG = ctx.createGain();
    const sf = ctx.createBiquadFilter();
    sparkle.type = "sine";
    sparkle.frequency.value = 987;
    sf.type = "highpass";
    sf.frequency.value = 700;
    sparkleG.gain.value = 0.018;
    sparkle.connect(sf);
    sf.connect(sparkleG);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noisePool;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 480;
    nf.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.028;
    noise.connect(nf);
    nf.connect(ng);

    const drive = ctx.createGain();
    drive.gain.value = 0.075;
    bassG.connect(drive);
    midG.connect(drive);
    sparkleG.connect(drive);
    ng.connect(drive);
    drive.connect(this.musicGain);

    bass.start(t);
    sub.start(t);
    mid.start(t);
    mid2.start(t);
    mid3.start(t);
    sparkle.start(t);
    noise.start(t);
    this._pad = { bass, sub, mid, mid2, mid3, sparkle, noise, f, drive, sparkleG, nf, ng };
  }

  _kick(t, pal, intense) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const click = ctx.createGain();
    o.type = "sine";
    o2.type = pal === "fortress" ? "triangle" : "sine";
    const kickF = pal === "tropic" ? 105 : pal === "storm" ? 155 : pal === "dusk" ? 125 : 115;
    o.frequency.setValueAtTime(intense ? kickF + 50 : kickF, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    o2.frequency.setValueAtTime((intense ? kickF + 50 : kickF) * 0.5, t);
    o2.frequency.exponentialRampToValueAtTime(30, t + 0.16);
    const kickV = intense ? 0.2 : pal === "storm" ? 0.17 : 0.15;
    g.gain.setValueAtTime(kickV, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    o2.connect(g);
    g.connect(this.musicGain);
    // click de ataque
    const n = ctx.createBufferSource();
    n.buffer = this._noisePool;
    const bp = ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = 2500;
    click.gain.setValueAtTime(intense ? 0.06 : 0.04, t);
    click.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    n.connect(bp);
    bp.connect(click);
    click.connect(this.musicGain);
    o.start(t);
    o2.start(t);
    n.start(t);
    o.stop(t + 0.2);
    o2.stop(t + 0.2);
    n.stop(t + 0.03);
  }

  _snare(t, pal, intense) {
    const ctx = this.ctx;
    const body = ctx.createOscillator();
    const bg = ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(pal === "dusk" ? 220 : 180, t);
    body.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    bg.gain.setValueAtTime(intense ? 0.07 : 0.045, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    body.connect(bg);
    bg.connect(this.musicGain);
    body.start(t);
    body.stop(t + 0.12);

    const src = ctx.createBufferSource();
    src.buffer = this._noisePool;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = pal === "fortress" ? 2200 : 3500;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(intense ? 0.09 : 0.055, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(t);
    src.stop(t + 0.14);
  }

  _hat(t, pal, intense) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noisePool;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = pal === "tropic" ? 9000 : pal === "fortress" ? 5000 : 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(intense ? 0.045 : 0.028, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(t);
    src.stop(t + 0.04);
    // ping metálico leve
    if (pal === "fortress" || intense) {
      this.tone(pal === "fortress" ? 2400 : 3200, "sine", 0.02, intense ? 0.025 : 0.015, -400);
    }
  }

  _groove() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const intense = !!this._intense || this._comboHype > 0;
    const stage = this._stageId | 0;
    const pal = this._palette || "tropic";

    this._kick(t, pal, intense);
    this._step++;

    const snareEvery = pal === "storm" ? 1 : 2;
    if (this._step % snareEvery === 0) this._snare(t, pal, intense);
    this._hat(t, pal, intense);
    if (this._step % 2 === 1) this._hat(t + 0.08, pal, intense);

    const melEvery = pal === "storm" ? 1 : 2;
    if (this._step % melEvery === 0) {
      const scales = [
        [262, 330, 392, 523, 392, 330], // tropic
        [247, 294, 370, 440, 370, 294], // overcast
        [277, 349, 415, 554, 415, 349], // dusk
        [233, 277, 349, 466, 349, 277], // storm
        [220, 262, 330, 415, 330, 262], // fortress
      ];
      const hypeScale = [392, 494, 587, 698, 880, 698];
      const scale = intense ? hypeScale : scales[stage % scales.length];
      const f0 = scale[this._bassStep % scale.length];
      this._bassStep++;

      const pl = ctx.createOscillator();
      const pl2 = ctx.createOscillator();
      const pl3 = ctx.createOscillator();
      const pg = ctx.createGain();
      const pf = ctx.createBiquadFilter();
      pl.type = pal === "fortress" ? "square" : pal === "storm" ? "sawtooth" : "triangle";
      pl2.type = "sine";
      pl3.type = "sine";
      pl.frequency.value = f0;
      pl2.frequency.value = f0 * (pal === "dusk" ? 1.5 : 2.005);
      pl3.frequency.value = f0 * 0.5;
      pf.type = "lowpass";
      pf.Q.value = 1.1;
      pf.frequency.setValueAtTime(intense ? 4800 : pal === "tropic" ? 3800 : 3200, t);
      pf.frequency.exponentialRampToValueAtTime(700, t + 0.28);
      const vol = intense ? 0.085 : 0.065;
      pg.gain.setValueAtTime(vol, t);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      pl.connect(pf);
      pl2.connect(pf);
      pl3.connect(pf);
      pf.connect(pg);
      pg.connect(this.musicGain);
      pl.start(t);
      pl2.start(t);
      pl3.start(t);
      pl.stop(t + 0.32);
      pl2.stop(t + 0.32);
      pl3.stop(t + 0.32);
    }

    // stab de acorde a cada 4
    if (this._step % 4 === 0) {
      const root = intense ? 98 : pal === "fortress" ? 65 : 82;
      this.tone(root, "sine", 0.16, intense ? 0.09 : 0.06, -12);
      this.tone(root * 1.5, "triangle", 0.12, 0.035, -8);
      this.tone(root * 2, "sine", 0.1, 0.025);
    }

    // fill ocasional
    if (this._step % 16 === 14) {
      this._snare(t + 0.05, pal, true);
      this._hat(t + 0.1, pal, true);
    }
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
    const t0 = ctx.currentTime;
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    o2.frequency.setValueAtTime(Math.max(20, freq * 2.01), t0);
    if (slide) {
      const end = Math.max(40, freq + slide);
      o.frequency.exponentialRampToValueAtTime(end, t0 + dur);
      o2.frequency.exponentialRampToValueAtTime(Math.max(40, end * 2), t0 + dur);
    }
    f.type = "lowpass";
    f.frequency.value = Math.min(10000, Math.max(200, freq * 6));
    this._env(g, t0, 0.005, dur, vol);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + dur + 0.05);
    o2.stop(t0 + dur + 0.05);
  }

  noise(dur, vol = 0.1, filterFreq = 1400, type = "lowpass") {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noisePool;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    this._env(g, t0, 0.002, dur, vol);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shoot() {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dest = this.sfxGain;
    const jit = (Math.random() - 0.5) * 100;

    // click mecânico
    {
      const src = ctx.createBufferSource();
      src.buffer = this._noisePool;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 4800 + jit * 0.2;
      bp.Q.value = 1.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(t);
      src.stop(t + 0.025);
    }

    // corpo blaster
    {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o2.type = "triangle";
      o.frequency.setValueAtTime(1280 + jit, t);
      o.frequency.exponentialRampToValueAtTime(200 + jit * 0.15, t + 0.055);
      o2.frequency.setValueAtTime(2560 + jit * 2, t);
      o2.frequency.exponentialRampToValueAtTime(400, t + 0.05);
      f.type = "lowpass";
      f.Q.value = 0.85;
      f.frequency.setValueAtTime(6200, t);
      f.frequency.exponentialRampToValueAtTime(800, t + 0.07);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(dest);
      o.start(t);
      o2.start(t);
      o.stop(t + 0.1);
      o2.stop(t + 0.1);
    }

    // whoosh
    {
      const src = ctx.createBufferSource();
      src.buffer = this._noisePool;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 3000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      src.connect(hp);
      hp.connect(g);
      g.connect(dest);
      src.start(t);
      src.stop(t + 0.05);
    }

    // sub tick
    {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(65, t + 0.045);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + 0.06);
    }
  }

  enemyShot() {
    this.tone(300, "sawtooth", 0.06, 0.05, -110);
    this.tone(460, "triangle", 0.045, 0.03, -180);
    this.noise(0.035, 0.028, 2600);
  }

  explosion() {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // rumble
    {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.35);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(t);
      o.stop(t + 0.42);
    }
    this.noise(0.32, 0.28, 900);
    this.noise(0.18, 0.16, 2800, "bandpass");
    this.noise(0.1, 0.1, 5500, "highpass");
    this.tone(55, "sine", 0.32, 0.14, -18);
    this.tone(120, "sawtooth", 0.16, 0.09, -60);
    this.tone(210, "triangle", 0.1, 0.05, -100);
  }

  bigBoom() {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(55, t);
      o.frequency.exponentialRampToValueAtTime(22, t + 0.7);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(t);
      o.stop(t + 0.8);
    }
    this.noise(0.65, 0.38, 650);
    this.noise(0.45, 0.22, 1800, "bandpass");
    this.noise(0.25, 0.14, 4200, "highpass");
    this.tone(40, "sine", 0.75, 0.24, -8);
    this.tone(90, "sawtooth", 0.4, 0.12, -40);
    this.tone(180, "triangle", 0.25, 0.07, -70);
  }

  hit() {
    this.tone(160, "sawtooth", 0.08, 0.13, -50);
    this.noise(0.055, 0.14, 1200);
    this.tone(320, "triangle", 0.04, 0.05, -80);
  }

  hurt() {
    this.tone(260, "sawtooth", 0.24, 0.16, -180);
    this.tone(180, "square", 0.18, 0.08, -100);
    this.noise(0.16, 0.16, 700);
    this.tone(90, "sine", 0.2, 0.08, -30);
  }

  combo(n = 4) {
    if (!this.unlocked || this.muted) return;
    this._comboHype = Math.min(14, 4 + (n / 2) | 0);
    const base = 540 + Math.min(10, n) * 36;
    this.tone(base, "triangle", 0.07, 0.1);
    setTimeout(() => this.tone(base * 1.25, "sine", 0.08, 0.09), 40);
    setTimeout(() => this.tone(base * 1.5, "triangle", 0.11, 0.08), 90);
    if (n >= 8) setTimeout(() => this.tone(base * 2, "sine", 0.16, 0.07), 140);
    if (n >= 12) setTimeout(() => this.tone(base * 2.5, "triangle", 0.2, 0.06), 200);
  }

  pickup() {
    this.tone(660, "sine", 0.05, 0.11);
    this.tone(990, "triangle", 0.04, 0.06);
    setTimeout(() => this.tone(880, "triangle", 0.07, 0.1), 30);
    setTimeout(() => this.tone(1175, "sine", 0.12, 0.09), 75);
    setTimeout(() => this.tone(1480, "sine", 0.12, 0.06), 125);
    setTimeout(() => this.noise(0.04, 0.03, 6000, "highpass"), 20);
  }

  ui() {
    this.tone(820, "triangle", 0.05, 0.07);
    this.tone(1100, "sine", 0.04, 0.035);
  }

  warning() {
    this.tone(540, "sawtooth", 0.1, 0.1, -45);
    this.noise(0.09, 0.06, 2600);
    setTimeout(() => this.tone(400, "square", 0.14, 0.09, -35), 85);
    setTimeout(() => this.tone(320, "sawtooth", 0.16, 0.08), 170);
  }

  stage() {
    const root = 294 + (this._stageId % 5) * 30;
    this.tone(root, "triangle", 0.14, 0.11);
    setTimeout(() => this.tone(root * 1.25, "triangle", 0.14, 0.1), 70);
    setTimeout(() => this.tone(root * 1.5, "sine", 0.2, 0.11), 140);
    setTimeout(() => this.tone(root * 2, "sine", 0.3, 0.09), 230);
    setTimeout(() => this.tone(root * 2.5, "triangle", 0.22, 0.05), 320);
    this.noise(0.07, 0.035, 2000);
  }

  gameover() {
    this.tone(220, "sawtooth", 0.35, 0.14, -45);
    setTimeout(() => this.tone(165, "triangle", 0.45, 0.12, -35), 140);
    setTimeout(() => this.tone(110, "sine", 0.6, 0.12), 280);
    setTimeout(() => this.noise(0.4, 0.08, 600), 100);
  }

  extraLife() {
    this.tone(466, "sine", 0.09, 0.11);
    setTimeout(() => this.tone(587, "sine", 0.1, 0.11), 60);
    setTimeout(() => this.tone(698, "triangle", 0.12, 0.11), 120);
    setTimeout(() => this.tone(932, "sine", 0.2, 0.1), 200);
    setTimeout(() => this.tone(1175, "triangle", 0.18, 0.07), 280);
  }
}
