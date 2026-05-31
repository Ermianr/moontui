# testing-harness

Utilities for testing MoonTUI applications without a real terminal.

## Overview

The test harness creates a renderer that writes to an internal buffer instead of stdout. It provides mock input, frame capture, and spy utilities for writing deterministic tests.

## Requirements

1. `createTestRenderer(options)` creates a `CliRenderer` in testing mode:
   - Native stdout is replaced with an internal `Vec<u8>` (no terminal I/O).
   - `isTTY` is true for the fake stream so the renderer behaves normally.
   - Terminal setup is skipped; the renderer does not enter raw mode.
   - Mouse capture is NOT enabled (no terminal I/O in test mode).
2. `renderOnce()` triggers one render cycle and returns a promise that resolves when the frame is complete.
3. `captureCharFrame()` returns the content of the front buffer as a UTF-8 string (via `bufferWriteResolvedChars`).
4. `captureSpans()` returns the front buffer as `CapturedFrame` (span lines with cursor position).
5. `getNativeStats()` returns the last `RenderStats` from the native side.
6. `mockKeys.pressKey(key, modifiers?)` simulates a key press.
7. `mockKeys.typeText(text, delayMs?)` simulates typing a string.
8. `spy()` creates a function spy for asserting callbacks.
9. `mockMouse.click(x, y, options?)` simulates a mouse click (down + up).
10. `mockMouse.move(x, y)` simulates a mouse move.
11. `mockMouse.scroll(x, y, direction)` simulates a mouse scroll.
12. `mockMouse.down(x, y, options?)` simulates a mouse button press.
13. `mockMouse.up(x, y, options?)` simulates a mouse button release.
14. `mockMouse.drag(fromX, fromY, toX, toY, options?)` simulates a drag operation.

## TypeScript Interface

```typescript
export interface TestRendererOptions {
  width?: number;
  height?: number;
  kittyKeyboard?: boolean;
  useMouse?: boolean;
}

export interface TestRendererSetup {
  renderer: CliRenderer;
  mockInput: MockKeys;
  mockMouse: MockMouse;
  renderOnce: () => Promise<void>;
  captureCharFrame: () => string;
  captureSpans: () => CapturedFrame;
  getNativeStats: () => RenderStats;
  resize: (width: number, height: number) => void;
}

export interface MockMouse {
  click(x: number, y: number, options?: { button?: "left" | "middle" | "right"; ctrl?: boolean; shift?: boolean; alt?: boolean }): void;
  move(x: number, y: number, options?: { ctrl?: boolean; shift?: boolean; alt?: boolean }): void;
  scroll(x: number, y: number, direction: "up" | "down" | "left" | "right"): void;
  down(x: number, y: number, options?: { button?: "left" | "middle" | "right"; ctrl?: boolean; shift?: boolean; alt?: boolean }): void;
  up(x: number, y: number, options?: { button?: "left" | "middle" | "right"; ctrl?: boolean; shift?: boolean; alt?: boolean }): void;
  drag(fromX: number, fromY: number, toX: number, toY: number, options?: { button?: "left"; ctrl?: boolean; shift?: boolean; alt?: boolean }): void;
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

test("mouse click dispatches to registered widget", async () => {
  const { renderer, renderOnce, mockMouse } = await createTestRenderer({
    width: 40,
    height: 10,
    useMouse: true,
  });

  let receivedEvent: any = null;
  renderer.on("mouse", (e) => { receivedEvent = e; });

  // Register a widget in the hit grid
  renderer.addToHitGrid(5, 2, 10, 3, 1);
  await renderOnce();

  mockMouse.click(7, 3);

  expect(receivedEvent).not.toBeNull();
  expect(receivedEvent.kind).toBe("down");
  expect(receivedEvent.x).toBe(7);
  expect(receivedEvent.y).toBe(3);

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

    #### Scenario: resize calls api.renderer.injectResizeEvent
    - **WHEN** `setup.resize(w, h)` is called
    - **THEN** it SHALL call `api.renderer.injectResizeEvent(renderer._unsafePtr, w, h)` instead of `api.resizeRenderer(renderer._unsafePtr, w, h)`

    #### Scenario: Test resize goes through event chain
    - **WHEN** `testHarness.resize(80, 24)` is called
    - **THEN** the resize callback SHALL fire
    - **AND** buffers SHALL be reallocated to 80x24
    - **AND** a force-render SHALL execute
    - **AND** the `"resize"` event SHALL emit to TS subscribers

    #### Scenario: Test resize updates renderer dimensions
    - **WHEN** `testHarness.resize(80, 24)` is called
    - **THEN** `renderer.terminalSize()` SHALL return `{ width: 80, height: 24 }`

13. The mockMouse module SHALL inject mouse events through the same `inject_mouse_event` path as real mouse events, exercising the full callback chain.

    #### Scenario: mockMouse.click triggers mouse callback
    - **WHEN** `mockMouse.click(10, 5)` is called
    - **THEN** the native `inject_mouse_event` SHALL be called with kind="down", x=10, y=5
    - **AND** a second call with kind="up" SHALL follow

    #### Scenario: mockMouse.move triggers mouse callback
    - **WHEN** `mockMouse.move(10, 5)` is called
    - **THEN** the native `inject_mouse_event` SHALL be called with kind="move", x=10, y=5

    #### Scenario: mockMouse.scroll triggers mouse callback
    - **WHEN** `mockMouse.scroll(5, 3, "up")` is called
    - **THEN** the native `inject_mouse_event` SHALL be called with kind="scroll", scroll_dir=1

### Requirement: Test harness verifies layout-driven output
The testing harness SHALL allow tests to assert deterministic output produced by layout-driven renderables.

#### Scenario: Captured frame reflects computed layout
- **WHEN** a test renderer renders a layout-driven tree with a header and flexible body
- **THEN** `captureCharFrame()` and `captureSpans()` SHALL reflect text and box output at computed layout coordinates

#### Scenario: Test resize exercises layout invalidation
- **WHEN** `testHarness.resize(width, height)` is called for a layout-driven tree
- **THEN** the resize path SHALL mark layout dirty
- **AND** a subsequent render SHALL reflect the recomputed layout

### Requirement: Test harness verifies focus traversal
The testing harness SHALL allow tests to verify keyboard focus traversal using mock key input.

#### Scenario: Mock tab moves focus forward
- **WHEN** a test renderer contains two focusable renderables and `mockKeys.pressTab()` is called
- **THEN** focus SHALL move to the next focusable renderable

#### Scenario: Mock shift tab moves focus backward
- **WHEN** a test renderer contains two focusable renderables and `mockKeys.pressKey("Tab", { shift: true })` is called
- **THEN** focus SHALL move to the previous focusable renderable

### Requirement: Test harness verifies focused key dispatch
The testing harness SHALL allow tests to verify that focused renderables receive key events before global key handlers.

#### Scenario: Focused handler runs before global handler
- **WHEN** a focused renderable has a key handler and the renderer has a global key listener
- **AND** `mockKeys.pressKey("x")` is called
- **THEN** the focused renderable handler SHALL run before the global listener

#### Scenario: Stopped focused event skips global handler
- **WHEN** a focused renderable key handler calls `stopPropagation()`
- **AND** `mockKeys.pressKey("x")` is called
- **THEN** the global key listener SHALL NOT be called

## Invariants

- `createTestRenderer` never touches the real terminal. Even `restoreTerminal` is a no-op.
- `renderOnce` resolves after the native render cycle completes (including buffer swap).
- `captureCharFrame` reads from the front buffer, which reflects the last completed render.
- Mock input events are injected directly into the native input ring buffer, bypassing the terminal.
