# renderable-tree

## Purpose

TypeScript renderable tree primitives for composing UI elements before drawing into a `MoonBuffer`.

## Overview

The renderable tree provides a renderer-owned root and composable renderable nodes. Renderables draw themselves into a `MoonBuffer`, then render their children in deterministic order using parent-relative coordinates.

## Requirements

### Requirement: Renderable tree provides parent-child composition
The system SHALL provide a TypeScript renderable tree with a base `Renderable` abstraction that supports parent-child composition, deterministic ordering, and rendering into a `MoonBuffer`.

#### Scenario: Child is added to parent
- **WHEN** `parent.add(child)` is called
- **THEN** the child SHALL be included in the parent's child list
- **AND** the child SHALL render when the parent renders

#### Scenario: Children render in insertion order
- **WHEN** multiple children overlap in the same region
- **THEN** children added later SHALL render after children added earlier
- **AND** later children SHALL be able to overwrite earlier output

#### Scenario: Child is removed from parent
- **WHEN** `parent.remove(child)` is called
- **THEN** the child SHALL no longer be included in the parent's child list
- **AND** the child SHALL not render during subsequent parent renders

### Requirement: Root renderable matches renderer dimensions
The system SHALL provide a `RootRenderable` that represents the renderer-owned UI tree and exposes dimensions matching the current renderer size.

#### Scenario: Renderer creates root
- **WHEN** a `CliRenderer` is constructed with width and height
- **THEN** it SHALL expose a `root` renderable
- **AND** `root.width` and `root.height` SHALL match the renderer dimensions

#### Scenario: Renderer resizes root
- **WHEN** the renderer processes a resize event
- **THEN** `root.width` and `root.height` SHALL update to the new renderer dimensions

### Requirement: Renderables use parent-relative coordinates
The system SHALL render each child at coordinates relative to its parent, accumulating ancestor offsets before drawing into the target `MoonBuffer`.

#### Scenario: Nested text renders with accumulated offsets
- **WHEN** a box at `(2, 1)` contains text at `(3, 2)`
- **THEN** the text SHALL draw at absolute buffer coordinate `(5, 3)`

### Requirement: Renderable tree participates in layout before drawing
The system SHALL compute layout for the renderable tree before drawing layout-driven renderables into a `MoonBuffer`.

#### Scenario: Nested layout applies before child render
- **WHEN** a parent renderable lays out a child at computed coordinate `(4, 2)`
- **THEN** the child SHALL render at that computed coordinate
- **AND** children SHALL still render after their parent in deterministic order

#### Scenario: Existing insertion order remains deterministic
- **WHEN** multiple layout-driven children overlap in the same region
- **THEN** children added later SHALL render after children added earlier
- **AND** later children SHALL be able to overwrite earlier output

### Requirement: Tree mutations invalidate layout
The system SHALL mark the renderable tree layout-dirty when child relationships change in a way that can affect layout.

#### Scenario: Adding a child invalidates layout
- **WHEN** `parent.add(child)` is called
- **THEN** the root layout SHALL be marked dirty
- **AND** the next render SHALL recompute layout before drawing

#### Scenario: Removing a child invalidates layout
- **WHEN** `parent.remove(child)` is called
- **THEN** the root layout SHALL be marked dirty
- **AND** the removed child SHALL NOT participate in subsequent layout computation

### Requirement: Layout ordering follows render tree order
The system SHALL use renderable child order as the deterministic order for layout flow and remainder assignment.

#### Scenario: Flex remainder follows child order
- **WHEN** remaining space cannot be evenly divided between flexible siblings
- **THEN** extra cells SHALL be assigned according to deterministic child order

#### Scenario: Reordered children recompute layout
- **WHEN** child order changes through supported tree mutation APIs
- **THEN** the root layout SHALL be marked dirty
- **AND** flow positions SHALL reflect the new order on the next render

### Requirement: Manual coordinates remain usable
The system SHALL preserve existing manual coordinate rendering behavior for renderables that do not opt into layout-driven positioning.

#### Scenario: Existing nested manual text still renders with accumulated offsets
- **WHEN** a box at `(2, 1)` contains text at `(3, 2)` without layout-driven positioning
- **THEN** the text SHALL draw at absolute buffer coordinate `(5, 3)`

### Requirement: TextRenderable draws styled text
The system SHALL provide `TextRenderable` for drawing text content with foreground color, optional background color, and optional text attributes.

