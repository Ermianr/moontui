import { expect, test } from "bun:test";
import { api, type Pointer, type Renderer } from "./ffi";

test("api.terminal.getTerminalSize returns { width, height } object", () => {
  const size = api.terminal.getTerminalSize();
  expect(typeof size).toBe("object");
  expect(typeof size.width).toBe("number");
  expect(typeof size.height).toBe("number");
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);
});

test("api.renderer.getRenderStats returns typed object with correct fields", () => {
  const rendererPtr = api.renderer.createRenderer(10, 5, true);
  api.renderer.render(rendererPtr, true);

  const stats = api.renderer.getRenderStats(rendererPtr);
  expect(typeof stats.lastFrameTimeMs).toBe("number");
  expect(typeof stats.averageFrameTimeMs).toBe("number");
  expect(typeof stats.frameCount).toBe("number");
  expect(typeof stats.cellsUpdated).toBe("number");
  expect(typeof stats.averageCellsUpdated).toBe("number");
  expect(typeof stats.renderTimeUs).toBe("number");
  expect(typeof stats.stdoutWriteTimeUs).toBe("number");

  expect(stats.lastFrameTimeMs).toBeGreaterThanOrEqual(0);
  expect(stats.frameCount).toBeGreaterThanOrEqual(1);

  api.renderer.destroyRenderer(rendererPtr);
});

test("api.events.createEventCallback creates working callback", () => {
  const rendererPtr = api.renderer.createRenderer(10, 5, true);
  let receivedKey: string | null = null;
  let receivedCtrl = false;
  let receivedShift = false;
  let receivedAlt = false;

  const callback = api.events.createEventCallback((event) => {
    receivedKey = event.key;
    receivedCtrl = event.ctrl;
    receivedShift = event.shift;
    receivedAlt = event.alt;
  });

  expect(receivedKey).toBeNull();
  expect(receivedCtrl).toBe(false);
  expect(receivedShift).toBe(false);
  expect(receivedAlt).toBe(false);

  expect(callback.ptr).toBeDefined();
  expect(typeof callback.close).toBe("function");

  api.events.setEventCallback(
    rendererPtr,
    callback.ptr as unknown as Pointer<Renderer>
  );
  api.terminal.setupTerminal(rendererPtr, false);

  api.renderer.destroyRenderer(rendererPtr);
  callback.close();
});
