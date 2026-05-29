## Purpose

Defines the output sink abstraction that replaces `Box<dyn Write + Send>` with a safe enum, eliminating unsafe downcasting for test output capture.

## Requirements

### Requirement: OutputSink SHALL be an enum with two variants

The renderer output target SHALL be an `OutputSink` enum with `Stdout` and `Captured(Vec<u8>)` variants. Both variants SHALL implement `std::io::Write`.

#### Scenario: Stdout variant writes to stdout
- **WHEN** writing bytes to `OutputSink::Stdout`
- **THEN** bytes are written to `io::stdout()`

#### Scenario: Captured variant stores bytes in-memory
- **WHEN** writing bytes to `OutputSink::Captured(Vec::new())`
- **THEN** bytes are appended to the internal vector

#### Scenario: Multiple writes accumulate in Captured
- **WHEN** writing "hello" then " world" to `OutputSink::Captured`
- **THEN** the internal data equals "hello world"

### Requirement: Captured variant SHALL expose data accessor

The `Captured` variant SHALL provide `data()` returning `&[u8]` and `clear()` resetting the internal buffer.

#### Scenario: data() returns written bytes
- **WHEN** `OutputSink::Captured(vec).data()` is called after a write
- **THEN** it returns the accumulated bytes

#### Scenario: clear() resets captured data
- **WHEN** `clear()` is called on a `Captured` variant
- **THEN** the internal buffer is emptied

### Requirement: FFI SHALL provide unified renderer creation

A single `createRenderer(width, height, test_mode: bool)` SHALL replace `createRenderer` and `createTestRenderer`. When `test_mode` is true, the renderer SHALL use `OutputSink::Captured`. When false, `OutputSink::Stdout`.

#### Scenario: test_mode=true creates Captured renderer
- **WHEN** `createRenderer(80, 24, true)` is called
- **THEN** the returned renderer uses `OutputSink::Captured`

#### Scenario: test_mode=false creates Stdout renderer
- **WHEN** `createRenderer(80, 24, false)` is called
- **THEN** the returned renderer uses `OutputSink::Stdout`

### Requirement: FFI SHALL provide safe captured output access

A `getCapturedOutput(renderer, out_len)` function SHALL return the captured output data pointer and length without unsafe downcasting. It SHALL return null if the renderer does not use `OutputSink::Captured`.

#### Scenario: getCapturedOutput returns captured data
- **WHEN** called on a test renderer after a render
- **THEN** it returns a pointer to the captured bytes and sets `out_len`

#### Scenario: getCapturedOutput returns null for stdout renderer
- **WHEN** called on a non-test renderer
- **THEN** it returns null and out_len is unchanged
