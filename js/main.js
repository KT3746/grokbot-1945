import { VERSION } from "./version.js";
import { AudioSys } from "./audio.js";
import { Input } from "./input.js";
import { Game } from "./game.js";
import { createRenderer } from "./renderer.js";
import { UI } from "./ui.js";

const audio = new AudioSys();
const input = new Input();
const game = new Game(audio);
const canvas = document.getElementById("game");
const created = await createRenderer(canvas, {
  failEl: document.getElementById("webgl-fail"),
  view3d: document.getElementById("view3d"),
});
const renderer = created.renderer;
const ui = new UI(game, audio, input);
const touchNav = document.getElementById("touch");

let last = performance.now();
const reducedMotion =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reducedMotion) {
  try { game.fx.reduced = true; } catch (_) {}
}
let lastMode = game.mode;

function releaseTouch() {
  try {
    const pid = input._aim && input._aim.id;
    if (canvas && pid != null && canvas.releasePointerCapture) {
      try { canvas.releasePointerCapture(pid); } catch (_) {}
    }
    input.clearPlay?.();
    input.aimActive = false;
    input.aimDX = 0;
    input.aimDY = 0;
    input._aimLast = null;
    if (input._aim) {
      input._aim.active = false;
      input._aim.id = null;
    }
    if (typeof input._endStick === "function") input._endStick();
    input._fireBtn = false;
    input._bombBtn = false;
    input._focusBtn = false;
    input.focusHeld = false;
    input.aimAbsOn = false;
    input.aimAbsX = null;
    input.aimAbsY = null;
  } catch (_) {}
}

function setOverlayMode(on) {
  document.body.classList.toggle("modal-open", !!on);
  if (touchNav) touchNav.style.visibility = on ? "hidden" : "";
  if (on) releaseTouch();
}

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0, raw));

  input.poll();
  if (input.consumePause()) {
    audio.unlock();
    ui.togglePause();
  }

  if (game.mode !== "playing") {
    input.playLocked = true;
    input.clearPlay();
  } else {
    input.playLocked = false;
  }

  try {
    game.update(dt, input);
  } catch (err) {
    console.error("game.update", err);
  }
  // áudio nunca pode derrubar o frame (senão o avião some)
  if (game.mode === "playing") {
    try {
      audio.update(dt);
      audio.setIntense(game.boss ? 1 : 0);
    } catch (_) {}
  }
  try {
    renderer.draw(game);
  } catch (_) {}

  if (game.mode !== lastMode) {
    const overlay =
      game.mode === "stageclear" ||
      game.mode === "gameover" ||
      game.mode === "paused" ||
      game.mode === "title" ||
      game.mode === "howto";
    setOverlayMode(overlay && game.mode !== "playing");
    if (game.mode === "stageclear" || game.mode === "gameover" || game.mode === "paused") {
      releaseTouch();
      try { audio.ui(); } catch (_) {}
    }
    try {
      ui.onMode();
    } catch (err) {
      console.error("onMode", err);
      // fallback: força tela de vitória se o modo for stageclear
      if (game.mode === "stageclear") {
        const el = document.getElementById("screen-stage");
        if (el) el.classList.remove("hidden");
      }
    }
    lastMode = game.mode;
  }
  try { ui.refresh(); } catch (_) {}

  requestAnimationFrame(frame);
}

window.addEventListener(
  "pointerdown",
  () => {
    audio.unlock();
  },
  { once: false }
);

requestAnimationFrame(frame);

document.title = `1945 · v${VERSION}`;
void VERSION;
