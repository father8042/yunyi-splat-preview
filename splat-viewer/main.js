/**
 * 云逸 · splat-viewer — Spark + Three.js r180 scaffold
 * Query: ?splat=<rel-path>  ?stage=mountain|meadow|ocean
 */
import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const STAGE_META = {
  mountain: {
    kicker: "STAGE · 雪峰",
    title: "山脊之上",
    sub: "暂用海岸悬崖 splat 占位；雪峰素材将另行购买或拍摄。",
    cam: { pos: new THREE.Vector3(2.4, 1.1, 4.2), look: new THREE.Vector3(0, 0.2, 0) },
    assets: [
      "../assets/splats/mountain.sog",
      "../assets/splats/mountain.spz",
      "../assets/splats/mountain.splat",
      "../assets/splats/mountain.ply",
      "../assets/splats/coast.sog",
      "../assets/splats/coast.spz",
      "../assets/splats/coast.ply",
    ],
  },
  meadow: {
    kicker: "STAGE · 草甸",
    title: "风过草场",
    sub: "花园/草地林木现成 splat 占位；正式高山草甸可后补。",
    cam: { pos: new THREE.Vector3(-1.8, 0.95, 3.6), look: new THREE.Vector3(0.1, 0.15, -0.2) },
    assets: [
      "../assets/splats/meadow.ply",
      "../assets/splats/meadow.spz",
      "../assets/splats/meadow.splat",
      "../assets/splats/meadow.sog",
      "../assets/splats/forest.ply",
    ],
  },
  ocean: {
    kicker: "STAGE · 海际",
    title: "潮声渐近",
    sub: "瀑布/海岸现成 splat 占位。动浪不适合静态 3DGS，正式海际优先礁岸。",
    cam: { pos: new THREE.Vector3(0.6, 0.75, 5.0), look: new THREE.Vector3(0, 0.05, 0) },
    assets: [
      "../assets/splats/waterfall.sog",
      "../assets/splats/ocean.spz",
      "../assets/splats/ocean.splat",
      "../assets/splats/ocean.ply",
      "../assets/splats/coast.sog",
      "../assets/splats/ocean-waterfall.sog",
    ],
  },
};

const FALLBACKS = [
  "../assets/splats/coast.sog",
  "../assets/splats/coast.spz",
  "../assets/splats/coast.splat",
  "../assets/splats/coast.ply",
  "../assets/splats/forest.ply",
  "../assets/splats/forest.spz",
  "../assets/splats/forest.splat",
  "../assets/splats/meadow.ply",
  "../assets/splats/meadow.spz",
  "../assets/splats/meadow.splat",
  "../assets/splats/ocean.ply",
  "../assets/splats/ocean.spz",
  "../assets/splats/ocean.splat",
  "../assets/splats/waterfall.sog",
  "../assets/splats/waterfall.spz",
  "../assets/splats/waterfall.ply",
  "../assets/splats/mountain.spz",
  "../assets/splats/mountain.splat",
  "../assets/splats/mountain.ply",
  "../samples/B-splat/assets/train.splat",
  "../samples/B-splat/assets/nike.splat",
];

const params = new URLSearchParams(location.search);
const stageKey = normalizeStage(params.get("stage"));
const splatOverride = params.get("splat");

const statusEl = document.getElementById("status");
const statusDetail = document.getElementById("status-detail");
const kickerEl = document.getElementById("stage-kicker");
const titleEl = document.getElementById("stage-title");
const subEl = document.getElementById("stage-sub");

applyStageCopy(stageKey);
highlightStage(stageKey);

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x0a0c10, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.01,
  2000
);

const spark = new SparkRenderer({ renderer });
scene.add(spark);

let currentStage = stageKey;
let scrollProgress = stageProgress(stageKey);
let targetProgress = scrollProgress;
let orbitT = 0;
let splatMesh = null;
let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", (e) => {
    reduceMotion = e.matches;
  });

wireStageControls();
wireScroll();

window.addEventListener("resize", onResize);

setStatus("载入光景", "正在解析 splat 路径…");
boot().catch((err) => {
  console.error(err);
  document.getElementById("app")?.classList.add("error");
  setStatus("无法载入", err?.message || String(err));
});

async function boot() {
  const url = await resolveSplatUrl(splatOverride, currentStage);
  setStatus("载入光景", shorten(url));
  await loadSplat(url);
  applyCamera(currentStage, scrollProgress, true);
  hideStatus();
  renderer.setAnimationLoop(animate);
}

async function resolveSplatUrl(override, stage) {
  if (override) {
    const ok = await headOk(override);
    if (ok) return override;
    throw new Error(`指定路径不可用：${override}`);
  }
  const candidates = [
    ...(STAGE_META[stage]?.assets || []),
    ...FALLBACKS,
  ];
  const seen = new Set();
  for (const path of candidates) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (await headOk(path)) return path;
  }
  throw new Error("未找到可用 splat（assets/splats 与 samples 均缺失）");
}

