# testing-harness

## Purpose

Utilities for testing MoonTUI applications without a real terminal.

## Overview

The test harness creates a renderer that writes to an internal buffer instead of stdout. It provides mock input, frame capture, and spy utilities for writing deterministic tests.

## Harness Contract

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
## Requirements
### Requirement: Test harness verifies layout-driven output
The testing harness SHALL allow tests to assert deterministic output produced by layout-driven renderables.

#### Scenario: Captured frame reflects computed layout
- **WHEN** a test renderer renders a layout-driven tree with a header and flexible body
- **THEN** `captureCharFrame()` and `captureSpans()` SHALL reflect text and box output at computed layout coordinates

#### Scenario: Test resize exercises layout invalidation
- **WHEN** `testHarness.resize(width, height)` is called for a layout-driven tree
- **THEN** the resize path SHALL mark layout dirty
- **AND** a subsequent render SHALL reflect the recomputed layout

### Requirement: Test harness exposes layout contract assertions
The testing harness SHALL provide utilities or patterns for asserting computed layout rectangles without depending on a specific layout backend.

#### Scenario: Test captures computed rectangles
- **WHEN** a test renders a layout-driven tree
- **THEN** it SHALL be able to assert the computed `x`, `y`, `width`, and `height` for selected renderables

#### Scenario: Backend-neutral assertions
- **WHEN** the same layout fixture runs against different internal layout backends
- **THEN** the fixture SHALL assert public computed layout results rather than backend-specific node state

### Requirement: Test harness supports layout invalidation checks
The testing harness SHALL allow tests to observe whether clean frames skip layout recomputation and dirty frames recompute layout.

#### Scenario: Dirty render recomputes layout
- **WHEN** a geometry-affecting prop changes
- **THEN** a test SHALL be able to verify that the next render recomputes layout

#### Scenario: Clean render skips layout
- **WHEN** no layout props, intrinsic content, tree structure, or renderer dimensions changed
- **THEN** a test SHALL be able to verify that the next render reuses cached rectangles

### Requirement: Layout benchmarks cover contract scenarios
The repository SHALL include benchmark scenarios that measure layout behavior at realistic tree sizes before comparing layout backends.

#### Scenario: Benchmark tree sizes
- **WHEN** layout benchmarks run
- **THEN** they SHALL include scenarios for approximately 100, 1,000, and 10,000 renderables

#### Scenario: Benchmark mutation paths
- **WHEN** layout benchmarks run
- **THEN** they SHALL include clean-frame, single-prop mutation, child mutation, and renderer resize scenarios

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

### Requirement: Test harness verifies input text entry
The testing harness SHALL allow tests to verify input renderable editing through mock key input.

#### Scenario: Mock typing updates focused input
- **WHEN** a test renderer contains a focused input
- **AND** `mockKeys.typeText("abc")` is called
- **THEN** the input value SHALL become `"abc"`

#### Scenario: Mock backspace updates focused input
- **WHEN** a test renderer contains a focused input with value `"abc"`
- **AND** `mockKeys.pressBackspace()` is called
- **THEN** the input value SHALL become `"ab"`

### Requirement: Test harness verifies input callbacks
The testing harness SHALL allow tests to assert `onInput`, `onChange`, and `onSubmit` callbacks.

#### Scenario: Mock typing fires onInput
- **WHEN** `mockKeys.typeText("x")` edits a focused input
- **THEN** the input `onInput` callback SHALL be called with `"x"`

#### Scenario: Mock enter fires submit
- **WHEN** `mockKeys.pressEnter()` is called for a focused input
- **THEN** the input `onSubmit` callback SHALL be called with the current value

### Requirement: Test harness verifies focused input cursor output
The testing harness SHALL allow tests to verify cursor placement for focused inputs.

#### Scenario: Captured frame reports focused input cursor
- **WHEN** a focused input renders with cursor after the second character
- **THEN** `captureSpans()` SHALL report the cursor position at the input coordinate plus two cells

### Requirement: Test harness can run layout fixtures against selected internal backends
The testing harness SHALL allow layout contract fixtures to run against the native custom backend and the internal TypeScript fallback.

