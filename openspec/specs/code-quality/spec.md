# Code Quality

## Purpose

Define tooling and configuration standards to enforce code quality across the MoonTUI codebase (TBD: expand as tooling evolves).

## Requirements

### Requirement: Rust code formatting is enforced
The Rust codebase SHALL conform to the rules defined in `rustfmt.toml`. The command `bun run fmt:rust:check` (which wraps `cargo fmt --all -- --check`) MUST pass with zero diffs.

#### Scenario: Format check passes on formatted code
- **WHEN** `bun run fmt:rust:check` is run on code that already conforms to `rustfmt.toml`
- **THEN** it exits with status 0 and produces no output

#### Scenario: Format check fails on unformatted code
- **WHEN** `bun run fmt:rust:check` is run on code that does not conform to `rustfmt.toml`
- **THEN** it exits with non-zero status and lists the non-conforming files

### Requirement: Rust clippy passes with zero warnings
The Rust codebase MUST pass `bun run lint:rust` (which wraps `cargo clippy --workspace --all-targets -- --deny warnings`) with zero errors and zero warnings. The workspace clippy configuration in `Cargo.toml` SHALL be accurately documented in `AGENTS.md`.

#### Scenario: Clippy passes on clean code
- **WHEN** `bun run lint:rust` is run
- **THEN** it exits with status 0

#### Scenario: AGENTS.md documents actual clippy configuration
- **WHEN** `AGENTS.md` describes the clippy configuration
- **THEN** it SHALL accurately list only the lint groups configured in `Cargo.toml`
- **AND** it SHALL NOT claim `nursery` is configured if it is not present in `[workspace.lints.clippy]`

### Requirement: TypeScript code passes Ultracite check
The TypeScript codebase MUST pass `bun run fmt:ts:check` (which wraps `ultracite check`) with zero errors.

#### Scenario: Ultracite check passes on clean code
- **WHEN** `bun run fmt:ts:check` is run
- **THEN** it exits with status 0

#### Scenario: Ultracite auto-fix resolves fixable issues
- **WHEN** `bun run fmt:ts` is run
- **THEN** fixable errors are resolved and `bun run fmt:ts:check` passes

### Requirement: VS Code is configured for MoonTUI development
The `.vscode/settings.json` MUST configure Biome as the default formatter for TypeScript/JavaScript/JSON files and rust-analyzer for Rust files. The rust-analyzer check command MUST be set to "clippy".

#### Scenario: TypeScript files format with Biome on save
- **WHEN** a TypeScript file is saved in VS Code
- **THEN** it is formatted using `biomejs.biome` as the formatter

#### Scenario: Rust files format with rust-analyzer on save
- **WHEN** a Rust file is saved in VS Code
- **THEN** it is formatted using `rust-lang.rust-analyzer` as the formatter

#### Scenario: rust-analyzer uses clippy for diagnostics
- **WHEN** rust-analyzer checks a Rust file
- **THEN** it uses `clippy` as the check command

### Requirement: Integration tests are decomposed into focused modules
The integration test file SHALL be split from a single `integration_tests.rs` into multiple focused test files in the `tests/` directory.

#### Scenario: Tests are organized by concern
- **WHEN** the `crates/moontui-core/tests/` directory is inspected
- **THEN** it SHALL contain `terminal_tests.rs` for setup/teardown tests
- **AND** it SHALL contain `buffer_tests.rs` for drawing and clear tests
- **AND** it SHALL contain `input_tests.rs` for event callback tests
- **AND** it SHALL contain `render_tests.rs` for diff rendering and stats tests
- **AND** the original `integration_tests.rs` SHALL be removed

#### Scenario: All existing tests pass in new locations
- **WHEN** `cargo test --workspace` is run
- **THEN** all 35 integration tests SHALL pass
- **AND** no tests SHALL be lost in the decomposition

### Requirement: test_helpers.rs pass-through module is removed
The `test_helpers.rs` module SHALL be removed and integration tests SHALL call `CliRenderer` methods directly.

#### Scenario: test_helpers.rs is deleted
- **WHEN** the `crates/moontui-core/src/test_helpers.rs` file is inspected
- **THEN** it SHALL NOT exist
- **AND** the `pub mod test_helpers` declaration in `lib.rs` SHALL be removed

#### Scenario: Integration tests use CliRenderer directly
- **WHEN** integration test files are inspected
- **THEN** they SHALL import `moontui_core::renderer::CliRenderer` instead of `moontui_core::test_helpers::*`
- **AND** they SHALL call `CliRenderer::create_test_renderer()` directly
- **AND** they SHALL call `renderer.get_output_data()` directly instead of `get_captured_output(&renderer)`

### Requirement: Pre-commit hook is listed in PR checklist
The PR template checklist SHALL include a check for verifying that the pre-commit hook ran successfully.

#### Scenario: PR template includes pre-commit check
- **WHEN** a developer creates a new pull request
- **THEN** the PR template checklist SHALL include a check for pre-commit hook validation

### Requirement: PR checklist uses accurate commands
The PR template checklist SHALL list the actual project commands for formatting, linting, and testing.

#### Scenario: PR checklist matches project scripts
- **WHEN** a developer reads the PR template checklist
- **THEN** the checklist SHALL reference `bun run fmt`, `bun run fmt:check`, `bun run lint`, and `bun run test`
