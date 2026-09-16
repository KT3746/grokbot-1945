/**
 * Teclado + arraste no playfield (finger-follow) + botões de fogo/bomba.
 * No celular: toque/arraste em qualquer lugar do canvas move o avião
 * seguindo o dedo (offset no primeiro toque, sem teleporte).
 */
export class Input {
  constructor() {
    this.moveX = 0;
    this.moveY = 0;
    this.fireHeld = false;
    this.focusHeld = false;
    this.bombPressed = false;
    this.pausePressed = false;
    this.touchEnabled = false;

    /** Arraste relativo de alta sensibilidade (canvas 360×640). */
    this.aimActive = false;
    this.aimFresh = false;
    this.aimDX = 0;
    this.aimDY = 0;
    this.aimAbsX = null;
    this.aimAbsY = null;
    this.aimAbsOn = false;
    this._aimLast = null;
    /** >1 = dedo anda pouco, avião anda muito */
    this.aimSensitivity = 2.4;

    this._keys = new Set();
    this._stick = { active: false, x: 0, y: 0, id: null };
    this._aim = { active: false, id: null };
    this._fireBtn = false;
    this._bombBtn = false;
    this._focusBtn = false;
    this.playLocked = false;

    window.addEventListener("keydown", (e) => this._down(e), true);
    window.addEventListener("keyup", (e) => this._up(e), true);
    window.addEventListener("contextmenu", (e) => {
      if (e.target && (e.target.id === "game" || e.target.closest(".touch"))) {
        e.preventDefault();
      }
    });
    this._bindTouch();
    this._bindAim();
  }

