# interaction-system

## Purpose
Defines keyboard input, native input callbacks, mouse events, focus management, hit testing, pointer style, typed renderer events, resize propagation, and interactive event dispatch.

## Requirements

<!-- Preserved from openspec/specs/event-input/spec.md. -->

### Requirement: EventBridge SHALL poll crossterm events

`EventBridge::process_events()` SHALL poll crossterm for key, resize, AND mouse events using a zero-timeout poll. For each non-release `KeyEvent`, it SHALL convert via `input::convert_key_event` and invoke the registered key callback. For each `Event::Resize`, it SHALL invoke the registered resize callback. For each `Event::Mouse`, it SHALL convert via `input::convert_mouse_event` and invoke the registered mouse callback.

#### Scenario: Registered callback is invoked on key press
- **WHEN** crossterm reports a `KeyEvent::Char('x')` with no modifiers
- **THEN** the registered `EventCallback` is called with event_type="key", key="x", ctrl=false, shift=false, alt=false

#### Scenario: Release events are ignored
- **WHEN** crossterm reports a `KeyEventKind::Release`
- **THEN** no callback is invoked

#### Scenario: Resize events invoke resize callback
- **WHEN** crossterm reports `Event::Resize(120, 40)` and a resize callback is registered
- **THEN** the resize callback is invoked with width=120, height=40
- **AND** the key callback is NOT invoked

#### Scenario: Mouse events invoke mouse callback
- **WHEN** crossterm reports `Event::Mouse(mouse_event)` and a mouse callback is registered
- **THEN** the mouse callback is invoked with the mouse event data
- **AND** the key callback is NOT invoked
- **AND** the resize callback is NOT invoked

#### Scenario: Mouse events ignored when no callback registered
- **WHEN** crossterm reports `Event::Mouse(mouse_event)` and no mouse callback is registered
- **THEN** no callback is invoked
- **AND** no panic occurs

### Requirement: EventBridge SHALL manage callback lifecycle

`EventBridge` SHALL store an `Option<EventCallback>` for key events and an `Option<ResizeCallback>` for resize events. It SHALL provide `set_callback()` and `set_resize_callback()` to set or clear each independently.

#### Scenario: Setting callback enables event dispatch
- **WHEN** `set_callback(Some(cb))` is called, then `process_events()` receives a key event
- **THEN** `cb` is invoked

#### Scenario: Clearing callback disables event dispatch
- **WHEN** `set_callback(None)` is called, then `process_events()` receives a key event
- **THEN** no callback is invoked

#### Scenario: Setting resize callback enables resize dispatch
- **WHEN** `set_resize_callback(Some(cb))` is called, then `process_events()` receives a resize event
- **THEN** `cb` is invoked with the new dimensions

#### Scenario: Clearing resize callback disables resize dispatch
- **WHEN** `set_resize_callback(None)` is called, then `process_events()` receives a resize event
- **THEN** no callback is invoked

### Requirement: EventBridge SHALL support test injection

`EventBridge` SHALL provide `inject_key_event()` under `#[cfg(test)]` that directly invokes the callback with fabricated key data, bypassing crossterm.

#### Scenario: inject_key_event triggers callback
- **WHEN** `inject_key_event("ArrowUp", false, false, false)` is called
- **THEN** the callback is invoked with key="ArrowUp" and no modifiers

#### Scenario: inject_key_event with modifiers
- **WHEN** `inject_key_event("c", true, false, false)` is called
- **THEN** the callback is invoked with key="c" and ctrl=true

### Requirement: InputEvent uses Cow for reduced allocations
The `InputEvent` struct SHALL use `Cow<'static, str>` for the `key` field instead of `String`, eliminating heap allocations for fixed key names.

#### Scenario: Fixed keys use Cow::Borrowed
- **WHEN** `convert_key_event` converts a `KeyCode::Up` event
- **THEN** the `key` field SHALL be `Cow::Borrowed("ArrowUp")`
- **AND** no heap allocation SHALL occur for the key string

