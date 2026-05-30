# ffi-platform

Portable FFI abstraction layer across Bun, Node.js, and Deno runtimes.

## Overview

The `platform/` facade provides a unified `PlatformBackend` interface that abstracts away runtime-specific FFI implementations (`bun:ffi`, `node:ffi`, `Deno.dlopen`). Application code imports from `platform/index.ts` instead of runtime-specific modules.

## Requirements

### Requirement: Runtime detection at module load time
The platform module SHALL detect the active JavaScript runtime at load time and select the appropriate backend implementation.

#### Scenario: Bun runtime detected
- **WHEN** the module loads in a Bun environment (process.versions.bun is defined)
- **THEN** it SHALL instantiate `BunBackend`
- **AND** `backend.isAvailable` SHALL be `true`

#### Scenario: Node.js v26+ runtime detected
- **WHEN** the module loads in Node.js v26+ and `node:ffi` is available
- **THEN** it SHALL instantiate `NodeBackend`
- **AND** `backend.isAvailable` SHALL be `true`

#### Scenario: Deno runtime detected
- **WHEN** the module loads in Deno and `Deno.dlopen` is available
- **THEN** it SHALL instantiate `DenoBackend`
- **AND** `backend.isAvailable` SHALL be `true`

#### Scenario: Unsupported runtime
- **WHEN** the module loads in a runtime with no supported FFI backend
- **THEN** it SHALL throw an error with a clear message listing supported runtimes

### Requirement: String-based FFI type definitions
The platform module SHALL define `FFIType` as a set of string constants that all backends map to their native representations.

#### Scenario: FFIType is string-based
- **WHEN** inspecting `FFIType.i32`
- **THEN** it SHALL be the string `"i32"`
- **AND** not a numeric enum value from `bun:ffi`

#### Scenario: All primitive types are defined
- **WHEN** checking the `FFIType` export
- **THEN** it SHALL contain at minimum: `i8`, `u8`, `i16`, `u16`, `i32`, `u32`, `i64`, `u64`, `f32`, `f64`, `bool`, `ptr`, `void`, `cstring`, `usize`

#### Scenario: Backend maps strings to native types
- **WHEN** a Bun backend loads a library with `args: [FFIType.u32, FFIType.ptr]`
- **THEN** it SHALL map to `bun:ffi.FFIType.u32` and `bun:ffi.FFIType.ptr` internally

### Requirement: Unified library loading interface
All backends SHALL implement `loadLibrary(path, definitions)` returning a `LoadedLibrary` with `.symbols`, `.createCallback()`, and `.close()`.

#### Scenario: Symbols are callable
- **WHEN** `library = backend.loadLibrary(path, { createRenderer: { args: [FFIType.u32, FFIType.u32], returns: FFIType.ptr } })`
- **THEN** `library.symbols.createRenderer(80, 24)` SHALL return a `Pointer`

#### Scenario: Callback creation is backend-agnostic
- **WHEN** `library.createCallback(fn, { args: [FFIType.ptr], returns: FFIType.void })` is called
- **THEN** it SHALL return a `FFICallbackInstance` regardless of the active backend
- **AND** `instance.ptr` SHALL be a valid pointer to pass to native code

#### Scenario: Library cleanup
- **WHEN** `library.close()` is called
- **THEN** all native resources SHALL be released
- **AND** any unclosed callbacks SHALL be closed automatically

### Requirement: Pointer type normalization
The platform module SHALL define `Pointer<T>` as a branded type accepting both `number` and `bigint`, with `toPointer()` normalizing to the active backend's expected type.

#### Scenario: Bun receives number pointers
- **WHEN** `toPointer(1234n)` is called in Bun
- **THEN** it SHALL return `1234` as a `Pointer`

#### Scenario: Node receives bigint pointers
- **WHEN** `toPointer(1234)` is called in Node.js
- **THEN** it SHALL return `1234n` as a `Pointer`

#### Scenario: Pointer exceeds safe range
- **WHEN** `toPointer()` receives a value that exceeds the safe range for the target runtime
- **THEN** it SHALL throw an error

### Requirement: No runtime-specific imports in library code
Files outside `platform/` SHALL NOT import `bun:ffi`, `node:ffi`, or `Deno.*` directly.

#### Scenario: renderer.ts uses only platform imports
- **WHEN** `packages/core/src/renderer.ts` is inspected
- **THEN** it SHALL contain zero imports from `bun:ffi`, `node:ffi`, or `Deno.*`
- **AND** all FFI-related imports SHALL come from `./platform/index.ts` or `./ffi.ts`

#### Scenario: buffer.ts uses only platform imports
- **WHEN** `packages/core/src/buffer.ts` is inspected
- **THEN** it SHALL contain zero imports from `bun:ffi`, `node:ffi`, or `Deno.*`
- **AND** all FFI-related imports SHALL come from `./platform/index.ts` or `./ffi.ts`

### Requirement: Portable URL-to-path resolution
The `PlatformBackend` interface SHALL provide a `resolveURL(url: string): string` method that converts `file://` URLs to filesystem paths using runtime-appropriate APIs.

#### Scenario: Bun resolves file URL
- **WHEN** `backend.resolveURL("file:///home/user/lib.so")` is called in Bun
- **THEN** it SHALL return the filesystem path `/home/user/lib.so`
- **AND** it SHALL use `fileURLToPath` from `node:url`

#### Scenario: Node.js resolves file URL
- **WHEN** `backend.resolveURL("file:///C:/Users/lib.dll")` is called in Node.js
- **THEN** it SHALL return the filesystem path `C:\Users\lib.dll`
- **AND** it SHALL use `fileURLToPath` from `node:url`