#### Scenario: Text renderable draws content
- **WHEN** a `TextRenderable` with content `"Hello"` renders at `(2, 1)`
- **THEN** the target buffer SHALL contain `"Hello"` starting at `(2, 1)`

#### Scenario: Text renderable uses style options
- **WHEN** a `TextRenderable` is created with foreground color, background color, and attributes
- **THEN** rendering SHALL pass those style values to `MoonBuffer.drawText`

### Requirement: BoxRenderable draws rectangular containers
The system SHALL provide `BoxRenderable` for drawing filled rectangles with optional borders and optional title text.

#### Scenario: Box renderable draws border and fill
- **WHEN** a `BoxRenderable` renders with width, height, border color, and background color
- **THEN** it SHALL draw a rectangular region through `MoonBuffer.drawBox`

#### Scenario: Box renderable renders children
- **WHEN** a `BoxRenderable` contains child renderables
- **THEN** it SHALL draw its own box first
- **AND** it SHALL render child renderables after drawing itself

### Requirement: Input renderables participate in the renderable tree
The system SHALL allow input renderables to be composed as children of existing renderables.

#### Scenario: Box contains input
- **WHEN** a `BoxRenderable` contains an `InputRenderable`
- **THEN** the input SHALL render during the box child render pass
- **AND** it SHALL participate in layout like other renderables

### Requirement: Construct helpers create renderables
The system SHALL provide `Text(...)` and `Box(...)` helper functions that create corresponding renderable instances.

#### Scenario: Text helper creates TextRenderable
- **WHEN** `Text({ content: "Hello" })` is called
- **THEN** it SHALL return a `TextRenderable`

#### Scenario: Box helper accepts children
- **WHEN** `Box(options, childA, childB)` is called
- **THEN** it SHALL return a `BoxRenderable`
- **AND** `childA` and `childB` SHALL be added as children in argument order

#### Scenario: Input helper creates InputRenderable
- **WHEN** `Input({ placeholder: "Name" })` is called
- **THEN** it SHALL return an `InputRenderable`

### Requirement: Renderable API is exported publicly
The system SHALL export renderable classes and construct helpers from `@moontui/core`.

#### Scenario: Public import path
- **WHEN** a consumer imports `Renderable`, `RootRenderable`, `TextRenderable`, `BoxRenderable`, `Text`, or `Box` from `@moontui/core`
- **THEN** the symbols SHALL resolve from the package public API

#### Scenario: Public input import path
- **WHEN** a consumer imports `InputRenderable`, `InputRenderableOptions`, or `Input` from `@moontui/core`
- **THEN** those symbols SHALL resolve from the package public API

### Requirement: Renderables expose focus state and lifecycle hooks
The system SHALL allow renderables to opt into focus management and observe focus lifecycle changes.

#### Scenario: Focusable renderable is created
- **WHEN** a renderable is created with `focusable: true`
- **THEN** it SHALL be eligible for renderer focus traversal
- **AND** its initial `focused` state SHALL be false

#### Scenario: Non-focusable renderable is skipped
- **WHEN** a renderable is created without `focusable: true`
- **THEN** it SHALL NOT be eligible for renderer focus traversal

#### Scenario: Focus lifecycle callbacks are configured
- **WHEN** a renderable is created with focus and blur callbacks
- **THEN** the renderer SHALL call those callbacks when the renderable gains or loses focus

### Requirement: Focused renderables can handle key events
The system SHALL allow focused renderables to receive key events through a renderable-level key handler.

#### Scenario: Key handler receives event
- **WHEN** a focusable renderable is focused and has a key handler
- **THEN** the key handler SHALL receive key events routed by the renderer focus manager

#### Scenario: Key handler can stop propagation
- **WHEN** the renderable key handler calls `stopPropagation()` on the key event
- **THEN** the renderer SHALL treat the event as stopped for global key dispatch

### Requirement: Removed focused renderable loses focus
The system SHALL clear or move focus when the currently focused renderable is removed from the renderable tree.

#### Scenario: Focused child is removed
- **WHEN** a focused renderable is removed from its parent
- **THEN** that renderable SHALL no longer be focused
- **AND** the renderer SHALL NOT dispatch future key events to it

### Requirement: Interactive widgets participate in the renderable tree
The system SHALL allow button and checkbox renderables to be composed as children of existing renderables.

#### Scenario: Box contains button
- **WHEN** a `BoxRenderable` contains a `ButtonRenderable`
- **THEN** the button SHALL render during the box child render pass
- **AND** it SHALL participate in layout like other renderables

