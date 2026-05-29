import { expect, test } from "bun:test";
import { CliRenderer } from "./renderer";

test("CliRenderer method after destroy throws", () => {
  const renderer = new CliRenderer({ test: true, width: 10, height: 5 });
  renderer.destroy();
  expect(() => renderer.render()).toThrow("CliRenderer used after destroy");
});

test("CliRenderer double destroy is safe", () => {
  const renderer = new CliRenderer({ test: true, width: 10, height: 5 });
  renderer.destroy();
  expect(() => renderer.destroy()).not.toThrow();
});

test("CliRenderer _unsafePtr returns pointer", () => {
  const renderer = new CliRenderer({ test: true, width: 10, height: 5 });
  const p = renderer._unsafePtr;
  expect(typeof p).toBe("number");
  expect(p).not.toBe(0);
  renderer.destroy();
});

test("CliRenderer all public methods guarded after destroy", () => {
  const renderer = new CliRenderer({ test: true, width: 10, height: 5 });
  renderer.destroy();
  expect(() => renderer.processEvents()).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.setupTerminal()).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.restoreTerminal()).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.getCurrentBuffer()).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.getNextBuffer()).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.renderForce()).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.getStats()).toThrow("CliRenderer used after destroy");
  expect(() => renderer.setCursorPosition(0, 0, false)).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.terminalSize()).toThrow(
    "CliRenderer used after destroy"
  );
  expect(() => renderer.emitKeyEvent("a", false, false, false)).toThrow(
    "CliRenderer used after destroy"
  );
});
