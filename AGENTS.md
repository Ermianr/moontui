# Agent Guidelines for MoonTUI

MoonTUI is a TUI library with a Rust core and TypeScript bindings, built on top of crossterm.

## Project Identity

- **Rust core** (`crates/moontui-core`): Terminal manipulation, buffer, rendering, input handling
- **TypeScript bindings** (`packages/core`): FFI layer and high-level TS API
- **Shared config** (`packages/config`): Base TypeScript configuration
- **Examples** (`examples/`): Demo applications

This is a hybrid Rust + Bun monorepo managed with `bun` and `cargo`.

## Conversational Style

- Keep answers short and concise
- No emojis in commits, issues, PR comments, code, or any agent output
- Technical prose only; be kind but direct

## Evidence Rule

Never assert that a function, module, behavior, or pattern exists without proof. Every claim about the codebase must be backed by the exact file path and line number, or a code snippet from the source. If the evidence cannot be produced, state that explicitly.

## Build & Development Commands

### Rust

```bash
cargo build                              # Build all crates
cargo test                               # Run Rust tests
cargo test -p moontui-core               # Test specific crate
cargo fmt --all                          # Format Rust code
cargo fmt --all -- --check               # Check formatting
cargo clippy --workspace --all-targets -- --deny warnings  # Lint Rust
```

### TypeScript

```bash
bun install                              # Install dependencies
bun run build:ts                         # Build TS library only
bun run build:native                     # Build native binary only
bun run build:codegen                    # Generate FFI bindings
bun run test:ts                          # Run TS tests
bun run fmt:ts                           # Format TS code
bun run fmt:ts:check                     # Check TS formatting
bun run lint:ts                          # Lint TS code
bun run typecheck                        # Typecheck core package (from repo root)
```

### Combined

```bash
bun run build                            # Build all (Rust + TS)
bun run test                             # Run all tests (Rust + TS)
bun run fmt                              # Format all (Rust + TS)
bun run fmt:check                        # Check all formatting
bun run lint                             # Lint all (Rust + TS)
bun run check                            # CI gate: fmt:check + lint
bun run typecheck                        # Typecheck core package
bun run clean                            # Remove build artifacts
```

Always run `bun typecheck` from package directories (e.g., `packages/core`), never `tsc` directly.

### FFI Codegen Workflow

The FFI boundary is auto-generated from Rust annotations. When adding new FFI functions:

1. Add `#[moontui_export]` to the `impl` block in Rust
2. Run `cargo build` to generate `target/moontui-schema.json`
3. Run `bun run build:codegen` to generate `packages/core/src/ffi.ts` and `packages/core/src/structs.ts`
4. The generated files are marked `DO NOT EDIT` — never edit them manually

For complex functions (multi-pointer args, slice conversion, etc.), use `/// @ffi_manual` and keep the manual implementation in `lib.rs`.

## Runtime Portability

Default to Bun for development, but generated code must work across Bun, Node.js, and Deno.

- Use `bun test` for testing
- Use `bun install` for dependency management
- **Do not** use Bun-specific APIs (e.g., `Bun.file()`, `Bun.serve()`) in library code — use `node:fs/promises`, `node:path`, and other `node:` built-ins instead
- Bun automatically loads `.env`, so don't use dotenv
- When only changing TypeScript, you do NOT need to rebuild native code

### Portable FFI Types

- Stay within the `node:ffi`/`bun:ffi` type intersection
- Avoid backend-specific ABI names: no `usize`, `napi_env`, or `napi_value`; use explicit widths like `u32`/`u64`
- Treat `i64`/`u64` as `bigint`, native booleans as `0`/`1`
- For pointer params, pass `ptr(view)` explicitly; keep shared `Pointer` values as `number | bigint`
- Create callbacks through the loaded library/platform facade, not `new JSCallback(...)`

## Auto-generated Files

MANDATORY: NEVER edit these files directly.

- `packages/core/dist/*` — Built from `packages/core/src/` via build script
- `packages/core/native/*` — Prebuilt native binaries

