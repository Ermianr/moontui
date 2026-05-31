# renderable-layout

Declarative layout behavior for TypeScript renderables before drawing into a `MoonBuffer`.

## Requirements

### Requirement: Renderables accept declarative layout props
The system SHALL allow TypeScript renderables to declare layout behavior through engine-agnostic layout props.

#### Scenario: Renderable is created with layout props
- **WHEN** a renderable is created with `width`, `height`, `flexDirection`, `flexGrow`, `padding`, `margin`, or `gap`
- **THEN** those values SHALL be stored as layout props on the renderable
- **AND** no external layout engine type SHALL be exposed through the public API

#### Scenario: Layout prop changes mark layout dirty
- **WHEN** a renderable layout prop changes after creation
- **THEN** the renderable tree SHALL be marked layout-dirty
- **AND** the next render SHALL recompute layout before drawing

### Requirement: Layout pass computes cached rectangles
The system SHALL compute a cached layout rectangle for each visible renderable before drawing layout-driven output.

#### Scenario: Root computes child layout
- **WHEN** the root layout is computed for an 80 by 24 terminal
- **THEN** each child renderable SHALL receive a computed rectangle with `x`, `y`, `width`, and `height`
- **AND** render methods SHALL read those computed values instead of recalculating layout

#### Scenario: Static frame skips layout recomputation
- **WHEN** no layout props, tree structure, or renderer dimensions changed since the previous render
- **THEN** the renderer SHALL reuse cached computed rectangles

### Requirement: Column layout distributes vertical space
The system SHALL support column layout for stacking children vertically inside a parent rectangle.

#### Scenario: Fixed header and flexible body
- **WHEN** a column container with height 10 contains a child with height 2 and a child with `flexGrow: 1`
- **THEN** the fixed child SHALL receive height 2
- **AND** the flexible child SHALL receive the remaining height

### Requirement: Row layout distributes horizontal space
The system SHALL support row layout for placing children horizontally inside a parent rectangle.

#### Scenario: Fixed sidebar and flexible content
- **WHEN** a row container with width 40 contains a child with width 10 and a child with `flexGrow: 1`
- **THEN** the fixed child SHALL receive width 10
- **AND** the flexible child SHALL receive the remaining width

### Requirement: Layout supports padding, margin, and gap
The system SHALL account for padding, margin, and gap when computing child rectangles.

#### Scenario: Padding offsets children
- **WHEN** a container at `(0, 0)` has `padding: 1`
- **THEN** its layout children SHALL be positioned inside the inset content area

#### Scenario: Gap separates children
- **WHEN** a column container has `gap: 1` and two children
- **THEN** the second child SHALL be positioned one row after the first child ends

### Requirement: Layout supports fixed and percentage dimensions
The system SHALL support numeric fixed dimensions and percentage dimensions for renderable width and height.

#### Scenario: Percentage width resolves against parent
- **WHEN** a child has `width: "50%"` inside a parent with width 40
- **THEN** the child computed width SHALL be 20

### Requirement: Layout supports absolute positioning
The system SHALL support absolute positioning for renderables that should be placed relative to their parent instead of participating in normal row or column flow.

#### Scenario: Absolute child does not consume flow space
- **WHEN** a container has an absolute child and a normal flow child
- **THEN** the absolute child SHALL be positioned from its parent edges
- **AND** the normal flow child SHALL be laid out as if the absolute child did not consume row or column space

### Requirement: Layout engine uses deterministic integer rounding
The system SHALL produce deterministic integer terminal coordinates and dimensions for all computed layout rectangles.

#### Scenario: Flex remainder is assigned deterministically
- **WHEN** remaining space cannot be divided evenly among flexible children
- **THEN** the extra cells SHALL be assigned in a deterministic order
- **AND** repeated renders with the same inputs SHALL produce identical rectangles