#### Scenario: Character keys use Cow::Owned
- **WHEN** `convert_key_event` converts a `KeyCode::Char('x')` event
- **THEN** the `key` field SHALL be `Cow::Owned("x".to_string())`
- **AND** a heap allocation SHALL occur only for the character conversion

#### Scenario: EventBridge passes Cow key to callback
- **WHEN** `EventBridge::process_events` invokes the callback
- **THEN** it SHALL pass `event.key.as_ptr()` and `event.key.len()` to the callback
- **AND** the callback SHALL receive the same key bytes as before

<!-- Preserved from openspec/specs/native-input/spec.md. -->

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

<!-- Preserved from openspec/specs/native-callbacks/spec.md. -->

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

<!-- Preserved from openspec/specs/mouse-events/spec.md. -->

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

### Requirement: Mouse click activates interactive widgets
The mouse event pipeline SHALL allow left-clicked button and checkbox renderables to handle activation through the existing hit-tested dispatch path.

#### Scenario: Click dispatches to button
- **WHEN** a left mouse click occurs on a button renderable
- **AND** hit testing resolves the button as the event target
- **THEN** the button SHALL receive the mouse event and fire `onPress`

#### Scenario: Click dispatches to checkbox
- **WHEN** a left mouse click occurs on a checkbox renderable
- **AND** hit testing resolves the checkbox as the event target
- **THEN** the checkbox SHALL receive the mouse event and toggle checked state

### Requirement: Disabled interactive widgets ignore mouse activation
Disabled button and checkbox renderables SHALL ignore mouse activation events.

#### Scenario: Disabled button ignores click
- **WHEN** a left mouse click occurs on a disabled button
- **THEN** `onPress` SHALL NOT be called

#### Scenario: Disabled checkbox ignores click
- **WHEN** a left mouse click occurs on a disabled checkbox
- **THEN** checked state SHALL NOT change

<!-- Preserved from openspec/specs/focus-management/spec.md. -->

### Requirement: Focus manager tracks a single focused renderable
The system SHALL provide renderer-owned focus management that tracks at most one focused renderable at a time.

#### Scenario: Focus renderable
- **WHEN** `renderer.focus(renderable)` is called with a focusable renderable in the renderer tree
- **THEN** that renderable SHALL become the current focused renderable
- **AND** `renderer.focused` SHALL return that renderable

#### Scenario: Replacing focus blurs previous renderable
- **WHEN** renderable A is focused and `renderer.focus(renderableB)` is called
- **THEN** renderable A SHALL become unfocused before renderable B becomes focused
- **AND** only renderable B SHALL be focused after the call

#### Scenario: Blur clears focus
- **WHEN** `renderer.blur()` is called while a renderable is focused
- **THEN** no renderable SHALL remain focused
- **AND** `renderer.focused` SHALL return `null`

### Requirement: Focus traversal follows renderable tree order
The system SHALL move focus through focusable renderables in deterministic renderable tree order.

#### Scenario: Focus next moves to next focusable renderable
- **WHEN** renderable A is focused and renderable B is the next focusable renderable in tree order
- **THEN** `renderer.focusNext()` SHALL focus renderable B

#### Scenario: Focus previous moves to previous focusable renderable
- **WHEN** renderable B is focused and renderable A is the previous focusable renderable in tree order
- **THEN** `renderer.focusPrevious()` SHALL focus renderable A

#### Scenario: Traversal wraps at end
- **WHEN** the last focusable renderable is focused
- **THEN** `renderer.focusNext()` SHALL focus the first focusable renderable

#### Scenario: Traversal skips non-focusable and disabled renderables
- **WHEN** the renderable tree contains non-focusable or disabled renderables
- **THEN** focus traversal SHALL skip them

### Requirement: Tab key performs focus traversal
The system SHALL use `Tab` and `Shift+Tab` as default keyboard traversal shortcuts.

#### Scenario: Tab focuses next renderable
- **WHEN** a key event with key `Tab` and no shift modifier reaches the focus manager
- **THEN** the next focusable renderable SHALL be focused
- **AND** the key event SHALL be consumed