#### Scenario: Fixture runs against TypeScript fallback
- **WHEN** a layout fixture selects the TypeScript backend
- **THEN** the fixture SHALL compute layout through the TypeScript backend

#### Scenario: Fixture runs against native custom backend
- **WHEN** a layout fixture selects the native custom backend
- **THEN** the fixture SHALL compute layout through the native custom backend

### Requirement: Test harness compares backend parity
The testing harness SHALL support parity tests that compare public computed rectangles between layout backends.

#### Scenario: Parity test compares rectangles
- **WHEN** a parity test runs a fixture against TypeScript and native custom layout
- **THEN** it SHALL compare public computed layout rectangles
- **AND** it SHALL NOT inspect backend-specific node state

### Requirement: Test harness treats TypeScript as oracle
The test harness SHALL treat TypeScript layout as an internal oracle or fallback rather than an active production backend candidate.

#### Scenario: Backend cases are inspected
- **WHEN** test helpers enumerate active production layout backends
- **THEN** native custom SHALL be the production backend
- **AND** TypeScript SHALL be identified only as internal fallback or oracle if included

#### Scenario: Parity fixture runs
- **WHEN** parity fixtures need a reference implementation
- **THEN** they MAY compare native custom against TypeScript

### Requirement: Benchmark harness reports native custom backend cost
The benchmark harness SHALL report total backend cost for native custom layout and MAY include TypeScript fallback/oracle comparisons.

#### Scenario: Benchmark selects backend
- **WHEN** a layout benchmark runs
- **THEN** it SHALL be able to select native custom backend for the same tree fixture
- **AND** any TypeScript row SHALL be labeled as fallback or oracle data

#### Scenario: Benchmark covers scale and mutation paths
- **WHEN** backend benchmarks run
- **THEN** they SHALL include tree-size, clean-frame, resize, single-prop mutation, and child mutation scenarios

#### Scenario: Normal benchmark runs
- **WHEN** the normal layout benchmark runs
- **THEN** it SHALL report native custom layout timing for supported shapes and scenarios
- **AND** it SHALL NOT imply Yoga, Taffy, or TypeScript are active promotion candidates

### Requirement: Test harness reports backend parity coverage
The testing harness SHALL include parity tests that cover all supported layout contract fixtures before native custom promotion.

#### Scenario: Parity coverage is complete
- **WHEN** promotion is evaluated
- **THEN** parity tests SHALL cover supported flow, flex, alignment, size constraint, percentage, absolute, display none, and intrinsic measurement fixtures

#### Scenario: Parity failure blocks promotion
- **WHEN** a supported parity fixture fails for native custom layout
- **THEN** native custom layout SHALL NOT be promoted until the failure is fixed or documented as an intentional contract change

### Requirement: Benchmark harness reports native custom regression data
The benchmark harness SHALL report native custom backend results for regression scenarios.

#### Scenario: Benchmark report includes required scenarios
- **WHEN** normal benchmarks run
- **THEN** results SHALL include supported tree sizes plus clean-frame, resize, single-prop mutation, and child mutation scenarios

#### Scenario: Benchmark report includes total backend cost
- **WHEN** native custom benchmark results are reported
- **THEN** results SHALL include total backend time rather than native compute time alone

### Requirement: Fallback remains tested after promotion
The test harness SHALL continue to test the TypeScript backend after native custom layout becomes default.

#### Scenario: Fallback fixture remains active
- **WHEN** native custom layout is the default backend
- **THEN** at least one layout fixture suite SHALL still run through the TypeScript backend

### Requirement: Layout benchmarks include nested tree shapes
The benchmark harness SHALL include tree shapes that expose nested layout traversal costs.

#### Scenario: Deep nested tree benchmark
- **WHEN** layout benchmarks run
- **THEN** they SHALL include a deep nested tree scenario

#### Scenario: Balanced tree benchmark
- **WHEN** layout benchmarks run
- **THEN** they SHALL include a balanced tree scenario

#### Scenario: Mixed dashboard tree benchmark
- **WHEN** layout benchmarks run
- **THEN** they SHALL include a mixed dashboard scenario with nested rows and columns

