# mouse-events

Mouse event pipeline from crossterm input through hit testing to TypeScript dispatch.

## Overview

Mouse events flow from crossterm through the Rust `EventBridge`, are dispatched via a `MouseCallback` FFI trampoline to TypeScript, and are routed through hit testing, hover tracking, drag state management, and auto-focus logic before reaching application handlers.

## Requirements

### Requirement: EventBridge SHALL handle mouse events from crossterm

`EventBridge::process_events()` SHALL poll crossterm for mouse events in addition to key and resize events. For each `Event::Mouse(mouse_event)`, it SHALL convert via `input::convert_mouse_event` and invoke the registered mouse callback.

#### Scenario: Mouse click triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Press`, `button: Left`, `column: 10`, `row: 5`
- **THEN** the registered `MouseCallback` is called with `event_type="mouse"`, `kind="down"`, `button=0`, `x=10`, `y=5`, `ctrl=false`, `shift=false`, `alt=false`, `scroll_dir=0`

#### Scenario: Mouse release triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Release`, `button: Left`, `column: 10`, `row: 5`
- **THEN** the registered `MouseCallback` is called with `kind="up"`

#### Scenario: Mouse drag triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Drag`, `button: Left`, `column: 12`, `row: 8`
- **THEN** the registered `MouseCallback` is called with `kind="drag"`

#### Scenario: Mouse move triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Move`, `button: None`, `column: 15`, `row: 3`
- **THEN** the registered `MouseCallback` is called with `kind="move"`, `button=3`

#### Scenario: Scroll up triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Press`, `button: ScrollUp`, `column: 5`, `row: 2`
- **THEN** the registered `MouseCallback` is called with `kind="scroll"`, `scroll_dir=1`

#### Scenario: Scroll down triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Press`, `button: ScrollDown`, `column: 5`, `row: 2`
- **THEN** the registered `MouseCallback` is called with `kind="scroll"`, `scroll_dir=2`

#### Scenario: Scroll left triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Press`, `button: ScrollLeft`, `column: 5`, `row: 2`
- **THEN** the registered `MouseCallback` is called with `kind="scroll"`, `scroll_dir=3`

#### Scenario: Scroll right triggers callback
- **WHEN** crossterm reports a `MouseEvent` with `kind: Press`, `button: ScrollRight`, `column: 5`, `row: 2`
- **THEN** the registered `MouseCallback` is called with `kind="scroll"`, `scroll_dir=4`

### Requirement: MouseEvent struct SHALL represent parsed mouse data

The `MouseEvent` struct in `input.rs` SHALL use `Cow<'static, str>` for the `event_type` field (matching `InputEvent`). It SHALL carry: `event_type`, `kind`, `button`, `x`, `y`, `ctrl`, `shift`, `alt`, `scroll_dir`.

#### Scenario: Mouse event struct fields
- **WHEN** `convert_mouse_event` converts a crossterm `MouseEvent`
- **THEN** the resulting struct SHALL have `event_type: Cow::Borrowed("mouse")`
- **AND** `kind` SHALL be one of: `"down"`, `"up"`, `"drag"`, `"move"`, `"scroll"`
- **AND** `button` SHALL be 0 (left), 1 (middle), 2 (right), or 3 (none/move)
- **AND** `x` and `y` SHALL be the cell coordinates (0-based)

### Requirement: MouseCallback type SHALL be defined

`EventBridge` SHALL define a `MouseCallback` type:

```rust
pub type MouseCallback = extern "C" fn(
    event_type: *const c_char, event_type_len: usize,
    kind: *const c_char, kind_len: usize,
    button: u32,
    x: u32, y: u32,
    ctrl: bool, shift: bool, alt: bool,
    scroll_dir: u32,
);
```

#### Scenario: MouseCallback signature
- **WHEN** a `MouseCallback` is registered via `set_mouse_callback`
- **THEN** the callback SHALL receive all mouse event data as flat parameters
- **AND** string parameters (`event_type`, `kind`) SHALL be passed as pointer + length pairs

### Requirement: EventBridge SHALL manage mouse callback lifecycle

`EventBridge` SHALL store an `Option<MouseCallback>` and provide `set_mouse_callback()` to set or clear it.

#### Scenario: Setting mouse callback enables mouse dispatch
- **WHEN** `set_mouse_callback(Some(cb))` is called, then `process_events()` receives a mouse event
- **THEN** `cb` is invoked with the mouse event data

#### Scenario: Clearing mouse callback disables mouse dispatch
- **WHEN** `set_mouse_callback(None)` is called, then `process_events()` receives a mouse event
- **THEN** no callback is invoked

### Requirement: CliRenderer SHALL enable mouse capture on setup

`CliRenderer::setup_terminal()` SHALL call `crossterm::execute!(stdout, EnableMouseCapture)` when mouse is enabled. `CliRenderer::restore_terminal()` SHALL call `DisableMouseCapture`.

