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
  GRAZE_SCORE,
  GRAZE_PAD,
  isGraze,
  stageProgress,
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

test("rasante e progresso de missão", () => {
  assert.ok(GRAZE_SCORE >= 30);
  assert.ok(GRAZE_PAD >= 12);
  assert.equal(isGraze(0, 0, false, 0, 0, 2), false); // hit direto
  assert.equal(isGraze(0, 0, false, 18, 0, 2), true); // anel
  assert.equal(isGraze(0, 0, false, 80, 0, 2), false); // longe
  assert.equal(stageProgress(0, 10, false), 0);
  assert.equal(stageProgress(5, 10, false), 0.5);
  assert.equal(stageProgress(10, 10, false), 1);
  assert.equal(stageProgress(3, 10, true), 1);
});

test("versão 1.15.0 wave-5 e cache-bust alinhados", () => {
  assert.equal(VERSION, "1.15.0");
  assert.match(CACHE_V, /^\d{12}$/);
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "css/styles.css"), "utf8");
  const qs = html.match(/\?v=([0-9]+)/g) || [];
  assert.ok(qs.length >= 3);
  for (const q of qs) assert.equal(q, `?v=${CACHE_V}`);
  assert.match(html, /id="title-ver">v1\.15\.0</);
  assert.match(html, /id="ver"[^>]*>v1\.15\.0</);
  assert.match(html, /type="importmap"/);
  assert.match(html, /js\/vendor\/three\.module\.js/);
  assert.match(html, /id="view3d"/);
  assert.match(html, /id="webgl-fail"/);
  assert.match(css, /\.webgl-fail/);
  assert.match(css, /#game\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(html, /id="hint-bar"/);
  assert.match(css, /\.hint-bar/);
  assert.match(css, /score-pop/);
  assert.match(css, /pause-overlay/);
  assert.match(css, /pause-badge/);
  assert.match(css, /score-combo|combo-hot/);
  assert.match(css, /hp-edge|low-hp/);
  const renderSrc = readFileSync(join(root, "js/render.js"), "utf8");
  assert.match(renderSrc, /_lowHpEdge/);
  assert.match(renderSrc, /ALERTA/);
  const main = readFileSync(join(root, "js/main.js"), "utf8");
  assert.match(main, /visibilitychange/);
  assert.match(main, /document\.hidden/);
  const game = readFileSync(join(root, "js/game.js"), "utf8");
  assert.match(game, /noteFirstAction/);
  assert.match(game, /softHit/);
  const particles = readFileSync(join(root, "js/particles.js"), "utf8");
  assert.match(particles, /softShake/);
  assert.match(particles, /softFlash/);
  assert.match(particles, /comboRing/);
  const ui = readFileSync(join(root, "js/ui.js"), "utf8");
  assert.match(ui, /showOnboardingHint/);
  assert.match(ui, /dismissHint/);
  // wave-2: daily meta, weapon chip, formation telegraph, over polish
  assert.match(html, /id="title-daily"/);
  assert.match(html, /id="title-stages"/);
  assert.match(html, /id="stat-weapon"/);
  assert.match(html, /id="over-daily"/);
  assert.match(html, /id="over-daily-banner"/);
  assert.match(css, /meta-line/);
  assert.match(css, /weapon-flash/);
  assert.match(css, /over-daily-banner/);
  assert.match(game, /_maybeFormTelegraph/);
  assert.match(game, /_onStageCleared/);
  assert.match(game, /STORAGE_DAILY|ceu-de-aco-diario/);
  assert.match(game, /weaponLabel/);
  assert.match(renderSrc, /FORMAÇÃO/);
  assert.match(ui, /title-daily|titleDaily/);
  // wave-4: missão, rasante, escudo/foco
  assert.match(html, /id="mission-bar"/);
  assert.match(html, /id="stat-shield"/);
  assert.match(css, /\.mission-bar/);
  assert.match(css, /focus-on/);
  assert.match(game, /_graze/);
  assert.match(game, /missionProgress/);
  assert.match(particles, /graze\(/);
  assert.match(ui, /missionBar|mission-bar/);
  assert.match(ui, /focus-on|focusBtn/);
  // wave-5: toast, combo chip, dual-thumb, hit flash
  assert.match(html, /id="toast"/);
  assert.match(html, /id="stat-combo"/);
  assert.match(html, /id="stat-combo-wrap"/);
  assert.match(html, /class="touch-left"/);
  assert.match(css, /\.toast/);
  assert.match(css, /stat-combo|combo-timer/);
  assert.match(css, /touch-left/);
  assert.match(css, /hit-flash|hit-chrome/);
  assert.match(game, /pushToast/);
  assert.match(game, /comboTimer/);
  assert.match(game, /hitFlash/);
  assert.match(ui, /toast|comboWrap|hit-flash/);
  const three = readFileSync(join(root, "js/vendor/three.module.js"), "utf8");
  assert.match(three, /REVISION = '160'/);
  assert.equal(html.toLowerCase().includes("capcom"), false);
});

test("falha de WebGL em português e fallback 2D", () => {
  assert.match(FAIL_PT, /Não foi possível iniciar o gráfico 3D/);
  assert.match(FAIL_PT, /2D/);
});
