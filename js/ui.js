/** Telas (título, como jogar, pausa, vitória, game over) e HUD. */
import { STAGE_META, BOSS_NAMES } from "./core.js";
import { VERSION } from "./version.js";

export class UI {
  constructor(game, audio, input) {
    this.game = game;
    this.audio = audio;
    this.input = input;
    this.els = {
      title: document.getElementById("screen-title"),
      howto: document.getElementById("screen-howto"),
      pause: document.getElementById("screen-pause"),
      stage: document.getElementById("screen-stage"),
      over: document.getElementById("screen-over"),
      score: document.getElementById("stat-score"),
      high: document.getElementById("stat-high"),
      lives: document.getElementById("stat-lives"),
      bombs: document.getElementById("stat-bombs"),
      chip: document.getElementById("stage-chip"),
      titleHigh: document.getElementById("title-high"),
      overScore: document.getElementById("over-score"),
      overHigh: document.getElementById("over-high"),
      overDaily: document.getElementById("over-daily"),
      overRunStages: document.getElementById("over-run-stages"),
      overDailyBanner: document.getElementById("over-daily-banner"),
      overEyebrow: document.getElementById("over-eyebrow"),
      overText: document.getElementById("over-text"),
      titleDaily: document.getElementById("title-daily"),
      titleStages: document.getElementById("title-stages"),
      weapon: document.getElementById("stat-weapon"),
      stageMeta: document.getElementById("stage-meta"),
      stageH: document.getElementById("stage-h"),
      stageText: document.getElementById("stage-text"),
      stageEyebrow: document.getElementById("stage-eyebrow"),
      stageScore: document.getElementById("stage-score"),
      bossBar: document.getElementById("boss-bar"),
      bossName: document.getElementById("boss-name"),
      bossFill: document.getElementById("boss-fill"),
      mute: document.getElementById("btn-mute"),
      pauseBtn: document.getElementById("btn-pause"),
      ver: document.getElementById("ver"),
      weaponTimer: document.getElementById("weapon-timer"),
      weaponTimerFill: document.getElementById("weapon-timer-fill"),
      bombBtn: document.getElementById("btn-bomb"),
      bombCount: document.getElementById("bomb-count"),
      fireBtn: document.getElementById("btn-fire"),
      focusBtn: document.getElementById("btn-focus"),
      shieldWrap: document.getElementById("stat-shield-wrap"),
      shield: document.getElementById("stat-shield"),
      missionBar: document.getElementById("mission-bar"),
      missionLabel: document.getElementById("mission-label"),
      missionFill: document.getElementById("mission-fill"),
      comboWrap: document.getElementById("stat-combo-wrap"),
      combo: document.getElementById("stat-combo"),
      comboTimer: document.getElementById("combo-timer"),
      comboTimerFill: document.getElementById("combo-timer-fill"),
      toast: document.getElementById("toast"),
    };
    this._hintActive = false;
    this._hintLeaveTimer = null;
    this._lastScore = 0;
    this._lastToast = "";
    this.game.onFirstAction = () => this.dismissHint(false);
    this._syncVersion();
    this._bind();
    this._syncMute();
    this.show("title");
  }

  _syncVersion() {
    const label = `v${VERSION}`;
    if (this.els.ver) this.els.ver.textContent = label;
    const titleVer = document.getElementById("title-ver");
    if (titleVer) titleVer.textContent = label;
  }

  _clearPlay() {
    this.input?.clearPlay();
  }

  _lockPlay() {
    if (this.input) this.input.playLocked = true;
    this._clearPlay();
  }

  _unlockPlay() {
    this._clearPlay();
    if (this.input) this.input.playLocked = false;
  }

  _blurChrome() {
    this.els.pauseBtn?.blur();
    this.els.mute?.blur();
    const active = document.activeElement;
    if (active && active.blur && active.closest && active.closest(".toolbar, .chip")) {
      active.blur();
    }
  }