#### Scenario: Box contains checkbox
- **WHEN** a `BoxRenderable` contains a `CheckboxRenderable`
- **THEN** the checkbox SHALL render during the box child render pass
- **AND** it SHALL participate in layout like other renderables

### Requirement: Interactive widget helpers create renderables
The system SHALL provide `Button(...)` and `Checkbox(...)` helper functions that create corresponding renderable instances.

#### Scenario: Button helper creates ButtonRenderable
- **WHEN** `Button({ label: "Save" })` is called
- **THEN** it SHALL return a `ButtonRenderable`

#### Scenario: Checkbox helper creates CheckboxRenderable
- **WHEN** `Checkbox({ label: "Accept" })` is called
- **THEN** it SHALL return a `CheckboxRenderable`

### Requirement: Interactive widget API is exported publicly
The system SHALL export interactive widget classes, option types, and construct helpers from `@moontui/core`.

#### Scenario: Public button import path
- **WHEN** a consumer imports `ButtonRenderable`, `ButtonRenderableOptions`, or `Button` from `@moontui/core`
- **THEN** those symbols SHALL resolve from the package public API

#### Scenario: Public checkbox import path
- **WHEN** a consumer imports `CheckboxRenderable`, `CheckboxRenderableOptions`, or `Checkbox` from `@moontui/core`
- **THEN** those symbols SHALL resolve from the package public API

<!-- Preserved from openspec/specs/button-renderable/spec.md before narrow widget spec removal. -->

### Requirement: Button renderable provides push-button activation
The system SHALL provide a `ButtonRenderable` for focused push-button actions.

#### Scenario: Button is focusable by default
- **WHEN** a `ButtonRenderable` is created without overriding focus behavior
- **THEN** it SHALL be eligible for renderer focus traversal

#### Scenario: Button stores label
- **WHEN** a `ButtonRenderable` is created with `label: "Save"`
- **THEN** its rendered content SHALL include `"Save"`

### Requirement: Button helper creates button renderables
The system SHALL provide a `Button(...)` construct helper that creates a `ButtonRenderable`.

#### Scenario: Button helper returns button renderable
- **WHEN** `Button({ label: "Save" })` is called
- **THEN** it SHALL return a `ButtonRenderable`

### Requirement: Button renders visual states
The button renderable SHALL render normal, focused, and disabled visual states using its configured style options.

#### Scenario: Focused button uses focused style
- **WHEN** a button has focused style options and is focused
- **THEN** rendering SHALL use the focused style values

#### Scenario: Disabled button uses disabled style
- **WHEN** a button is disabled and has disabled style options
- **THEN** rendering SHALL use the disabled style values

### Requirement: Button activates from keyboard
The button renderable SHALL call `onPress` when focused and activated by keyboard.

#### Scenario: Enter activates button
- **WHEN** a focused button receives key `"Enter"`
- **THEN** `onPress` SHALL be called once
- **AND** the key event SHALL be consumed

#### Scenario: Space activates button
- **WHEN** a focused button receives key `" "`
- **THEN** `onPress` SHALL be called once
- **AND** the key event SHALL be consumed

### Requirement: Button activates from mouse
The button renderable SHALL call `onPress` when left-clicked through the existing mouse dispatch path.

#### Scenario: Left click activates button
- **WHEN** a button receives a left mouse down or click activation event
- **THEN** `onPress` SHALL be called once

### Requirement: Disabled button does not activate
The button renderable SHALL prevent disabled buttons from receiving focus or firing activation callbacks.

#### Scenario: Disabled keyboard activation is ignored
- **WHEN** a disabled button receives keyboard activation
- **THEN** `onPress` SHALL NOT be called

#### Scenario: Disabled mouse activation is ignored
- **WHEN** a disabled button receives mouse activation
- **THEN** `onPress` SHALL NOT be called

### Requirement: Button provides intrinsic measurement
The button renderable SHALL provide intrinsic terminal-cell measurement based on its visible label representation.

#### Scenario: Button intrinsic width is based on label
- **WHEN** a button has no explicit width
- **THEN** layout SHALL receive an intrinsic width large enough to render the button label representation

<!-- Preserved from openspec/specs/checkbox-renderable/spec.md before narrow widget spec removal. -->

### Requirement: Checkbox renderable provides boolean selection
The system SHALL provide a `CheckboxRenderable` for focused boolean selection.

#### Scenario: Checkbox is focusable by default
- **WHEN** a `CheckboxRenderable` is created without overriding focus behavior
- **THEN** it SHALL be eligible for renderer focus traversal

