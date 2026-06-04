# layout-engine-boundary

## Purpose

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

### Requirement: Native custom is the default production backend
The system SHALL use native custom layout as the default production backend.

#### Scenario: Renderer uses default backend
- **WHEN** renderer layout computes without an explicit internal override
- **THEN** it SHALL route through native custom layout

### Requirement: Future backend proposals satisfy the same contract
Any future layout backend SHALL require a new accepted proposal and SHALL satisfy the same layout snapshots, dirty invalidation rules, and benchmark scenarios as native custom before it can become an active candidate.

#### Scenario: Experimental backend parity
- **WHEN** an experimental backend is run against the layout contract fixtures
- **THEN** it SHALL produce the same computed rectangles as the default backend for supported props

#### Scenario: Backend benchmark includes synchronization cost
- **WHEN** backend performance is benchmarked
- **THEN** the benchmark SHALL include tree synchronization, layout computation, and computed rectangle propagation costs

### Requirement: Layout boundary keeps only internal fallback selection
The internal layout engine boundary SHALL support selecting the TypeScript fallback for tests and debugging without changing public renderable APIs.

#### Scenario: Internal backend selector chooses TypeScript fallback
- **WHEN** internal test or debug setup selects the TypeScript fallback backend
- **THEN** root layout computation SHALL route through the TypeScript backend

#### Scenario: Public API hides backend selector
- **WHEN** a normal consumer imports `@moontui/core`
- **THEN** no public backend-specific selector SHALL be required to use layout

### Requirement: Layout boundary applies backend rectangles to renderables
The internal layout engine boundary SHALL apply computed rectangles from any backend to renderables through the same cached layout rectangle mechanism.

#### Scenario: Native custom rectangles populate computed layout
- **WHEN** the native custom backend returns computed rectangles
- **THEN** each corresponding renderable SHALL receive a cached computed layout rectangle
- **AND** render methods SHALL read those cached rectangles the same way they do for the TypeScript backend

### Requirement: Layout boundary defines default backend selection
The internal layout engine boundary SHALL define which backend is used by default and which backend is available as fallback.

#### Scenario: Default backend is read through boundary
- **WHEN** the renderer computes layout without explicit backend override
- **THEN** it SHALL use the backend designated as the current default by the layout boundary

#### Scenario: Fallback backend remains selectable internally
- **WHEN** tests or debug code select the TypeScript fallback backend
- **THEN** the layout boundary SHALL route layout through the TypeScript backend

### Requirement: Layout boundary preserves backend-neutral rectangles
Default backend promotion SHALL NOT change how renderables consume computed rectangles.

#### Scenario: Native custom default still writes cached rectangles
- **WHEN** native custom layout is the default backend
- **THEN** renderables SHALL still receive cached computed layout rectangles through the existing mechanism
- **AND** render methods SHALL remain backend-neutral

### Requirement: Layout boundary identifies native custom as default
The internal layout engine boundary SHALL identify native custom layout as the default backend.

#### Scenario: Native custom is default
- **WHEN** native custom layout has been promoted and the renderer computes layout without an explicit backend override
- **THEN** layout computation SHALL route through the native custom backend
- **AND** renderables SHALL receive cached computed rectangles through the same backend-neutral mechanism

#### Scenario: TypeScript remains internal fallback
- **WHEN** native custom layout is the default backend and tests or debug code select the TypeScript fallback backend
- **THEN** the layout boundary SHALL route layout through the TypeScript backend

### Requirement: Layout boundary names backends unambiguously
The internal layout engine boundary SHALL distinguish native custom production and TypeScript fallback identities.

#### Scenario: TypeScript fallback is selected
- **WHEN** internal code selects the TypeScript layout backend
- **THEN** backend names and test labels SHALL identify it as TypeScript fallback or oracle

#### Scenario: Native custom backend is selected
- **WHEN** internal code selects the current native custom layout backend
- **THEN** backend names and test labels SHALL identify it as native custom

#### Scenario: Inactive backends are absent
- **WHEN** backend identities are enumerated
- **THEN** the layout boundary SHALL NOT expose Yoga or Taffy as available backend identities

### Requirement: Backend identity normalization preserves public API neutrality
Backend identity normalization SHALL NOT require public users to import backend-specific node types or engine selectors.

#### Scenario: Consumer creates renderables
- **WHEN** user code creates renderables with supported layout props
- **THEN** no native custom or Taffy-specific public import SHALL be required

### Requirement: Layout boundary routes native custom through native custom FFI
The internal layout engine boundary SHALL route native custom layout computation through native custom-named FFI bindings.

