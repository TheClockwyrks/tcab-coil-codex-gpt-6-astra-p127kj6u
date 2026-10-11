import { describe, expect, it, vi } from "vitest";
import type { InitApi, UpdateApi, PointerSample } from "@clockwyrks/simple-2d";
import { game } from "./game";
import { debug } from "./debug";
import { initial, tick, validCells, type CoilState } from "./state";
import * as C from "./constants";

function driver() {
  const pressed = new Set<string>();
  let samples: PointerSample[] = [];
  let muted = false;
  const cues: string[] = [];
  const loops = new Set<string>();
  const api: UpdateApi = {
    input: {
      pressed: (a) => pressed.delete(a),
      value: () => 0,
      pointerSamples: () => {
        const p = samples;
        samples = [];
        return p;
      },
      pointer: () => ({
        x: 0,
        y: 0,
        down: false,
        device: "mouse",
        buttons: [],
      }),
      pointerContacts: () => [],
      pointerPressed: () => false,
      pointerReleased: () => false,
      wheel: () => ({ x: 0, y: 0 }),
    },
    audio: {
      play: (c) => {
        cues.push(c);
      },
      loop: (c) => {
        loops.add(c);
      },
      stop: (c) => {
        loops.delete(c);
      },
      looping: (c) => loops.has(c),
      setMuted: (b) => {
        muted = b;
      },
      muted: () => muted,
    },
    frame: () => ({ count: 0, timeMs: 0, lastDeltaMs: 0 }),
    viewport: () => ({
      width: 1280,
      height: 720,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }),
  };
  let state = initial({});
  return {
    get s() {
      return state;
    },
    set s(s: CoilState) {
      state = s;
    },
    cues,
    loops,
    step(dt = 0, ...keys: string[]) {
      keys.forEach((k) => pressed.add(k));
      state = game.update(state, api, dt);
      return state;
    },
    pointer(p: PointerSample[]) {
      samples = p;
    },
  };
}
function live(): CoilState {
  return { ...initial({}), screen: "playing" };
}
const noCue = () => {};

