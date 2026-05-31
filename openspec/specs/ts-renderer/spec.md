# ts-renderer

TypeScript `CliRenderer` class that orchestrates the native rendering engine.

## Overview

`CliRenderer` wraps the FFI facade into an ergonomic API. It manages the render loop, event processing, and terminal lifecycle. Input events arrive via a native callback trampoline created through the platform facade rather than direct `JSCallback` instantiation. It is the primary interface that user code interacts with.

## Requirements

1. `new CliRenderer(width, height)` calls `createRenderer(w, h)`, calls `api.createEventCallback(handler, definition)` to create the callback trampoline, and registers it via `api.setEventCallback(ptr, callback.ptr)`. When `useMouse` is true (default), it also creates a mouse callback trampoline and registers it via `api.setMouseCallback(ptr, mouseCallback.ptr)`.
2. `setupTerminal(options)` calls `setupTerminal(renderer, options.useAlternateScreen)`. It does NOT begin input polling. When mouse is enabled, it calls `EnableMouseCapture`.
3. `restoreTerminal()` calls the native restore. It calls `DisableMouseCapture` before raw mode is disabled. It does NOT stop input polling (since none was started).
4. `getNextBuffer()` returns a `MoonBuffer` wrapper around the native back buffer.
5. `processEvents()` calls `api.processEvents(ptr)` to drain and dispatch pending input events.
6. `render()` calls `render(renderer, false)`. If a frame callback is registered, it is invoked with stats after render completes. After render, if the hit grid is dirty, `recheckHoverState()` is called.
7. `renderForce()` calls `render(renderer, true)` to force full redraw.
8. `destroy()` calls `api.setEventCallback(ptr, null)` to clear the Rust-side key callback pointer, then `api.setMouseCallback(ptr, null)` to clear the mouse callback pointer, then closes both callback trampolines, then `api.destroyRenderer(ptr)`.
9. `on(event, handler)` registers event handlers for `"key"`, `"resize"`, `"frame"`, and `"mouse"`. Handlers are invoked from a `queueMicrotask` inside the JSCallback closure.
10. `getStats()` calls `api.getRenderStats()` which returns a typed `RenderStats` object without requiring manual `DataView` reading.
11. `setCursorPosition(x, y, visible)` updates the native cursor state.
12. `terminalSize()` returns `{ width, height }` from native query.

## TypeScript Interface

```typescript
export interface RendererOptions {
  width?: number;
  height?: number;
  useAlternateScreen?: boolean;
  fps?: number;
  useMouse?: boolean;
  enableMouseMovement?: boolean;
  autoFocus?: boolean;
}

export interface RenderStats {
  lastFrameTimeMs: number;
  averageFrameTimeMs: number;
  frameCount: number;
  cellsUpdated: number;
  averageCellsUpdated: number;
  renderTimeUs: number;
  stdoutWriteTimeUs: number;
}

export class KeyEvent {
  readonly type = "key" as const;
  readonly key: string;
  readonly modifiers: { ctrl: boolean; shift: boolean; alt: boolean };
  private _defaultPrevented = false;
  private _propagationStopped = false;

  preventDefault(): void;
  stopPropagation(): void;
  get defaultPrevented(): boolean;
  get propagationStopped(): boolean;
}

export class MouseEvent {
  readonly type: "mouse";
  readonly kind: "down" | "up" | "drag" | "drag-end" | "drop" | "move" | "over" | "out" | "scroll";
  readonly button: number;
  readonly x: number;
  readonly y: number;
  readonly modifiers: { ctrl: boolean; shift: boolean; alt: boolean };
  readonly scroll?: { direction: "up" | "down" | "left" | "right" };
  readonly target: any | null;
  readonly source?: any;
  readonly isDragging?: boolean;
  private _defaultPrevented = false;
  private _propagationStopped = false;

  preventDefault(): void;
  stopPropagation(): void;
  get defaultPrevented(): boolean;
  get propagationStopped(): boolean;
}

export type ResizeEvent = {
  type: "resize";
  width: number;
  height: number;
};

export type FrameEvent = {
  type: "frame";
  stats: RenderStats;
};

export class CliRenderer {
  constructor(options?: RendererOptions);
  
  processEvents(): void;
  setupTerminal(options?: { useAlternateScreen?: boolean }): void;
  restoreTerminal(): void;
  destroy(): void;
  
  getNextBuffer(): MoonBuffer;
  render(): void;
  renderForce(): void;
  
  on(event: "key", handler: (e: KeyEvent) => void): void;
  on(event: "resize", handler: (e: ResizeEvent) => void): void;
  on(event: "frame", handler: (e: FrameEvent) => void): void;
  on(event: "mouse", handler: (e: MouseEvent) => void): void;

  getStats(): RenderStats;
  setCursorPosition(x: number, y: number, visible: boolean): void;
  terminalSize(): { width: number; height: number };

  // Mouse API
  get useMouse(): boolean;
  set useMouse(value: boolean);
  get enableMouseMovement(): boolean;
  set enableMouseMovement(value: boolean);
  get autoFocus(): boolean;
  set autoFocus(value: boolean);

  enableMouse(enableMovement?: boolean): void;
  disableMouse(): void;
  setMousePointerStyle(style: MousePointerStyle): void;
  getMousePointerStyle(): MousePointerStyle;

  // Hit grid API
  addToHitGrid(x: number, y: number, width: number, height: number, id: number): void;
  checkHit(x: number, y: number): number;
  pushHitGridScissorRect(x: number, y: number, width: number, height: number): void;
  popHitGridScissorRect(): void;
  clearHitGridScissorRects(): void;
  isHitGridDirty(): boolean;
}
```