#### Scenario: Mouse capture enabled on terminal setup
- **WHEN** `setup_terminal(true)` is called with mouse enabled
- **THEN** `EnableMouseCapture` SHALL be written to stdout
- **AND** the terminal SHALL begin reporting mouse events via crossterm

#### Scenario: Mouse capture disabled on terminal restore
- **WHEN** `restore_terminal()` is called
- **THEN** `DisableMouseCapture` SHALL be written to stdout before raw mode is disabled

#### Scenario: Mouse capture not enabled when useMouse is false
- **WHEN** `setup_terminal(true)` is called with mouse disabled
- **THEN** `EnableMouseCapture` SHALL NOT be written

### Requirement: CliRenderer SHALL support mouse enable/disable at runtime

`CliRenderer` SHALL provide `enable_mouse(enable_movement: bool)` and `disable_mouse()` methods that dynamically toggle mouse capture.

#### Scenario: Enable mouse with movement tracking
- **WHEN** `enable_mouse(true)` is called
- **THEN** `?1000h`, `?1002h`, `?1003h`, `?1006h` SHALL be written to stdout
- **AND** `?1003h` enables any-event tracking (all mouse motion)

#### Scenario: Enable mouse without movement tracking
- **WHEN** `enable_mouse(false)` is called
- **THEN** `?1000h`, `?1002h`, `?1006h` SHALL be written to stdout
- **AND** `?1003h` SHALL NOT be written (no motion events)

#### Scenario: Disable mouse
- **WHEN** `disable_mouse()` is called
- **THEN** `?1006l`, `?1003l`, `?1002l`, `?1000l` SHALL be written to stdout

### Requirement: CliRenderer SHALL provide inject_mouse_event for testing

`CliRenderer` SHALL provide `inject_mouse_event(kind, button, x, y, ctrl, shift, alt, scroll_dir)` that directly invokes the mouse callback with fabricated data, bypassing crossterm.

#### Scenario: inject_mouse_event triggers mouse callback
- **WHEN** `inject_mouse_event("down", 0, 10, 5, false, false, false, 0)` is called
- **THEN** the mouse callback SHALL be invoked with kind="down", button=0, x=10, y=5

#### Scenario: inject_mouse_event with no callback
- **WHEN** `inject_mouse_event(...)` is called with no mouse callback registered
- **THEN** no panic SHALL occur

### Requirement: CliRenderer process_events SHALL dispatch mouse events

`CliRenderer::process_events()` SHALL process `Event::Mouse` events from crossterm alongside key and resize events. Each mouse event SHALL be converted and dispatched through the mouse callback.

#### Scenario: process_events dispatches mouse alongside key events
- **WHEN** `process_events()` is called and both a key event and a mouse event are available
- **THEN** both events SHALL be dispatched through their respective callbacks
- **AND** the return count SHALL include both events

### Requirement: CliRenderer SHALL reset mouse state on resize

When a resize event is processed, `CliRenderer` SHALL clear the captured renderable state and reset mouse tracking.

#### Scenario: Resize clears captured renderable
- **WHEN** a resize event is processed while a renderable is captured
- **THEN** the captured renderable SHALL be set to `None`
- **AND** mouse state SHALL be reset

### Requirement: TypeScript CliRenderer SHALL emit mouse events

The TypeScript `CliRenderer` class SHALL register a mouse callback via FFI in its constructor when `useMouse` is true. When the callback fires, it SHALL create a `MouseEvent` instance and emit it through the `TypedEmitter`.

#### Scenario: Mouse event emits to subscribers
- **WHEN** `renderer.on("mouse", handler)` is registered and a mouse click occurs
- **THEN** `handler` SHALL be called with a `MouseEvent` instance

#### Scenario: Mouse callback not registered when useMouse is false
- **WHEN** `new CliRenderer({ useMouse: false })` is called
- **THEN** no mouse callback SHALL be registered on the native side

#### Scenario: Mouse callback cleaned up on destroy
- **WHEN** `renderer.destroy()` is called
- **THEN** `setMouseCallback(ptr, null)` SHALL be called
- **AND** the mouse callback trampoline SHALL be closed

### Requirement: MouseEvent class SHALL have standard event methods

The `MouseEvent` class SHALL provide `preventDefault()` and `stopPropagation()` methods, matching the `KeyEvent` pattern.

#### Scenario: preventDefault sets flag
- **WHEN** `event.preventDefault()` is called on a `MouseEvent`
- **THEN** `event.defaultPrevented` SHALL return `true`

#### Scenario: stopPropagation sets flag
- **WHEN** `event.stopPropagation()` is called on a `MouseEvent`
- **THEN** `event.propagationStopped` SHALL return `true`

#### Scenario: Flags default to false
- **WHEN** a new `MouseEvent` is created
- **THEN** both `defaultPrevented` and `propagationStopped` SHALL be `false`

### Requirement: processSingleMouseEvent SHALL implement full dispatch logic

