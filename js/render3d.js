/**
 * Camada visual Three.js (baixo-poli) do 1945.
 * Regras ficam no game.js — aqui só desenho 3D + overlay HUD 2D.
 * Canvas #game permanece por cima (mira, toque, textos). #view3d fica atrás.
 */
import * as THREE from "three";
import { W, H } from "./core.js";
import { CanvasRenderer } from "./render.js";

const P_CAP = 72;
const E_CAP = 160;
const SPARK_CAP = 64;
const ENEMY_CAP = 48;
const PICK_CAP = 12;

const PAL3 = {
  tropic: {
    fog: 0x3aa8c8, bg: 0x6ec8f0, sea: 0x1a8ab0, deep: 0x062838,
    hemi: 0xfff6e0, hemiG: 0x0a3048, foam: 0xc8f0f4, island: 0x2a8a58,
    sun: 0xfff4b0, eBullet: 0x2ad0a0,
  },
  overcast: {
    fog: 0x2a3a48, bg: 0x4a5a68, sea: 0x2a4458, deep: 0x152028,
    hemi: 0xc0d0dc, hemiG: 0x1a2830, foam: 0xb0c4cc, island: 0x4a5860,
    sun: 0xd0d8e0, eBullet: 0x7890a8,
  },
  dusk: {
    fog: 0x8a2858, bg: 0xc44860, sea: 0x3a1848, deep: 0x0a0818,
    hemi: 0xffd0a0, hemiG: 0x3a1040, foam: 0xf0d0a0, island: 0x5a3048,
    sun: 0xffb048, eBullet: 0xff6a30,
  },
  storm: {
    fog: 0x152838, bg: 0x0a1018, sea: 0x163040, deep: 0x061018,
    hemi: 0xa0c0d8, hemiG: 0x081018, foam: 0x80c0d0, island: 0x243848,
    sun: 0x8aa8c0, eBullet: 0x50a0ff,
  },
  fortress: {
    fog: 0x1a1428, bg: 0x120c20, sea: 0x1a2838, deep: 0x08060e,
    hemi: 0xe0c8a0, hemiG: 0x100818, foam: 0xd0a070, island: 0x3a3048,
    sun: 0xe0b84a, eBullet: 0xc07020,
  },
};

const KIND_LOOK = {
  vespa: { body: 0xc43a28, wing: 0x8a2820, trim: 0xc9a227, scale: 0.82, z: 3.2 },
  gaviao: { body: 0x8a3030, wing: 0x5a2028, trim: 0xe0b84a, scale: 0.95, z: 3.4 },
  bufalo: { body: 0x6a5030, wing: 0x4a3820, trim: 0xc9a227, scale: 1.42, z: 3.6 },
  artilheiro: { body: 0x4a5c70, wing: 0x334050, trim: 0xd0a070, scale: 1.02, z: 3.1 },
  ninho: { body: 0x3a4a38, wing: 0x2a3828, trim: 0x8a9a48, scale: 1.15, z: 1.2 },
  as: { body: 0xc9a227, wing: 0x8a7018, trim: 0xffe08a, scale: 1.08, z: 3.5 },
  albatroz: { body: 0x6a7888, wing: 0x3a4858, trim: 0xe0b84a, scale: 2.35, z: 5.2 },
  sentinela: { body: 0x5a6870, wing: 0x3a4850, trim: 0xc9a227, scale: 2.2, z: 6.4 },
  serpente: { body: 0x8a5030, wing: 0x5a3020, trim: 0xffb048, scale: 2.45, z: 4.8 },
  tempestade: { body: 0x3a5070, wing: 0x203040, trim: 0x80c0d0, scale: 2.5, z: 5.6 },
  nadir: { body: 0x3a3048, wing: 0x1a1828, trim: 0xe0b84a, scale: 2.8, z: 6.8 },
};

function detectLowEnd() {
  const ua = (navigator.userAgent || "").toLowerCase();
  const mobileUA = /android|iphone|ipad|ipod|mobile|opera mini|iemobile/.test(ua);
  const narrow = window.innerWidth <= 500;
  const dpr = window.devicePixelRatio || 1;
  const touch = "ontouchstart" in window;
  const cores = navigator.hardwareConcurrency || 4;
  return mobileUA || narrow || cores <= 4 || (touch && dpr >= 2 && window.innerWidth <= 900);
}

