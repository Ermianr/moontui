# buffer-model

## Purpose
Defines buffer cell storage, drawing authority, hot-path behavior, native and TypeScript buffer access, shared memory views, RGBA packing, and color intent behavior.

## Requirements

<!-- Preserved from openspec/specs/buffer-cell-storage/spec.md. -->

### Requirement: Buffer initialization uses terminal-default colors
A newly created `OptimizedBuffer` SHALL initialize all cells with `ColorIntent::Default` for both foreground and background colors, producing `\x1B[39m` and `\x1B[49m` escape sequences respectively.

#### Scenario: New buffer cells emit default color intents
- **WHEN** `OptimizedBuffer::new()` is called
- **THEN** all fg values have `ColorIntent::Default` and all bg values have `ColorIntent::Default`

#### Scenario: Diff engine correctly handles default-initialized cells
- **WHEN** a new buffer is diffed against a previously rendered buffer with explicit RGB colors
- **THEN** the diff engine emits `\x1B[39m` and `\x1B[49m` for cells that have not been drawn over

### Requirement: Buffer clear uses terminal-default foreground
The `clear()` method SHALL default the foreground color to `ColorIntent::Default` instead of `rgb_color(0, 0, 0, 255)`.

#### Scenario: Clear produces default fg
- **WHEN** `clear(bg)` is called on a buffer
- **THEN** all cells have the provided bg color and fg set to `ColorIntent::Default`

#### Scenario: Clear with explicit fg parameter
- **WHEN** `clear(bg, fg)` is called with a foreground color
- **THEN** all cells use the provided fg and bg colors

### Requirement: Setup terminal aligns with buffer defaults
The `setup_terminal` method SHALL ensure the initial screen clear does not produce a visible flash of black on non-black terminals.

#### Scenario: Setup produces clean initial state
- **WHEN** `setup_terminal()` is called
- **THEN** the terminal is cleared and the first forced render uses cells with `ColorIntent::Default` bg, avoiding black artifacts

<!-- Preserved from openspec/specs/buffer-drawing-authority/spec.md. -->

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

<!-- Preserved from openspec/specs/buffer-hot-path-optimization/spec.md. -->

### Requirement: Buffer hot-path uses extracted row_start variable
The `OptimizedBuffer` methods `draw_text`, `write_resolved_chars`, and `real_char_size` SHALL compute the row start index once per row iteration instead of recomputing `y * width` on every cell.

#### Scenario: draw_text computes row_start once per row
- **WHEN** `draw_text` iterates over cells in a row
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once before the character loop
- **AND** cell access SHALL use `row_start + cx` instead of `(y as usize) * (self.width as usize) + (cx as usize)`

#### Scenario: write_resolved_chars computes row_start once per row
- **WHEN** `write_resolved_chars` iterates over cells in a row
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once before the column loop
- **AND** cell access SHALL use `row_start + x` instead of `(y as usize) * stride + (x as usize)`

#### Scenario: real_char_size computes row_start once per row
- **WHEN** `real_char_size` iterates over cells in a row
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once before the column loop
- **AND** cell access SHALL use `row_start + x` instead of `(y as usize) * stride + (x as usize)`

### Requirement: ANSI writes use single buffer in terminal setup/teardown
The `setup_terminal` and `restore_terminal` methods SHALL use a single `Vec<u8>` buffer for all ANSI sequences instead of creating separate allocations per sequence.

#### Scenario: setup_terminal uses one buffer
- **WHEN** `setup_terminal` is called
- **THEN** it SHALL create one `Vec<u8>` buffer
- **AND** it SHALL write all ANSI sequences (alt screen, clear, hide cursor) into that buffer
- **AND** it SHALL flush the buffer once at the end

#### Scenario: restore_terminal uses one buffer
- **WHEN** `restore_terminal` is called
- **THEN** it SHALL create one `Vec<u8>` buffer
- **AND** it SHALL write all ANSI sequences (show cursor, exit alt screen) into that buffer
- **AND** it SHALL flush the buffer once at the end

<!-- Preserved from openspec/specs/native-buffer/spec.md. -->

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

<!-- Preserved from openspec/specs/ts-buffer/spec.md. -->

### Requirement: MoonBuffer exposes ergonomic TypeScript drawing and inspection API
MoonBuffer SHALL provide native-backed drawing, clearing, and inspection methods through a TypeScript wrapper.

#### Scenario: TypeScript buffer API is available
- **WHEN** consumers use MoonBuffer
- **THEN** the wrapper SHALL support the following operations:
  1. `clear(bgColor)` fills the buffer with a background color.
  2. `drawText(text, x, y, fgColor, bgColor?, attributes?)` draws a UTF-8 string starting at (x, y).
  3. `drawBox(options)` draws a bordered rectangle with configurable sides, fill, title, and colors.
  4. `drawChar(charCodepoint, x, y, fgColor, bgColor?, attributes?)` draws a single cell.
  5. `fillRect(x, y, width, height, bgColor)` fills a rectangular region.
  6. `getRealCharBytes(addLineBreaks?)` returns a `Uint8Array` of the resolved character content (for testing and inspection).
  7. `getSpanLines()` returns an array of lines, each containing spans of text with uniform style (fg, bg, attributes). Useful for snapshot testing.
  8. `width` and `height` are read-only properties.

### Requirement: MoonBuffer reads fresh native buffer views
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

### Requirement: MoonBuffer drawing methods use marshalled API calls
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

### Requirement: MoonBuffer avoids runtime-specific FFI imports
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

### Requirement: MoonBuffer exports attribute flag constants
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

