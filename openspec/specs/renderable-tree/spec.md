# renderable-tree

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
