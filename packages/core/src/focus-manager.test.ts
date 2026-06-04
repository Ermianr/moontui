import { expect, test } from "bun:test";
import { Box, Input, Text } from "./renderable";
import { createSpy, createTestRenderer } from "./testing/index";

test("renderer focuses, blurs, and replaces focused renderables", () => {
  const { renderer } = createTestRenderer({ autoFocus: false });
  const first = Text({ content: "A", focusable: true });
  const second = Text({ content: "B", focusable: true });
  const plain = Text({ content: "C" });
  renderer.root.add(first).add(second).add(plain);

  expect(renderer.focus(first)).toBe(true);
  expect(renderer.focused).toBe(first);
  expect(first.focused).toBe(true);
  expect(renderer.focus(plain)).toBe(false);
  expect(renderer.focused).toBe(first);

  expect(renderer.focus(second)).toBe(true);
  expect(first.focused).toBe(false);
  expect(second.focused).toBe(true);

  renderer.blur();
  expect(renderer.focused).toBeNull();
  expect(second.focused).toBe(false);
  renderer.destroy();
});

test("focus traversal follows renderable tree order", () => {
  const { renderer } = createTestRenderer({ autoFocus: false });
  const first = Text({ content: "A", focusable: true });
  const nested = Text({ content: "B", focusable: true });
  const parent = Box({}, nested);
  const last = Text({ content: "C", focusable: true });
  renderer.root.add(first).add(parent).add(last);

  expect(renderer.focusNext()).toBe(first);
  expect(renderer.focusNext()).toBe(nested);
  expect(renderer.focusNext()).toBe(last);
  expect(renderer.focusPrevious()).toBe(nested);
  renderer.destroy();
});

test("focus traversal wraps at both ends", () => {
  const { renderer } = createTestRenderer({ autoFocus: false });
  const first = Text({ content: "A", focusable: true });
  const second = Text({ content: "B", focusable: true });
  renderer.root.add(first).add(second);

  renderer.focus(second);
  expect(renderer.focusNext()).toBe(first);
  expect(renderer.focusPrevious()).toBe(second);
  renderer.destroy();
});

test("focus traversal skips non-focusable and disabled renderables", () => {
  const { renderer } = createTestRenderer({ autoFocus: false });
  const plain = Text({ content: "A" });
  const disabled = Text({ content: "B", disabled: true, focusable: true });
  const enabled = Text({ content: "C", focusable: true });
  renderer.root.add(plain).add(disabled).add(enabled);

  expect(renderer.focusNext()).toBe(enabled);
  expect(renderer.focus(disabled)).toBe(false);
  expect(renderer.focused).toBe(enabled);
  renderer.destroy();
});

test("tab and shift tab move focus and consume global key delivery", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const first = Text({ content: "A", focusable: true });
  const second = Text({ content: "B", focusable: true });
  const globalKey = createSpy();
  renderer.root.add(first).add(second);
  renderer.focus(first);
  renderer.on("key", globalKey);

  mockInput.pressTab();
  expect(renderer.focused).toBe(second);
  mockInput.pressKey("tab", { shift: true });
  expect(renderer.focused).toBe(first);
  expect(globalKey.callCount()).toBe(0);
  renderer.destroy();
});

test("tab traversal runs before focused input key handling", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const input = Input({ value: "" });
  const next = Text({ content: "Next", focusable: true });
  renderer.root.add(input).add(next);
  renderer.focus(input);

  mockInput.pressKey("Tab");

  expect(input.value).toBe("");
  expect(renderer.focused).toBe(next);
  renderer.destroy();
});

test("terminal tab character traverses focus instead of entering input text", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const input = Input({ value: "" });
  const next = Text({ content: "Next", focusable: true });
  renderer.root.add(input).add(next);
  renderer.focus(input);

  mockInput.pressKey("\t");

  expect(input.value).toBe("");
  expect(renderer.focused).toBe(next);
  renderer.destroy();
});

test("backtab traverses focus backward", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const first = Text({ content: "First", focusable: true });
  const input = Input({ value: "" });
  renderer.root.add(first).add(input);
  renderer.focus(input);

  mockInput.pressKey("BackTab");

  expect(renderer.focused).toBe(first);
  renderer.destroy();
});

test("focused key handlers run before global key listeners", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const order: string[] = [];
  const focused = Text({
    content: "A",
    focusable: true,
    onKey: () => order.push("focused"),
  });
  renderer.root.add(focused);
  renderer.focus(focused);
  renderer.on("key", () => order.push("global"));

  mockInput.pressKey("x");
  expect(order).toEqual(["focused", "global"]);
  renderer.destroy();
});

test("unconsumed focused key events reach global listeners", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const focusedKey = createSpy();
  const globalKey = createSpy();
  const focused = Text({ content: "A", focusable: true, onKey: focusedKey });
  renderer.root.add(focused);
  renderer.focus(focused);
  renderer.on("key", globalKey);

  mockInput.pressKey("x");
  expect(focusedKey.callCount()).toBe(1);
  expect(globalKey.callCount()).toBe(1);
  expect(globalKey.calls[0]?.[0]).toBe(focusedKey.calls[0]?.[0]);
  renderer.destroy();
});

test("stopPropagation prevents global key listeners", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const globalKey = createSpy();
  const focused = Text({
    content: "A",
    focusable: true,
    onKey: (event) => event.stopPropagation(),
  });
  renderer.root.add(focused);
  renderer.focus(focused);
  renderer.on("key", globalKey);

  mockInput.pressKey("x");
  expect(globalKey.callCount()).toBe(0);
  renderer.destroy();
});

test("focus and blur lifecycle callbacks fire in order", () => {
  const { renderer } = createTestRenderer({ autoFocus: false });
  const events: string[] = [];
  const first = Text({
    content: "A",
    focusable: true,
    onFocus: () => events.push("first focus"),
    onBlur: () => events.push("first blur"),
  });
  const second = Text({
    content: "B",
    focusable: true,
    onFocus: () => events.push("second focus"),
  });
  renderer.root.add(first).add(second);

  renderer.focus(first);
  renderer.focus(second);
  expect(events).toEqual(["first focus", "first blur", "second focus"]);
  renderer.destroy();
});

test("autoFocus controls initial focus selection", () => {
  const enabled = createTestRenderer({ autoFocus: true });
  const enabledFirst = Text({ content: "A", focusable: true });
  enabled.renderer.root.add(enabledFirst);
  expect(enabled.renderer.focused).toBe(enabledFirst);
  enabled.renderer.destroy();

  const disabled = createTestRenderer({ autoFocus: false });
  const disabledFirst = Text({ content: "B", focusable: true });
  disabled.renderer.root.add(disabledFirst);
  expect(disabled.renderer.focused).toBeNull();
  disabled.renderer.destroy();
});

test("removing a focused renderable prevents future dispatch to it", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const focusedKey = createSpy();
  const globalKey = createSpy();
  const child = Text({ content: "A", focusable: true, onKey: focusedKey });
  renderer.root.add(child);
  renderer.focus(child);

  renderer.root.remove(child);
  renderer.on("key", globalKey);
  mockInput.pressKey("x");

  expect(child.focused).toBe(false);
  expect(renderer.focused).toBeNull();
  expect(focusedKey.callCount()).toBe(0);
  expect(globalKey.callCount()).toBe(1);
  renderer.destroy();
});