#### Scenario: Native custom backend selected
- **WHEN** the renderer or test harness selects the native custom backend
- **THEN** layout computation SHALL call the native custom FFI binding
- **AND** backend-neutral computed rectangles SHALL still be applied through the existing cached layout mechanism

#### Scenario: TypeScript backend selected
- **WHEN** the TypeScript backend is selected
- **THEN** layout computation SHALL remain in TypeScript and SHALL NOT require the native custom FFI binding

### Requirement: Layout boundary excludes retired Taffy backend
The internal layout engine boundary SHALL exclude real Taffy from active backend selection after Taffy retirement.

#### Scenario: Backend cases are enumerated after Taffy removal
- **WHEN** internal backend cases are enumerated
- **THEN** they SHALL include native custom and TypeScript fallback
- **AND** they SHALL NOT include Taffy

#### Scenario: Renderer computes default layout
- **WHEN** renderer layout computes without explicit backend override
- **THEN** it SHALL use native custom layout

### Requirement: Layout boundary excludes inactive Yoga backend
The internal layout engine boundary SHALL exclude Yoga from active backend selection unless a future accepted proposal reopens Yoga evaluation.

#### Scenario: Backend cases are enumerated
- **WHEN** tests or benchmarks enumerate active layout backend cases
- **THEN** Yoga SHALL NOT appear

### Requirement: Layout boundary supports incremental backend lifecycle
The internal layout engine boundary SHALL support backend lifecycle operations required by persistent layout engines without exposing backend-specific public APIs.

#### Scenario: Renderable is added
- **WHEN** a renderable is added to a parent under a persistent backend
- **THEN** the backend SHALL be able to create or attach persistent layout state for that renderable
- **AND** public users SHALL NOT need to pass backend-specific node objects

#### Scenario: Renderable layout props change
- **WHEN** a renderable's layout props change under an incremental backend
- **THEN** the backend SHALL be able to synchronize only the affected style state and required ancestors

#### Scenario: Renderable is removed
- **WHEN** a renderable is removed or destroyed under a persistent backend
- **THEN** the backend SHALL be able to detach and free persistent layout state for that renderable exactly once

### Requirement: Layout boundary exposes internal instrumentation
The internal layout engine boundary SHALL allow benchmark-only instrumentation of synchronization work without changing public renderable APIs.

#### Scenario: Benchmark requests instrumentation
- **WHEN** the benchmark harness runs an instrumented backend
- **THEN** the backend MAY report touched nodes, style updates, relationship updates, compute calls, readback count, and rectangle applications
- **AND** those counters SHALL remain internal test or benchmark data

### Requirement: Layout boundary has no retired backend runtime path
The layout boundary SHALL NOT include runtime selection, exports, or backend cases for retired Taffy or inactive Yoga backends.

#### Scenario: Backend cases after cleanup
- **WHEN** internal backend cases are enumerated
- **THEN** they SHALL include native custom production behavior
- **AND** they SHALL include TypeScript fallback/oracle behavior when fallback/oracle coverage is requested
- **AND** they SHALL NOT include Taffy or Yoga

#### Scenario: Public imports after cleanup
- **WHEN** consumers import public layout and renderable APIs
- **THEN** they SHALL NOT need to import backend-specific Taffy or Yoga node types

### Requirement: TypeScript layout remains internal fallback oracle
The layout boundary SHALL identify TypeScript layout as an internal fallback/test oracle rather than an active production backend candidate.

#### Scenario: Fallback backend identity
- **WHEN** tests or benchmarks include the TypeScript layout engine
- **THEN** the backend identity SHALL communicate fallback/oracle status
- **AND** it SHALL NOT be presented as a production promotion candidate

<!-- Synced from openspec/changes/cleanup-openspec-specs/specs/layout-engine-boundary/spec.md. -->

### Requirement: Active layout backend decision is explicit
The layout engine boundary SHALL state that native custom layout is the active default backend and TypeScript fallback remains the oracle/fallback for parity checks.

#### Scenario: Historical backend specs are retired
- **WHEN** Taffy, Yoga, or promotion-era layout specs are removed
- **THEN** the layout engine boundary still records the active backend and fallback/oracle decision

### Requirement: Inactive layout backend work requires a new proposal
Reintroducing an inactive layout backend SHALL require a new OpenSpec change.

#### Scenario: Future Taffy or Yoga request
- **WHEN** future work proposes Taffy, Yoga, or another inactive backend
- **THEN** the work starts as a new proposal rather than modifying the cleaned catalog implicitly
