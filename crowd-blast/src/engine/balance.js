// Constantes d'équilibrage du moteur : seule source de nombres de gameplay (ENG-1, CLAUDE.md).
// Valeurs provisoires du squelette M1 ; le calibrage fin est fait par ENG-17.
// Fichier pur : aucun accès à l'environnement, aucun générateur global.

export {
  LANE_COUNT,
  LANE_WIDTH,
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
} from '../constants.js';

// ---------- Pas de simulation ----------
/** Pas fixe de simulation, en secondes (60 pas par seconde). */
export const STEP_S = 1 / 60;
/** Nombre maximal de pas rattrapés dans une frame. */
export const MAX_CATCHUP_STEPS = 5;
/** onStats : au plus 15 fois par seconde de simulation. */
export const STATS_PER_S = 15;
/** Échantillonnage des sons répétitifs (SPEC et ENG-12). */
export const SFX_SHOT_PER_S = 12;
export const SFX_KILL_PER_S = 20;
/** Plafond du rendu pour les écrans haute densité. */
export const DPR_MAX = 3;

// ---------- Géométrie (px logiques ; 1 m = PX_PER_METER px) ----------
export const PX_PER_METER = 10;
/** Ligne du joueur (bas de la route). */
export const PLAYER_Y = 520;
/** Ligne d'apparition des entités (au-dessus de l'écran). */
export const SPAWN_Y = -60;
/** Au-delà de cette ligne, une entité est retirée. */
export const DESPAWN_Y = 680;
/** Demi-largeur de la boîte de collision de la foule et du héros. */
export const HERO_HALF = 14;
/** Demi-taille du walker (boîte de collision carrée). */
export const WALKER_HALF = 13;
/** Taille visuelle des sprites (tailles d'appel de CONTENT, ENG-11). */
export const HERO_SIZE = 28;
export const WALKER_SIZE = 26;
export const BULLET_SIZE = 8;
/** Demi-largeur et demi-hauteur de la balle (boîte de collision). */
export const BULLET_HALF_W = 4;
export const BULLET_HALF_H = 4;
/** Limites horizontales du héros : centre des voies extrêmes. */
export const HERO_MIN_X = 36;
export const HERO_MAX_X = 324;

// ---------- Entrée ----------
/** Constante de temps du lissage exponentiel du glisser (secondes). */
export const INPUT_SMOOTH_TAU_S = 0.05;
/** Voie de départ du héros (voie centrale). */
export const START_LANE = 2;

// ---------- Vitesse de défilement ----------
export const SPEED_MIN = 240;
export const SPEED_MAX = 600;
/** Augmentation de vitesse par palier de SPEED_STEP_M mètres. */
export const SPEED_STEP = 30;
export const SPEED_STEP_M = 100;
/** Constante de temps de la transition de vitesse (~0,5 s pour rejoindre la cible). */
export const SPEED_TAU_S = 0.17;

// ---------- Foule ----------
export const CROWD_START = 1;
/** Zone tutoriel : plancher de foule à TUTORIAL_FLOOR avant TUTORIAL_END_M (SPEC §2). */
export const TUTORIAL_END_M = 300;
export const TUTORIAL_FLOOR = 1;
/** Tirs de la foule (un tir par intervalle, cadence limitée). */
export const FIRE_INTERVAL_S = 0.5;
export const BULLET_SPEED = 900;
/** Vitesse propre des walkers vers le bas, en plus du défilement. */
export const WALKER_DRIFT = 60;
/** Durée du flash du héros après une perte de tireur. */
export const HERO_FLASH_S = 0.08;

// ---------- Apparition des walkers ----------
/** Délai avant le premier walker. */
export const SPAWN_FIRST_S = 0.8;
/** Intervalle entre deux walkers en zone tutoriel (peu dense). */
export const SPAWN_TUTORIAL_S = 1.2;
/** Intervalle minimal (densité plafonnée). */
export const SPAWN_MIN_S = 0.1;
/** Réduction de l'intervalle par mètre au-delà de TUTORIAL_END_M. */
export const SPAWN_RAMP_PER_M = 0.008;

// ---------- Pièces et score ----------
export const COINS_PER_KILL = 0.5;
export const METERS_PER_COIN = 20;

// ---------- Capacités des pools (aucune allocation dans la boucle) ----------
export const BULLET_POOL = 64;
export const WALKER_POOL = 96;
/** Nombre maximal de tireurs alliés dessinés individuellement. */
export const CROWD_DRAW_MAX = 60;

// ---------- Rendu (disposition de la foule et du flash) ----------
export const CROWD_GRID_COLS = 6;
export const CROWD_GRID_DX = 12;
export const CROWD_GRID_DY = 11;
/** Ordonnée du compteur « xN » au-dessus de la foule (N > 60). */
export const CROWD_COUNT_LABEL_Y = 380;