function gxToX(gx) {
  return gx - W / 2;
}
function gyToY(gy) {
  return H / 2 - gy;
}

function hexOf(color) {
  if (!color) return 0xffc070;
  if (typeof color === "number") return color;
  const s = String(color);
  if (s[0] === "#" && s.length >= 7) return parseInt(s.slice(1, 7), 16);
  if (s[0] === "#" && s.length === 4) {
    const r = s[1], g = s[2], b = s[3];
    return parseInt(r + r + g + g + b + b, 16);
  }
  return 0xffc070;
}

export class ThreeRenderer {
  constructor(boardCanvas, view3d) {
    this.board = boardCanvas;
    this.view = view3d;
    this.hud = new CanvasRenderer(boardCanvas);
    this.ctx = this.hud.ctx;
    this.mode = "webgl";
    this.ok = false;
    this.paletteKey = "tropic";
    this.time = 0;
    this.lastNow = performance.now();
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.camBase = new THREE.Vector3(0, 0, 118);
    this.lookAt = new THREE.Vector3(0, 0, 0);

    this.reducedMotion = false;
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = !!mq.matches;
      if (mq.addEventListener) {
        mq.addEventListener("change", (e) => {
          this.reducedMotion = !!e.matches;
          this.lowFx = this.isLowEnd || this.reducedMotion;
        });
      }
    } catch (_) {}
    this.isLowEnd = detectLowEnd();
    this.lowFx = this.isLowEnd || this.reducedMotion;
    this.boot();
  }

  boot() {
    try {
      if (!THREE || !THREE.WebGLRenderer) throw new Error("no-three");
      if (!this.view) throw new Error("no-view3d");
      this.setup();
      this.fit();
      this.renderer.render(this.scene, this.camera);
      this.ok = true;
    } catch (err) {
      this.ok = false;
      throw err;
    }
  }

  mat(hex, extra = {}) {
    const { emissive = 0x000000, em = 0 } = extra;
    return new THREE.MeshLambertMaterial({
      color: hex,
      emissive,
      emissiveIntensity: em,
      flatShading: true,
    });
  }

  setup() {
    const look = PAL3.tropic;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(look.bg);
    this.scene.fog = new THREE.FogExp2(look.fog, this.isLowEnd ? 0.0048 : 0.0032);

    this.camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 420);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.lookAt);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.view,
      antialias: false,
      alpha: false,
      powerPreference: this.isLowEnd ? "low-power" : "high-performance",
    });
    const dprCap = this.lowFx ? 1 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;

    this.hemi = new THREE.HemisphereLight(look.hemi, look.hemiG, 1.05);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.42);
    this.scene.add(this.amb);
    this.sunL = new THREE.DirectionalLight(0xfff8ee, 1.05);
    this.sunL.position.set(-40, 80, 90);
    this.sunL.castShadow = false;
    this.scene.add(this.sunL);
    this.fill = new THREE.DirectionalLight(0xb8d4ff, 0.35);
    this.fill.position.set(50, -30, 70);
    this.scene.add(this.fill);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.buildTerrain(look);
    this.buildActors();
    this.buildFx();

    this._onResize = () => this.fit();
    window.addEventListener("resize", this._onResize);
    if (typeof ResizeObserver !== "undefined" && this.view?.parentElement) {
      this._ro = new ResizeObserver(() => this.fit());
      this._ro.observe(this.view.parentElement);
    }
  }

  buildTerrain(look) {
    this.seaMat = this.mat(look.sea);
    this.deepMat = this.mat(look.deep);
    this.foamMat = new THREE.MeshBasicMaterial({
      color: look.foam,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.islandMat = this.mat(look.island);
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xf2f6fa,
      transparent: true,
      opacity: 0.42,
      flatShading: true,
      depthWrite: false,
    });

    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(W * 2.4, H * 2.8), this.seaMat);
    this.sea.position.z = -10;
    this.world.add(this.sea);

    this.deep = new THREE.Mesh(new THREE.PlaneGeometry(W * 2.8, H * 3.2), this.deepMat);
    this.deep.position.z = -14;
    this.world.add(this.deep);

    this.foam = [];
    const foamN = this.lowFx ? 6 : 9;
    const foamGeo = new THREE.PlaneGeometry(W * 0.55, 5);
    for (let i = 0; i < foamN; i++) {
      const m = new THREE.Mesh(foamGeo, this.foamMat);
      m.position.z = -9.2;
      this.world.add(m);
      this.foam.push(m);
    }

    this.islands = [];
    const islandN = this.lowFx ? 6 : 10;
    const isleGeo = new THREE.ConeGeometry(16, 10, 5);
    const trunkGeo = new THREE.CylinderGeometry(1.4, 1.8, 8, 5);
    const crownGeo = new THREE.ConeGeometry(6, 9, 5);
    for (let i = 0; i < islandN; i++) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(isleGeo, this.islandMat);
      base.rotation.x = Math.PI / 2;
      base.position.z = 4;
      g.add(base);
      if (!this.lowFx && i % 2 === 0) {
        const trunk = new THREE.Mesh(trunkGeo, this.mat(0x6a4a28));
        trunk.rotation.x = Math.PI / 2;
        trunk.position.set(3, 2, 10);
        g.add(trunk);
        const crown = new THREE.Mesh(crownGeo, this.mat(0x2f8a48));
        crown.rotation.x = Math.PI / 2;
        crown.position.set(3, 2, 16);
        g.add(crown);
      }
      g.userData.seed = i;
      g.userData.x0 = ((i * 97) % W) - W / 2;
      g.userData.y0 = ((i * 173 + 50) % (H + 160)) - 80;
      this.world.add(g);
      this.islands.push(g);
    }

    this.clouds = [];
    const cloudN = this.lowFx ? 5 : 9;
    const cloudGeo = new THREE.SphereGeometry(14, 6, 5);
    for (let i = 0; i < cloudN; i++) {
      const m = new THREE.Mesh(cloudGeo, this.cloudMat);
      m.scale.set(1.6 + (i % 3) * 0.25, 0.7, 0.45);
      m.userData.x0 = ((i * 83) % W) - W / 2;
      m.userData.y0 = ((i * 151) % (H + 200)) - 100;
      m.userData.z0 = 14 + (i % 4) * 3;
      this.world.add(m);
      this.clouds.push(m);
    }

    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(18, 10, 8),
      new THREE.MeshBasicMaterial({ color: look.sun }),
    );
    this.sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(32, 8, 6),
      new THREE.MeshBasicMaterial({
        color: look.sun,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    this.world.add(this.sunMesh);
    this.world.add(this.sunGlow);

    this.spots = [];
    const spotGeo = new THREE.ConeGeometry(22, 220, 8, 1, true);
    const spotMat = new THREE.MeshBasicMaterial({
      color: 0xe0b84a,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(spotGeo, spotMat.clone());
      s.rotation.x = Math.PI;
      s.visible = false;
      this.world.add(s);
      this.spots.push(s);
    }

    this.rain = [];
    if (!this.lowFx) {
      const rainGeo = new THREE.BoxGeometry(0.7, 18, 0.7);
      const rainMat = new THREE.MeshBasicMaterial({
        color: 0xaac8e0,
        transparent: true,
        opacity: 0.28,
      });
      for (let i = 0; i < 28; i++) {
        const r = new THREE.Mesh(rainGeo, rainMat);
        r.visible = false;
        r.userData.i = i;
        this.world.add(r);
        this.rain.push(r);
      }
    }

    this.gridLines = [];
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
    });
    const lineGeo = new THREE.BoxGeometry(1.2, H * 1.4, 0.4);
    for (let i = 0; i < 8; i++) {
      const ln = new THREE.Mesh(lineGeo, lineMat);
      ln.position.z = -8.5;
      ln.visible = false;
      this.world.add(ln);
      this.gridLines.push(ln);
    }
  }

  makePlane(isPlayer) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(8, 26, 5.2),
      this.mat(isPlayer ? 0x6a7c32 : 0xc43a28),
    );
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(36, 6.2, 1.15),
      this.mat(isPlayer ? 0x4a5c28 : 0x8a2820),
    );
    wing.position.y = -1;
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(5.2, 6.2, 1.4), this.mat(0xd4c24a));
    tipL.position.set(-16.5, -1, 0.2);
    const tipR = tipL.clone();
    tipR.position.x = 16.5;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, 1), this.mat(isPlayer ? 0x3a4a20 : 0x6a2020));
    tail.position.y = -12.4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4, 5.5), this.mat(isPlayer ? 0x3a4a20 : 0x6a2020));
    fin.position.set(0, -12, 3.2);
    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 5.5, 2.4),
      this.mat(0x7ec8e8, { emissive: 0x3a88b0, em: 0.35 }),
    );
    cockpit.position.set(0, 4, 3);
    const prop = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.7, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xf0f0dc, transparent: true, opacity: 0.55 }),
    );
    prop.position.y = 14;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 12, 6),
      new THREE.MeshBasicMaterial({ color: 0x9ad4ff, transparent: true, opacity: 0.85 }),
    );
    flame.rotation.x = Math.PI;
    flame.position.y = -18;
    flame.visible = !!isPlayer;

    const mark = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4, 0.6), this.mat(0xb33a2a));
    mark.position.set(0, -2.4, 2.9);

    root.add(body, wing, tipL, tipR, tail, fin, cockpit, prop, flame, mark);
    root.userData = { body, wing, tipL, tipR, tail, fin, cockpit, prop, flame, mark, kind: isPlayer ? "player" : "vespa" };
    return root;
  }

  makeNinho() {
    const root = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 5, 8), this.mat(0x3a4a38));
    pad.rotation.x = Math.PI / 2;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), this.mat(0x4a5c28));
    gun.position.z = 7;
    root.add(pad, gun);
    root.userData = { pad, gun, kind: "ninho" };
    return root;
  }

  makeBoss() {
    const root = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(42, 52, 10), this.mat(0x6a7888));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(88, 14, 2.6), this.mat(0x3a4858));
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 9), this.mat(0xe0b84a, { emissive: 0x8a6010, em: 0.25 }));
    bridge.position.z = 8;
    const nacelleL = new THREE.Mesh(new THREE.BoxGeometry(11, 18, 7), this.mat(0x4a5868));
    nacelleL.position.set(-30, 4, -2);
    const nacelleR = nacelleL.clone();
    nacelleR.position.x = 30;
    root.add(hull, wing, bridge, nacelleL, nacelleR);
    root.userData = { hull, wing, bridge, kind: "boss" };
    return root;
  }

  tintPlane(root, kind) {
    const look = KIND_LOOK[kind] || KIND_LOOK.vespa;
    const ud = root.userData;
    if (ud.body) ud.body.material.color.setHex(look.body);
    if (ud.wing) ud.wing.material.color.setHex(look.wing);
    if (ud.tail) ud.tail.material.color.setHex(look.body);
    if (ud.fin) ud.fin.material.color.setHex(look.wing);
    if (ud.tipL) ud.tipL.material.color.setHex(look.trim);
    if (ud.tipR) ud.tipR.material.color.setHex(look.trim);
    ud.kind = kind;
    const s = look.scale;
    root.scale.setScalar(s);
  }

  tintBoss(root, kind) {
    const look = KIND_LOOK[kind] || KIND_LOOK.albatroz;
    const ud = root.userData;
    if (ud.hull) ud.hull.material.color.setHex(look.body);
    if (ud.wing) ud.wing.material.color.setHex(look.wing);
    if (ud.bridge) ud.bridge.material.color.setHex(look.trim);
    ud.kind = kind;
    root.scale.setScalar(kind === "nadir" ? 1.15 : kind === "serpente" ? 0.92 : 1);
  }

  buildActors() {
    this.playerMesh = this.makePlane(true);
    this.world.add(this.playerMesh);

    this.shieldMesh = new THREE.Mesh(
      new THREE.TorusGeometry(14, 0.7, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x78c8ff, transparent: true, opacity: 0.75 }),
    );
    this.shieldMesh.rotation.x = Math.PI / 2;
    this.shieldMesh.visible = false;
    this.world.add(this.shieldMesh);

    this.planes3 = [];
    for (let i = 0; i < ENEMY_CAP; i++) {
      const m = this.makePlane(false);
      m.visible = false;
      this.world.add(m);
      this.planes3.push(m);
    }
    this.ninhos3 = [];
    for (let i = 0; i < 12; i++) {
      const m = this.makeNinho();
      m.visible = false;
      this.world.add(m);
      this.ninhos3.push(m);
    }
    this.bossMesh = this.makeBoss();
    this.bossMesh.visible = false;
    this.world.add(this.bossMesh);

    this.teleRing = new THREE.Mesh(
      new THREE.TorusGeometry(18, 0.8, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.7 }),
    );
    this.teleRing.rotation.x = Math.PI / 2;
    this.teleRing.visible = false;
    this.world.add(this.teleRing);

    const pGeo = new THREE.CylinderGeometry(1.5, 1.5, 9, 6);
    this.pMat = new THREE.MeshBasicMaterial({ color: 0xfff8d0 });
    this.pBullets = new THREE.InstancedMesh(pGeo, this.pMat, P_CAP);
    this.pBullets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pBullets.frustumCulled = false;
    this.pBullets.count = 0;
    this.world.add(this.pBullets);

    const eGeo = new THREE.SphereGeometry(5.2, 8, 6);
    this.eMat = new THREE.MeshBasicMaterial({ color: 0x2ad0a0 });
    this.eBullets = new THREE.InstancedMesh(eGeo, this.eMat, E_CAP);
    this.eBullets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.eBullets.frustumCulled = false;
    this.eBullets.count = 0;
    this.world.add(this.eBullets);

    this.pickups3 = [];
    const gemGeo = new THREE.OctahedronGeometry(6, 0);
    for (let i = 0; i < PICK_CAP; i++) {
      const m = new THREE.Mesh(
        gemGeo,
        new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }),
      );
      m.visible = false;
      this.world.add(m);
      this.pickups3.push(m);
    }
  }

  buildFx() {
    this.fxGroup = new THREE.Group();
    this.world.add(this.fxGroup);
    this.sparkPool = [];
    const sparkGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const n = this.lowFx ? 28 : SPARK_CAP;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(sparkGeo, mat);
      mesh.visible = false;
      this.fxGroup.add(mesh);
      this.sparkPool.push({ mesh, live: false });
    }

    this.flashPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 1.2, H * 1.2),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.flashPlane.position.z = 20;
    this.world.add(this.flashPlane);
  }

  applyPalette(key) {
    if (key === this.paletteKey) return;
    this.paletteKey = key;
    const look = PAL3[key] || PAL3.tropic;
    this.scene.background.setHex(look.bg);
    this.scene.fog.color.setHex(look.fog);
    this.scene.fog.density = this.isLowEnd
      ? key === "storm"
        ? 0.006
        : 0.0048
      : key === "storm"
        ? 0.0044
        : 0.0032;
    this.seaMat.color.setHex(look.sea);
    this.deepMat.color.setHex(look.deep);
    this.foamMat.color.setHex(look.foam);
    this.islandMat.color.setHex(look.island);
    this.hemi.color.setHex(look.hemi);
    this.hemi.groundColor.setHex(look.hemiG);
    this.sunMesh.material.color.setHex(look.sun);
    this.sunGlow.material.color.setHex(look.sun);
    this.eMat.color.setHex(look.eBullet);
    this.cloudMat.opacity = key === "storm" ? 0.55 : key === "overcast" ? 0.5 : 0.38;
    this.cloudMat.color.setHex(key === "dusk" ? 0xf0a060 : key === "storm" ? 0x4a6070 : 0xf2f6fa);
  }

  fit() {
    if (!this.renderer || !this.view) return;
    const wrap = this.view.parentElement || this.view;
    const w = Math.max(1, wrap.clientWidth || this.view.clientWidth);
    const h = Math.max(1, wrap.clientHeight || this.view.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const gameAspect = W / H;
    let halfW = W / 2;
    let halfH = H / 2;
    if (aspect > gameAspect) {
      halfW = halfH * aspect;
    } else {
      halfH = halfW / aspect;
    }
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  draw(game) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastNow) / 1000 || 0.016);
    this.lastNow = now;
    this.time += dt;

    const key = game.palette() || "tropic";
    this.applyPalette(key);
    const look = PAL3[key] || PAL3.tropic;
    const scroll = game.bgScroll || 0;
    const playing = game.mode !== "title" && game.mode !== "howto";

    this._scrollTerrain(key, scroll, look);
    this._syncPlayer(game, playing);
    this._syncEnemies(game, playing);
    this._syncBullets(game, playing);
    this._syncPickups(game, playing);
    this._syncSparks(game, playing);
    this._camera(game);

    this.renderer.render(this.scene, this.camera);
    this._overlay(game);
  }

  _scrollTerrain(key, scroll, look) {
    for (let i = 0; i < this.foam.length; i++) {
      const yPix = ((i * 72 + scroll * (key === "storm" ? 1.15 : 0.9)) % (H + 72)) - 36;
      const xOff = ((i * 47) % 160) - 80;
      this.foam[i].position.set(xOff, gyToY(yPix), -9.2);
      this.foam[i].material.opacity = key === "tropic" ? 0.16 : key === "fortress" ? 0.06 : 0.1;
    }
    for (const isle of this.islands) {
      const mul = key === "fortress" ? 0.75 : 0.55;
      const yPix = (isle.userData.y0 + scroll * mul) % (H + 170) - 85;
      isle.position.set(isle.userData.x0, gyToY(yPix), -6);
      isle.visible = key !== "storm" || isle.userData.seed < 5;
      isle.scale.setScalar(key === "tropic" ? 1.05 : key === "fortress" ? 1.2 : 1);
    }
    for (const c of this.clouds) {
      if (key === "fortress") {
        c.visible = false;
        continue;
      }
      c.visible = true;
      const spd = key === "storm" ? 1.5 : 1;
      const yPix = (c.userData.y0 + scroll * spd) % (H + 200) - 100;
      c.position.set(c.userData.x0, gyToY(yPix), c.userData.z0);
      c.scale.setScalar(key === "storm" ? 1.8 : 1.2);
    }

    if (key === "tropic") {
      this.sunMesh.visible = true;
      this.sunGlow.visible = true;
      this.sunMesh.position.set(W * 0.28, H * 0.32, 8);
      this.sunGlow.position.copy(this.sunMesh.position);
    } else if (key === "dusk") {
      this.sunMesh.visible = true;
      this.sunGlow.visible = true;
      this.sunMesh.position.set(0, H * 0.08, 6);
      this.sunGlow.position.copy(this.sunMesh.position);
    } else {
      this.sunMesh.visible = false;
      this.sunGlow.visible = false;
    }

    const fortress = key === "fortress";
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      s.visible = fortress;
      if (!fortress) continue;
      const sway = Math.sin(scroll * 0.02) * 45;
      s.position.set(i === 0 ? -70 : 70, -40, 4);
      s.rotation.z = (i === 0 ? 0.18 : -0.18) + sway * 0.002;
    }
    for (let i = 0; i < this.gridLines.length; i++) {
      const ln = this.gridLines[i];
      ln.visible = fortress;
      ln.position.set(-W / 2 + 28 + i * 42, 0, -8.5);
    }
    const rainOn = key === "storm" || key === "overcast";
    for (const r of this.rain) {
      r.visible = rainOn && !this.lowFx;
      if (!r.visible) continue;
      const x = ((r.userData.i * 29 + scroll * (key === "storm" ? 4 : 1.2)) % (W + 30)) - 15 - W / 2;
      r.position.set(x, 0, 16);
      r.rotation.z = key === "storm" ? -0.35 : -0.12;
    }
    void look;
  }

  _syncPlayer(game, playing) {
    const p = game.player;
    const show = playing && p && p.alive;
    this.playerMesh.visible = !!show;
    this.shieldMesh.visible = false;
    if (!show) return;
    const blink = p.invuln > 0 && ((p.invuln * 12) | 0) % 2 === 0 && p.invuln > 0.2;
    this.playerMesh.visible = !blink;
    this.playerMesh.position.set(gxToX(p.x), gyToY(p.y), 6.2);
    this.playerMesh.rotation.z = 0;
    const ud = this.playerMesh.userData;
    if (ud.prop) ud.prop.rotation.z = this.time * 28;
    if (ud.flame) {
      ud.flame.visible = true;
      const fl = 1 + Math.sin(this.time * 28) * 0.25;
      ud.flame.scale.set(1, fl, 1);
    }
    if (p.shield > 0) {
      this.shieldMesh.visible = true;
      this.shieldMesh.position.copy(this.playerMesh.position);
      this.shieldMesh.position.z = 4.4;
      this.shieldMesh.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06);
    }
  }

  _syncEnemies(game, playing) {
    const list = playing ? game.enemies : [];
    let pi = 0;
    let ni = 0;
    let tele = null;
    this.bossMesh.visible = false;
    for (const e of list) {
      if (e.dead) continue;
      if (e.boss) {
        this.bossMesh.visible = true;
        this.tintBoss(this.bossMesh, e.bossId || e.kind);
        this.bossMesh.position.set(gxToX(e.x), gyToY(e.y), KIND_LOOK[e.kind]?.z || 6);
        if (e.telegraph > 0) tele = e;
        continue;
      }
      if (e.kind === "ninho") {
        if (ni >= this.ninhos3.length) continue;
        const m = this.ninhos3[ni++];
        m.visible = true;
        m.position.set(gxToX(e.x), gyToY(e.y), 1.4);
        continue;
      }
      if (pi >= this.planes3.length) continue;
      const m = this.planes3[pi++];
      m.visible = true;
      this.tintPlane(m, e.kind);
      const z = KIND_LOOK[e.kind]?.z || 3.2;
      m.position.set(gxToX(e.x), gyToY(e.y), z);
      m.rotation.z = Math.PI;
      if (m.userData.prop) m.userData.prop.rotation.z = this.time * 22 + (e.phase || 0);
      if (e.flash > 0 && m.userData.body) {
        m.userData.body.material.emissive.setHex(0xfff0c0);
        m.userData.body.material.emissiveIntensity = 0.8;
      } else if (m.userData.body?.material?.emissive) {
        m.userData.body.material.emissive.setHex(0x000000);
        m.userData.body.material.emissiveIntensity = 0;
      }
      if (e.telegraph > 0) tele = e;
    }
    for (let i = pi; i < this.planes3.length; i++) this.planes3[i].visible = false;
    for (let i = ni; i < this.ninhos3.length; i++) this.ninhos3[i].visible = false;

    if (tele) {
      this.teleRing.visible = true;
      const ring = tele.r + 12 + (0.72 - tele.telegraph) * 28;
      this.teleRing.position.set(gxToX(tele.x), gyToY(tele.y), 6);
      this.teleRing.scale.setScalar(Math.max(0.4, ring / 18));
      this.teleRing.material.opacity = 0.45 + Math.sin(this.time * 18) * 0.2;
    } else {
      this.teleRing.visible = false;
    }
  }

  _syncBullets(game, playing) {
    const dummy = this.dummy;
    const pbs = playing ? game.pBullets : [];
    const nP = Math.min(pbs.length, P_CAP);
    this.pBullets.count = nP;
    for (let i = 0; i < nP; i++) {
      const b = pbs[i];
      dummy.position.set(gxToX(b.x), gyToY(b.y), 5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.pBullets.setMatrixAt(i, dummy.matrix);
    }
    this.pBullets.instanceMatrix.needsUpdate = true;

    const ebs = playing ? game.eBullets : [];
    const nE = Math.min(ebs.length, E_CAP);
    this.eBullets.count = nE;
    for (let i = 0; i < nE; i++) {
      const b = ebs[i];
      const s = Math.max(0.7, (b.r || 6) / 5.2);
      dummy.position.set(gxToX(b.x), gyToY(b.y), 5.2);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.eBullets.setMatrixAt(i, dummy.matrix);
    }
    this.eBullets.instanceMatrix.needsUpdate = true;
  }

  _syncPickups(game, playing) {
    const list = playing ? game.pickups : [];
    const colors = {
      shot: 0xffe08a,
      spread: 0x7dce9a,
      rapid: 0x9ad4ff,
      shield: 0x78c8ff,
      bomb: 0xff6a4a,
      medal: 0xe0b84a,
    };
    for (let i = 0; i < this.pickups3.length; i++) {
      const m = this.pickups3[i];
      const u = list[i];
      if (!u) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const bob = Math.sin(u.t * 6) * 2.5;
      m.position.set(gxToX(u.x), gyToY(u.y + bob), 5);
      m.rotation.y = this.time * 2;
      m.rotation.z = this.time * 1.2;
      m.material.color.setHex(colors[u.kind] || 0xffe08a);
    }
  }

  _syncSparks(game, playing) {
    const bits = playing && game.fx ? game.fx.bits : [];
    const cap = this.sparkPool.length;
    const n = Math.min(bits.length, cap);
    for (let i = 0; i < cap; i++) {
      const slot = this.sparkPool[i];
      const p = i < n ? bits[i] : null;
      if (!p) {
        slot.mesh.visible = false;
        continue;
      }
      slot.mesh.visible = true;
      slot.mesh.position.set(gxToX(p.x), gyToY(p.y), 7);
      const a = Math.max(0, p.life / (p.max || 1));
      slot.mesh.material.opacity = a;
      slot.mesh.material.color.setHex(hexOf(p.color));
      const sc = (p.r || 2) * (p.kind === "glow" || p.kind === "ring" ? 0.55 : 0.35);
      slot.mesh.scale.setScalar(Math.max(0.4, sc));
    }
    const flash = game.fx?.flash || 0;
    this.flashPlane.material.opacity = flash * 0.35;
    this.flashPlane.material.color.setHex(game.fx?.hurt > 0 ? 0xc81e14 : 0xfff0c0);
  }

  _camera(game) {
    const shake = this.reducedMotion ? 0 : (game.fx?.shake || 0);
    this.camera.position.set(
      this.camBase.x + (Math.random() - 0.5) * shake * 0.35,
      this.camBase.y + (Math.random() - 0.5) * shake * 0.35,
      this.camBase.z,
    );
    this.camera.lookAt(this.lookAt);
  }

  _overlay(game) {
    const ctx = this.ctx;
    if (!ctx) return;
    const shakeX = this.reducedMotion ? 0 : (Math.random() - 0.5) * (game.fx?.shake || 0);
    const shakeY = this.reducedMotion ? 0 : (Math.random() - 0.5) * (game.fx?.shake || 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(shakeX, shakeY);
    const playing = game.mode !== "title" && game.mode !== "howto";
    if (playing) {
      try { this.hud._pickups(ctx, game); } catch (_) {}
      this._hitbox(ctx, game);
      this._teleLines(ctx, game);
      try {
        if (game.fx?.texts?.length) {
          ctx.font = "800 13px Oswald, Barlow, sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 3;
          for (const t of game.fx.texts) {
            const a = Math.max(0, t.life / t.max);
            ctx.globalAlpha = a;
            ctx.strokeStyle = "#00000088";
            ctx.fillStyle = t.color;
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
          }
          ctx.globalAlpha = 1;
          ctx.textAlign = "left";
        }
      } catch (_) {}
      try { this.hud._combo(ctx, game); } catch (_) {}
      try { this.hud._status(ctx, game); } catch (_) {}
      try { this.hud._banner(ctx, game); } catch (_) {}
    }
    ctx.restore();

    if (game.fx?.flash > 0) {
      const a = game.fx.flash;
      ctx.fillStyle = `rgba(255,240,200,${a * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.fx?.hurt > 0) {
      ctx.fillStyle = `rgba(200,30,20,${game.fx.hurt * 0.32})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.player?.invuln > 0 && game.mode === "playing") {
      const pulse = 0.35 + Math.sin(this.time * 14) * 0.2;
      ctx.strokeStyle = `rgba(180,230,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(game.player.x + shakeX, game.player.y + shakeY, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _hitbox(ctx, game) {
    const p = game.player;
    if (!p || !p.alive) return;
    const x = p.x;
    const y = p.y;
    const core = p.focus ? 5.2 : 3.4;
    ctx.fillStyle = p.focus ? "#fff8e0" : "#ff3d6e";
    ctx.strokeStyle = "#140810";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, core, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (p.focus) {
      ctx.strokeStyle = "rgba(255,244,180,0.9)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _teleLines(ctx, game) {
    for (const e of game.enemies) {
      if (e.dead || e.telegraph <= 0) continue;
      if (e.attack === "aimed" || e.attack === "sweep" || e.attack === "spread") {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.r);
        ctx.lineTo(game.player.x, game.player.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
}