#### Scenario: Shift Tab focuses previous renderable
- **WHEN** a key event with key `Tab` and shift modifier reaches the focus manager
- **THEN** the previous focusable renderable SHALL be focused
- **AND** the key event SHALL be consumed

### Requirement: Focused renderable receives key events
The system SHALL dispatch key events to the focused renderable before global renderer key listeners.

#### Scenario: Focused renderable handles key first
- **WHEN** a renderable is focused and a key event is received
- **THEN** the focused renderable's key handler SHALL receive the key event before global key listeners

#### Scenario: Unconsumed key reaches global listener
- **WHEN** the focused renderable handles a key event without stopping propagation
- **THEN** global renderer key listeners SHALL receive the same key event

#### Scenario: Stopped key does not reach global listener
- **WHEN** the focused renderable calls `stopPropagation()` on a key event
- **THEN** global renderer key listeners SHALL NOT receive that key event

### Requirement: Focused input receives editing keys through focus manager
The focus manager SHALL route key events to focused input renderables using the existing focused key dispatch behavior.

#### Scenario: Focused input edits from routed key
- **WHEN** an input renderable is focused
- **AND** key `"x"` is dispatched through the focus manager
- **THEN** the input SHALL handle the key before global renderer key listeners

### Requirement: Auto focus can select first focusable renderable
The system SHALL use renderer auto-focus behavior to focus the first focusable renderable when appropriate.

#### Scenario: Auto focus enabled
- **WHEN** `RendererOptions.autoFocus` is true and no renderable is focused
- **AND** the renderable tree contains at least one focusable renderable
- **THEN** the first focusable renderable in tree order SHALL be focused before focused key dispatch is needed

#### Scenario: Auto focus disabled
- **WHEN** `RendererOptions.autoFocus` is false
- **THEN** the renderer SHALL NOT automatically focus the first focusable renderable

### Requirement: Input renderables work with focus traversal
Input renderables SHALL participate in existing focus traversal because they are focusable by default.

#### Scenario: Tab reaches input
- **WHEN** the renderable tree contains an input renderable after another focusable renderable
- **AND** `renderer.focusNext()` is called from the previous renderable
- **THEN** the input SHALL become focused

### Requirement: Focus lifecycle fires in deterministic order
The system SHALL provide focus and blur lifecycle hooks for renderables.

#### Scenario: Focus fires focus hook
- **WHEN** a renderable becomes focused
- **THEN** its focus lifecycle hook SHALL be called once

#### Scenario: Blur fires before next focus
- **WHEN** focus moves from renderable A to renderable B
- **THEN** renderable A's blur lifecycle hook SHALL fire before renderable B's focus lifecycle hook

### Requirement: Interactive widgets participate in focus traversal
Button and checkbox renderables SHALL participate in focus traversal when enabled and focusable.

#### Scenario: Tab reaches button
- **WHEN** the renderable tree contains a button after another focusable renderable
- **AND** focus traversal moves forward
- **THEN** the button SHALL become focused

#### Scenario: Tab reaches checkbox
- **WHEN** the renderable tree contains a checkbox after another focusable renderable
- **AND** focus traversal moves forward
- **THEN** the checkbox SHALL become focused

### Requirement: Disabled interactive widgets are skipped by focus traversal
Disabled button and checkbox renderables SHALL NOT become focused through focus traversal.

#### Scenario: Disabled button is skipped
- **WHEN** focus traversal reaches a disabled button
- **THEN** focus SHALL move to the next enabled focusable renderable

#### Scenario: Disabled checkbox is skipped
- **WHEN** focus traversal reaches a disabled checkbox
- **THEN** focus SHALL move to the next enabled focusable renderable

### Requirement: Focused interactive widgets handle activation keys
The focus manager SHALL route activation keys to focused button and checkbox renderables before global renderer key listeners.

#### Scenario: Focused button handles activation key
- **WHEN** a button is focused
- **AND** key `"Enter"` is received
- **THEN** the button SHALL handle the key before global renderer key listeners