  _down(e) {
    const block = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
    ];
    if (block.includes(e.code)) e.preventDefault();
    const onChrome =
      e.target &&
      e.target.closest &&
      e.target.closest("#btn-pause, #btn-mute, #btn-fire, #btn-bomb, #btn-focus");
    if (onChrome && (e.code === "Space" || e.code === "Enter")) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!e.repeat) this.pausePressed = true;
    }
    if (this.playLocked) return;
    if (e.repeat) {
      this._keys.add(e.code);
      return;
    }
    this._keys.add(e.code);
    if (e.code === "KeyX") this.bombPressed = true;
  }

  _up(e) {
    this._keys.delete(e.code);
  }

  _canvasFromClient(clientX, clientY) {
    const canvas = document.getElementById("game");
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const x = ((clientX - r.left) / r.width) * canvas.width;
    const y = ((clientY - r.top) / r.height) * canvas.height;
    return { x, y };
  }

  _setAimFromEvent(e, fresh) {
    this.touchEnabled = true;
    this.aimActive = true;
    const canvas = document.getElementById("game");
    let cx = e.clientX;
    let cy = e.clientY;
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      const sx = (canvas.width || 360) / Math.max(1, r.width);
      const sy = (canvas.height || 640) / Math.max(1, r.height);
      cx = (e.clientX - r.left) * sx;
      cy = (e.clientY - r.top) * sy;
      // alvo um pouco acima do dedo pra não tapar o avião
      this.aimAbsX = cx;
      this.aimAbsY = cy - 48;
      this.aimAbsOn = true;
    }
    const p = { x: e.clientX, y: e.clientY };
    if (fresh || !this._aimLast) {
      this._aimLast = { x: p.x, y: p.y };
      this.aimDX = 0;
      this.aimDY = 0;
      this.aimFresh = !!fresh;
      return;
    }
    const s = this.aimSensitivity || 2.4;
    this.aimDX += (p.x - this._aimLast.x) * s;
    this.aimDY += (p.y - this._aimLast.y) * s;
    this._aimLast = { x: p.x, y: p.y };
  }

  _endAim(pointerId) {
    if (pointerId != null && this._aim.id != null && pointerId !== this._aim.id) {
      return;
    }
    this._aim.active = false;
    this._aim.id = null;
    this.aimActive = false;
    this.aimFresh = false;
    this.aimDX = 0;
    this.aimDY = 0;
    this.aimAbsX = null;
    this.aimAbsY = null;
    this.aimAbsOn = false;
    this._aimLast = null;
  }

  _bindAim() {
    const canvas = document.getElementById("game");
    const wrap = document.getElementById("board-wrap");
    const target = canvas || wrap;
    if (!target) return;

    const isUiChrome = (el) =>
      el &&
      el.closest &&
      el.closest("#btn-fire, #btn-bomb, #btn-focus, #stick, #btn-pause, #btn-mute");

    const onDown = (e) => {
      if (this.playLocked) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (isUiChrome(e.target)) return;
      e.preventDefault();
      try {
        target.setPointerCapture(e.pointerId);
      } catch (_) {}
      this._aim.active = true;
      this._aim.id = e.pointerId;
      this._setAimFromEvent(e, true);
    };

    const onMove = (e) => {
      if (!this._aim.active || e.pointerId !== this._aim.id) return;
      e.preventDefault();
      this._setAimFromEvent(e, false);
    };

    const onUp = (e) => {
      if (e.pointerId === this._aim.id) this._endAim(e.pointerId);
    };

    target.addEventListener("pointerdown", onDown);
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
    target.addEventListener("lostpointercapture", () => {
      if (this._aim.active) this._endAim(this._aim.id);
    });
  }

  _bindTouch() {
    const stick = document.getElementById("stick");
    const knob = document.getElementById("stick-knob");
    const fire = document.getElementById("btn-fire");
    const bomb = document.getElementById("btn-bomb");
    const focus = document.getElementById("btn-focus");

    const setFrom = (clientX, clientY) => {
      if (!stick) return;
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const max = r.width * 0.38;
      const len = Math.hypot(dx, dy) || 1;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      const dead = 0.08;
      this._stick.x = Math.abs(dx / max) < dead ? 0 : dx / max;
      this._stick.y = Math.abs(dy / max) < dead ? 0 : dy / max;
      this._syncKnob();
    };

    this._syncKnob = () => {
      if (!knob || !stick) return;
      const max = stick.getBoundingClientRect().width * 0.38;
      knob.style.transform = `translate(${this._stick.x * max}px, ${this._stick.y * max}px)`;
    };

    this._endStick = () => {
      this._stick.active = false;
      this._stick.x = 0;
      this._stick.y = 0;
      this._stick.id = null;
      this._syncKnob();
    };

    if (stick) {
      stick.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        stick.setPointerCapture(e.pointerId);
        this._stick.active = true;
        this._stick.id = e.pointerId;
        this.touchEnabled = true;
        setFrom(e.clientX, e.clientY);
      });
      stick.addEventListener("pointermove", (e) => {
        if (!this._stick.active || e.pointerId !== this._stick.id) return;
        setFrom(e.clientX, e.clientY);
      });
      stick.addEventListener("pointerup", (e) => {
        if (e.pointerId === this._stick.id) this._endStick();
      });
      stick.addEventListener("pointercancel", () => this._endStick());
      stick.addEventListener("lostpointercapture", () => {
        if (this._stick.active) this._endStick();
      });
    }

    window.addEventListener("pointerup", (e) => {
      if (this._stick.active && e.pointerId === this._stick.id) this._endStick();
      if (this._aim.active && e.pointerId === this._aim.id) this._endAim(e.pointerId);
    });
    window.addEventListener("pointercancel", () => {
      if (this._stick.active) this._endStick();
      if (this._aim.active) this._endAim(this._aim.id);
      this._fireBtn = false;
      this._bombBtn = false;
      this._focusBtn = false;
    });

    const hold = (el, setter) => {
      if (!el) return;
      const on = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.touchEnabled = true;
        setter(true);
      };
      const off = () => setter(false);
      el.addEventListener("pointerdown", on);
      el.addEventListener("pointerup", off);
      el.addEventListener("pointercancel", off);
      el.addEventListener("pointerleave", off);
    };

    hold(fire, (v) => {
      this._fireBtn = v;
    });
    hold(focus, (v) => {
      this._focusBtn = v;
    });
    if (bomb) {
      bomb.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.touchEnabled = true;
        this.bombPressed = true;
        this._bombBtn = true;
      });
      bomb.addEventListener("pointerup", () => {
        this._bombBtn = false;
      });
    }
  }

  clearPlay() {
    this.bombPressed = false;
    this.fireHeld = false;
    this._fireBtn = false;
    this._bombBtn = false;
    this.moveX = 0;
    this.moveY = 0;
    this.aimActive = false;
    this.aimFresh = false;
    this.aimDX = 0;
    this.aimDY = 0;
    this._aimLast = null;
    this._aim.active = false;
    this._aim.id = null;
    for (const code of [
      "Space",
      "KeyZ",
      "KeyX",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
    ]) {
      this._keys.delete(code);
    }
    if (typeof this._endStick === "function") this._endStick();
    else {
      this._stick.active = false;
      this._stick.x = 0;
      this._stick.y = 0;
      this._stick.id = null;
    }
  }

  poll() {
    if (!this._stick.active) {
      this._stick.x = 0;
      this._stick.y = 0;
      if (typeof this._syncKnob === "function") this._syncKnob();
    }
    if (this.playLocked) {
      this.moveX = 0;
      this.moveY = 0;
      this.fireHeld = false;
      this.bombPressed = false;
      this.aimActive = false;
      return;
    }
    let x = 0;
    let y = 0;
    if (this._keys.has("ArrowLeft") || this._keys.has("KeyA")) x -= 1;
    if (this._keys.has("ArrowRight") || this._keys.has("KeyD")) x += 1;
    if (this._keys.has("ArrowUp") || this._keys.has("KeyW")) y -= 1;
    if (this._keys.has("ArrowDown") || this._keys.has("KeyS")) y += 1;
    if (this._stick.active) {
      x += this._stick.x;
      y += this._stick.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    this.moveX = x;
    this.moveY = y;
    this.fireHeld =
      this._fireBtn ||
      this._keys.has("Space") ||
      this._keys.has("KeyZ");
    this.focusHeld =
      this._focusBtn ||
      this._keys.has("ShiftLeft") ||
      this._keys.has("ShiftRight") ||
      this._keys.has("KeyC");
  }

  consumeBomb() {
    const v = this.bombPressed;
    this.bombPressed = false;
    return v;
  }

  consumePause() {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }
}
