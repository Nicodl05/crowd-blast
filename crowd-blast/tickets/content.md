# Tickets CONTENT (préfixe CON-)

Périmètre : `.github/`, `dev.sh`, `src/themes/`, `src/sprites/`, `src/audio/`, `src/platform/`, `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `README.md`, `src/main.js`, et mes tests dans `tests/content/`.
Stack (SPEC §4) : JavaScript pur en modules ES, aucun build, aucun npm ; un `package.json` minimal `{"type":"module"}` est fourni à la racine par le Product (SPEC §4) : ne pas le supprimer ni l'étendre. Tests : `node --test tests/content/*.test.js` (Node >= 22.7 recommandé, voir H1) ; tout le projet : `node --test` sans argument (jamais `node --test tests/`, qui échoue sur Node 22). Lancement : `python3 -m http.server 8000` à la racine du dépôt (ou `./dev.sh`). Le jeu s'appelle **Crowd Blast** ; tous les textes affichés (y compris le README) sont en anglais ; ni pub, ni achat, ni énergie (SPEC §0).
Règle de testabilité : tous mes modules s'importent sans DOM (le contexte canvas, l'`AudioContext`, `navigator`, `localStorage` sont injectés), pour être testés sous Node avec des faux dans `tests/content/helpers/`.
Convention : toutes les couleurs de thème sont au format `#rrggbb` (6 chiffres) pour permettre le calcul de contraste.
Ordre critique : CON-1 → CON-2 → CON-3 → CON-5 → CON-9 → CON-16 → CON-17. CON-19 (dev sur smartphone, P0) ne dépend que de CON-1 et peut se faire juste après lui. CON-1 débloque ENGINE et META (ils peuvent servir leurs modules en statique dès qu'il existe). Les autres tickets se greffent sur ce chemin. CON-18 (README) est sacrifiable.

---

### CON-1 : Squelette statique index.html + src/main.js
- Priorité : P0
- Dépend de : aucun
- Description : Créer `index.html` à la racine : `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`, `<title>Crowd Blast</title>`, `theme-color`, `<link rel="manifest" href="manifest.webmanifest">` (le fichier arrive en CON-15 ; son absence ne doit produire qu'un 404 non bloquant), un `<canvas id="game">` plein écran et un `<div id="ui">` posé par-dessus (`position: absolute; inset: 0`), CSS inline minimal (fond noir, `overflow: hidden`, `touch-action: none` sur le canvas, `overscroll-behavior: none`, `user-select: none`, `-webkit-tap-highlight-color: transparent`), puis `<script type="module" src="src/main.js">`. `src/main.js` minimal : importe `LOGICAL_WIDTH`, `LOGICAL_HEIGHT` de `src/constants.js`, dimensionne le canvas à 360x640 logiques x `devicePixelRatio` (plafonné à 3), le centre à l'écran en conservant le ratio (letterbox), recalcule au `resize`/`orientationchange`, remplit le canvas d'un dégradé de test et écrit « Crowd Blast » au centre. Les modules `engine/`, `meta/`, `ui/`, `themes/`, `sprites/`, `audio/` sont importés par `import()` dynamique dans un `try/catch` qui journalise un `console.warn` (jamais d'erreur bloquante) tant qu'ils n'existent pas : le squelette se charge donc avant les livraisons des autres agents. Pas de service worker à ce stade.
- Critères d'acceptation :
  - `python3 -m http.server 8000` puis ouverture de `http://localhost:8000/` : le canvas s'affiche, aucune exception dans la console (seuls un 404 de `manifest.webmanifest` et des `console.warn` « module absent » sont tolérés).
  - Vérification visuelle à 360x640 et 390x844 (outils de développement, mode mobile) : pas de barre de défilement, canvas centré, ratio 9:16 conservé.
  - `node --check src/main.js` sort avec le code 0.
  - `grep -rn "import .* from ['\"][^.]" src/main.js` ne renvoie rien (aucune dépendance externe, imports relatifs uniquement).
  - Seul le `package.json` minimal fourni par le Product existe à la racine (clés `name`, `private`, `type` uniquement, sans `dependencies`, `devDependencies` ni `scripts`) ; aucun `tsconfig.json`, `vite.config.*` ni `node_modules`.
- Interfaces utilisées / fournies : utilise `LOGICAL_WIDTH`, `LOGICAL_HEIGHT` (constants.js). Fournit les éléments `#game` et `#ui` à ENGINE et META.
- Statut : fait (M1) - index.html + src/main.js (letterbox 9:16, dégradé de test, imports optionnels literal try/catch) ; vérif visuelle : à faire utilisateur (Chrome Playwright non installé)

### CON-2 : Registre de thèmes, utilitaires couleur et thème zombies
- Priorité : P0
- Dépend de : CON-1
- Description : Créer `src/themes/color.js` (`parseHex` qui lève une erreur hors `#rrggbb`, `relativeLuminance`, `contrastRatio(a, b)` selon WCAG 2.1). Créer `src/themes/zombies.js` (`export default` d'un littéral objet conforme à `ThemeDef`, JSDoc `@type {import('../contracts.d.ts').ThemeDef}`) : palette autoroute grise sous ciel crépusculaire, `scenery.kind: 'buildings'`, héros « Tireur », alliés « Tireurs », 5 noms d'armes, 5 ennemis, 4 obstacles, 3 boss, `bullet`, `music` en `minor`. Chaque `shape` correspond à son rôle (`enemies.walker.shape === 'walker'`, `bosses.boss_1.shape === 'boss_1'`, `hero.shape === 'hero'`, `ally.shape === 'ally'`). Créer `src/themes/index.js` : `THEMES` (tableau ordonné zombies, cyber, fantasy, western, pirates ; à ce stade seul zombies est présent, voir CON-4), `DEFAULT_THEME_ID = 'zombies'`, `getTheme(id)` (renvoie le thème par défaut si l'id est inconnu, jamais d'exception), `THEMES_BY_ID`. Aucun code dans les fichiers de thème hors littéraux. Les thèmes sont gelés (`Object.freeze` profond fait dans `index.js`).
- Critères d'acceptation :
  - `node --test tests/content/color.test.js` passe : `contrastRatio('#000000','#ffffff')` = 21 (±0,01), `contrastRatio('#777777','#ffffff')` ≈ 4,48 (±0,05), symétrie, `parseHex('#fff')` et `parseHex('red')` lèvent une erreur.
  - Test : `getTheme('zombies').id === 'zombies'`, `getTheme('inconnu').id === 'zombies'`, `DEFAULT_THEME_ID === 'zombies'`, `Object.isFrozen(getTheme('zombies').palette)`.
  - `grep -nE "function|=>" src/themes/zombies.js` ne renvoie rien (données pures).
  - `node -e "import('./src/themes/index.js').then(m=>console.log(m.THEMES.length))"` s'exécute sans erreur (module sans DOM).
- Interfaces utilisées / fournies : `ThemeDef`, `ThemeId`, `ThemePalette`, `ThemeEntityStyle`, `ThemeMusic`. Fournit `THEMES`, `getTheme`, `DEFAULT_THEME_ID` à META (sélection), ENGINE (via `RunConfig.theme`) et main.js.

### CON-3 : Validation des thèmes (complétude, #rrggbb, contrastes) avec node --test
- Priorité : P0
- Dépend de : CON-2
- Description : Créer `tests/content/themes.test.js` qui boucle sur `THEMES` (il s'étend donc seul quand CON-4 ajoute des thèmes). Complétude : tous les champs de `ThemeDef` présents et non vides ; `weaponNames` contient exactement les 5 `WeaponId` ; `enemies` les 5 `EnemyType` ; `obstacles` les 4 `ObstacleType` ; `bosses` les 3 `BossId` ; `shape` de chaque entité dans la liste canonique des 16 `ShapeId` (liste dupliquée dans le test) et cohérente avec son rôle ; `id` unique et dans la liste des 5 `ThemeId` ; ordre de `THEMES` conforme au SPEC. Format : toute couleur (palette, entités, `bullet`, `scenery.color`) est `#rrggbb` ; `music.bpm` entre 80 et 180, `rootNote` entre 24 et 72, `scale` et `waveform` dans les valeurs autorisées ; `scenery.density` entre 0 et 1 ; `scenery.kind` valide. Contrastes WCAG (via `color.js`) : `text` vs `skyTop` et vs `skyBottom` >= 4,5 (du texte d'interface est posé sur ces dégradés, demande META) ; `text` vs `road` >= 4,5 ; `accent` vs `skyBottom` >= 3 ; `gateGood`, `gateBad`, `danger` vs `road` >= 3 ; `laneLine` vs `road` >= 1,4 ; `edge` vs `road` >= 1,3 ; `bullet.color` vs `road` >= 3 ; `hero.color` et `ally.color` vs `road` >= 3 ; chaque ennemi, obstacle et boss `color` vs `road` >= 2,5 ; rapport de luminance `gateGood`/`gateBad` >= 1,5 (distinguables sans la teinte, mode daltonien). Chaque échec nomme le thème et le champ fautif.
- Critères d'acceptation :
  - `node --test tests/content/themes.test.js` passe sur les thèmes présents, en moins de 2 s.
  - Mutation manuelle : dans une copie en mémoire, mettre `palette.text` égal à `road` fait échouer le test avec un message contenant l'id du thème et `text` (un test unitaire du test lui-même appelle la fonction de validation exportée `validateTheme(theme)` sur un thème corrompu et vérifie qu'elle renvoie la liste d'erreurs attendue).
  - `validateTheme` sur un thème auquel on retire une clé de `weaponNames` renvoie une erreur de complétude.
  - Les assertions sont dans `tests/content/validateTheme.js` (hors `.test.js`, réutilisable par un script de développement), le fichier de test ne contient que la boucle.
- Interfaces utilisées / fournies : `ThemeDef`, `ThemePalette`, `ShapeId`, `WeaponId`, `EnemyType`, `ObstacleType`, `BossId`.

### CON-4 : Quatre thèmes restants (cyber, fantasy, western, pirates)
- Priorité : P1
- Dépend de : CON-3
- Description : Créer `cyber.js` (Neon Lane : néon sombre, `stars` ou `buildings`, musique `phrygian`/`sawtooth`), `fantasy.js` (Kingsroad Archer : `trees`, `major`/`triangle`), `western.js` (Dust Trail : `dunes`, `dorian`/`square`), `pirates.js` (Endless Tide : `waves`, `minor` ou `dorian`/`sine`). Noms propres à chaque thème (héros, alliés, armes, ennemis, obstacles, boss, `tagline`), mêmes 16 `ShapeId` pour tous (la différence vient des couleurs, des noms et du décor ; aucun code spécifique à un thème). `bpm` distincts entre 100 et 150, `rootNote` entre 36 et 60. Compléter `THEMES` dans l'ordre du SPEC.
- Critères d'acceptation :
  - `node --test tests/content/themes.test.js` passe avec 5 thèmes.
  - Test : `THEMES.map(t => t.id)` vaut exactement `['zombies','cyber','fantasy','western','pirates']` ; `new Set(THEMES.map(t => t.palette.skyTop)).size === 5` ; `new Set(THEMES.map(t => t.music.bpm)).size >= 4` ; 5 noms de héros distincts.
  - Aucun nom d'arme, d'ennemi ou de boss vide ou dupliqué à l'intérieur d'un même thème.
  - `getTheme('pirates').scenery.kind === 'waves'`.
- Interfaces utilisées / fournies : `ThemeDef`, `ThemeId`. Fournit les 5 thèmes à META (écran de sélection) et ENGINE.

### CON-5 : SpriteRenderer, socle et formes hero, ally, bullet, coin + galerie de dev
- Priorité : P0
- Dépend de : CON-2
- Description : Créer `src/sprites/index.js` exportant `createSpriteRenderer()` conforme à `SpriteRenderer`. Architecture : table `SHAPES` (objet `ShapeId` → fonction `(ctx, style, x, y, size, t, opts)`) répartie en `src/sprites/shapes/*.js`, une fonction pure par forme, aucune allocation par appel (pas de tableau, d'objet, de `Path2D`, de chaîne construite ou de closure créés dans `draw` ; les chaînes de couleur dérivées sont mémorisées dans une `Map` par couleur source). `draw` centre sur (x, y), accepte `size` de 12 à 120 px, fonctionne hors boucle de jeu et sur de petits canvas (40 à 96 px, usage des miniatures META) avec n'importe quel `t` fourni. Chaque forme fait `save/restore` (aucun état fuyant). `opts.flash` : forme entièrement blanche (`fillStyle`/`strokeStyle` remplacés par `#ffffff`). `opts.width` : largeur en px (absent = `size`), utilisée par `wall`. `opts.colorblind` : ajoute un marqueur géométrique (liseré clair) sur les entités dangereuses, sans changer la silhouette. Forme inconnue : carré magenta, jamais d'exception. `bullet` est dessiné avec le style construit par ENGINE (`color` = `bullet.color`, `accentColor` = `bullet.glow`, `shape` = `'bullet'`) : trait lumineux vertical avec halo, sans `shadowBlur` (coûteux sur mobile) ; `coin` tourne avec `t` (écrasement horizontal). `hero` est plus grand visuellement que `ally` avec contour `accentColor`. Galerie de développement `src/sprites/gallery.html` (+ `gallery.js`) servie en statique : toutes les `ShapeId` pour le thème choisi (sélecteur des 5 thèmes), à 3 tailles, animées, bascules `flash`, `gore`, `colorblind` ; non mise en cache hors-ligne.
- Critères d'acceptation :
  - `node --test tests/content/sprites-core.test.js` passe (faux contexte enregistreur dans `tests/content/helpers/fakeCtx.js`) : pour hero, ally, bullet, coin, la pile `save/restore` est équilibrée et au moins une opération de dessin est émise ; une forme inconnue ne lève pas ; `flash: true` produit au moins un `fillStyle === '#ffffff'`.
  - Test d'allocation : 20 000 appels `draw('hero')` sur un faux contexte à compteurs ne font pas croître le tas de plus de 2 Mo (mesure `process.memoryUsage().heapUsed` après `global.gc` si exposé, sinon test sauté avec message explicite).
  - Test : aucune importation de DOM (`document`, `window`) dans `src/sprites` (`grep -rn "document\.\|window\." src/sprites/*.js src/sprites/shapes` ne renvoie rien, la galerie exceptée).
  - Aucune référence à un `ThemeId` dans `src/sprites` hors galerie.
  - Vérification visuelle : `http://localhost:8000/src/sprites/gallery.html` affiche hero, ally, bullet, coin à 24, 32 et 48 px, lisibles, sans erreur console, thème modifiable sans rechargement.
- Interfaces utilisées / fournies : `SpriteRenderer.draw` (avec `opts.width`, `opts.colorblind`, `opts.flash`, `opts.gore`), `ShapeId`, `ThemeEntityStyle`, `GoreLevel`. Fournit `createSpriteRenderer` à ENGINE et META.

### CON-6 : Sprites des ennemis (walker, runner, brute, exploder, spitter)
- Priorité : P1
- Dépend de : CON-5
- Description : Dessiner les 5 ennemis en vectoriel, lisibles aux tailles d'ENGINE (walker 26, runner 24, brute 42, exploder 30, spitter 28 px) et distincts par la silhouette seule : `walker` (ovale, balancement lent), `runner` (penché, animation rapide), `brute` (large et massif), `exploder` (halo clignotant dont la fréquence augmente avec `t`, couleur `accentColor`), `spitter` (bouche/pointe projectile). Couleurs uniquement via `style.color` et `style.accentColor`. `opts.gore` : en `soft`, aucun détail sanglant ni rouge ajouté ; en `normal`, détails d'impact supplémentaires (taches en `accentColor` assombrie). Budget : moins de 120 opérations de dessin par appel.
- Critères d'acceptation :
  - `node --test tests/content/sprites-enemies.test.js` : chaque forme émet entre 3 et 120 opérations, reste dans la boîte `[x ± size, y ± size]` (tolérance 10 % sur les coordonnées du journal), équilibre `save/restore` ; sous `gore: 'soft'` aucune couleur propre au sprite n'est introduite en dehors de `style.color`, `style.accentColor` et de leurs variantes assombries/éclaircies (test sur les valeurs de `fillStyle` émises).
  - Test : la boîte englobante de `brute` est au moins 1,3 fois plus large que celle de `walker` à `size` égal.
  - Vérification visuelle sur la galerie : à 32 px et en niveaux de gris (filtre CSS `grayscale(1)` de la galerie), les 5 ennemis sont identifiables par la seule silhouette, dans les 5 thèmes.
- Interfaces utilisées / fournies : `ShapeId` (walker, runner, brute, exploder, spitter), `ThemeEntityStyle`, `GoreLevel`.

### CON-7 : Sprites des obstacles (wreck, barrel, oncoming, wall)
- Priorité : P1
- Dépend de : CON-5
- Description : Dessiner `wreck` (carcasse bloquante abîmée, 48 px), `barrel` (baril explosif avec marquage de danger, 28 px), `oncoming` (entité vue de face avec phares ou équivalent, orientée vers le bas de l'écran, 52 px), `wall` (mur multi-voies : `size` donne la hauteur, `opts.width` la largeur totale en px, 72 x n voies ; une seule invocation par mur, jonctions de segments tous les 72 px, bords extérieurs exactement à `x ± width/2`). L'ombre d'avertissement d'`oncoming` reste dessinée par ENGINE. Couleurs uniquement via `style`. Mode `colorblind` : liseré à chevrons sur `barrel` et `oncoming`.
- Critères d'acceptation :
  - `node --test tests/content/sprites-obstacles.test.js` : les 4 formes restent dans leur boîte (tolérance 10 %), équilibrent `save/restore` et émettent moins de 120 opérations.
  - Test `wall` : avec `opts.width = 216` (3 voies) centré en x = 180, les abscisses min et max du journal valent 72 et 288 (±1) ; avec `opts.width` absent le mur occupe `size`.
  - Test : deux `wall` contigus (`width = 72` centré en x = 36, puis `width = 144` centré en x = 144) couvrent sans intervalle vide l'intervalle [0, 216] (calcul sur le journal).
  - Vérification visuelle galerie : un `wall` de 3 voies est un mur continu ; `barrel` est reconnaissable comme explosif dans les 5 thèmes sans texte.
- Interfaces utilisées / fournies : `ShapeId` (wreck, barrel, oncoming, wall), `ThemeEntityStyle`, `opts.width`.

### CON-8 : Sprites des boss (boss_1, boss_2, boss_3)
- Priorité : P1
- Dépend de : CON-5
- Description : Dessiner 3 boss de grande taille (appel attendu entre 120 et 180 px, 2 à 3 voies), avec « respiration » dépendant de `t`, un point faible lisible (œil ou cœur en `accentColor`) et une silhouette distincte : `boss_1` massif et lent, `boss_2` à bras/charge, `boss_3` à halo/couronne d'invocation. `opts.flash` pour le clignotement de dégâts (la barre de vie reste dessinée par ENGINE). Budget de dessin strict pour tenir 60 FPS sur téléphone d'entrée de gamme.
- Critères d'acceptation :
  - `node --test tests/content/sprites-bosses.test.js` : chaque boss émet entre 8 et 150 opérations de dessin, reste dans sa boîte (tolérance 10 %), équilibre `save/restore` ; `flash: true` produit au moins un `#ffffff` et plus aucune autre couleur de remplissage dominante (toutes les valeurs de `fillStyle` émises sont `#ffffff`).
  - Test de variation : deux appels avec `t = 0` et `t = 0.5` produisent des journaux différents (animation présente).
  - Vérification visuelle galerie à 150 px en niveaux de gris : les 3 boss sont distincts, lisibles dans les 5 thèmes.
- Interfaces utilisées / fournies : `ShapeId` (boss_1..boss_3), `BossId`, `ThemeEntityStyle`.

### CON-9 : Fond défilant : ciel, route, 5 voies, bords
- Priorité : P0
- Dépend de : CON-2, CON-5
- Description : Implémenter `drawBackground(ctx, theme, scrollY, t)` : dégradé de ciel `skyTop`→`skyBottom`, route `road` sur toute la largeur (5 voies de 72 px, premier couloir à x = 0), lignes de séparation pointillées exactement à x = 72, 144, 216, 288 qui défilent avec `scrollY` (modulo de la période, stable pour `scrollY` jusqu'à 1e7), bords `edge` sur les flancs. Le `CanvasGradient` est créé une fois par couple (contexte, thème) et mis en cache (`WeakMap` sur le contexte). Aucune allocation par frame. Premier appel quasi gratuit (rien de lourd à l'initialisation). Les constantes viennent de `src/constants.js` (`LANE_WIDTH`, `LANE_COUNT`, `LOGICAL_WIDTH`, `LOGICAL_HEIGHT`).
- Critères d'acceptation :
  - `node --test tests/content/background.test.js` : avec `scrollY = 0` et `scrollY = k x période` le journal de dessin est identique (périodicité) ; avec `scrollY = 1e7` et `t = 3600` aucun argument NaN ou Infinity ; les lignes de voie sont émises aux abscisses 72, 144, 216, 288 (±0,5) ; 100 appels consécutifs avec le même thème et le même contexte créent exactement 1 `createLinearGradient`.
  - Test de débit : 2 000 appels sur le faux contexte en moins de 300 ms.
  - Vérification visuelle (galerie, mode « défilement » à 60 px/s puis 600 px/s) : la route défile sans couture ni saccade, 4 lignes de séparation visibles, rendu correct dans les 5 thèmes.
- Interfaces utilisées / fournies : `SpriteRenderer.drawBackground`, `ThemeDef.palette`, `LANE_COUNT`, `LANE_WIDTH`, `LOGICAL_WIDTH`, `LOGICAL_HEIGHT`.

### CON-10 : Décor parallaxe par thème (buildings, trees, dunes, waves, stars)
- Priorité : P1
- Dépend de : CON-9, CON-4
- Description : Dans `drawBackground`, dessiner 2 à 3 bandes de décor parallaxes hors de la route et à l'horizon, selon `theme.scenery.kind` : `buildings` (silhouettes avec fenêtres), `trees` (arbres/buissons), `dunes` (courbes), `waves` (vagues animées par `t`), `stars` (étoiles scintillantes plus grille néon). Disposition déterministe : PRNG local (mulberry32) seedé par l'index de tuile, aucun `Math.random`. `density` pilote le nombre d'éléments par tuile. Facteurs de parallaxe 0,3 / 0,6 / 1,0 du `scrollY`. Le décor ne recouvre jamais la zone de route centrale 0..360 sauf éléments d'horizon explicitement derrière la route. Budget : moins de 400 opérations de dessin par frame à `density = 1`.
- Critères d'acceptation :
  - `node --test tests/content/scenery.test.js` : pour chacun des 5 thèmes, deux appels identiques produisent des journaux identiques (déterminisme) ; moins de 400 opérations à `density = 1` ; aucun NaN/Infinity pour `scrollY` de 0 à 1e7.
  - `grep -rn "Math.random" src/sprites` ne renvoie rien.
  - Vérification visuelle sur la galerie, les 5 thèmes : décor reconnaissable (immeubles, arbres, dunes, vagues, étoiles), continu au bouclage, 60 FPS tenus dans l'onglet performance du navigateur.
- Interfaces utilisées / fournies : `ThemeDef.scenery`, `SpriteRenderer.drawBackground`.

### CON-11 : AudioService : socle (autoplay, bus, activation, visibilité)
- Priorité : P0
- Dépend de : CON-1
- Description : Créer `src/audio/index.js` exportant `createAudio({ contextFactory, doc } = {})` conforme à `AudioService` (`contextFactory` par défaut : `new (window.AudioContext || window.webkitAudioContext)()`, injectable pour les tests). Contexte créé paresseusement : aucun `AudioContext` avant `unlock()`. `unlock()` idempotent : crée ou reprend le contexte (`resume()`), joue un buffer silencieux d'une frame (déblocage iOS Safari). Avant `unlock()`, `playSfx`, `setIntensity` ne font rien et ne lèvent pas ; `startMusic(theme)` mémorise le thème et démarre à l'`unlock()`. Graphe : `sfxBus` et `musicBus` → `master` (gain 0,8) → `DynamicsCompressor` → destination. `setSfxEnabled`/`setMusicEnabled` coupent par rampe de gain de 10 ms (nœuds conservés). `visibilitychange` : `suspend()` en arrière-plan, `resume()` au retour si débloqué. Écouteurs d'activation (`pointerdown`, `touchend`, `keydown`) en `capture` au niveau du document, fournis par `src/platform/` (CON-14) ou `main.js`, jamais bloquants (aucun `stopPropagation`).
- Critères d'acceptation :
  - `node --test tests/content/audio-core.test.js` (faux `AudioContext` dans `tests/content/helpers/fakeAudio.js`, compteur de nœuds vivants) : avant `unlock()` la fabrique n'est pas appelée ; deux `unlock()` → une seule création ; contexte `suspended` → un seul `resume()` ; `setSfxEnabled(false)` puis `playSfx('shot')` ne crée aucun nœud ; `startMusic` avant `unlock()` puis `unlock()` crée au moins un oscillateur.
  - Aucune exception si `contextFactory` lève (navigateur sans Web Audio) : le service devient un no-op.
  - Vérification manuelle : sur `http://localhost:8000/src/audio/lab.html` (page de test, un bouton par son, curseur d'intensité), aucun avertissement « AudioContext was not allowed to start » dans la console avant le premier clic.
- Interfaces utilisées / fournies : `AudioService` (`unlock`, `playSfx`, `startMusic`, `setIntensity`, `stopMusic`, `setSfxEnabled`, `setMusicEnabled`), `ThemeDef`. Fournit `createAudio` à main.js.

### CON-12 : Effets sonores synthétisés (13 SfxName) et nettoyage des nœuds
- Priorité : P0
- Dépend de : CON-11
- Description : `src/audio/sfx.js` : une recette de synthèse par `SfxName` (oscillateurs et enveloppes `GainNode` courtes, bruit blanc issu d'un unique buffer mis en cache pour `explosion`, `hit`, `kill`, `hurt`, `boss_dead`). Contraintes : durée <= 1,5 s (`boss_warn` <= 2 s) et `ui_click` <= 200 ms sans latence perceptible ; chaque voix se déconnecte sur `onended` de sa source (aucun nœud orphelin) ; polyphonie maximale de 16 voix, au-delà le son le moins prioritaire est ignoré (`shot` et `hit` les plus bas) ; limitation de débit par nom (`shot` 1 toutes les 60 ms, `hit` 40 ms, `coin` 50 ms) car ENGINE peut émettre jusqu'à 12 `shot`/s ; variation de hauteur ±3 % sur `shot`, `hit`, `coin` ; `gate_good` arpège montant, `gate_bad` glissando descendant. Un nom inconnu est ignoré.
- Critères d'acceptation :
  - `node --test tests/content/audio-sfx.test.js` : après `playSfx` des 13 noms puis avancée de l'horloge simulée de 3 s et déclenchement des `onended`, le nombre de nœuds vivants revient à la base (chaîne des bus) ; 100 `playSfx('shot')` à t identique créent au plus 1 voix ; 40 `explosion` simultanés ne dépassent jamais 16 voix actives ; `playSfx('nimporte')` ne lève pas.
  - Chaque recette a une durée planifiée <= 1,5 s (2 s pour `boss_warn`, 0,2 s pour `ui_click`), vérifiée via les temps d'arrêt enregistrés par le faux contexte.
  - Vérification d'écoute sur `src/audio/lab.html` : les 13 sons sont audibles, distincts, sans clic ni saturation ; `gate_good` sonne positif, `gate_bad` négatif.
- Interfaces utilisées / fournies : `SfxName`, `AudioService.playSfx`.

### CON-13 : Musique procédurale par thème et intensité pilotée
- Priorité : P1
- Dépend de : CON-11, CON-4
- Description : `src/audio/music.js` : séquenceur à planification anticipée (lookahead 100 ms, `setInterval` 25 ms, horloge `currentTime`) générant en boucle basse, arpège et percussion synthétisée à partir de `ThemeMusic` (`bpm`, `rootNote` MIDI, `scale` en demi-tons, `waveform`). Motif de 8 mesures déterministe (graine fixe par thème, mulberry32). `setIntensity(v)` (clampé [0, 1], `NaN` ignoré, rampe de 0,5 s) : 0 = basse douce, ~0,5 = + arpège, 1 = + percussion dense et filtre passe-bas ouvert, tempo inchangé. `stopMusic()` : fondu de 300 ms, puis arrêt des sources, `clearInterval`, déconnexion de tous les nœuds. `startMusic` pendant une musique active effectue un changement propre (fondu croisé de 300 ms, jamais deux chaînes vivantes). `setMusicEnabled(false)` met `musicBus` à 0 puis, après 1 s, suspend la planification (timer arrêté) pour économiser la batterie ; `setMusicEnabled(true)` relance proprement.
- Critères d'acceptation :
  - `node --test tests/content/audio-music.test.js` (horloge et timers simulés via `mock.timers` de `node:test`) : après `startMusic` et 10 s simulées, des notes sont planifiées ; après `stopMusic()` et 1 s, nœuds vivants = base et aucun timer actif ; 20 alternances `startMusic(a)`/`startMusic(b)` laissent une seule chaîne ; `setIntensity(-5)` → 0, `setIntensity(9)` → 1, `setIntensity(NaN)` ignoré.
  - Test : toutes les fréquences planifiées appartiennent à la gamme du thème (calcul MIDI) pour les 5 thèmes.
  - Test : le volume cible de `musicBus` vaut 0 quand la musique est désactivée.
  - Vérification d'écoute sur `lab.html` : les 5 thèmes sont musicalement distincts ; monter l'intensité de 0 à 1 enrichit le rendu sans coupure ni clic.
- Interfaces utilisées / fournies : `ThemeMusic`, `AudioService.startMusic`, `setIntensity`, `stopMusic`, `setMusicEnabled`.

### CON-14 : Vibration (createHaptics) et enregistrement PWA (src/platform)
- Priorité : P1
- Dépend de : CON-1
- Description : `src/platform/haptics.js` : `createHaptics({ nav } = {})` conforme à `HapticsService`. `light` 10 ms, `medium` 20 ms, `heavy` [40, 30, 40] ms via `navigator.vibrate` si disponible, sinon no-op silencieux (iOS Safari ne l'implémente pas) ; `setEnabled(false)` rend `trigger` inerte ; exceptions capturées ; limitation de débit de 50 ms entre deux déclenchements. `src/platform/pwa.js` : `registerServiceWorker({ nav, loc })` : enregistre `sw.js` (chemin relatif, scope racine) uniquement en contexte sûr (HTTPS ou `localhost`) ; sur `localhost`, uniquement si l'URL contient `?sw` (évite les caches périmés en développement) ; ne lève jamais ; expose `onUpdateReady(cb)` quand un nouveau SW est installé. `src/platform/activate.js` : `onFirstGesture(doc, cb)` écoute `pointerdown`, `touchend`, `keydown` en `capture`, appelle `cb` une seule fois puis retire ses écouteurs, sans jamais arrêter la propagation.
- Critères d'acceptation :
  - `node --test tests/content/platform.test.js` : `trigger('heavy')` appelle `vibrate([40,30,40])` ; `setEnabled(false)` puis `trigger` n'appelle rien ; 10 appels dans la même milliseconde → 1 vibration ; `nav` sans `vibrate` ne lève pas ; `vibrate` qui lève ne propage pas ; `registerServiceWorker` n'appelle pas `register` sur `http://exemple.com`, l'appelle sur `https://exemple.com`, ne l'appelle pas sur `http://localhost/` sans `?sw` et l'appelle avec `?sw` ; `onFirstGesture` appelle `cb` une fois pour trois événements successifs et ne contient aucun `stopPropagation`.
  - `grep -rn "stopPropagation" src/platform src/audio` ne renvoie rien.
  - Vérification manuelle sur Android (Chrome) : `light/medium/heavy` donnent trois sensations distinctes depuis une page de test `src/platform/lab.html`.
- Interfaces utilisées / fournies : `HapticsService`, `HapticKind`. Fournit `createHaptics`, `registerServiceWorker`, `onFirstGesture` à main.js.
- Statut : partiel (M1) - registerServiceWorker livré avec CON-19

### CON-15 : PWA : manifest.webmanifest, sw.js hors-ligne, icônes SVG
- Priorité : P1
- Dépend de : CON-1
- Description : `manifest.webmanifest` : `name` « Crowd Blast », `short_name`, `start_url: "./"`, `scope: "./"`, `display: "fullscreen"` avec repli `standalone` (`display_override`), `orientation: "portrait"`, `background_color` et `theme_color` cohérents avec le thème zombies, icônes SVG (`icons/icon.svg` en `sizes: "any"`, `icons/maskable.svg` avec `purpose: "maskable"`). `icons/` : SVG dessinés à la main (aucun binaire) ; lien `apple-touch-icon` vers un SVG dans `index.html` (iOS ne l'accepte pas toujours : limite connue, voir H4). `sw.js` : `CACHE_VERSION` en constante en tête de fichier (noms de cache préfixés `crowdblast-`), liste `PRECACHE` de tous les fichiers de l'application (index, manifest, icônes, tous les `.js` et `.css` sous `src/` utilisés au runtime, y compris `src/meta/*.js`, `src/ui/*.js`, `src/ui/styles.css`, `src/engine/**`, exclus : `*.html` de laboratoire/galerie, `tests/`, `tickets/`, `SPEC.md`), évènement `install` (précache + `skipWaiting`), `activate` (purge des anciennes versions + `clients.claim`), `fetch` : stratégie « stale-while-revalidate » pour les GET de même origine, repli sur `index.html` hors-ligne pour les navigations, rien pour les autres origines. La liste `PRECACHE` est maintenue à la main mais un test garantit sa complétude.
- Critères d'acceptation :
  - `node --test tests/content/pwa.test.js` : le manifest est du JSON valide avec `name`, `start_url`, `display`, `orientation: "portrait"`, au moins une icône dont le fichier existe sur disque ; chaque chemin de `PRECACHE` existe sur disque ; chaque fichier `.js`/`.css` présent sous `src/` (hors galeries, `lab.html`, `preview.html`, `*.d.ts`) figure dans `PRECACHE` (échec nommant le fichier manquant) ; `CACHE_VERSION` est défini ; `sw.js` ne contient aucun `import(` ni dépendance externe ; aucun fichier binaire (`.png .jpg .gif .webp .mp3 .ogg .wav`) dans le dépôt hors `node_modules` inexistant.
  - Test de logique : le gestionnaire `fetch` de `sw.js` (chargé dans un contexte `vm` avec faux `self`, `caches`, `fetch`) répond depuis le cache quand le réseau est coupé.
  - Vérification manuelle : après `python3 -m http.server 8000`, ouverture de `http://localhost:8000/?sw`, DevTools > Application affiche le manifest sans erreur, le SW actif et le cache rempli ; en mode avion le jeu se recharge et une run se lance.
- Interfaces utilisées / fournies : aucune interface de `contracts.d.ts`. Fournit le précache que META et ENGINE alimentent en ajoutant des fichiers (le test CON-15 les détecte).

### CON-16 : Intégration finale : src/main.js et src/platform/wire.js
- Priorité : P0
- Dépend de : CON-4, CON-5, CON-9, CON-11, CON-12, CON-14 ; livraisons ENGINE (`createEngine`) et META (`createMetaService`, `createUi`)
- Description : Séparer le câblage testable (`src/platform/wire.js`, aucune référence à `document`/`window`) du point d'entrée DOM (`src/main.js`). `wire({ meta, ui, engine, audio, haptics, sprites, getTheme, now, random })` assemble : `meta.onSettingsChanged(s => { audio.setSfxEnabled(s.sfx); audio.setMusicEnabled(s.music); haptics.setEnabled(s.haptics); })` appelé aussi une fois au démarrage avec `meta.getSave().settings` ; `ui.onSfx(name => audio.playSfx(name))` (vibration `medium` seulement sur `chest_open`, pas sur `ui_click`) ; hooks d'`engine` : `onSfx → audio.playSfx`, `onHaptic → haptics.trigger`, `onStats → ui.updateHud` plus intensité musicale, `onRunEnd → ui.showResult(meta.applyRunResult(result, themeId), result)` puis `audio.stopMusic()`, `onReviveOffer → ui.askRevive()` si présent, sinon `Promise.resolve(false)` ; `ui.onPlayRequested`/`onRetryRequested` → `meta.buildRunConfig(getTheme(save.selectedTheme), seed)`, `ui.show('run')`, `audio.startMusic(theme)`, `engine.start(config)` ; `ui.onHomeRequested` → `engine.quit()` si run en cours, `audio.stopMusic()`, `ui.show('home')` ; `ui.onPauseRequested/onResumeRequested/onQuitRequested` → `engine.pause/resume/quit` (et suspension musicale sur pause) ; `ui.onThemeSelected → meta.selectTheme`. Intensité : `clamp((speed − SPEED_MIN) / (SPEED_MAX − SPEED_MIN), 0, 1)` et `max(…, 0.9)` quand `bossActive`, lissée (moyenne exponentielle, τ = 1 s) ; valeurs min/max : voir Demandes à ENGINE. Seed : `(now() ^ (random() * 2**32)) >>> 0`. `main.js` : récupère `#game` et `#ui`, crée sprites, audio, haptique, `meta = createMetaService()`, `ui = createUi({ root, meta, themes: THEMES, sprites })`, `engine = createEngine(canvas, sprites, hooks)`, appelle `onFirstGesture(document, () => audio.unlock())`, `registerServiceWorker()`, pause automatique sur `visibilitychange` (hidden) avec reprise via l'UI de pause, gestion du redimensionnement (reprend le code de CON-1). Aucune logique de jeu dans `main.js` ni `wire.js`.
- Critères d'acceptation :
  - `node --test tests/content/wire.test.js` (faux meta, ui, engine, audio, haptics) : une séquence play → `onRunEnd` appelle dans l'ordre `buildRunConfig`, `ui.show('run')`, `startMusic`, `engine.start`, `applyRunResult`, `showResult`, `stopMusic` ; `Rejouer` répété 5 fois de suite relance 5 runs sans refus (aucune limite de parties) ; les réglages sont propagés au démarrage et à chaque changement ; `onReviveOffer` renvoie `false` si `ui.askRevive` est absent ; intensité = 0 à `speed = SPEED_MIN`, 1 à `SPEED_MAX`, >= 0,9 avec `bossActive`, toujours dans [0, 1].
  - Vérification visuelle (`python3 -m http.server 8000`, navigateur mobile ou émulé) : accueil → Jouer → le fond du thème défile, la foule tire, perte, écran de résultat, Rejouer relance, Accueil revient ; le tout sans erreur console.
  - Changer de thème dans l'écran de sélection change palette, sprites et musique à la run suivante.
  - Aucun `AudioContext` n'est créé avant le premier geste (vérifié dans DevTools : pas d'avertissement d'autoplay).
  - Première run : premier frame à l'écran moins de 2 s après l'ouverture sur émulation « 4x CPU slowdown » (Performance > Throttling).
  - `grep -rn "document\.\|window\." src/platform/wire.js` ne renvoie rien.
- Interfaces utilisées / fournies : `CreateEngine`, `EngineHooks`, `SpriteRenderer`, `AudioService`, `HapticsService`, `MetaService`, `UiController`, `RunLiveStats` (`speed`, `bossActive`), `onSettingsChanged`, `onReviveOffer`.

### CON-17 : Test de fumée du livrable statique
- Priorité : P0
- Dépend de : CON-15, CON-16
- Description : `tests/content/smoke.test.js` sans dépendance : (1) démarre un serveur HTTP statique `node:http` sur un port libre qui sert la racine du dépôt ; (2) récupère `/index.html`, vérifie `#game`, `#ui`, `<script type="module" src="src/main.js">`, le lien `manifest.webmanifest` ; (3) explore récursivement le graphe d'imports statiques (`import ... from './x.js'`, `import('./x.js')`) à partir de `src/main.js` et vérifie que chaque fichier répond 200 en type JavaScript, avec casse de nom exacte (important pour Linux/GitHub Pages) ; (4) vérifie le budget : somme des fichiers servis par le graphe plus `index.html` < 200 Ko non compressés ; absence de fichier binaire d'asset (`.png .jpg .jpeg .gif .webp .mp3 .ogg .wav .woff .woff2` ; `find . -type f` filtré) vérification que `package.json` est exactement le fichier minimal attendu (clés `name`, `private`, `type: module` seulement) et absence de `tsconfig.json`, `vite.config.*`, `node_modules` ; (5) exécution headless : importe `createEngine`, `createSpriteRenderer`, `THEMES` avec un faux canvas/contexte et un `requestAnimationFrame` simulé, lance 10 s de run simulées pour chacun des 5 thèmes, appelle `draw` pour les 16 `ShapeId` et `drawBackground`, puis `quit()` ; n'échoue pas sur un module absent mais le signale explicitement par `t.skip` nommé (pour le jalon M1) ; (6) aucun `console.error` pendant l'exécution. Ajoute un script `tests/content/run-all.sh` (une ligne : `node --test`) documenté dans le README.
- Critères d'acceptation :
  - `node --test tests/content/smoke.test.js` sort avec le code 0 en moins de 30 s.
  - Test : injecter dans une copie temporaire un import vers un fichier inexistant fait échouer le test en nommant le fichier ; un `.png` ajouté dans `icons/` le fait échouer.
  - `node --test` (sans argument, tous les rôles) est vert à M3.
  - La taille totale rapportée est affichée dans la sortie du test (`console.log` lisible).
- Interfaces utilisées / fournies : `CreateEngine`, `SpriteRenderer`, `ThemeDef`, `ShapeId`.

### CON-18 : README
- Priorité : P2
- Dépend de : CON-15, CON-16
- Description : `README.md` en anglais : présentation du jeu, prérequis (navigateur récent, Node >= 22.7 pour les tests uniquement, Python 3 pour servir), lancement local (`python3 -m http.server 8000`, URL à ouvrir, astuce mode mobile des DevTools), tests (`node --test`, sans argument), structure du dépôt (SPEC §5), comment ajouter un thème (données pures + test CON-3), galeries et pages de laboratoire (`src/sprites/gallery.html`, `src/audio/lab.html`, `src/platform/lab.html`, `src/ui/preview.html`), PWA (`?sw` en local, procédure de mise à jour : incrémenter `CACHE_VERSION`, installation sur écran d'accueil Android/iOS, limites iOS), hébergement statique (GitHub Pages, tout hébergeur de fichiers), budget (200 Ko, aucun asset), étape future « emballage store (Capacitor ou équivalent) » en une section courte et non implémentée, limites connues.
- Critères d'acceptation :
  - Un test `tests/content/readme.test.js` vérifie que les commandes citées (`python3 -m http.server`, `node --test`) apparaissent, que chaque chemin de fichier du README entre backticks et commençant par `src/`, `tests/`, `icons/` existe sur disque, et que le mot « npm » n'apparaît que dans une phrase de type « no npm » ; le README ne contient ni `node --test tests/` ni mot français courant d'une liste de contrôle.
  - Relecture : un nouveau lecteur lance le jeu en suivant uniquement le README (vérification manuelle).
- Interfaces utilisées / fournies : aucune.

### CON-19 : Dev sur smartphone (dev.sh, mode ?debug, SW désactivé en dev, guide README)
- Priorité : P0
- Dépend de : CON-1
- Description : (1) `dev.sh` à la racine (POSIX sh, exécutable) : détecte l'IP LAN (`hostname -I` puis repli `ip route get 1.1.1.1`, puis `ifconfig`), accepte un port optionnel (`./dev.sh 9000`, défaut 8000), affiche « Ouvrir sur le téléphone (même wifi) : http://<ip>:<port>/?debug » et l'URL locale, puis lance `python3 -m http.server <port> --bind 0.0.0.0` (aucun serveur sur mesure : `python3 -m http.server` seul ; le contournement du cache est assuré côté page par `?debug`, voir (3)) ; échec explicite et code de sortie 1 si `python3` est absent ou si le port est occupé. (2) Mode `?debug` : `src/platform/debug.js` exporte `isDebug(loc)` et `createDebugOverlay({ doc, now })` (module sans DOM au chargement) : overlay `<div>` fixe en haut à gauche, `pointer-events: none`, police monospace 11 px, fond semi-transparent, affichant FPS (moyenne glissante sur 30 frames), seed de la run en cours, distance (m), taille de la foule, et vitesse ; rafraîchi au plus 4 fois par seconde, aucune allocation par frame (texte écrit via `textContent` d'un seul nœud). Alimenté par `wire.js` : `onStats` (distance, crowd, speed) et la seed calculée au démarrage de run ; le FPS est mesuré par `requestAnimationFrame` indépendant du moteur. Hors `?debug`, rien n'est créé. `?debug` active aussi `console.info` des erreurs non capturées (`window.onerror` et `unhandledrejection` affichés dans l'overlay en rouge, pour déboguer sans console sur téléphone). (3) Service worker : `registerServiceWorker` (CON-14) n'enregistre rien en `?debug`, ni hors contexte sécurisé (`isSecureContext` faux, ce qui est le cas de `http://<ip-lan>:8000`), ni sur `localhost` sans `?sw` ; en `?debug`, il désinscrit en plus tout SW existant pour le scope et vide les caches `crowdblast-*` (`caches.keys()`), puis ne recharge pas la page. (4) Section README « Play on your phone (dev mode) » (en anglais) pas à pas : prérequis (ordinateur et téléphone sur le même wifi, `python3` installé, pare-feu local autorisant le port), `./dev.sh`, ouverture de l'URL affichée ; Android (Chrome) : ouvrir l'URL, menu ⋮ > « Ajouter à l'écran d'accueil » (en HTTP LAN, c'est un raccourci, pas une PWA installable : voir CON-20), inspection à distance via `chrome://inspect` en USB ; iPhone (Safari) : ouvrir l'URL, bouton Partager > « Sur l'écran d'accueil » (affichage plein écran via `apple-mobile-web-app-capable`), inspection via Safari de bureau en USB ; dépannage (téléphone sur un autre réseau, wifi « invité » avec isolation des clients, VPN actif, adresse 127.0.0.1 inutilisable depuis le téléphone, onglet qui sert une version en cache : ajouter `?debug`). Ajouter dans `index.html` les balises `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` et `apple-mobile-web-app-title`. Jalon M1 : sont livrés `dev.sh`, `debug.js` avec le FPS, la règle du service worker et la section README ; l'alimentation de l'overlay par les stats du moteur (seed, distance, foule, vitesse) est livrée par CON-16 (M2).
- Critères d'acceptation :
  - `sh -n dev.sh` sort avec le code 0 ; `./dev.sh` affiche une ligne contenant `http://` suivie d'une adresse IPv4 non `127.0.0.1` (si une interface réseau existe) et le port ; `curl -s http://<ip>:8000/ -o /dev/null -w '%{http_code}'` renvoie `200` pendant que le script tourne ; lancé deux fois, le second lancement échoue avec un message « port occupé » et le code 1.
  - `node --test tests/content/debug.test.js` : `isDebug('?debug')`, `isDebug('?a=1&debug')` vrai, `isDebug('?debugger')` faux ; l'overlay avec faux DOM n'écrit pas plus de 4 fois par seconde (horloge simulée) ; sans `?debug` aucun nœud n'est créé ; `registerServiceWorker` n'appelle pas `register` avec `?debug` même en contexte sécurisé, et appelle `unregister` sur les SW existants ; pas de `register` quand `isSecureContext` est faux.
  - Vérification visuelle sur un vrai téléphone (même wifi) : `http://<ip>:8000/?debug` affiche la page et l'overlay avec FPS ~60 (M1), puis seed, distance qui augmente et foule une fois CON-16 livré ; `http://<ip>:8000/src/engine/dev.html` permet de jouer au socle du moteur dès M1 ; une modification d'un fichier sur l'ordinateur est visible après rechargement simple de la page (aucune version périmée).
  - `grep -n "debug" src/main.js` montre l'import dynamique conditionnel : sans `?debug`, `debug.js` n'est pas chargé (onglet Réseau).
  - Test CON-15 (précache) : `src/platform/debug.js` figure dans `PRECACHE` ; `dev.sh` n'y figure pas.
- Interfaces utilisées / fournies : utilise `RunLiveStats` (`distanceM`, `crowd`, `speed`) via `onStats` et la seed de `RunConfig` ; fournit `isDebug`, `createDebugOverlay` à main.js et wire.js. Aucune demande de changement de contrat.
- Statut : fait (M1) - overlay seed/distance/foule alimenté en CON-16 ; dev.sh (port 8000, « port already in use » code 1, IP Darwin en0/en1 d'abord, filtre Tailscale/docker/tunnels), debug.js (FPS 30 frames, 4 écritures/s), pwa.js ne fait que désinscrire en ?debug en M1, README sections « Play on your phone » et « Stale code on phone » ; test téléphone réel : à faire par l'utilisateur.

### CON-20 : Déploiement HTTPS (GitHub Pages) pour une PWA installable (optionnel : dépôt privé)
- Priorité : P1
- Dépend de : CON-15, CON-19
- Description : Créer `.github/workflows/pages.yml` (périmètre CONTENT étendu à `.github/`) : déclencheurs `push` sur `main` et `workflow_dispatch` ; `permissions: { contents: read, pages: write, id-token: write }` ; `concurrency: { group: pages, cancel-in-progress: true }` ; job `test` : `actions/checkout`, `actions/setup-node` (Node 22), `node --test` (le déploiement échoue si les tests échouent) ; job `deploy` (`needs: test`, `environment: github-pages`) : prépare un dossier `_site/` par copie sélective (`index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `src/` sans `*.d.ts` ni galeries/`lab.html`/`preview.html`) puis `actions/configure-pages`, `actions/upload-pages-artifact` (path `_site`), `actions/deploy-pages`. Aucun build, aucune étape npm. Les actions sont épinglées à une version majeure explicite (v4/v5 selon la dernière disponible) et listées en commentaire. L'application doit fonctionner sous un sous-chemin (`https://<user>.github.io/<repo>/`) : tous les chemins sont relatifs (`start_url: "./"`, `scope: "./"`, enregistrement du SW par chemin relatif, pas de `/src/...` absolu), vérifié par un test. Ajouter `.nojekyll` à la copie. Section README « Deploy over HTTPS (optional) » (en anglais) : activer Pages (Settings > Pages > Source : GitHub Actions), pousser sur `main`, URL résultante, installation PWA sur Android (Chrome : « Installer l'application ») et iPhone (Safari : « Sur l'écran d'accueil »), mise à jour (incrémenter `CACHE_VERSION` de `sw.js`), et rappel que le dépôt privé peut exiger un plan GitHub payant pour Pages (vérifier, voir H15).
- Critères d'acceptation :
  - `node --test tests/content/deploy.test.js` : le YAML de `.github/workflows/pages.yml` (lecture texte, sans parseur externe) contient `actions/deploy-pages`, `actions/upload-pages-artifact`, `pages: write`, `id-token: write`, `node --test`, et ne contient ni `npm`, ni `yarn`, ni `pnpm` ; `grep -rEn "(src|href)=\"/[^/]" index.html` et `grep -rEn "from '/|import\('/|fetch\('/" src sw.js` ne renvoient rien (aucun chemin absolu) ; `manifest.webmanifest` : `start_url` et `scope` valent `"./"` ; `sw.js` n'utilise que des chemins relatifs dans `PRECACHE`.
  - Test : la liste de copie du workflow couvre tous les fichiers du `PRECACHE` (chaque entrée de `PRECACHE` est atteinte par une des règles de copie).
  - Serveur local en sous-dossier : `mkdir -p /tmp/x/jeu && cp -r index.html manifest.webmanifest sw.js icons src /tmp/x/jeu && python3 -m http.server 8000 -d /tmp/x` puis `http://localhost:8000/jeu/` charge le jeu sans 404 (vérification visuelle).
  - Après un `push` sur `main` du dépôt de l'utilisateur : l'onglet Actions montre `test` et `deploy` verts ; l'URL HTTPS affichée charge le jeu ; sur Android Chrome le bandeau/menu propose « Installer l'application » ; DevTools > Application > Manifest ne signale aucune erreur d'installabilité ; en mode avion le jeu se relance. (Vérification manuelle par l'utilisateur ; non exécutable ici, pas de dépôt GitHub ni d'accès.)
  - Le README contient les deux sections et `node --test tests/content/readme.test.js` (CON-18) reste vert.
- Interfaces utilisées / fournies : aucune interface de `contracts.d.ts`.

---

## Accords

### Avec ENGINE
- Accepté : tailles d'appel d'ENGINE (hero/ally 28, walker 26, runner 24, brute 42, exploder 30, spitter 28, wreck 48, barrel 28, oncoming 52, wall 72 x n voies via `opts.width`) : elles remplacent mes tailles de première version ; les sprites sont testés à ces tailles (CON-6 à CON-8) et tiennent de 12 à 120 px.
- Accepté : `wall` en un seul appel avec `opts.width` (décision Product), `size` étant sa hauteur ; segments raccordés tous les 72 px (CON-7).
- Accepté : `drawBackground` appelé une fois par frame avant les entités, `scrollY` cumulé croissant, route sur 360 px, lignes de voie exactement à x = 72, 144, 216, 288 (CON-9) ; `draw` sans effet de bord hors ctx, sans allocation, mémorisation par couleur ; `flash` tout en blanc ; `gore: 'soft'` sans rouge ni sang réaliste.
- Accepté : `bullet` dessiné avec le style construit par ENGINE (`color`, `accentColor` = `glow`, `shape: 'bullet'`) ; limite de voix audio pour les 12 `shot`/s ; câblage des hooks et de l'intensité musicale par main.js à partir de `RunLiveStats.speed` et `bossActive` ; victoire de boss sans fin de run (aucun impact sur moi).
- Accepté : ENGINE dessine l'ombre d'`oncoming`, les portes, projectiles ennemis, particules, texte flottant et barre de vie du boss.
- Refusé : le « CON-1 scaffold npm/Vite/Vitest » (tsconfig, Vite) demandé dans l'ancienne version de ses tickets, caduc avec la nouvelle stack ; remplacé par CON-1 (squelette statique). Ses tests `*.test.ts` sont à convertir en `tests/engine/*.test.js` par ENGINE.
- Laissé ouvert : normalisation de l'intensité. J'ai besoin de `SPEED_MIN` et `SPEED_MAX` (px logiques/s) exportés par un module sans DOM d'ENGINE (proposition : `src/engine/balance.js`). Sans réponse, `wire.js` utilise des constantes locales provisoires (H6).
- Laissé ouvert : `start()` rappelable juste après `onRunEnd` sans `destroy()` (demande de META que je relaie : `wire.js` en dépend pour « Rejouer »).

### Avec META
- Accepté : signatures par objets d'options `createMetaService({ storage, clock, rng })` (appelée sans argument par main.js) et `createUi({ root, meta, themes, sprites })`, qui remplacent mes signatures positionnelles ; exports `createMetaService`, `createUi` depuis `src/meta/index.js` et `src/ui/index.js`.
- Accepté : `onSettingsChanged` propagé à audio et vibration, avec un appel initial ; `ui.onSfx` relayé vers `audio.playSfx` (`ui_click` < 200 ms, `coin`, `chest_open`) ; le premier geste débloque l'audio via `onFirstGesture` (capture, sans `stopPropagation`).
- Accepté : `sprites.draw` utilisable sur de petits canvas (40 à 96 px) avec `t` fourni par l'UI (CON-5) ; `drawBackground` non requis dans les menus.
- Accepté : ajout de `src/meta/*.js`, `src/ui/*.js`, `src/ui/styles.css` au précache ; mieux, le test CON-15 détecte tout `.js`/`.css` manquant sous `src/`, donc plus de liste à synchroniser à la main côté META (`src/ui/preview.html` exclu).
- Accepté : aucune énergie, aucune pub : `main.js` lance directement la run à `onPlayRequested` et `onRetryRequested` ; `askRevive` (paiement en pièces par META) est branché sur `onReviveOffer`.
- Accepté, avec nuance : vibration sur interface seulement pour `chest_open` (`medium`) via `ui.onSfx` ; refus d'une vibration sur `ui_click` (fatigue et batterie).
- Refusé : aucune demande de META refusée sur le fond. Le `package.json` minimal `{"type":"module"}` est fourni par le Product à la racine (SPEC §4) ; je ne l'étends pas.

### Avec le Product (SPEC.md)
- Accepté et intégré (SPEC §0 à §5) : jeu 100 % local sans pub, achat, classement ni énergie ; interface et README en anglais ; nom Crowd Blast ; `package.json` minimal fourni ; icônes SVG uniquement ; seul `chest_open` vibre côté interface ; `SPEED_MIN`/`SPEED_MAX` importés de `src/engine/balance.js` (H6 devient : constantes locales provisoires uniquement tant que ce fichier n'existe pas).
- Accepté : ajout de `.github/` et de `dev.sh` à mon périmètre (CON-19, CON-20).
- Laissé ouvert : sur iPhone, l'ajout à l'écran d'accueil avec icône SVG peut donner une icône générique (H4) ; accepté en v1.
- Accepté : `opts.width`, `opts.colorblind`, `RunLiveStats.speed` et `bossActive`, `onSettingsChanged`, `UiController.onSfx`, AudioService sans `dispose`, `onReviveOffer`, victoire de boss sans fin de run, stack JavaScript sans build.
- Accepté : icônes SVG uniquement en v1 (limite iOS documentée en H4) ; support Node minimal : H1.

---

## Demandes aux autres agents

### À ENGINE
1. Exporter `createEngine` depuis `src/engine/index.js` (nom exact), sans effet de bord à l'import et sans accès à `document`/`window` au chargement du module (le test de fumée CON-17 l'importe sous Node).
2. Exporter `SPEED_MIN` et `SPEED_MAX` (px logiques par seconde, vitesse de départ et plafond) depuis `src/engine/balance.js` (ou dire où ils sont).
3. `RunLiveStats.speed` toujours défini (nombre fini) à chaque `onStats`, `bossActive` cohérent avec `bossHp !== null`.
4. Événements sonores, au plus une fois par événement logique : `shot` à chaque volée, `hit` à chaque impact, `kill` à chaque mort, `gate_good`/`gate_bad` au franchissement, `explosion` pour baril/exploder, `hurt` à chaque perte de tireur, `boss_warn` au moins 1,5 s avant l'entrée du boss, `boss_dead` à sa mort, `coin` au ramassage, `run_end` juste avant `onRunEnd`. `ui_click`, `chest_open`, `coin` d'interface viennent de META.
5. Haptique : `heavy` réservé à la mort du boss et à la fin de run, `medium` à la perte de tireur et aux portes malus, `light` aux portes bonus et aux kills groupés (pas à chaque tir ni chaque impact).
6. `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` et état de contexte propre (`globalAlpha`, `fillStyle`, `shadowBlur`) faits par ENGINE avant chaque frame ; mes fonctions font `save/restore`. Merci d'appeler `drawBackground` avec un `t` monotone, gelé pendant la pause.
7. Portes : symbole (+, x, -, /) en plus de la couleur pour le mode daltonien. Merci d'utiliser `theme.palette.gateGood`, `gateBad`, `danger`, `accent`, `text` pour tout ce que vous dessinez vous-mêmes.
8. `quit()` et `destroy()` sûrs si appelés deux fois ; `start()` rappelable juste après `onRunEnd` ; premier frame en moins de 300 ms.
9. Fichiers du moteur en `.js` sans dépendance : le précache est contrôlé automatiquement par CON-15, mais tout fichier chargé dynamiquement par `fetch` ou `import()` avec un chemin calculé échappe à mon analyse ; merci d'éviter les `import()` à chemin dynamique.

### À META
1. `createUi` : accepter l'absence de `sprites` ; fournir `askRevive()` ; ne jamais appeler `stopPropagation` sur les `pointerdown` du document ; `#ui` laisse passer les événements tactiles hors boutons (`pointer-events: none` hors contrôles).
2. `src/ui/styles.css` : chargé par `createUi` ; chemin relatif calculé via `import.meta.url` (pas d'URL absolue `/src/...`, pour supporter un hébergement en sous-dossier, par exemple GitHub Pages).
3. Tout autre chemin de fichier statique chargé hors `import` (fetch, `<link>`) doit être relatif à `import.meta.url`.
4. Déclarer toute police externe : aucune (polices système uniquement), conformément à votre hypothèse 10.
5. Exposer `meta.getSave().selectedTheme` valide parmi les 5 `ThemeId` ; `getTheme` retourne le thème par défaut sinon.

### Pour CON-19 et CON-20
- À ENGINE : exposer la seed de la run et `distanceM`/`crowd`/`speed` via `onStats` suffit ; aucune demande supplémentaire (la seed est calculée par `wire.js`). Aucun chemin absolu (`/src/...`) dans les `import()` ni `fetch`.
- À META : `src/ui/styles.css` et tout fichier chargé hors `import` doivent être relatifs à `import.meta.url` (déjà demandé), faute de quoi le jeu casse sous le sous-chemin `/<repo>/` de GitHub Pages.
- À tous : les fichiers de laboratoire (`gallery.html`, `lab.html`, `preview.html`) ne sont pas publiés par le workflow ; ne pas les référencer depuis le jeu.

### Au Product
1. (Réglé) `package.json` minimal fourni par le Product à la racine (SPEC §4).
2. (Réglé) SVG uniquement en v1 (SPEC §4).
3. (Réglé) Aucune interstitielle : le jeu n'a pas de pub (SPEC §0).

---

## Hypothèses

- H1 : Node >= 22.7 recommandé ; les fichiers `.js` sont des modules ES grâce au `package.json` minimal de la racine (fourni par le Product). Les tests de CONTENT sont des `.test.js` lancés par `node --test`. Vérifié ici : Node 22.22.
- H2 : Les couleurs de thème sont uniquement `#rrggbb` (pas de `rgb()`, `hsl()` ni de noms CSS) pour permettre le calcul des contrastes.
- H3 : Les seuils de contraste de CON-3 (texte 4,5 ; portes, danger, balle, héros, alliés, accent 3 ; ennemis, obstacles, boss 2,5 ; ligne de voie 1,4 ; luminance bonne/mauvaise porte >= 1,5) sont des choix de CONTENT modifiables par le Product.
- H4 : Les icônes sont des SVG ; Chrome Android accepte une icône SVG `sizes: "any"` pour l'installation récente, mais iOS Safari ignore souvent le SVG pour `apple-touch-icon` : en v1, l'ajout à l'écran d'accueil iOS peut afficher une capture de page ou une icône générique. Limite documentée dans le README.
- H5 : Géométrie : route sur toute la largeur logique (5 voies de 72 px, centres x = 36, 108, 180, 252, 324), cohérente avec ENGINE.
- H6 : `SPEED_MIN`/`SPEED_MAX` sont importés de `src/engine/balance.js` (SPEC §2 et §4). Tant que ce fichier n'existe pas, `wire.js` utilise un repli provisoire de 300 et 900 px/s dans une seule constante, retiré à la livraison d'ENGINE.
- H7 : Mes tests utilisent des faux maison (contexte 2D, `AudioContext`, `navigator`, `localStorage`) dans `tests/content/helpers/` ; le rendu et le son réels sont validés visuellement et à l'écoute sur les pages de laboratoire (`gallery.html`, `lab.html`).
- H8 : Les pages de laboratoire et galeries ne sont ni précachées ni publiées comme parties du jeu (exclues du budget de 200 Ko du test de fumée).
- H9 : Le service worker utilise « stale-while-revalidate » ; une nouvelle version n'est visible qu'au second chargement. Mise à jour : incrémenter `CACHE_VERSION` à chaque livraison (rappel dans le README).
- H10 : Le thème n'influence pas la simulation (même seed, même run quel que soit le thème), seul le rendu et la musique changent.
- H11 : La seed d'une run est tirée par main.js, META ne la fournit pas.
- H12 : 20 tickets, dont CON-18 (README) sacrifiable en cas de retard ; la galerie de sprites est incluse dans CON-5. CON-19 et CON-20 ajoutent chacun une section au README (si CON-18 est tardif, ces sections sont écrites dans CON-19/CON-20 puis fusionnées).
- H13 : Le téléphone de développement accède au poste par `http://<ip-lan>:8000`, un contexte non sécurisé : service worker, installation PWA et certaines API y sont indisponibles par conception. Le mode dev sur téléphone ne teste donc pas le hors-ligne ni l'installabilité ; ces deux points se vérifient via CON-20 (HTTPS).
- H14 : `dev.sh` cible Linux et macOS (sh POSIX) ; sous Windows, la commande manuelle `python -m http.server 8000 --bind 0.0.0.0` est documentée dans le README, sans script dédié.
- H15 : GitHub Pages est gratuit pour les dépôts publics ; le dépôt `crowd-blast` étant privé, Pages peut exiger un plan payant selon le compte (à vérifier par l'utilisateur). CON-20 est donc optionnel : la voie principale pour jouer sur téléphone est `./dev.sh` (CON-19). Le workflow ne peut pas être exécuté ni vérifié sans remote GitHub.
- H16 : Le Wi-Fi du téléphone et celui de l'ordinateur doivent être le même réseau sans isolation des clients ; sinon `dev.sh` n'est pas utilisable et le déploiement CON-20 sert de repli.
