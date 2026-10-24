// Contrats partagés entre ENGINE, META et CONTENT (documentation JSDoc, non compilé).
// Écrit par le Product. Lecture seule pour les agents : toute évolution passe par une demande.
// Les constantes runtime sont dans constants.js. Les fabriques sont des fonctions ES exportées par chaque module.

export declare const LANE_COUNT: 5;
export type LaneIndex = 0 | 1 | 2 | 3 | 4;

export declare const LOGICAL_WIDTH: 360;
export declare const LOGICAL_HEIGHT: 640;

// ---------- Identifiants communs ----------

export type ThemeId = 'zombies' | 'cyber' | 'fantasy' | 'western' | 'pirates';
export type WeaponId = 'starter' | 'shotgun' | 'smg' | 'flamer' | 'pierce_rifle';
export type EnemyType = 'walker' | 'runner' | 'brute' | 'exploder' | 'spitter';
export type ObstacleType = 'wreck' | 'barrel' | 'oncoming' | 'wall';
export type BossId = 'boss_1' | 'boss_2' | 'boss_3';
export type GateKind =
  | 'add' // +N tireurs
  | 'mul' // xN tireurs
  | 'fire_rate' // +% cadence
  | 'damage' // +% dégâts
  | 'pierce' // +1 perforation
  | 'sub' // -N tireurs (malus)
  | 'div'; // /2 tireurs (malus)

export type UpgradeId = 'fire_rate' | 'damage' | 'crowd_start' | 'coin_magnet';
export type UpgradeLevels = Record<UpgradeId, number>; // 0 à 5

// Formes dessinables par CONTENT (src/sprites). Aucune image externe.
export type ShapeId =
  | 'hero'
  | 'ally'
  | 'walker'
  | 'runner'
  | 'brute'
  | 'exploder'
  | 'spitter'
  | 'wreck'
  | 'barrel'
  | 'oncoming'
  | 'wall'
  | 'boss_1'
  | 'boss_2'
  | 'boss_3'
  | 'bullet'
  | 'coin';

export type SfxName =
  | 'shot'
  | 'hit'
  | 'kill'
  | 'gate_good'
  | 'gate_bad'
  | 'explosion'
  | 'hurt'
  | 'boss_warn'
  | 'boss_dead'
  | 'ui_click'
  | 'coin'
  | 'chest_open'
  | 'run_end';

export type HapticKind = 'light' | 'medium' | 'heavy';

// ---------- Thèmes (données pures, définies par CONTENT) ----------

export interface ThemePalette {
  skyTop: string;
  skyBottom: string;
  road: string;
  laneLine: string;
  edge: string;
  accent: string;
  gateGood: string;
  gateBad: string;
  danger: string;
  text: string;
}

export interface ThemeEntityStyle {
  name: string; // nom affiché dans le thème
  color: string;
  accentColor?: string;
  shape: ShapeId;
}

export interface ThemeMusic {
  bpm: number;
  rootNote: number; // note MIDI
  scale: 'minor' | 'major' | 'dorian' | 'phrygian';
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle';
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  tagline: string;
  palette: ThemePalette;
  heroName: string;
  allyName: string;
  weaponNames: Record<WeaponId, string>;
  enemies: Record<EnemyType, ThemeEntityStyle>;
  obstacles: Record<ObstacleType, ThemeEntityStyle>;
  bosses: Record<BossId, ThemeEntityStyle>;
  hero: ThemeEntityStyle;
  ally: ThemeEntityStyle;
  bullet: { color: string; glow: string };
  music: ThemeMusic;
  // Décor de fond : bandes parallaxes dessinées procéduralement.
  scenery: { kind: 'buildings' | 'trees' | 'dunes' | 'waves' | 'stars'; color: string; density: number };
}

// ---------- Sprites (CONTENT fournit, ENGINE consomme) ----------

