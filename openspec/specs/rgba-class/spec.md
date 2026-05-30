# rgba-class

Pre-allocated RGBA color buffer class for zero-allocation draw calls.

## Overview

The `RGBA` class provides a reusable, pre-allocated color buffer backed by `Uint16Array(4)` with a `DataView`, eliminating per-draw-call allocations when the same color is reused.

## Requirements

### Requirement: RGBA class holds pre-allocated color buffer
The `RGBA` class SHALL store color channels in a pre-allocated `Uint16Array(4)`. Construction SHALL accept individual channel values `(r, g, b, a?)` where `a` defaults to `65535`. Each channel value SHALL be packed into the low byte of the `u16`, with the `ColorIntent` stored in the high byte. The class SHALL also provide a static `fromPackedBuffer(buffer: Uint16Array)` factory that constructs from pre-packed data without re-encoding.

#### Scenario: Construct RGBA with all channels
- **WHEN** `new RGBA(255, 128, 0, 65535)` is called
- **THEN** `rgba.buffer` SHALL be a `Uint16Array` with packed values
- **AND** `rgba.buffer[0]` SHALL equal `0x00FF` (Rgb intent in high byte, 255 in low byte)
- **AND** the `view` property SHALL NOT exist on the instance

#### Scenario: Construct RGBA with default alpha
- **WHEN** `new RGBA(255, 128, 0)` is called
- **THEN** `rgba.buffer[3]` SHALL be packed with alpha 255 and Rgb intent

#### Scenario: Construct RGBA with Indexed intent
- **WHEN** `new RGBA(255, 0, 0, 65535, ColorIntent.Indexed)` is called
- **THEN** `rgba.buffer[0]` SHALL have Indexed intent in high byte
- **AND** `rgba.intent` getter SHALL return `ColorIntent.Indexed`

#### Scenario: Construct RGBA with Default intent
- **WHEN** `new RGBA(0, 0, 0, 65535, ColorIntent.Default)` is called
- **THEN** `rgba.intent` getter SHALL return `ColorIntent.Default`

#### Scenario: Construct from pre-packed buffer
- **WHEN** `RGBA.fromPackedBuffer(packedUint16Array)` is called
- **THEN** the result SHALL be an `RGBA` instance with `buffer` equal to the input array
- **AND** no `packComponent` transformation SHALL be applied

### Requirement: RGBA class exposes channel accessors
The `RGBA` class SHALL provide read-only accessors for individual color channels. The accessors SHALL extract the 8-bit value from the low byte of each `u16`.

#### Scenario: Read channel values
- **WHEN** `rgba.r`, `rgba.g`, `rgba.b`, `rgba.a` are accessed
- **THEN** they SHALL return the 8-bit channel values (0-255)

#### Scenario: Read intent
- **WHEN** `rgba.intent` is accessed
- **THEN** it SHALL return the `ColorIntent` stored in the high byte

### Requirement: toRGBA helper accepts plain objects
A `toRGBA()` helper function SHALL accept both `RGBA` class instances and plain `{r, g, b, a}` objects, returning an `RGBA` class instance in both cases. The intent SHALL default to `ColorIntent.Rgb`.

#### Scenario: Plain object is converted to RGBA class
- **WHEN** `toRGBA({ r: 255, g: 128, b: 0, a: 65535 })` is called
- **THEN** the result SHALL be an `RGBA` class instance with Rgb intent

#### Scenario: RGBA instance is returned as-is
- **WHEN** `toRGBA(existingRGBA)` is called where `existingRGBA` is already an `RGBA` instance
- **THEN** the same instance SHALL be returned without creating a new object

#### Scenario: Plain object with missing alpha defaults to 65535
- **WHEN** `toRGBA({ r: 255, g: 128, b: 0 })` is called
- **THEN** the result SHALL have `a === 255` (unpacked from 65535)

### Requirement: RGBA class is exported from public API
The `RGBA` class and `toRGBA()` helper SHALL be exported from `@moontui/core`.

#### Scenario: Import RGBA class
- **WHEN** a consumer imports `{ RGBA }` from `@moontui/core`
- **THEN** they SHALL receive the `RGBA` class constructor

#### Scenario: Import toRGBA helper
- **WHEN** a consumer imports `{ toRGBA }` from `@moontui/core`
- **THEN** they SHALL receive the `toRGBA` helper function

### Requirement: Draw methods accept both RGBA class and plain objects
All `MoonBuffer` draw methods that accept color parameters SHALL accept both `RGBA` class instances and plain `{r, g, b, a?}` objects.

#### Scenario: drawText with RGBA class instance
- **WHEN** `buffer.drawText("hi", 0, 0, new RGBA(255, 255, 255))` is called
- **THEN** the text SHALL be drawn with the specified color
- **AND** no new `Uint8Array` SHALL be allocated for the color

#### Scenario: drawText with plain object
- **WHEN** `buffer.drawText("hi", 0, 0, { r: 255, g: 255, b: 255 })` is called
- **THEN** the text SHALL be drawn with the specified color
- **AND** the plain object SHALL be converted via `toRGBA()` internally

### Requirement: ColorIntent enum export
The `ColorIntent` enum SHALL be exported from `@moontui/core` with variants `Rgb`, `Indexed`, and `Default`.

#### Scenario: Import ColorIntent
- **WHEN** a consumer imports `{ ColorIntent }` from `@moontui/core`
- **THEN** they SHALL receive the enum with all three variants

### Requirement: Convenience constructors
The module SHALL provide `rgb()`, `indexed()`, and `terminalDefault()` helper functions that create RGBA values with the appropriate intent.

#### Scenario: Create RGB color with helper
- **WHEN** `rgb(255, 0, 0)` is called
- **THEN** the result SHALL be an RGBA with Rgb intent

#### Scenario: Create indexed color with helper
- **WHEN** `indexed(9, 255, 0, 0)` is called
- **THEN** the result SHALL be an RGBA with Indexed intent and slot 9