#### Scenario: Checkbox stores checked state
- **WHEN** a `CheckboxRenderable` is created with `checked: true`
- **THEN** its current checked state SHALL be true

### Requirement: Checkbox helper creates checkbox renderables
The system SHALL provide a `Checkbox(...)` construct helper that creates a `CheckboxRenderable`.

#### Scenario: Checkbox helper returns checkbox renderable
- **WHEN** `Checkbox({ label: "Accept" })` is called
- **THEN** it SHALL return a `CheckboxRenderable`

### Requirement: Checkbox renders checked and unchecked states
The checkbox renderable SHALL render a stable terminal marker and label for checked and unchecked states.

#### Scenario: Unchecked checkbox renders unchecked marker
- **WHEN** a checkbox is unchecked with label `"Accept"`
- **THEN** rendering SHALL include `"[ ] Accept"`

#### Scenario: Checked checkbox renders checked marker
- **WHEN** a checkbox is checked with label `"Accept"`
- **THEN** rendering SHALL include `"[x] Accept"`

### Requirement: Checkbox renders visual states
The checkbox renderable SHALL render normal, focused, and disabled visual states using its configured style options.

#### Scenario: Focused checkbox uses focused style
- **WHEN** a checkbox has focused style options and is focused
- **THEN** rendering SHALL use the focused style values

#### Scenario: Disabled checkbox uses disabled style
- **WHEN** a checkbox is disabled and has disabled style options
- **THEN** rendering SHALL use the disabled style values

### Requirement: Checkbox toggles from keyboard
The checkbox renderable SHALL toggle checked state when focused and activated by keyboard.

#### Scenario: Enter toggles checkbox
- **WHEN** a focused unchecked checkbox receives key `"Enter"`
- **THEN** checked state SHALL become true
- **AND** `onChange` SHALL be called with true
- **AND** the key event SHALL be consumed

#### Scenario: Space toggles checkbox
- **WHEN** a focused checked checkbox receives key `" "`
- **THEN** checked state SHALL become false
- **AND** `onChange` SHALL be called with false
- **AND** the key event SHALL be consumed

### Requirement: Checkbox toggles from mouse
The checkbox renderable SHALL toggle checked state when left-clicked through the existing mouse dispatch path.

#### Scenario: Left click toggles checkbox
- **WHEN** an unchecked checkbox receives a left mouse down or click activation event
- **THEN** checked state SHALL become true
- **AND** `onChange` SHALL be called with true

### Requirement: Disabled checkbox does not toggle
The checkbox renderable SHALL prevent disabled checkboxes from receiving focus or changing checked state.

#### Scenario: Disabled keyboard toggle is ignored
- **WHEN** a disabled unchecked checkbox receives keyboard activation
- **THEN** checked state SHALL remain false
- **AND** `onChange` SHALL NOT be called

#### Scenario: Disabled mouse toggle is ignored
- **WHEN** a disabled unchecked checkbox receives mouse activation
- **THEN** checked state SHALL remain false
- **AND** `onChange` SHALL NOT be called

### Requirement: Checkbox provides intrinsic measurement
The checkbox renderable SHALL provide intrinsic terminal-cell measurement based on marker plus label.

#### Scenario: Checkbox intrinsic width includes marker and label
- **WHEN** a checkbox has no explicit width and label `"Accept"`
- **THEN** layout SHALL receive intrinsic width for the marker, separating space, and label

<!-- Preserved from openspec/specs/input-renderable/spec.md before narrow widget spec removal. -->

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

<!-- Synced from openspec/changes/cleanup-openspec-specs/specs/renderable-tree/spec.md. -->

### Requirement: Interactive renderables belong to the renderable tree contract
Renderable-specific behavior for Button, Checkbox, and Input SHALL be captured under the renderable tree capability when the behavior concerns tree rendering, layout, focusability, or activation.

#### Scenario: Widget renderable spec is consolidated
- **WHEN** button, checkbox, or input renderable specs are removed or merged
- **THEN** their live normative behavior remains represented under the renderable tree contract

### Requirement: Widget-specific behavior remains testable
Interactive renderable requirements SHALL keep keyboard activation, mouse activation, disabled state behavior, and text input behavior testable.

#### Scenario: Interactive widget behavior changes
- **WHEN** a widget interaction behavior changes
- **THEN** the renderable tree or interaction system spec includes a scenario that can be tested through the harness
