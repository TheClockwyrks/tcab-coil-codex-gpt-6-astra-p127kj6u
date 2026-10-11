import { expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createEngine, ConstantClock, type Game } from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type CoilState, type CoilDebugApi } from "./game";
import * as C from "./constants";

it("runs the real engine, renders every screen without mutation, and consumes key edges", async () => {
  const canvas = createCanvas(C.STAGE_W, C.STAGE_H);
  const events = new EventTarget();
  // Node has no browser decoder. Use the same committed PNGs through the native
  // canvas decoder, while retaining all of the engine's frame and input logic.
  const headless: Game<CoilState, CoilDebugApi> = {
    ...game,
    initialize: (api) =>
      game.initialize({
        ...api,
        assets: {
          ...api.assets,
          loadImage: async (path) =>
            (await loadImage(`assets/${path}`)) as unknown as ImageBitmap,
        },
        audio: {
          ...api.audio,
          load: async (cue) =>
            api.audio.define(cue, { freq: 440, durationMs: 10 }),
        },
      }),
  };
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    background: BACKGROUND,
    layout: C.LAYOUT,
    game: headless,
    clock: { delta: () => 0 },
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  await engine.initialize();
  const pixels = new Set<string>();
  for (const screen of C.SCREENS) {
    engine.apply((s) => engine.debug.setScreen(s, screen));
    engine.apply((s) =>
      engine.debug.setComboWindow(engine.debug.setCombo(s, 3), 2),
    );
    engine.apply((s) => engine.debug.setPellet(s, 20, 8));
    const before = engine.debug.snapshot(engine.state);
    await engine.advance(1);
    expect(engine.debug.snapshot(engine.state)).toEqual(before);
    pixels.add(canvas.toDataURL());
  }
  expect(pixels.size).toBe(C.SCREENS.length);
  engine.apply((s) => engine.debug.reset(s));
  const key = (type: string, code: string) =>
    events.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  key("keydown", "Enter");
  await engine.advance(1);
  expect(engine.state.screen).toBe("playing");
  key("keyup", "Enter");
  engine.setClock(new ConstantClock(125));
  key("keydown", "ArrowDown");
  await engine.advance(2);
  expect(engine.state.dir).toBe("down");
  expect(engine.state.snake[0]).toEqual({ col: 15, row: 10 });
  expect(engine.diagnostics().every((d) => !d.error)).toBe(true);
  engine.startRecording();
  await engine.advance(2);
  const recording = engine.stopRecording();
  expect(recording.frames).toHaveLength(2);
  expect(recording.ops.length).toBeGreaterThan(100);
  engine.destroy();
});
