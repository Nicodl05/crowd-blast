// Entrées par Pointer Events : le rectangle du canvas est lu une fois par geste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachPointer } from '../../src/engine/input/pointer.js';

function fakeCanvasEnv() {
  const listeners = new Map();
  const doc = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const win = { addEventListener() {}, removeEventListener() {} };
  doc.defaultView = win;
  const canvas = {
    ownerDocument: doc,
    rectCalls: 0,
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    getBoundingClientRect() {
      this.rectCalls++;
      return { left: 0, top: 0, width: 360, height: 640 };
    },
    setPointerCapture() {},
  };
  const fire = (type, e) => listeners.get(type)(e);
  return { canvas, fire };
}

test('pointer : getBoundingClientRect une fois au pointerdown, pas à chaque pointermove', () => {
  const { canvas, fire } = fakeCanvasEnv();
  const xs = [];
  const detach = attachPointer(canvas, {
    onDown: (x) => xs.push(['down', x]),
    onMove: (x) => xs.push(['move', x]),
    onRelease() {},
    onVisibility() {},
  });
  fire('pointerdown', { pointerId: 1, clientX: 36 });
  for (let i = 1; i <= 5; i++) fire('pointermove', { pointerId: 1, clientX: 36 + i * 10 });
  assert.equal(canvas.rectCalls, 1);
  assert.equal(xs.length, 6);
  assert.equal(xs[0][1], 36);
  assert.equal(xs[5][1], 86);
  fire('pointerup', { pointerId: 1, clientX: 86 });
  fire('pointerdown', { pointerId: 2, clientX: 0 });
  assert.equal(canvas.rectCalls, 2, 'nouveau geste, nouvelle lecture');
  detach();
});

test('pointer : un second pointeur est ignoré pendant un geste', () => {
  const { canvas, fire } = fakeCanvasEnv();
  const xs = [];
  const detach = attachPointer(canvas, {
    onDown: (x) => xs.push(x),
    onMove: (x) => xs.push(x),
    onRelease() {},
    onVisibility() {},
  });
  fire('pointerdown', { pointerId: 1, clientX: 100 });
  fire('pointerdown', { pointerId: 2, clientX: 300 });
  fire('pointermove', { pointerId: 2, clientX: 300 });
  assert.deepEqual(xs, [100]);
  detach();
});