## Event System

The `CliRenderer` class SHALL use `TypedEmitter<RendererEvents>` as its internal event dispatch mechanism, replacing the hand-rolled `Map<EventType, Set<(event: any) => void>>`.

```typescript
interface RendererEvents {
  key: [KeyEvent];
  resize: [ResizeEvent];
  frame: [FrameEvent];
  mouse: [MouseEvent];
}
```

#### Scenario: Internal storage is typed
- **WHEN** `renderer.on("key", handler)` is called
- **THEN** the handler SHALL be stored in the `TypedEmitter` instance
- **AND** `renderer._emit("frame", stats)` SHALL dispatch through the `TypedEmitter`

#### Scenario: Public on overloads delegate to TypedEmitter
- **WHEN** `renderer.on("mouse", handler)` is called
- **THEN** it SHALL delegate to `this._emitter.on("mouse", handler)`
- **AND** the public overloaded signatures SHALL remain unchanged

#### Scenario: Wrong event data type produces compile error
- **WHEN** `renderer._emit("mouse", frameEvent)` is called
- **THEN** TypeScript SHALL produce a compile-time type error

#### Scenario: Mouse event is typed
- **WHEN** `renderer.on("mouse", (e: MouseEvent) => void)` is called
- **THEN** the handler SHALL receive a `MouseEvent` with `type`, `kind`, `button`, `x`, `y`, `modifiers`, `scroll`, `target`
- **AND** `renderer.on("mouse", (e: KeyEvent) => void)` SHALL produce a compile-time type error

### Requirement: CliRenderer SHALL register resize callback in constructor

The `CliRenderer` constructor SHALL call `api.events.createResizeCallback(handler)` to create a native resize callback trampoline and register it via `api.events.setResizeCallback(ptr, callback.ptr)`.

#### Scenario: Constructor registers resize callback
- **WHEN** `new CliRenderer()` is called
- **THEN** a resize callback SHALL be registered on the native renderer
- **AND** the callback SHALL be stored as `_resizeCallback` for cleanup in `destroy()`

#### Scenario: Resize callback updates internal dimensions
- **WHEN** the native resize callback fires with (120, 40)
- **THEN** `_width` SHALL be updated to 120
- **AND** `_height` SHALL be updated to 40

#### Scenario: Resize callback emits via queueMicrotask
- **WHEN** the native resize callback fires
- **THEN** the `"resize"` event SHALL be dispatched via `queueMicrotask`
- **AND** the event object SHALL be `{ type: "resize", width: number, height: number }`

