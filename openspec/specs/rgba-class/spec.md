# rgba-class

Pre-allocated RGBA color buffer class for zero-allocation draw calls.

## Overview

The `RGBA` class provides a reusable, pre-allocated color buffer backed by `Uint16Array(4)` with a `DataView`, eliminating per-draw-call allocations when the same color is reused.

## Requirements

### Requirement: RGBA class holds pre-allocated color buffer
The `RGBA` class SHALL store color channels in a pre-allocated `Uint16Array(4)`. Construction SHALL accept individual channel values `(r, g, b, a?)` where `a` defaults to `65535`.

#### Scenario: Construct RGBA with all channels
- **WHEN** `new RGBA(255, 128, 0, 65535)` is called
- **THEN** `rgba.buffer` SHALL be a `Uint16Array` with values `[255, 128, 0, 65535]`
- **AND** the `view` property SHALL NOT exist on the instance

#### Scenario: Construct RGBA with default alpha
- **WHEN** `new RGBA(255, 128, 0)` is called
- **THEN** `rgba.buffer[3]` SHALL be `65535`

#### Scenario: RGBA buffer is reusable across draw calls
- **WHEN** the same `RGBA` instance is passed to multiple draw methods
- **THEN** no new `Uint16Array` SHALL be allocated
- **AND** the same `rgba.buffer` SHALL be used for all cell writes

### Requirement: RGBA class exposes channel accessors
The `RGBA` class SHALL provide read-only accessors for individual color channels.

#### Scenario: Read channel values
- **WHEN** `rgba.r`, `rgba.g`, `rgba.b`, `rgba.a` are accessed
- **THEN** they SHALL return the corresponding `Uint16Array` element values

### Requirement: toRGBA helper accepts plain objects
A `toRGBA()` helper function SHALL accept both `RGBA` class instances and plain `{r, g, b, a}` objects, returning an `RGBA` class instance in both cases.

#### Scenario: Plain object is converted to RGBA class
- **WHEN** `toRGBA({ r: 255, g: 128, b: 0, a: 65535 })` is called
- **THEN** the result SHALL be an `RGBA` class instance with matching channel values

#### Scenario: RGBA instance is returned as-is
- **WHEN** `toRGBA(existingRGBA)` is called where `existingRGBA` is already an `RGBA` instance
- **THEN** the same instance SHALL be returned without creating a new object

#### Scenario: Plain object with missing alpha defaults to 65535
- **WHEN** `toRGBA({ r: 255, g: 128, b: 0 })` is called
- **THEN** the result SHALL have `a === 65535`

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
