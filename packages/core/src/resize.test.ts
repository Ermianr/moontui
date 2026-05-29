import { expect, test } from "bun:test";
import { createTestRenderer } from "./testing/index";

test("resize event emits to subscribers", async () => {
  const { renderer, resize } = await createTestRenderer({
    width: 80,
    height: 24,
  });

  let received: { width: number; height: number } | null = null;
  renderer.on(
    "resize",
    (event: { type: "resize"; width: number; height: number }) => {
      received = { width: event.width, height: event.height };
    }
  );

  resize(120, 40);

  await new Promise((resolve) => setTimeout(resolve, 20));
  renderer.destroy();

  expect(received).not.toBeNull();
  const size = received as unknown as { width: number; height: number };
  expect(size.width).toBe(120);
  expect(size.height).toBe(40);
});

test("resize updates renderer dimensions", async () => {
  const { renderer, resize } = await createTestRenderer({
    width: 80,
    height: 24,
  });

  resize(120, 40);

  await new Promise((resolve) => setTimeout(resolve, 20));

  const size = renderer.terminalSize();
  renderer.destroy();

  expect(size.width).toBe(120);
  expect(size.height).toBe(40);
});

test("resize goes through full event chain in test harness", async () => {
  const { renderer, resize, getNativeStats } = await createTestRenderer({
    width: 80,
    height: 24,
  });

  let resizeReceived = false;
  renderer.on("resize", () => {
    resizeReceived = true;
  });

  const statsBefore = getNativeStats();
  expect(statsBefore.frameCount).toBe(0);

  resize(120, 40);

  await new Promise((resolve) => setTimeout(resolve, 20));

  const statsAfter = getNativeStats();
  renderer.destroy();

  expect(resizeReceived).toBe(true);
  expect(statsAfter.frameCount).toBe(1);
});