### Requirement: CliRenderer destroy SHALL clean up resize callback

`destroy()` SHALL close the resize callback alongside the key callback to prevent dangling FFI pointers.

#### Scenario: Destroy closes both callbacks
- **WHEN** `renderer.destroy()` is called
- **THEN** `api.events.setResizeCallback(ptr, null)` SHALL be called
- **AND** `resizeCallback.close()` SHALL be called

### Requirement: CliRenderer SHALL register mouse callback in constructor

The `CliRenderer` constructor SHALL call `api.events.createMouseCallback(handler)` to create a native mouse callback trampoline and register it via `api.events.setMouseCallback(ptr, callback.ptr)` when `useMouse` is true.

#### Scenario: Constructor registers mouse callback
- **WHEN** `new CliRenderer({ useMouse: true })` is called
- **THEN** a mouse callback SHALL be registered on the native renderer
- **AND** the callback SHALL be stored as `_mouseCallback` for cleanup in `destroy()`

#### Scenario: No mouse callback when useMouse is false
- **WHEN** `new CliRenderer({ useMouse: false })` is called
- **THEN** no mouse callback SHALL be registered

#### Scenario: Mouse callback decodes raw event data
- **WHEN** the native mouse callback fires with (type_ptr, type_len, kind_ptr, kind_len, button, x, y, ctrl, shift, alt, scroll_dir)
- **THEN** the strings SHALL be decoded from raw pointers
- **AND** a `MouseEvent` instance SHALL be created and emitted via `queueMicrotask`

### Requirement: CliRenderer destroy SHALL clean up mouse callback

`destroy()` SHALL close the mouse callback alongside the key callback to prevent dangling FFI pointers.

#### Scenario: Destroy closes both callbacks
- **WHEN** `renderer.destroy()` is called
- **THEN** `api.events.setMouseCallback(ptr, null)` SHALL be called
- **AND** `mouseCallback.close()` SHALL be called
- **AND** `api.events.setEventCallback(ptr, null)` SHALL be called
- **AND** `eventCallback.close()` SHALL be called

## KeyEvent Class

The `KeyEvent` type SHALL be a class (not an interface) with `preventDefault()` and `stopPropagation()` methods.

#### Scenario: preventDefault sets flag
- **WHEN** `event.preventDefault()` is called on a `KeyEvent`
- **THEN** `event.defaultPrevented` SHALL return `true`

#### Scenario: stopPropagation sets flag
- **WHEN** `event.stopPropagation()` is called on a `KeyEvent`
- **THEN** `event.propagationStopped` SHALL return `true`

#### Scenario: Flags default to false
- **WHEN** a new `KeyEvent` is created
- **THEN** both `defaultPrevented` and `propagationStopped` SHALL be `false`

#### Scenario: stopPropagation is reserved for future use
- **WHEN** `event.stopPropagation()` is called
- **THEN** the flag SHALL be set but SHALL have no effect on current dispatch behavior
- **AND** it SHALL be documented as "reserved for future component tree dispatch"

## Typed FFI Wrapper Usage

The `CliRenderer` class SHALL use the typed `api` object from `ffi.ts` instead of `lib.symbols` for all native function calls.

#### Scenario: No lib.symbols access in renderer
- **WHEN** `renderer.ts` is inspected
- **THEN** all native calls SHALL use `api.functionName(...)` instead of `lib.symbols.functionName(...)`

#### Scenario: No as any casts in renderer
- **WHEN** `renderer.ts` is inspected
- **THEN** it SHALL contain zero `as any` casts

## Constructor Creates Callback Through Platform Facade

The `CliRenderer` constructor SHALL call `api.createEventCallback()` to create the native callback trampoline instead of instantiating `JSCallback` directly from `bun:ffi`.

#### Scenario: Constructor uses facade callback
- **WHEN** `new CliRenderer()` is called
- **THEN** it SHALL call `api.createEventCallback(handler, definition)` instead of `new JSCallback(...)`
- **AND** the returned `FFICallbackInstance` SHALL be registered via `api.setEventCallback(renderer, callback.ptr)`
- **AND** the file SHALL NOT import `bun:ffi` or reference `JSCallback`

