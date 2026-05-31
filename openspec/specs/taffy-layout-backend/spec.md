# taffy-layout-backend

Experimental Rust/Taffy layout backend for evaluating backend parity and end-to-end layout performance.

## Requirements

### Requirement: Taffy backend is experimental
The system SHALL provide a Rust/Taffy layout backend as an experimental backend that is not selected by default.

#### Scenario: Default backend remains TypeScript
- **WHEN** a renderer is created without internal backend selection
- **THEN** layout SHALL use the existing TypeScript backend
- **AND** Taffy SHALL NOT become the default in this change

#### Scenario: Experimental backend can be selected for tests
- **WHEN** a test or benchmark explicitly selects the Taffy backend through internal configuration
- **THEN** layout SHALL be computed through the Taffy backend

### Requirement: Taffy backend preserves public layout API
The Taffy backend SHALL consume existing engine-neutral renderable layout props without requiring public API changes.

#### Scenario: Consumer layout props remain unchanged
- **WHEN** user code creates renderables with supported `LayoutProps`
- **THEN** the same public props SHALL work with the TypeScript backend and the Taffy backend
- **AND** user code SHALL NOT import `taffy` types

### Requirement: Taffy backend computes layout through batch native calls
The Taffy backend SHALL compute layout using batched FFI input and output rather than one FFI call per renderable.

#### Scenario: Layout tree is sent in batches
- **WHEN** the Taffy backend computes layout for a renderable tree
- **THEN** it SHALL send flattened node, relationship, style, and measurement data to native code in batch form

#### Scenario: Rectangles are returned in batches
- **WHEN** native Taffy layout computation completes
- **THEN** computed rectangles SHALL be returned to TypeScript in batch form
- **AND** TypeScript SHALL apply those rectangles to the corresponding renderables

### Requirement: Taffy backend has parity gates
The Taffy backend SHALL pass layout contract fixtures for supported props before it can be considered for default selection.

#### Scenario: Supported fixture parity
- **WHEN** a layout contract fixture runs against both TypeScript and Taffy backends
- **THEN** both backends SHALL produce the same expected public computed rectangles

#### Scenario: Known difference is documented
- **WHEN** Taffy produces a different result for a supported fixture
- **THEN** the difference SHALL either be normalized or documented as a blocker to default selection

### Requirement: Taffy backend benchmarks measure total cost
The Taffy backend SHALL be benchmarked using end-to-end layout backend cost.

#### Scenario: Benchmark includes full backend path
- **WHEN** Taffy backend benchmarks run
- **THEN** measured time SHALL include TypeScript tree flattening, FFI transfer, native Taffy computation, FFI result transfer, and rectangle application

#### Scenario: Benchmark compares TypeScript backend
- **WHEN** Taffy benchmark results are reported
- **THEN** comparable TypeScript backend results SHALL be reported for the same fixture
