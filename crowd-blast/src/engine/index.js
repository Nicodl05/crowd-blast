// Point d'entrée du moteur : createEngine(canvas, sprites, hooks). Aucun accès DOM au chargement.
import {
  STEP_S,
  MAX_CATCHUP_STEPS,
  STATS_PER_S,
  DPR_MAX,
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  START_LANE,
} from './balance.js';
import { createState, snapshot, buildResult, laneCenterX, EV_SHOT, EV_KILL, EV_HURT } from './sim/state.js';
import { step } from './sim/step.js';
import { createRenderer } from './render/scene.js';
import { attachPointer } from './input/pointer.js';

const STATS_INTERVAL_S = 1 / STATS_PER_S;

/**
 * Exécute un hook en isolant ses exceptions : la simulation continue.
 * @param {any} hooks
 * @param {string} name
 * @param {(msg: string, err?: any) => void} warnOnce
 * @param {any} [arg]
 */
function callHook(hooks, name, warnOnce, arg) {
  const fn = hooks[name];
  if (typeof fn !== 'function') return;
  try {
    if (arg === undefined) fn.call(hooks);
    else fn.call(hooks, arg);
  } catch (err) {
    warnOnce(`Crowd Blast engine: hook ${name} threw, ignored.`, err);
  }
}

/**
 * @param {any} config
 */
