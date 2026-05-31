# renderable-layout

Declarative layout behavior for TypeScript renderables before drawing into a `MoonBuffer`.

## Requirements

### Requirement: Renderables accept declarative layout props
The system SHALL allow TypeScript renderables to declare layout behavior through engine-agnostic layout props.

#### Scenario: Renderable is created with layout props
- **WHEN** a renderable is created with `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `flexDirection`, `flexGrow`, `flexShrink`, `flexBasis`, `alignItems`, `alignSelf`, `justifyContent`, `display`, `padding`, `margin`, `gap`, `position`, `left`, `right`, `top`, or `bottom`
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

### Requirement: Layout contract defines supported prop semantics
The system SHALL define deterministic terminal-cell semantics for each supported layout prop before a backend can claim support for it.

#### Scenario: Unsupported layout prop is absent from public contract
- **WHEN** a layout behavior has no documented requirement and test fixture
- **THEN** it SHALL NOT be exposed as a supported public layout prop

#### Scenario: Supported layout prop has fixture coverage
- **WHEN** a layout prop is included in `LayoutProps`
- **THEN** at least one contract test SHALL verify its computed rectangle behavior

### Requirement: Intrinsic measurement participates in layout
The system SHALL allow renderables with natural content size to provide intrinsic measurements to the layout engine.

#### Scenario: Text measures terminal cell width
- **WHEN** a text renderable has no explicit width
- **THEN** its intrinsic width SHALL be based on terminal cell width for its content
- **AND** it SHALL NOT rely only on JavaScript string length

#### Scenario: Input measures value and placeholder
- **WHEN** an input renderable has no explicit width
- **THEN** its intrinsic width SHALL be based on the greater terminal cell width of its value and placeholder

### Requirement: Geometry-affecting changes invalidate layout
The system SHALL mark layout dirty when renderable state changes can alter computed rectangles.

#### Scenario: Text content changes intrinsic size
- **WHEN** a text renderable's content changes and its width or height depends on intrinsic measurement
- **THEN** the renderable tree SHALL be marked layout-dirty

#### Scenario: Input content changes intrinsic size
- **WHEN** an input renderable's value or placeholder changes and its width depends on intrinsic measurement
- **THEN** the renderable tree SHALL be marked layout-dirty

#### Scenario: Style-only change preserves clean layout
- **WHEN** a renderable changes color, focus state, or text attributes without changing geometry
- **THEN** the renderable tree SHALL NOT be marked layout-dirty solely because of that change

### Requirement: Display none removes layout and rendering participation
The system SHALL support `display: "none"` for renderables that should not participate in layout or rendering.

#### Scenario: Hidden child consumes no layout space
- **WHEN** a flow child has `display: "none"`
- **THEN** it SHALL receive no visible computed rectangle
- **AND** sibling layout SHALL be computed as if the hidden child were absent

#### Scenario: Hidden child does not render
- **WHEN** a renderable has `display: "none"`
- **THEN** it SHALL NOT draw itself or its children during the render pass

### Requirement: Layout fixtures define backend parity
The system SHALL maintain deterministic layout fixtures that define expected computed rectangles for supported layout behavior.

#### Scenario: Contract fixture captures computed rectangles
- **WHEN** a layout fixture is executed
- **THEN** it SHALL assert the `x`, `y`, `width`, and `height` of relevant renderables

#### Scenario: Clean frame reuses cached rectangles
- **WHEN** no geometry-affecting input has changed since the previous render
- **THEN** layout fixture execution SHALL verify that recomputation is skipped where observable by the test harness
