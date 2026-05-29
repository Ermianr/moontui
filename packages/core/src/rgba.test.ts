import { expect, test } from "bun:test";
import { RGBA, toRGBA } from "./rgba";

test("RGBA constructor sets all channels", () => {
  const c = new RGBA(255, 128, 0, 65_535);
  expect(c.r).toBe(255);
  expect(c.g).toBe(128);
  expect(c.b).toBe(0);
  expect(c.a).toBe(65_535);
});

test("RGBA constructor defaults alpha to 65535", () => {
  const c = new RGBA(10, 20, 30);
  expect(c.a).toBe(65_535);
});

test("RGBA buffer is Uint16Array(4)", () => {
  const c = new RGBA(1, 2, 3, 4);
  expect(c.buffer).toBeInstanceOf(Uint16Array);
  expect(c.buffer.length).toBe(4);
  expect(c.buffer[0]).toBe(1);
  expect(c.buffer[1]).toBe(2);
  expect(c.buffer[2]).toBe(3);
  expect(c.buffer[3]).toBe(4);
});

test("toRGBA converts plain object", () => {
  const c = toRGBA({ r: 10, g: 20, b: 30, a: 40 });
  expect(c).toBeInstanceOf(RGBA);
  expect(c.r).toBe(10);
  expect(c.g).toBe(20);
  expect(c.b).toBe(30);
  expect(c.a).toBe(40);
});

test("toRGBA returns RGBA instance as-is", () => {
  const original = new RGBA(1, 2, 3, 4);
  const result = toRGBA(original);
  expect(result).toBe(original);
});

test("toRGBA defaults alpha to 65535 for plain object", () => {
  const c = toRGBA({ r: 10, g: 20, b: 30 });
  expect(c.a).toBe(65_535);
});
