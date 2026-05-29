# Contributing to MoonTUI

Thank you for considering contributing to MoonTUI.

## Development Setup

### Prerequisites

- [Rust](https://rustup.rs/) stable toolchain
- [Bun](https://bun.sh/) >= 1.3.0

### Getting Started

```bash
git clone https://github.com/Ermianr/moontui.git
cd moontui
bun install
cargo build
```

### Project Structure

- `crates/moontui-core/` -- Rust core: terminal manipulation, buffer, rendering, input handling
- `crates/moontui-macros/` -- Proc macros for FFI codegen
- `packages/core/` -- TypeScript bindings and npm package
- `packages/config/` -- Shared TypeScript configuration
- `examples/` -- Demo applications
- `scripts/` -- Build and codegen scripts

## Running Tests

```bash
# Rust tests
cargo test

# TypeScript tests
bun test --cwd packages/core

# All checks (formatting, linting, tests)
bun run check:all
```

## Code Quality

Before submitting a pull request, ensure all checks pass:

```bash
# Rust formatting
cargo fmt --all -- --check

# Rust linting
cargo clippy --workspace --all-targets -- --deny warnings

# TypeScript formatting and linting
bun run check

# TypeScript type checking
bun run typecheck
```

## Submitting a Pull Request

1. Fork the repository and create a branch from `main`
2. Make your changes, keeping commits focused and well-described
3. Add tests for new functionality
4. Ensure all tests pass: `cargo test` and `bun test --cwd packages/core`
5. Run `cargo fmt --all` and `bun run fix` to format your code
6. Open a pull request against `main`

### Pull Request Guidelines

- Keep PRs focused on a single change
- Write clear commit messages (conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)
- Include a description of what changed and why
- Reference any related issues

## FFI Boundary Changes

If your change modifies the FFI boundary between Rust and TypeScript:

1. Add `#[moontui_export]` to the `impl` block in Rust
2. Run `cargo build` to generate `target/moontui-schema.json`
3. Run `bun run build:codegen` to regenerate `packages/core/src/ffi.ts`
4. Never edit auto-generated files directly

## Reporting Bugs

Use the [bug report template](https://github.com/Ermianr/moontui/issues/new?template=bug_report.md) when filing bugs.
