// Mise à jour d'un pas fixe (1/60 s) de la run. Pur : pas de DOM, pas de générateur global, pas d'allocation.
import {
  STEP_S,
  PX_PER_METER,
  PLAYER_Y,
  SPAWN_Y,
  DESPAWN_Y,
  HERO_HALF,
  WALKER_HALF,
  BULLET_HALF_W,
  BULLET_HALF_H,
  BULLET_SPEED,
  WALKER_DRIFT,
  INPUT_SMOOTH_TAU_S,
  SPEED_TAU_S,
  FIRE_INTERVAL_S,
  HERO_MIN_X,
  HERO_MAX_X,
  LANE_COUNT,
  SFX_SHOT_PER_S,
  SFX_KILL_PER_S,
} from '../balance.js';
import { speedForDistance, spawnIntervalFor } from './economy.js';
import { EV_SHOT, EV_KILL, laneCenterX, loseShooter, pushEvent } from './state.js';

/**
 * Avance la run d'un pas fixe. Sans effet si la run est déjà terminée.
 * Écrit les événements dans s.events (drainés par l'appelant).
 * @param {any} s état de run (sim/state.js)
 */
export function step(s) {
  if (s.ended) return;
  const dt = STEP_S;
  s.timeS += dt;
  if (s.flashS > 0) s.flashS -= dt;
  if (s.shotSfxS > 0) s.shotSfxS -= dt;
  if (s.killSfxS > 0) s.killSfxS -= dt;

  // 1. Héros : suit la cible avec lissage exponentiel.
  const follow = 1 - Math.exp(-dt / INPUT_SMOOTH_TAU_S);
  s.heroX += (s.targetX - s.heroX) * follow;
  if (s.heroX < HERO_MIN_X) s.heroX = HERO_MIN_X;
  else if (s.heroX > HERO_MAX_X) s.heroX = HERO_MAX_X;

  // 2. Vitesse de défilement et distance.
  const ease = 1 - Math.exp(-dt / SPEED_TAU_S);
  s.speed += (speedForDistance(s.distanceM) - s.speed) * ease;
  s.distancePx += s.speed * dt;
  s.distanceM = s.distancePx / PX_PER_METER;

  // 3. Apparition des walkers sur une voie tirée par le RNG seedé.
  s.spawnTimerS -= dt;
  if (s.spawnTimerS <= 0) {
    spawnWalker(s);
    s.spawnTimerS += spawnIntervalFor(s.distanceM);
  }

  // 4. Tir automatique vers le haut, cadence limitée.
  s.shotTimerS -= dt;
  if (s.shotTimerS <= 0) {
    s.shotTimerS += FIRE_INTERVAL_S;
    fire(s);
  }

  // 5. Walkers : défilement + dérive propre vers le bas.
  const walkerDy = (s.speed + WALKER_DRIFT) * dt;
  for (let i = 0; i < s.walkers.length; i++) {
    const w = s.walkers[i];
    if (!w.alive) continue;
    w.y += walkerDy;
    if (w.y > DESPAWN_Y) w.alive = false;
  }

  // 6. Balles : déplacement balayé et collision avec les walkers.
  for (let i = 0; i < s.bullets.length; i++) {
    const b = s.bullets[i];
    if (!b.alive) continue;
    const prevY = b.y;
    b.y -= BULLET_SPEED * dt;
    if (b.y < SPAWN_Y) {
      b.alive = false;
      continue;
    }
    for (let j = 0; j < s.walkers.length; j++) {
      const w = s.walkers[j];
      if (!w.alive) continue;
      const hitX = Math.abs(b.x - w.x) < BULLET_HALF_W + WALKER_HALF;
      const hitY = b.y - BULLET_HALF_H < w.y + WALKER_HALF && prevY + BULLET_HALF_H > w.y - WALKER_HALF;
      if (hitX && hitY) {
        w.alive = false;
        b.alive = false;
        onKill(s);
        break;
      }
    }
  }

  // 7. Contact walker / foule : -1 tireur, le walker meurt.
  for (let i = 0; i < s.walkers.length; i++) {
    const w = s.walkers[i];
    if (!w.alive) continue;
    if (Math.abs(w.x - s.heroX) < WALKER_HALF + HERO_HALF && Math.abs(w.y - PLAYER_Y) < WALKER_HALF + HERO_HALF) {
      w.alive = false;
      loseShooter(s);
    }
  }

  // 8. Fin de run : foule à zéro.
  if (s.crowd <= 0) {
    s.crowd = 0;
    s.ended = true;
    s.endedBy = 'crowd_dead';
  }
}

/** @param {any} s */
function onKill(s) {
  s.kills += 1;
  if (s.killSfxS <= 0) {
    s.killSfxS = 1 / SFX_KILL_PER_S;
    pushEvent(s, EV_KILL);
  }
}

/** @param {any} s */
function fire(s) {
  for (let i = 0; i < s.bullets.length; i++) {
    const b = s.bullets[i];
    if (b.alive) continue;
    b.alive = true;
    b.x = s.heroX;
    b.y = PLAYER_Y - HERO_HALF;
    if (s.crowd > 0 && s.shotSfxS <= 0) {
      s.shotSfxS = 1 / SFX_SHOT_PER_S;
      pushEvent(s, EV_SHOT);
    }
    return;
  }
}

/** @param {any} s */
function spawnWalker(s) {
  const lane = Math.floor(s.rng() * LANE_COUNT);
  for (let i = 0; i < s.walkers.length; i++) {
    const w = s.walkers[i];
    if (w.alive) continue;
    w.alive = true;
    w.x = laneCenterX(lane);
    w.y = SPAWN_Y;
    return;
  }
}
