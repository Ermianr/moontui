# input-renderable

Single-line text input renderable for focused terminal text entry.

## Requirements

### Requirement: Input renderable provides single-line text entry
The system SHALL provide an `InputRenderable` for focused single-line text entry.

#### Scenario: Input is focusable by default
- **WHEN** an `InputRenderable` is created without overriding focus behavior
- **THEN** it SHALL be eligible for renderer focus traversal

#### Scenario: Input stores initial value
- **WHEN** an `InputRenderable` is created with `value: "abc"`
- **THEN** its current value SHALL be `"abc"`
- **AND** its cursor SHALL initially be positioned after the final character

### Requirement: Input helper creates input renderables
The system SHALL provide an `Input(...)` construct helper that creates an `InputRenderable`.

#### Scenario: Input helper returns input renderable
- **WHEN** `Input({ placeholder: "Name" })` is called
- **THEN** it SHALL return an `InputRenderable`

### Requirement: Input renders value and placeholder
The input renderable SHALL draw its value when non-empty and draw placeholder text when empty.

#### Scenario: Non-empty input renders value
- **WHEN** an input has value `"Kevin"`
- **THEN** rendering SHALL draw `"Kevin"` in the input rectangle

#### Scenario: Empty input renders placeholder
- **WHEN** an input has an empty value and placeholder `"Name"`
- **THEN** rendering SHALL draw `"Name"` using placeholder styling

### Requirement: Input handles printable key editing
The input renderable SHALL update its value when focused and printable character keys are received.

#### Scenario: Printable key inserts at cursor
- **WHEN** a focused input with value `"ac"` has cursor after `"a"`
- **AND** key `"b"` is received
- **THEN** the input value SHALL become `"abc"`
- **AND** the cursor SHALL move after `"b"`

#### Scenario: Max length prevents insertion
- **WHEN** a focused input has `maxLength: 3` and value `"abc"`
- **AND** key `"d"` is received
- **THEN** the input value SHALL remain `"abc"`

### Requirement: Input handles deletion and cursor movement
The input renderable SHALL support backspace and horizontal cursor movement.

#### Scenario: Backspace deletes before cursor
- **WHEN** a focused input has value `"abc"` and cursor after `"b"`
- **AND** key `"Backspace"` is received
- **THEN** the input value SHALL become `"ac"`
- **AND** the cursor SHALL move after `"a"`

#### Scenario: ArrowLeft moves cursor left
- **WHEN** a focused input has cursor after the second character
- **AND** key `"ArrowLeft"` is received
- **THEN** the cursor SHALL move one character left

#### Scenario: ArrowRight moves cursor right
- **WHEN** a focused input has cursor before the final character
- **AND** key `"ArrowRight"` is received
- **THEN** the cursor SHALL move one character right

### Requirement: Input emits lifecycle callbacks
The input renderable SHALL emit callbacks for input changes, committed changes, and submit actions.

#### Scenario: onInput fires after edit
- **WHEN** a focused input value changes from a printable key
- **THEN** `onInput` SHALL be called with the updated value

#### Scenario: Enter submits value
- **WHEN** a focused input receives key `"Enter"`
- **THEN** `onSubmit` SHALL be called with the current value

#### Scenario: Enter commits changed value
- **WHEN** a focused input value changed since it gained focus
- **AND** key `"Enter"` is received
- **THEN** `onChange` SHALL be called with the current value

#### Scenario: Blur commits changed value
- **WHEN** a focused input value changed since it gained focus
- **AND** the input loses focus
- **THEN** `onChange` SHALL be called with the current value

### Requirement: Input consumes handled editing keys
The input renderable SHALL prevent handled editing keys from reaching global renderer key listeners.

#### Scenario: Handled printable key is consumed
- **WHEN** a focused input handles printable key `"x"`
- **THEN** the key event SHALL NOT be delivered to global renderer key listeners

#### Scenario: Unhandled key can propagate
- **WHEN** a focused input receives a key it does not handle
- **THEN** the key event SHALL be allowed to reach global renderer key listeners

### Requirement: Focused input controls terminal cursor
The input renderable SHALL position the terminal cursor while focused.

#### Scenario: Focused input sets cursor position
- **WHEN** a focused input renders at computed coordinate `(4, 2)` with cursor offset `3`
- **THEN** the renderer cursor SHALL be visible at `(7, 2)`

#### Scenario: Unfocused input does not set cursor
- **WHEN** an input is not focused
- **THEN** rendering it SHALL NOT make the terminal cursor visible for that input

### Requirement: Input supports focused and unfocused styles
The input renderable SHALL support distinct visual styles for focused and unfocused states.

#### Scenario: Focused background is used while focused
- **WHEN** an input has `focusedBackgroundColor` and is focused
- **THEN** rendering SHALL use the focused background color

#### Scenario: Unfocused background is used while unfocused
- **WHEN** an input has `backgroundColor` and is not focused
- **THEN** rendering SHALL use the background color