#### Scenario: Focused checkbox handles activation key
- **WHEN** a checkbox is focused
- **AND** key `" "` is received
- **THEN** the checkbox SHALL handle the key before global renderer key listeners

<!-- Preserved from openspec/specs/hit-testing/spec.md. -->

### Requirement: HitGrid SHALL be a cell-granularity spatial index

The `HitGrid` struct SHALL maintain a `Vec<u32>` where each element corresponds to a terminal cell at position `(x, y)`. The value at index `y * width + x` is the widget ID that owns that cell. A value of `0` means no widget occupies that cell.

#### Scenario: Hit grid dimensions match terminal
- **WHEN** a `HitGrid` is created for a 80x24 terminal
- **THEN** the internal buffer SHALL contain 80 * 24 = 1920 `u32` elements
- **AND** all elements SHALL be initialized to `0`

#### Scenario: Hit grid covers full terminal area
- **WHEN** a widget is registered at position (10, 5) with size (5, 3)
- **THEN** cells (10,5), (11,5), ..., (14,5), (10,6), ..., (14,7) SHALL have the widget ID
- **AND** all other cells SHALL remain `0`

### Requirement: HitGrid SHALL support registration of rectangular regions

`HitGrid` SHALL provide `add(x, y, width, height, id)` that writes the widget ID to all cells in the specified rectangle.

#### Scenario: Add widget to hit grid
- **WHEN** `add(5, 3, 10, 4, 42)` is called on a 40x20 grid
- **THEN** cells from (5,3) to (14,6) SHALL contain `42`

#### Scenario: Add widget overlapping terminal bounds
- **WHEN** `add(35, 18, 10, 10, 1)` is called on a 40x20 grid
- **THEN** only cells within bounds (35,18) to (39,19) SHALL be written
- **AND** no out-of-bounds panic SHALL occur

#### Scenario: Add widget at zero size
- **WHEN** `add(5, 3, 0, 0, 1)` is called
- **THEN** no cells SHALL be modified

### Requirement: HitGrid SHALL support scissor rectangles

`HitGrid` SHALL support a stack of scissor rectangles that clip `add()` operations. When a scissor rect is active, `add()` SHALL only write to cells that fall within the intersection of the widget rectangle and the scissor rect.

#### Scenario: Scissor rect clips registration
- **WHEN** `push_scissor(10, 10, 20, 10)` is active
- **AND** `add(5, 5, 30, 20, 1)` is called
- **THEN** only cells in the intersection (10,10)-(29,19) SHALL be written

#### Scenario: Nested scissor rects
- **WHEN** `push_scissor(0, 0, 40, 20)` is active
- **AND** `push_scissor(10, 10, 20, 10)` is pushed
- **AND** `add(5, 5, 30, 20, 1)` is called
- **THEN** only cells in the intersection of both rects SHALL be written
- **AND** `pop_scissor()` restores the outer scissor

#### Scenario: Pop scissor without push
- **WHEN** `pop_scissor()` is called with an empty scissor stack
- **THEN** no panic SHALL occur
- **AND** subsequent `add()` operations SHALL write to the full grid

### Requirement: HitGrid SHALL support query by coordinates

`HitGrid` SHALL provide `check_hit(x, y) -> u32` that returns the widget ID at the given cell coordinates.

#### Scenario: Hit returns widget ID
- **WHEN** cell (10, 5) contains widget ID 42
- **AND** `check_hit(10, 5)` is called
- **THEN** the return value SHALL be `42`

#### Scenario: Hit returns 0 for empty cell
- **WHEN** cell (10, 5) contains `0`
- **AND** `check_hit(10, 5)` is called
- **THEN** the return value SHALL be `0`

#### Scenario: Hit out of bounds returns 0
- **WHEN** `check_hit(100, 100)` is called on a 40x20 grid
- **THEN** the return value SHALL be `0`
- **AND** no panic SHALL occur

### Requirement: HitGrid SHALL support clear and resize

`HitGrid` SHALL provide `clear()` that resets all cells to `0`. It SHALL also support `resize(new_width, new_height)` that reallocates the buffer and preserves existing registrations where possible.