## Commits and PR Titles

Use conventional commit messages: `type(scope): summary`.

Valid types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
Scopes are optional; use the affected package or area when helpful: `core`, `ffi`, `buffer`, `renderer`, `input`.

Examples:
```
fix(core): handle zero-width characters in buffer
feat(renderer): add double-buffer diffing
chore(ffi): regenerate native types
refactor(buffer): simplify cell comparison
```

---

# Rust Style Guide

## General Principles

- **No `unwrap()`/`expect()`** outside tests — always handle errors with `thiserror` + `Result`
- **No panicking on user input** — all fallible operations return `Result`
- **No `unsafe` code** — enforced via `unsafe_code = "deny"` in workspace lints
- **No `dbg!`, `todo!`, `unimplemented!`, `println!`, `eprintln!`** — all denied by workspace clippy config
- Prefer `?` operator over match chains for error propagation
- Use `thiserror` for library errors; `anyhow` is for application binaries and is not a dependency here

## Borrowing & Ownership

- Prefer `&T` over `.clone()` unless ownership transfer is required
- Use `&str` over `String`, `&[T]` over `Vec<T>` in function parameters
- Small `Copy` types (≤24 bytes) can be passed by value
- Use `Cow<'_, T>` when a function may return either borrowed or owned data depending on conditions

## Performance

- Avoid cloning in loops; use `.iter()` instead of `.into_iter()` for Copy types
- Prefer iterators over manual loops; avoid intermediate `.collect()` calls
- Always benchmark with `--release` flag
- Run `cargo clippy -- -D clippy::perf` for performance hints

## Linting

Workspace clippy config (`Cargo.toml`) enforces:
- `pedantic` at warn level
- `dbg_macro`, `todo`, `unimplemented`, `print_stdout`, `print_stderr` denied
- `unsafe_code` denied

Run: `cargo clippy --workspace --all-targets -- --deny warnings`

Use `#[expect(clippy::lint)]` over `#[allow(...)]` with a justification comment. `#[expect]` causes a build error if the lint stops firing (e.g. after a Clippy version upgrade), which keeps suppressions relevant. If a Clippy update removes a lint, replace the stale `#[expect]` with `#[allow]` and document why.

## Formatting

Enforced by `rustfmt.toml`:
- `style_edition = "2024"`, `tab_spaces = 2`
- `use_field_init_shorthand = true`

Run: `cargo fmt --all`

## Testing

- Name tests descriptively: `buffer_should_handle_wide_characters()`
- One assertion per test when possible
- Use `cargo test` from repo root or `cargo test -p moontui-core` for the core crate
- Integration tests live in `crates/moontui-core/tests/`
- Test helpers in `crates/moontui-core/src/test_helpers.rs`

## Documentation

- `//` comments explain *why* (safety invariants, workarounds, design rationale)
- `///` doc comments explain *what* and *how* for public APIs
- Every `TODO` needs a linked issue: `// TODO(#42): ...`
- Do not add comments for obvious code

## Dependencies

- Use workspace dependencies defined in root `Cargo.toml`
- Use minor-compatible semver versions: `"0.29"` not `"0.29.0"` — `Cargo.lock` guarantees exact reproducibility; pinning patch versions in `Cargo.toml` blocks automatic bug-fix updates without any reproducibility benefit
- No git dependencies in PRs
- No copyleft-licensed dependencies; acceptable licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC0

## Key Architectural Invariants

