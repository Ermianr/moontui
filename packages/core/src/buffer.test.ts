import { expect, test } from "bun:test";
import { MoonBuffer } from "./buffer";
import { api } from "./ffi";

const white = { r: 65_535, g: 65_535, b: 65_535, a: 65_535 };
const black = { r: 0, g: 0, b: 0, a: 65_535 };
const red = { r: 65_535, g: 0, b: 0, a: 65_535 };

function createBuffer(
  width: number,
  height: number
): {
  buf: MoonBuffer;
  rendererPtr: ReturnType<typeof api.renderer.createRenderer>;
} {
  const rendererPtr = api.renderer.createRenderer(width, height, false);
  const bufPtr = api.renderer.getNextBuffer(rendererPtr);
  return { buf: new MoonBuffer(bufPtr, width, height), rendererPtr };
}

test("buffer clear fills with background color", () => {
  const { buf, rendererPtr } = createBuffer(5, 3);
  buf.clear(red);
  const bytes = buf.getRealCharBytes(false);
  const text = new TextDecoder().decode(bytes);
  expect(text).toBe("     ".repeat(3));
  api.renderer.destroyRenderer(rendererPtr);
});

test("buffer drawText places text at coordinates", () => {
  const { buf, rendererPtr } = createBuffer(10, 5);
  buf.clear(black);
  buf.drawText("Moon", 2, 2, white);
  const bytes = buf.getRealCharBytes(true);
  const lines = new TextDecoder().decode(bytes).split("\n");
  expect(lines[2]).toContain("Moon");
  api.renderer.destroyRenderer(rendererPtr);
});

test("buffer drawText ignores empty text", () => {
  const rendererPtr = api.renderer.createRenderer(10, 5, true);
  const bufPtr = api.renderer.getNextBuffer(rendererPtr);
  const buf = new MoonBuffer(bufPtr, 10, 5);

  expect(() => buf.drawText("", 0, 0, white)).not.toThrow();

  api.renderer.destroyRenderer(rendererPtr);
});

test("buffer drawChar places single character", () => {
  const { buf, rendererPtr } = createBuffer(5, 5);
  buf.clear(black);
  buf.drawChar("X".codePointAt(0) ?? 0, 1, 1, white);
  const bytes = buf.getRealCharBytes(false);
  const text = new TextDecoder().decode(bytes);
  expect(text).toContain("X");
  api.renderer.destroyRenderer(rendererPtr);
});

test("buffer fillRect fills region", () => {
  const { buf, rendererPtr } = createBuffer(10, 5);
  buf.clear(black);
  buf.fillRect(2, 1, 4, 2, red);
  const spans = buf.getSpanLines();
  expect(spans.length).toBe(5);
  api.renderer.destroyRenderer(rendererPtr);
});

test("buffer drawBox renders borders", () => {
  const { buf, rendererPtr } = createBuffer(20, 10);
  buf.clear(black);
  buf.drawBox({
    x: 2,
    y: 2,
    width: 8,
    height: 4,
    border: true,
    borderColor: white,
    backgroundColor: black,
  });
  const spans = buf.getSpanLines();
  expect(spans.length).toBe(10);
  api.renderer.destroyRenderer(rendererPtr);
});

test("buffer getSpanLines groups identical styles", () => {
  const { buf, rendererPtr } = createBuffer(10, 3);
  buf.clear(black);
  buf.drawText("Hello", 0, 0, white);
  const spans = buf.getSpanLines();
  expect(spans[0].spans.length).toBeGreaterThanOrEqual(1);
  api.renderer.destroyRenderer(rendererPtr);
});

test("buffer getSpanLines after resize reads fresh pointers", () => {
  const rendererPtr = api.renderer.createRenderer(10, 5, false);
  const bufPtr = api.renderer.getNextBuffer(rendererPtr);
  const buf = new MoonBuffer(bufPtr, 10, 5);
  buf.clear(black);
  buf.drawText("Hello", 0, 0, white);

  const spansBefore = buf.getSpanLines();
  expect(spansBefore.length).toBe(5);
  expect(spansBefore[0].spans[0].text).toContain("Hello");

  api.renderer.resizeRenderer(rendererPtr, 20, 10);
  const newBufPtr = api.renderer.getNextBuffer(rendererPtr);
  const newBuf = new MoonBuffer(newBufPtr, 20, 10);
  newBuf.clear(red);
  newBuf.drawText("World", 0, 0, white);

  const spansAfter = newBuf.getSpanLines();
  expect(spansAfter.length).toBe(10);
  expect(spansAfter[0].spans[0].text).toContain("World");

  api.renderer.destroyRenderer(rendererPtr);
});
