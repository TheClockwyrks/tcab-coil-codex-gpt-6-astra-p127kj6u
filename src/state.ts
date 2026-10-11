import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";

export interface CoilState {
  screen: C.Screen;
  menuIndex: number;
  titleIndex: number;
  mode: typeof C.MODE;
  score: number;
  best: number;
  combo: number;
  comboWindow: number;
  muted: boolean;
  ticks: number;
  simTime: number;
  dir: C.Direction;
  turns: readonly C.Direction[];
  snake: readonly C.Cell[];
  pellet: C.Cell | null;
  obstacles: readonly C.Cell[];
  steering: boolean;
  travel: boolean;
  pelletRespawn: boolean;
  nextPellet: C.Cell | null;
  accumulator: number;
  biteAt: number;
  sparks: readonly { col: number; row: number; at: number }[];
  presses: Readonly<Record<number, { index: number; screen: C.Screen }>>;
  sprites: Readonly<Record<string, ImageBitmap>>;
}
export type State = DeepReadonly<CoilState>;
export function initial(
  sprites: CoilState["sprites"],
  muted = false,
): CoilState {
  return {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    mode: C.MODE,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted,
    ticks: 0,
    simTime: 0,
    dir: C.START_DIR,
    turns: [],
    snake: C.START_CELLS.map((c) => ({ ...c })),
    pellet: null,
    obstacles: [],
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    accumulator: 0,
    biteAt: -100,
    sparks: [],
    presses: {},
    sprites,
  };
}
export const same = (a: C.Cell, b: C.Cell | null): boolean =>
  b !== null && a.col === b.col && a.row === b.row;
export const interior = (c: C.Cell): boolean =>
  Number.isInteger(c.col) &&
  Number.isInteger(c.row) &&
  c.col >= C.INTERIOR_MIN_COL &&
  c.col <= C.INTERIOR_MAX_COL &&
  c.row >= C.INTERIOR_MIN_ROW &&
  c.row <= C.INTERIOR_MAX_ROW;
export function validCells(s: State): C.Cell[] {
  const occupied = new Set(
    [...s.snake, ...s.obstacles, ...(s.pellet ? [s.pellet] : [])].map(
      (c) => `${c.col},${c.row}`,
    ),
  );
  const cells: C.Cell[] = [];
  for (let row = C.INTERIOR_MIN_ROW; row <= C.INTERIOR_MAX_ROW; row++)
    for (let col = C.INTERIOR_MIN_COL; col <= C.INTERIOR_MAX_COL; col++)
      if (!occupied.has(`${col},${row}`)) cells.push({ col, row });
  return cells;
}
export function drawPelletCell(s: State): C.Cell | null {
  const cells = validCells(s);
  return cells[Math.floor(Math.random() * cells.length)] ?? null;
}
export function spawn(s: State): CoilState {
  const cells = validCells(s);
  const pellet =
    cells.find((c) => same(c, s.nextPellet)) ??
    cells[Math.floor(Math.random() * cells.length)] ??
    null;
  return { ...s, pellet, nextPellet: null };
}
export function menuItems(screen: C.Screen): readonly string[] {
  switch (screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "howto":
      return ["BACK"];
    case "paused":
      return C.PAUSE_ITEMS;
    case "gameover":
    case "cleared":
      return C.OVER_ITEMS;
    default:
      return [];
  }
}
export function menuRect(s: State, index: number) {
  if (index < 0 || !Number.isInteger(index))
    throw new RangeError("Invalid menu index");
  if (index >= menuItems(s.screen).length) return null;
  return {
    x: s.screen === "title" ? 240 : 460,
    y:
      (s.screen === "title" ? 418 : s.screen === "howto" ? 580 : 432) +
      index * 58,
    w: 360,
    h: 48,
  };
}
export const vectors: Record<C.Direction, C.Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};
export type TickCue =
  typeof C.CUES.eat | typeof C.CUES.comboUp | typeof C.CUES.death;
/** One indivisible simulation tick, independent of input, drawing and audio. */
export function tick(state: State, emit: (cue: TickCue) => void): CoilState {
  let s: CoilState = { ...state, ticks: state.ticks + 1 };
  if (s.steering && s.turns.length) {
    const requested = s.turns[0];
    const a = vectors[s.dir],
      b = vectors[requested];
    s = {
      ...s,
      turns: s.turns.slice(1),
      dir: a.col * b.col + a.row * b.row === 0 ? requested : s.dir,
    };
  }
  if (s.travel) {
    const h = s.snake[0],
      v = vectors[s.dir],
      head = { col: h.col + v.col, row: h.row + v.row };
    const eat = same(head, s.pellet);
    if (
      !interior(head) ||
      s.obstacles.some((c) => same(c, head)) ||
      s.snake.slice(0, eat ? undefined : -1).some((c) => same(c, head))
    ) {
      emit(C.CUES.death);
      return { ...s, screen: "gameover", menuIndex: 0, accumulator: 0 };
    }
    s = { ...s, snake: [head, ...(eat ? s.snake : s.snake.slice(0, -1))] };
    if (eat) {
      const combo = s.comboWindow > 0 ? Math.min(C.COMBO_MAX, s.combo + 1) : 1;
      emit(C.CUES.eat);
      if (combo > s.combo) emit(C.CUES.comboUp);
      s = {
        ...s,
        combo,
        comboWindow: C.COMBO_WINDOW,
        score: s.score + C.PELLET_POINTS * combo,
        biteAt: s.simTime - s.accumulator,
        sparks: [...s.sparks, { ...head, at: s.simTime - s.accumulator }],
      };
      s = { ...s, best: Math.max(s.best, s.score) };
      if (s.pelletRespawn) {
        s = spawn(s);
        if (!s.pellet)
          s = { ...s, screen: "cleared", menuIndex: 0, accumulator: 0 };
      } else s = { ...s, pellet: null };
    }
  }
  const comboWindow = Math.max(0, s.comboWindow - C.TICK_SECONDS);
  return { ...s, comboWindow, combo: comboWindow === 0 ? 1 : s.combo };
}
