// Repli géométrique (rectangles, cercles, route à 5 voies). Même interface que SpriteRenderer.
import { LANE_COUNT, LANE_WIDTH, LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../balance.js';

const TWO_PI = Math.PI * 2;
/** Tirets de la ligne de voie (constant, pour ne pas allouer à chaque frame). */
const LANE_DASH = [24, 18];
const NO_DASH = [];
const FALLBACK_COLOR = '#ffffff';
const OUTLINE = '#101010';

/**
 * Dessine une forme géométrique centrée en (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} shape
 * @param {{ color?: string }} style
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {number} _t
 * @param {{ flash?: boolean, width?: number, colorblind?: boolean }} [opts]
 */
function draw(ctx, shape, style, x, y, size, _t, opts) {
  const color = (style && style.color) || FALLBACK_COLOR;
  const flash = !!(opts && opts.flash);
  const colorblind = !!(opts && opts.colorblind);
  const half = size / 2;
  ctx.fillStyle = flash ? FALLBACK_COLOR : color;
  if (shape === 'bullet' || shape === 'coin') {
    ctx.beginPath();
    ctx.arc(x, y, half, 0, TWO_PI);
    ctx.fill();
    return;
  }
  const w = opts && opts.width ? opts.width : size;
  ctx.fillRect(x - w / 2, y - half, w, size);
  if (colorblind) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeRect(x - w / 2, y - half, w, size);
  }
}

/**
 * Dessine le fond : ciel, route, bords et lignes de voie défilantes.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ palette?: Record<string,string> }} theme
 * @param {number} scrollY défilement cumulé en px logiques
 * @param {number} _t
 */
function drawBackground(ctx, theme, scrollY, _t) {
  const p = (theme && theme.palette) || {};
  ctx.fillStyle = p.road || '#3a3a3a';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = p.edge || '#222222';
  ctx.fillRect(0, 0, 4, LOGICAL_HEIGHT);
  ctx.fillRect(LOGICAL_WIDTH - 4, 0, 4, LOGICAL_HEIGHT);
  ctx.strokeStyle = p.laneLine || '#f0e060';
  ctx.lineWidth = 3;
  ctx.setLineDash(LANE_DASH);
  ctx.lineDashOffset = -scrollY;
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = i * LANE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LOGICAL_HEIGHT);
    ctx.stroke();
  }
  ctx.setLineDash(NO_DASH);
}

export const debugSprites = { draw, drawBackground };
