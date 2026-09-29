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
    };
    this._hintActive = false;
    this._hintLeaveTimer = null;
    this._lastScore = 0;
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
      this.els.overScore.textContent = String(this.game.score);
      this.els.overHigh.textContent = String(this.game.high);
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
    this.els.high.textContent = String(g.high);
    this.els.lives.textContent = String(Math.max(0, g.lives));
    this.els.bombs.textContent = String(g.bombs);
    this.els.titleHigh.textContent = String(g.high);
    const meta = STAGE_META[g.stageIndex];
    const loop = g.loop ? ` · ciclo ${g.loop + 1}` : "";
    this.els.chip.textContent =
      g.mode === "title"
        ? "Domine o céu. Sobreviva às ondas."
        : `${meta.name}${loop}`;

    if (g.boss && !g.boss.dead) {
      this.els.bossBar.classList.remove("hidden");
      this.els.bossName.textContent = BOSS_NAMES[g.boss.bossId] || "Chefe";
      const r = Math.max(0, g.boss.hp / g.boss.maxHp);
      this.els.bossFill.style.transform = `scaleX(${r})`;
    } else {
      this.els.bossBar.classList.add("hidden");
    }
  }
}
