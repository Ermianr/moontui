## Purpose

Defines the event polling and callback dispatch module for processing user input events via crossterm.

## Requirements

### Requirement: EventBridge SHALL poll crossterm events

`EventBridge::process_events()` SHALL poll crossterm for key events using a zero-timeout poll. For each non-release `KeyEvent`, it SHALL convert via `input::convert_key_event` and invoke the registered callback.

#### Scenario: Registered callback is invoked on key press
- **WHEN** crossterm reports a `KeyEvent::Char('x')` with no modifiers
- **THEN** the registered `EventCallback` is called with event_type="key", key="x", ctrl=false, shift=false, alt=false

#### Scenario: Release events are ignored
- **WHEN** crossterm reports a `KeyEventKind::Release`
- **THEN** no callback is invoked

### Requirement: EventBridge SHALL manage callback lifecycle

`EventBridge` SHALL store an `Option<EventCallback>` and provide `set_callback()` to set or clear it.

#### Scenario: Setting callback enables event dispatch
- **WHEN** `set_callback(Some(cb))` is called, then `process_events()` receives a key event
- **THEN** `cb` is invoked

#### Scenario: Clearing callback disables event dispatch
- **WHEN** `set_callback(None)` is called, then `process_events()` receives a key event
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