#### Scenario: Callback handler receives decoded arguments
- **WHEN** a native key event fires
- **THEN** the callback SHALL receive decoded strings (not raw pointers)
- **AND** it SHALL receive booleans (not `0`/`1` integers)
- **AND** it SHALL dispatch a `KeyEvent` via `queueMicrotask`

## getStats Returns Typed Object via Facade

`getStats()` SHALL call `api.getRenderStats()` which returns a typed `RenderStats` object without requiring manual `DataView` reading.

#### Scenario: getStats uses facade marshalling
- **WHEN** `renderer.getStats()` is called
- **THEN** it SHALL call `api.getRenderStats(this._ptr)`
- **AND** the returned object SHALL have all `RenderStats` fields typed correctly
- **AND** the method SHALL NOT create a `Uint8Array(56)` or use `DataView` directly

#### Scenario: getStats handles struct layout internally
- **WHEN** `api.getRenderStats(renderer)` is called
- **THEN** the struct layout (offsets for `lastFrameTimeMs`, `frameCount`, etc.) SHALL be handled entirely within `ffi.ts`
- **AND** `renderer.ts` SHALL NOT know the byte offsets of `FrameStats` fields

## No Runtime-Specific Imports in Renderer

`renderer.ts` SHALL NOT import from `bun:ffi`, `node:ffi`, or `Deno.*`.

#### Scenario: renderer.ts imports are portable
- **WHEN** `packages/core/src/renderer.ts` is inspected
- **THEN** it SHALL contain zero imports from `bun:ffi`
- **AND** it SHALL contain zero imports from `node:ffi`
- **AND** all FFI-related imports SHALL come from `./platform/index.ts` or `./ffi.ts`

#### Scenario: No as any casts for FFI coercion
- **WHEN** `renderer.ts` is inspected
- **THEN** it SHALL contain zero `as any` casts related to FFI pointer coercion
- **AND** pointer conversions SHALL be handled by the platform facade

## Internal Pointer Access

The `CliRenderer` class SHALL expose a `/** @internal */` getter `_unsafePtr` that returns the private `_ptr` value.

#### Scenario: Testing module accesses pointer via _unsafePtr
- **WHEN** `testing/index.ts` needs the renderer pointer
- **THEN** it SHALL use `renderer._unsafePtr` instead of `(renderer as any)._ptr`

#### Scenario: _unsafePtr is documented as internal
- **WHEN** the `_unsafePtr` getter is defined
- **THEN** it SHALL have a `/** @internal */` JSDoc tag

## Use-After-Destroy Guard

The `CliRenderer` class SHALL call `guard()` at the start of every public method to prevent use after `destroy()`.

#### Scenario: Method call after destroy throws
- **WHEN** any public method is called after `destroy()`
- **THEN** an `Error` SHALL be thrown with message `"CliRenderer used after destroy"`

#### Scenario: destroy is idempotent
- **WHEN** `destroy()` is called multiple times
- **THEN** only the first call SHALL execute cleanup
- **AND** subsequent calls SHALL be silently ignored

(See `renderer-guard` spec for full requirements)

## Invariants

- `render()` and `renderForce()` are synchronous but may trigger async event handlers.
- Input events are only processed when `processEvents()` is called by the consumer, typically once per render frame.
- The renderer does not automatically handle SIGWINCH. The consumer must call `resizeRenderer` and re-render.
- `destroy()` is idempotent. Multiple calls are safe.
- The callback is cleared on the Rust side before the platform callback is closed, preventing dangling callback pointers.
- The renderer does not expose `bun:ffi`, `node:ffi`, or `Deno.*` types in its public interface.

### Requirement: Renderer event callbacks are scheduled exactly once
Native event callbacks SHALL cross into TypeScript through one async scheduling boundary, not nested `queueMicrotask` calls in both generated FFI and `CliRenderer`.

