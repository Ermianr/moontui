# buffer-drawing-authority

## Purpose

Establishes Rust as the sole drawing authority for the terminal buffer. All buffer write operations are delegated to the Rust `OptimizedBuffer` via FFI, while TypeScript retains DataView-based read access for zero-overhead reads. This collapses the dual-drawing-path into a single authoritative implementation.

## Requirements

### Requirement: Rust is the sole drawing authority
All buffer write operations (drawText, drawBox, fillRect, drawChar, clear) SHALL be executed by the Rust `OptimizedBuffer` implementation. TypeScript's `MoonBuffer` SHALL delegate to Rust via FFI calls and SHALL NOT write directly to native memory.

#### Scenario: drawText delegates to Rust
- **WHEN** `MoonBuffer.drawText(text, x, y, fg, bg, attrs)` is called
- **THEN** the call SHALL be forwarded to `bufferDrawText` via FFI, which invokes `OptimizedBuffer::draw_text` in Rust

#### Scenario: drawBox delegates to Rust
- **WHEN** `MoonBuffer.drawBox(options)` is called
- **THEN** the call SHALL be forwarded to `bufferDrawBox` via FFI, which invokes `OptimizedBuffer::draw_box` in Rust

#### Scenario: fillRect delegates to Rust
- **WHEN** `MoonBuffer.fillRect(x, y, w, h, bg)` is called
- **THEN** the call SHALL be forwarded to `bufferFillRect` via FFI, which invokes `OptimizedBuffer::fill_rect` in Rust

#### Scenario: drawChar delegates to Rust
- **WHEN** `MoonBuffer.drawChar(codepoint, x, y, fg, bg, attrs)` is called
- **THEN** the call SHALL be forwarded to `bufferDrawChar` via FFI, which invokes `OptimizedBuffer::draw_char` in Rust

#### Scenario: clear delegates to Rust
- **WHEN** `MoonBuffer.clear(bg)` is called
- **THEN** the call SHALL be forwarded to `bufferClear` via FFI, which invokes `OptimizedBuffer::clear` in Rust

### Requirement: Wide character handling in drawText
`MoonBuffer.drawText` SHALL correctly handle wide characters (CJK, emoji) by delegating to Rust's `OptimizedBuffer::draw_text`, which uses `unicode_width` to determine character width and marks continuation cells with `ATTR_CONTINUATION`.

#### Scenario: CJK character occupies two cells
- **WHEN** `drawText("あ", 0, 0, fg, bg, 0)` is called on a buffer
- **THEN** cell (0,0) SHALL contain the codepoint for "あ" with no continuation flag
- **THEN** cell (1,0) SHALL contain codepoint 0 with the `ATTR_CONTINUATION` flag set

#### Scenario: Mixed-width text renders correctly
- **WHEN** `drawText("Hiあ", 0, 0, fg, bg, 0)` is called on a buffer
- **THEN** cell (0,0) SHALL contain 'H', cell (1,0) SHALL contain 'i'
- **THEN** cell (2,0) SHALL contain 'あ', cell (3,0) SHALL be a continuation cell

### Requirement: DataView retained for read operations
`MoonBuffer.getSpanLines()` SHALL continue to read buffer contents via DataView for zero-overhead access. The DataView pointers SHALL reflect the current state of the buffer after any FFI write operations.

#### Scenario: getSpanLines reads after FFI write
- **WHEN** `drawText("Hello", 0, 0, fg, bg, 0)` is called via FFI
- **THEN** a subsequent call to `getSpanLines()` SHALL return span lines reflecting the written text

### Requirement: FFI exports for drawing operations
The Rust FFI layer SHALL export the following functions: `bufferDrawText`, `bufferDrawBox`, `bufferFillRect`, `bufferDrawChar`, `bufferClear`. Each function SHALL take the buffer pointer as the first argument and forward to the corresponding `OptimizedBuffer` method.

#### Scenario: bufferDrawText accepts UTF-8 text via pointer
- **WHEN** `bufferDrawText(buf_ptr, text_ptr, text_len, x, y, fg_ptr, bg_ptr, attrs)` is called
- **THEN** the function SHALL construct a `&str` from `text_ptr` and `text_len` without allocation
- **THEN** the function SHALL invoke `OptimizedBuffer::draw_text` with the decoded string

#### Scenario: FFI functions validate buffer pointer
- **WHEN** any buffer drawing FFI function is called with a null buffer pointer
- **THEN** the function SHALL return immediately without panicking

### Requirement: MoonBuffer public API unchanged
The public method signatures of `MoonBuffer` (`drawText`, `drawBox`, `fillRect`, `drawChar`, `clear`, `getSpanLines`) SHALL remain identical. Only the internal implementation changes from direct DataView writes to FFI delegation.

#### Scenario: Existing MoonBuffer consumers unaffected
- **WHEN** a consumer calls `MoonBuffer.drawText("Hello", 5, 3, fgColor, bgColor)` with the same arguments as before this change
- **THEN** the visual result on the rendered terminal SHALL be identical
