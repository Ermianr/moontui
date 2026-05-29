import { expect, test } from "bun:test";
import { createTestRenderer } from "./index";

const white = { r: 65_535, g: 65_535, b: 65_535, a: 65_535 };
const black = { r: 0, g: 0, b: 0, a: 65_535 };

test("box with text renders correct borders", async () => {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({
    width: 40,
    height: 10,
  });

  const buffer = renderer.getNextBuffer();
  buffer.clear(black);
  buffer.drawBox({
    x: 5,
    y: 2,
    width: 10,
    height: 4,
    border: true,
    borderColor: white,
    backgroundColor: black,
  });
  buffer.drawText("Hi!", 7, 3, white);

  await renderOnce();

  const frame = captureCharFrame();
  expect(frame).toContain("│");
  expect(frame).toContain("─");
  expect(frame).toContain("Hi!");

  renderer.destroy();
});

test("text appears at coordinates", async () => {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({
    width: 20,
    height: 5,
  });

  const buffer = renderer.getNextBuffer();
  buffer.clear(black);
  buffer.drawText("Moon", 3, 2, white);

  await renderOnce();

  const frame = captureCharFrame();
  expect(frame).toContain("Moon");

  renderer.destroy();
});

test("stats report cells_updated", async () => {
  const { renderer, renderOnce, getNativeStats } = await createTestRenderer({
    width: 10,
    height: 5,
  });

  const buffer = renderer.getNextBuffer();
  buffer.clear(black);
  buffer.drawText("Hello", 0, 0, white);

  await renderOnce();

  const stats = getNativeStats();
  expect(stats.cellsUpdated).toBeGreaterThan(0);
  expect(stats.frameCount).toBe(1);

  renderer.destroy();
});

test("input simulation triggers events", async () => {
  const { renderer, mockInput } = await createTestRenderer({
    width: 10,
    height: 5,
  });

  let received = false;
  renderer.on("key", (event: { key: string }) => {
    if (event.key === "x") {
      received = true;
    }
  });

  mockInput.pressKey("x");
  // Allow polling interval to fire
  await new Promise((resolve) => setTimeout(resolve, 20));
  renderer.destroy();

  expect(received).toBe(true);
});

test("captureSpans returns structured output", async () => {
  const { renderer, renderOnce, captureSpans } = await createTestRenderer({
    width: 10,
    height: 5,
  });

  const buffer = renderer.getNextBuffer();
  buffer.clear(black);
  buffer.drawText("Hi", 0, 0, white);

  await renderOnce();

  const spans = captureSpans();
  expect(spans.cols).toBe(10);
  expect(spans.rows).toBe(5);
  expect(spans.lines.length).toBe(5);

  renderer.destroy();
});
