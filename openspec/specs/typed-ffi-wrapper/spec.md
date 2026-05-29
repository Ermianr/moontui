# typed-ffi-wrapper

Typed facade wrapping all C ABI symbol exports from `dlopen`.

## Overview

The typed `api` object wraps all 22 C ABI symbol exports from `dlopen`, providing explicit parameter and return types. This confines the single `as any` cast to the `dlopen()` call site and eliminates raw `lib.symbols` access throughout the codebase.

## Requirements

### Requirement: Typed facade wraps raw dlopen symbols
The typed `api` object SHALL be generated from `target/moontui-schema.json` instead of being hand-written. The contract (typed parameters, branded pointers, organized sections) remains identical.

#### Scenario: api object is auto-generated
- **WHEN** `bun run build:codegen` is executed
- **THEN** it SHALL generate the `api` object in `ffi.ts` with typed functions for ALL entries in the schema
- **AND** each function SHALL have explicit parameter types and return types matching the C ABI signatures
- **AND** pointer parameters and return types SHALL use branded `Pointer<T>` types

#### Scenario: Generated api matches hand-written api
- **WHEN** the generated `ffi.ts` is compared to the current hand-written `ffi.ts`
- **THEN** the exported `api` object SHALL have the same function names
- **AND** each function SHALL have the same parameter types and return types
- **AND** the behavior SHALL be identical (same native calls, same marshalling)

#### Scenario: New functions are automatically included
- **WHEN** a new function is annotated with `#[moontui_export]` in Rust
- **THEN** `bun run build:codegen` SHALL add it to the generated `api` object
- **AND** no manual edits to `ffi.ts` SHALL be needed

### Requirement: as any is confined to dlopen call
The `as any` cast SHALL appear exactly once in the entire `packages/core/src/` directory: at the `dlopen()` call site where the raw library object is created. Pointer arguments to `lib.symbols.*` SHALL NOT use `as number` or `as any` casts.

#### Scenario: Single as any in ffi.ts
- **WHEN** the codebase is searched for `as any` casts
- **THEN** the only occurrence SHALL be in `ffi.ts` at the `dlopen` return value cast
- **AND** a `biome-ignore` comment SHALL document the reason

#### Scenario: No as number casts for pointers
- **WHEN** `ffi.ts` is searched for `as number` casts
- **THEN** zero occurrences SHALL relate to pointer arguments
- **AND** all pointer values SHALL be passed directly to `lib.symbols.*` without casting

#### Scenario: No as any in consumer files
- **WHEN** `renderer.ts`, `buffer.ts`, and `testing/index.ts` are inspected
- **THEN** they SHALL contain zero `as any` casts related to FFI pointer types

### Requirement: toPointer converts raw FFI returns only
The `toPointer<T>()` function SHALL be called only on return values from `lib.symbols.*` calls, not on pointer arguments being passed to native code.

#### Scenario: toPointer on return value
- **WHEN** `lib.symbols.getCurrentBuffer(p)` returns a raw value
- **THEN** `toPointer<Buffer>(rawValue)` SHALL convert it to a branded `Pointer<Buffer>`
- **AND** the conversion SHALL normalize to the runtime's native pointer type (number for Bun, bigint for Node/Deno)

#### Scenario: toPointer not used on arguments
- **WHEN** `api.destroyRenderer(p)` calls `lib.symbols.destroyRenderer`
- **THEN** `p` SHALL be passed directly without `toPointer()` conversion
- **AND** `p` is already the correct native type from the previous `toPointer()` call that created it

### Requirement: api object is exported as the FFI entry point
The typed `api` object SHALL be exported from `ffi.ts` and used by all consumers instead of the raw `lib.symbols`.

#### Scenario: Consumers import api
- **WHEN** `renderer.ts` or `buffer.ts` needs to call a native function
- **THEN** they SHALL import and use `api.functionName(...)` instead of `lib.symbols.functionName(...)`

#### Scenario: Raw lib is not exported
- **WHEN** `ffi.ts` is inspected
- **THEN** the raw `dlopen` result SHALL NOT be exported (only the typed `api` wrapper)

### Requirement: toPointer helper converts raw FFI returns
A `toPointer<T>()` function SHALL convert raw `number` or `bigint` values returned by `dlopen` symbols into branded `Pointer<T>` values.

#### Scenario: Number return is branded
- **WHEN** a native function returns a raw `number` pointer
- **THEN** `toPointer<Renderer>(value)` SHALL return a `Pointer<Renderer>` with the brand applied

#### Scenario: toPointer is internal to ffi.ts
- **WHEN** `toPointer` is used
- **THEN** it SHALL only be called inside the `api` wrapper functions
- **AND** it SHALL NOT be exported from the public API

### Requirement: FFI symbols organized by domain
The `dlopen` symbol list and `api` object SHALL be organized into domain sections with comments. Sections: Renderer Lifecycle, Buffer Operations, Terminal, Events.

#### Scenario: dlopen symbols grouped by domain
- **WHEN** the `dlopen` call in `ffi.ts` is inspected
- **THEN** symbols SHALL be grouped under section comments (e.g., `// --- Renderer Lifecycle ---`)

#### Scenario: api object grouped by domain
- **WHEN** the `api` object in `ffi.ts` is inspected
- **THEN** methods SHALL be grouped under section comments matching the `dlopen` grouping

### Requirement: dlopen symbols are generated from schema
The `dlopen` call in `ffi.ts` SHALL be generated from the schema instead of hand-written.

#### Scenario: All schema functions appear in dlopen
- **WHEN** schema.json contains N function entries
- **THEN** the generated `dlopen` call SHALL contain exactly N symbol definitions
- **AND** each symbol's `args` and `returns` SHALL match the schema types

#### Scenario: FFI type mapping is correct
- **WHEN** a schema function has `params: [{ type: "u32" }, { type: "ptr" }]`
- **THEN** the generated `dlopen` entry SHALL have `args: [FFIType.u32, FFIType.ptr]`

### Requirement: Generated ffi.ts imports from platform
The generated `ffi.ts` SHALL import `FFIType`, `backend`, `ffiBool`, and `Pointer` from `./platform/index`.

#### Scenario: Generated code uses platform facade
- **WHEN** `ffi.ts` is generated
- **THEN** it SHALL contain `import { backend, FFIType, ffiBool, type Pointer } from "./platform/index"`
- **AND** it SHALL NOT import from `bun:ffi`, `node:ffi`, or any runtime-specific module

### Requirement: Generated structs.ts imports defineStruct
The generated `structs.ts` SHALL import `defineStruct` from `./struct-helpers`.

#### Scenario: Generated structs use defineStruct
- **WHEN** `structs.ts` is generated
- **THEN** it SHALL contain `import { defineStruct } from "./struct-helpers"`
- **AND** each struct SHALL be defined as `export const XxxStruct = defineStruct([...fields])`
- **AND** each struct SHALL have a corresponding TypeScript interface

### Requirement: platform.ts is inlined
The `getLibraryName()` function from `platform.ts` SHALL be moved into `ffi.ts`. The file `platform.ts` SHALL be deleted.

#### Scenario: getLibraryName exists in ffi.ts
- **WHEN** `ffi.ts` is inspected
- **THEN** it SHALL contain the `getLibraryName()` function

#### Scenario: platform.ts is deleted
- **WHEN** the codebase is inspected
- **THEN** `packages/core/src/platform.ts` SHALL NOT exist
