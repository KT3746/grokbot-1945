/**
 * Dual-path: tenta Three.js/WebGL; se falhar, usa o Canvas 2D clássico.
 * O jogo nunca fica travado sem renderer. HUD/toque continuam no HTML.
 */
import { CACHE_V } from "./version.js";
import { CanvasRenderer } from "./render.js";

export const FAIL_PT =
  "Não foi possível iniciar o gráfico 3D. O 1945 continua no visual clássico (2D).";

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

function showFail(el, msg) {
  if (!el) return;
  el.hidden = false;
  el.removeAttribute("hidden");
  el.textContent = msg;
  window.setTimeout(() => {
    if (el && el.textContent === msg) {
      el.hidden = true;
      el.setAttribute("hidden", "");
    }
  }, 8000);
}

function useCanvas(canvas, view3d, failEl, msg) {
  if (msg) showFail(failEl, msg);
  document.body.classList.add("renderer-canvas");
  document.body.classList.remove("renderer-webgl");
  if (view3d) {
    view3d.hidden = true;
    view3d.setAttribute("hidden", "");
  }
  return { renderer: new CanvasRenderer(canvas), canvas, mode: "canvas2d" };
}

export async function createRenderer(boardCanvas, { failEl, view3d } = {}) {
  void CACHE_V;
  if (!webglAvailable()) {
    return useCanvas(boardCanvas, view3d, failEl, FAIL_PT);
  }

  try {
    const { ThreeRenderer } = await import("./render3d.js");
    const renderer = new ThreeRenderer(boardCanvas, view3d);
    if (!renderer.ok) throw new Error("three-init-failed");
    document.body.classList.add("renderer-webgl");
    document.body.classList.remove("renderer-canvas");
    if (view3d) {
      view3d.hidden = false;
      view3d.removeAttribute("hidden");
    }
    return { renderer, canvas: boardCanvas, mode: "webgl" };
  } catch (err) {
    console.warn("1945 3D:", err);
    return useCanvas(boardCanvas, view3d, failEl, FAIL_PT);
  }
}
