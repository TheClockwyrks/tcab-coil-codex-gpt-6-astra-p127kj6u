import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { menuItems, menuRect, type State } from "./state";
const ink = "#dceeea",
  muted = "#78929d",
  cyan = "#53e5c6",
  lime = "#d5ff8a",
  amber = "#ffc66a";
const boardWidth = C.GRID_COLS * C.CELL;
const boardHeight = C.GRID_ROWS * C.CELL;
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = ink,
  align: CanvasTextAlign = "left",
  weight = 400,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size > 50 ? "Arial, sans-serif" : '"Courier New", monospace'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function sprite(
  ctx: Context,
  s: State,
  path: string,
  col: number,
  row: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(
    C.BOARD_X + col * C.CELL + C.CELL / 2,
    C.BOARD_Y + row * C.CELL + C.CELL / 2,
  );
  ctx.rotate(angle);
  ctx.drawImage(s.sprites[path], -C.CELL / 2, -C.CELL / 2, C.CELL, C.CELL);
  ctx.restore();
}
const angles: Record<C.Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};
function snake(ctx: Context, s: State, cells: readonly C.Cell[] = s.snake) {
  cells.forEach((c, i) => {
    let path: string = C.SPRITE_PATHS.body,
      angle = 0;
    if (i === 0) {
      const age = s.simTime - s.biteAt;
      const frame =
        age >= 0 && age < C.BITE_SECONDS
          ? 1 + Math.min(2, Math.floor(age / (C.BITE_SECONDS / 3)))
          : 0;
      path = C.SPRITE_PATHS.head[frame];
      angle = angles[s.dir];
    } else {
      const prev = cells[i - 1],
        next = cells[i + 1];
      if (!next) {
        path = C.SPRITE_PATHS.tail;
        angle = Math.atan2(prev.row - c.row, prev.col - c.col);
      } else if (prev.col === next.col) angle = Math.PI / 2;
      else if (prev.row !== next.row) {
        path = C.SPRITE_PATHS.corner;
        const right = prev.col > c.col || next.col > c.col,
          down = prev.row > c.row || next.row > c.row;
        angle = right
          ? down
            ? 0
            : -Math.PI / 2
          : down
            ? Math.PI / 2
            : Math.PI;
      }
    }
    sprite(ctx, s, path, c.col, c.row, angle);
  });
}
function pellet(ctx: Context, col: number, row: number, time: number) {
  const x = C.BOARD_X + col * C.CELL + 16,
    y = C.BOARD_Y + row * C.CELL + 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = amber;
  ctx.shadowBlur = 16;
  ctx.fillStyle = amber;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(9, 0);
  ctx.lineTo(0, 11);
  ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff4cc";
  ctx.fillRect(-2, -5, 4, 8);
  ctx.strokeStyle = "#a37642";
  ctx.globalAlpha = 0.45 + 0.2 * Math.sin(time * 4);
  ctx.strokeRect(-14, -14, 28, 28);
  ctx.restore();
}
function board(ctx: Context, s: State) {
  const { BOARD_X: x, BOARD_Y: y, CELL: z } = C;
  ctx.fillStyle = "#0a1722";
  ctx.fillRect(x, y, C.GRID_COLS * z, C.GRID_ROWS * z);
  ctx.fillStyle = "#122b35";
  ctx.fillRect(x, y, boardWidth, z);
  ctx.fillRect(x, y + (C.GRID_ROWS - 1) * z, boardWidth, z);
  ctx.fillRect(x, y, z, boardHeight);
  ctx.fillRect(x + (C.GRID_COLS - 1) * z, y, z, boardHeight);
  for (let row = 0; row < C.GRID_ROWS; row++)
    for (let col = 0; col < C.GRID_COLS; col++) {
      const wall =
        row === 0 ||
        row === C.GRID_ROWS - 1 ||
        col === 0 ||
        col === C.GRID_COLS - 1;
      ctx.strokeStyle = wall ? "#20404b" : "#112630";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + col * z + 0.5, y + row * z + 0.5, z, z);
      if (wall) {
        ctx.fillStyle = "#31515a";
        ctx.fillRect(x + col * z + 14, y + row * z + 14, 4, 4);
      }
    }
  ctx.strokeStyle = "#39786e";
  ctx.strokeRect(
    x + z + 0.5,
    y + z + 0.5,
    boardWidth - 2 * z,
    boardHeight - 2 * z,
  );
  ctx.strokeStyle = "#3e6d72";
  ctx.strokeRect(x + 0.5, y + 0.5, boardWidth, boardHeight);
  for (const c of s.obstacles) {
    ctx.fillStyle = "#825762";
    ctx.fillRect(x + c.col * z + 2, y + c.row * z + 2, 28, 28);
    line(
      ctx,
      x + c.col * z + 6,
      y + c.row * z + 6,
      x + c.col * z + 26,
      y + c.row * z + 26,
      "#e6a2b2",
    );
  }
  if (s.pellet) pellet(ctx, s.pellet.col, s.pellet.row, s.simTime);
  snake(ctx, s);
  for (const p of s.sparks) {
    const age = s.simTime - p.at,
      alpha = Math.max(0, 1 - age / 0.65);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = amber;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        d = 10 + age * (45 + (i % 3) * 22);
      ctx.fillRect(
        x + p.col * z + 16 + Math.cos(a) * d,
        y + p.row * z + 16 + Math.sin(a) * d,
        3,
        3,
      );
    }
    ctx.restore();
  }
}
function hud(ctx: Context, s: State) {
  text(ctx, C.TITLE_TEXT, 48, 58, 27, cyan, "left", 700);
  text(ctx, "08 HZ", 48, 82, 12, muted);
  text(ctx, C.SCORE_LABEL, 194, 39, 13, muted);
  text(ctx, String(s.score).padStart(5, "0"), 192, 85, 40, ink, "left", 700);
  text(ctx, C.BEST_LABEL, 412, 39, 13, muted);
  text(ctx, String(s.best).padStart(5, "0"), 410, 85, 40, ink, "left", 700);
  if (s.combo >= 2) {
    text(ctx, `x${s.combo}`, 652, 70, 40, lime, "left", 700);
    text(ctx, "CHAIN", 731, 48, 12, lime);
    ctx.fillStyle = "#223934";
    ctx.fillRect(653, 86, 184, 5);
    ctx.fillStyle = lime;
    ctx.fillRect(653, 86, (184 * s.comboWindow) / C.COMBO_WINDOW, 5);
  }
  text(ctx, C.MODE_LABEL, 920, 47, 16, cyan);
  text(ctx, "ENCLOSED / 01", 920, 74, 12, muted);
  text(
    ctx,
    s.muted ? "M / MUTED" : "M / SOUND ON",
    1216,
    48,
    12,
    s.muted ? amber : muted,
    "right",
  );
  text(ctx, "P / PAUSE", 1216, 74, 12, muted, "right");
  line(ctx, 160, 105, 1120, 105, "#213440");
  ctx.save();
  ctx.translate(128, 674);
  ctx.rotate(-Math.PI / 2);
  text(ctx, "KEEP MOVING. KEEP GROWING.", 0, 0, 12, muted);
  ctx.restore();
  text(ctx, "28 × 16", 1150, 677, 11, muted);
}
function menu(ctx: Context, s: State) {
  menuItems(s.screen).forEach((label, i) => {
    const r = menuRect(s, i)!,
      selected = i === s.menuIndex;
    ctx.fillStyle = selected ? lime : "#13242e";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (!selected) {
      ctx.strokeStyle = "#35515b";
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
    text(
      ctx,
      label,
      r.x + 22,
      r.y + 30,
      18,
      selected ? "#122422" : ink,
      "left",
      700,
    );
    text(
      ctx,
      selected ? "↗" : "·",
      r.x + r.w - 24,
      r.y + 30,
      20,
      selected ? "#122422" : muted,
      "right",
    );
  });
}
function titleScreen(ctx: Context, s: State) {
  ctx.fillStyle = "#08121e";
  ctx.fillRect(C.BOARD_X, C.BOARD_Y, boardWidth, boardHeight);
  for (let x = C.BOARD_X; x < C.BOARD_X + boardWidth; x += C.CELL)
    line(ctx, x, C.BOARD_Y, x, C.BOARD_Y + boardHeight, "#10212d");
  for (let y = C.BOARD_Y; y < C.BOARD_Y + boardHeight; y += C.CELL)
    line(ctx, C.BOARD_X, y, C.BOARD_X + boardWidth, y, "#10212d");
  text(ctx, "01 / THE ORIGINAL ENDLESS PURSUIT", 240, 179, 12, cyan);
  text(ctx, C.TITLE_TEXT, 229, 319, 132, ink, "left", 900);
  text(ctx, C.TAGLINE_TEXT, 241, 355, 21, cyan, "left", 700);
  text(ctx, "Find your rhythm. Follow your hunger.", 241, 388, 14, muted);
  // A composed coil made from the actual native-size game sprites.
  const cells: C.Cell[] = [];
  for (let col = 23; col >= 19; col--) cells.push({ col, row: 6 });
  for (let row = 7; row <= 11; row++) cells.push({ col: 19, row });
  for (let col = 20; col <= 25; col++) cells.push({ col, row: 11 });
  for (let row = 10; row >= 3; row--) cells.push({ col: 25, row });
  for (let col = 24; col >= 17; col--) cells.push({ col, row: 3 });
  for (let row = 4; row <= 13; row++) cells.push({ col: 17, row });
  snake(ctx, { ...s, dir: "right" }, cells);
  pellet(ctx, 24, 6, 0);
  text(ctx, "EAT / GROW / REPEAT", 848, 605, 13, cyan, "center");
  menu(ctx, s);
  text(ctx, C.BEST_LABEL, 241, 589, 12, muted);
  text(ctx, String(s.best).padStart(5, "0"), 241, 627, 30, ink);
  text(ctx, "↑ ↓ SELECT     ENTER TO BEGIN", 240, 666, 12, muted);
}
function panel(ctx: Context, s: State) {
  ctx.fillStyle = "#060d18cc";
  ctx.fillRect(C.BOARD_X, C.BOARD_Y, boardWidth, boardHeight);
  const how = s.screen === "howto";
  const x = how ? 260 : 400,
    w = how ? 760 : 480;
  ctx.fillStyle = "#0c1a26";
  ctx.fillRect(x, 178, w, 478);
  ctx.strokeStyle = "#31505c";
  ctx.strokeRect(x + 0.5, 178.5, w - 1, 478);
  ctx.fillStyle = cyan;
  ctx.fillRect(x, 178, 48, 3);
  if (how) {
    text(ctx, "FIELD GUIDE / 01", 304, 223, 12, cyan);
    text(ctx, "HOW TO PLAY", 304, 268, 35, ink, "left", 700);
    const rows = [
      [
        "01",
        "STAY IN MOTION",
        "Steer with arrows or WASD. Turns land on the next tick.",
      ],
      [
        "02",
        "KNOW YOUR LIMITS",
        "Turn sideways; never double back. Walls and body are fatal.",
      ],
      [
        "03",
        "FOLLOW YOUR HUNGER",
        "Each amber pellet adds one cell to your serpent.",
      ],
      [
        "04",
        "KEEP THE CHAIN",
        "Eat again within 3.5 seconds to build up to x5. Wait: x1.",
      ],
    ];
    rows.forEach(([n, title, desc], i) => {
      const y = 315 + i * 60;
      text(ctx, n, 304, y, 14, cyan);
      text(ctx, title, 345, y, 15, ink, "left", 700);
      text(ctx, desc, 345, y + 22, 13, muted);
    });
    text(
      ctx,
      "ENTER / SPACE  Confirm     ESC / P  Pause or resume",
      304,
      552,
      13,
      muted,
    );
    text(
      ctx,
      "M  Mute     ESC  Back     ↑ ↓  Select a menu item",
      304,
      573,
      13,
      muted,
    );
  } else {
    text(
      ctx,
      s.screen === "paused" ? "SIGNAL HELD" : "ROUND COMPLETE",
      640,
      222,
      12,
      cyan,
      "center",
    );
    text(
      ctx,
      s.screen === "paused"
        ? "PAUSED"
        : s.screen === "cleared"
          ? C.CLEARED_TEXT
          : C.GAMEOVER_TEXT,
      640,
      283,
      s.screen === "cleared" ? 36 : 44,
      ink,
      "center",
      700,
    );
    if (s.screen === "paused")
      text(
        ctx,
        "Take a breath. Your coil can wait.",
        640,
        328,
        14,
        muted,
        "center",
      );
    else {
      text(ctx, C.SCORE_LABEL, 490, 333, 12, muted);
      text(ctx, C.BEST_LABEL, 694, 333, 12, muted);
      text(ctx, String(s.score), 490, 382, 38, lime);
      text(ctx, String(s.best), 694, 382, 38, ink);
    }
  }
  menu(ctx, s);
}
export function render(s: State, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  const gradient = ctx.createLinearGradient(0, 0, C.STAGE_W, C.STAGE_H);
  gradient.addColorStop(0, "#0d1b29");
  gradient.addColorStop(1, "#070e19");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  board(ctx, s);
  hud(ctx, s);
  if (s.screen === "title") titleScreen(ctx, s);
  else if (s.screen !== "playing") panel(ctx, s);
}
