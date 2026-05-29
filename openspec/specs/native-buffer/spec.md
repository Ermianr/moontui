# native-buffer

Low-level cell grid buffer exposed by the Rust core via C ABI.

## Overview

An `OptimizedBuffer` is a width × height grid of cells. Each cell stores a Unicode codepoint, foreground color, background color, and style attributes. The buffer is write-only from the FFI side; reads happen via dedicated exports that serialize cell content to a byte slice.

## Requirements

1. A buffer can be created with dimensions width × height, where width ≥ 1 and height ≥ 1.
2. Each cell stores: `char` (Unicode codepoint as `u32`), `fg` (RGBA packed as 4 × `u16`), `bg` (RGBA packed as 4 × `u16`), `attributes` (`u32` bitflags for bold, italic, underline).
3. Drawing commands are clipped to the buffer bounds. Writing outside the buffer is a no-op, never a panic.
4. Wide characters (grapheme clusters with display width > 1) occupy the target cell and mark the following cell(s) as continuation placeholders.
5. `bufferClear` fills every cell with a given background color and resets attributes to 0.
6. `bufferWriteResolvedChars` serializes the buffer content to UTF-8 bytes, optionally adding `\n` after each row.
7. `bufferGetCharPtr` returns a raw pointer to the character grid for zero-copy inspection from TypeScript.

## C ABI Exports

```c
// Creation and destruction are managed by the renderer; the buffer itself
// is not created standalone. These are on the renderer struct.
// However, these buffer-level operations are exposed:

void bufferClear(OptimizedBuffer* buf, const uint16_t* bg_rgba);

// Draw text at (x, y) with given fg/bg and attributes.
// text is UTF-8 encoded. Returns void; clips on bounds.
void bufferDrawText(
    OptimizedBuffer* buf,
    const char* text, size_t text_len,
    uint32_t x, uint32_t y,
    const uint16_t* fg_rgba,
    const uint16_t* bg_rgba,
    uint32_t attributes
);

// Draw a box border with optional fill.
// border_chars is a uint32_t[8] array: [top-left, top, top-right, right,
//   bottom-right, bottom, bottom-left, left].
void bufferDrawBox(
    OptimizedBuffer* buf,
    int32_t x, int32_t y,
    uint32_t width, uint32_t height,
    const uint32_t* border_chars,
    uint32_t packed_options,  // bitflags for sides, fill, alignment
    const uint16_t* border_color,
    const uint16_t* bg_color
);

// Draw a single character (already encoded by TypeScript if needed).
void bufferDrawChar(
    OptimizedBuffer* buf,
    uint32_t char_codepoint,
    uint32_t x, uint32_t y,
    const uint16_t* fg_rgba,
    const uint16_t* bg_rgba,
    uint32_t attributes
);

// Fill a rectangle with a solid background color.
void bufferFillRect(
    OptimizedBuffer* buf,
    uint32_t x, uint32_t y,
    uint32_t width, uint32_t height,
    const uint16_t* bg_rgba
);

// Get pointer to char grid (u32 array of width*height).
// Lifetime is tied to the buffer; do not free.
uint32_t* bufferGetCharPtr(OptimizedBuffer* buf);

// Get pointer to fg grid (RGBA array of width*height).
uint16_t* bufferGetFgPtr(OptimizedBuffer* buf);

// Get pointer to bg grid (RGBA array of width*height).
uint16_t* bufferGetBgPtr(OptimizedBuffer* buf);

// Get pointer to attributes grid (u32 array of width*height).
uint32_t* bufferGetAttributesPtr(OptimizedBuffer* buf);

// Returns the byte size needed for a resolved char output.
uint32_t bufferGetRealCharSize(OptimizedBuffer* buf);

// Serialize buffer content to output_ptr as UTF-8.
// If add_line_breaks is true, inserts '\n' after each row.
// Returns number of bytes written.
uint32_t bufferWriteResolvedChars(
    OptimizedBuffer* buf,
    uint8_t* output_ptr, size_t output_len,
    bool add_line_breaks
);
```

## Invariants

- A cell with char == 0 renders as a space.
- A cell with the continuation flag set is not emitted as a character by `bufferWriteResolvedChars`.
- All drawing operations are atomic with respect to a single call; partial writes do not occur.
- The buffer dimensions are immutable after creation; resize requires creating a new renderer.

## Optimized Index Computation

### Requirement: Drawing operations use optimized index computation
The `OptimizedBuffer` drawing methods SHALL use extracted row-start variables for index computation instead of recomputing `y * width` on every cell access.

#### Scenario: draw_text uses row_start extraction
- **WHEN** `draw_text` is called with text at position (x, y)
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once per row
- **AND** all cell accesses in that row SHALL use `row_start + column_offset`
- **AND** the behavior (clipping, continuation marks) SHALL be unchanged

#### Scenario: write_resolved_chars uses row_start extraction
- **WHEN** `write_resolved_chars` serializes the buffer
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once per row
- **AND** all cell accesses in that row SHALL use `row_start + x`
- **AND** the output bytes SHALL be identical to the current implementation

#### Scenario: real_char_size uses row_start extraction
- **WHEN** `real_char_size` calculates the output size
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once per row
- **AND** all cell accesses in that row SHALL use `row_start + x`
- **AND** the returned size SHALL be identical to the current implementation
