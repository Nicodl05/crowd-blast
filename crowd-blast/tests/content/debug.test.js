import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDebug,
  createFpsMeter,
  createDebugOverlay,
  hookErrors,
} from '../../src/platform/debug.js';
import { registerServiceWorker } from '../../src/platform/pwa.js';
import {
  makeFakeDoc,
  makeFakeWindow,
  makeFakeClock,
  makeFakeRegistration,
  makeFakeNav,
  makeFakeCaches,
} from './helpers/fakes.js';

const MAIN_JS = new URL('../../src/main.js', import.meta.url);
const SILENT_LOG = { info() {} };
const loc = (href, hostname) => ({ search: new URL(href).search, hostname: hostname ?? new URL(href).hostname });

/** Replaces a global and returns a function that puts the original back (or removes it). */
function setGlobal(name, value) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  return () => {
    if (saved) Object.defineProperty(globalThis, name, saved);
    else delete globalThis[name];
  };
}

/**
 * Fake browser globals for importing main.js under Node. Returns the fake document,
 * a counter of service worker cleanups, and restore().
 */
function installMainEnv(search) {
  const doc = makeFakeDoc();
  const canvas = {
    style: {},
    width: 0,
    height: 0,
    getContext: () => new Proxy({}, {
      get: (_t, key) => (key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
      set: () => true,
    }),
  };
  doc.getElementById = () => canvas;
  const win = makeFakeWindow();
  Object.assign(win, { devicePixelRatio: 1, innerWidth: 360, innerHeight: 640, isSecureContext: true, caches: makeFakeCaches([]) });
  const swCalls = { getRegistrations: 0 };
  const nav = { serviceWorker: { controller: {}, register: async () => ({}), getRegistrations: async () => { swCalls.getRegistrations += 1; return []; } } };
  const restores = [
    setGlobal('document', doc),
    setGlobal('window', win),
    setGlobal('location', { search, hostname: 'localhost', href: `http://localhost/${search}` }),
    setGlobal('navigator', nav),
    setGlobal('requestAnimationFrame', () => 0),
    setGlobal('console', { ...console, warn() {} }),
  ];
  return {
    doc,
    swCalls,
    restore: () => restores.reverse().forEach((restore) => restore()),
  };
}

/** Lets pending dynamic imports of main.js resolve. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('isDebug', () => {
  test('detects the debug key', () => {
    assert.equal(isDebug('?debug'), true);
    assert.equal(isDebug('?a=1&debug'), true);
    assert.equal(isDebug({ search: '?debug' }), true);
  });

  test('ignores other keys and empty queries', () => {
    assert.equal(isDebug('?debugger'), false);
    assert.equal(isDebug(''), false);
    assert.equal(isDebug(undefined), false);
    assert.equal(isDebug({}), false);
  });
});

describe('overlay refresh and DOM', () => {
  test('importing debug.js touches no DOM', async () => {
    const saved = globalThis.document;
    let touched = 0;
    globalThis.document = new Proxy({}, { get() { touched += 1; throw new Error('DOM accessed'); } });
    try {
      await import('../../src/platform/debug.js?probe-no-dom');
    } finally {
      globalThis.document = saved;
    }
    assert.equal(touched, 0);
  });

  test('main.js without ?debug creates no overlay and never touches the service worker', async () => {
    const env = installMainEnv('');
    try {
      await import(`${MAIN_JS.href}?case=no-debug`);
      await settle();
      assert.equal(env.doc.created.length, 0, 'no overlay node');
      assert.equal(env.swCalls.getRegistrations, 0, 'no service worker call');
    } finally {
      env.restore();
    }
  });

  test('main.js with ?debug creates the overlay and cleans up service workers', async () => {
    const env = installMainEnv('?debug');
    try {
      await import(`${MAIN_JS.href}?case=debug`);
      await settle();
      assert.ok(env.doc.created.length >= 1, 'overlay node created');
      assert.equal(env.swCalls.getRegistrations, 1, 'service workers cleaned once');
    } finally {
      env.restore();
    }
  });

  test('no overlay node exists until createDebugOverlay is called', () => {
    const doc = makeFakeDoc();
    assert.equal(doc.created.length, 0);
    assert.equal(doc.body.children.length, 0);
    createDebugOverlay({ doc, now: () => 0 });
    assert.equal(doc.created.length, 1);
    assert.equal(doc.body.children.length, 1);
  });

  test('writes at most 4 times per second with a simulated clock at 60 fps', () => {
    const doc = makeFakeDoc();
    const clock = makeFakeClock();
    const overlay = createDebugOverlay({ doc, now: clock.now });
    const node = overlay.element;
    const writeTimes = [];
    let lastWrites = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      overlay.setFps(60);
      overlay.setStats({ distanceM: frame, crowd: 10, speed: 300 });
      overlay.flush();
      if (node.writes !== lastWrites) {
        lastWrites = node.writes;
        writeTimes.push(clock.now());
      }
      clock.advance(1000 / 60);
    }
    // Any half-open 1 s window [t, t + 1000) holds at most 4 writes.
    for (const start of writeTimes) {
      const inWindow = writeTimes.filter((t) => t >= start && t < start + 1000).length;
      assert.ok(inWindow <= 4, `${inWindow} writes between ${start} and ${start + 1000}`);
    }
    assert.ok(writeTimes.length >= 9, `expected about 10 writes in 10 s, got ${writeTimes.length}`);
  });

  test('text shows FPS, seed, distance, crowd and speed through a single node', () => {
    const doc = makeFakeDoc();
    const clock = makeFakeClock();
    const overlay = createDebugOverlay({ doc, now: clock.now });
    overlay.setFps(59.6);
    overlay.setSeed(4242);
    overlay.setStats({ distanceM: 12.4, crowd: 37, speed: 540 });
    assert.equal(overlay.flush(), true);
    const text = overlay.element.textContent;
    assert.match(text, /FPS 60/);
    assert.match(text, /seed 4242/);
    assert.match(text, /dist 12 m/);
    assert.match(text, /crowd 37/);
    assert.match(text, /speed 540 px\/s/);
    assert.equal(doc.created.length, 1);
    assert.equal(overlay.element.style.color, '#ffffff');
  });

  test('no write when nothing changed', () => {
    const doc = makeFakeDoc();
    const clock = makeFakeClock();
    const overlay = createDebugOverlay({ doc, now: clock.now });
    overlay.flush();
    clock.advance(1000);
    assert.equal(overlay.flush(), false);
    assert.equal(overlay.element.writes, 1);
  });
});

describe('FPS meter', () => {
  test('averages 60 fps over a sliding window of 30 frames', () => {
    const meter = createFpsMeter();
    let t = 0;
    let fps = 0;
    for (let i = 0; i < 40; i += 1) {
      fps = meter.tick(t);
      t += 1000 / 60;
    }
    assert.ok(Math.abs(fps - 60) < 0.01, `fps ${fps}`);
  });

  test('the window slides: 30 frames at 30 fps then 30 at 60 fps reads 60', () => {
    const meter = createFpsMeter({ windowSize: 30 });
    let t = 0;
    for (let i = 0; i < 31; i += 1) {
      meter.tick(t);
      t += 1000 / 30;
    }
    let fps = 0;
    // The first 60 fps delta is the 30 fps -> 60 fps boundary frame, so 31 frames fill the window.
    for (let i = 0; i < 31; i += 1) {
      fps = meter.tick(t);
      t += 1000 / 60;
    }
    assert.ok(Math.abs(fps - 60) < 0.01, `fps ${fps}`);
  });

  test('returns 0 until two frames have been seen', () => {
    assert.equal(createFpsMeter().tick(100), 0);
  });
});

describe('error display', () => {
  test('uncaught errors and rejections turn the overlay red', () => {
    const doc = makeFakeDoc();
    const clock = makeFakeClock();
    const overlay = createDebugOverlay({ doc, now: clock.now });
    const win = makeFakeWindow();
    hookErrors(win, overlay, SILENT_LOG);
    assert.equal(win.listenerCount('error'), 1);
    assert.equal(win.listenerCount('unhandledrejection'), 1);

    win.dispatch('error', { message: 'boom' });
    win.dispatch('unhandledrejection', { reason: new Error('nope') });
    clock.advance(1000);
    overlay.flush();

    assert.equal(overlay.element.style.color, '#ff4d4d');
    assert.match(overlay.element.textContent, /! boom/);
    assert.match(overlay.element.textContent, /! unhandled rejection: nope/);
  });

  test('keeps only the three most recent errors', () => {
    const doc = makeFakeDoc();
    const clock = makeFakeClock();
    const overlay = createDebugOverlay({ doc, now: clock.now });
    const win = makeFakeWindow();
    hookErrors(win, overlay, SILENT_LOG);
    for (const m of ['e1', 'e2', 'e3', 'e4']) win.dispatch('error', { message: m });
    overlay.flush();
    const text = overlay.element.textContent;
    assert.doesNotMatch(text, /e1/);
    assert.match(text, /e4/);
  });
});

describe('registerServiceWorker', () => {
  test('?debug on a secure context: never registers, unregisters workers and clears crowdblast-* caches', async () => {
    const reg = makeFakeRegistration();
    const { nav, calls } = makeFakeNav({ registrations: [reg] });
    const caches = makeFakeCaches(['crowdblast-v1', 'other-app', 'crowdblast-v2']);
    const status = await registerServiceWorker({
      nav,
      loc: loc('https://example.com/?debug'),
      isSecureContext: true,
      caches,
    });
    assert.equal(calls.register.length, 0);
    assert.equal(reg.unregistered, true);
    assert.deepEqual(caches.deleted, ['crowdblast-v1', 'crowdblast-v2']);
    assert.equal(status.status, 'debug');
  });

  test('?debug does not throw without service worker or caches support', async () => {
    const { nav } = makeFakeNav({ serviceWorker: false });
    await assert.doesNotReject(registerServiceWorker({ nav, loc: loc('http://x.test/?debug'), isSecureContext: false, caches: undefined }));
  });

  test('?debug survives a failing unregister', async () => {
    const bad = makeFakeRegistration({ failUnregister: true });
    const good = makeFakeRegistration();
    const { nav } = makeFakeNav({ registrations: [bad, good] });
    await registerServiceWorker({ nav, loc: loc('https://example.com/?debug'), isSecureContext: true, caches: makeFakeCaches([]) });
    assert.equal(good.unregistered, true);
  });

  test('insecure context (http on a LAN address): no register', async () => {
    const { nav, calls } = makeFakeNav();
    const status = await registerServiceWorker({ nav, loc: loc('http://192.168.1.12:8000/'), isSecureContext: false, caches: makeFakeCaches([]) });
    assert.equal(calls.register.length, 0);
    assert.equal(status.status, 'skipped');
  });

  test('http://exemple.com is not secure: no register', async () => {
    const { nav, calls } = makeFakeNav();
    await registerServiceWorker({ nav, loc: loc('http://exemple.com/'), isSecureContext: false });
    assert.equal(calls.register.length, 0);
  });

  test('https://exemple.com: registers the relative sw.js', async () => {
    const { nav, calls } = makeFakeNav({ registerResult: makeFakeRegistration() });
    const status = await registerServiceWorker({ nav, loc: loc('https://exemple.com/app/'), isSecureContext: true });
    assert.deepEqual(calls.register.map((c) => c.url), ['sw.js']);
    assert.equal(status.status, 'registered');
  });

  test('localhost without ?sw: no register', async () => {
    const { nav, calls } = makeFakeNav();
    await registerServiceWorker({ nav, loc: loc('http://localhost/'), isSecureContext: true });
    assert.equal(calls.register.length, 0);
  });

  test('localhost with ?sw: registers', async () => {
    const { nav, calls } = makeFakeNav({ registerResult: makeFakeRegistration() });
    await registerServiceWorker({ nav, loc: loc('http://localhost/?sw'), isSecureContext: true });
    assert.equal(calls.register.length, 1);
  });

  test('never throws: register rejection and missing navigator resolve to an error status', async () => {
    const { nav } = makeFakeNav({ registerResult: new Error('denied') });
    const status = await registerServiceWorker({ nav, loc: loc('https://exemple.com/'), isSecureContext: true });
    assert.equal(status.status, 'error');
    assert.match(status.reason, /denied/);
    await assert.doesNotReject(registerServiceWorker({ nav: undefined, loc: loc('https://exemple.com/'), isSecureContext: true }));
  });

  test('onUpdateReady fires once the new worker is installed over an existing controller', async () => {
    const reg = makeFakeRegistration();
    const { nav } = makeFakeNav({ registerResult: reg });
    const status = await registerServiceWorker({ nav, loc: loc('https://exemple.com/'), isSecureContext: true });
    let ready = 0;
    status.onUpdateReady(() => { ready += 1; });
    const worker = { state: 'installing', listeners: [], addEventListener(t, fn) { this.listeners.push(fn); } };
    reg.installing = worker;
    reg.emit('updatefound');
    worker.state = 'installed';
    worker.listeners.forEach((fn) => fn());
    assert.equal(ready, 1);
  });
});
