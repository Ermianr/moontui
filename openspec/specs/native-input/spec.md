# native-input

Non-blocking keyboard event processing dispatched via native callbacks.

## Overview

Input events are dispatched through a registered callback function pointer. Events flow from crossterm to Rust to TypeScript via a bun:ffi `JSCallback` trampoline, eliminating JSON serialization. The `processEvents()` method drains all available events synchronously and dispatches each one through the callback.

## Requirements

### Requirement: processEvents dispatches via callback
The `processEvents()` method SHALL poll crossterm directly and dispatch events through the registered callback. It SHALL be non-blocking (zero-duration poll). There is no separate testing path — polling is the same in all modes.

#### Scenario: processEvents polls crossterm directly
- **WHEN** `processEvents()` is called in any mode
- **THEN** it polls crossterm with `Duration::ZERO` and dispatches events through the callback
- **AND** there is no separate testing path — polling is the same in all modes

#### Scenario: No callback registered
- **WHEN** `processEvents()` is called with no registered callback
- **THEN** events are still consumed from crossterm but discarded
- **AND** the method returns 0

### Requirement: Event format
The callback signature SHALL be:
```rust
extern "C" fn(
    event_type: *const c_char, event_type_len: usize,  // "key"
    key: *const c_char, key_len: usize,                  // e.g. "q", "ArrowUp", "Enter"
    ctrl: bool, shift: bool, alt: bool                   // modifier flags
);
```

Key strings use camelCase format — e.g. `"ArrowUp"`, `"ArrowDown"`, `"Enter"`, `"Escape"` — matching browser `KeyboardEvent.key` convention.

#### Scenario: Key events produce correct parameters
- **WHEN** the user presses `Ctrl+Shift+A`
- **THEN** the callback is invoked with `event_type = "key"`, `key = "a"`, `ctrl = true`, `shift = true`, `alt = false`

#### Scenario: Arrow keys produce camelCase names
- **WHEN** the user presses the Arrow Up key
- **THEN** the callback is invoked with `key = "ArrowUp"`
- **AND** `event_type = "key"`

#### Scenario: Enter produces "Enter"
- **WHEN** the user presses Enter
- **THEN** the callback is invoked with `key = "Enter"`

#### Scenario: Escape produces "Escape"
- **WHEN** the user presses Escape
- **THEN** the callback is invoked with `key = "Escape"`

## C ABI Exports

```c
// Registers or clears the event callback pointer.
// Pass a valid trampoline pointer to register, or null to clear.
void setEventCallback(CliRenderer* renderer, void (*callback)(
    const char* event_type, size_t event_type_len,
    const char* key, size_t key_len,
    bool ctrl, bool shift, bool alt
));

// Processes pending input events and dispatches them through the callback.
// Synchronous, non-blocking. Returns the number of events dispatched.
size_t processEvents(CliRenderer* renderer);
```

## Invariants

- Events are only produced for `KeyEventKind::Press` and `KeyEventKind::Repeat`, not `Release`.
- `processEvents` does not block. It uses `crossterm::event::poll(Duration::ZERO)`.
- Events are dispatched as structured callback parameters (not JSON).
- No events are buffered between `processEvents` calls — the last step before dispatch is the callback trampoline.