  _bind() {
    const g = this.game;
    const a = this.audio;
    const go = (fn) => (ev) => {
      ev.preventDefault();
      a.unlock();
      a.ui();
      fn();
      if (ev.currentTarget && ev.currentTarget.blur) ev.currentTarget.blur();
    };

    document.getElementById("btn-play").addEventListener("click", go(() => this._play()));
    document.getElementById("btn-howto").addEventListener("click", go(() => this.show("howto")));
    document.getElementById("btn-howto-go").addEventListener("click", go(() => this._play()));
    document.getElementById("btn-howto-back").addEventListener("click", go(() => this.show("title")));
    document.getElementById("btn-resume").addEventListener("click", go(() => this.resume()));
    document.getElementById("btn-restart").addEventListener("click", go(() => this._play()));
    document.getElementById("btn-menu").addEventListener("click", go(() => this.toTitle()));
    const btnNext = document.getElementById("btn-next");
    if (btnNext) btnNext.addEventListener("click", go(() => this.next()));
    document.getElementById("btn-again").addEventListener("click", go(() => this._play()));
    document.getElementById("btn-over-menu").addEventListener("click", go(() => this.toTitle()));
    this.els.mute.addEventListener("click", go(() => {
      a.unlock();
      const m = a.toggleMute();
      this._syncMute();
      void m;
    }));

    // Pausa só no toque/clique explícito neste botão — Space/Enter no foco
    // do botão NÃO pausam (isso gerava "pausa fantasma" sem P/Esc).
    this.els.pauseBtn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      a.unlock();
      a.ui();
      this.togglePause();
      this.els.pauseBtn.blur();
    });
    this.els.pauseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.els.pauseBtn.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  _play() {
    this._unlockPlay();
    const q = new URLSearchParams(location.search);
    const st = Number(q.get("stage") || 0);
    this.game.start(Number.isFinite(st) ? st : 0);
    this._lastScore = 0;
    this.show(null);
    this.showOnboardingHint();
    this.refresh();
    this._blurChrome();
  }

  toTitle() {
    this._lockPlay();
    this.game.mode = "title";
    this.game.resetRun();
    this.dismissHint(true);
    this.show("title");
    this.refresh();
  }

  resume() {
    this._unlockPlay();
    this.game.resume();
    this.show(null);
    this._blurChrome();
    try { this.audio.resume(); } catch (_) { /* ok */ }
  }

  togglePause() {
    if (this.game.mode === "playing") {
      this.game.pause();
      this._lockPlay();
      this.show("pause");
      try { this.audio.suspend(); } catch (_) { /* ok */ }
    } else if (this.game.mode === "paused") {
      this.resume();
    }
  }

  next() {
    this._unlockPlay();
    this.game.nextStage();
    this.show(null);
  }

  show(name) {
    const map = {
      title: this.els.title,
      howto: this.els.howto,
      pause: this.els.pause,
      stage: this.els.stage,
      over: this.els.over,
    };
    for (const [k, el] of Object.entries(map)) {
      el.classList.toggle("hidden", k !== name);
    }
  }

  _syncMute() {
    this.els.mute.textContent = this.audio.muted ? "Mudo" : "Som";
    this.els.mute.setAttribute("aria-pressed", this.audio.muted ? "true" : "false");
  }

  onMode() {
    const m = this.game.mode;
    if (m === "stageclear") {
      this.dismissHint(true);
      this.input?.clearPlay?.();
      this._lockPlay();
      const looped = this.game.stageIndex === 4;
      const meta = STAGE_META[this.game.stageIndex];
      if (this.els.stageEyebrow) {
        this.els.stageEyebrow.textContent = this.game.loop && this.game.stageIndex === 4
          ? "Ciclo completo"
          : "Estágio concluído";
      }
      if (this.els.stageH) {
        this.els.stageH.textContent = looped && this.game.loop === 0
          ? "Horizonte aberto"
          : `Vitória: ${meta.name}`;
      }
      if (this.els.stageText) {
        this.els.stageText.textContent =
          this.game.stageIndex === 4
            ? "A Frota recua — mas o céu recomeça mais duro. Prepare-se para o próximo ciclo."
            : meta.subtitle;
      }
      if (this.els.stageScore) {
        this.els.stageScore.textContent = `Pontos: ${this.game.score}`;
      }
      if (this.els.stageMeta) {
        this.els.stageMeta.textContent =
          `Estágios limpos (total): ${this.game.stagesCleared | 0} · Nesta run: ${this.game.runStages | 0}`;
      }
      const next = document.getElementById("btn-next");
      if (next) {
        next.textContent = this.game.stageIndex === 4 ? "Continuar o ciclo" : "Próximo estágio";
        next.style.display = "";
        next.hidden = false;
      }
      this.show("stage");
      // garante overlay visível mesmo se classe hidden falhar
      if (this.els.stage) this.els.stage.classList.remove("hidden");
    } else if (m === "gameover") {
      this.dismissHint(true);
      this._lockPlay();
      const g = this.game;
      const meta = STAGE_META[g.stageIndex] || STAGE_META[0];
      this.els.overScore.textContent = String(g.score);
      this.els.overHigh.textContent = String(g.high);
      if (this.els.overDaily) this.els.overDaily.textContent = String(g.dailyHigh | 0);
      if (this.els.overRunStages) this.els.overRunStages.textContent = String(g.runStages | 0);
      if (this.els.overText) {
        this.els.overText.textContent =
          g.runStages > 0
            ? `Você chegou a ${meta.name} · ${g.runStages} estágio(s) limpo(s) nesta run.`
            : `O Falcão-Vértice caiu em ${meta.name}.`;
      }
      if (this.els.overEyebrow) {
        this.els.overEyebrow.textContent = g.newDaily ? "Novo marco" : "Mayday";
      }
      if (this.els.overDailyBanner) {
        this.els.overDailyBanner.classList.toggle("hidden", !g.newDaily);
      }
      const modal = document.querySelector("#screen-over .modal");
      if (modal) modal.classList.toggle("over-new-daily", !!g.newDaily);
      this.show("over");
    }
  }

  refresh() {
    const g = this.game;
    const scoreEl = this.els.score;
    const prevScore = this._lastScore;
    scoreEl.textContent = String(g.score);
    if ((g.scorePop || g.score > prevScore) && g.mode === "playing" && g.score > 0) {
      scoreEl.classList.remove("score-pop");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("score-pop");
    }
    g.scorePop = false;
    this._lastScore = g.score;
    // Combo HUD juice (gated by reduced-motion via CSS)
    scoreEl.classList.toggle("score-combo", g.mode === "playing" && g.combo >= 3);
    scoreEl.classList.toggle("combo-hot", g.mode === "playing" && g.combo >= 8);
    this.els.high.textContent = String(g.high);
    this.els.lives.textContent = String(Math.max(0, g.lives));
    this.els.lives.classList.toggle("lives-critical", g.mode === "playing" && g.lives <= 1);
    this.els.bombs.textContent = String(g.bombs);
    this.els.titleHigh.textContent = String(g.high);
    if (this.els.titleDaily) this.els.titleDaily.textContent = String(g.dailyHigh | 0);
    if (this.els.titleStages) this.els.titleStages.textContent = String(g.stagesCleared | 0);
    if (this.els.weapon) {
      const w = typeof g.weaponLabel === "function" ? g.weaponLabel() : "TIRO";
      this.els.weapon.textContent = w;
      this.els.weapon.classList.toggle("weapon-flash", g.mode === "playing" && (g.weaponFlash || 0) > 0);
      const hot = w === "RAJADA" || w === "LEQUE";
      this.els.weapon.classList.toggle("weapon-hot", g.mode === "playing" && hot);
    }
    // Barrinha de tempo do power-up (some quando volta ao TIRO normal)
    if (this.els.weaponTimer && this.els.weaponTimerFill) {
      const r = typeof g.weaponTimer === "function" && g.mode !== "title" ? g.weaponTimer() : 0;
      this.els.weaponTimer.classList.toggle("on", r > 0);
      this.els.weaponTimer.classList.toggle("ending", r > 0 && r < 0.25);
      this.els.weaponTimerFill.style.transform = `scaleX(${r})`;
    }
    // Botão Bomba: contador + estado vazio / recarga
    if (this.els.bombCount) this.els.bombCount.textContent = String(Math.max(0, g.bombs | 0));
    if (this.els.bombBtn) {
      const empty = (g.bombs | 0) <= 0;
      this.els.bombBtn.classList.toggle("bomb-empty", empty);
      this.els.bombBtn.classList.toggle("bomb-cd", !empty && (g.bombCd || 0) > 0);
      this.els.bombBtn.classList.toggle("bomb-gain", (g.bombGain || 0) > 0);
      this.els.bombBtn.setAttribute("aria-label", empty ? "Bomba (sem bombas)" : `Bomba (${g.bombs | 0})`);
    }
    // Botão Fogo acende quando o dedo no céu está atirando sozinho
    if (this.els.fireBtn) {
      const touch = !!this.input?.touchEnabled;
      this.els.fireBtn.classList.toggle("fire-touch", touch);
      this.els.fireBtn.classList.toggle("fire-auto", g.mode === "playing" && !!this.input?.autoFiring);
    }
    // Foco: botão aceso + tag "lento" enquanto segura
    if (this.els.focusBtn) {
      const on = g.mode === "playing" && !!this.input?.focusHeld;
      this.els.focusBtn.classList.toggle("focus-on", on);
      this.els.focusBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    // Escudo no HUD (só aparece com carga)
    const sh = (g.player && g.player.shield) | 0;
    if (this.els.shieldWrap && this.els.shield) {
      const show = g.mode === "playing" && sh > 0;
      this.els.shieldWrap.hidden = !show;
      this.els.shield.textContent = String(sh);
      this.els.shield.classList.toggle("shield-hot", show);
    }
    // Chip de combo + barrinha de janela
    if (this.els.comboWrap && this.els.combo) {
      const n = g.combo | 0;
      const show = g.mode === "playing" && n >= 2;
      this.els.comboWrap.hidden = !show;
      if (show) {
        this.els.combo.textContent = `x${n}`;
        this.els.combo.classList.toggle("combo-mid", n >= 5);
        this.els.combo.classList.toggle("combo-hot", n >= 8);
      }
      const r = typeof g.comboTimer === "function" ? g.comboTimer() : 0;
      if (this.els.comboTimer && this.els.comboTimerFill) {
        this.els.comboTimer.classList.toggle("on", show && r > 0);
        this.els.comboTimer.classList.toggle("ending", show && r > 0 && r < 0.28);
        this.els.comboTimerFill.style.transform = `scaleX(${r})`;
      }
    }
    // Toast de bônus / hit (HTML, legível no Galaxy)
    if (this.els.toast) {
      const show = g.mode === "playing" && (g.toastT || 0) > 0 && g.toast;
      if (show && g.toast !== this._lastToast) {
        this.els.toast.textContent = g.toast;
        this._lastToast = g.toast;
      }
      if (!show) this._lastToast = "";
      this.els.toast.classList.toggle("hidden", !show);
      this.els.toast.classList.toggle("on", show);
      this.els.toast.classList.toggle("toast-hit", show && g.toastKind === "hit");
      this.els.toast.classList.toggle("toast-loot", show && g.toastKind !== "hit");
      if (g.toastKind) {
        this.els.toast.dataset.kind = g.toastKind;
      }
    }
    document.body.classList.toggle("low-hp", g.mode === "playing" && g.lives <= 1 && !!g.player?.alive);
    document.body.classList.toggle("graze-hot", g.mode === "playing" && (g.grazeFlash || 0) > 0);
    document.body.classList.toggle("hit-flash", g.mode === "playing" && (g.hitFlash || 0) > 0);
    document.getElementById("board-wrap")?.classList.toggle("hp-edge", g.mode === "playing" && g.lives <= 1 && !!g.player?.alive);
    const meta = STAGE_META[g.stageIndex];
    const loop = g.loop ? ` · ciclo ${g.loop + 1}` : "";
    this.els.chip.textContent =
      g.mode === "title"
        ? "Domine o céu. Sobreviva às ondas."
        : `${meta.name}${loop}`;

    const bossUp = !!(g.boss && !g.boss.dead);
    if (bossUp) {
      this.els.bossBar.classList.remove("hidden");
      this.els.bossName.textContent = BOSS_NAMES[g.boss.bossId] || "Chefe";
      const r = Math.max(0, g.boss.hp / g.boss.maxHp);
      this.els.bossFill.style.transform = `scaleX(${r})`;
    } else {
      this.els.bossBar.classList.add("hidden");
    }
    // Barra de missão (ondas) — some no título e durante o chefe
    if (this.els.missionBar && this.els.missionFill) {
      const playing = g.mode === "playing" || g.mode === "paused";
      const show = playing && !bossUp;
      this.els.missionBar.classList.toggle("on", show);
      this.els.missionBar.setAttribute("aria-hidden", show ? "false" : "true");
      if (show) {
        const r = typeof g.missionProgress === "function" ? g.missionProgress() : 0;
        this.els.missionFill.style.transform = `scaleX(${r})`;
        const pct = Math.round(r * 100);
        if (this.els.missionLabel) {
          this.els.missionLabel.textContent =
            g.pendingBoss || pct >= 100 ? "Chefe à frente" : `Missão ${pct}%`;
        }
        this.els.missionBar.classList.toggle("mission-boss", !!(g.pendingBoss || pct >= 98));
      }
    }
  }

  _hintCopy() {
    const touch =
      !!this.input?.touchEnabled ||
      (typeof matchMedia !== "undefined" &&
        matchMedia("(max-width: 720px), (pointer: coarse)").matches);
    return touch
      ? "Arraste pra voar · o tiro é automático"
      : "WASD mover · Espaço atirar";
  }

  showOnboardingHint() {
    const bar = document.getElementById("hint-bar");
    if (!bar) return;
    if (this._hintLeaveTimer) {
      clearTimeout(this._hintLeaveTimer);
      this._hintLeaveTimer = null;
    }
    bar.textContent = this._hintCopy();
    bar.classList.remove("is-leaving", "hidden");
    this._hintActive = true;
    if (this.game) this.game.hintDismissed = false;
  }

  dismissHint(immediate) {
    const bar = document.getElementById("hint-bar");
    if (!this._hintActive && (!bar || bar.classList.contains("hidden"))) {
      this._hintActive = false;
      return;
    }
    this._hintActive = false;
    if (this.game) this.game.hintDismissed = true;
    if (!bar) return;
    if (this._hintLeaveTimer) {
      clearTimeout(this._hintLeaveTimer);
      this._hintLeaveTimer = null;
    }
    if (immediate) {
      bar.classList.add("hidden");
      bar.classList.remove("is-leaving");
      return;
    }
    bar.classList.add("is-leaving");
    this._hintLeaveTimer = setTimeout(() => {
      bar.classList.add("hidden");
      bar.classList.remove("is-leaving");
      this._hintLeaveTimer = null;
    }, 280);
  }
}
