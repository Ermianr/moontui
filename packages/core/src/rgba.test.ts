import { expect, test } from "bun:test";
import {
  ColorIntent,
  indexed,
  RGBA,
  rgb,
  terminalDefault,
  toRGBA,
} from "./rgba";

test("RGBA constructor sets all channels", () => {
  const c = new RGBA(255, 128, 0, 255);
  expect(c.r).toBe(255);
  expect(c.g).toBe(128);
  expect(c.b).toBe(0);
  expect(c.a).toBe(255);
});

test("RGBA constructor defaults alpha to 255", () => {
  const c = new RGBA(10, 20, 30);
  expect(c.a).toBe(255);
});

test("RGBA constructor defaults to Rgb intent", () => {
  const c = new RGBA(255, 0, 0, 255);
  expect(c.intent).toBe(ColorIntent.Rgb);
});

test("RGBA constructor with Indexed intent", () => {
  const c = new RGBA(255, 0, 0, 255, ColorIntent.Indexed, 9);
  expect(c.intent).toBe(ColorIntent.Indexed);
  expect(c.slot).toBe(9);
});

test("RGBA constructor with Default intent", () => {
  const c = new RGBA(0, 0, 0, 255, ColorIntent.Default);
  expect(c.intent).toBe(ColorIntent.Default);
});

test("RGBA buffer is Uint16Array(4)", () => {
  const c = new RGBA(1, 2, 3, 4);
  expect(c.buffer).toBeInstanceOf(Uint16Array);
  expect(c.buffer.length).toBe(4);
});

test("RGBA packs intent in high bytes", () => {
  const c = new RGBA(255, 0, 0, 255, ColorIntent.Rgb);
  // Rgb intent = 0, so high byte should be 0
  expect(c.buffer[0] >> 8).toBe(0);
  expect(c.buffer[0] & 0xff).toBe(255);
});

test("RGBA packs Indexed intent in high bytes", () => {
  const c = new RGBA(255, 0, 0, 255, ColorIntent.Indexed, 9);
  // Indexed intent = 1, slot = 9
  const highByte = c.buffer[0] >> 8;
  expect(highByte & 0x03).toBe(1); // intent bits
  expect((highByte >> 2) & 0x3f).toBe(9); // slot bits
});

test("rgb helper creates Rgb intent RGBA", () => {
  const c = rgb(255, 128, 0);
  expect(c.intent).toBe(ColorIntent.Rgb);
  expect(c.r).toBe(255);
  expect(c.g).toBe(128);
  expect(c.b).toBe(0);
  expect(c.a).toBe(255);
});

test("indexed helper creates Indexed intent RGBA", () => {
  const c = indexed(9, 255, 0, 0);
  expect(c.intent).toBe(ColorIntent.Indexed);
  expect(c.slot).toBe(9);
  expect(c.r).toBe(255);
});

test("terminalDefault helper creates Default intent RGBA", () => {
  const c = terminalDefault();
  expect(c.intent).toBe(ColorIntent.Default);
  expect(c.r).toBe(0);
  expect(c.g).toBe(0);
  expect(c.b).toBe(0);
});

test("toRGBA converts plain object with Rgb intent", () => {
  const c = toRGBA({ r: 10, g: 20, b: 30, a: 40 });
  expect(c).toBeInstanceOf(RGBA);
  expect(c.r).toBe(10);
  expect(c.g).toBe(20);
  expect(c.b).toBe(30);
  expect(c.a).toBe(40);
  expect(c.intent).toBe(ColorIntent.Rgb);
});

test("toRGBA returns RGBA instance as-is", () => {
  const original = new RGBA(1, 2, 3, 4);
  const result = toRGBA(original);
  expect(result).toBe(original);
});

test("toRGBA defaults alpha to 255 for plain object", () => {
  const c = toRGBA({ r: 10, g: 20, b: 30 });
  expect(c.a).toBe(255);
});

test("toRGBA with intent parameter", () => {
  const c = toRGBA({ r: 10, g: 20, b: 30 }, ColorIntent.Indexed);
  expect(c.intent).toBe(ColorIntent.Indexed);
});

test("ColorIntent enum values", () => {
  expect(ColorIntent.Rgb).toBe(0);
  expect(ColorIntent.Indexed).toBe(1);
  expect(ColorIntent.Default).toBe(2);
});

test("RGBA.fromPackedBuffer constructs from valid packed buffer", () => {
  const packed = new Uint16Array([0x00_ff, 0x00_80, 0x00_00, 0xff_ff]);
  const rgba = RGBA.fromPackedBuffer(packed);
  expect(rgba).toBeInstanceOf(RGBA);
  expect(rgba.buffer[0]).toBe(0x00_ff);
  expect(rgba.r).toBe(255);
  expect(rgba.g).toBe(128);
  expect(rgba.b).toBe(0);
  expect(rgba.intent).toBe(ColorIntent.Rgb);
});

test("RGBA.fromPackedBuffer rejects buffer with wrong length", () => {
  expect(() => RGBA.fromPackedBuffer(new Uint16Array([1, 2, 3]))).toThrow(
    "expected length 4"
  );
});

test("RGBA.fromPackedBuffer rejects empty buffer", () => {
  expect(() => RGBA.fromPackedBuffer(new Uint16Array([]))).toThrow(
    "expected length 4"
  );
});
