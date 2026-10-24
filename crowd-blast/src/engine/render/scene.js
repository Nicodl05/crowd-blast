// Dessin d'une frame de run. Lit l'état, ne le modifie jamais. Choix du rendeur avec repli.
import {
  PLAYER_Y,
  HERO_SIZE,
  WALKER_SIZE,
  BULLET_SIZE,
  CROWD_DRAW_MAX,
  CROWD_GRID_COLS,
  CROWD_GRID_DX,
  CROWD_GRID_DY,
  CROWD_COUNT_LABEL_Y,
  LOGICAL_WIDTH,
} from '../balance.js';
import { debugSprites } from './debugSprites.js';

/** Options réutilisées d'un appel à l'autre (aucune allocation par entité). */
const drawOpts = { flash: false, gore: 'soft', colorblind: false };

/**
 * @param {any} sprites
 * @param {any} theme
 */
function usable(sprites, theme) {
  return !!(
    sprites &&
    typeof sprites.draw === 'function' &&
    typeof sprites.drawBackground === 'function' &&
    theme &&
    theme.palette &&
    theme.hero &&
    theme.ally &&
    theme.bullet &&
    theme.enemies &&
    theme.enemies.walker
  );
}

/**
 * Crée le rendeur d'une run. Bascule définitive et silencieuse sur debugSprites
 * si sprites est absent, si le thème est incomplet, ou si draw lève (une seule alerte).
 * @param {any} sprites
 * @param {any} theme
 * @param {(msg: string) => void} warn
 */
export function createRenderer(sprites, theme, warn) {
  let active = usable(sprites, theme) ? sprites : debugSprites;
  let fallbackWarned = false;
  if (active === debugSprites && sprites !== debugSprites) {
    warn('Crowd Blast engine: sprites unavailable, using debug shapes.');
  }
  const bulletStyle = theme && theme.bullet
    ? { name: 'bullet', color: theme.bullet.color, accentColor: theme.bullet.glow, shape: 'bullet' }
    : { name: 'bullet', color: '#ffffff', shape: 'bullet' };
  const hero = (theme && theme.hero) || {};
  const ally = (theme && theme.ally) || {};
  const walker = (theme && theme.enemies && theme.enemies.walker) || {};

  function drawWith(r, ctx, s, t) {
    r.drawBackground(ctx, theme, s.distancePx, t);
    for (let i = 0; i < s.walkers.length; i++) {
      const w = s.walkers[i];
      if (w.alive) r.draw(ctx, 'walker', walker, w.x, w.y, WALKER_SIZE, t, drawOpts);
    }
    for (let i = 0; i < s.bullets.length; i++) {
      const b = s.bullets[i];
      if (b.alive) r.draw(ctx, 'bullet', bulletStyle, b.x, b.y, BULLET_SIZE, t, drawOpts);
    }
    const shown = s.crowd < CROWD_DRAW_MAX ? s.crowd : CROWD_DRAW_MAX;
    const allies = shown - 1;
    drawOpts.flash = s.flashS > 0;
    for (let i = 0; i < allies; i++) {
      const col = i % CROWD_GRID_COLS;
      const row = (i - col) / CROWD_GRID_COLS;
      const x = s.heroX + (col - (CROWD_GRID_COLS - 1) / 2) * CROWD_GRID_DX;
      const y = PLAYER_Y - (row + 1) * CROWD_GRID_DY;
      r.draw(ctx, 'ally', ally, x, y, HERO_SIZE, t, drawOpts);
    }
    r.draw(ctx, 'hero', hero, s.heroX, PLAYER_Y, HERO_SIZE, t, drawOpts);
    drawOpts.flash = false;
  }

  return {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {any} s état de run
     * @param {number} t temps de simulation (gelé en pause)
     * @param {string} gore
     * @param {boolean} colorblind
     */
    drawFrame(ctx, s, t, gore, colorblind) {
      drawOpts.gore = gore;
      drawOpts.colorblind = colorblind;
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      try {
        drawWith(active, ctx, s, t);
      } catch (err) {
        if (!fallbackWarned) {
          fallbackWarned = true;
          warn('Crowd Blast engine: sprite draw failed, falling back to debug shapes.', err);
        }
        if (active !== debugSprites) {
          active = debugSprites;
          drawWith(active, ctx, s, t);
        }
      }
      if (s.crowd > CROWD_DRAW_MAX) {
        ctx.fillStyle = (theme && theme.palette && theme.palette.text) || '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('x' + s.crowd, LOGICAL_WIDTH / 2, CROWD_COUNT_LABEL_Y);
      }
    },
  };
}
