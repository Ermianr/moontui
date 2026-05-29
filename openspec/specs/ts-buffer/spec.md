# ts-buffer

TypeScript wrapper around the native `OptimizedBuffer`.

## Overview

`MoonBuffer` provides ergonomic drawing methods that accept native JavaScript types (strings, RGBA objects) and internally marshal them to the correct FFI representations before calling the native buffer functions. The class does not cache raw `DataView` objects to avoid stale pointer issues after buffer resize.

## Requirements

1. `clear(bgColor)` fills the buffer with a background color.
2. `drawText(text, x, y, fgColor, bgColor?, attributes?)` draws a UTF-8 string starting at (x, y).
3. `drawBox(options)` draws a bordered rectangle with configurable sides, fill, title, and colors.
4. `drawChar(charCodepoint, x, y, fgColor, bgColor?, attributes?)` draws a single cell.
5. `fillRect(x, y, width, height, bgColor)` fills a rectangular region.
6. `getRealCharBytes(addLineBreaks?)` returns a `Uint8Array` of the resolved character content (for testing and inspection).
7. `getSpanLines()` returns an array of lines, each containing spans of text with uniform style (fg, bg, attributes). Useful for snapshot testing.
8. `width` and `height` are read-only properties.

## TypeScript Interface

```typescript
export type RGBAInput = RGBA | { r: number; g: number; b: number; a?: number };

export interface DrawBoxOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  border?: boolean | ("top" | "right" | "bottom" | "left")[];
  borderColor: RGBAInput;
  backgroundColor: RGBAInput;
  title?: string;
}

export interface CapturedSpan {
  text: string;
  fg: RGBA;
  bg: RGBA;
  attributes: number;
  width: number;
}

export interface CapturedLine {
  spans: CapturedSpan[];
}

export class MoonBuffer {
  readonly width: number;
  readonly height: number;
  
  clear(bgColor: RGBAInput): void;
  drawText(text: string, x: number, y: number, fgColor: RGBAInput, bgColor?: RGBAInput, attributes?: number): void;
  drawBox(options: DrawBoxOptions): void;
  drawChar(charCodepoint: number, x: number, y: number, fgColor: RGBAInput, bgColor?: RGBAInput, attributes?: number): void;
  fillRect(x: number, y: number, width: number, height: number, bgColor: RGBAInput): void;
  
  getRealCharBytes(addLineBreaks?: boolean): Uint8Array;
  getSpanLines(): CapturedLine[];
}
```

## No DataView Cache in MoonBuffer

`MoonBuffer` SHALL NOT cache `_charDV`, `_fgDV`, `_bgDV`, or `_attrDV` across calls. Instead, it SHALL read fresh pointers via the API on each access.

#### Scenario: getViews reads fresh pointers
- **WHEN** `buffer.getSpanLines()` is called
- **THEN** it SHALL call `api.bufferGetCharPtr()`, `api.bufferGetFgPtr()`, `api.bufferGetBgPtr()`, and `api.bufferGetAttributesPtr()` to get current pointers
- **AND** it SHALL create fresh `ArrayBuffer` views from those pointers
- **AND** it SHALL NOT reuse cached `DataView` objects from previous calls

#### Scenario: getViews after resize is safe
- **WHEN** `api.resizeRenderer(renderer, newWidth, newHeight)` is called
- **AND** `buffer.getSpanLines()` is called on the same buffer
- **THEN** it SHALL read the new pointers (not stale ones)
- **AND** it SHALL NOT access freed memory

#### Scenario: getViews does not cache data
- **WHEN** `buffer.getSpanLines()` is called twice
- **THEN** each call SHALL independently read pointers and create views
- **AND** there SHALL be no `_charDV`, `_fgDV`, `_bgDV`, `_attrDV` fields on the class

## Drawing Methods Use Marshalled API

All drawing methods (`drawText`, `drawBox`, `drawChar`, `fillRect`, `clear`) SHALL call `api.*` methods that accept native JS types and handle FFI marshalling internally.

