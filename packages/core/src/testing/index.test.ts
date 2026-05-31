import { expect, test } from "bun:test";
import { Box, Text } from "../renderable";
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

test("captured frames include layout-driven output", async () => {
  const { renderer, renderOnce, captureCharFrame, captureSpans } =
    await createTestRenderer({
      width: 20,
      height: 6,
    });

  renderer.root.setLayoutProps({ flexDirection: "column" });
  renderer.root
    .add(
      Box(
        { height: 3, padding: 1 },
        Text({ content: "Head", foregroundColor: white })
      )
    )
    .add(
      Box({ flexGrow: 1 }, Text({ content: "Body", foregroundColor: white }))
    );

  await renderOnce();

  const frame = captureCharFrame();
  const spans = captureSpans();
  expect(frame).toContain("Head");
  expect(frame).toContain("Body");
  expect(
    spans.lines.some((line) => line.spans.some((span) => span.text === "Head"))
  ).toBe(true);

  renderer.destroy();
});

test("test harness resize invalidates layout and captured spans reflect new size", async () => {
  const { renderer, resize, renderOnce, captureSpans } =
    await createTestRenderer({
      width: 20,
      height: 6,
    });
  const body = Box(
    { flexGrow: 1 },
    Text({ content: "Body", foregroundColor: white })
  );

  renderer.root.setLayoutProps({ flexDirection: "column" });
  renderer.root.add(Box({ height: 2 })).add(body);
  await renderOnce();
  expect(body.computedLayout.height).toBe(4);

  resize(20, 10);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await renderOnce();

  expect(body.computedLayout.height).toBe(8);
  expect(captureSpans().rows).toBe(10);
  renderer.destroy();
});

test("mockMouse.click triggers mouse event", async () => {
  const { renderer, mockMouse } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: true,
  });

  const events: any[] = [];
  renderer.on("mouse", (e: any) => {
    events.push(e);
  });

  mockMouse.click(10, 5);
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(events.length).toBeGreaterThanOrEqual(2);
  expect(events[0].kind).toBe("down");
  expect(events[0].x).toBe(10);
  expect(events[0].y).toBe(5);
  expect(events[1].kind).toBe("up");

  renderer.destroy();
});

test("mockMouse.move triggers mouse event", async () => {
  const { renderer, mockMouse } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: true,
  });

  let receivedEvent: any = null;
  renderer.on("mouse", (e: any) => {
    receivedEvent = e;
  });

  mockMouse.move(15, 8);
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(receivedEvent).not.toBeNull();
  expect(receivedEvent.kind).toBe("move");

  renderer.destroy();
});

test("mockMouse.scroll triggers scroll event", async () => {
  const { renderer, mockMouse } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: true,
  });

  let receivedEvent: any = null;
  renderer.on("mouse", (e: any) => {
    receivedEvent = e;
  });

  mockMouse.scroll(10, 5, "up");
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(receivedEvent).not.toBeNull();
  expect(receivedEvent.kind).toBe("scroll");
  expect(receivedEvent.scroll?.direction).toBe("up");

  renderer.destroy();
});

test("mockMouse.down and mockMouse.up trigger events", async () => {
  const { renderer, mockMouse } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: true,
  });

  const events: any[] = [];
  renderer.on("mouse", (e: any) => {
    events.push(e);
  });

  mockMouse.down(5, 3);
  await new Promise((resolve) => setTimeout(resolve, 10));
  mockMouse.up(5, 3);
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(events.length).toBe(2);
  expect(events[0].kind).toBe("down");
  expect(events[1].kind).toBe("up");

  renderer.destroy();
});

test("mockMouse.drag triggers drag sequence", async () => {
  const { renderer, mockMouse } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: true,
  });

  const events: any[] = [];
  renderer.on("mouse", (e: any) => {
    events.push(e);
  });

  mockMouse.drag(5, 5, 15, 8);
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(events.length).toBeGreaterThanOrEqual(3);
  expect(events[0].kind).toBe("down");
  expect(events[1].kind).toBe("drag");
  expect(events[2].kind).toBe("up");

  renderer.destroy();
});

test("constructor with useMouse:true enables mouse", async () => {
  const { renderer } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: true,
  });

  expect(renderer.useMouse).toBe(true);

  renderer.destroy();
});

test("constructor with useMouse:false disables mouse", async () => {
  const { renderer } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: false,
  });

  expect(renderer.useMouse).toBe(false);

  renderer.destroy();
});
