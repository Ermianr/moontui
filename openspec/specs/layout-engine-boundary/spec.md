# layout-engine-boundary

Internal layout engine boundary for computing renderable layout while keeping public APIs backend-neutral.

## Requirements

### Requirement: Layout computation uses an internal engine boundary
The system SHALL route renderable layout computation through an internal layout engine boundary rather than exposing a specific layout engine through the public API.

#### Scenario: Renderer invokes layout through boundary
- **WHEN** the renderer needs to compute layout for the root renderable
- **THEN** it SHALL call the configured internal layout engine
- **AND** renderables SHALL receive cached computed rectangles independent of the backend implementation

#### Scenario: Public API remains engine-neutral
- **WHEN** a consumer creates renderables with layout props
- **THEN** the consumer SHALL NOT need to import Yoga, Taffy, or any backend-specific node type

### Requirement: Current layout behavior remains the default backend
The system SHALL keep the current TypeScript layout behavior as the default backend while the layout contract is finalized.

#### Scenario: Existing layout tests use default backend
- **WHEN** existing renderable layout tests run without selecting a backend
- **THEN** they SHALL execute against the default TypeScript layout backend
- **AND** their expected computed rectangles SHALL remain valid unless explicitly changed by this contract

### Requirement: Future backends satisfy the same contract
Any future layout backend, including a Rust/Taffy backend, SHALL satisfy the same layout snapshots, dirty invalidation rules, and benchmark scenarios as the default backend before it can become the default.

#### Scenario: Experimental backend parity
- **WHEN** an experimental backend is run against the layout contract fixtures
- **THEN** it SHALL produce the same computed rectangles as the default backend for supported props

#### Scenario: Backend benchmark includes synchronization cost
- **WHEN** backend performance is benchmarked
- **THEN** the benchmark SHALL include tree synchronization, layout computation, and computed rectangle propagation costs

### Requirement: Layout boundary supports experimental backend selection
The internal layout engine boundary SHALL support selecting the Taffy backend for tests and benchmarks without changing public renderable APIs.

#### Scenario: Internal backend selector chooses Taffy
- **WHEN** internal test or benchmark setup selects the Taffy layout backend
- **THEN** root layout computation SHALL route through the Taffy backend

#### Scenario: Public API hides backend selector
- **WHEN** a normal consumer imports `@moontui/core`
- **THEN** no public Taffy-specific backend selector SHALL be required to use layout

### Requirement: Layout boundary applies backend rectangles to renderables
The internal layout engine boundary SHALL apply computed rectangles from any backend to renderables through the same cached layout rectangle mechanism.

#### Scenario: Taffy rectangles populate computed layout
- **WHEN** the Taffy backend returns computed rectangles
- **THEN** each corresponding renderable SHALL receive a cached computed layout rectangle
- **AND** render methods SHALL read those cached rectangles the same way they do for the TypeScript backend
