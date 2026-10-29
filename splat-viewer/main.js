/**
 * 云逸 · 海岸 — one Big Sur cliff.
 * Still is painted by HTML immediately. The splat loads behind it,
 * then the camera is fitted to the bounds and the still fades out.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const SPLAT_URL = new URL("../assets/splats/coast.sog", import.meta.url).href;
const FAIL_LINE = "立体光景暂不可用，先看这张海岸";

const app = document.getElementById("app");
const canvas = document.getElementById("c");
const statusEl = document.getElementById("status-line");
const barFill = document.getElementById("bar-fill");

const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 500);
camera.position.set(0, 1, 4);

let renderer = null;
let controls = null;
let splatMesh = null;

boot().catch((err) => {
  console.error(err);
  keepStill(FAIL_LINE);
});

async function boot() {
  renderer = createRenderer(canvas);
  if (!renderer) {
    keepStill(FAIL_LINE);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x8ea0ad, 1);
  onResize();

  const scene = new THREE.Scene();
  scene.add(new SparkRenderer({ renderer }));

  controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.7;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  window.addEventListener("resize", onResize);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    keepStill(FAIL_LINE);
  });

  setStatus("光景载入中", 0);
  if (!(await splatAvailable(SPLAT_URL))) {
    keepStill(FAIL_LINE);
    return;
  }

  let stopped = false;
  let lastTick = Date.now();
  const stall = window.setInterval(() => {
    if (Date.now() - lastTick > 60000) {
      window.clearInterval(stall);
      stopped = true;
      keepStill(FAIL_LINE);
    }
  }, 3000);
  const touch = () => {
    lastTick = Date.now();
  };

  splatMesh = new SplatMesh({
    url: SPLAT_URL,
    fileName: "coast.sog",
    onProgress(event) {
      touch();
      const loaded = event.loaded || 0;
      const total = event.total || 0;
      if (stopped) return;
      if (total > 0 && loaded < total) {
        const pct = Math.min(99, Math.round((loaded / total) * 100));
        setStatus(`光景载入 ${pct}%`, loaded / total);
      } else if (loaded > 0) {
        setStatus("正在铺开海岸", 1);
      }
    },
  });
  // OpenCV camera frame → Y-up, applied before the bounds are measured.
  splatMesh.quaternion.set(1, 0, 0, 0);
  scene.add(splatMesh);

  try {
    await splatMesh.initialized;
  } finally {
    window.clearInterval(stall);
  }
  if (stopped) return;
  frameToSplat(splatMesh);
  controls.enabled = true;

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
  renderer.render(scene, camera);
  await nextFrame();
  app.classList.add("is-live");
  app.classList.remove("is-fallback");
  statusEl.textContent = "";
}

async function splatAvailable(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      const length = Number(head.headers.get("content-length")) || 0;
      if (length > 0 && length < 1000000) return false;
      return true;
    }
    const ranged = await fetch(url, { headers: { Range: "bytes=0-0" } });
    return ranged.ok || ranged.status === 206;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

function createRenderer(target) {
  try {
    const gl =
      target.getContext("webgl2", {
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      }) || target.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return null;
    return new THREE.WebGLRenderer({ canvas: target, context: gl, antialias: false, alpha: false });
  } catch (err) {
    console.warn(err);
    return null;
  }
}

function frameToSplat(mesh) {
  mesh.updateMatrixWorld(true);
  // Full corner bounds are exact but expensive on a multi-million-splat coast.
  // Centers still enclose the cliff; a small pad keeps Gaussian edges in frame.
  const heavy = (mesh.numSplats || 0) > 500000;
  const local = mesh.getBoundingBox(heavy);
  if (!isFiniteBox(local)) throw new Error("splat bounds unavailable");

  const world = local.clone().applyMatrix4(mesh.matrixWorld);
  const sphere = world.getBoundingSphere(new THREE.Sphere());
  if (!Number.isFinite(sphere.radius) || sphere.radius < 1e-4) {
    throw new Error("splat bounds degenerate");
  }

  const radius = sphere.radius * (heavy ? 1.12 : 1.04);
  const center = sphere.center;
  const aspect = Math.max(camera.aspect, 0.5);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const dist = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.06;

  // Outside the bounding sphere, slightly above the center, so the default
  // view cannot sit inside the outdoor cloud.
  const view = new THREE.Vector3(0.18, 0.32, 1).normalize();
  camera.position.copy(center).addScaledVector(view, dist);
  camera.near = Math.max(radius / 800, 0.01);
  camera.far = dist + radius * 10;
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  controls.target.copy(center);
  controls.minDistance = Math.max(radius * 0.12, camera.near * 8);
  controls.maxDistance = dist * 4;
  controls.update();
}

function isFiniteBox(box) {
  if (!box) return false;
  const values = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
  return values.every((n) => Number.isFinite(n)) && box.min.x <= box.max.x;
}

function keepStill(line) {
  app.classList.remove("is-live");
  app.classList.add("is-fallback");
  if (controls) controls.enabled = false;
  if (renderer) renderer.setAnimationLoop(null);
  setStatus(line, 0);
}

function setStatus(line, amount) {
  statusEl.textContent = line;
  const clamped = Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 0;
  barFill.style.transform = `scaleX(${clamped})`;
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
  renderer?.setSize(w, h, false);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
