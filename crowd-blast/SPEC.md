# Crowd Blast – Spec produit et technique (v1, stack légère)

Rôle : Product. Ce document est la source de vérité. Les agents de dev ne le modifient pas ; ils proposent des changements via leurs tickets (section "Demandes"). En cas de contradiction entre un ticket et ce document, ce document gagne. `src/contracts.d.ts` et `src/constants.js` complètent ce document pour les interfaces.

## 0. Décisions figées de l'utilisateur

- Nom du jeu : **Crowd Blast**. Repo GitHub privé `crowd-blast`.
- Usage : jouer sur son smartphone, en local. **Aucune publicité, aucun achat intégré, aucun classement en ligne, aucun compte, aucun réseau.** Le jeu est 100 % local.
- Interface du jeu en **anglais uniquement**. Thème par défaut : **zombies**. Niveau de gore par défaut : **doux** (`soft`).
- **Plus d'énergie** : on peut rejouer immédiatement, sans limite.
- **Réanimation** : une seule fois par run, payée en pièces (coût fixe 100, constante dans `src/meta/balance.js`).
- **Coffres** : gratuits, ouverture immédiate (aucun minuteur).
- Le **pouvoir spécial** (appui long) est dans la v1 mais **en dernier** : c'est le dernier ticket réalisé (ENG-15).
- Stack la plus légère possible : voir §4. Aucune dépendance, aucun build.
- Workflow git : **une branche et une pull request par jalon** (M1, M2, M3). L'utilisateur relit et merge. Messages de commit en anglais.

## 1. Produit

Jeu mobile arcade : un tireur avance seul sur une voie infinie à 5 couloirs, tire automatiquement, et le joueur glisse le doigt pour choisir sa voie. Des portes à multiplicateur font grossir la foule et le feu. Des ennemis, obstacles et boss de palier barrent la route. Parties de 45 à 90 s, une seule main, portrait.

Thèmes interchangeables, définis en données (aucun code spécifique à un thème) :

| id | Nom affiché | Voie | Héros | Foule |
| --- | --- | --- | --- | --- |
| zombies | Highway Z | autoroute | tireur | tireurs |
| cyber | Neon Lane | périphérique néon | pilote de mecha | drones alliés |
| fantasy | Kingsroad Archer | route du royaume | archer | archers |
| western | Dust Trail | piste du désert | pistolero | cow-boys |
| pirates | Endless Tide | fleuve | capitaine | équipage |

Thème par défaut au premier lancement : zombies. Les autres se choisissent dans un écran de sélection (tous débloqués dès le début).

## 2. Règles de gameplay (v1)

