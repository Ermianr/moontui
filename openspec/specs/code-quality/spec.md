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

### Requirement: Integration tests use correct unsafe allowances
Integration test files SHALL only include `#![allow(unsafe_code)]` when they actually contain `unsafe` blocks. Files that do not use `unsafe` SHALL NOT have this attribute.

#### Scenario: Test files without unsafe do not have allow attribute
- **WHEN** `tests/terminal_tests.rs`, `tests/resize_tests.rs`, or `tests/render_tests.rs` is inspected
- **THEN** it SHALL NOT contain `#![allow(unsafe_code)]`

#### Scenario: Test files with unsafe retain allow attribute
- **WHEN** `tests/buffer_tests.rs` or `tests/input_tests.rs` is inspected
- **THEN** they SHALL retain `#![allow(unsafe_code)]` because they contain `unsafe` blocks

### Requirement: Test files clean up native resources
All test files that create `CliRenderer` instances via FFI SHALL call `destroyRenderer` to clean up native resources.

#### Scenario: buffer.test.ts destroys renderer in every test
- **WHEN** `packages/core/src/buffer.test.ts` is inspected
- **THEN** every test that creates a renderer SHALL call `api.renderer.destroyRenderer(rendererPtr)` before the test ends

### Requirement: Inverse mapping functions are co-located with forward mappings
The `mouse.ts` module SHALL export `buttonToNative(button: MouseButton): number` and `scrollDirectionToNative(direction: ScrollDirection): number` alongside their forward counterparts `buttonFromNative` and `scrollDirectionFromNative`. The `testing/index.ts` module SHALL import these functions instead of defining local duplicates.

#### Scenario: mouse.ts exports inverse functions
- **WHEN** `packages/core/src/mouse.ts` is inspected
- **THEN** it SHALL export `buttonToNative` and `scrollDirectionToNative`

#### Scenario: testing/index.ts imports from mouse.ts
- **WHEN** `packages/core/src/testing/index.ts` is inspected
- **THEN** it SHALL import `buttonToNative` and `scrollDirectionToNative` from `../mouse`
- **AND** it SHALL NOT contain local `buttonToNative` or `scrollDirToNative` function definitions

### Requirement: ansi.rs deduplicates write_fg/write_bg
The `ansi.rs` module SHALL use a shared private `write_color()` helper for foreground and background color writing, with `write_fg` and `write_bg` delegating to it.

#### Scenario: write_fg and write_bg delegate to write_color
- **WHEN** `crates/moontui-core/src/ansi.rs` is inspected
- **THEN** `write_fg` and `write_bg` SHALL be thin wrappers that call a private `write_color` function
- **AND** the `write_color` function SHALL accept an `is_fg: bool` parameter

### Requirement: README documents actual API
The `packages/core/README.md` SHALL document the actual `CliRenderer` API, not a non-existent `Terminal` class.

#### Scenario: README matches implementation
- **WHEN** `packages/core/README.md` is read
- **THEN** it SHALL reference `CliRenderer` as the main entry point
- **AND** it SHALL document `setupTerminal()`, `render()`, `on()`, `restoreTerminal()`, `destroy()`
- **AND** it SHALL NOT reference a `Terminal` class with `init()`, `draw()`, `flush()`, `waitForInput()`

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

### Requirement: Agent Rust unsafe guidance is scoped to FFI boundaries
`AGENTS.md` SHALL prohibit casual unsafe Rust while allowing necessary unsafe code at explicit FFI boundaries under strict safeguards.

#### Scenario: Unsafe ban is not absolute
- **WHEN** `AGENTS.md` describes Rust unsafe policy
- **THEN** it SHALL NOT claim the repository has no unsafe code if FFI wrappers require it
- **AND** it SHALL state that unsafe is only acceptable in localized FFI/manual wrapper code or tests that require it

#### Scenario: Unsafe FFI requires safeguards
- **WHEN** `AGENTS.md` permits unsafe FFI code
- **THEN** it SHALL require null checks or equivalent pointer validation before dereferencing raw pointers
- **AND** it SHALL require `#[expect(unsafe_code)]` or a similarly explicit local lint expectation
- **AND** it SHALL require a `SAFETY:` comment when the invariant is not obvious from nearby code

### Requirement: Agent quality commands match project scripts
`AGENTS.md` SHALL document validation commands using scripts that exist in the root package configuration.

#### Scenario: TypeScript typecheck uses Bun script
- **WHEN** `AGENTS.md` describes TypeScript typechecking
- **THEN** it SHALL direct agents to use `bun run typecheck`
- **AND** it SHALL NOT direct agents to invoke `tsc` directly as the primary workflow

#### Scenario: Quality checklist avoids nonexistent commands
- **WHEN** `AGENTS.md` lists formatting, linting, testing, or build commands
- **THEN** each listed root command SHALL exist in `package.json`
