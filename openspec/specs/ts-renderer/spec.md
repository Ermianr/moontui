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
