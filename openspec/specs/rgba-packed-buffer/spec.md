# rgba-packed-buffer

Factory for constructing RGBA instances from pre-packed native buffers.

## Overview

Provides `RGBA.fromPackedBuffer()` for constructing RGBA instances from `Uint16Array` data read directly from native memory, avoiding re-encoding overhead when the buffer is already packed.

## Requirements

### Requirement: RGBA class SHALL provide fromPackedBuffer factory

The `RGBA` class SHALL provide a static `fromPackedBuffer(buffer: Uint16Array)` method that constructs an RGBA instance from a pre-packed `Uint16Array(4)` read from native memory, without applying `packComponent` transformation.

#### Scenario: Construct from valid packed buffer
- **WHEN** `RGBA.fromPackedBuffer(new Uint16Array([0x00FF, 0x0080, 0x0000, 0xFFFF]))` is called
- **THEN** the result SHALL be an `RGBA` instance
- **AND** `rgba.buffer[0]` SHALL equal `0x00FF` (no double-encoding)
- **AND** `rgba.r` SHALL return `255`
- **AND** `rgba.intent` SHALL return `ColorIntent.Rgb`

#### Scenario: Reject buffer with wrong length
- **WHEN** `RGBA.fromPackedBuffer(new Uint16Array([1, 2, 3]))` is called with a buffer of length 3
- **THEN** it SHALL throw an `Error` with message containing "expected length 4"

#### Scenario: Reject empty buffer
- **WHEN** `RGBA.fromPackedBuffer(new Uint16Array([]))` is called
- **THEN** it SHALL throw an `Error`