export interface SpriteRenderer {
  /** Dessine une forme centrée en (x, y), taille logique `size` px. `t` en secondes pour l'animation. */
  draw(
    ctx: CanvasRenderingContext2D,
    shape: ShapeId,
    style: ThemeEntityStyle,
    x: number,
    y: number,
    size: number,
    t: number,
    // `width` (px logiques) sert aux formes multi-voies comme `wall` ; absent = carré `size`.
    // Le projectile 'bullet' utilise un ThemeEntityStyle construit par ENGINE depuis ThemeDef.bullet
    // (color = bullet.color, accentColor = bullet.glow, shape = 'bullet').
    opts?: { flash?: boolean; gore?: GoreLevel; width?: number; colorblind?: boolean },
  ): void;
  /** Dessine le fond (ciel, route, voies, décor) pour un défilement `scrollY` en px logiques. */
  drawBackground(ctx: CanvasRenderingContext2D, theme: ThemeDef, scrollY: number, t: number): void;
}

// ---------- Moteur (ENGINE fournit) ----------

export interface RunConfig {
  theme: ThemeDef;
  weaponId: WeaponId;
  upgrades: UpgradeLevels;
  seed: number;
  /** Mode tutoriel: aucun danger mortel avant 300 m. Toujours true en v1. */
  tutorialSafeZone: boolean;
  gore: GoreLevel;
  colorblind: boolean;
}

export type GoreLevel = 'soft' | 'normal';

export interface RunResult {
  distanceM: number;
  kills: number;
  coinsEarned: number;
  bossesDefeated: number;
  maxCrowd: number;
  // Une victoire sur un boss NE termine PAS la run : bonus de pièces, la run continue (boucle de boss).
  endedBy: 'crowd_dead' | 'quit';
  durationS: number;
  /** Plus longue distance parcourue sans perdre un seul tireur (pour la mission no_damage_distance). */
  noDamageDistanceM: number;
}

export interface RunLiveStats {
  distanceM: number;
  coins: number;
  crowd: number;
  kills: number;
  specialCharge: number; // 0 à 1
  bossHp: number | null; // 0 à 1 quand un boss est actif
  bossActive: boolean;
  /** Vitesse de défilement courante en px logiques par seconde (pilote l'intensité audio). */
  speed: number;
}

export interface EngineHooks {
  onSfx(name: SfxName): void;
  onHaptic(kind: HapticKind): void;
  onStats(stats: RunLiveStats): void; // appelé au plus 15 fois par seconde
  /** Appelé exactement une fois par run, y compris après quit(). `coinsEarned` est final. */
  onRunEnd(result: RunResult): void;
  /**
   * Quand la foule tombe à zéro, une seule fois par run, le moteur se met en pause et attend cette promesse.
   * true = réanimation (payée en pièces) : foule remise à 5 tireurs et 2 s d'invulnérabilité, la run continue.
   * false ou hook absent = fin de run normale.
   */
  onReviveOffer?(): Promise<boolean>;
}

export interface GameEngine {
  /** Prépare une run (reset complet) et la démarre. Premier frame rendu en moins de 300 ms. */
  start(config: RunConfig): void;
  pause(): void;
  resume(): void;
  /** Termine proprement la run en cours avec endedBy = 'quit'. */
  quit(): void;
  /** Libère tous les listeners et la boucle. */
  destroy(): void;
}

export type CreateEngine = (
  canvas: HTMLCanvasElement,
  sprites: SpriteRenderer,
  hooks: EngineHooks,
) => GameEngine;

// ---------- Méta-jeu (META fournit) ----------

export interface SaveData {
  version: 1;
  coins: number;
  xp: number;
  level: number;
  upgrades: UpgradeLevels;
  unlockedWeapons: WeaponId[];
  selectedWeapon: WeaponId;
  selectedTheme: ThemeId;
  bestDistanceByTheme: Partial<Record<ThemeId, number>>;
  missions: { day: string; items: MissionState[] };
  chests: ChestState[];
  settings: Settings;
}

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  gore: GoreLevel;
  colorblind: boolean;
}

