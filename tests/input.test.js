import { test } from "node:test";
import assert from "node:assert/strict";
import { isFingerPointer, Input } from "../js/input.js";

test("só toque e caneta são finger-follow", () => {
  assert.equal(isFingerPointer("touch"), true);
  assert.equal(isFingerPointer("pen"), true);
  assert.equal(isFingerPointer("mouse"), false);
  assert.equal(isFingerPointer(""), false);
  assert.equal(isFingerPointer(undefined), false);
});

function installAimDom() {
  const canvasListeners = {};
  const canvas = {
    id: "game",
    width: 360,
    height: 640,
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 360, height: 640 };
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    addEventListener(type, fn) {
      (canvasListeners[type] ||= []).push(fn);
    },
    dispatch(type, ev) {
      for (const fn of canvasListeners[type] || []) fn(ev);
    },
  };
  globalThis.window = {
    addEventListener() {},
  };
  globalThis.document = {
    getElementById(id) {
      if (id === "game" || id === "board-wrap") return canvas;
      return null;
    },
  };
  return canvas;
}

function pointerEvent(over) {
  return {
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
    clientX: 180,
    clientY: 400,
    target: { closest: () => null },
    preventDefault() {},
    ...over,
  };
}

test("clique de mouse no canvas não liga aim nem touchEnabled", () => {
  const canvas = installAimDom();
  const input = new Input();
  canvas.dispatch("pointerdown", pointerEvent({ pointerType: "mouse" }));
  assert.equal(input.aimActive, false);
  assert.equal(input.aimAbsOn, false);
  assert.equal(input.touchEnabled, false);
});

test("toque no canvas liga finger-follow absoluto", () => {
  const canvas = installAimDom();
  const input = new Input();
  canvas.dispatch(
    "pointerdown",
    pointerEvent({ pointerType: "touch", pointerId: 7, clientX: 200, clientY: 300 })
  );
  assert.equal(input.aimActive, true);
  assert.equal(input.aimAbsOn, true);
  assert.equal(input.touchEnabled, true);
  assert.equal(input.aimAbsX, 200);
  assert.equal(input.aimAbsY, 252);
  canvas.dispatch("pointerup", pointerEvent({ pointerType: "touch", pointerId: 7 }));
  assert.equal(input.aimActive, false);
  assert.equal(input.aimAbsOn, false);
});
