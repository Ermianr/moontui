import { expect, test } from "bun:test";
import { KeyEvent } from "./renderer";

test("KeyEvent has correct defaults", () => {
  const e = new KeyEvent("a", { ctrl: false, shift: false, alt: false });
  expect(e.key).toBe("a");
  expect(e.type).toBe("key");
  expect(e.modifiers.ctrl).toBe(false);
  expect(e.modifiers.shift).toBe(false);
  expect(e.modifiers.alt).toBe(false);
  expect(e.defaultPrevented).toBe(false);
  expect(e.propagationStopped).toBe(false);
});

test("KeyEvent preventDefault sets flag", () => {
  const e = new KeyEvent("x", { ctrl: false, shift: false, alt: false });
  e.preventDefault();
  expect(e.defaultPrevented).toBe(true);
  expect(e.propagationStopped).toBe(false);
});

test("KeyEvent stopPropagation sets flag", () => {
  const e = new KeyEvent("y", { ctrl: true, shift: false, alt: false });
  e.stopPropagation();
  expect(e.propagationStopped).toBe(true);
  expect(e.defaultPrevented).toBe(false);
});

test("KeyEvent both flags can be set", () => {
  const e = new KeyEvent("z", { ctrl: false, shift: true, alt: true });
  e.preventDefault();
  e.stopPropagation();
  expect(e.defaultPrevented).toBe(true);
  expect(e.propagationStopped).toBe(true);
});