### Requirement: Benchmark output identifies backend and shape
Layout benchmark output SHALL identify the backend, tree size, tree shape, scenario, and timing fields for each sample.

#### Scenario: Benchmark row is attributable
- **WHEN** a benchmark result is printed or recorded
- **THEN** it SHALL include backend name, node count, tree shape, scenario name, and total backend time

### Requirement: Benchmark can compare current and optimized native layout
The benchmark harness SHALL support comparing the baseline native layout path and optimized native layout path when both are available.

#### Scenario: Optimized native comparison
- **WHEN** both native paths are available during implementation
- **THEN** benchmark output SHALL make it possible to compare baseline native, optimized native, and TypeScript layout results

### Requirement: Test harness records promotion decision evidence
The test and benchmark harness SHALL provide attributable evidence for a native custom default-backend promotion decision.

#### Scenario: Benchmark row is promotion-attributable
- **WHEN** benchmark output is used for native custom promotion
- **THEN** each recorded row SHALL identify backend name, tree shape, node count, scenario name, total backend time, and available synchronization timing fields

#### Scenario: Promotion evidence includes parity verification
- **WHEN** native custom layout is evaluated for default promotion
- **THEN** the evidence SHALL include parity verification for supported layout contract fixtures

#### Scenario: Fallback coverage remains after promotion
- **WHEN** native custom layout is promoted to default
- **THEN** at least one layout fixture suite SHALL still verify the TypeScript fallback backend

### Requirement: Tests and benchmarks report backend identity accurately
The test and benchmark harness SHALL report the current native layout backend as native custom unless the exercised backend actually computes through Taffy APIs.

#### Scenario: Native custom benchmark runs
- **WHEN** the benchmark harness runs the current native custom backend
- **THEN** benchmark output SHALL label the backend as native custom or `native-custom`

#### Scenario: Native custom parity test runs
- **WHEN** parity tests run against the current native custom backend
- **THEN** test descriptions and helper names SHALL use native custom terminology

#### Scenario: Future real Taffy test is proposed
- **WHEN** future work proposes a test that uses Taffy terminology
- **THEN** it SHALL require a new accepted proposal that reintroduces a real Taffy backend
- **AND** the tested backend SHALL compute layout through Taffy APIs

### Requirement: Tests verify native custom FFI identity
The test harness SHALL verify that native custom layout uses native custom identity at the FFI-facing TypeScript boundary.

#### Scenario: Native custom parity tests run
- **WHEN** native custom parity tests run
- **THEN** they SHALL exercise the native custom layout path through the native custom-named wrapper or binding

#### Scenario: Legacy alias is absent
- **WHEN** active layout tests and exports are inspected
- **THEN** no legacy Taffy-named alias SHALL remain available

#### Scenario: Backend case list is inspected
- **WHEN** tests enumerate layout backend cases
- **THEN** the native backend SHALL be listed as native custom
- **AND** real Taffy SHALL NOT appear

### Requirement: Test and benchmark harness exclude retired Taffy
The active test and benchmark harness SHALL exclude real Taffy after Taffy retirement.

#### Scenario: Backend cases are inspected
- **WHEN** test helpers enumerate active layout backend cases
- **THEN** they SHALL include native custom and TypeScript fallback
- **AND** they SHALL NOT include Taffy

#### Scenario: Layout benchmark runs
- **WHEN** the layout benchmark runs after Taffy removal
- **THEN** benchmark output SHALL NOT emit Taffy backend rows
- **AND** native custom benchmark rows SHALL remain present

### Requirement: Test and benchmark harness exclude inactive Yoga
The active test and benchmark harness SHALL exclude Yoga unless a future accepted proposal reopens Yoga evaluation.

#### Scenario: Backend cases exclude Yoga
- **WHEN** tests enumerate layout backend cases
- **THEN** the backend list SHALL include native custom and TypeScript fallback/oracle
- **AND** Yoga SHALL NOT appear

#### Scenario: Yoga benchmark row is absent
- **WHEN** the normal layout benchmark runs
- **THEN** benchmark output SHALL NOT include rows with backend name `yoga`

### Requirement: Benchmark harness separates setup and measured phases
The benchmark harness SHALL separate one-time setup from measured layout update phases.

