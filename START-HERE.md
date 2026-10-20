# Start here — Foldworks

## The folder

`PLAN.md`, `DESIGN.md`, `CLAUDE.md`, `ROADMAP.md`, this file, the seeded `DECISIONS.md`,
`PROGRESS.md` and `IDEAS.md`, the agents in `.claude/agents/`, and a minimal TypeScript + Vite
scaffold that boots to a placeholder screen. `STYLE.md` is written in Milestone 0 after the
palette test. `docs/` keeps the original pitch and the first concept expansion.

## By hand, before Prompt 1 (10 minutes)

1. Keep or change the name. Check itch.io, Steam and the domain before the first public build.
2. Create the GitHub repo (`ycgNem/foldworks`), add it as `origin`, and push `main`. Then
   Settings → Pages → Source: "GitHub Actions".
3. Read `DESIGN.md` §3, §10 and §16 once. Folding and the pacing model are the parts where your
   taste matters most; change anything that's wrong and write why in `DECISIONS.md`. After this
   point the docs are law for Claude Code.

## Prompt 1 — Milestone 0, the foundation

```
Read PLAN.md, DESIGN.md, CLAUDE.md and ROADMAP.md in that order before doing anything. Then do
Milestone 0 only.

Build this repo's foundation by extracting the engine layer from
C:\Users\jacks\Documents\trotline: src/engine (loop, input, rng, events, save and migrations,
time, audio), the bitmap font, IMGUI kit and overlap audit from src/ui, the camera and chunked
ground patterns from src/render, scripts/ (art-import, contact sheets), and the e2e harness
(launch.mjs, screens.mjs with its overlap report, shots.mjs, smoke.mjs, bot.mjs). Do NOT copy,
adapt or read for ideas anything under its src/sim, src/data or src/app. Strip every Trotline
name, string, colour alias and asset. Keep the code style and the test setup. Move the loop to
the 20 Hz tick from DECISIONS.md.

Write src/engine/num.ts (the big-number type in ROADMAP.md Milestone 0) with its tests, and
record the build-vs-wrap decision in DECISIONS.md. Write the src/sim skeleton (Game, fixed
system order, Game.act command log, seed + commands save, SAVE_VERSION 1, export/import
strings) and the purity test.

Then: Workshop chunk A at 16 px with integer zoom 1x-4x and pan, the iron patch and Hand
Furnace as placeholders, a HUD strip with placeholder coin, a title screen with the working
title, and window.__app with freeze, step, fast-forward and grant. Have the art-director run
the six-sprite palette test from ROADMAP.md on two candidate palettes, show me the contact
sheet, and wait for my pick before writing STYLE.md.

Finish with: typecheck and tests clean, npm run screens report inspected, a screenshot of
chunk A that you have looked at, PROGRESS.md describing exactly what exists, DECISIONS.md with
any new entries, one commit. Stop there. Do not begin Milestone 1.
```

## Prompt 2 — Milestone 1, the Workshop (after the palette is picked and STYLE.md exists)

```
Read PLAN.md, DESIGN.md, CLAUDE.md, STYLE.md, ROADMAP.md, PROGRESS.md and DECISIONS.md. Build
Milestone 1 exactly as ROADMAP.md and DESIGN.md §2-§9 specify, in the order ROADMAP.md lists,
each step tested before the next.

Every stat in src/data carries a derivation string naming its DESIGN.md section; the data
validation test enforces it. Status pips and the hover report ship with each machine, not
later. If a DESIGN.md number produces a pace test that fails (for example the Bellows takes
50 s, not 20-40), do not tune silently: write the new derivation in DESIGN.md, explain it in
DECISIONS.md, then change the data. If you catch yourself writing something that resembles a
specific shipped game, stop and tell me.

Send me screenshots of: the first click, the Bellows bought, the first miner line, a slag jam
with its red pip and hover report, and the Folding research completing. Finish with the
Definition of Done from CLAUDE.md, PROGRESS.md updated, then run idle-critic and paste its
ranked findings. Do not start Milestone 2.
```

## Prompt 3 — Milestone 2, the first fold

```
Read the docs as in Prompt 2. Build Milestone 2 exactly as ROADMAP.md and DESIGN.md §10-§12
specify. The fold is the game's signature moment: the box, the 70 s audit with its progress
ring, and the grade card with "what would raise it" get the most care. Run npm run perf against
the budget in ROADMAP.md.

Send me screenshots of: the fold box with ports, an audit in progress, an S-grade and a C-grade
card, the Factory floor with three modules, and the offline report. Finish with the Definition
of Done, then run idle-critic and pacing-auditor and paste both reports. Do not start
Milestone 4.
```

## After the slice (Milestone 3, the gate)

Play it for an evening before reading the critic's report. The three questions in `DESIGN.md`
§14 are the only thing that matters at that point. If the answers are good, mark the gate passed
in `ROADMAP.md` and go one milestone per session. If not, change the model.
