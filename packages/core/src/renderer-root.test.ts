import { expect, test } from "bun:test";
import { Text } from "./renderable";
import { createTestRenderer } from "./testing/index";

const white = { r: 255, g: 255, b: 255, a: 255 };

test("renderer exposes root with initial dimensions", () => {
  const { renderer } = createTestRenderer({ width: 40, height: 10 });

  expect(renderer.root.width).toBe(40);
  expect(renderer.root.height).toBe(10);
  renderer.destroy();
});

test("renderer render includes root tree output", () => {
  const { renderer, captureCharFrame } = createTestRenderer({
    width: 20,
    height: 5,
  });

  renderer.root.add(
    Text({ x: 2, y: 1, content: "Tree", foregroundColor: white })
  );
  renderer.render();

  expect(captureCharFrame()).toContain("Tree");
  renderer.destroy();
});

test("renderer renderForce includes root tree output", () => {
  const { renderer, captureCharFrame } = createTestRenderer({
    width: 20,
    height: 5,
  });

  renderer.root.add(
    Text({ x: 2, y: 1, content: "Force", foregroundColor: white })
  );
  renderer.renderForce();

  expect(captureCharFrame()).toContain("Force");
  renderer.destroy();
});

test("direct buffer-first rendering works when root is empty", () => {
  const { renderer, captureCharFrame } = createTestRenderer({
    width: 20,
    height: 5,
  });

  renderer.getNextBuffer().drawText("Direct", 1, 1, white);
  renderer.render();

  expect(captureCharFrame()).toContain("Direct");
  renderer.destroy();
});

test("resize updates renderer root dimensions", async () => {
  const { renderer, resize } = createTestRenderer({ width: 80, height: 24 });

  resize(120, 40);
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(renderer.root.width).toBe(120);
  expect(renderer.root.height).toBe(40);
  renderer.destroy();
});
