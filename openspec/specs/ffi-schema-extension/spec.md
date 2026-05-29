# ffi-schema-extension

Extended proc-macro schema with manual function TypeScript metadata and struct layout information.

## Purpose

Eliminate hardcoded knowledge in the codegen script by embedding TypeScript function bodies and struct layouts directly in the proc-macro schema JSON.

## Requirements

### Requirement: Schema includes manual function metadata
The proc-macro schema SHALL include additional metadata for `@ffi_manual` functions so the codegen script can generate TypeScript bindings without hardcoded knowledge.

#### Scenario: Manual function has ts_body in schema
- **WHEN** a function annotated with `/// @ffi_manual` is exported
- **THEN** the schema entry SHALL include `"manual": true`
- **AND** the schema entry SHALL include `"ts_body"` containing the TypeScript function body as a string
- **AND** the schema entry SHALL include `"ts_args"` with TypeScript parameter type signatures
- **AND** the schema entry SHALL include `"ts_returns"` with the TypeScript return type

#### Scenario: Manual function schema is valid JSON
- **WHEN** `cargo build` completes with `@ffi_manual` functions present
- **THEN** `target/moontui-schema.json` SHALL contain valid JSON for all manual functions
- **AND** the `ts_body` field SHALL be a parseable TypeScript expression

### Requirement: Schema includes struct layout for FrameStats
The proc-macro schema SHALL include the `FrameStats` struct layout so TypeScript can generate a safe reader.

#### Scenario: FrameStats struct appears in schema
- **WHEN** `FrameStats` is annotated with `#[moontui_export]`
- **THEN** the schema SHALL contain a `structs.FrameStats` entry
- **AND** the entry SHALL include field names, types, offsets, total size, and alignment

#### Scenario: FrameStats fields match Rust definition
- **WHEN** the schema is generated from the current Rust source
- **THEN** the `FrameStats` struct entry SHALL have fields matching the Rust struct definition
- **AND** the `size` field SHALL equal `std::mem::size_of::<FrameStats>()`
