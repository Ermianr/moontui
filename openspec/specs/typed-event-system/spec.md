# typed-event-system

Generic typed event emitter infrastructure with branded pointer types for type-safe FFI boundaries.

## Overview

Two TypeScript primitives: `TypedEmitter<K, V>` — a generic typed event emitter that preserves argument types from registration through dispatch — and `Pointer<T>` — a branded opaque type that prevents accidental `number`/`Pointer` confusion at compile time. These replace the current `any`-based internal handler storage and raw `type Pointer = number`.

## Requirements

### Requirement: TypedEmitter preserves event argument types
The `TypedEmitter<Events>` class SHALL accept a generic type parameter mapping event names to argument tuple types. All handler registration and dispatch methods SHALL preserve these types without internal `any` coercion.

#### Scenario: Typed registration with type checking
- **WHEN** `emitter.on("key", (e: KeyEvent) => void)` is called
- **THEN** the handler type is statically checked against the `Events` map
- **AND** a handler with wrong argument types produces a compile-time error

#### Scenario: Typed dispatch
- **WHEN** `emitter.emit("key", keyEvent)` is called
- **THEN** the argument type is statically checked against the `Events` map
- **AND** the correct set of registered handlers is invoked

#### Scenario: Multiple event types with distinct argument types
- **WHEN** `emitter` has events `{ key: [KeyEvent], frame: [RenderStats], resize: [ResizeEvent] }`
- **THEN** each event type has independently typed handler signatures
- **AND** `emit("key", renderStats)` produces a compile-time error

### Requirement: CliRenderer uses TypedEmitter with RendererEvents
The `CliRenderer` event system SHALL use `TypedEmitter<RendererEvents>` as its internal handler storage, replacing the current `Map<EventType, Set<(event: any) => void>>`.

#### Scenario: Internal storage is typed
- **WHEN** `renderer.on("key", handler)` is called
- **THEN** the handler is stored in the `TypedEmitter` instance
- **AND** `renderer.emit("frame", stats)` dispatches through the `TypedEmitter`

#### Scenario: Public on overloads delegate to TypedEmitter
- **WHEN** `renderer.on("key", handler)` is called
- **THEN** it delegates to `this._emitter.on("key", handler)`
- **AND** the public overloaded signatures remain unchanged

### Requirement: Pointer type is branded to prevent misuse
The `Pointer<T>` type SHALL use a `unique symbol` brand to create an opaque type that cannot be accidentally confused with `number` or `bigint`.

#### Scenario: Branded pointer rejects raw numbers
- **WHEN** a function expects `Pointer<Renderer>` and receives a raw `number` argument
- **THEN** TypeScript produces a compile-time type error

#### Scenario: Branded pointer accepts valid pointer
- **WHEN** a function expects `Pointer<Renderer>` and receives a value from `dlopen` or `ptr()`
- **THEN** no type error occurs
- **AND** the brand is erased at runtime (zero-cost abstraction)

#### Scenario: Different pointer types are distinguished
- **WHEN** a function expects `Pointer<Renderer>` and receives a `Pointer<Buffer>`
- **THEN** TypeScript produces a compile-time type error

### Requirement: Pointer type is exported from @moontui/core
The `Pointer<T>` type SHALL be exported from the public API as a replacement for the current `type Pointer = number`.

#### Scenario: Export path
- **WHEN** a consumer imports `Pointer` from `@moontui/core`
- **THEN** they receive the branded type `Pointer<out T = void>`
- **AND** it is assignable from both `number` and `bigint` pointer values

## Invariants

- `TypedEmitter` does NOT provide `once()` or `off()` in the initial implementation (add if needed).
- The `Pointer<T>` brand uses `declare const pointerBrand: unique symbol` (erasable at runtime, zero overhead).
- All existing FFI function signatures that use `Pointer` are updated to use `Pointer<void>` as a baseline; specific pointer types (`Pointer<Renderer>`, `Pointer<Buffer>`) are introduced incrementally.
- The `_injectKeyEvent` test-only method lives on `CliRenderer` and bypasses the emitter directly.
