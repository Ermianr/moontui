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

The callback signature SHALL support both key and mouse events. Key events use the existing signature. Mouse events use a separate callback type:

```rust
// Key events (unchanged)
extern "C" fn(
    event_type: *const c_char, event_type_len: usize,  // "key"
    key: *const c_char, key_len: usize,
    ctrl: bool, shift: bool, alt: bool
);

// Mouse events (new)
extern "C" fn(
    event_type: *const c_char, event_type_len: usize,  // "mouse"
    kind: *const c_char, kind_len: usize,               // "down","up","drag","move","scroll"
    button: u32,                                         // 0=left,1=middle,2=right,3=none
    x: u32, y: u32,                                      // cell coordinates (0-based)
    ctrl: bool, shift: bool, alt: bool,
    scroll_dir: u32,                                     // 0=none,1=up,2=down,3=left,4=right
);
```

Key strings use camelCase format — e.g. `"ArrowUp"`, `"ArrowDown"`, `"Enter"`, `"Escape"` — matching browser `KeyboardEvent.key` convention.

#### Scenario: Key events produce correct parameters
- **WHEN** the user presses `Ctrl+Shift+A`
- **THEN** the key callback is invoked with `event_type = "key"`, `key = "a"`, `ctrl = true`, `shift = true`, `alt = false`

#### Scenario: Mouse events produce correct parameters
- **WHEN** the user clicks at cell (10, 5) with left button
- **THEN** the mouse callback is invoked with `event_type = "mouse"`, `kind = "down"`, `button = 0`, `x = 10`, `y = 5`

#### Scenario: Arrow keys produce camelCase names
- **WHEN** the user presses the Arrow Up key
- **THEN** the key callback is invoked with `key = "ArrowUp"`
- **AND** `event_type = "key"`

#### Scenario: Enter produces "Enter"
- **WHEN** the user presses Enter
- **THEN** the key callback is invoked with `key = "Enter"`

#### Scenario: Escape produces "Escape"
- **WHEN** the user presses Escape
- **THEN** the key callback is invoked with `key = "Escape"`

## C ABI Exports

```c
// Registers or clears the event callback pointer (key events).
void setEventCallback(CliRenderer* renderer, void (*callback)(
    const char* event_type, size_t event_type_len,
    const char* key, size_t key_len,
    bool ctrl, bool shift, bool alt
));

// Registers or clears the mouse callback pointer (mouse events).
void setMouseCallback(CliRenderer* renderer, void (*callback)(
    const char* event_type, size_t event_type_len,
    const char* kind, size_t kind_len,
    uint32_t button,
    uint32_t x, uint32_t y,
    bool ctrl, bool shift, bool alt,
    uint32_t scroll_dir
));

// Processes pending input events and dispatches them through callbacks.
size_t processEvents(CliRenderer* renderer);
```

## Invariants

- Events are only produced for `KeyEventKind::Press` and `KeyEventKind::Repeat`, not `Release`.
- `processEvents` does not block. It uses `crossterm::event::poll(Duration::ZERO)`.
- Events are dispatched as structured callback parameters (not JSON).
- No events are buffered between `processEvents` calls — the last step before dispatch is the callback trampoline.