async function headOk(path) {
  try {
    const res = await fetch(path, { method: "HEAD", cache: "no-cache" });
    if (res.ok) return true;
    // Some static servers dislike HEAD — try ranged GET
    const get = await fetch(path, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-cache",
    });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

async function loadSplat(url) {
  if (splatMesh) {
    scene.remove(splatMesh);
    splatMesh = null;
  }
  const mesh = new SplatMesh({ url });
  // Common SPZ/PLY orientation fix used in Spark getting started
  mesh.quaternion.set(1, 0, 0, 0);
  scene.add(mesh);
  splatMesh = mesh;

  // Wait briefly for async decode; Spark loads in background
  await waitFrames(2);
  // If the mesh exposes a promise-like ready, prefer it
  if (mesh.initialized) {
    try {
      await mesh.initialized;
    } catch (_) {
      /* ignore */
    }
  } else if (typeof mesh.onFrame === "undefined") {
    await sleep(800);
  } else {
    await sleep(600);
  }
}

function animate(time) {
  const dt = Math.min(0.05, 0.016);
  scrollProgress += (targetProgress - scrollProgress) * (reduceMotion ? 1 : 0.08);

  if (!reduceMotion) orbitT += dt * 0.15;

  applyCamera(currentStage, scrollProgress, false);

  // Gentle idle yaw around bookmark — keeps scaffold alive before real scroll polish
  if (splatMesh && !reduceMotion) {
    splatMesh.rotation.y = Math.sin(orbitT) * 0.08;
  }

  renderer.render(scene, camera);
}

function applyCamera(stage, progress, snap) {
  const keys = ["mountain", "meadow", "ocean"];
  const i0 = Math.min(2, Math.floor(progress * 2.999));
  const i1 = Math.min(2, i0 + 1);
  const local = progress * 2 - i0;
  const a = STAGE_META[keys[i0]].cam;
  const b = STAGE_META[keys[i1]].cam;
  const t = snap ? (stage === "mountain" ? 0 : stage === "meadow" ? 0.5 : 1) : smoothstep(local);

  const pos = new THREE.Vector3().lerpVectors(a.pos, b.pos, t);
  const look = new THREE.Vector3().lerpVectors(a.look, b.look, t);

  // Mild orbit offset in XZ
  const radiusBoost = 0.15 * Math.sin(orbitT);
  pos.x += radiusBoost;
  pos.z += radiusBoost * 0.4;

  camera.position.copy(pos);
  camera.lookAt(look);
}

function wireScroll() {
  let acc = stageProgress(currentStage);
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      acc = clamp01(acc + e.deltaY * 0.00045);
      targetProgress = acc;
      syncStageFromProgress(acc);
    },
    { passive: false }
  );

  let touchY = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchY == null) return;
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      acc = clamp01(acc + dy * 0.0015);
      targetProgress = acc;
      syncStageFromProgress(acc);
    },
    { passive: true }
  );
}

function wireStageControls() {
  document.querySelectorAll(".stage-pills button, .hud-nav a").forEach((el) => {
    el.addEventListener("click", (e) => {
      const stage = el.getAttribute("data-stage");
      if (!stage) return;
      if (el.tagName === "A") {
        // allow default navigation with query, but also update in-place if same page
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          const url = new URL(location.href);
          url.searchParams.set("stage", stage);
          history.replaceState({}, "", url);
        }
      }
      setStage(stage);
    });
  });
}

function setStage(stage) {
  currentStage = normalizeStage(stage);
  targetProgress = stageProgress(currentStage);
  applyStageCopy(currentStage);
  highlightStage(currentStage);
}

function syncStageFromProgress(p) {
  const stage = p < 0.33 ? "mountain" : p < 0.66 ? "meadow" : "ocean";
  if (stage !== currentStage) {
    currentStage = stage;
    applyStageCopy(stage);
    highlightStage(stage);
    const url = new URL(location.href);
    url.searchParams.set("stage", stage);
    history.replaceState({}, "", url);
  }
}

function applyStageCopy(stage) {
  const m = STAGE_META[stage] || STAGE_META.mountain;
  kickerEl.textContent = m.kicker;
  titleEl.textContent = m.title;
  subEl.textContent = m.sub;
}

function highlightStage(stage) {
  document.querySelectorAll("[data-stage]").forEach((el) => {
    el.classList.toggle("is-active", el.getAttribute("data-stage") === stage);
  });
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function normalizeStage(s) {
  if (s === "meadow" || s === "ocean" || s === "mountain") return s;
  return "mountain";
}

function stageProgress(stage) {
  if (stage === "meadow") return 0.5;
  if (stage === "ocean") return 1;
  return 0;
}

function setStatus(label, detail) {
  statusEl.classList.remove("hidden");
  statusEl.querySelector(".label").textContent = label;
  statusDetail.textContent = detail || "";
}

function hideStatus() {
  statusEl.classList.add("hidden");
}

function shorten(u) {
  try {
    return decodeURIComponent(u).replace(/^\.\.\//, "");
  } catch {
    return u;
  }
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitFrames(n) {
  return new Promise((resolve) => {
    let left = n;
    function tick() {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