#### Scenario: Deno resolves file URL
- **WHEN** `backend.resolveURL("file:///home/user/lib.so")` is called in Deno
- **THEN** it SHALL return the filesystem path `/home/user/lib.so`
- **AND** it SHALL use `Deno.urlToPath`

#### Scenario: resolveURL is proxied through platform facade
- **WHEN** `backend.resolveURL(url)` is called from `platform/index.ts`
- **THEN** it SHALL delegate to the active backend's `resolveURL` implementation

### Requirement: Shared backend factory reduces duplication
The platform module SHALL provide a `createBackend(primitives)` factory function that accepts runtime-specific primitive functions and returns a complete `PlatformBackend`. All three runtime backends (Bun, Node.js, Deno) SHALL use this factory instead of implementing `loadLibrary`, `toNativeDef`, and the callback/symbol wrapping logic independently.

#### Scenario: Backend defines only primitives
- **WHEN** a runtime backend is implemented
- **THEN** it SHALL define only the runtime-specific functions (`ptr`, `toArrayBuffer`, `toPointer`, `resolveURL`, `dlopen`, `createCallbackImpl`) and a `typeMap`
- **AND** it SHALL delegate all shared logic (`toNativeDef`, `loadLibrary` loop, callback wrapper) to `createBackend`

#### Scenario: Adding a new runtime backend
- **WHEN** a developer adds support for a new JavaScript runtime
- **THEN** they SHALL only need to implement `PlatformPrimitives` (~15-20 lines)
- **AND** they SHALL NOT need to reimplement `loadLibrary` boilerplate

#### Scenario: PlatformPrimitives is exported
- **WHEN** a third-party wants to create a custom backend
- **THEN** they SHALL be able to import `PlatformPrimitives` from `@moontui/core/platform`
- **AND** pass it to `createBackend` to get a complete `PlatformBackend`

### Requirement: toArrayBuffer respects offset parameter
The `toArrayBuffer` method on all backends SHALL correctly apply the `offset` parameter to return a buffer starting at the specified byte offset from the pointer.

#### Scenario: Deno backend applies offset
- **WHEN** `toArrayBuffer(ptr, 5, 10)` is called on the Deno backend
- **THEN** it SHALL return an ArrayBuffer of 10 bytes starting at byte offset 5 from `ptr`
- **AND** the returned buffer SHALL contain the correct bytes from position 5 through 14

#### Scenario: Deno backend with zero offset
- **WHEN** `toArrayBuffer(ptr, 0, length)` is called on the Deno backend
- **THEN** it SHALL return an ArrayBuffer of `length` bytes starting at `ptr`
- **AND** the behavior SHALL be identical to the current implementation

#### Scenario: Bun backend applies offset (existing behavior)
- **WHEN** `toArrayBuffer(ptr, offset, length)` is called on the Bun backend
- **THEN** it SHALL return an ArrayBuffer of `length` bytes starting at byte `offset` from `ptr`
- **AND** this behavior is already correct and unchanged

### Requirement: toPointer documents runtime-specific limitations
The `toPointer` method on each backend SHALL include code comments explaining any runtime-specific limitations or safety checks.

#### Scenario: Bun backend documents safe integer check
- **WHEN** `packages/core/src/platform/bun.ts` is inspected
- **THEN** the `toPointer` method SHALL have a comment explaining why the safe integer check exists
- **AND** the comment SHALL explain that Bun FFI uses `number` (not `bigint`) for pointers
- **AND** the comment SHALL document that 64-bit systems use 48-bit virtual addresses, well within safe range

#### Scenario: Node backend documents bigint conversion
- **WHEN** `packages/core/src/platform/node.ts` is inspected
- **THEN** the `toPointer` method SHALL have a comment explaining the number-to-bigint conversion

#### Scenario: Deno backend documents bigint conversion
- **WHEN** `packages/core/src/platform/deno.ts` is inspected
- **THEN** the `toPointer` method SHALL have a comment explaining the number-to-bigint conversion

## Invariants

- The platform facade is additive: a new backend can be added without changing existing backends.
- Pointer normalization is pure: `toPointer` has no side effects.
- Backends are stateless factories: `loadLibrary` creates a new `LoadedLibrary` instance each time.
- `FFIType` strings are immutable constants.

### Requirement: Runtime-specific backend modules load only after runtime selection
The platform facade SHALL NOT statically import backend modules that reference runtime-specific FFI built-ins for other runtimes.

#### Scenario: Node imports platform facade without resolving Bun FFI
- **WHEN** `packages/core/src/platform/index.ts` is imported in Node.js
- **THEN** the module SHALL NOT resolve or evaluate any module that imports `bun:ffi`
- **AND** runtime selection SHALL proceed without a Bun-specific import error

#### Scenario: Deno imports platform facade without Node require
- **WHEN** `packages/core/src/platform/index.ts` is imported in Deno
- **THEN** the module SHALL NOT call `require`
- **AND** backend loading SHALL use a Deno-compatible import path or conditional export

### Requirement: Native library path resolution is runtime-owned
Native package and binary path resolution SHALL be delegated to the active platform backend or runtime-specific entrypoint instead of reading Node globals from shared generated code.

#### Scenario: Generated FFI code avoids Node globals for platform detection
- **WHEN** `packages/core/src/ffi.ts` is generated
- **THEN** it SHALL NOT read `process.platform` or `process.arch` directly
- **AND** it SHALL ask the platform layer for the current native package identifier or binary path

#### Scenario: Unsupported runtime reports a clear error
- **WHEN** no backend can resolve a native package for the current runtime
- **THEN** loading SHALL fail with an error that includes the runtime and platform identifier
- **AND** the error SHALL NOT be caused by an unresolved runtime-specific import
