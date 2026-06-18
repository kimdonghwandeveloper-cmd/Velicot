# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velicot (internal codename: `svg-motion-studio`) is a self-hosted SVG character animation tool. It produces `.kfm.json` (keyframe animation) and `.fsm.json` (state machine) files and exports to mp4/webm/gif via ffmpeg.wasm. It is a replacement for commercial tools (Rive, Lottielab) — no external animation SaaS dependency.

## Hard Constraints

- **Package manager**: `pnpm` only. `npm` and `yarn` are forbidden.
- **TypeScript**: `any` type is forbidden.
- **Scope**: Do not implement features outside of `plan.md` section 3 (explicit out-of-scope items). If a request conflicts with the scope, report that `plan.md` must be updated first before proceeding.
- **Each Phase must ship as a separate PR.** Only merge after all verification methods in `plan.md` pass.
- **rive-wasm reference policy**: Algorithm logic may reference rive-wasm public source for design inspiration, but direct code copying is forbidden (clean-room reimplementation only).

## Monorepo Structure

```
packages/
  editor/   # Phase 1+2: SVG editor + timeline UI
  morph/    # Phase 3: flubber shape-morphing integration
  fsm/      # Phase 4: state machine runtime + useStateMachine hook
  export/   # Phase 5: ffmpeg.wasm export pipeline
apps/
  studio/   # React + Vite demo/dev app
```

## Common Commands

Once bootstrapped, the expected pnpm commands are:

```bash
pnpm install                  # install all workspace deps
pnpm --filter studio dev      # start the Vite dev server for apps/studio
pnpm --filter <package> build # build a specific package
pnpm --filter <package> test  # run tests for a specific package
pnpm test                     # run all tests across the monorepo
```

The dev server for `apps/studio` requires specific HTTP headers for `@ffmpeg/core` (SharedArrayBuffer):
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These must be set in the Vite config for Phase 5 export functionality to work.

## Key Libraries and Known Risks

| Package | Role | Risk |
|---|---|---|
| `@svgedit/svgcanvas` v7.x | SVG drawing core | V7 changed integration significantly — do not reference pre-v7 examples or docs |
| `flubber` | Path-to-path shape morphing | Unmaintained. On critical bugs: fork as `flubber2` or patch directly |
| `@ffmpeg/ffmpeg` + `@ffmpeg/core` | Video/gif export | `@ffmpeg/core` is GPL-2.0-or-later — do not bundle or distribute externally without legal review |

## Data Formats

**`*.kfm.json`** — Animation project file. Tracks target a layer by ID and animate `opacity`, `transform`, or `path` properties. Morph tracks use `"type": "morph"` with SVG path strings as keyframe values.

**`*.fsm.json`** — State machine file. Defines the 4 states (`idle`, `working`, `done`, `error`), maps each to a `.kfm.json`, and lists transition rules triggered by a `status` input. See `plan.md` sections 5.1 and 5.2 for full schemas.

## Architecture Notes

- The SVG editor wraps `@svgedit/svgcanvas` in a minimal React component — only expose tools needed for character illustration, not the full SVGEdit UI.
- The editor maintains a bidirectional serialization adapter between SVG DOM and the internal layer model (JSON).
- The playback engine uses `requestAnimationFrame`; target 60fps.
- The `useStateMachine` hook (Phase 4) accepts a `status` prop and handles state transitions, animation queuing, and interruption policy.
- External apps consume only the output artifacts (`.kfm.json`, `.fsm.json`, or exported video files) — they never import internal editor packages directly.
## github commit rules
- commit the changes after completed every phase.
- if you  in worktree you cant push main before i accepted.
- make PR if you are completed phase in worktree.
