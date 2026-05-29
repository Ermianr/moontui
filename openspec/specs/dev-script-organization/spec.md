# Dev Script Organization

## Purpose

Define the naming conventions and structure for root-level npm scripts to ensure discoverability, consistency, and clear separation of concerns across build, test, format, and lint operations.

## Requirements

### Requirement: Root scripts use prefix-grouped naming
The root `package.json` scripts SHALL use the `group:target` naming convention where `group` is one of `build`, `test`, `fmt`, `lint` and `target` is `rust`, `ts`, or omitted for combined operations.

#### Scenario: Build commands follow naming convention
- **WHEN** `bun run` lists available scripts from the root
- **THEN** build-related scripts SHALL be named `build`, `build:rust`, `build:ts`, `build:native`, `build:codegen`
- **AND** no build script SHALL use a name that does not start with `build`

#### Scenario: Test commands follow naming convention
- **WHEN** `bun run` lists available scripts from the root
- **THEN** test-related scripts SHALL be named `test`, `test:rust`, `test:ts`
- **AND** no test script SHALL use a name that does not start with `test`

#### Scenario: Format commands follow naming convention
- **WHEN** `bun run` lists available scripts from the root
- **THEN** format-related scripts SHALL be named `fmt`, `fmt:check`, `fmt:rust`, `fmt:rust:check`, `fmt:ts`, `fmt:ts:check`
- **AND** no format script SHALL use a name that does not start with `fmt`

#### Scenario: Lint commands follow naming convention
- **WHEN** `bun run` lists available scripts from the root
- **THEN** lint-related scripts SHALL be named `lint`, `lint:rust`, `lint:ts`
- **AND** no lint script SHALL use a name that does not start with `lint`

### Requirement: Each individual tool is directly accessible
Every individual linting, formatting, and testing tool SHALL be accessible via a dedicated script without running unrelated checks.

#### Scenario: TypeScript lint can be run alone
- **WHEN** `bun run lint:ts` is executed
- **THEN** only TypeScript linting (ultracite check) SHALL run
- **AND** Rust clippy SHALL NOT execute

#### Scenario: Rust tests can be run alone
- **WHEN** `bun run test:rust` is executed
- **AND** only Rust tests (cargo test) SHALL run
- **AND** TypeScript tests SHALL NOT execute

#### Scenario: TypeScript format check can be run alone
- **WHEN** `bun run fmt:ts:check` is executed
- **THEN** only TypeScript format checking (ultracite check) SHALL run
- **AND** Rust format checking SHALL NOT execute

### Requirement: CI gate command exists
A `check` script SHALL exist that runs all formatting checks and all linting, serving as the single "does everything pass" command for CI.

#### Scenario: CI gate runs all checks
- **WHEN** `bun run check` is executed
- **THEN** it SHALL run `fmt:check` (Rust format check + TS format check)
- **AND** it SHALL run `lint` (Rust clippy + TS lint)
- **AND** all checks MUST pass for the command to exit with status 0

### Requirement: Clean command exists
A `clean` script SHALL exist that removes build artifacts.

#### Scenario: Clean removes build artifacts
- **WHEN** `bun run clean` is executed
- **THEN** it SHALL remove `target/` directory (Rust build artifacts)
- **AND** it SHALL remove `packages/core/dist/` directory (TS build output)
- **AND** it SHALL remove `packages/core/native/` directory (native binaries)

### Requirement: No mixed-concern mega-commands
No script SHALL combine Rust and TS operations in a way that blocks visibility into downstream failures.

#### Scenario: Test script runs both but shows all results
- **WHEN** `bun run test` is executed
- **THEN** it SHALL run both `test:rust` and `test:ts`
- **AND** if `test:rust` fails, `test:ts` SHALL still execute
- **AND** the final exit code SHALL reflect whether any sub-test failed

### Requirement: build:codegen uses consistent delegation
The `build:codegen` script SHALL use the same `--cwd` delegation pattern as other `build:*` scripts, or SHALL be documented as an exception with rationale.

#### Scenario: build:codegen follows pattern
- **WHEN** `bun run build:codegen` is executed
- **THEN** it SHALL either use `--cwd packages/core` delegation
- **OR** it SHALL be a root-level script that is documented in AGENTS.md as a root-level exception