describe("fixed simulation", () => {
  it("starts exactly and advances by elapsed time, preserving the remainder", () => {
    const a = driver();
    a.step(0, "confirm");
    expect(a.s.snake).toEqual(C.START_CELLS);
    expect(a.s.pellet).not.toBeNull();
    a.s = debug.clearPellet(a.s);
    a.step(0.0625);
    expect(a.s.ticks).toBe(0);
    a.step(0.0625);
    expect(a.s.snake[0]).toEqual({ col: 16, row: 8 });
    const b = driver();
    b.s = live();
    b.step(1);
    for (let i = 0; i < 7; i++) a.step(0.125);
    expect(a.s.snake).toEqual(b.s.snake);
    expect(a.s.ticks).toBe(8);
  });
  it("queues two turns and applies only one perpendicular request per tick", () => {
    const d = driver();
    d.s = live();
    d.step(0, "down");
    d.step(0, "left");
    d.step(0, "up");
    expect(d.s.turns).toEqual(["down", "left"]);
    d.step(0.125);
    expect(d.s.dir).toBe("down");
    d.step(0.125);
    expect(d.s.dir).toBe("left");
    expect(d.s.snake[0]).toEqual({ col: 14, row: 9 });
    d.step(0.125, "right");
    expect(d.s.dir).toBe("left");
    d.step(0.125, "left");
    expect(d.s.dir).toBe("left");
  });
  it("allows the tail to vacate, but not when it must grow", () => {
    const s = {
      ...live(),
      snake: [
        { col: 5, row: 5 },
        { col: 5, row: 6 },
        { col: 4, row: 6 },
        { col: 4, row: 5 },
      ],
      dir: "left" as const,
    };
    expect(tick(s, noCue).screen).toBe("playing");
    const hit = tick({ ...s, pellet: { col: 4, row: 5 } }, noCue);
    expect(hit.screen).toBe("gameover");
    expect(hit.snake).toEqual(s.snake);
  });
  it("ends at the first fatal tick and discards surplus elapsed time", () => {
    const d = driver();
    d.s = debug.setSnake(live(), [{ col: 28, row: 8 }]);
    d.step(1);
    expect(d.s.ticks).toBe(1);
    expect(d.s.accumulator).toBe(0);
    expect(d.cues).toEqual(["death"]);
    d.step(1);
    expect(d.s.ticks).toBe(1);
    d.step(0, "confirm");
    d.step(0.124);
    expect(d.s.ticks).toBe(1);
  });
  it("collides with obstacles and non-tail body", () => {
    expect(
      tick({ ...live(), obstacles: [{ col: 16, row: 8 }] }, noCue).screen,
    ).toBe("gameover");
    const snake = [
      { col: 5, row: 5 },
      { col: 5, row: 6 },
      { col: 6, row: 6 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
    ];
    expect(tick({ ...live(), snake }, noCue).screen).toBe("gameover");
  });
  it("scores, grows, raises best immediately, and consumes a valid next spawn", () => {
    const d = driver();
    d.s = debug.setNextPellet(debug.setPellet(live(), 16, 8), 17, 8);
    d.step(0.125);
    expect(d.s.score).toBe(10);
    expect(d.s.snake).toHaveLength(4);
    expect(d.s.comboWindow).toBe(3.375);
    expect(d.s.pellet).toEqual({ col: 17, row: 8 });
    d.step(0.125);
    expect(d.s.score).toBe(30);
    expect(d.s.best).toBe(30);
    expect(d.s.combo).toBe(2);
    expect(d.cues).toEqual(["eat", "eat", "combo-up"]);
    expect(d.s.nextPellet).toBeNull();
  });
  it("caps the combo and lapses it on exactly the 28th tick", () => {
    const d = driver();
    d.s = { ...live(), combo: 5, comboWindow: 3.5, travel: false };
    d.step(27 * 0.125);
    expect(d.s.comboWindow).toBe(0.125);
    expect(d.s.combo).toBe(5);
    d.step(0.125);
    expect(d.s.combo).toBe(1);
    expect(d.s.comboWindow).toBe(0);
    d.s = { ...live(), combo: 5, comboWindow: 1, pellet: { col: 16, row: 8 } };
    d.step(0.125);
    expect(d.s.score).toBe(50);
    expect(d.cues).toEqual(["eat"]);
  });
  it("eating on tick 27 keeps the window, tick 28 finds it closed", () => {
    for (const [wait, expected] of [
      [26, 2],
      [27, 1],
    ]) {
      const d = driver();
      d.s = { ...live(), travel: false, comboWindow: 3.375 };
      d.step(wait * 0.125);
      d.s = { ...d.s, travel: true, pellet: { col: 16, row: 8 } };
      d.step(0.125);
      expect(d.s.combo).toBe(expected);
    }
  });
  it("honors each independent driver switch and retains unconsumed poses", () => {
    const d = driver();
    d.s = debug.setSnakeTravel(live(), false);
    d.step(0.125, "down");
    expect(d.s.dir).toBe("down");
    expect(d.s.snake).toEqual(C.START_CELLS);
    d.s = debug.setSnakeSteering({ ...d.s, turns: ["left"] }, false);
    d.step(0.125, "left");
    expect(d.s.turns).toEqual([]);
    expect(d.s.dir).toBe("down");
    d.s = {
      ...live(),
      pellet: { col: 16, row: 8 },
      pelletRespawn: false,
      nextPellet: { col: 17, row: 8 },
    };
    d.step(0.125);
    expect(d.s.pellet).toBeNull();
    expect(d.s.nextPellet).toEqual({ col: 17, row: 8 });
    expect(d.s.screen).toBe("playing");
  });
  it("wins when the final free cell is eaten", () => {
    const head = { col: 27, row: 16 },
      pellet = { col: 28, row: 16 };
    const obstacles = validCells({ ...live(), snake: [head], pellet }).filter(
      (c) => c.col !== head.col || c.row !== head.row,
    );
    const d = driver();
    d.s = {
      ...live(),
      snake: [head],
      pellet,
      obstacles,
      nextPellet: { col: 1, row: 1 },
    };
    d.step(0.125);
    expect(d.s.screen).toBe("cleared");
    expect(d.s.pellet).toBeNull();
    expect(d.s.score).toBe(10);
    expect(d.s.nextPellet).toBeNull();
  });
});
describe("screens and input", () => {
  it("remembers the title choice and wraps menus", () => {
    const d = driver();
    d.step(0, "up");
    expect(d.s.menuIndex).toBe(1);
    d.step(0, "confirm");
    expect(d.s.screen).toBe("howto");
    d.step(0, "back");
    expect(d.s.menuIndex).toBe(1);
    d.step(0, "down");
    d.step(0, "confirm");
    expect(d.s.screen).toBe("playing");
  });
  it("freezes the accumulator, animation, combo and clock on pause", () => {
    const d = driver();
    d.step(0, "confirm");
    d.step(0.05);
    d.step(0.5, "pause");
    const before = debug.snapshot(d.s);
    d.step(20);
    expect(debug.snapshot(d.s)).toEqual(before);
    expect(d.loops.has("music")).toBe(true);
    d.step(0.075, "back");
    expect(d.s.ticks).toBe(1);
  });
  it("restarts, leaves a round, and retains session best", () => {
    const d = driver();
    d.step(0, "confirm");
    d.s = { ...d.s, score: 120 };
    d.step(0, "pause");
    d.step(0, "down");
    d.step(0, "confirm");
    expect(d.s.score).toBe(0);
    expect(d.s.best).toBe(120);
    d.step(0, "pause");
    d.step(0, "up");
    d.step(0, "confirm");
    expect(d.s.screen).toBe("title");
    expect(d.loops.size).toBe(0);
  });
  it("toggles mute on every screen without changing simulation at zero dt", () => {
    const d = driver();
    for (const screen of C.SCREENS) {
      d.s = debug.setScreen(d.s, screen);
      const previous = d.s.muted;
      d.step(0, "mute");
      expect(d.s.muted).toBe(!previous);
    }
  });
  it("confirms matching pointer edges, including both in a single frame", () => {
    const d = driver();
    const r = debug.menuItemRect(d.s, 1)!;
    const sample = (
      type: PointerSample["type"],
      x = r.x + 5,
    ): PointerSample => ({
      type,
      x,
      y: r.y + 5,
      id: 7,
      primary: true,
      device: "touch",
      button: "primary",
      buttons: type === "up" ? [] : ["primary"],
    });
    d.pointer([sample("down"), sample("up", 0)]);
    d.step();
    expect(d.s.screen).toBe("title");
    d.pointer([sample("move")]);
    d.step();
    expect(d.s.menuIndex).toBe(1);
    d.pointer([sample("down"), sample("up")]);
    d.step();
    expect(d.s.screen).toBe("howto");
    expect(d.s.titleIndex).toBe(1);
  });
});
describe("debug contract and loading", () => {
  it("is immutable, exact, and reconcile neither ticks nor raises best", () => {
    const s = initial({});
    const posed = debug.setScore(s, 123);
    expect(s.score).toBe(0);
    expect(debug.reconcile(posed)).toEqual(posed);
    expect(posed.best).toBe(0);
    const d = driver();
    d.s = posed;
    d.step();
    expect(d.s.best).toBe(123);
    const snap = debug.snapshot(posed);
    snap.snake[0].col = 1;
    expect(posed.snake[0].col).toBe(15);
  });
  it("resets everything except assets and mute", () => {
    const s = {
      ...live(),
      muted: true,
      score: 100,
      best: 200,
      travel: false,
      steering: false,
      pelletRespawn: false,
      ticks: 25,
      simTime: 99,
      nextPellet: { col: 1, row: 1 },
    };
    expect(debug.reset(s)).toEqual(initial({}, true));
    expect(debug.version).toBe(1);
  });
  it("rejects out-of-domain poses, accepts legal unreachable combinations", () => {
    const s = initial({});
    for (const n of [-1, NaN, Infinity, 0.2])
      expect(() => debug.setScore(s, n)).toThrow();
    expect(() => debug.setCombo(s, 6)).toThrow();
    expect(() => debug.setComboWindow(s, 4)).toThrow();
    expect(() => debug.setMenuIndex(s, 2)).toThrow();
    expect(() => debug.setSnake(s, [])).toThrow();
    expect(() =>
      debug.setSnake(s, [
        { col: 1, row: 1 },
        { col: 3, row: 1 },
      ]),
    ).toThrow();
    expect(() =>
      debug.setSnake(s, [
        { col: 1, row: 1 },
        { col: 1, row: 2 },
        { col: 1, row: 1 },
      ]),
    ).toThrow();
    expect(() => debug.setPellet(s, 15, 8)).toThrow();
    expect(() => debug.setNextPellet(s, 30, 8)).toThrow();
    expect(debug.setNextPellet(s, 0, 0).nextPellet).toEqual({ col: 0, row: 0 });
    expect(debug.setCombo(s, 5).comboWindow).toBe(0);
    expect(debug.menuItemRect(live(), 0)).toBeNull();
    expect(debug.menuItemRect(s, 99)).toBeNull();
  });
  it("draws only valid cells without consuming the next pose", () => {
    const s = {
      ...live(),
      pellet: { col: 1, row: 1 },
      nextPellet: { col: 2, row: 2 },
    };
    const cells = validCells(s);
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(debug.drawPelletCell(s)).toEqual(cells[0]);
    random.mockReturnValue(0.999999);
    expect(debug.drawPelletCell(s)).toEqual(cells[cells.length - 1]);
    random.mockRestore();
    expect(s.nextPellet).toEqual({ col: 2, row: 2 });
  });
  it("loads all authored assets, registers actions and live diagnostic readings", async () => {
    const register = vi.fn(),
      load = vi.fn(async () => {}),
      sources = new Map<string, (s: CoilState) => unknown>();
    const api = {
      input: { register },
      audio: { load },
      assets: { loadImage: vi.fn(async () => ({})) },
      diagnostics: {
        register: (n: string, f: (s: CoilState) => unknown) =>
          sources.set(n, f),
      },
    } as unknown as InitApi<CoilState>;
    const [s, d] = await game.initialize(api);
    expect(register).toHaveBeenCalledTimes(8);
    expect(load).toHaveBeenCalledTimes(4);
    expect(Object.keys(s.sprites)).toHaveLength(7);
    expect(d).toBe(debug);
    expect(sources.get("score")!({ ...s, score: 99 })).toBe(99);
  });
});