#### Scenario: Cold build scenario runs
- **WHEN** the cold tree build scenario runs
- **THEN** benchmark output SHALL include backend setup and initial layout cost
- **AND** the row SHALL be identifiable as a cold-build scenario

#### Scenario: Warm update scenario runs
- **WHEN** a warm update scenario runs after backend state has been initialized
- **THEN** setup cost SHALL NOT be included in the measured update total
- **AND** synchronization, compute, readback, and rectangle application timings SHALL be reported separately when available

### Requirement: Benchmark harness records mutation scope
The benchmark harness SHALL record the intended mutation scope for each scenario.

#### Scenario: Single-prop scenario runs
- **WHEN** the single-prop benchmark scenario mutates one renderable
- **THEN** the benchmark row SHALL identify that the intended mutation scope is one node
- **AND** instrumented backends SHALL be able to report how many backend nodes were synchronized

#### Scenario: Full recompute scenario runs
- **WHEN** the full recompute benchmark scenario runs
- **THEN** the benchmark row SHALL identify that the intended mutation scope is the full tree

### Requirement: Benchmark harness records errors without aborting unrelated backends
The benchmark harness SHALL record backend errors as row data while preserving independent evidence for other backends.

#### Scenario: Backend errors during scenario
- **WHEN** a backend throws or returns a native error during a scenario
- **THEN** the benchmark output SHALL include an error field for that row
- **AND** the benchmark harness SHALL continue to run remaining backends when process safety permits

#### Scenario: Native runtime is poisoned by an error
- **WHEN** a backend error can poison later rows in the same process
- **THEN** the harness SHALL support isolated backend or scenario execution for follow-up diagnosis

### Requirement: Tests exclude retired Taffy runtime
The active test harness SHALL NOT instantiate or import the retired real Taffy layout engine after backend cleanup.

#### Scenario: Active layout tests after Taffy removal
- **WHEN** TypeScript and Rust tests are run after cleanup
- **THEN** tests SHALL NOT require a Taffy layout engine implementation
- **AND** native custom layout regression coverage SHALL remain active

### Requirement: Benchmarks exclude retired Taffy runtime
The normal benchmark harness SHALL NOT execute retired Taffy or inactive Yoga backend rows.

#### Scenario: Normal layout benchmark after cleanup
- **WHEN** the layout benchmark runs without explicit experimental flags
- **THEN** benchmark rows SHALL include native custom backend results
- **AND** they MAY include TypeScript fallback/oracle comparison rows
- **AND** they SHALL NOT include Taffy or Yoga rows

### Requirement: Taffy-only benchmark helpers are removed
Benchmark scripts that exist only to execute retired Taffy SHALL be removed or replaced by native custom benchmark coverage.

#### Scenario: Taffy-only helper search
- **WHEN** repository scripts are searched after cleanup
- **THEN** no active script SHALL import or instantiate a Taffy layout engine

### Requirement: Test harness verifies interactive widget keyboard activation
The testing harness SHALL allow tests to verify button and checkbox activation through mock key input.

#### Scenario: Mock Enter activates focused button
- **WHEN** a test renderer contains a focused button
- **AND** mock input sends `"Enter"`
- **THEN** the button `onPress` callback SHALL be called

#### Scenario: Mock Space toggles focused checkbox
- **WHEN** a test renderer contains a focused checkbox
- **AND** mock input sends `" "`
- **THEN** the checkbox checked state SHALL toggle

### Requirement: Test harness verifies interactive widget mouse activation
The testing harness SHALL allow tests to verify button and checkbox activation through mouse events.

#### Scenario: Mock click activates button
- **WHEN** a test renderer contains a button at a known location
- **AND** mock mouse input clicks inside the button rectangle
- **THEN** the button `onPress` callback SHALL be called

#### Scenario: Mock click toggles checkbox
- **WHEN** a test renderer contains a checkbox at a known location
- **AND** mock mouse input clicks inside the checkbox rectangle
- **THEN** the checkbox checked state SHALL toggle

### Requirement: Test harness verifies disabled interactive widgets
The testing harness SHALL allow tests to verify disabled button and checkbox behavior.

