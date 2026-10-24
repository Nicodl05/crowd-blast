// Entrées par Pointer Events sur le canvas (ENG-1 : glisser horizontal, un seul pointeur actif).
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../balance.js';

/**
 * Convertit une coordonnée client en X logique, en tenant compte du letterbox.
 * @param {{left:number, top:number, width:number, height:number}} rect
 * @param {number} clientX
 * @returns {number} X dans l'espace logique 360 px (non borné)
 */
export function clientToLogicalX(rect, clientX) {
  const scale = Math.min(rect.width / LOGICAL_WIDTH, rect.height / LOGICAL_HEIGHT) || 1;
  const offsetX = (rect.width - LOGICAL_WIDTH * scale) / 2;
  return (clientX - rect.left - offsetX) / scale;
}

/**
 * Branche les écouteurs sur le canvas et le document. Retourne la fonction de nettoyage.
 * @param {HTMLCanvasElement} canvas
 * @param {{ onDown(x:number):void, onMove(x:number):void, onRelease():void, onVisibility(hidden:boolean):void }} h
 * @returns {() => void}
 */
export function attachPointer(canvas, h) {
  const doc = canvas.ownerDocument;
  const win = doc && doc.defaultView;
  let activeId = null;
  /** Rectangle du canvas mis en cache au pointerdown (pas de relayout à chaque pointermove). */
  let rect = null;

  const xOf = (e) => clientToLogicalX(rect || canvas.getBoundingClientRect(), e.clientX);

  const release = () => {
    if (activeId === null) return;
    activeId = null;
    rect = null;
    h.onRelease();
  };
  const onDown = (e) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    rect = canvas.getBoundingClientRect();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      // Capture indisponible : le glisser reste utilisable sans capture.
    }
    h.onDown(xOf(e));
  };
  const onMove = (e) => {
    if (e.pointerId !== activeId) return;
    h.onMove(xOf(e));
  };
  const onUp = (e) => {
    if (e.pointerId === activeId) release();
  };
  const onLost = () => release();
  const onBlur = () => release();
  const onVis = () => h.onVisibility(!!doc.hidden);

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onLost);
  if (win) win.addEventListener('blur', onBlur);
  doc.addEventListener('visibilitychange', onVis);

  return function detach() {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('lostpointercapture', onLost);
    if (win) win.removeEventListener('blur', onBlur);
    doc.removeEventListener('visibilitychange', onVis);
    activeId = null;
  };
}
