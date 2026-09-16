/** Constantes e helpers puros — sem DOM. Testável no Node. */

export const W = 360;
export const H = 640;

export const PLAYER_SPEED = 420;
export const FOCUS_SPEED_MUL = 0.42;
export const PLAYER_HIT_R = 7;
export const PLAYER_FIRE = 0.13;
export const PLAYER_FIRE_RAPID = 0.065;
export const INVULN_TIME = 2.05;
export const COMBO_WINDOW = 1.55;
export const START_LIVES = 3;
export const START_BOMBS = 2;
export const MAX_SPREAD = 5;
export const MAX_BOMBS = 9;
export const ENEMY_BULLET_R = 7;
export const BOMB_SCORE = 20;
export const BOMB_DAMAGE = 12;
export const BOMB_COOLDOWN = 1.05;
export const EMPTY_FILL_SEC = 2.4;
export const EXTRA_LIFE_AT = [20000, 50000, 100000, 200000];

export function moveSpeed(focus) {
  return PLAYER_SPEED * (focus ? FOCUS_SPEED_MUL : 1);
}

/** Multiplicador do intervalo entre tiros inimigos (>1 = atira mais devagar). */
export function fireIntervalScale(stageIndex, loop, runT) {
  let s = 1;
  if (loop === 0 && stageIndex === 0) s *= 2.2;
  if (loop === 0 && runT < 90) s *= 1.4;
  if (loop === 0 && runT < 50) s *= 1.2;
  return s;
}

export function vespaFires(stageIndex, loop, phase) {
  if (loop === 0 && stageIndex === 0) return phase % 3 === 0;
  return true;
}

export function softenShot(kind, shot, stageIndex, loop) {
  if (!(loop === 0 && stageIndex === 0)) return shot;
  if (kind === "gaviao" || kind === "as" || kind === "bufalo") return "down";
  return shot;
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

export function len(x, y) {
  return Math.hypot(x, y);
}

export function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function seeded(n) {
  let s = (n | 0) * 16807 % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function scoreKill(base, combo, loop) {
  const c = Math.max(1, combo);
  const mult = 1 + Math.min(8, c - 1) * 0.25 + loop * 0.15;
  return Math.round(base * mult);
}

export function extraLifeEarned(prevScore, nextScore) {
  return EXTRA_LIFE_AT.filter((t) => prevScore < t && nextScore >= t).length;
}

export const PICKUPS = ["shot", "spread", "rapid", "shield", "bomb", "medal"];
export const WEAPON_DROPS = ["shot", "spread", "rapid"];

export const PICKUP_LABEL = {
  shot: "TIRO",
  spread: "LEQUE",
  rapid: "RAJADA",
  shield: "ESCUDO",
  bomb: "BOMBA",
  medal: "MEDALHA",
};

export const STAGE_META = [
  {
    id: 1,
    name: "Mar de Vidro",
    subtitle: "Linhas leves. Aprenda o ritmo.",
    palette: "tropic",
    vibe: "calm",
  },
  {
    id: 2,
    name: "Arquipélago Cinza",
    subtitle: "Fogo do chão. Ninhos e mira.",
    palette: "overcast",
    vibe: "coast",
  },
  {
    id: 3,
    name: "Estreito de Bronze",
    subtitle: "Paredes de Búfalo. Ases no céu.",
    palette: "dusk",
    vibe: "fleet",
  },
  {
    id: 4,
    name: "Cânion de Nuvens",
    subtitle: "Só mergulho. Saia do caminho.",
    palette: "storm",
    vibe: "chaos",
  },
  {
    id: 5,
    name: "Fortaleza do Horizonte",
    subtitle: "Grade de aço. Holofotes. Nadir.",
    palette: "fortress",
    vibe: "steel",
  },
];

export const BOSS_META = {
  albatroz: {
    name: "Albatroz de Ferro",
    subtitle: "Hidroavião pesado. Espere o brilho das asas.",
  },
  sentinela: {
    name: "Sentinela do Recife",
    subtitle: "Torre voadora. As linhas de fogo avisam.",
  },
  serpente: {
    name: "Serpente de Bronze",
    subtitle: "Corpo longo. O anel deixa uma fresta.",
  },
  tempestade: {
    name: "Olho da Tempestade",
    subtitle: "Gira e varre. Saia do feixe dourado.",
  },
  nadir: {
    name: "Couraçado Aéreo Nadir",
    subtitle: "O horizonte fecha. Todas as armas.",
  },
};

export const BOSS_NAMES = Object.fromEntries(
  Object.entries(BOSS_META).map(([id, b]) => [id, b.name])
);
