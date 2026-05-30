# native-callbacks

Callback mechanism for pushing events from Rust to TypeScript via bun:ffi `JSCallback` trampoline.

## Overview

Instead of TypeScript polling Rust for events, Rust holds a C-callable function pointer provided by TypeScript and calls it directly when input events occur. The callback is created by bun:ffi's `JSCallback` class, which generates a native trampoline. Events are dispatched synchronously inside the callback (Rust → C trampoline → JS closure) and deferred to microtask queue for handler dispatch.

## Requirements

### Requirement: Renderer holds optional callback pointer

The `CliRenderer` SHALL hold an `Option<EventCallback>` field for key events AND an `Option<MouseCallback>` field for mouse events. The callback types SHALL be:

```rust
type EventCallback = extern "C" fn(
    event_type: *const c_char, event_type_len: usize,
    key: *const c_char, key_len: usize,
    ctrl: bool, shift: bool, alt: bool,
);

type MouseCallback = extern "C" fn(
    event_type: *const c_char, event_type_len: usize,
    kind: *const c_char, kind_len: usize,
    button: u32,
    x: u32, y: u32,
    ctrl: bool, shift: bool, alt: bool,
    scroll_dir: u32,
);
```

#### Scenario: Callback registered after renderer creation
- **WHEN** `setEventCallback(renderer, callback_ptr)` is called with a valid function pointer
- **THEN** the renderer stores the pointer
- **AND** subsequent `processEvents()` calls invoke the callback for each key event

#### Scenario: Mouse callback registered after renderer creation
- **WHEN** `setMouseCallback(renderer, callback_ptr)` is called with a valid function pointer
- **THEN** the renderer stores the mouse callback pointer
- **AND** subsequent `processEvents()` calls invoke the mouse callback for each mouse event

#### Scenario: Callback cleared before destroy
- **WHEN** `setEventCallback(renderer, null)` is called
- **THEN** the renderer sets the stored pointer to `None`
- **AND** subsequent `processEvents()` calls skip callback invocation

#### Scenario: Mouse callback cleared before destroy
- **WHEN** `setMouseCallback(renderer, null)` is called
- **THEN** the renderer sets the stored mouse pointer to `None`
- **AND** subsequent `processEvents()` calls skip mouse callback invocation

### Requirement: processEvents drains crossterm and dispatches via callback

The `processEvents()` method SHALL handle `CString::new` failures by skipping the event instead of panicking. This applies to both key and mouse events.

#### Scenario: Normal event processing
- **WHEN** `processEvents()` is called with a registered callback and a key event is available
- **THEN** the event SHALL be converted to `CString` and dispatched via the callback
- **AND** the count SHALL be incremented

#### Scenario: Mouse event processing
- **WHEN** `processEvents()` is called with a registered mouse callback and a mouse event is available
- **THEN** the event SHALL be converted and dispatched via the mouse callback
- **AND** the count SHALL be incremented

#### Scenario: CString conversion failure skips event
- **WHEN** `processEvents()` encounters an event where `CString::new` fails (interior null byte)
- **THEN** the event SHALL be skipped
- **AND** no callback invocation SHALL occur for that event
- **AND** processing SHALL continue with the next event
- **AND** the count SHALL NOT be incremented for the skipped event

### Requirement: injectKeyEvent handles CString failure gracefully
The `inject_key_event()` method SHALL handle `CString::new` failures by returning early instead of panicking.

#### Scenario: Normal key injection
- **WHEN** `inject_key_event(key, ctrl, shift, alt)` is called with a valid string
- **THEN** the event SHALL be dispatched via the callback

#### Scenario: CString conversion failure returns early
- **WHEN** `inject_key_event` is called with a string containing an interior null byte
- **THEN** the function SHALL return without invoking the callback
- **AND** no panic SHALL occur

### Requirement: TS creates JSCallback in constructor

The `CliRenderer` constructor SHALL create a `JSCallback` instance for key events AND a `JSCallback` instance for mouse events. Both SHALL be registered with Rust via `setEventCallback` and `setMouseCallback` respectively.

#### Scenario: JSCallback lifecycle for key events
- **WHEN** `new CliRenderer()` is called
- **THEN** a key `JSCallback` is created with matching C ABI signature
- **AND** `lib.symbols.setEventCallback(this._ptr, callback.ptr)` is called
- **AND** the callback reads string data from raw pointers using `toArrayBuffer`
- **AND** the callback uses `queueMicrotask` to defer handler dispatch

#### Scenario: JSCallback lifecycle for mouse events
- **WHEN** `new CliRenderer()` is called with `useMouse: true`
- **THEN** a mouse `JSCallback` is created with matching C ABI signature
- **AND** `lib.symbols.setMouseCallback(this._ptr, callback.ptr)` is called

#### Scenario: JSCallback cleanup
- **WHEN** `destroy()` is called
- **THEN** `setEventCallback(ptr, null)` SHALL be called first (Rust-side cleanup)
- **AND** `setMouseCallback(ptr, null)` SHALL be called first (Rust-side cleanup)
- **AND** both callback `.close()` calls SHALL be made (trampoline cleanup)
- **AND** `destroyRenderer(ptr)` SHALL be called last