- 5 voies, indices 0 à 4, la voie centrale est 2.
- Contrôle : glisser horizontalement. La position X du joueur suit le doigt, lissée, et se cale visuellement sur la voie la plus proche. Toucher long : pouvoir spécial si la barre est pleine (dernier ticket, ENG-15).
- Tir automatique vers l'avant. Cadence et dégâts dépendent de l'arme, des améliorations et des portes.
- Foule : un nombre N de tireurs (1 à 60 affichés, au-delà le nombre est un compteur). Chaque tireur contribue à la cadence.
- Portes (franchies en les traversant) : `+N` tireurs, `xN` tireurs, `fire_rate +%`, `damage +%`, `pierce +1`, et portes malus rouges `-N`, `/2`. Une porte occupe 1 à 2 voies.
- Ennemis (5 types logiques) : `walker`, `runner`, `brute`, `exploder`, `spitter`. Contact avec la foule : -1 tireur et l'ennemi meurt (sauf brute : -2).
- Obstacles : `wreck` (bloque une voie, destructible avec beaucoup de dégâts), `barrel` (explose, tue autour), `oncoming` (traverse en sens inverse, ombre d'avertissement 1 s, tue 1 tireur), `wall` (bloque plusieurs voies, doit être contourné).
- Boss tous les 1 000 m : 3 boss de base (id `boss_1..3`), puis boucle avec difficulté croissante. Un boss a une barre de vie et une phase d'attaque à esquiver (charge sur 3 voies, projectiles, invocation).
- Fin de run : foule à zéro (ou abandon). Vaincre un boss ne termine pas la run : bonus de pièces, puis la run continue et la boucle de boss se poursuit avec une difficulté croissante.
- Réanimation : une seule fois par run, quand la foule tombe à zéro. Le moteur appelle `EngineHooks.onReviveOffer`, branché par `main.js` sur `UiController.askRevive()`, qui propose de payer en pièces (`MetaService.getReviveCost`, `spendCoins`). Si le joueur accepte et paie : foule remise à 5 et 2 s d'invulnérabilité. Sinon : fin de run.
- Écran de résultat : distance, kills, pièces, record, niveau, coffre, missions terminées. Bouton REJOUER dominant.
- Vitesse de défilement : augmente par paliers de 100 m, plafonnée.
- Difficulté : 0 à 300 m tutoriel sans danger mortel, puis montée progressive. Générateur déterministe à partir d'une seed.
- Plancher de foule : avant 300 m, la foule ne descend jamais sous 1 tireur ; la porte `div` ne tue jamais seule (minimum 1).
- Pendant un combat de boss, la distance est gelée (le défilement continue visuellement) ; elle repart à la défaite du boss.
- `coinsEarned` est final et calculé par ENGINE (pièces ramassées + kills + distance + bonus de boss). META le crédite tel quel.

## 3. Méta-jeu (tout est local, aucun réseau)

- Pièces : gagnées en run (ramassées, kills, distance, boss).
- Atelier : 4 améliorations (`fire_rate`, `damage`, `crowd_start`, `coin_magnet`), 5 niveaux chacune, coût croissant, payées en pièces.
- Armes : `starter` (départ), `shotgun`, `smg`, `flamer`, `pierce_rifle`. Déblocage par niveau de compte. Noms et visuels dépendent du thème, les stats sont communes.
- Niveau de compte : XP gagnée par run.
- Missions du jour : 3 missions tirées d'un catalogue, reset à minuit local, récompense en pièces.
- Coffres : donnés en fin de run (distance >= 150 m ou au moins un boss vaincu), gratuits, ouverture immédiate depuis l'écran des coffres, pièces tirées au hasard.
- Record de distance local par thème.
- Réanimation : coût fixe de 100 pièces (une fois par run).
- Réglages : son, musique, vibration, niveau de gore (doux/normal), mode daltonien, réinitialisation de la progression (en deux étapes).
- Hors périmètre, supprimés : publicités (récompensées ou interstitielles), achats intégrés, pass saisonnier, packs de pièces, classement, énergie, minuteur de coffre, doublement des pièces par pub.

## 4. Stack technique (décidée, volontairement minimale)

Principe : un site statique qui tourne dans le navigateur du téléphone, installable comme une app. Rien d'autre.

- Langage : JavaScript pur (modules ES, `<script type="module">`). Aucun TypeScript, aucun bundler, aucun framework, aucune dépendance, aucune étape de build.
- `package.json` : un seul fichier minimal à la racine, `{"name":"crowd-blast","private":true,"type":"module"}`, sans `dependencies`, `devDependencies` ni `scripts`. Il sert uniquement à déclarer les `.js` comme modules ES pour `node --test` (indépendant de la version de Node). Aucun `npm install` n'est jamais nécessaire.
- Rendu : Canvas 2D, dessin vectoriel procédural (aucun fichier image).
- Audio : Web Audio API, sons et musique synthétisés (aucun fichier audio).
- UI : DOM + CSS pur pour les menus ; Canvas pour le jeu. Tous les textes affichés sont en anglais.
- Données sur l'appareil : `localStorage`, une seule clé JSON versionnée (`crowdblast.save.v1`, constante `SAVE_KEY`), derrière `SaveService`. C'est la seule "base de données" du projet.
- Mobile : PWA = `manifest.webmanifest` + `sw.js` (cache hors-ligne, installable sur l'écran d'accueil, plein écran, portrait). Vibration via `navigator.vibrate` quand disponible, sinon ignorée. Emballage store (Capacitor ou équivalent) : hors périmètre v1, mentionné dans le README comme étape future.
- Typage : JSDoc dans le code + `src/contracts.d.ts` comme documentation des interfaces (non compilé, jamais exécuté).
- Tests : testeur intégré à Node (Node >= 22.7 recommandé, zéro installation) sur les modules de logique pure (RNG, générateur, calcul de foule/cadence, collisions, atelier, missions, sauvegarde avec un faux `localStorage`).
  - Commande pour tout lancer : **`node --test`** (sans argument : découverte automatique des `*.test.js`). Ne jamais écrire `node --test tests/` : sur Node 22 un dossier passé en argument échoue ("Cannot find module").
  - Un sous-ensemble : `node --test tests/engine/*.test.js` (le shell développe le motif), ou un fichier précis.
- Lancer en local : `python3 -m http.server 8000` (ou `./dev.sh` pour le téléphone sur le même wifi). Vérification visuelle dans un navigateur mobile ou émulé.
- Budget : code total sous 200 Ko non compressé, aucun asset binaire, première partie jouable en moins de 2 s sur un téléphone d'entrée de gamme.
- Performances : 60 FPS cible, pooling des entités, pas d'allocation dans la boucle chaude quand c'est évitable. Résolution logique 360x640, mise à l'échelle au `devicePixelRatio`.
- Séparation des modules : la logique pure (sans DOM ni canvas) est dans des fichiers à part pour être testable sous Node.
- Chemins : tous relatifs (le jeu doit fonctionner dans un sous-dossier, par exemple `https://<user>.github.io/crowd-blast/`).
- Dev sur smartphone : `dev.sh` (serveur statique accessible sur le réseau local) et mode `?debug` (ticket CON-19). Déploiement HTTPS optionnel sur GitHub Pages (ticket CON-20) ; un repo privé peut exiger un plan payant pour Pages.

## 5. Structure du dépôt

```
crowd-blast/
  CLAUDE.md                (instructions pour Claude Code)
  SPEC.md
  README.md                (CON-18)
  package.json             (minimal, voir §4)
  .gitignore
  dev.sh                   (CON-19)
  .github/workflows/pages.yml   (CON-20, optionnel)
  tickets/                 (engine.md, meta.md, content.md)
  index.html
  manifest.webmanifest
  sw.js
  icons/                   (icônes SVG, pas de PNG)
  src/
    contracts.d.ts         (interfaces documentées, écrit par le Product, lecture seule)
    constants.js           (LANE_COUNT, LOGICAL_WIDTH, LOGICAL_HEIGHT, LANE_WIDTH, SAVE_KEY : lecture seule)
    main.js                (point d'entrée, assemblage)
    engine/                (rôle ENGINE)
    meta/                  (rôle META)
    ui/                    (rôle META)
    audio/                 (rôle CONTENT)
    themes/                (rôle CONTENT)
    sprites/               (rôle CONTENT)
    platform/              (rôle CONTENT : vibration, PWA, câblage, debug)
  tests/                   (engine/, meta/, ui/, content/ : *.test.js)
```

Les fabriques exportées par chaque module (fonctions ES) : `createEngine` (`src/engine/index.js`), `createMetaService` (`src/meta/index.js`), `createUi` (`src/ui/index.js`), `createAudio` (`src/audio/index.js`), `createSpriteRenderer` (`src/sprites/index.js`), `createHaptics` (`src/platform/haptics.js`), `THEMES` et `getTheme` (`src/themes/index.js`), `SPEED_MIN` et `SPEED_MAX` (`src/engine/balance.js`).

## 6. Les 3 rôles de développement

Trois rôles, avec chacun son périmètre de fichiers et ses tickets. Une seule personne ou un seul agent peut les tenir tour à tour, ou on peut les confier à des sous-agents en parallèle (voir `CLAUDE.md`).

| Rôle | Périmètre | Possède |
| --- | --- | --- |
| ENGINE | Boucle de jeu, entrées, entités, collisions, générateur de niveau, portes, armes en run, ennemis, boss, rendu des entités, réanimation côté moteur | `src/engine/`, `tests/engine/` |
| META | Sauvegarde, pièces, atelier, missions, coffres, niveau de compte, réanimation côté économie, écrans DOM, réglages | `src/meta/`, `src/ui/`, `tests/meta/`, `tests/ui/` |
| CONTENT | Thèmes en données, sprites procéduraux, audio synthétisé, vibration, PWA (manifest, service worker, icônes), dev sur smartphone, README, tests de fumée, intégration `main.js` et `index.html` | `src/themes/`, `src/sprites/`, `src/audio/`, `src/platform/`, `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `dev.sh`, `.github/`, `README.md`, `src/main.js`, `tests/content/` |

Règles de collaboration :
1. Chaque rôle n'écrit que dans son périmètre. Toute modification d'un autre périmètre passe par un ticket adressé à son propriétaire (section "Demandes aux autres agents").
2. `src/contracts.d.ts` et `src/constants.js` sont la seule interface entre modules. Un besoin de changement est une demande au Product, pas une modification directe. Les évolutions de contrat sont faites par le Product (l'utilisateur ou l'assistant en rôle Product) puis propagées.
3. Un ticket est terminé quand ses critères d'acceptation sont vérifiables par une commande (`node --test`) ou une vérification visuelle décrite (servir en statique, ouvrir dans un navigateur).
4. Aucun ticket n'ajoute de dépendance, d'outil de build ou de framework. Toute demande en ce sens est refusée.
5. Les tickets ont une taille de 1 jour de travail agent au plus ; sinon ils sont découpés.

## 7. Format d'un ticket

```
### <PREFIXE>-<n> : <titre>
- Priorité : P0 | P1 | P2
- Dépend de : <ids ou "aucun">
- Description : ...
- Critères d'acceptation : liste vérifiable
- Interfaces utilisées / fournies : références à contracts.d.ts
```
Préfixes : ENG-, META-, CON-. Chaque fichier de tickets se termine par les sections "Accords" (ce que le rôle accepte, refuse, laisse ouvert avec chaque autre rôle), "Demandes aux autres agents" et "Hypothèses".

## 8. Jalons (une branche et une PR par jalon)

| Jalon | Branche | Tickets | Livrable vérifiable |
| --- | --- | --- | --- |
| M1 | `m1-playable-core` | CON-1, ENG-1, CON-19 | Une run complète jouable avec des formes simples sur `src/engine/dev.html`, servie en statique (`./dev.sh`), jouable sur le téléphone ; `node --test` vert |
| M2 | `m2-themes-meta` | ENG-2 à ENG-13 ; META-1 à META-13 ; CON-2 à CON-9, CON-11, CON-12, CON-14, CON-16 | Jeu complet intégré dans `index.html` : accueil, run avec sprites et son des 5 thèmes, résultat, atelier, réanimation en pièces ; `node --test` vert |
| M3 | `m3-polish-pwa` | ENG-14, ENG-16, ENG-17, ENG-15 (en dernier) ; META-14 à META-16 ; CON-10, CON-13, CON-15, CON-17, CON-18, CON-20 | Boss, missions, coffres, réglages, UX mobile, musique, PWA installable hors-ligne, README, test de fumée ; `node --test` vert |

Ordre dans un jalon : respecter les dépendances de chaque ticket ; dans M2, CON-16 (intégration) vient en dernier ; dans M3, ENG-15 (pouvoir spécial) vient en tout dernier, après le test d'intégration ENG-17.

Livrable final : dossier statique jouable (`index.html` + `src/`), installable en PWA, README avec la commande de lancement et le guide pour jouer sur smartphone.
