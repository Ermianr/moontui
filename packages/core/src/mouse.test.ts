import { expect, test } from "bun:test";
import {
  buttonFromNative,
  MouseEvent,
  scrollDirectionFromNative,
} from "./mouse";

test("MouseEvent constructor sets properties", () => {
  const event = new MouseEvent({
    kind: "down",
    button: "left",
    x: 10,
    y: 5,
    modifiers: { ctrl: false, shift: false, alt: false },
  });

  expect(event.type).toBe("mouse");
  expect(event.kind).toBe("down");
  expect(event.button).toBe("left");
  expect(event.x).toBe(10);
  expect(event.y).toBe(5);
  expect(event.modifiers).toEqual({ ctrl: false, shift: false, alt: false });
  expect(event.defaultPrevented).toBe(false);
  expect(event.propagationStopped).toBe(false);
});

test("MouseEvent with scroll info", () => {
  const event = new MouseEvent({
    kind: "scroll",
    button: "left",
    x: 5,
    y: 3,
    modifiers: { ctrl: false, shift: false, alt: false },
    scroll: { direction: "up" },
  });

  expect(event.kind).toBe("scroll");
  expect(event.scroll).toEqual({ direction: "up" });
});

test("MouseEvent with target", () => {
  const target = { id: 42 };
  const event = new MouseEvent({
    kind: "down",
    button: "left",
    x: 0,
    y: 0,
    modifiers: { ctrl: false, shift: false, alt: false },
    target,
  });

  expect(event.target).toBe(target);
});

test("MouseEvent.preventDefault sets flag", () => {
  const event = new MouseEvent({
    kind: "down",
    button: "left",
    x: 0,
    y: 0,
    modifiers: { ctrl: false, shift: false, alt: false },
  });

  event.preventDefault();
  expect(event.defaultPrevented).toBe(true);
});

test("MouseEvent.stopPropagation sets flag", () => {
  const event = new MouseEvent({
    kind: "down",
    button: "left",
    x: 0,
    y: 0,
    modifiers: { ctrl: false, shift: false, alt: false },
  });

  event.stopPropagation();
  expect(event.propagationStopped).toBe(true);
});

test("buttonFromNative maps correctly", () => {
  expect(buttonFromNative(0)).toBe("left");
  expect(buttonFromNative(1)).toBe("middle");
  expect(buttonFromNative(2)).toBe("right");
  expect(buttonFromNative(3)).toBe("left");
});

test("scrollDirectionFromNative maps correctly", () => {
  expect(scrollDirectionFromNative(1)).toBe("up");
  expect(scrollDirectionFromNative(2)).toBe("down");
  expect(scrollDirectionFromNative(3)).toBe("left");
  expect(scrollDirectionFromNative(4)).toBe("right");
  expect(scrollDirectionFromNative(0)).toBe("up");
});

test("MouseEvent with drag kind", () => {
  const event = new MouseEvent({
    kind: "drag",
    button: "left",
    x: 15,
    y: 10,
    modifiers: { ctrl: true, shift: false, alt: false },
    isDragging: true,
  });

  expect(event.kind).toBe("drag");
  expect(event.isDragging).toBe(true);
  expect(event.modifiers.ctrl).toBe(true);
});

test("MouseEvent with all event kinds", () => {
  const kinds = [
    "down",
    "up",
    "drag",
    "drag-end",
    "drop",
    "move",
    "over",
    "out",
    "scroll",
  ] as const;

  for (const kind of kinds) {
    const event = new MouseEvent({
      kind,
      button: "left",
      x: 0,
      y: 0,
      modifiers: { ctrl: false, shift: false, alt: false },
    });
    expect(event.kind).toBe(kind);
  }
});