#### Scenario: Disabled button callback is not called
- **WHEN** a disabled button receives mock keyboard or mouse activation
- **THEN** `onPress` SHALL NOT be called

#### Scenario: Disabled checkbox callback is not called
- **WHEN** a disabled checkbox receives mock keyboard or mouse activation
- **THEN** `onChange` SHALL NOT be called

<!-- Preserved from openspec/specs/native-integration-tests/spec.md before archived-delta removal. -->

### Requirement: Renderer lifecycle is fully testable
The integration test suite SHALL be able to create, configure, render, and destroy a `CliRenderer` without interacting with a real terminal or FFI layer.

#### Scenario: Full lifecycle without terminal
- **WHEN** a test creates a `CliRenderer`, sets up terminal (alternate screen), draws to `get_next_buffer`, calls `render`, and destroys
- **THEN** the renderer completes all operations without panicking or leaking resources

### Requirement: Terminal setup produces correct ANSI sequences
The integration tests SHALL verify that `setup_terminal` emits the correct escape sequences for raw mode, alternate screen entry, cursor hide, and initial clear.

#### Scenario: Alternate screen setup
- **WHEN** `setup_terminal(use_alternate_screen: true)` is called
- **THEN** the captured stdout contains `\x1b[?1049h` (enter alt screen), `\x1b[2J\x1b[H` (clear), and `\x1b[?25l` (hide cursor)

#### Scenario: Non-alternate screen setup
- **WHEN** `setup_terminal(use_alternate_screen: false)` is called
- **THEN** the captured stdout contains `\x1b[2J\x1b[H` and `\x1b[?25l` but NOT `\x1b[?1049h`

### Requirement: Terminal restore produces correct ANSI sequences
The integration tests SHALL verify that `restore_terminal` returns the terminal to its original state.

#### Scenario: Restore after alternate screen
- **WHEN** `restore_terminal()` is called after alternate screen setup
- **THEN** the captured stdout contains `\x1b[?25h` (show cursor) and `\x1b[?1049l` (exit alt screen)

### Requirement: Double-buffering works correctly
The integration tests SHALL verify that `render()` swaps buffers and only renders changes from the back buffer.

#### Scenario: Drawing on front buffer does not render
- **WHEN** text is drawn to `get_current_buffer` and `render` is called
- **THEN** the rendered output contains only empty cells (spaces) or previously back-buffer content, NOT the newly drawn text

#### Scenario: Drawing on back buffer renders correctly
- **WHEN** text is drawn to `get_next_buffer` and `render` is called
- **THEN** the rendered output contains the drawn text at the correct position

#### Scenario: Second render with no changes produces minimal output
- **WHEN** `render` is called twice in a row with no buffer changes between calls
- **THEN** the second render produces zero cell updates (dirty rect optimization)

### Requirement: Buffer text operations produce correct cell content
The integration tests SHALL verify that all buffer drawing functions correctly modify cell data.

#### Scenario: draw_text with ASCII
- **WHEN** `draw_text("Hello", 0, 0, fg, bg)` is called on a cleared buffer
- **THEN** cells at (0..4, 0) contain characters H, e, l, l, o with the specified colors

#### Scenario: draw_text with Unicode
- **WHEN** `draw_text("あい", 0, 0, fg, bg)` is called
- **THEN** cell (0, 0) contains "あ" and cell (0, 1) is marked as continuation

#### Scenario: draw_text with empty string
- **WHEN** `draw_text("", 0, 0, fg, bg)` is called
- **THEN** no cells are modified

#### Scenario: clear fills all cells with background
- **WHEN** `clear(bg_color)` is called
- **THEN** all cells have `char_code: 0` and the specified background color

### Requirement: Render output contains correct ANSI for text
The integration tests SHALL verify that `render()` generates the correct ANSI escape sequences for drawn content.

#### Scenario: Single text cell renders with color
- **WHEN** one cell is set to character 'X' with foreground `[65535, 0, 0, 65535]` (red) and background `[0, 0, 0, 65535]` (black)
- **THEN** the rendered ANSI contains `\x1b[38;2;255;0;0m\x1b[48;2;0;0;0mX`

