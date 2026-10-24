// Squelette ENG-1 : RNG, sim pure à pas fixe, cycle de vie du moteur avec faux canvas et faux RAF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../src/engine/sim/rng.js';
import { createState, buildResult } from '../../src/engine/sim/state.js';
import { step } from '../../src/engine/sim/step.js';
import { SPEED_MIN, SPEED_MAX, PX_PER_METER, TUTORIAL_END_M, SPAWN_FIRST_S } from '../../src/engine/balance.js';
import { createEngine } from '../../src/engine/index.js';
import { debugSprites } from '../../src/engine/render/debugSprites.js';

const STEPS_PER_S = 60;
const MAX_SIM_S = 90;

// ---------- RNG ----------

test('createRng(42) : même suite de 20 valeurs dans [0,1[', () => {
  const a = createRng(42);
  const b = createRng(42);
  const va = Array.from({ length: 20 }, () => a());
  const vb = Array.from({ length: 20 }, () => b());
  assert.deepEqual(va, vb);
  for (const v of va) {
    assert.ok(v >= 0 && v < 1, `valeur hors [0,1[ : ${v}`);
  }
});

// ---------- Constantes ----------

test('SPEED_MIN et SPEED_MAX sont finis, exportés, 0 < min < max', () => {
  assert.ok(Number.isFinite(SPEED_MIN) && Number.isFinite(SPEED_MAX));
  assert.ok(SPEED_MIN > 0 && SPEED_MIN < SPEED_MAX);
});

// ---------- Simulation pure ----------

/** Joueur immobile (cible = voie centrale) jusqu'à la fin ou 90 s simulées. */
function runImmobile(seed) {
  const s = createState({ seed, tutorialSafeZone: true });
  const maxSteps = MAX_SIM_S * STEPS_PER_S + 1;
  let n = 0;
  while (!s.ended && n < maxSteps) {
    step(s);
    n++;
  }
  return s;
}

test('joueur immobile 90 s : foule morte, endedBy crowd_dead, avant 90 s, après 300 m', () => {
  const s = runImmobile(42);
  assert.ok(s.ended, 'la run doit se terminer avant la fin de la fenêtre');
  const r = buildResult(s);
  assert.equal(r.endedBy, 'crowd_dead');
  assert.ok(r.durationS < MAX_SIM_S, `mort à ${r.durationS.toFixed(2)} s`);
  assert.ok(r.distanceM > TUTORIAL_END_M, `mort à ${r.distanceM.toFixed(1)} m`);
  assert.ok(Number.isInteger(r.coinsEarned) && r.coinsEarned >= 0);
  assert.ok(r.distanceM > 0);
  console.log(`[skeleton] seed 42 : mort à ${r.distanceM.toFixed(1)} m, ${r.durationS.toFixed(2)} s, ${r.kills} kills`);
});

test('mort déterministe et au-delà de 300 m sur plusieurs seeds', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const r = buildResult(runImmobile(seed));
    assert.equal(r.endedBy, 'crowd_dead', `seed ${seed}`);
    assert.ok(r.durationS < MAX_SIM_S, `seed ${seed} : ${r.durationS} s`);
    assert.ok(r.distanceM > TUTORIAL_END_M, `seed ${seed} : ${r.distanceM} m`);
  }
});

test('même seed deux fois : RunResult identique', () => {
  const a = buildResult(runImmobile(7));
  const b = buildResult(runImmobile(7));
  assert.deepStrictEqual(a, b);
});

test('une run terminée ne se met plus à jour', () => {
  const s = runImmobile(3);
  const before = s.distancePx;
  step(s);
  assert.equal(s.distancePx, before);
});

test('vitesse toujours finie pendant la run', () => {
  const s = createState({ seed: 9, tutorialSafeZone: true });
  for (let i = 0; i < 3000 && !s.ended; i++) {
    step(s);
    assert.ok(Number.isFinite(s.speed));
  }
  assert.ok(s.distancePx / PX_PER_METER > 0);
});

// ---------- Cycle de vie du moteur (faux canvas, faux RAF) ----------

