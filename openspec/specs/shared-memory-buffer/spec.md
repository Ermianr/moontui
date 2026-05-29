# shared-memory-buffer

Zero-copy buffer access protocol: TypeScript writes directly to native `OptimizedBuffer` memory via `TypedArray` views mapped over C ABI pointer exports.

## Overview

The native buffer stores Cell data as four parallel arrays (chars, fg, bg, attributes). The `bufferGetCharPtr`, `bufferGetFgPtr`, `bufferGetBgPtr`, and `bufferGetAttributesPtr` C ABI functions return raw pointers to these arrays. TypeScript maps them as `TypedArray` views via `bun:ffi`'s `toArrayBuffer()`, then reads and writes directly to native memory without per-operation FFI calls.

## Requirements

### Requirement: Buffer memory is mapped as parallel TypedArray views
The `MoonBuffer` constructor SHALL call the four `bufferGet*Ptr` C ABI functions once and create `TypedArray` views over the returned pointers. Each view SHALL be contiguous (zero stride between cells, per SoA layout).

#### Scenario: TypedArrays created at construction
- **WHEN** `new MoonBuffer(ptr, width, height)` is called
- **THEN** `bufferGetCharPtr`, `bufferGetFgPtr`, `bufferGetBgPtr`, `bufferGetAttributesPtr` are each called once
- **AND** four `TypedArray` views are created over the returned memory:
  - `chars`: `Uint32Array` of length `width * height`
  - `fg`: `Uint16Array` of length `width * height * 4`
  - `bg`: `Uint16Array` of length `width * height * 4`
  - `attributes`: `Uint32Array` of length `width * height`

### Requirement: Drawing methods write directly to TypedArray views
All `MoonBuffer` drawing methods (`clear`, `drawText`, `drawBox`, `drawChar`, `fillRect`) SHALL write cell data directly to the mapped TypedArray views instead of calling C ABI draw functions.

#### Scenario: clear writes to all cells
- **WHEN** `clear(bgColor)` is called
- **THEN** every cell's `char_code` is set to 0
- **AND** every cell's `bg` is set to `[bgColor.r, bgColor.g, bgColor.b, bgColor.a]`
- **AND** every cell's `fg` is set to `[0, 0, 0, 65535]`
- **AND** every cell's `attributes` is set to 0
- **AND** no FFI function is called for the operation

#### Scenario: drawText writes cells sequentially
- **WHEN** `drawText(text, x, y, fgColor, bgColor, attrs)` is called
- **THEN** each character of `text` is written to consecutive cells starting at `(x, y)`
- **AND** the char codepoint is written to the `chars` view
- **AND** fg/bg values are written to the `fg`/`bg` views
- **AND** attributes are written to the `attributes` view
- **AND** wide characters (Unicode width > 1) set the `ATTR_CONTINUATION` flag on subsequent cells
- **AND** no FFI function is called for the operation

#### Scenario: drawBox writes border and fill cells
- **WHEN** `drawBox(options)` is called
- **THEN** all cells inside the box boundary are written through TypedArray views
- **AND** no FFI function is called for the operation

#### Scenario: drawChar writes a single cell
- **WHEN** `drawChar(codepoint, x, y, fgColor, bgColor, attrs)` is called
- **THEN** the cell at `(x, y)` is updated through TypedArray views
- **AND** no FFI function is called for the operation

#### Scenario: fillRect writes a rectangular region
- **WHEN** `fillRect(x, y, w, h, bgColor)` is called
- **THEN** all cells in `(x..x+w, y..y+h)` have their `bg` updated through TypedArray views
- **AND** no FFI function is called for the operation

### Requirement: getSpanLines reads from TypedArray views
The `getSpanLines()` method SHALL read cell data directly from the mapped TypedArray views. Cell field access SHALL be stride-free: cell `i`'s char is at `charView[i]`, cell `i`'s fg[0..3] are at `fgView[i*4..i*4+3]`.

#### Scenario: getSpanLines reads contiguous arrays
- **WHEN** `getSpanLines()` is called
- **THEN** cell data is read directly from the `chars`, `fg`, `bg`, `attributes` TypedArray views
- **AND** adjacent cells with identical fg, bg, and attributes are merged into a single span

### Requirement: Buffer accessor functions remain available as C ABI fallback
The `bufferGetCharPtr`, `bufferGetFgPtr`, `bufferGetBgPtr`, `bufferGetAttributesPtr`, `bufferGetRealCharSize`, and `bufferWriteResolvedChars` C ABI functions SHALL be preserved for inspection, serialization, and testing.

#### Scenario: getRealCharBytes uses original C ABI
- **WHEN** `getRealCharBytes(addLineBreaks)` is called
- **THEN** it calls `bufferGetRealCharSize` and `bufferWriteResolvedChars` to serialize the buffer (these functions do not need rewriting)

## Invariants

- The TypedArray views share memory with the native `OptimizedBuffer`. No `encodeRGBA` call or FFI round-trip is needed per draw operation.
- Drawing outside buffer bounds is silently clipped (same behavior as current C ABI functions).
- The buffer pointer (`_ptr`) is still required for calling `bufferGetRealCharSize` and `bufferWriteResolvedChars`.
- Wide characters set the next cell's `attributes |= ATTR_CONTINUATION` flag directly.
