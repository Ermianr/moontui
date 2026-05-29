# ffi-marshalling

Automatic conversion between JavaScript types and C ABI types at the FFI boundary.

## Overview

The `ffi.ts` API layer SHALL provide deep marshalling so that application code passes native JS types (strings, RGBA objects) and receives typed objects, while the FFI layer handles pointer coercion, string encoding, and struct layout internally.

## Requirements

### Requirement: String marshalling in bufferDrawText
The `api.bufferDrawText` function SHALL accept a JavaScript string and internally encode it to UTF-8 bytes before passing to native code.

#### Scenario: drawText with string argument
- **WHEN** `api.bufferDrawText(buf, "Hello", 2, 2, fgPtr, bgPtr, 0)` is called
- **THEN** the string SHALL be encoded to UTF-8 Uint8Array internally
- **AND** the encoded length SHALL be passed to native code
- **AND** the caller SHALL NOT need to create `TextEncoder` or call `ptr()`

#### Scenario: drawText with Unicode characters
- **WHEN** `api.bufferDrawText(buf, "Hello 世界", 0, 0, fgPtr, bgPtr, 0)` is called
- **THEN** the text SHALL be correctly encoded as multi-byte UTF-8
- **AND** the native side SHALL receive the correct byte length

### Requirement: RGBA marshalling in draw methods
All `api` buffer draw methods that accept colors SHALL accept plain `{r, g, b, a}` objects or `RGBA` instances and internally convert them to pointer-backed arrays.

#### Scenario: drawText with RGBAInput object
- **WHEN** `api.bufferDrawText(buf, "X", 0, 0, {r: 65535, g: 0, b: 0, a: 65535}, bg, 0)` is called
- **THEN** the foreground color SHALL be internally converted to a `Uint16Array` pointer
- **AND** the caller SHALL NOT need to call `ptr()` or `toRGBA()`

#### Scenario: drawBox with RGBA colors
- **WHEN** `api.bufferDrawBox(buf, 0, 0, 10, 5, borderChars, 0, borderColor, bgColor)` is called with plain color objects
- **THEN** both colors SHALL be internally marshalled to pointer-backed arrays
- **AND** the native side SHALL receive valid pointers

### Requirement: RenderStats marshalling in getRenderStats
The `api.getRenderStats` function SHALL use a generated `FrameStatsStruct` reader instead of hardcoded `DataView` offsets.

#### Scenario: getRenderStats uses defineStruct
- **WHEN** `api.getRenderStats(renderer)` is called
- **THEN** it SHALL use `FrameStatsStruct.read(statsPtr)` to read the struct
- **AND** the caller SHALL NOT need to create a `Uint8Array(56)` or use `DataView`
- **AND** the struct layout knowledge SHALL come from the schema, not hardcoded offsets

#### Scenario: FrameStats struct layout is auto-generated
- **WHEN** the Rust `FrameStats` struct is annotated with `#[moontui_export]`
- **THEN** `packages/core/src/structs.ts` SHALL contain `FrameStatsStruct` with the correct field offsets from the schema
- **AND** a `FrameStats` TypeScript interface SHALL be generated with camelCase field names

#### Scenario: Struct layout stays in sync
- **WHEN** a field is added to or reordered in the Rust `FrameStats` struct
- **THEN** `cargo build` SHALL update the schema with the new layout
- **AND** `bun run build:codegen` SHALL regenerate `FrameStatsStruct` with correct offsets
- **AND** no manual offset updates SHALL be needed in TypeScript

### Requirement: Callback marshalling in createEventCallback
The `api.createEventCallback` function SHALL accept a JavaScript handler and return a `FFICallbackInstance` with marshalling for string pointers and boolean flags.

#### Scenario: Event callback receives string arguments
- **WHEN** the native side calls the callback with `typePtr` and `keyPtr` (UTF-8 pointers)
- **THEN** the callback SHALL decode them to JavaScript strings
- **AND** it SHALL pass `{ key, ctrl, shift, alt }` to the JS handler
- **AND** the JS handler SHALL NOT receive raw pointer arguments

#### Scenario: Event callback handles null pointers
- **WHEN** the native side calls the callback with a null pointer
- **THEN** the callback SHALL silently return without calling the JS handler
- **AND** it SHALL NOT crash or throw

### Requirement: Terminal size marshalling in getTerminalSize
The `api.getTerminalSize` function SHALL return a plain `{ width, height }` object instead of a packed `bigint`.

#### Scenario: getTerminalSize returns plain object
- **WHEN** `api.getTerminalSize()` is called
- **THEN** it SHALL return `{ width: number, height: number }`
- **AND** the caller SHALL NOT need to unpack a `bigint` with bit shifts

### Requirement: Boolean normalization for FFI
All boolean arguments crossing the FFI boundary SHALL be normalized to `0` or `1` integers.

#### Scenario: setupTerminal receives boolean
- **WHEN** `api.setupTerminal(renderer, true)` is called
- **THEN** the native side SHALL receive `1` (not `true`)
- **AND** `api.setupTerminal(renderer, false)` SHALL pass `0` to native

#### Scenario: render receives boolean
- **WHEN** `api.render(renderer, false)` is called
- **THEN** the native side SHALL receive `0`
- **AND** when `api.render(renderer, true)` is called
- **THEN** the native side SHALL receive `1`

### Requirement: defineStruct provides generic struct reading
A `defineStruct(fields)` function SHALL provide generic struct reading from native memory pointers.

#### Scenario: defineStruct reads all fields correctly
- **WHEN** `defineStruct([["x", "f64"], ["y", "u32"], ["active", "bool"]]).read(ptr)` is called
- **THEN** it SHALL return `{ x: number, y: number, active: boolean }` with values read from the correct byte offsets

#### Scenario: defineStruct handles alignment padding
- **WHEN** a struct has `f64` at offset 0, `u32` at offset 8, and `bool` at offset 12
- **THEN** `defineStruct` SHALL read each field at its specified offset
- **AND** padding between fields SHALL be handled by the offset values from the schema

#### Scenario: defineStruct returns the correct TypeScript types
- **WHEN** a field has type `f64` or `u32`
- **THEN** the returned value SHALL be `number`
- **WHEN** a field has type `u64`
- **THEN** the returned value SHALL be `number` (converted from BigInt)
- **WHEN** a field has type `bool`
- **THEN** the returned value SHALL be `boolean`
- **WHEN** a field has type `ptr`
- **THEN** the returned value SHALL be `Pointer`

## Invariants

- Marshalling is lossless: a JS string -> UTF-8 bytes -> JS string roundtrip is identical.
- RGBA marshalling preserves all 16-bit channels: `r`, `g`, `b`, `a` in `0..65535`.
- Struct layout is centralized: only `ffi.ts` knows the `FrameStats` field order.
- Callbacks are zero-copy where possible: string pointers are decoded via `TextDecoder` without intermediate heap copies.
