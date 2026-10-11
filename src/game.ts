import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import {
  initial,
  spawn,
  tick,
  menuItems,
  menuRect,
  type State,
  type CoilState,
} from "./state";
import { debug, type CoilDebugApi } from "./debug";
import { render } from "./render";
export type { CoilState, CoilDebugApi };
export const BACKGROUND = "#070e19";
function title(s: State): CoilState {
  return { ...s, screen: "title", menuIndex: s.titleIndex, presses: {} };
}
function begin(s: State, api: UpdateApi): CoilState {
  api.audio.loop(C.CUES.music);
  return spawn({
    ...s,
    screen: "playing",
    menuIndex: 0,
    score: 0,
    combo: 1,
    comboWindow: 0,
    snake: C.START_CELLS.map((c) => ({ ...c })),
    dir: C.START_DIR,
    turns: [],
    pellet: null,
    obstacles: C.OBSTACLE_CELLS,
    accumulator: 0,
    biteAt: -100,
    sparks: [],
    presses: {},
  });
}
function confirm(s: State, api: UpdateApi): CoilState {
  if (s.screen === "title") {
    s = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 0
      ? begin(s, api)
      : { ...s, screen: "howto", menuIndex: 0, presses: {} };
  }
  if (s.screen === "howto") return title(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: "playing", menuIndex: 0, presses: {} }
      : s.menuIndex === 1
        ? begin(s, api)
        : title(s);
  if (s.screen === "gameover" || s.screen === "cleared")
    return s.menuIndex === 0 ? begin(s, api) : title(s);
  return { ...s };
}
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(api) {
    C.ACTIONS.forEach((name) =>
      api.input.register(name, { keys: [...C.BINDINGS[name]] }),
    );
    const paths = [
      ...C.SPRITE_PATHS.head,
      C.SPRITE_PATHS.body,
      C.SPRITE_PATHS.corner,
      C.SPRITE_PATHS.tail,
    ];
    const [images] = await Promise.all([
      Promise.all(paths.map((p) => api.assets.loadImage(p))),
      Promise.all(
        Object.values(C.CUES).map((c) => api.audio.load(c, C.CUE_PATHS[c])),
      ),
    ]);
    for (const name of [
      "screen",
      "score",
      "best",
      "combo",
      "comboWindow",
      "dir",
    ] as const)
      api.diagnostics.register(name, (s) => s[name]);
    api.diagnostics.register("length", (s) => s.snake.length);
    api.diagnostics.register(
      "head",
      (s) => `${s.snake[0].col}, ${s.snake[0].row}`,
    );
    api.diagnostics.register("pellet", (s) =>
      s.pellet ? `${s.pellet.col}, ${s.pellet.row}` : "none",
    );
    return [
      initial(Object.fromEntries(paths.map((p, i) => [p, images[i]]))),
      debug,
    ];
  },
  update(state, api, dt) {
    let s: CoilState = { ...state };
    const edges = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
    );
    const samples = api.input.pointerSamples();
    if (edges.mute) api.audio.setMuted(!api.audio.muted());
    s = { ...s, muted: api.audio.muted() };
    if (s.screen === "playing") {
      if (s.steering)
        for (const d of C.DIRECTIONS)
          if (edges[d] && s.turns.length < C.TURN_QUEUE_MAX)
            s = { ...s, turns: [...s.turns, d] };
      if (edges.back || edges.pause)
        s = { ...s, screen: "paused", menuIndex: 0, presses: {} };
    } else {
      const n = menuItems(s.screen).length;
      if (edges.up) s = { ...s, menuIndex: (s.menuIndex + n - 1) % n };
      if (edges.down) s = { ...s, menuIndex: (s.menuIndex + 1) % n };
      if (edges.confirm) s = confirm(s, api);
      else if (edges.back || (edges.pause && s.screen === "paused")) {
        if (s.screen === "paused")
          s = { ...s, screen: "playing", menuIndex: 0, presses: {} };
        else if (s.screen !== "title") s = title(s);
      }
    }
    for (const sample of samples) {
      if (s.screen === "playing") break;
      const index = menuItems(s.screen).findIndex((_, i) => {
        const r = menuRect(s, i)!;
        return (
          sample.x >= r.x &&
          sample.x < r.x + r.w &&
          sample.y >= r.y &&
          sample.y < r.y + r.h
        );
      });
      if (index >= 0) s = { ...s, menuIndex: index };
      if (sample.type === "down" && sample.button === "primary")
        s = {
          ...s,
          presses: { ...s.presses, [sample.id]: { index, screen: s.screen } },
        };
      if (sample.type === "up" && sample.button === "primary") {
        const press = s.presses[sample.id];
        const presses = { ...s.presses };
        delete presses[sample.id];
        s = { ...s, presses };
        if (index >= 0 && press?.index === index && press.screen === s.screen)
          s = confirm(s, api);
      }
    }
    if (s.screen === "playing") {
      s = { ...s, simTime: s.simTime + dt, accumulator: s.accumulator + dt };
      while (
        s.accumulator + 1e-10 >= C.TICK_SECONDS &&
        s.screen === "playing"
      ) {
        s = { ...s, accumulator: Math.max(0, s.accumulator - C.TICK_SECONDS) };
        s = tick(s, (c) => api.audio.play(c));
      }
      s = { ...s, sparks: s.sparks.filter((p) => s.simTime - p.at < 0.65) };
    }
    if (s.screen !== "playing" && s.screen !== "paused")
      api.audio.stop(C.CUES.music);
    return { ...s, best: Math.max(s.best, s.score) };
  },
  render,
};
