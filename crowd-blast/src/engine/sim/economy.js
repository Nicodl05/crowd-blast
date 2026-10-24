// Fonctions pures de progression : vitesse, cadence des walkers, pièces (SPEC §2, ENG-10).
import {
  SPEED_MIN,
  SPEED_MAX,
  SPEED_STEP,
  SPEED_STEP_M,
  TUTORIAL_END_M,
  SPAWN_TUTORIAL_S,
  SPAWN_MIN_S,
  SPAWN_RAMP_PER_M,
  COINS_PER_KILL,
  METERS_PER_COIN,
} from '../balance.js';

/**
 * Vitesse cible de défilement (px logiques par seconde), par paliers de 100 m.
 * @param {number} distanceM
 * @returns {number} toujours fini, dans [SPEED_MIN, SPEED_MAX]
 */
export function speedForDistance(distanceM) {
  const d = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0;
  const v = SPEED_MIN + SPEED_STEP * Math.floor(d / SPEED_STEP_M);
  return Math.min(v, SPEED_MAX);
}

/**
 * Intervalle entre deux walkers (s) : peu dense en zone tutoriel, plus dense ensuite, plafonné.
 * @param {number} distanceM
 */
export function spawnIntervalFor(distanceM) {
  if (!(distanceM >= TUTORIAL_END_M)) return SPAWN_TUTORIAL_S;
  const v = SPAWN_TUTORIAL_S - (distanceM - TUTORIAL_END_M) * SPAWN_RAMP_PER_M;
  return v > SPAWN_MIN_S ? v : SPAWN_MIN_S;
}

/**
 * Pièces finales d'une run (ENG-10) : ramassées + kills + distance.
 * @param {{ picked?: number, kills?: number, distanceM?: number }} [f]
 * @returns {number} entier >= 0
 */
export function computeCoinsEarned(f) {
  const picked = f && Number.isFinite(f.picked) ? Math.max(0, Math.floor(f.picked)) : 0;
  const kills = f && Number.isFinite(f.kills) ? Math.max(0, f.kills) : 0;
  const distanceM = f && Number.isFinite(f.distanceM) ? Math.max(0, f.distanceM) : 0;
  return picked + Math.floor(kills * COINS_PER_KILL) + Math.floor(distanceM / METERS_PER_COIN);
}