function sanitizeConfig(config) {
  const c = config || {};
  return {
    theme: c.theme || null,
    seed: Number.isFinite(Number(c.seed)) ? Number(c.seed) >>> 0 : 0,
    tutorialSafeZone: c.tutorialSafeZone !== false,
    gore: c.gore === 'normal' ? 'normal' : 'soft',
    colorblind: !!c.colorblind,
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {any} sprites SpriteRenderer (ou null : repli géométrique)
 * @param {any} hooks EngineHooks
 * @returns {import('../contracts.d.ts').GameEngine}
 */
export function createEngine(canvas, sprites, hooks) {
  const hk = hooks || {};
  const doc = canvas.ownerDocument;
  const win = doc && doc.defaultView;
  const ctx = canvas.getContext('2d');
  /** Avertissements déjà émis par cette instance (un par message). */
  const warned = new Set();
  let state = null;
  let renderer = null;
  let gore = 'soft';
  let colorblind = false;
  let paused = false;
  let pausedByVisibility = false;
  let destroyed = false;
  let looping = false;
  /** Vrai pendant les hooks de fin de run : un start() réentrant est différé. */
  let busy = false;
  /** Dernier start() reçu pendant busy : { config } ou null. */
  let queued = null;
  let rafId = 0;
  let lastTs = null;
  let acc = 0;
  let nextStatsS = STATS_INTERVAL_S;

  /** @param {string} msg @param {any} [err] */
  function warnOnce(msg, err) {
    if (warned.has(msg)) return;
    warned.add(msg);
    if (err === undefined) console.warn(msg);
    else console.warn(msg, err);
  }

  if (canvas.style) canvas.style.touchAction = 'none';
  const detachInput = attachPointer(canvas, {
    onDown: (x) => setTarget(x),
    onMove: (x) => setTarget(x),
    onRelease: () => {},
    onVisibility: (hidden) => {
      if (hidden) {
        if (state && !state.finished && !paused) {
          paused = true;
          pausedByVisibility = true;
        }
      } else if (pausedByVisibility) {
        pausedByVisibility = false;
        resume();
      }
    },
  });

  function setTarget(x) {
    if (state && !state.finished && Number.isFinite(x)) state.targetX = x;
  }

  function sizeCanvas() {
    const dpr = Math.min(DPR_MAX, (win && win.devicePixelRatio) || 1);
    const w = Math.round(LOGICAL_WIDTH * dpr);
    const h = Math.round(LOGICAL_HEIGHT * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function renderFrame() {
    if (!ctx || !state || !renderer) return;
    ctx.setTransform(canvas.width / LOGICAL_WIDTH, 0, 0, canvas.height / LOGICAL_HEIGHT, 0, 0);
    renderer.drawFrame(ctx, state, state.timeS, gore, colorblind);
  }

  function drainEvents() {
    const n = state.eventCount;
    for (let i = 0; i < n; i++) {
      const code = state.events[i];
      if (code === EV_SHOT) callHook(hk, 'onSfx', warnOnce, 'shot');
      else if (code === EV_KILL) callHook(hk, 'onSfx', warnOnce, 'kill');
      else if (code === EV_HURT) {
        callHook(hk, 'onSfx', warnOnce, 'hurt');
        callHook(hk, 'onHaptic', warnOnce, 'medium');
      }
    }
    state.eventCount = 0;
  }

  function emitStats() {
    callHook(hk, 'onStats', warnOnce, snapshot(state));
  }

  /** Termine la run une seule fois : stats finales, fin, onRunEnd. */
  function finish() {
    if (!state || state.finished) return;
    state.finished = true;
    looping = false;
    cancelRaf();
    emitStats();
    callHook(hk, 'onSfx', warnOnce, 'run_end');
    callHook(hk, 'onHaptic', warnOnce, 'heavy');
    callHook(hk, 'onRunEnd', warnOnce, buildResult(state));
    renderFrame();
  }

  /**
   * Termine la run courante (si elle ne l'est pas déjà) en marquant la cause.
   * @param {string|null} endedBy null : la cause est déjà posée sur l'état.
   */
  function complete(endedBy) {
    if (!state || state.finished) return;
    if (endedBy) {
      state.ended = true;
      state.endedBy = endedBy;
    }
    busy = true;
    try {
      finish();
    } finally {
      busy = false;
    }
  }

  /** Lance le start() différé pendant une fin de run, si besoin. */
  function flushQueued() {
    if (busy || destroyed || !queued) return;
    const q = queued;
    queued = null;
    begin(q.config);
  }

  function frame(ts) {
    rafId = 0;
    if (destroyed || !looping) return;
    const now = typeof ts === 'number' && Number.isFinite(ts) ? ts : 0;
    let elapsedS = lastTs === null ? 0 : (now - lastTs) / 1000;
    lastTs = now;
    if (!(elapsedS >= 0)) elapsedS = 0;

    if (paused) {
      // Pause : une frame figée, puis plus rien jusqu'à resume() (pas de rAF continu).
      renderFrame();
      return;
    }

    if (state && !state.finished) {
      acc += elapsedS;
      let n = 0;
      while (acc >= STEP_S && n < MAX_CATCHUP_STEPS) {
        step(state);
        acc -= STEP_S;
        n++;
        drainEvents();
        if (state.timeS >= nextStatsS) {
          nextStatsS += STATS_INTERVAL_S;
          if (nextStatsS <= state.timeS) nextStatsS = state.timeS + STATS_INTERVAL_S;
          emitStats();
        }
        if (state.ended) break;
      }
      if (acc >= STEP_S) acc = 0;
      if (state.ended) {
        complete(null);
        flushQueued();
        return;
      }
    }
    renderFrame();
    schedule();
  }

  function schedule() {
    if (!looping || destroyed || rafId || !win || typeof win.requestAnimationFrame !== 'function') return;
    rafId = win.requestAnimationFrame(frame);
  }

  function cancelRaf() {
    if (rafId && win && typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function resume() {
    if (!state || state.finished) return;
    paused = false;
    pausedByVisibility = false;
    lastTs = null;
    acc = 0;
    schedule();
  }

  /** Réinitialise une run (sans fin de run préalable). */
  function begin(config) {
    const cfg = sanitizeConfig(config);
    gore = cfg.gore;
    colorblind = cfg.colorblind;
    renderer = createRenderer(sprites, cfg.theme, warnOnce);
    state = createState({ seed: cfg.seed, tutorialSafeZone: cfg.tutorialSafeZone });
    state.targetX = laneCenterX(START_LANE);
    paused = false;
    pausedByVisibility = false;
    lastTs = null;
    acc = 0;
    nextStatsS = STATS_INTERVAL_S;
    sizeCanvas();
    renderFrame();
    looping = true;
    schedule();
  }

  return {
    start(config) {
      if (destroyed) {
        warnOnce('Crowd Blast engine: start() after destroy() ignored.');
        return;
      }
      if (busy) {
        // Appelé depuis un hook de fin de run : la dernière demande l'emporte, lancée après la fin.
        queued = { config };
        return;
      }
      complete('quit');
      const q = queued;
      queued = null;
      begin(q ? q.config : config);
    },
    pause() {
      if (!state || state.finished) return;
      paused = true;
      pausedByVisibility = false;
    },
    resume() {
      resume();
    },
    quit() {
      complete('quit');
      flushQueued();
    },
    destroy() {
      if (destroyed) return;
      // Posé avant finish() : un start() réentrant (dans onRunEnd) est ignoré, sans second onRunEnd.
      destroyed = true;
      queued = null;
      complete('quit');
      looping = false;
      cancelRaf();
      detachInput();
      state = null;
      renderer = null;
    },
  };
}