function fakeEnv() {
  const frames = [];
  let nextId = 1;
  const doc = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const win = {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(cb) {
      const id = nextId++;
      frames.push({ id, cb });
      return id;
    },
    cancelAnimationFrame(id) {
      const i = frames.findIndex((f) => f.id === id);
      if (i >= 0) frames.splice(i, 1);
    },
  };
  doc.defaultView = win;
  const ctx = new Proxy(
    {},
    {
      get(t, k) {
        return k in t ? t[k] : () => {};
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    ownerDocument: doc,
    getContext() {
      return ctx;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 360, height: 640 };
    },
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
  };
  let now = 0;
  /** Exécute jusqu'à n frames RAF (ou jusqu'à épuisement). */
  function run(n) {
    for (let i = 0; i < n && frames.length > 0; i++) {
      const f = frames.shift();
      now += 1000 / 60;
      f.cb(now);
    }
  }
  return { canvas, frames, run };
}

const theme = {
  id: 'test',
  palette: { skyTop: '#123', road: '#333', laneLine: '#ff0', edge: '#000', text: '#fff' },
  hero: { name: 'hero', color: '#0a0', shape: 'hero' },
  ally: { name: 'ally', color: '#0c0', shape: 'ally' },
  bullet: { color: '#fff', glow: '#ff0' },
  enemies: { walker: { name: 'walker', color: '#a00', shape: 'walker' } },
};

function recorder() {
  const log = { sfx: [], stats: [], runEnd: [], haptic: [] };
  const hooks = {
    onSfx: (n) => log.sfx.push(n),
    onHaptic: (k) => log.haptic.push(k),
    onStats: (s) => log.stats.push(s),
    onRunEnd: (r) => log.runEnd.push(r),
  };
  return { log, hooks };
}

test('moteur : run complète, onRunEnd une fois, stats au plus 15/s', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const { log, hooks } = recorder();
  const engine = createEngine(env.canvas, debugSprites, hooks);
  engine.start({ theme, seed: 42, tutorialSafeZone: true, gore: 'soft', colorblind: false, weaponId: 'starter', upgrades: {} });
  env.run(MAX_SIM_S * STEPS_PER_S * 2);
  assert.equal(log.runEnd.length, 1, 'onRunEnd exactement une fois');
  const r = log.runEnd[0];
  assert.equal(r.endedBy, 'crowd_dead');
  assert.ok(r.durationS < MAX_SIM_S);
  // au plus 15 stats par seconde simulée, plus une stat finale avant onRunEnd
  assert.ok(log.stats.length <= Math.ceil(r.durationS * 15) + 1, `stats: ${log.stats.length}`);
  assert.ok(log.stats.every((s) => Number.isFinite(s.speed)));
  assert.ok(log.sfx.includes('run_end'));
  // run_end précède onRunEnd : vérifié par l'ordre d'appel, run_end est le dernier sfx
  assert.equal(log.sfx[log.sfx.length - 1], 'run_end');
  engine.destroy();
});

test('moteur : quit idempotent, start relançable, destroy double sans exception', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const { log, hooks } = recorder();
  const engine = createEngine(env.canvas, debugSprites, hooks);
  engine.start({ theme, seed: 5, tutorialSafeZone: true });
  env.run(120);
  engine.quit();
  engine.quit();
  assert.equal(log.runEnd.length, 1);
  assert.equal(log.runEnd[0].endedBy, 'quit');
  // relance juste après onRunEnd, sans destroy
  engine.start({ theme, seed: 5, tutorialSafeZone: true });
  env.run(MAX_SIM_S * STEPS_PER_S * 2);
  assert.equal(log.runEnd.length, 2);
  assert.equal(log.runEnd[1].endedBy, 'crowd_dead');
  engine.destroy();
  engine.destroy();
  assert.equal(env.frames.length, 0, 'plus aucun RAF actif');
});

test('moteur : même seed relancée => RunResult identique', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const { log, hooks } = recorder();
  const engine = createEngine(env.canvas, debugSprites, hooks);
  for (let k = 0; k < 2; k++) {
    engine.start({ theme, seed: 11, tutorialSafeZone: true });
    env.run(MAX_SIM_S * STEPS_PER_S * 2);
  }
  assert.equal(log.runEnd.length, 2);
  assert.deepStrictEqual(log.runEnd[0], log.runEnd[1]);
  engine.destroy();
});

test('moteur : pause fige la distance, resume reprend', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const { log, hooks } = recorder();
  const engine = createEngine(env.canvas, debugSprites, hooks);
  engine.start({ theme, seed: 21, tutorialSafeZone: true });
  env.run(60);
  engine.pause();
  const before = log.stats[log.stats.length - 1].distanceM;
  env.run(600);
  const during = log.stats[log.stats.length - 1].distanceM;
  assert.equal(during, before, 'distance figée en pause');
  engine.resume();
  env.run(60);
  assert.ok(log.stats[log.stats.length - 1].distanceM > before, 'distance repart après resume');
  engine.destroy();
});

test('moteur : sans sprites ni thème valide, repli géométrique sans exception', (t) => {
  const warns = [];
  t.mock.method(console, 'warn', (m) => warns.push(m));
  const env = fakeEnv();
  const { log, hooks } = recorder();
  const engine = createEngine(env.canvas, null, hooks);
  engine.start({ theme: null, seed: 1 });
  env.run(MAX_SIM_S * STEPS_PER_S * 2);
  assert.equal(log.runEnd.length, 1);
  assert.ok(warns.length >= 1);
  engine.destroy();
});

test('moteur : un hook qui lève n\'interrompt pas la run', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const ends = [];
  const engine = createEngine(env.canvas, debugSprites, {
    onSfx() {
      throw new Error('boom');
    },
    onRunEnd(r) {
      ends.push(r);
    },
  });
  engine.start({ theme, seed: 4 });
  env.run(MAX_SIM_S * STEPS_PER_S * 2);
  assert.equal(ends.length, 1);
  engine.destroy();
});

