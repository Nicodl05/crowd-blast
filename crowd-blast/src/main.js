// Entry point (CON-1 skeleton). Sizes the canvas letterbox, draws a test frame,
// and loads the optional modules (engine, meta, ui, themes, sprites, audio) when present.
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './constants.js';

const MAX_DPR = 3;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/** Sizes the backing store (logical x dpr) and centers a 9:16 letterbox on screen. */
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const backingW = Math.round(LOGICAL_WIDTH * dpr);
  const backingH = Math.round(LOGICAL_HEIGHT * dpr);
  canvas.width = backingW;
  canvas.height = backingH;
  ctx.setTransform(backingW / LOGICAL_WIDTH, 0, 0, backingH / LOGICAL_HEIGHT, 0, 0);

  const scale = Math.min(window.innerWidth / LOGICAL_WIDTH, window.innerHeight / LOGICAL_HEIGHT);
  const cssW = LOGICAL_WIDTH * scale;
  const cssH = LOGICAL_HEIGHT * scale;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.style.left = `${(window.innerWidth - cssW) / 2}px`;
  canvas.style.top = `${(window.innerHeight - cssH) / 2}px`;

  drawTestFrame();
}

/** Test gradient and title, in logical coordinates. */
function drawTestFrame() {
  const gradient = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  gradient.addColorStop(0, '#1b2a4a');
  gradient.addColorStop(1, '#6b1d1d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Crowd Blast', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
}

/** Records a loaded module, or warns once when it is missing. Never throws. */
const loaded = {};

async function loadOptional(name, load) {
  try {
    loaded[name] = await load();
  } catch (err) {
    console.warn(`[crowd-blast] module absent or failed to load: ${name}/`, err && err.message);
  }
}

function loadOptionalModules() {
  return Promise.all([
    loadOptional('engine', () => import('./engine/index.js')),
    loadOptional('meta', () => import('./meta/index.js')),
    loadOptional('ui', () => import('./ui/index.js')),
    loadOptional('themes', () => import('./themes/index.js')),
    loadOptional('sprites', () => import('./sprites/index.js')),
    loadOptional('audio', () => import('./audio/index.js')),
  ]);
}

window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);

/**
 * Debug mode (?debug): FPS overlay, error display, service worker cleanup.
 * Only this function loads platform/debug.js and platform/pwa.js; without ?debug nothing is fetched.
 */
function startDebug() {
  Promise.all([import('./platform/debug.js'), import('./platform/pwa.js')])
    .then(([debug, pwa]) => {
      pwa.registerServiceWorker({
        nav: navigator,
        loc: location,
        isSecureContext: window.isSecureContext,
        caches: window.caches,
      });
      const overlay = debug.createDebugOverlay({ doc: document, now: () => performance.now() });
      debug.hookErrors(window, overlay);
      const meter = debug.createFpsMeter();
      const frame = (t) => {
        overlay.setFps(meter.tick(t));
        overlay.flush();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    })
    .catch((err) => console.warn('[crowd-blast] debug mode unavailable', err && err.message));
}

layout();
loadOptionalModules();

if (new URLSearchParams(location.search).has('debug')) startDebug();