<!-- Preserved from openspec/specs/shared-memory-buffer/spec.md. -->

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

<!-- Preserved from openspec/specs/rgba-packed-buffer/spec.md. -->

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

<!-- Preserved from openspec/specs/rgba-class/spec.md. -->

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

<!-- Preserved from openspec/specs/color-intent/spec.md. -->

### Requirement: Color intent enum
The system SHALL define a `ColorIntent` enum with three variants: `Rgb`, `Indexed`, and `Default`.

#### Scenario: Color intent values
- **WHEN** a ColorIntent is created
- **THEN** it SHALL be one of: Rgb (0), Indexed (1), Default (2)

### Requirement: RGB color constructor
The system SHALL provide an `rgb_color(r, g, b, a)` function that creates an RGBA value with `ColorIntent::Rgb`.

#### Scenario: Create RGB color
- **WHEN** `rgb_color(255, 0, 0, 255)` is called
- **THEN** the returned RGBA SHALL have intent = Rgb
- **AND** the channel values SHALL be (255, 0, 0, 255)

### Requirement: Indexed color constructor
The system SHALL provide an `indexed_color(index, r, g, b)` function that creates an RGBA value with `ColorIntent::Indexed`.

#### Scenario: Create indexed color
- **WHEN** `indexed_color(9, 255, 0, 0)` is called
- **THEN** the returned RGBA SHALL have intent = Indexed
- **AND** the slot SHALL be 9
- **AND** the RGB snapshot SHALL be (255, 0, 0)

### Requirement: Default color constructor
The system SHALL provide a `default_color(r, g, b, a)` function that creates an RGBA value with `ColorIntent::Default`.

#### Scenario: Create default color
- **WHEN** `default_color(0, 0, 0, 255)` is called
- **THEN** the returned RGBA SHALL have intent = Default

### Requirement: Color intent accessor
The system SHALL provide an `intent(color)` function that extracts the ColorIntent from an RGBA value.

#### Scenario: Extract RGB intent
- **WHEN** an RGBA value with Rgb intent is created
- **AND** `intent(color)` is called
- **THEN** the result SHALL be ColorIntent::Rgb

#### Scenario: Extract indexed intent
- **WHEN** an RGBA value with Indexed intent is created
- **AND** `intent(color)` is called
- **THEN** the result SHALL be ColorIntent::Indexed

### Requirement: Palette slot accessor
The system SHALL provide a `slot(color)` function that extracts the palette slot from an indexed RGBA value.

#### Scenario: Extract palette slot
- **WHEN** `indexed_color(9, 255, 0, 0)` is created
- **AND** `slot(color)` is called
- **THEN** the result SHALL be 9

### Requirement: Channel accessors
The system SHALL provide `red(color)`, `green(color)`, `blue(color)`, and `alpha(color)` functions that extract 8-bit channel values.

#### Scenario: Extract red channel
- **WHEN** `rgb_color(255, 128, 0, 255)` is created
- **AND** `red(color)` is called
- **THEN** the result SHALL be 255

#### Scenario: Extract green channel
- **WHEN** `rgb_color(255, 128, 0, 255)` is created
- **AND** `green(color)` is called
- **THEN** the result SHALL be 128

### Requirement: ANSI 256-color palette
The system SHALL provide a `fallback_ansi256_color(index)` function that converts an ANSI 256-color index to an RGB color.

#### Scenario: Base 16 colors
- **WHEN** `fallback_ansi256_color(9)` is called
- **THEN** the result SHALL be (255, 0, 0, 255) with intent Rgb

#### Scenario: 6x6x6 color cube
- **WHEN** `fallback_ansi256_color(21)` is called
- **THEN** the result SHALL be (0, 0, 255, 255) with intent Rgb

#### Scenario: Grayscale ramp
- **WHEN** `fallback_ansi256_color(232)` is called
- **THEN** the result SHALL be approximately (8, 8, 8, 255) with intent Rgb

### Requirement: Color equality comparison
Two RGBA values SHALL be considered equal if and only if all four components are bitwise identical (including metadata).

#### Scenario: Same color same intent
- **WHEN** two RGBA values are created with the same channels and intent
- **THEN** they SHALL be equal

#### Scenario: Same channels different intent
- **WHEN** two RGBA values have the same channels but different intents
- **THEN** they SHALL NOT be equal

<!-- Synced from openspec/changes/cleanup-openspec-specs/specs/buffer-model/spec.md. -->

### Requirement: Buffer model contract is consolidated
The buffer model spec SHALL cover cell storage, drawing authority, color packing, shared memory views, hot-path behavior, and TypeScript buffer access.

#### Scenario: Future buffer change selects one capability
- **WHEN** a future change modifies buffer cells, drawing methods, RGBA packing, shared buffer views, or TypeScript buffer wrappers
- **THEN** the change targets `buffer-model` rather than a one-off buffer implementation spec

### Requirement: Drawing authority remains explicit
The buffer model SHALL state which side of the Rust/TypeScript boundary owns drawing operations.

#### Scenario: Draw method behavior changes
- **WHEN** drawing behavior changes for text, boxes, characters, rectangles, or clear operations
- **THEN** the relevant spec makes the Rust/TypeScript drawing responsibility explicit

### Requirement: Buffer hot paths remain allocation-conscious
Buffer model requirements SHALL preserve performance-sensitive constraints for drawing and cell traversal paths.

#### Scenario: Hot-path implementation changes
- **WHEN** a buffer hot path is modified
- **THEN** the change avoids unnecessary allocation or repeated index work unless justified by tests or measurements
