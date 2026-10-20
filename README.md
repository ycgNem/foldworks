# Foldworks

A pixel-art incremental factory game for the browser. Click an ore patch, crank a hand furnace,
automate with miners and belts, then **fold** a working production line into a single tile and
build the next, bigger floor out of what you folded. Workshop → Factory → District → World, three
reset layers, and a frog mayor who really wants Gizmos.

Status: design docs and scaffold. See `START-HERE.md`.

## Play

Double-click `Play.bat` (it uses the portable Node at `%USERPROFILE%\tools\node-v22.20.0-win-x64`
if Node isn't installed), or:

```bash
npm install
npm run dev
```

The game opens at http://127.0.0.1:5210.

## Docs

| File | What it is |
|---|---|
| `PLAN.md` | the game: hook, pillars, currencies, acts, resets, the not-list |
| `DESIGN.md` | every number and its derivation; the slice model; the 100-hour pacing model |
| `ROADMAP.md` | Milestones 0–14 and the two gates |
| `CLAUDE.md` | how Claude Code works in this repo |
| `START-HERE.md` | the prompts for each milestone |
| `DECISIONS.md` / `PROGRESS.md` / `IDEAS.md` | the running logs |