#### Scenario: Clear resets all cells
- **WHEN** `clear()` is called
- **THEN** all cells SHALL be `0`

#### Scenario: Resize preserves overlapping registrations
- **WHEN** a 40x20 grid has widgets registered
- **AND** `resize(60, 30)` is called
- **THEN** widgets within the original 40x20 area SHALL retain their IDs
- **AND** new cells outside the original area SHALL be `0`

#### Scenario: Resize to smaller dimensions truncates
- **WHEN** a 40x20 grid has widgets registered
- **AND** `resize(20, 10)` is called
- **THEN** only cells within (0,0)-(19,9) SHALL retain their IDs
- **AND** cells outside the new dimensions SHALL be dropped

### Requirement: HitGrid SHALL track dirty state

`HitGrid` SHALL provide `is_dirty() -> bool` that returns true if the grid contents changed since the last `clear_dirty()` call. This allows the renderer to skip hover rechecks when no widgets changed.

#### Scenario: Grid is dirty after add
- **WHEN** `add(5, 3, 10, 4, 1)` is called
- **AND** `is_dirty()` is called
- **THEN** the return value SHALL be `true`

#### Scenario: Grid is clean after clear_dirty
- **WHEN** `clear_dirty()` is called
- **AND** `is_dirty()` is called
- **THEN** the return value SHALL be `false`

### Requirement: FFI exports for HitGrid operations

The following FFI functions SHALL be exported via `#[moontui_export]`:

- `hitGridAdd(renderer, x, y, width, height, id)` — register a widget rectangle
- `hitGridCheckHit(renderer, x, y) -> u32` — query widget at coordinates
- `hitGridClear(renderer)` — reset all cells to 0
- `hitGridPushScissorRect(renderer, x, y, width, height)` — push scissor rect
- `hitGridPopScissorRect(renderer)` — pop scissor rect
- `hitGridClearScissorRects(renderer)` — clear scissor stack
- `hitGridIsDirty(renderer) -> bool` — check dirty state
- `hitGridClearDirty(renderer)` — clear dirty flag

#### Scenario: FFI add widget
- **WHEN** `hitGridAdd(renderer_ptr, 5, 3, 10, 4, 42)` is called via FFI
- **THEN** the hit grid SHALL have widget 42 registered at (5,3) with size (10,4)

#### Scenario: FFI check hit
- **WHEN** `hitGridCheckHit(renderer_ptr, 10, 5)` is called via FFI
- **AND** cell (10,5) contains widget 42
- **THEN** the return value SHALL be `42`

### Requirement: CliRenderer SHALL rebuild hit grid each frame

During `render()`, `CliRenderer` SHALL clear the hit grid, then call `hitGridClearDirty()` to reset the dirty flag. The TypeScript side SHALL re-register all widget rectangles after render.

#### Scenario: Hit grid cleared on render
- **WHEN** `render(false)` is called
- **THEN** the hit grid SHALL be cleared
- **AND** `hitGridClearDirty()` SHALL be called

### Requirement: TypeScript HitGrid wrapper SHALL provide ergonomic API

The TypeScript `CliRenderer` SHALL expose `addToHitGrid(x, y, width, height, id)`, `checkHit(x, y)`, `pushHitGridScissorRect(x, y, width, height)`, `popHitGridScissorRect()`, `clearHitGridScissorRects()`, and `isHitGridDirty()` methods that delegate to the native FFI calls.

#### Scenario: TS addToHitGrid calls native
- **WHEN** `renderer.addToHitGrid(5, 3, 10, 4, 42)` is called
- **THEN** it SHALL call `lib.symbols.hitGridAdd(renderer._unsafePtr, 5, 3, 10, 4, 42)`

#### Scenario: TS checkHit returns widget ID
- **WHEN** `renderer.checkHit(10, 5)` is called
- **THEN** it SHALL return the widget ID at cell (10, 5)

### Requirement: CliRenderer SHALL recheck hover state after render