#### Scenario: Key callback dispatch
- **WHEN** a native key callback fires
- **THEN** the key event handler SHALL be queued exactly once before user handlers run
- **AND** generated FFI and `CliRenderer` SHALL NOT both queue the same event

#### Scenario: Resize callback dispatch
- **WHEN** a native resize callback fires
- **THEN** the resize event handler SHALL be queued exactly once before user handlers run
- **AND** internal renderer dimensions SHALL be updated before the user resize event is emitted

### Requirement: Native mouse event kinds are validated
The TypeScript renderer SHALL parse native mouse event kind strings through an explicit validator before constructing public `MouseEvent` instances.

#### Scenario: Known native mouse kind
- **WHEN** the native callback provides a supported kind string
- **THEN** `CliRenderer` SHALL construct a `MouseEvent` with the corresponding typed kind

#### Scenario: Unknown native mouse kind
- **WHEN** the native callback provides an unsupported kind string
- **THEN** `CliRenderer` SHALL drop the event or surface a clear error according to the documented policy
- **AND** it SHALL NOT cast the string into `RawMouseEvent["kind"]`

### Requirement: Constructor options are effective or removed
Public `RendererOptions` fields SHALL either affect renderer behavior or be removed from the public type.

#### Scenario: useAlternateScreen is configured in constructor
- **WHEN** `new CliRenderer({ useAlternateScreen: false })` is created and `setupTerminal()` is called without an override
- **THEN** setup SHALL use the constructor value
- **OR** `useAlternateScreen` SHALL not be present in `RendererOptions`

### Requirement: Current buffer wrapper is read-only
The TypeScript API SHALL prevent drawing through a buffer returned by `getCurrentBuffer()`.

#### Scenario: Current buffer has no mutating methods
- **WHEN** TypeScript code calls `renderer.getCurrentBuffer()`
- **THEN** the returned wrapper SHALL expose inspection methods only
- **AND** it SHALL NOT expose `clear`, `drawText`, `drawChar`, `drawBox`, or `fillRect`

#### Scenario: Next buffer remains drawable
- **WHEN** TypeScript code calls `renderer.getNextBuffer()`
- **THEN** the returned wrapper SHALL expose drawing methods for the next frame

### Requirement: CliRenderer exposes root renderable
The `CliRenderer` class SHALL expose a public `root` property that owns the renderer's renderable tree.

#### Scenario: Root is available after construction
- **WHEN** `new CliRenderer({ width: 40, height: 10 })` is called
- **THEN** `renderer.root` SHALL be defined
- **AND** `renderer.root.width` SHALL be `40`
- **AND** `renderer.root.height` SHALL be `10`

### Requirement: CliRenderer renders root before native flush
The `CliRenderer` render methods SHALL render the root tree into the next buffer before calling the native renderer flush.

#### Scenario: Render draws root tree
- **WHEN** a text renderable is added to `renderer.root`
- **AND** `renderer.render()` is called
- **THEN** the captured frame SHALL include the text renderable output

#### Scenario: Forced render draws root tree
- **WHEN** a text renderable is added to `renderer.root`
- **AND** `renderer.renderForce()` is called
- **THEN** the captured frame SHALL include the text renderable output

### Requirement: Renderer computes layout before root render
The TypeScript renderer SHALL compute root renderable layout through the internal layout engine boundary before drawing the root into the next buffer when layout is dirty.

#### Scenario: Render invokes dirty layout pass
- **WHEN** `CliRenderer.render()` is called after a layout prop changed
- **THEN** the renderer SHALL compute layout for the root renderable before calling native render
- **AND** renderables SHALL draw using the updated computed rectangles

#### Scenario: Render skips clean layout pass
- **WHEN** `CliRenderer.render()` is called and layout is not dirty
- **THEN** the renderer SHALL skip layout recomputation
- **AND** it SHALL render using cached computed rectangles

#### Scenario: Renderer uses configured layout engine
- **WHEN** the root layout is dirty
- **THEN** the renderer SHALL invoke the configured internal layout engine
- **AND** it SHALL NOT call backend-specific layout code from public renderable APIs

