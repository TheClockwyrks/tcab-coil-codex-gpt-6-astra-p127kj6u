import * as C from "./constants";
import {
  initial,
  interior,
  same,
  drawPelletCell,
  menuItems,
  menuRect,
  type State,
  type CoilState,
} from "./state";
function check(ok: boolean): void {
  if (!ok) throw new RangeError("Coil: invalid debug argument");
}
function integer(n: number, min = 0, max = Infinity): void {
  check(Number.isInteger(n) && n >= min && n <= max);
}
function boolean(b: boolean): void {
  check(typeof b === "boolean");
}
export const debug = {
  version: C.COIL_DEBUG_VERSION,
  reset: (s: State): CoilState => initial(s.sprites, s.muted),
  reconcile: (s: State): CoilState => ({ ...s }),
  snapshot: (s: State) => ({
    version: C.COIL_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    titleIndex: s.titleIndex,
    mode: s.mode,
    score: s.score,
    best: s.best,
    combo: s.combo,
    comboWindow: s.comboWindow,
    muted: s.muted,
    ticks: s.ticks,
    simTime: s.simTime,
    dir: s.dir,
    turns: [...s.turns],
    snake: s.snake.map((c) => ({ ...c })),
    pellet: s.pellet ? { ...s.pellet } : null,
    obstacles: s.obstacles.map((c) => ({ ...c })),
    steering: s.steering,
    travel: s.travel,
    pelletRespawn: s.pelletRespawn,
    nextPellet: s.nextPellet ? { ...s.nextPellet } : null,
  }),
  menuItemRect: menuRect,
  setScreen(s: State, screen: C.Screen): CoilState {
    check(C.SCREENS.includes(screen));
    return { ...s, screen };
  },
  setMenuIndex(s: State, menuIndex: number): CoilState {
    integer(menuIndex, 0, Math.max(0, menuItems(s.screen).length - 1));
    return { ...s, menuIndex };
  },
  setScore(s: State, score: number): CoilState {
    integer(score);
    return { ...s, score };
  },
  setBest(s: State, best: number): CoilState {
    integer(best);
    return { ...s, best };
  },
  setCombo(s: State, combo: number): CoilState {
    integer(combo, 1, C.COMBO_MAX);
    return { ...s, combo };
  },
  setComboWindow(s: State, comboWindow: number): CoilState {
    check(
      Number.isFinite(comboWindow) &&
        comboWindow >= 0 &&
        comboWindow <= C.COMBO_WINDOW,
    );
    return { ...s, comboWindow };
  },
  setSnake(s: State, cells: readonly C.Cell[]): CoilState {
    check(cells.length > 0);
    const seen = new Set<string>();
    cells.forEach((c, i) => {
      check(interior(c) && !s.obstacles.some((o) => same(o, c)));
      const key = `${c.col},${c.row}`;
      check(!seen.has(key));
      seen.add(key);
      if (i)
        check(
          Math.abs(c.col - cells[i - 1].col) +
            Math.abs(c.row - cells[i - 1].row) ===
            1,
        );
    });
    return { ...s, snake: cells.map((c) => ({ ...c })) };
  },
  setDirection(s: State, dir: C.Direction): CoilState {
    check(C.DIRECTIONS.includes(dir));
    return { ...s, dir };
  },
  clearTurns: (s: State): CoilState => ({ ...s, turns: [] }),
  setSnakeSteering(s: State, steering: boolean): CoilState {
    boolean(steering);
    return { ...s, steering, turns: steering ? s.turns : [] };
  },
  setSnakeTravel(s: State, travel: boolean): CoilState {
    boolean(travel);
    return { ...s, travel };
  },
  setPellet(s: State, col: number, row: number): CoilState {
    const pellet = { col, row };
    check(
      interior(pellet) &&
        ![...s.snake, ...s.obstacles].some((c) => same(c, pellet)),
    );
    return { ...s, pellet };
  },
  clearPellet: (s: State): CoilState => ({ ...s, pellet: null }),
  setPelletRespawn(s: State, pelletRespawn: boolean): CoilState {
    boolean(pelletRespawn);
    return { ...s, pelletRespawn };
  },
  setNextPellet(s: State, col: number, row: number): CoilState {
    integer(col, 0, C.GRID_COLS - 1);
    integer(row, 0, C.GRID_ROWS - 1);
    return { ...s, nextPellet: { col, row } };
  },
  drawPelletCell,
};
export type CoilDebugApi = typeof debug;