#### Scenario: Multiple identical cells batch color changes
- **WHEN** a run of 5 identical cells is rendered
- **THEN** the color escape sequences appear only once at the start of the run, not per-cell

### Requirement: Input event reading handles platform edge cases
The integration tests SHALL verify that `readEvents` correctly processes and filters input events.

#### Scenario: Press events are returned
- **WHEN** a `KeyEventKind::Press` is simulated
- **THEN** `readEvents` returns the event in the JSON array

#### Scenario: Release events are filtered on Windows
- **WHEN** a `KeyEventKind::Release` is simulated (as Windows crossterm generates)
- **THEN** `readEvents` does NOT return the event

#### Scenario: Repeat events are returned
- **WHEN** a `KeyEventKind::Repeat` is simulated
- **THEN** `readEvents` returns the event

#### Scenario: Empty buffer returns zero length
- **WHEN** `readEvents` is called with no pending events
- **THEN** it returns 0

### Requirement: FFI boundary is verified
The integration tests SHALL call the C ABI exports directly from Rust to verify the FFI contract.

#### Scenario: C createRenderer returns non-null pointer
- **WHEN** `createRenderer(80, 24)` is called via C ABI
- **THEN** it returns a non-null pointer

#### Scenario: C render does not crash with valid pointer
- **WHEN** `render(renderer_ptr, false)` is called via C ABI on a properly set up renderer
- **THEN** it completes without panicking

#### Scenario: C bufferDrawText passes text correctly
- **WHEN** `bufferDrawText(buf_ptr, "Test", 4, 0, 0, fg_ptr, bg_ptr, 0)` is called via C ABI
- **THEN** the buffer contains the text "Test" at position (0, 0)

### Requirement: Regression tests prevent reintroducing fixed bugs
The integration tests SHALL include explicit regression tests for each bug recently fixed.

#### Scenario: Regression — getCurrentBuffer + render produces no output
- **WHEN** text is drawn to `get_current_buffer` and `render` is called
- **THEN** the rendered output does NOT contain the drawn text (verifies front buffer is not rendered)

#### Scenario: Regression — crossterm 0.28 Windows input blocking
- **WHEN** the test suite runs with crossterm 0.27 (or later fixed version)
- **THEN** input events are correctly read without blocking on Windows

#### Scenario: Regression — KeyRelease phantom events
- **WHEN** a `KeyRelease` event is injected immediately after terminal setup (simulating Windows behavior)
- **THEN** no key handler is triggered and the application continues running

### Requirement: Render stats are accurate
The integration tests SHALL verify that `RenderStats` reflects actual rendering activity.

#### Scenario: Stats after single render
- **WHEN** `render` is called once after drawing 5 cells
- **THEN** `stats.cells_updated` equals 5 and `stats.frame_count` equals 1

#### Scenario: Stats after force render
- **WHEN** `render(true)` (force) is called on a 10x5 renderer
- **THEN** `stats.cells_updated` equals 50 (all cells)

<!-- Synced from openspec/changes/cleanup-openspec-specs/specs/testing-harness/spec.md. -->

### Requirement: Testing harness aligns with consolidated capabilities
The testing harness SHALL keep coverage requirements aligned with the consolidated layout, rendering, interaction, and buffer capabilities.

#### Scenario: Spec consolidation changes test ownership
- **WHEN** narrow specs are merged into consolidated capabilities
- **THEN** testing-harness requirements still identify the fixtures or helpers needed to verify those capabilities

### Requirement: Backend parity evidence remains attributable
Backend parity tests and benchmarks SHALL identify the backend and scenario being verified.

#### Scenario: Layout parity test runs
- **WHEN** layout parity is tested after catalog cleanup
- **THEN** the result identifies native custom and TypeScript fallback/oracle coverage

## Invariants

- `createTestRenderer` never touches the real terminal. Even `restoreTerminal` is a no-op.
- `renderOnce` resolves after the native render cycle completes (including buffer swap).
- `captureCharFrame` reads from the front buffer, which reflects the last completed render.
- Mock input events are injected directly into the native input ring buffer, bypassing the terminal.