export type MissionKind = 'kills' | 'distance' | 'boss' | 'no_damage_distance';

export interface MissionState {
  id: string;
  kind: MissionKind;
  target: number;
  progress: number;
  rewardCoins: number;
  claimed: boolean;
}

export interface ChestState {
  id: string;
  earnedAt: number;
  opened: boolean; // coffre gratuit, ouverture immédiate
}

export interface SaveService {
  load(): SaveData;
  save(data: SaveData): void;
  reset(): void;
}

export interface MetaService {
  getSave(): SaveData;
  /** Coût en pièces de la réanimation (une fois par run). */
  getReviveCost(): number;
  /** Retire des pièces. Retourne false si le solde est insuffisant. */
  spendCoins(amount: number): boolean;
  buildRunConfig(theme: ThemeDef, seed: number): RunConfig;
  /** Applique un résultat de run : pièces, XP, record, missions, coffre. */
  applyRunResult(result: RunResult, themeId: ThemeId): RunSummary;
  getUpgradeCost(id: UpgradeId): number | null; // null si niveau max
  buyUpgrade(id: UpgradeId): boolean;
  unlockWeaponsForLevel(): WeaponId[];
  selectWeapon(id: WeaponId): boolean;
  selectTheme(id: ThemeId): void;
  openChest(id: string): { coins: number } | null;
  claimMission(id: string): boolean;
  updateSettings(patch: Partial<Settings>): void;
  /** Ajoute des pièces (récompenses de missions et de coffres). */
  addCoins(amount: number): void;
  /** Notifie CONTENT/main.js à chaque changement de réglage (son, musique, haptique, gore, daltonisme). */
  onSettingsChanged(cb: (settings: Settings) => void): void;
}

export interface RunSummary {
  coinsGained: number;
  xpGained: number;
  newLevel: number | null; // non null si montée de niveau
  newRecord: boolean;
  chestEarned: ChestState | null;
  missionsCompleted: string[];
  unlockedWeapons: WeaponId[];
}

// Aucun service de pub, d'achat ni de classement : le jeu est 100 % local, sans pub et sans achat.

// ---------- Audio et plateforme (CONTENT fournit) ----------

export interface AudioService {
  /** À appeler après un premier geste utilisateur (politique des navigateurs). */
  unlock(): void;
  playSfx(name: SfxName): void;
  startMusic(theme: ThemeDef): void;
  /** 0 à 1 : tension musicale, pilotée par la vitesse/boss. */
  setIntensity(value: number): void;
  stopMusic(): void;
  setSfxEnabled(on: boolean): void;
  setMusicEnabled(on: boolean): void;
}

export interface HapticsService {
  trigger(kind: HapticKind): void;
  setEnabled(on: boolean): void;
}

// ---------- UI (META fournit) ----------

export type Screen = 'home' | 'themes' | 'workshop' | 'missions' | 'chests' | 'settings' | 'run' | 'result';

export interface UiController {
  show(screen: Screen): void;
  /** Met à jour le HUD pendant la run. */
  updateHud(stats: RunLiveStats): void;
  showResult(summary: RunSummary, result: RunResult): void;
  onPlayRequested(cb: () => void): void;
  onRetryRequested(cb: () => void): void;
  onHomeRequested(cb: () => void): void;
  onThemeSelected(cb: (id: ThemeId) => void): void;
  /**
   * Affiche l'écran de proposition de réanimation (coût en pièces). Résout true si le joueur accepte ET paie.
   * main.js relie EngineHooks.onReviveOffer à cette méthode ; le paiement passe par MetaService.spendCoins.
   */
  askRevive(): Promise<boolean>;
  onPauseRequested(cb: () => void): void;
  onResumeRequested(cb: () => void): void;
  onQuitRequested(cb: () => void): void;
  /** Sons d'interface (ui_click, chest_open, coin) : main.js les relaie vers AudioService. */
  onSfx(cb: (name: SfxName) => void): void;
}