After each render frame, if `isHitGridDirty()` returns true, `CliRenderer` SHALL call `recheckHoverState()` which re-evaluates the widget under the cursor and fires over/out events if the widget changed.

#### Scenario: Hover recheck after render
- **WHEN** a render completes and the hit grid is dirty
- **AND** the cursor is over widget A (previously over widget B)
- **THEN** an `out` event SHALL be dispatched to widget B
- **AND** an `over` event SHALL be dispatched to widget A

#### Scenario: No hover recheck when clean
- **WHEN** a render completes and the hit grid is not dirty
- **THEN** `recheckHoverState()` SHALL NOT be called

<!-- Preserved from openspec/specs/mouse-pointer-style/spec.md. -->

### Requirement: MousePointerStyle enum SHALL define cursor shapes

The `MousePointerStyle` enum SHALL define the following cursor shapes:

- `Default` (0) — platform default cursor
- `Pointer` (1) — pointing hand cursor
- `Text` (2) — text selection cursor (I-beam)
- `Crosshair` (3) — crosshair cursor
- `Move` (4) — move/grab cursor
- `NotAllowed` (5) — not-allowed/disabled cursor

#### Scenario: Enum values are contiguous
- **WHEN** `MousePointerStyle` is inspected
- **THEN** the enum SHALL have exactly 6 variants with values 0-5

### Requirement: CliRenderer SHALL set mouse pointer style via ANSI sequences

`CliRenderer` SHALL provide `set_mouse_pointer_style(style: MousePointerStyle)` that writes the appropriate DECSCUSR sequence to the terminal and stores the current style.

#### Scenario: Set pointer style to pointer
- **WHEN** `set_mouse_pointer_style(Pointer)` is called
- **THEN** `\x1b[0 q` (reset) followed by the appropriate DECSCUSR sequence SHALL be written to stdout
- **AND** `get_mouse_pointer_style()` SHALL return `Pointer`

#### Scenario: Set pointer style to text
- **WHEN** `set_mouse_pointer_style(Text)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Set pointer style to crosshair
- **WHEN** `set_mouse_pointer_style(Crosshair)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Set pointer style to move
- **WHEN** `set_mouse_pointer_style(Move)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Set pointer style to not-allowed
- **WHEN** `set_mouse_pointer_style(NotAllowed)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Reset to default
- **WHEN** `set_mouse_pointer_style(Default)` is called
- **THEN** `\x1b[0 q` SHALL be written to stdout

### Requirement: CliRenderer SHALL track current pointer style

`CliRenderer` SHALL store the current `MousePointerStyle` and provide `get_mouse_pointer_style()` to query it.

#### Scenario: Default pointer style
- **WHEN** a new `CliRenderer` is created
- **THEN** `get_mouse_pointer_style()` SHALL return `Default`

#### Scenario: Pointer style persists across calls
- **WHEN** `set_mouse_pointer_style(Pointer)` is called
- **THEN** `get_mouse_pointer_style()` SHALL return `Pointer` until changed

### Requirement: CliRenderer SHALL restore pointer style on terminal restore

`CliRenderer::restore_terminal()` SHALL reset the mouse pointer style to `Default` by writing the reset DECSCUSR sequence.

#### Scenario: Restore resets pointer style
- **WHEN** `restore_terminal()` is called after setting pointer to `Crosshair`
- **THEN** the reset DECSCUSR sequence SHALL be written
- **AND** the stored pointer style SHALL be `Default`

### Requirement: FFI exports for mouse pointer style

The following FFI functions SHALL be exported:

- `setMousePointerStyle(renderer, style: u32)` — set cursor shape
- `getMousePointerStyle(renderer) -> u32` — query current cursor shape

The proc macro SHALL resolve `MousePointerStyle` to `u32` (not `ptr`) in the schema.

#### Scenario: FFI set pointer style
- **WHEN** `setMousePointerStyle(renderer_ptr, 1)` is called via FFI
- **THEN** the pointer style SHALL be set to `Pointer` (value 1)

#### Scenario: FFI get pointer style
- **WHEN** `getMousePointerStyle(renderer_ptr)` is called via FFI
- **AND** the current style is `Crosshair` (value 3)
- **THEN** the return value SHALL be `3`

