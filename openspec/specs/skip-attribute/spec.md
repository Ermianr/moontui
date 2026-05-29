## ADDED Requirements

### Requirement: Skip attribute for FFI wrapper exclusion

The system SHALL provide a `#[moontui_skip]` proc-macro attribute that marks methods to be excluded from auto-generated FFI wrapper generation.

#### Scenario: Method with skip attribute is excluded from FFI generation
- **WHEN** a method in a `#[moontui_export]` impl block has the `#[moontui_skip]` attribute
- **THEN** the proc-macro SHALL NOT generate an FFI wrapper for that method

#### Scenario: Method without skip attribute gets FFI wrapper
- **WHEN** a method in a `#[moontui_export]` impl block does NOT have the `#[moontui_skip]` attribute
- **THEN** the proc-macro SHALL generate an FFI wrapper as before

#### Scenario: Skip attribute works on any exported type
- **WHEN** `#[moontui_skip]` is used on methods of any type with `#[moontui_export]`
- **THEN** the skip behavior SHALL be consistent regardless of the type name

### Requirement: Removal of hardcoded skip list

The `should_skip_method` function SHALL be removed from `moontui-macros/src/lib.rs`.

#### Scenario: No central skip list exists
- **WHEN** the refactor is complete
- **THEN** there SHALL be no function that matches on type names or method names to decide skip behavior

#### Scenario: All previously skipped methods use the new attribute
- **WHEN** methods that were in the `should_skip_method` match arms are annotated with `#[moontui_skip]`
- **THEN** they SHALL continue to be excluded from FFI wrapper generation

### Requirement: FFI naming logic preserved

The existing FFI naming convention (type-specific prefixes/suffixes) SHALL remain unchanged.

#### Scenario: CliRenderer naming unchanged
- **WHEN** `#[moontui_export]` processes `CliRenderer` methods
- **THEN** `destroy` and `resize` SHALL still get "Renderer" appended to their FFI names

#### Scenario: OptimizedBuffer naming unchanged
- **WHEN** `#[moontui_export]` processes `OptimizedBuffer` methods
- **THEN** methods SHALL still get "buffer" prefixed to their FFI names
