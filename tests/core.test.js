import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  clamp,
  circleHit,
  scoreKill,
  extraLifeEarned,
  lerp,
  fireIntervalScale,
  vespaFires,
  softenShot,
  moveSpeed,
  PLAYER_SPEED,
  START_BOMBS,
  BOMB_SCORE,
  BOMB_DAMAGE,
  ENEMY_BULLET_R,
  EMPTY_FILL_SEC,
  PICKUP_LABEL,
  BOSS_META,
  BOSS_NAMES,
  STAGE_META,
} from "../js/core.js";
import { VERSION, CACHE_V } from "../js/version.js";
import { FAIL_PT } from "../js/renderer.js";
import { STAGES } from "../js/stages.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("clamp limita o valor", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-2, 0, 3), 0);
  assert.equal(clamp(1, 0, 3), 1);
});

test("colisão circular justa", () => {
  assert.equal(circleHit(0, 0, 5, 8, 0, 4), true);
  assert.equal(circleHit(0, 0, 5, 20, 0, 4), false);
});

test("combo aumenta a pontuação", () => {
  const a = scoreKill(100, 1, 0);
  const b = scoreKill(100, 5, 0);
  assert.ok(b > a);
});

test("vida extra nos marcos", () => {
  assert.equal(extraLifeEarned(19999, 20000), 1);
  assert.equal(extraLifeEarned(0, 100), 0);
});

test("lerp interpola", () => {
  assert.equal(lerp(0, 10, 0.5), 5);
});

test("começo do jogo atira bem mais devagar", () => {
  const early = fireIntervalScale(0, 0, 10);
  const late = fireIntervalScale(3, 0, 200);
  assert.ok(early > 2.5);
  assert.ok(late === 1);
  assert.ok(early > fireIntervalScale(1, 0, 80));
});

test("vespas do estágio 1 quase não atiram", () => {
  assert.equal(vespaFires(0, 0, 0), true);
  assert.equal(vespaFires(0, 0, 1), false);
  assert.equal(vespaFires(0, 0, 2), false);
  assert.equal(vespaFires(2, 0, 1), true);
});

test("tiros mirados viram tiro reto no Mar de Vidro", () => {
  assert.equal(softenShot("gaviao", "aim", 0, 0), "down");
  assert.equal(softenShot("bufalo", "spread", 0, 0), "down");
  assert.equal(softenShot("gaviao", "aim", 2, 0), "aim");
});

test("chefes têm nome e subtítulo próprios", () => {
  const stageSubs = new Set(STAGE_META.map((s) => s.subtitle));
  for (const id of Object.keys(BOSS_NAMES)) {
    assert.ok(BOSS_META[id].name);
    assert.ok(BOSS_META[id].subtitle.length > 8);
    assert.equal(BOSS_META[id].name, BOSS_NAMES[id]);
    assert.equal(stageSubs.has(BOSS_META[id].subtitle), false);
  }
});

test("jogador mais rápido, foco mais lento", () => {
  assert.ok(PLAYER_SPEED >= 320);
  assert.equal(moveSpeed(false), PLAYER_SPEED);
  assert.ok(moveSpeed(true) < moveSpeed(false) * 0.5);
});

test("bomba começa em 2 e não farm de pontos", () => {
  assert.equal(START_BOMBS, 2);
  assert.equal(BOMB_SCORE, 20);
  assert.ok(BOMB_DAMAGE <= 14);
});

test("tiro inimigo grande o bastante para contrastar", () => {
  assert.ok(ENEMY_BULLET_R >= 6);
});

test("bônus de tiro tem nome legível", () => {
  assert.equal(PICKUP_LABEL.shot, "TIRO");
});

test("estágio 1 sem buraco longo entre ondas", () => {
  const ats = STAGES[0].waves.map((w) => w.at);
  for (let i = 1; i < ats.length; i++) {
    assert.ok(ats[i] - ats[i - 1] <= 4.2, `vão ${ats[i - 1]} → ${ats[i]}`);
  }
  assert.ok(EMPTY_FILL_SEC <= 3.2);
});

test("versão 1.11.0 e cache-bust alinhados", () => {
  assert.equal(VERSION, "1.11.0");
  assert.match(CACHE_V, /^20260924\d{4}$/);
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "css/styles.css"), "utf8");
  const qs = html.match(/\?v=([0-9]+)/g) || [];
  assert.ok(qs.length >= 3);
  for (const q of qs) assert.equal(q, `?v=${CACHE_V}`);
  assert.match(html, /id="title-ver">v1\.11\.0</);
  assert.match(html, /id="ver"[^>]*>v1\.11\.0</);
  assert.match(html, /type="importmap"/);
  assert.match(html, /js\/vendor\/three\.module\.js/);
  assert.match(html, /id="view3d"/);
  assert.match(html, /id="webgl-fail"/);
  assert.match(css, /\.webgl-fail/);
  const three = readFileSync(join(root, "js/vendor/three.module.js"), "utf8");
  assert.match(three, /REVISION = '160'/);
  assert.equal(html.toLowerCase().includes("capcom"), false);
});

test("falha de WebGL em português e fallback 2D", () => {
  assert.match(FAIL_PT, /Não foi possível iniciar o gráfico 3D/);
  assert.match(FAIL_PT, /2D/);
});