#### Scenario: Proc macro resolves MousePointerStyle as u32
- **WHEN** `cargo build` generates `target/moontui-schema.json`
- **THEN** the `setMousePointerStyle` function's `style` parameter type SHALL be `"u32"`
- **AND** it SHALL NOT be `"ptr"`

### Requirement: TypeScript CliRenderer SHALL expose pointer style API

The TypeScript `CliRenderer` SHALL expose `setMousePointerStyle(style: MousePointerStyle)` and `getMousePointerStyle(): MousePointerStyle` that delegate to the native FFI calls. The enum mapping SHALL be centralized in `mouse.ts` via `mousePointerStyleToNative()` and `mousePointerStyleFromNative()` helper functions, derived from a single source-of-truth const.

#### Scenario: TS set pointer style
- **WHEN** `renderer.setMousePointerStyle("pointer")` is called
- **THEN** it SHALL call the native `setMousePointerStyle` with value `1`

#### Scenario: TS get pointer style
- **WHEN** `renderer.getMousePointerStyle()` is called
- **THEN** it SHALL return the current style as a string (`"default"`, `"pointer"`, `"text"`, `"crosshair"`, `"move"`, `"not-allowed"`)

#### Scenario: Mapping functions are centralized
- **WHEN** `mousePointerStyleToNative("crosshair")` is called from `mouse.ts`
- **THEN** it SHALL return `3`

#### Scenario: Reverse mapping is centralized
- **WHEN** `mousePointerStyleFromNative(4)` is called from `mouse.ts`
- **THEN** it SHALL return `"move"`

<!-- Preserved from openspec/specs/resize-event-propagation/spec.md. -->

### Requirement: EventBridge SHALL dispatch resize events via callback

`EventBridge` SHALL store an `Option<ResizeCallback>` and provide `set_resize_callback()` to set or clear it. When `process_events()` receives `Event::Resize(w, h)` from crossterm, it SHALL invoke the registered callback with the new dimensions.

#### Scenario: Resize callback fires on terminal resize
- **WHEN** a resize callback is registered and crossterm reports `Event::Resize(120, 40)`
- **THEN** the callback SHALL be invoked with width=120 and height=40

#### Scenario: No resize callback registered
- **WHEN** no resize callback is registered and crossterm reports `Event::Resize(120, 40)`
- **THEN** no callback SHALL be invoked and no panic SHALL occur

#### Scenario: Setting and clearing resize callback
- **WHEN** `set_resize_callback(Some(cb))` is called, then `set_resize_callback(None)` is called, then a resize event occurs
- **THEN** no callback SHALL be invoked after clearing

### Requirement: CliRenderer SHALL auto-reallocate buffers on resize

When `process_events()` detects a resize event, `CliRenderer` SHALL call `self.resize(new_w, new_h)` to reallocate both front and back buffers to the new dimensions, then call `self.render(true)` to force-repaint the entire viewport.

#### Scenario: Buffers reallocate to new size after resize
- **WHEN** a renderer at 80x24 receives a resize event to 120x40
- **THEN** `front_buffer.width` SHALL be 120 and `front_buffer.height` SHALL be 40
- **AND** `back_buffer.width` SHALL be 120 and `back_buffer.height` SHALL be 40

#### Scenario: Force-render happens after resize
- **WHEN** a renderer at 80x24 receives a resize event to 120x40
- **THEN** a force-render SHALL execute (frame_count incremented)
- **AND** the entire new viewport SHALL be painted

#### Scenario: Resize to smaller dimensions
- **WHEN** a renderer at 80x24 receives a resize event to 40x10
- **THEN** buffers SHALL be 40x10 with no leftover data from the old size

### Requirement: CliRenderer SHALL provide inject_resize_event for testing

`CliRenderer` SHALL provide `inject_resize_event(width, height)` that queues a resize through the same internal path as a real `Event::Resize` from crossterm: firing the resize callback and triggering buffer reallocation with force-render.

