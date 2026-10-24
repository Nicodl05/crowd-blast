// Rendu d'une frame (scene.js) avec un faux contexte canvas qui enregistre les appels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../../src/engine/render/scene.js';
import { debugSprites } from '../../src/engine/render/debugSprites.js';
import { createState } from '../../src/engine/sim/state.js';

/**
 * Faux contexte : enregistre chaque appel de méthode (nom, arguments).
 * @param {{ throwOn?: string }} [opts] méthode qui lève à chaque appel
 */
function fakeCtx(opts = {}) {
  const rects = [];
  const names = [];
  const target = { fillStyle: '', font: '', textAlign: '', lineWidth: 0, strokeStyle: '', globalAlpha: 1, shadowBlur: 0 };
  const ctx = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => {
        names.push(k);
        if (k === 'fillRect') rects.push(args);
        if (k === opts.throwOn) throw new Error(`${k} boom`);
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx, rects, names };
}

const theme = {
  id: 'test',
  palette: { skyTop: '#123', road: '#333', laneLine: '#ff0', edge: '#000', text: '#fff' },
  hero: { name: 'hero', color: '#0a0', shape: 'hero' },
  ally: { name: 'ally', color: '#0c0', shape: 'ally' },
  bullet: { color: '#fff', glow: '#ff0' },
  enemies: { walker: { name: 'walker', color: '#a00', shape: 'walker' } },
};

function stateWithCrowd(crowd) {
  const s = createState({ seed: 1, tutorialSafeZone: true });
  s.crowd = crowd;
  s.maxCrowd = crowd;
  return s;
}

test('rendu foule = 10 : aucun avertissement, 9 alliés et 1 héros dessinés', () => {
  const warns = [];
  const shapes = [];
  const spy = {
    drawBackground() {},
    draw(_ctx, shape) {
      shapes.push(shape);
    },
  };
  const r = createRenderer(spy, theme, (m, err) => warns.push([m, err]));
  const { ctx } = fakeCtx();
  r.drawFrame(ctx, stateWithCrowd(10), 0, 'soft', false);
  assert.equal(warns.length, 0, 'aucun repli pour une foule de 10');
  assert.equal(shapes.filter((c) => c === 'ally').length, 9);
  assert.equal(shapes.filter((c) => c === 'hero').length, 1);
});

test('rendu foule = 10 avec debugSprites : dessine sans erreur ni avertissement', () => {
  const warns = [];
  const r = createRenderer(debugSprites, theme, (m, err) => warns.push([m, err]));
  const { ctx, rects } = fakeCtx();
  assert.doesNotThrow(() => r.drawFrame(ctx, stateWithCrowd(10), 0, 'soft', false));
  assert.equal(warns.length, 0);
  // Au moins la route, les bords et le héros plus les 9 alliés.
  assert.ok(rects.length >= 10 + 3, `rectangles dessinés : ${rects.length}`);
});

test('fond : un seul remplissage plein écran par frame', () => {
  const r = createRenderer(debugSprites, theme, () => {});
  const { ctx, rects } = fakeCtx();
  r.drawFrame(ctx, stateWithCrowd(1), 0, 'soft', false);
  const full = rects.filter(([x, y, w, h]) => x === 0 && y === 0 && w === 360 && h === 640);
  assert.equal(full.length, 1, `remplissages plein écran : ${full.length}`);
});

test("sprites qui lèvent : un seul avertissement avec l'erreur, puis repli sans exception", () => {
  const warns = [];
  const boom = new Error('draw boom');
  const bad = {
    drawBackground() {},
    draw() {
      throw boom;
    },
  };
  const r = createRenderer(bad, theme, (m, err) => warns.push([m, err]));
  const { ctx } = fakeCtx();
  assert.doesNotThrow(() => r.drawFrame(ctx, stateWithCrowd(5), 0, 'soft', false));
  r.drawFrame(ctx, stateWithCrowd(5), 0, 'soft', false);
  assert.equal(warns.length, 1, 'une seule alerte');
  assert.equal(warns[0][1], boom, "l'erreur est transmise à warn");
});

test("debugSprites qui lève : l'erreur est signalée, pas avalée", () => {
  const warns = [];
  const r = createRenderer(debugSprites, theme, (m, err) => warns.push([m, err]));
  const { ctx } = fakeCtx({ throwOn: 'fillRect' });
  assert.doesNotThrow(() => r.drawFrame(ctx, stateWithCrowd(3), 0, 'soft', false));
  assert.equal(warns.length, 1);
  assert.ok(warns[0][1] instanceof Error);
});
