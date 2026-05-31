# Agent Guidelines

## Purpose

Define repository-level agent operating rules for MoonTUI.

## Requirements

### Requirement: Agent guidelines remain compact and authoritative
`AGENTS.md` SHALL define the repository's agent-facing operating rules in a compact form that prioritizes high-risk workflows over broad style guidance.

#### Scenario: Guidelines avoid repeated command blocks
- **WHEN** `AGENTS.md` documents validation commands
- **THEN** it SHALL avoid duplicating the same command list across multiple sections
- **AND** it SHALL group verification guidance by change type when possible

#### Scenario: Guidelines preserve strong rules
- **WHEN** `AGENTS.md` is shortened
- **THEN** it SHALL still include mandatory rules for generated files, FFI safety, native rebuilds, runtime portability, and evidence-backed codebase claims

### Requirement: Agent guidelines are evidence-aligned
Every strong claim in `AGENTS.md` about repository behavior SHALL match the current repository configuration or source files.

#### Scenario: Strong rule references actual project behavior
- **WHEN** `AGENTS.md` states that a command, generated file, lint rule, native workflow, or runtime support level exists
- **THEN** that statement SHALL be traceable to a repository file such as `package.json`, `Cargo.toml`, `rustfmt.toml`, `packages/core/scripts/build.ts`, generated file headers, or platform facade code

#### Scenario: Unsupported claim is avoided
- **WHEN** evidence for a repository behavior cannot be produced
- **THEN** `AGENTS.md` SHALL avoid presenting that behavior as fact
- **AND** it SHALL use scoped or conditional wording instead

### Requirement: Agent guidelines define change-area verification
`AGENTS.md` SHALL tell agents which verification commands to run based on the files or subsystem changed.

#### Scenario: Rust change verification
- **WHEN** an agent changes Rust source under `crates/`
- **THEN** `AGENTS.md` SHALL direct the agent to run Rust formatting, linting, and tests
- **AND** it SHALL include the native rebuild requirement when `crates/moontui-core/` changes

#### Scenario: TypeScript change verification
- **WHEN** an agent changes TypeScript source under `packages/core/src/`
- **THEN** `AGENTS.md` SHALL direct the agent to run TypeScript formatting, linting, tests, and typecheck through Bun scripts

#### Scenario: FFI change verification
- **WHEN** an agent changes the Rust/TypeScript FFI boundary
- **THEN** `AGENTS.md` SHALL direct the agent to regenerate bindings through the schema/codegen workflow instead of editing generated files manually