#### Scenario: drawText with string and colors
- **WHEN** `buffer.drawText("Hello", 2, 2, white, black, 0)` is called
- **THEN** `api.bufferDrawText` SHALL be called with the string and color objects
- **AND** `buffer.ts` SHALL NOT call `new TextEncoder().encode(text)` or `ptr(encoded)`
- **AND** `buffer.ts` SHALL NOT call `toRGBA()` or `ptr(fg.buffer)`

#### Scenario: drawBox with options
- **WHEN** `buffer.drawBox({ x: 2, y: 2, width: 10, height: 5, borderColor: white, backgroundColor: black })` is called
- **THEN** `api.bufferDrawBox` SHALL be called with the options object
- **AND** the API layer SHALL handle marshalling of `borderChars`, `borderColor`, and `backgroundColor`

#### Scenario: drawChar with colors
- **WHEN** `buffer.drawChar(65, 1, 1, white, black)` is called
- **THEN** `api.bufferDrawChar` SHALL be called with the codepoint and color objects
- **AND** `buffer.ts` SHALL NOT manipulate pointers directly

#### Scenario: fillRect with color
- **WHEN** `buffer.fillRect(2, 2, 10, 5, red)` is called
- **THEN** `api.bufferFillRect` SHALL be called with the rectangle parameters and color object
- **AND** `buffer.ts` SHALL NOT call `ptr()` or `toRGBA()`

#### Scenario: clear with color
- **WHEN** `buffer.clear(black)` is called
- **THEN** `api.bufferClear` SHALL be called with the color object
- **AND** `buffer.ts` SHALL NOT call `ptr()` or `toRGBA()`

## No Runtime-Specific Imports in Buffer

`buffer.ts` SHALL NOT import from `bun:ffi`, `node:ffi`, or `Deno.*`.

#### Scenario: buffer.ts imports are portable
- **WHEN** `packages/core/src/buffer.ts` is inspected
- **THEN** it SHALL contain zero imports from `bun:ffi`
- **AND** it SHALL contain zero imports from `node:ffi`
- **AND** all FFI-related imports SHALL come from `./platform/index.ts` or `./ffi.ts`

#### Scenario: No as any casts for FFI coercion
- **WHEN** `buffer.ts` is inspected
- **THEN** it SHALL contain zero `as any` casts related to FFI pointer coercion
- **AND** pointer conversions SHALL be handled by the platform facade

## ATTR_* Constants Export

`buffer.ts` SHALL export attribute flag constants for use with drawing methods.

#### Scenario: Constants are importable
- **WHEN** a user imports from `@moontui/core`
- **THEN** `ATTR_CONTINUATION`, `ATTR_BOLD`, `ATTR_ITALIC`, and `ATTR_UNDERLINE` SHALL be available as named exports
- **AND** their values SHALL match the Rust definitions: `ATTR_CONTINUATION = 1 << 0`, `ATTR_BOLD = 1 << 1`, `ATTR_ITALIC = 1 << 2`, `ATTR_UNDERLINE = 1 << 3`

#### Scenario: Constants work with drawText
- **WHEN** `buffer.drawText("Bold", x, y, white, black, ATTR_BOLD)` is called
- **THEN** the text SHALL be rendered with bold attribute

#### Scenario: Constants can be combined
- **WHEN** `buffer.drawText("Bold+Italic", x, y, white, black, ATTR_BOLD | ATTR_ITALIC)` is called
- **THEN** the text SHALL be rendered with both bold and italic attributes

## Invariants

- `getRealCharBytes` decodes the native cell grid to UTF-8. Wide characters are emitted once; continuation cells are skipped.
- `getSpanLines` merges adjacent cells with identical fg/bg/attributes into spans to reduce output size.
- Drawing outside bounds is silently clipped; no exception is thrown.
- The buffer class does not leak `bun:ffi`, `node:ffi`, or `Deno.*` types in its public interface.
- Pointer safety: after any operation that may reallocate the native buffer (resize, swap), the buffer wrapper reads fresh pointers.
