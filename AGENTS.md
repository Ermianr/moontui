# Agent Guidelines for MoonTUI

MoonTUI is a hybrid Rust and TypeScript TUI library. The Rust core lives in `crates/moontui-core`, TypeScript bindings live in `packages/core`, shared TS config lives in `packages/config`, and demos live in `examples`.

Use Bun as the primary JavaScript runtime and command runner. Use Cargo for Rust. Keep agent output technical, concise, and free of emojis.

## Evidence Rule

Never assert that a function, module, behavior, command, or pattern exists without proof. Back every codebase claim with an exact file path and line number, or quote the relevant source snippet. If evidence cannot be produced, say that explicitly.

Read the full target file before broad edits, preserve user changes, and keep edits scoped to the requested change.

## Canonical Workflows

Root scripts are the source of truth for common repository commands.

```bash
bun install
bun run build
bun run build:ts
bun run build:native
bun run build:codegen
bun run test
bun run test:rust
bun run test:ts
bun run fmt
bun run fmt:check
bun run fmt:rust:check
bun run fmt:ts:check
bun run lint
bun run lint:rust
bun run lint:ts
bun run check
bun run typecheck
```

Do not invoke `tsc` directly for routine typechecking. Use `bun run typecheck` from the repository root, or the package script when already working inside `packages/core`.

When running examples or terminal apps, do not rely on visible `console.log` output. Reproduce issues in tests or ask the user for terminal output when interactive TUI behavior cannot be captured by the agent.

## Generated Files

Never edit generated or distributed artifacts directly:

- `packages/core/dist/*`
- `packages/core/native/*`
- `packages/core/src/ffi.ts`
- `packages/core/src/structs.ts`

Generated FFI source files must be changed through Rust annotations, manual wrapper metadata, or `scripts/generate-ffi.ts`, then regenerated with:

```bash
cargo build
bun run build:codegen
```

If a manual FFI wrapper changes, update the codegen source that emits the wrapper behavior. Do not patch generated output by hand.

## Native Builds

If any Rust code under `crates/moontui-core/` changes, rebuild the native package artifacts with:

```bash
bun run build:native
```

The native build script builds the host Rust library, copies it into `packages/core/native/<platform>/`, and generates the platform package under `packages/core/node_modules/@moontui/core-<platform>`. TypeScript examples and package resolution use those platform packages, not `target/debug`.

Debug native artifacts are an explicit development choice; pass the build script's `--dev` option only when a debug native build is intentionally required.

## FFI Rules

The Rust core is built as `cdylib`, `staticlib`, and `lib`; public FFI data crossing the Rust and TypeScript boundary must stay FFI-safe.

- Use `#[repr(C)]` for public FFI structs and enums.
- Prefer explicit scalar widths such as `u32`, `i32`, `u64`, and `i64` for new public FFI APIs.
- Existing platform/codegen support maps `usize`, but do not add new public `usize` usage without checking the Rust declaration, generated schema, and platform facade mapping.
- Marshal native booleans deliberately; shared TypeScript code should use generated `ffi.ts` helpers or platform facade helpers.
- Route pointer creation, pointer conversion, callbacks, and dynamic library loading through `packages/core/src/platform/` or generated `ffi.ts`.
- Do not import runtime-specific FFI modules such as `bun:ffi` or `node:ffi` from shared library code. Keep runtime-specific imports inside platform backend modules.

Unsafe Rust is prohibited for ordinary implementation code. It is acceptable only in localized FFI/manual wrapper code or tests that require it. Any unsafe FFI code must validate raw pointers before dereferencing, use an explicit local lint expectation such as `#[expect(unsafe_code)]` when applicable, and include a `SAFETY:` comment when the invariant is not obvious from nearby code.

## Runtime Portability

Bun is the primary runtime for development commands, tests, and local execution. Node.js and Deno support are experimental unless a change includes implementation and tests that prove parity.

Shared TypeScript library code must avoid Bun-specific APIs such as `Bun.file()` and `Bun.serve()` outside platform backends and scripts. Use standard imports or the existing platform facade for runtime-dependent behavior.

## Rust Rules

- No `unwrap()` or `expect()` outside tests.
- No panicking on user input; fallible operations return `Result`.
- No `dbg!`, `todo!`, `unimplemented!`, `println!`, or `eprintln!`.
- Prefer `?` for error propagation and `thiserror` for library errors.
- Use workspace dependencies from root `Cargo.toml`; no git dependencies in PRs.
- Keep terminal state restorable on exit or panic.
- Treat buffer operations and rendering as hot paths; avoid unnecessary allocation and cloning.
- Use `#[expect(clippy::lint)]` with justification instead of broad `#[allow(...)]` when suppressing active Clippy lints.

Rust formatting and linting are governed by `rustfmt.toml` and root `Cargo.toml`.

## TypeScript Rules

- Avoid casual `any`; when an FFI cast needs it, keep the scope narrow and document it with the existing lint style.
- Do not use Bun-specific APIs in shared library code outside platform/script contexts.
- Prefer explicit imports grouped by built-ins, external dependencies, then internal modules.
- Keep helpers close to the code they support and avoid extracting single-use abstractions unless they clarify complex validation.
- Prefer `const`, early returns, and type guards that preserve downstream inference.
- Use Bun test commands for tests and Bun scripts for formatting, linting, and typechecking.

## Verification by Change Type

Run the smallest set that covers the files changed, and report any commands not run.

Rust changes under `crates/`:

```bash
bun run fmt:rust:check
bun run lint:rust
bun run test:rust
```

Rust changes under `crates/moontui-core/` also require:

```bash
bun run build:native
```

TypeScript source changes under `packages/core/src/`:

```bash
bun run fmt:ts:check
bun run lint:ts
bun run test:ts
bun run typecheck
```

FFI boundary changes:

```bash
cargo build
bun run build:codegen
bun run fmt:ts:check
bun run lint:ts
bun run test:ts
bun run typecheck
```

Repository-wide or cross-language changes:

```bash
bun run check
bun run test
```

Documentation-only changes usually do not require builds or tests. Still verify command names, generated-file claims, and workflow claims against source files before presenting them as facts.

## Commits and PR Titles

Use conventional commit messages: `type(scope): summary`.

Valid types: `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`.