The TypeScript `CliRenderer` SHALL implement `processSingleMouseEvent(rawEvent)` that performs hit testing, hover tracking, scroll fallback, and event dispatch.

#### Scenario: Click dispatches to hit-tested widget
- **WHEN** a mouse down event occurs at coordinates (10, 5)
- **AND** the hit grid maps (10, 5) to widget ID 42
- **THEN** a `MouseEvent` with `type="down"`, `target=widget42` SHALL be dispatched

#### Scenario: Click on empty area clears focus
- **WHEN** a mouse down event occurs at coordinates with no widget hit
- **THEN** a `MouseEvent` with `type="down"`, `target=null` SHALL be dispatched

#### Scenario: Scroll falls back to focused widget
- **WHEN** a scroll event occurs at coordinates with no widget hit
- **AND** a widget is currently focused
- **THEN** the scroll event SHALL be dispatched to the focused widget

#### Scenario: Move fires over/out events
- **WHEN** a mouse move event occurs over a different widget than the last move
- **THEN** an `out` event SHALL be dispatched to the previous widget
- **AND** an `over` event SHALL be dispatched to the new widget

#### Scenario: Drag captures the renderable
- **WHEN** a drag event occurs on a widget
- **THEN** that widget SHALL become the captured renderable
- **AND** subsequent mouse events SHALL be dispatched to the captured widget until mouse up

#### Scenario: Mouse up fires drag-end and drop
- **WHEN** a mouse up event occurs while a renderable is captured
- **THEN** a `drag-end` event SHALL be dispatched to the captured widget
- **AND** a `drop` event SHALL be dispatched to the widget under the cursor (if any)
- **AND** the captured renderable SHALL be cleared

#### Scenario: autoFocus on left click
- **WHEN** a left mouse down event occurs on a focusable widget
- **AND** `event.defaultPrevented` is false
- **THEN** the widget (or its nearest focusable ancestor) SHALL receive focus

### Requirement: CliRenderer SHALL support useMouse configuration

The `CliRenderer` constructor SHALL accept a `useMouse` option (default: `true`). The `useMouse` property SHALL be gettable and settable at runtime.

#### Scenario: useMouse defaults to true
- **WHEN** `new CliRenderer()` is called without specifying `useMouse`
- **THEN** mouse events SHALL be enabled

#### Scenario: useMouse can be disabled
- **WHEN** `new CliRenderer({ useMouse: false })` is called
- **THEN** mouse capture SHALL NOT be enabled
- **AND** no mouse callback SHALL be registered

#### Scenario: useMouse can be toggled at runtime
- **WHEN** `renderer.useMouse = false` is set
- **THEN** mouse capture SHALL be disabled
- **AND** the captured renderable SHALL be cleared

### Requirement: CliRenderer SHALL support enableMouseMovement configuration

The `CliRenderer` constructor SHALL accept an `enableMouseMovement` option (default: `true`). When false, only click and drag events are reported (no mouse move events).

#### Scenario: enableMouseMovement defaults to true
- **WHEN** `new CliRenderer()` is called
- **THEN** `?1003h` (any-event tracking) SHALL be enabled

#### Scenario: enableMouseMovement can be disabled
- **WHEN** `new CliRenderer({ enableMouseMovement: false })` is called
- **THEN** `?1003h` SHALL NOT be enabled
- **AND** `?1000h` and `?1002h` SHALL still be enabled

### Requirement: CliRenderer SHALL support autoFocus configuration

The `CliRenderer` constructor SHALL accept an `autoFocus` option (default: `true`). When true, left-clicking a widget focuses it (or its nearest focusable ancestor).

#### Scenario: autoFocus defaults to true
- **WHEN** `new CliRenderer()` is called
- **THEN** left-click SHALL focus the clicked widget

#### Scenario: autoFocus can be disabled
- **WHEN** `new CliRenderer({ autoFocus: false })` is called
- **THEN** left-click SHALL NOT automatically focus widgets

### Requirement: RendererEvents SHALL include mouse event type

The `RendererEvents` interface SHALL include `mouse: [MouseEvent]` alongside the existing `key`, `resize`, and `frame` events.

#### Scenario: Typed mouse event registration
- **WHEN** `renderer.on("mouse", handler)` is called
- **THEN** the handler SHALL be typed as `(event: MouseEvent) => void`

#### Scenario: Wrong event type produces compile error
- **WHEN** `renderer.on("mouse", (e: KeyEvent) => void)` is called
- **THEN** TypeScript SHALL produce a compile-time type error

## Invariants

- Mouse events are only produced when mouse capture is enabled.
- The mouse callback is invoked synchronously during `process_events()`, before any microtask dispatch.
- `processSingleMouseEvent` is called from the `handleStdinEvent` path, not from the callback directly.
- The hit grid is rebuilt each frame during rendering, not on every mouse event.
- `stopPropagation()` and `preventDefault()` flags are per-event (not persistent state).
