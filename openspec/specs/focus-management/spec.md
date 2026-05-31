# focus-management

Renderer-owned keyboard focus management for TypeScript renderables.

## Requirements

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

### Requirement: Auto focus can select first focusable renderable
The system SHALL use renderer auto-focus behavior to focus the first focusable renderable when appropriate.

#### Scenario: Auto focus enabled
- **WHEN** `RendererOptions.autoFocus` is true and no renderable is focused
- **AND** the renderable tree contains at least one focusable renderable
- **THEN** the first focusable renderable in tree order SHALL be focused before focused key dispatch is needed

#### Scenario: Auto focus disabled
- **WHEN** `RendererOptions.autoFocus` is false
- **THEN** the renderer SHALL NOT automatically focus the first focusable renderable

### Requirement: Focus lifecycle fires in deterministic order
The system SHALL provide focus and blur lifecycle hooks for renderables.

#### Scenario: Focus fires focus hook
- **WHEN** a renderable becomes focused
- **THEN** its focus lifecycle hook SHALL be called once

#### Scenario: Blur fires before next focus
- **WHEN** focus moves from renderable A to renderable B
- **THEN** renderable A's blur lifecycle hook SHALL fire before renderable B's focus lifecycle hook