### Requirement: Direct buffer rendering remains available
The `CliRenderer` class SHALL preserve the existing `getNextBuffer()` workflow for users who draw directly into `MoonBuffer`.

#### Scenario: Existing buffer-first render still works
- **WHEN** user code calls `renderer.getNextBuffer().drawText(...)`
- **AND** no children are added to `renderer.root`
- **THEN** `renderer.render()` SHALL preserve the existing direct-buffer output behavior

### Requirement: Renderer preserves direct buffer workflow
The renderer SHALL preserve direct `MoonBuffer` drawing behavior while layout engine indirection is introduced.

#### Scenario: Empty root keeps direct buffer output
- **WHEN** user code draws directly into `renderer.getNextBuffer()`
- **AND** no root children draw over that region
- **THEN** the next render SHALL preserve the direct-buffer output behavior

### Requirement: Root dimensions track terminal size
The `CliRenderer` class SHALL keep `renderer.root` dimensions synchronized with renderer width and height.

#### Scenario: Resize callback updates root dimensions
- **WHEN** the renderer receives a resize event with width `120` and height `40`
- **THEN** `renderer.root.width` SHALL be `120`
- **AND** `renderer.root.height` SHALL be `40`

### Requirement: Resize invalidates root layout
The TypeScript renderer SHALL mark root layout dirty when the renderer dimensions change.

#### Scenario: Resize recomputes responsive layout
- **WHEN** a resize event updates the renderer size from 80 by 24 to 100 by 30
- **THEN** the root renderable dimensions SHALL update
- **AND** the next render SHALL recompute layout using 100 by 30

### Requirement: CliRenderer exposes focus control API
The TypeScript renderer SHALL expose a small public API for focus management.

#### Scenario: Public focus methods exist
- **WHEN** a consumer uses `CliRenderer`
- **THEN** it SHALL provide `focus(renderable)`, `blur()`, `focusNext()`, `focusPrevious()`, and `focused`

#### Scenario: Focus rejects non-focusable renderable
- **WHEN** `renderer.focus(renderable)` is called with a non-focusable renderable
- **THEN** the renderer SHALL NOT focus that renderable
- **AND** the current focused renderable SHALL remain unchanged

### Requirement: CliRenderer routes key events through focus manager
The TypeScript renderer SHALL route native key events through the focus manager before emitting global key events.

#### Scenario: Native key dispatches to focused renderable first
- **WHEN** the native key callback fires and a renderable is focused
- **THEN** the focus manager SHALL dispatch the key event to the focused renderable before `renderer.on("key")` handlers run

#### Scenario: Unfocused key still emits globally
- **WHEN** the native key callback fires and no renderable is focused
- **THEN** `renderer.on("key")` handlers SHALL receive the key event

#### Scenario: Stopped key is not emitted globally
- **WHEN** focused key handling calls `stopPropagation()`
- **THEN** `renderer.on("key")` handlers SHALL NOT receive the key event

### Requirement: CliRenderer autoFocus option drives initial focus
The TypeScript renderer SHALL use `RendererOptions.autoFocus` to decide whether the first focusable renderable can be focused automatically.

#### Scenario: Auto focus true focuses first focusable
- **WHEN** `autoFocus` is true and a focusable renderable exists in the root tree
- **THEN** the renderer SHALL focus the first focusable renderable before focused key dispatch is needed

#### Scenario: Auto focus false leaves focus empty
- **WHEN** `autoFocus` is false
- **THEN** the renderer SHALL leave `focused` as `null` until focus is set explicitly

### Requirement: Renderer cursor reflects focused input render state
The TypeScript renderer SHALL allow a focused input renderable to update the renderer cursor position during a render frame.

#### Scenario: Focused input updates cursor before native render
- **WHEN** `CliRenderer.render()` renders a focused input with cursor position inside its layout rectangle
- **THEN** the renderer SHALL call `setCursorPosition` with the input cursor coordinates before native render output is flushed

#### Scenario: No focused input leaves cursor under existing renderer control
- **WHEN** no focused input requests cursor placement during render
- **THEN** the renderer SHALL preserve existing cursor behavior