test('moteur : start après destroy est ignoré avec un avertissement', (t) => {
  const warns = [];
  t.mock.method(console, 'warn', (m) => warns.push(m));
  const env = fakeEnv();
  const { log, hooks } = recorder();
  const engine = createEngine(env.canvas, debugSprites, hooks);
  engine.destroy();
  engine.start({ theme, seed: 1 });
  assert.equal(env.frames.length, 0);
  assert.equal(log.runEnd.length, 0);
  assert.ok(warns.length >= 1);
});

test('premier walker à SPAWN_FIRST_S, pas avant', () => {
  const s = createState({ seed: 3, tutorialSafeZone: true });
  assert.equal(s.spawnTimerS, SPAWN_FIRST_S);
  const alive = () => s.walkers.some((w) => w.alive);
  for (let i = 0; i < 40; i++) step(s);
  assert.equal(alive(), false, 'aucun walker avant 0,8 s');
  for (let i = 0; i < 20; i++) step(s);
  assert.equal(alive(), true, 'un walker après 0,8 s');
});

test('moteur : hook qui lève : un seul avertissement par hook, avec l\'erreur', (t) => {
  const warns = [];
  t.mock.method(console, 'warn', (...a) => warns.push(a));
  const env = fakeEnv();
  let calls = 0;
  const engine = createEngine(env.canvas, debugSprites, {
    onSfx() {
      calls++;
      throw new Error('boom');
    },
  });
  engine.start({ theme, seed: 4 });
  env.run(MAX_SIM_S * STEPS_PER_S * 2);
  const sfxWarns = warns.filter((a) => String(a[0]).includes('hook onSfx'));
  assert.ok(calls > 1, `appels du hook : ${calls}`);
  assert.equal(sfxWarns.length, 1);
  assert.ok(sfxWarns[0][1] instanceof Error);
  engine.destroy();
});

test('moteur : pause arrête la boucle rAF, resume la relance', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const { log, hooks } = recorder();
  const engine = createEngine(env.canvas, debugSprites, hooks);
  engine.start({ theme, seed: 21, tutorialSafeZone: true });
  env.run(30);
  engine.pause();
  env.run(1);
  assert.equal(env.frames.length, 0, 'aucune frame planifiée pendant la pause');
  const before = log.stats[log.stats.length - 1].distanceM;
  env.run(600);
  assert.equal(log.stats[log.stats.length - 1].distanceM, before);
  engine.resume();
  assert.equal(env.frames.length, 1, 'resume replanifie la boucle');
  env.run(60);
  assert.ok(log.stats[log.stats.length - 1].distanceM > before);
  engine.destroy();
});

test('moteur : start() depuis onRunEnd (quit) : nouvelle run terminée une fois', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const ends = [];
  const engine = createEngine(env.canvas, debugSprites, {
    onRunEnd(r) {
      ends.push(r);
      if (ends.length === 1) engine.start({ theme, seed: 8, tutorialSafeZone: true });
    },
  });
  engine.start({ theme, seed: 5, tutorialSafeZone: true });
  env.run(120);
  engine.quit();
  assert.equal(ends.length, 1);
  assert.equal(ends[0].endedBy, 'quit');
  env.run(MAX_SIM_S * STEPS_PER_S * 2);
  assert.equal(ends.length, 2, 'la nouvelle run se termine une fois');
  assert.equal(ends[1].endedBy, 'crowd_dead');
  env.run(100);
  assert.equal(ends.length, 2, 'pas de second onRunEnd');
  engine.destroy();
});

test('moteur : start() depuis onRunEnd (mort) : la run suivante va à son terme', (t) => {
  t.mock.method(console, 'warn', () => {});
  const env = fakeEnv();
  const ends = [];
  const engine = createEngine(env.canvas, debugSprites, {
    onRunEnd(r) {
      ends.push(r);
      if (ends.length === 1) engine.start({ theme, seed: 9, tutorialSafeZone: true });
    },
  });
  engine.start({ theme, seed: 6, tutorialSafeZone: true });
  env.run(MAX_SIM_S * STEPS_PER_S * 4);
  assert.equal(ends.length, 2);
  assert.equal(ends[0].endedBy, 'crowd_dead');
  assert.equal(ends[1].endedBy, 'crowd_dead');
  engine.destroy();
});

test('moteur : start() pendant destroy() ignoré, onRunEnd une fois', (t) => {
  const warns = [];
  t.mock.method(console, 'warn', (m) => warns.push(m));
  const env = fakeEnv();
  const ends = [];
  const engine = createEngine(env.canvas, debugSprites, {
    onRunEnd(r) {
      ends.push(r);
      engine.start({ theme, seed: 2, tutorialSafeZone: true });
    },
  });
  engine.start({ theme, seed: 2, tutorialSafeZone: true });
  env.run(60);
  engine.destroy();
  assert.equal(ends.length, 1);
  assert.equal(ends[0].endedBy, 'quit');
  assert.equal(env.frames.length, 0, 'aucun RAF après destroy');
  assert.ok(warns.length >= 1);
});
