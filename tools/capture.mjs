/* global document, KeyboardEvent */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page.waitForTimeout(700);
await page.screenshot({ path: "showcase/title.png" });
await page.route("**/capture", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html><body style="margin:0;background:#070e19"><canvas id="capture" style="width:100vw;height:100vh;display:block"></canvas></body></html>',
  }),
);
await page.goto("http://localhost:5173/capture");
const recording = await page.evaluate(async () => {
  const { createEngine, ConstantClock } =
    await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
  const { game, BACKGROUND } = await import("/src/game.ts");
  const engine = createEngine({
    canvas: document.querySelector("canvas"),
    width: 1280,
    height: 720,
    game,
    background: BACKGROUND,
    clock: { delta: () => 0 },
  });
  await engine.initialize();
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter" }));
  await engine.advance(1);
  document.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));
  const d = engine.debug;
  const cells = [];
  for (let col = 12; col >= 6; col--) cells.push({ col, row: 5 });
  for (let row = 6; row <= 11; row++) cells.push({ col: 6, row });
  for (let col = 7; col <= 12; col++) cells.push({ col, row: 11 });
  engine.apply((s) => d.setSnake(s, cells));
  const route = [];
  let col = 12,
    row = 5;
  for (const [dir, n, dx, dy] of [
    ["right", 12, 1, 0],
    ["down", 7, 0, 1],
    ["left", 12, -1, 0],
    ["up", 6, 0, -1],
    ["right", 8, 1, 0],
    ["down", 4, 0, 1],
  ])
    for (let i = 0; i < n; i++) {
      col += dx;
      row += dy;
      route.push({ col, row, dir });
    }
  engine.apply((s) => d.setPellet(s, route[2].col, route[2].row));
  engine.setClock(new ConstantClock(31.25));
  engine.startRecording();
  for (let i = 0; i < route.length; i++) {
    if (i === 0 || route[i].dir !== route[i - 1].dir) {
      const code = {
        right: "ArrowRight",
        down: "ArrowDown",
        left: "ArrowLeft",
        up: "ArrowUp",
      }[route[i].dir];
      document.dispatchEvent(new KeyboardEvent("keydown", { code }));
      document.dispatchEvent(new KeyboardEvent("keyup", { code }));
    }
    if (i % 3 === 2 && route[i + 3])
      engine.apply((s) =>
        d.setNextPellet(s, route[i + 3].col, route[i + 3].row),
      );
    await engine.advance(4);
    if (engine.state.screen !== "playing")
      throw new Error("Showcase route collided");
  }
  return engine.stopRecording();
});
await writeFile("showcase/combo.json.gz", gzipSync(JSON.stringify(recording)));
await page.screenshot({ path: "showcase/play.png" });
if (errors.length) throw new Error(errors.join("\n"));
await browser.close();