- The Rust core is a `cdylib` + `staticlib` + `lib` — it must be FFI-safe
- All public FFI types must use `#[repr(C)]`
- Terminal state must be restorable on panic (use crossterm's terminal modes)
- Buffer operations are the hot path — optimize for minimal allocations

---

# TypeScript Style Guide

## General Principles

- Keep things in one function unless composable or reusable
- Do not extract single-use helpers preemptively — inline the logic at the call site
- Avoid the `any` type
- Rely on type inference; avoid explicit type annotations unless necessary for exports, complex generics, or function return types where inference would be non-obvious
- Prefer functional array methods (`flatMap`, `filter`, `map`) over `for` loops; use type guards on `filter` to maintain type inference downstream
- Inline a value when it is used only once and the expression is short enough to remain readable; extract a named variable when it aids clarity or debugging

```ts
// Good — expression is short, used once
const journal = JSON.parse(await readFile(join(dir, "journal.json"), "utf8"))

// Also good — named variable aids clarity when expression is complex
const journalPath = buildConfigPath(dir, env, "journal.json")
const journal = JSON.parse(await readFile(journalPath, "utf8"))
```

## Destructuring

Use destructuring when accessing multiple properties from the same object in the same scope. For a single property used once, dot notation is cleaner.

```ts
// Good — multiple properties, destructuring reduces repetition
const { width, height, depth } = dimensions

// Good — single property or different scopes, dot notation preserves context
obj.name
obj.value
```

## Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

## Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

## Complex Logic

When a function has several validation branches, make the main function read as the happy path and move supporting details into small helpers below it.

```ts
// Good
export function loadThing(input: unknown) {
  const config = requireConfig(input)
  const metadata = readMetadata(input)
  return createThing({ config, metadata })
}

function requireConfig(input: unknown) { ... }
```

- Keep helpers close to the code they support
- Do not over-abstract simple expressions into many single-use helpers
- Add comments for non-obvious constraints and surprising behavior, not for obvious control flow

## Naming

- `camelCase` for variables and functions
- `PascalCase` for classes, interfaces, and types
- `UPPER_CASE` for constants

## Formatting & Linting

Enforced by Biome via ultracite (`biome.jsonc`):
- No semicolons
- Strict TypeScript
- Minimal comments, no JSDoc

Run: `bun run fmt:ts:check` (check) / `bun run fmt:ts` (auto-fix)

## Imports

Use explicit imports, grouped by: built-ins, external deps, internal modules.

## Testing

- Use `bun test` from the `packages/core` directory
- Avoid mocks — test actual implementation
- Do not duplicate logic into tests
- Descriptive test names
- Tests are co-located with source: `src/*.test.ts`

```ts
import { test, expect } from "bun:test"

test("buffer should handle wide characters", () => {
  // ...
})
```

## Debugging

This is a terminal UI library. When running examples or apps built with it, you cannot see `console.log` output directly. Ask the user to run the example and provide the output. Reproduce issues in a test case before fixing. Do not guess — use debug logs to understand what is actually happening.

---

# Common Pitfalls & Best Practices

- **Check surrounding code for conventions** before adding new code — study existing patterns, naming, and architecture in the target file/directory
- **Read files in full** before making wide-ranging changes; do not rely only on search snippets
- **Batch multiple edits** when possible to minimize round trips
- **Break large changes into tracked steps** — decompose substantial work into manageable subtasks
- **Never edit auto-generated files** — edit the source and rebuild
- **Wait for `cargo` commands to finish** before starting another one
- **Avoid `cargo clean`** — it increases subsequent compile times
- **FFI boundary is critical** — all types crossing Rust↔TS must be `#[repr(C)]` and portable
- **Terminal state restoration** — always ensure the terminal is restored on exit/panic
- **Performance matters** — this is a TUI library; buffer operations and rendering are hot paths

## Quality Checklist

Before committing:

- [ ] Rust: `bun run fmt:rust:check` passes
- [ ] Rust: `bun run lint:rust` passes
- [ ] Rust: `bun run test:rust` passes
- [ ] TypeScript: `bun run fmt:ts:check` passes
- [ ] TypeScript: `bun run lint:ts` passes
- [ ] TypeScript: `bun run test:ts` passes
- [ ] TypeScript: `bun run typecheck` passes
- [ ] No auto-generated files were edited
- [ ] No `unwrap()`/`expect()` added outside tests
- [ ] No `dbg!`/`todo!`/`unimplemented!` macros left in code
- [ ] FFI types are `#[repr(C)]` and portable across runtimes
- [ ] No Bun-specific APIs (`Bun.file`, `Bun.serve`, etc.) in library code