#### Scenario: inject_resize_event exercises full chain
- **WHEN** `inject_resize_event(120, 40)` is called on a renderer with a resize callback registered
- **THEN** the resize callback SHALL fire with (120, 40)
- **AND** buffers SHALL be reallocated to 120x40
- **AND** a force-render SHALL execute

#### Scenario: inject_resize_event with no callback
- **WHEN** `inject_resize_event(120, 40)` is called with no resize callback
- **THEN** no panic SHALL occur
- **AND** buffers SHALL still be reallocated to 120x40

### Requirement: TypeScript CliRenderer SHALL emit resize events

The TypeScript `CliRenderer` class SHALL register a resize callback via FFI in its constructor. When the callback fires, it SHALL update internal `_width` and `_height` properties and emit a `"resize"` event through the `TypedEmitter`.

#### Scenario: Resize event emits to subscribers
- **WHEN** `renderer.on("resize", handler)` is registered and a resize to 80x24 occurs
- **THEN** `handler` SHALL be called with `{ type: "resize", width: 80, height: 24 }`

#### Scenario: Renderer dimensions update on resize
- **WHEN** a resize to 80x24 occurs
- **THEN** `renderer.terminalSize()` SHALL return `{ width: 80, height: 24 }`

#### Scenario: Resize callback is cleaned up on destroy
- **WHEN** `renderer.destroy()` is called
- **THEN** the resize callback SHALL be closed alongside the key callback

### Requirement: Testing harness resize SHALL use event path

The `resize(width, height)` helper in the testing harness SHALL call `injectResizeEvent` on the native renderer instead of calling `resizeRenderer` directly, ensuring tests exercise the same codepath as real terminal resize.

#### Scenario: Test resize goes through event chain
- **WHEN** `testHarness.resize(80, 24)` is called
- **THEN** the resize callback SHALL fire
- **AND** buffers SHALL be reallocated
- **AND** a force-render SHALL execute
- **AND** the `"resize"` event SHALL emit to TS subscribers

<!-- Preserved from openspec/specs/typed-event-system/spec.md. -->

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
- **THEN** the handler is stored in the `TypedEmitter` instance
- **AND** `renderer.emit("frame", stats)` dispatches through the `TypedEmitter`

#### Scenario: Public on overloads delegate to TypedEmitter
- **WHEN** `renderer.on("mouse", handler)` is called
- **THEN** it delegates to `this._emitter.on("mouse", handler)`
- **AND** the public overloaded signatures remain unchanged

#### Scenario: Multiple event types with distinct argument types
- **WHEN** `emitter` has events `{ key: [KeyEvent], frame: [RenderStats], resize: [ResizeEvent], mouse: [MouseEvent] }`
- **THEN** each event type has independently typed handler signatures
- **AND** `emit("mouse", renderStats)` produces a compile-time error

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

<!-- Synced from openspec/changes/cleanup-openspec-specs/specs/interaction-system/spec.md. -->

### Requirement: Interaction system contract is consolidated
The interaction system spec SHALL cover keyboard input, mouse input, resize propagation, focus management, hit testing, mouse pointer style, and native callback bridging.

#### Scenario: Future interaction change selects one capability
- **WHEN** a future change modifies input events, focus traversal, mouse behavior, hit grids, resize dispatch, or callback delivery
- **THEN** the change targets `interaction-system` unless it only changes a specific renderable's presentation

### Requirement: Native callbacks and TypeScript events remain aligned
Native input callbacks SHALL be represented as typed TypeScript events without exposing runtime-specific FFI details to consumers.

#### Scenario: Native input event crosses the FFI boundary
- **WHEN** a key, mouse, or resize event is dispatched from native code
- **THEN** TypeScript receives the corresponding typed event shape through the renderer event system

### Requirement: Hit testing and focus cooperate
Mouse hit testing SHALL integrate with focus management for focusable renderables.

#### Scenario: Mouse click targets a focusable renderable
- **WHEN** a click lands on an enabled focusable renderable
- **THEN** focus moves to that renderable before relevant mouse handling completes
