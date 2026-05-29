# testing-harness

Utilities for testing MoonTUI applications without a real terminal.

## Overview

The test harness creates a renderer that writes to an internal buffer instead of stdout. It provides mock input, frame capture, and spy utilities for writing deterministic tests.

## Requirements

1. `createTestRenderer(options)` creates a `CliRenderer` in testing mode:
   - Native stdout is replaced with an internal `Vec<u8>` (no terminal I/O).
   - `isTTY` is true for the fake stream so the renderer behaves normally.
   - Terminal setup is skipped; the renderer does not enter raw mode.
2. `renderOnce()` triggers one render cycle and returns a promise that resolves when the frame is complete.
3. `captureCharFrame()` returns the content of the front buffer as a UTF-8 string (via `bufferWriteResolvedChars`).
4. `captureSpans()` returns the front buffer as `CapturedFrame` (span lines with cursor position).
5. `getNativeStats()` returns the last `RenderStats` from the native side.
6. `mockKeys.pressKey(key, modifiers?)` simulates a key press.
7. `mockKeys.typeText(text, delayMs?)` simulates typing a string.
8. `spy()` creates a function spy for asserting callbacks.

## TypeScript Interface

```typescript
export interface TestRendererOptions {
  width?: number;
  height?: number;
  kittyKeyboard?: boolean;
}

export interface TestRendererSetup {
  renderer: CliRenderer;
  mockInput: MockKeys;
  renderOnce: () => Promise<void>;
  captureCharFrame: () => string;
  captureSpans: () => CapturedFrame;
  getNativeStats: () => RenderStats;
  resize: (width: number, height: number) => void;
}

export interface CapturedFrame {
  cols: number;
  rows: number;
  cursor: [number, number];
  lines: CapturedLine[];
}

export interface MockKeys {
  pressKey(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }): void;
  typeText(text: string, delayMs?: number): Promise<void>;
  pressEnter(): void;
  pressEscape(): void;
  pressTab(): void;
  pressBackspace(): void;
  pressArrow(direction: "up" | "down" | "left" | "right", modifiers?: { meta?: boolean }): void;
  pressCtrlC(): void;
}

export function createTestRenderer(options?: TestRendererOptions): Promise<TestRendererSetup>;
export function createSpy(): Spy;

export interface Spy {
  (...args: any[]): void;
  callCount(): number;
  calledWith(...args: any[]): boolean;
  calls: any[][];
  reset(): void;
}
```

## Example Test

```typescript
import { test, expect } from "bun:test";
import { createTestRenderer } from "@moontui/core/testing";

test("box with text renders correct borders", async () => {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({
    width: 40,
    height: 10,
  });

  const buffer = renderer.getNextBuffer();
  buffer.drawBox({
    x: 5, y: 2, width: 10, height: 4,
    border: true, borderColor: white, backgroundColor: black,
  });
  buffer.drawText("Hi!", 7, 3, white);

  await renderOnce();

  const frame = captureCharFrame();
  expect(frame).toContain("┌");
  expect(frame).toContain("└");
  expect(frame).toContain("Hi!");

  renderer.destroy();
});
```

## Type Safety Requirements

11. The testing module SHALL access the renderer's internal pointer via the `/** @internal */ _unsafePtr` getter instead of `(renderer as any)._ptr`.

    #### Scenario: resize uses _unsafePtr
    - **WHEN** `setup.resize(w, h)` is called in the test harness
    - **THEN** it SHALL use `renderer._unsafePtr` to access the pointer
    - **AND** no `as any` cast SHALL be present

    #### Scenario: No as any in testing module
    - **WHEN** `testing/index.ts` is inspected
    - **THEN** it SHALL contain zero `as any` casts (excluding the inherent `Spy` type which uses `any[][]` by design)

12. The testing module SHALL use the typed `api` object from `ffi.ts` instead of `lib.symbols` for native function calls.

    #### Scenario: resize calls api.resizeRenderer
    - **WHEN** `setup.resize(w, h)` is called
    - **THEN** it SHALL call `api.resizeRenderer(renderer._unsafePtr, w, h)` instead of `lib.symbols.resizeRenderer(...)`

## Invariants

- `createTestRenderer` never touches the real terminal. Even `restoreTerminal` is a no-op.
- `renderOnce` resolves after the native render cycle completes (including buffer swap).
- `captureCharFrame` reads from the front buffer, which reflects the last completed render.
- Mock input events are injected directly into the native input ring buffer, bypassing the terminal.
