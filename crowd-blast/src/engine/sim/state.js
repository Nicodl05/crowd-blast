// État d'une run (pur). Pools pré-alloués à la création ; aucune allocation pendant step().
import {
  LANE_WIDTH,
  START_LANE,
  CROWD_START,
  BULLET_POOL,
  WALKER_POOL,
  TUTORIAL_END_M,
  TUTORIAL_FLOOR,
  HERO_FLASH_S,
  SPAWN_FIRST_S,
} from '../balance.js';
import { createRng } from './rng.js';
import { computeCoinsEarned, speedForDistance } from './economy.js';

/** Codes d'événements écrits par step() dans state.events (drainés par index.js). */
export const EV_SHOT = 1;
export const EV_KILL = 2;
export const EV_HURT = 3;
const EVENT_CAP = 64;

/** @param {number} lane @returns {number} x du centre de la voie */
export function laneCenterX(lane) {
  return (lane + 0.5) * LANE_WIDTH;
}

/**
 * @param {{ seed: number, tutorialSafeZone: boolean }} opts
 */
export function createState(opts) {
  const bullets = [];
  for (let i = 0; i < BULLET_POOL; i++) bullets.push({ x: 0, y: 0, alive: false });
  const walkers = [];
  for (let i = 0; i < WALKER_POOL; i++) walkers.push({ x: 0, y: 0, alive: false });
  const startX = laneCenterX(START_LANE);
  return {
    seed: opts.seed >>> 0,
    rng: createRng(opts.seed),
    tutorialSafeZone: opts.tutorialSafeZone !== false,
    ended: false,
    endedBy: null,
    finished: false,
    timeS: 0,
    distancePx: 0,
    distanceM: 0,
    speed: speedForDistance(0),
    heroX: startX,
    targetX: startX,
    crowd: CROWD_START,
    maxCrowd: CROWD_START,
    kills: 0,
    coinsPicked: 0,
    noDamageStartM: 0,
    noDamageBestM: 0,
    spawnTimerS: SPAWN_FIRST_S,
    shotTimerS: 0,
    shotSfxS: 0,
    killSfxS: 0,
    flashS: 0,
    bullets,
    walkers,
    events: new Uint8Array(EVENT_CAP),
    eventCount: 0,
  };
}

/** @param {any} s @param {number} code */
export function pushEvent(s, code) {
  if (s.eventCount < EVENT_CAP) {
    s.events[s.eventCount] = code;
    s.eventCount++;
  }
}

/**
 * Perte d'un tireur, avec plancher de la zone tutoriel (SPEC §2).
 * @returns {boolean} true si la foule a effectivement perdu un tireur
 */
export function loseShooter(s) {
  const floor = s.tutorialSafeZone && s.distanceM < TUTORIAL_END_M ? TUTORIAL_FLOOR : 0;
  if (s.crowd <= floor) return false;
  s.crowd -= 1;
  const segment = s.distanceM - s.noDamageStartM;
  if (segment > s.noDamageBestM) s.noDamageBestM = segment;
  s.noDamageStartM = s.distanceM;
  s.flashS = HERO_FLASH_S;
  pushEvent(s, EV_HURT);
  return true;
}

/** Instantané des stats live (RunLiveStats, sans bossHp). */
export function snapshot(s) {
  return {
    distanceM: s.distanceM,
    coins: computeCoinsEarned({ picked: s.coinsPicked, kills: s.kills, distanceM: s.distanceM }),
    crowd: s.crowd,
    kills: s.kills,
    specialCharge: 0,
    bossHp: null,
    bossActive: false,
    speed: s.speed,
  };
}

/** Résultat final (RunResult). Ne modifie pas l'état. */
export function buildResult(s) {
  const segment = s.distanceM - s.noDamageStartM;
  const best = segment > s.noDamageBestM ? segment : s.noDamageBestM;
  return {
    distanceM: s.distanceM,
    kills: s.kills,
    coinsEarned: computeCoinsEarned({ picked: s.coinsPicked, kills: s.kills, distanceM: s.distanceM }),
    bossesDefeated: 0,
    maxCrowd: s.maxCrowd,
    endedBy: s.endedBy === 'quit' ? 'quit' : 'crowd_dead',
    durationS: s.timeS,
    noDamageDistanceM: best,
  };
}
