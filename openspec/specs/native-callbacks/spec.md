# native-callbacks

Callback mechanism for pushing events from Rust to TypeScript via bun:ffi `JSCallback` trampoline.

## Overview

Instead of TypeScript polling Rust for events, Rust holds a C-callable function pointer provided by TypeScript and calls it directly when input events occur. The callback is created by bun:ffi's `JSCallback` class, which generates a native trampoline. Events are dispatched synchronously inside the callback (Rust → C trampoline → JS closure) and deferred to microtask queue for handler dispatch.

## Requirements

### Requirement: Renderer holds optional callback pointer
The `CliRenderer` SHALL hold an `Option<EventCallback>` field. The callback type SHALL be:

```rust
type EventCallback = extern "C" fn(
    event_type: *const c_char, event_type_len: usize,
    key: *const c_char, key_len: usize,
    ctrl: bool, shift: bool, alt: bool,
);
```

#### Scenario: Callback registered after renderer creation
- **WHEN** `setEventCallback(renderer, callback_ptr)` is called with a valid function pointer
- **THEN** the renderer stores the pointer
- **AND** subsequent `processEvents()` calls invoke the callback for each event

#### Scenario: Callback cleared before destroy
- **WHEN** `setEventCallback(renderer, null)` is called
- **THEN** the renderer sets the stored pointer to `None`
- **AND** subsequent `processEvents()` calls skip callback invocation

### Requirement: processEvents drains crossterm and dispatches via callback
The `processEvents()` method SHALL handle `CString::new` failures by skipping the event instead of panicking.

#### Scenario: Normal event processing
- **WHEN** `processEvents()` is called with a registered callback and a key event is available
- **THEN** the event SHALL be converted to `CString` and dispatched via the callback
- **AND** the count SHALL be incremented

#### Scenario: CString conversion failure skips event
- **WHEN** `processEvents()` encounters a key event where `CString::new` fails (interior null byte)
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
The `CliRenderer` constructor SHALL create a `JSCallback` instance and register it with Rust via `setEventCallback`.

#### Scenario: JSCallback lifecycle
- **WHEN** `new CliRenderer()` is called
- **THEN** a `JSCallback` is created with matching C ABI signature
- **AND** `lib.symbols.setEventCallback(this._ptr, callback.ptr)` is called
- **AND** the callback reads string data from raw pointers using `toArrayBuffer`
- **AND** the callback uses `queueMicrotask` to defer handler dispatch

#### Scenario: JSCallback cleanup
- **WHEN** `destroy()` is called
- **THEN** `setEventCallback(ptr, null)` is called first (Rust-side cleanup)
- **AND** `callback.close()` is called (trampoline cleanup)
- **AND** `destroyRenderer(ptr)` is called last
