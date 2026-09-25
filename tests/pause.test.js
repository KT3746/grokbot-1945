import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../js/game.js";
import { START_BOMBS } from "../js/core.js";

if (typeof globalThis.localStorage === "undefined") {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
}

function silentAudio() {
  const n = () => {};
  return {
    shoot: n,
    enemyShot: n,
    explosion: n,
    bigBoom: n,
    hit: n,
    hurt: n,
    pickup: n,
    ui: n,
    warning: n,
    stage: n,
    gameover: n,
    extraLife: n,
  };
}

function fakeInput(over = {}) {
  return {
    moveX: 0,
    moveY: 0,
    fireHeld: false,
    focusHeld: false,
    _bomb: false,
    cleared: false,
    consumeBomb() {
      const v = this._bomb;
      this._bomb = false;
      return v;
    },
    clearPlay() {
      this.cleared = true;
      this.fireHeld = false;
      this._bomb = false;
      this.moveX = 0;
      this.moveY = 0;
    },
    ...over,
  };
}

test("na pausa não gasta bomba nem dispara tiro na fila", () => {
  const game = new Game(silentAudio());
  game.start(0);
  assert.equal(game.bombs, START_BOMBS);
  const input = fakeInput({ fireHeld: true, _bomb: true });
  game.pause();
  game.update(0.05, input);
  assert.equal(game.mode, "paused");
  assert.equal(game.bombs, START_BOMBS);
  assert.equal(game.pBullets.length, 0);
  assert.equal(input.cleared, true);
  assert.equal(input.fireHeld, false);
  assert.equal(input._bomb, false);
});

test("Continuar com input limpo não solta bomba atrasada", () => {
  const game = new Game(silentAudio());
  game.start(0);
  const input = fakeInput({ fireHeld: true, _bomb: true });
  game.pause();
  game.update(0.016, input);
  input.clearPlay();
  game.resume();
  game.update(0.016, input);
  assert.equal(game.mode, "playing");
  assert.equal(game.bombs, START_BOMBS);
  assert.equal(game.pBullets.length, 0);
});

test("WASD move mesmo com aimActive preso (clique de mouse)", () => {
  const game = new Game(silentAudio());
  game.start(0);
  const x0 = game.player.x;
  const y0 = game.player.y;
  const input = fakeInput({
    moveX: 1,
    moveY: -1,
    aimActive: true,
    aimAbsOn: true,
    aimAbsX: x0,
    aimAbsY: y0,
    _endAim() {
      this.aimActive = false;
      this.aimAbsOn = false;
      this.aimAbsX = null;
      this.aimAbsY = null;
    },
  });
  game.update(0.2, input);
  assert.ok(game.player.x > x0 + 8, "teclado deve ir para a direita");
  assert.ok(game.player.y < y0 - 8, "teclado deve ir para cima");
  assert.equal(input.aimActive, false);
});

test("finger-follow absoluto ainda move sem teclado", () => {
  const game = new Game(silentAudio());
  game.start(0);
  const x0 = game.player.x;
  const input = fakeInput({
    moveX: 0,
    moveY: 0,
    aimActive: true,
    aimAbsOn: true,
    aimAbsX: x0 + 90,
    aimAbsY: game.player.y,
  });
  game.update(0.25, input);
  assert.ok(game.player.x > x0 + 20, "dedo deve puxar o avião");
});

test("intro do estágio 1 dá um pouco mais de invuln", () => {
  const game = new Game(silentAudio());
  game.start(0);
  assert.ok(game.player.invuln >= 2.8);
  assert.ok(game.introT >= 2.8);
});
