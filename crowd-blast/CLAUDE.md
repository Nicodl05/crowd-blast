# Crowd Blast — instructions for Claude Code

You are building **Crowd Blast**, a lightweight mobile arcade game (auto-shooting crowd runner on an infinite 5-lane road, swipe to change lane, gates multiply the crowd). Read `SPEC.md` first: it is the source of truth. Then work through `tickets/`.

## Non-negotiable constraints (SPEC §0)
- Plain JavaScript ES modules, Canvas 2D, Web Audio, DOM+CSS. **No TypeScript, no bundler, no npm dependencies, no binary assets** (everything drawn/synthesized in code). Total budget < 200 KB.
- `package.json` is already provided (`{"type":"module"}`): do not add dependencies or scripts.
- 100% local: **no ads, no in-app purchases, no leaderboard, no energy, no network, no account.** Save data only in `localStorage` (`SAVE_KEY` in `src/constants.js`).
- UI and README text in **English**. Commit messages in **English**.
- Default theme: zombies ("Highway Z"). Default gore: soft.
- All paths relative (must work from a subfolder, e.g. GitHub Pages).
- `src/contracts.d.ts` and `src/constants.js` are owned by the Product: do not change them without asking the user.

## Tests
Run everything with `node --test` (no argument). Never `node --test tests/` (fails on Node 22). Per-area: `node --test tests/engine/*.test.js`.
Game logic must be pure (no DOM, injected clock/rng/storage) so it is testable under Node. UI is verified visually with the preview pages.

## Roles and tickets
Three roles, one file each, tickets are the work items:
- ENGINE → `tickets/engine.md` (simulation, rendering, input)
- META → `tickets/meta.md` (save, economy, missions, chests, UI screens)
- CONTENT → `tickets/content.md` (themes, sprites, audio, PWA, wiring, docs)
Each role writes only in its own folders (SPEC §6). Cross-role needs go in the "Demandes" section of the ticket file. Follow each ticket's acceptance criteria exactly.

## Workflow (SPEC §8)
One git branch and **one pull request per milestone**; the user reviews and merges.
1. `m1-playable-core`: CON-1, ENG-1, CON-19
2. `m2-themes-meta`: ENG-2..13, META-1..13, CON-2..9, CON-11, CON-12, CON-14, CON-16 (last)
3. `m3-polish-pwa`: ENG-14, ENG-16, ENG-17, META-14..16, CON-10, CON-13, CON-15, CON-17, CON-18, CON-20, and **ENG-15 (special power) last of all**

Rules: finish and test a milestone before opening its PR; stop after each PR and wait for the user's merge before starting the next milestone. Mark tickets done in their file with a short note. If a ticket is ambiguous or contradicts SPEC, SPEC wins; if still unclear, ask the user.

## Must be playable on the user's phone
`./dev.sh` serves the repo on the LAN (CON-19) and `?debug` shows an FPS overlay. Keep the game runnable at every milestone.

Start now with milestone M1.
