// Debug mode helpers (CON-19). Importing this module touches no DOM.
// The overlay is only created when main.js loads this module, which happens only with ?debug.

const REFRESH_MS = 250; // at most 4 overlay writes per second
const FPS_WINDOW = 30; // frames averaged for the FPS readout
const MAX_ERRORS = 3; // most recent errors kept on screen
const ERROR_COLOR = '#ff4d4d';
const TEXT_COLOR = '#ffffff';
const OVERLAY_STYLE = [
  'position: fixed',
  'top: 0',
  'left: 0',
  'z-index: 9999',
  'pointer-events: none',
  'font: 11px/1.35 monospace',
  'white-space: pre',
  'padding: 4px 6px',
  'background: rgba(0, 0, 0, 0.55)',
  `color: ${TEXT_COLOR}`,
].join(';');

/**
 * True when the query string contains the `debug` key (`?debug`, `?a=1&debug`),
 * false for `?debugger`. Accepts the search string or an object with a `search` property.
 * @param {string | { search?: string } | undefined} loc
 * @returns {boolean}
 */
export function isDebug(loc) {
  const search = typeof loc === 'string' ? loc : (loc && loc.search) || '';
  return new URLSearchParams(search).has('debug');
}

/**
 * Sliding-window FPS meter: average over the last `windowSize` frame intervals.
 * Preallocated ring buffer, no allocation per frame.
 * @param {{ windowSize?: number }} [options]
 */
export function createFpsMeter({ windowSize = FPS_WINDOW } = {}) {
  const deltas = new Float64Array(windowSize);
  let last = -1;
  let count = 0;
  let next = 0;
  let sum = 0;
  return {
    /**
     * Records a frame timestamp in ms (as given by requestAnimationFrame).
     * @param {number} t
     * @returns {number} average FPS over the window (0 until two frames are seen)
     */
    tick(t) {
      if (last >= 0) {
        const delta = t - last;
        if (count === windowSize) sum -= deltas[next];
        else count++;
        deltas[next] = delta;
        sum += delta;
        next = (next + 1) % windowSize;
      }
      last = t;
      return sum > 0 ? (1000 * count) / sum : 0;
    },
  };
}

/**
 * Debug overlay: one fixed <div>, updated through textContent, at most every 250 ms.
 * Call setters freely (they only store values); call flush() once per frame.
 * @param {{ doc: Document, now?: () => number }} options
 */
export function createDebugOverlay({ doc, now = () => performance.now() }) {
  const root = doc.createElement('div');
  root.style.cssText = OVERLAY_STYLE;
  doc.body.appendChild(root);

  const state = { fps: 0, seed: '-', distanceM: 0, crowd: 0, speed: 0 };
  const errors = [];
  let dirty = true;
  let lastWrite = -Infinity;

  function text() {
    const lines = [
      `FPS ${Math.round(state.fps)}`,
      `seed ${state.seed}`,
      `dist ${Math.round(state.distanceM)} m`,
      `crowd ${state.crowd}`,
      `speed ${Math.round(state.speed)} px/s`,
    ];
    for (const message of errors) lines.push(`! ${message}`);
    return lines.join('\n');
  }

  return {
    element: root,
    setFps(fps) {
      state.fps = fps;
      dirty = true;
    },
    /** @param {number | string} seed */
    setSeed(seed) {
      state.seed = String(seed);
      dirty = true;
    },
    /** @param {{ distanceM?: number, crowd?: number, speed?: number }} stats */
    setStats(stats = {}) {
      if (typeof stats.distanceM === 'number') state.distanceM = stats.distanceM;
      if (typeof stats.crowd === 'number') state.crowd = stats.crowd;
      if (typeof stats.speed === 'number') state.speed = stats.speed;
      dirty = true;
    },
    /** @param {string} message */
    setError(message) {
      errors.push(String(message));
      if (errors.length > MAX_ERRORS) errors.shift();
      dirty = true;
    },
    /**
     * Writes the overlay if values changed and the refresh interval has elapsed.
     * @returns {boolean} true when a write happened
     */
    flush() {
      const t = now();
      if (!dirty || t - lastWrite < REFRESH_MS) return false;
      lastWrite = t;
      dirty = false;
      root.textContent = text();
      root.style.color = errors.length ? ERROR_COLOR : TEXT_COLOR;
      return true;
    },
  };
}

/**
 * Shows uncaught errors and unhandled promise rejections in the overlay (red).
 * @param {{ addEventListener: Function }} win
 * @param {{ setError: (m: string) => void }} overlay
 * @param {{ info: Function }} [log]
 */
export function hookErrors(win, overlay, log = console) {
  win.addEventListener('error', (event) => {
    const message = (event && (event.message || (event.error && event.error.message))) || 'error';
    overlay.setError(message);
    log.info('[crowd-blast] uncaught error:', message);
  });
  win.addEventListener('unhandledrejection', (event) => {
    const reason = event && event.reason;
    const message = `unhandled rejection: ${(reason && reason.message) || String(reason)}`;
    overlay.setError(message);
    log.info('[crowd-blast]', message);
  });
}
