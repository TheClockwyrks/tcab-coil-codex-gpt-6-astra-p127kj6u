# Coil

A neon grid serpent for the browser. Chase amber pellets, grow a continuous pixel-art coil, and eat again within 3.5 seconds to build a score multiplier up to x5. Walls and your own body end the round; filling the board wins it.

## Run

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend, account, or external service is required.

```sh
npm run build
npm run preview
```

The complete static site is emitted into `dist/`. Serve that directory at a host root or under a sub-path. Asset URLs are relative to the page.

## Controls

- **Arrow keys / WASD:** steer; up and down also select menu items.
- **Enter / Space:** confirm.
- **P / Escape:** pause or resume. Escape also returns from menus.
- **M:** mute or unmute.
- **Backtick:** show the engine's diagnostic overlay.
- **Pointer / touch:** select and activate menus. Touch devices also get the engine's directional controls.

Turns are buffered two deep and resolve one per tick. You cannot reverse. Your departing tail is safe to enter, unless that tick grows the snake. Best score lasts for the current session.

## Development

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The simulation is independent of rendering. `game.initialize` returns the specified debug API to `engine.debug`; no debug globals are installed. Tests cover fixed ticks, turns, collision, scoring, menus, debug poses, and a real engine running with native canvas rendering.

The seven PNG sprites and four WAV files in `assets/` are finished, committed assets. `public/assets` links to that directory so Vite bundles the files verbatim. The build never runs an asset generator. `tools/generate-assets.py` records the one-time pixel and sound authoring process using `draw`, `draw-sheet`, `sfx-synth`, and `music`; those optional tools are only needed to re-author assets.

`showcase/` contains screenshots and a six-second engine recording of a staged combo run using the real movement and scoring rules. With the development server running, `node tools/capture.mjs` recaptures it using the project's Playwright and Chromium.
