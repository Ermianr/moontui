# rendering-pipeline

## Purpose
Defines renderer output, ANSI generation, diff rendering, frame timing, output capture, native renderer behavior, TypeScript renderer behavior, renderer guards, and backend-visible rendering semantics.

## Requirements

<!-- Preserved from openspec/specs/ansi-generation/spec.md. -->

### Requirement: ANSI functions SHALL write to a provided buffer

All ANSI escape generation functions SHALL accept `&mut Vec<u8>` as the output target and use `write!` macro to append content. No function SHALL allocate a new `Vec<u8>` internally.

#### Scenario: write_fg produces correct foreground color escape
- **WHEN** `write_fg(&mut out, color, caps)` is called with an Rgb intent color and caps.rgb = true
- **THEN** `out` contains `\x1B[38;2;R;G;Bm` with the correct 8-bit color values

#### Scenario: write_fg produces indexed escape for indexed color
- **WHEN** `write_fg(&mut out, color, caps)` is called with an Indexed intent color and caps.ansi256 = true
- **THEN** `out` contains `\x1B[38;5;{slot}m`

#### Scenario: write_fg produces default escape for default color
- **WHEN** `write_fg(&mut out, color, caps)` is called with a Default intent color
- **THEN** `out` contains `\x1B[39m`

#### Scenario: write_fg falls back to indexed for rgb on non-rgb terminal
- **WHEN** `write_fg(&mut out, color, caps)` is called with an Rgb intent color and caps.rgb = false
- **THEN** `out` contains `\x1B[38;5;{nearest_index}m` (quantized to 256-color)

#### Scenario: write_bg produces correct background color escape
- **WHEN** `write_bg(&mut out, color, caps)` is called with an Rgb intent color and caps.rgb = true
- **THEN** `out` contains `\x1B[48;2;R;G;Bm` with the correct 8-bit color values

#### Scenario: write_bg produces indexed escape for indexed color
- **WHEN** `write_bg(&mut out, color, caps)` is called with an Indexed intent color and caps.ansi256 = true
- **THEN** `out` contains `\x1B[48;5;{slot}m`

#### Scenario: write_bg produces default escape for default color
- **WHEN** `write_bg(&mut out, color, caps)` is called with a Default intent color
- **THEN** `out` contains `\x1B[49m`

#### Scenario: write_style produces correct style escape
- **WHEN** `write_style(&mut out, attrs)` is called with bold+underline attributes
- **THEN** `out` contains `\x1B[0;1;4m`

#### Scenario: write_style with no attributes produces reset-only escape
- **WHEN** `write_style(&mut out, 0)` is called
- **THEN** `out` contains `\x1B[0m`

#### Scenario: write_move_cursor positions correctly
- **WHEN** `write_move_cursor(&mut out, x, y)` is called
- **THEN** `out` contains `\x1B[Y+1;X+1H` (1-indexed, as ANSI requires)

#### Scenario: write_hide_cursor and write_show_cursor
- **WHEN** the respective function is called
- **THEN** the correct DECTCEM escape sequence is appended

#### Scenario: Multiple calls append sequentially
- **WHEN** multiple ANSI write functions are called on the same buffer
- **THEN** each appends after the previous content, preserving sequence

### Requirement: Old return-alloc functions SHALL be removed

The old functions (`set_color_fg`, `set_color_bg`, `set_style`, `move_cursor`, `hide_cursor`, `show_cursor`, `enter_alt_screen`, `exit_alt_screen`, `clear_screen`) that return `Vec<u8>` SHALL be removed.

#### Scenario: No Vec<u8>-returning ansi functions exist
- **WHEN** inspecting the `ansi` module
- **THEN** every function takes `&mut Vec<u8>` as its first parameter

### Requirement: Nearest palette index quantization
The system SHALL provide a `nearest_palette_index(color)` function that quantizes an RGB color to the nearest ANSI 256-color palette index.

#### Scenario: Quantize red to palette
- **WHEN** `nearest_palette_index(rgb_color(255, 0, 0, 255))` is called
- **THEN** the result SHALL be 196 (ANSI index for pure red)

#### Scenario: Quantize blue to palette
- **WHEN** `nearest_palette_index(rgb_color(0, 0, 255, 255))` is called
- **THEN** the result SHALL be 21 (ANSI index for pure blue)

<!-- Preserved from openspec/specs/render-diff/spec.md. -->

### Requirement: System SHALL compute dirty rectangles between two buffers

The `DiffRenderer` SHALL expose a pure function that compares a front buffer and back buffer and returns a list of `DirtyRect` regions where cells differ. A cell SHALL be considered dirty if any of its fields (char, fg, bg, attributes) differ between buffers.

#### Scenario: Identical buffers produce no dirty rects
- **WHEN** front and back buffers are identical
- **THEN** the function returns an empty `Vec<DirtyRect>`

#### Scenario: Single cell change produces one dirty rect
- **WHEN** one cell differs between front and back buffers
- **THEN** the function returns a single `DirtyRect` covering that cell's position with width=1, height=1

#### Scenario: Full buffer difference produces full-frame rect
- **WHEN** every cell differs (e.g. after `clear()`)
- **THEN** the function returns dirty rects covering the full buffer area

#### Scenario: Contiguous dirty cells in a row merge into one span
- **WHEN** adjacent cells in the same row are dirty
- **THEN** they SHALL be returned as a single `DirtyRect` spanning from the first to the last dirty cell

#### Scenario: Clean cell at row start is skipped
- **WHEN** the first cell(s) of a row are clean
- **THEN** the dirty rect starts at the first dirty column, not at column 0

#### Scenario: Continuation cells do not trigger dirty detection
- **WHEN** only a continuation cell (ATTR_CONTINUATION flag set) differs
- **THEN** it SHALL NOT be treated as an independent dirty cell; the preceding base cell determines dirtiness

### Requirement: Dirty rect computation SHALL NOT merge across rows

Each dirty rect SHALL have height=1. Adjacent rows with identical dirty spans SHALL remain separate rects.

#### Scenario: Two dirty rows with same span produce two rects
- **WHEN** rows 2 and 3 both have dirty cells in columns 3-5
- **THEN** two `DirtyRect`s are returned: one for row 2, one for row 3

### Requirement: Render function SHALL produce ANSI from dirty rects

The `DiffRenderer::render()` method SHALL take a list of `DirtyRect`s, a back buffer, cursor state, terminal capabilities, and an output buffer reference, and append ANSI escape sequences and characters to the output buffer. The capabilities parameter SHALL be used to determine the appropriate ANSI sequences for color emission.

#### Scenario: Render skips continuation cells
- **WHEN** a cell has the ATTR_CONTINUATION flag set
- **THEN** it SHALL be skipped and not written to the output

#### Scenario: Render emits minimal ANSI escapes
- **WHEN** consecutive cells share the same FG, BG, and attributes
- **THEN** the ANSI escape SHALL only be emitted on the first cell, not repeated

#### Scenario: Render emits cursor position for each row
- **WHEN** rendering a dirty rect
- **THEN** a cursor-positioning escape SHALL precede each row

#### Scenario: Render handles cursor visibility
- **WHEN** cursor is visible
- **THEN** cursor move + show escape SHALL be appended after cell output
- **WHEN** cursor is hidden
- **THEN** hide cursor escape SHALL be appended after cell output

#### Scenario: Render returns cell count
- **WHEN** rendering completes
- **THEN** the method returns the count of non-continuation cells written

#### Scenario: Render uses capabilities for color emission
- **WHEN** a cell has Rgb intent color and caps.rgb = true
- **THEN** the renderer SHALL emit `\x1B[38;2;R;G;Bm`

#### Scenario: Render falls back to indexed for non-rgb terminal
- **WHEN** a cell has Rgb intent color and caps.rgb = false
- **THEN** the renderer SHALL quantize to nearest palette index and emit `\x1B[38;5;{index}m`

#### Scenario: Render emits indexed color directly
- **WHEN** a cell has Indexed intent color and caps.ansi256 = true
- **THEN** the renderer SHALL emit `\x1B[38;5;{slot}m`

#### Scenario: Render emits default color
- **WHEN** a cell has Default intent color
- **THEN** the renderer SHALL emit `\x1B[39m` (foreground) or `\x1B[49m` (background)

### Requirement: DiffRenderer SHALL store terminal capabilities

The `DiffRenderer` struct SHALL store a `Capabilities` instance that is set during construction or via a setter method.

#### Scenario: DiffRenderer receives capabilities
- **WHEN** a DiffRenderer is created with capabilities
- **THEN** the capabilities SHALL be stored and used for all subsequent render calls

<!-- Preserved from openspec/specs/output-capture/spec.md. -->

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

<!-- Preserved from openspec/specs/frame-timing/spec.md. -->

### Requirement: FrameStats SHALL record per-frame metrics

`FrameStats` SHALL provide a `record_frame(cells_updated, render_time_us, write_time_us)` method that updates frame count, running averages, and per-frame timings.

#### Scenario: First frame initializes averages
- **WHEN** `record_frame(25, 500.0, 200.0)` is called once
- **THEN** `frame_count` equals 1
- **THEN** `average_frame_time_ms` equals 0.7 (500+200 = 700us = 0.7ms)
- **THEN** `average_cells_updated` equals 25

#### Scenario: Multiple frames compute rolling averages
- **WHEN** `record_frame(25, 500, 200)` then `record_frame(50, 1000, 400)` are called
- **THEN** `frame_count` equals 2
- **THEN** `average_frame_time_ms` equals 1.05ms ((0.7 + 1.4) / 2)

#### Scenario: Frame count increments on each call
- **WHEN** `record_frame` is called 3 times
- **THEN** `frame_count` equals 3

### Requirement: FrameStats SHALL expose per-frame and average fields

All `FrameStats` fields SHALL be public for FFI access via `getRenderStats`.

#### Scenario: Stats are readable after record
- **WHEN** `record_frame(100, 2000.0, 500.0)` is called
- **THEN** `last_frame_time_ms` equals 2.5
- **THEN** `render_time_us` equals 2000.0
- **THEN** `stdout_write_time_us` equals 500.0
- **THEN** `cells_updated` equals 100
- **THEN** `render_time_valid` and `stdout_write_time_valid` are true

<!-- Preserved from openspec/specs/native-renderer/spec.md. -->

### Requirement: render performs one render cycle
`render(ptr, force)` SHALL perform one render cycle and return `i32` (0 = success, 1 = I/O error). The render cycle SHALL use detected capabilities for adaptive color emission. Renderer frame state SHALL be committed only after output write and flush succeed.

#### Scenario: Successful render
- **WHEN** `render(ptr, false)` is called and all I/O operations succeed
- **THEN** the function SHALL return `0`
- **AND** dirty regions SHALL be computed, ANSI sequences emitted using capabilities, buffers swapped, the next buffer cleared, and stats recorded

#### Scenario: Render with I/O error
- **WHEN** `render(ptr, false)` is called and `write_all` or `flush` fails
- **THEN** the function SHALL return `1`
- **AND** the buffers SHALL NOT be swapped
- **AND** the next buffer SHALL NOT be cleared as if the frame succeeded
- **AND** successful-frame stats SHALL NOT be recorded for the failed output

#### Scenario: Force render
- **WHEN** `render(ptr, true)` is called
- **THEN** the entire viewport SHALL be treated as dirty
- **AND** the same I/O error handling SHALL apply

### Requirement: Resize-triggered renders surface failures
Renderer APIs that internally force-render after resize SHALL report render failures instead of discarding them.

#### Scenario: Process events resize render fails
- **WHEN** `process_events()` handles a pending resize and the forced render fails
- **THEN** the failure SHALL be observable by the caller through the native or TypeScript API
- **AND** it SHALL NOT be silently ignored

#### Scenario: Injected resize render fails
- **WHEN** `inject_resize_event()` performs its forced render and output fails
- **THEN** the failure SHALL be observable by the caller through the native or TypeScript API
- **AND** renderer state SHALL follow the failed-render invariant

### Requirement: Terminal setup fails when raw mode setup fails
Terminal setup SHALL report raw-mode initialization failure unless an explicit best-effort setup mode exists.

#### Scenario: Raw mode initialization fails
- **WHEN** `setupTerminal` cannot enable raw mode
- **THEN** it SHALL return an error code to the FFI caller
- **AND** it SHALL NOT report successful setup merely because ANSI writes succeeded

### Requirement: Renderer dimensions are validated before allocation
Renderer, buffer, and hit-grid allocation paths SHALL validate width and height before multiplying dimensions or allocating backing vectors.

#### Scenario: Dimension multiplication overflows
- **WHEN** width and height would overflow the allocation size
- **THEN** construction or resize SHALL fail or clamp according to the documented API
- **AND** it SHALL NOT panic due to unchecked multiplication

#### Scenario: Rectangle clipping uses checked arithmetic
- **WHEN** rectangle coordinates plus width or height exceed integer bounds
- **THEN** clipping SHALL saturate or return an empty rectangle
- **AND** it SHALL NOT wrap around into an invalid draw or hit region

### Requirement: destroyRenderer frees all memory
`destroyRenderer(ptr)` SHALL call `Box::from_raw` to reclaim the heap allocation, call `destroy()` to restore the terminal, and return `i32` (0 = success, 1 = error).

#### Scenario: Successful destroy
- **WHEN** `destroyRenderer(ptr)` is called with a valid pointer
- **THEN** `Box::from_raw(ptr)` SHALL be called to reclaim memory
- **AND** `destroy()` SHALL be called to restore the terminal
- **AND** the function SHALL return `0`
- **AND** the pointer SHALL be invalid after this call

#### Scenario: Destroy with null pointer
- **WHEN** `destroyRenderer(null)` is called
- **THEN** the function SHALL return `0` without action

#### Scenario: Destroy with I/O error during terminal restore
- **WHEN** `destroyRenderer(ptr)` is called and `restore_terminal` fails
- **THEN** the memory SHALL still be freed via `Box::from_raw`
- **AND** the function SHALL return `1`

### Requirement: setupTerminal returns error code
`setupTerminal(ptr, use_alternate_screen)` SHALL return `i32` (0 = success, 1 = I/O error). During setup, the renderer SHALL detect terminal capabilities if not already detected.

#### Scenario: Successful setup
- **WHEN** `setupTerminal` is called and all I/O operations succeed
- **THEN** the function SHALL return `0`
- **AND** the terminal SHALL be in raw mode with optional alternate screen
- **AND** terminal capabilities SHALL be detected and stored

#### Scenario: Setup with I/O error
- **WHEN** `setupTerminal` is called and `write_all` fails
- **THEN** the function SHALL return `1`
- **AND** any partial terminal setup that succeeded SHALL remain (no rollback)

### Requirement: restoreTerminal returns error code
`restoreTerminal(ptr)` SHALL return `i32` (0 = success, 1 = I/O error).

#### Scenario: Successful restore
- **WHEN** `restoreTerminal` is called and all I/O operations succeed
- **THEN** the function SHALL return `0`

#### Scenario: Restore with I/O error
- **WHEN** `restoreTerminal` is called and `write_all` or `flush` fails
- **THEN** the function SHALL return `1`
- **AND** the restore sequence SHALL continue attempting remaining steps

### Requirement: createRenderer allocates renderer
`createRenderer(width, height)` allocates a renderer with `output = Box::new(io::stdout())` and two empty buffers, and initializes terminal state to "not yet set up". The renderer SHALL detect terminal capabilities on creation.

#### Scenario: Renderer detects capabilities
- **WHEN** `createRenderer(width, height)` is called
- **THEN** the renderer SHALL detect terminal capabilities
- **AND** the capabilities SHALL be stored for use during rendering

### Requirement: createTestRenderer allocates test renderer
`createTestRenderer(width, height)` SHALL allocate a renderer with `output = Box::new(Vec::<u8>::new())` for captured ANSI output. The captured output SHALL be readable via `getTestOutput(renderer)`.

#### Scenario: Test renderer captures output
- **WHEN** `createTestRenderer(width, height)` is called
- **THEN** the renderer SHALL use captured output readable through `getTestOutput(renderer)`

### Requirement: getCurrentBuffer returns front buffer
`getCurrentBuffer(ptr)` SHALL return the `front` buffer, which is what was last rendered.

#### Scenario: Current buffer is requested
- **WHEN** `getCurrentBuffer(ptr)` is called
- **THEN** it SHALL return the renderer front buffer

### Requirement: getNextBuffer returns back buffer
`getNextBuffer(ptr)` SHALL return the `back` buffer, where the next frame should be drawn.

#### Scenario: Next buffer is requested
- **WHEN** `getNextBuffer(ptr)` is called
- **THEN** it SHALL return the renderer back buffer

### Requirement: getRenderStats writes stats to output
`getRenderStats(ptr, out_ptr)` SHALL write `RenderStats` to the provided memory.

#### Scenario: Render stats are requested
- **WHEN** `getRenderStats(ptr, out_ptr)` is called
- **THEN** it SHALL write renderer stats into `out_ptr`

### Requirement: setCursorPosition updates cursor
`setCursorPosition(ptr, x, y, visible)` SHALL update the desired cursor position and visibility for the next render.

#### Scenario: Cursor position is set
- **WHEN** `setCursorPosition(ptr, x, y, visible)` is called
- **THEN** the next render SHALL use the requested cursor position and visibility

### Requirement: resizeRenderer recreates buffers
`resizeRenderer(ptr, width, height)` recreates both buffers with new dimensions and clears them. After resize, the next call to `render` SHALL treat the entire viewport as dirty.

#### Scenario: Successful resize
- **WHEN** `resizeRenderer(ptr, 120, 40)` is called on an 80x24 renderer
- **THEN** both front and back buffers SHALL have width=120 and height=40
- **AND** the next `render(ptr, false)` SHALL update all cells (full dirty)

### Requirement: process_events SHALL handle resize events

`CliRenderer::process_events()` SHALL detect `Event::Resize` from crossterm and: (1) fire the registered resize callback, (2) call `self.resize(w, h)` to reallocate buffers, (3) call `self.render(true)` to force-repaint.

#### Scenario: Resize event triggers full chain
- **WHEN** `process_events()` is called and crossterm has a pending `Event::Resize(120, 40)`
- **THEN** the resize callback SHALL fire with (120, 40)
- **AND** buffers SHALL be reallocated to 120x40
- **AND** a force-render SHALL execute

#### Scenario: Resize with no callback still reallocates
- **WHEN** `process_events()` is called with no resize callback and crossterm has a pending resize
- **THEN** buffers SHALL be reallocated and force-render SHALL execute
- **AND** no panic SHALL occur

### Requirement: Renderer exposes capabilities
The `CliRenderer` SHALL provide a `get_capabilities()` method that returns the detected `Capabilities`.

#### Scenario: Get renderer capabilities
- **WHEN** `renderer.get_capabilities()` is called
- **THEN** it SHALL return the detected Capabilities struct

### Requirement: Capabilities detectable at FFI level
The FFI SHALL expose a function to get capabilities from a renderer pointer.

#### Scenario: FFI get capabilities
- **WHEN** `getCapabilities(ptr)` is called
- **THEN** it SHALL return a struct with `rgb`, `ansi256`, and `ansi16` boolean fields

### Requirement: Native core exposes native custom layout computation
The native core SHALL expose an internal FFI entry point for computing layout with the native custom backend without coupling it to terminal rendering.

#### Scenario: Native layout computation is independent of render flush
- **WHEN** TypeScript requests native custom layout computation
- **THEN** native code SHALL compute layout rectangles without writing ANSI output
- **AND** it SHALL NOT mutate renderer front or back buffers

#### Scenario: Native layout returns error code
- **WHEN** native custom layout computation cannot process the provided input
- **THEN** it SHALL return an error code that TypeScript can detect

### Requirement: Native custom layout integration does not change render semantics
Adding native custom layout support SHALL NOT change native buffer diffing or terminal output behavior.

#### Scenario: Render output path remains unchanged
- **WHEN** the TypeScript backend is selected
- **THEN** native render behavior SHALL remain the existing buffer diff and ANSI output path

#### Scenario: Native custom only affects computed rectangles
- **WHEN** the native custom backend is selected
- **THEN** native custom computation SHALL only affect the computed rectangles used before drawing into the buffer

<!-- Preserved from openspec/specs/ts-renderer/spec.md. -->

### Requirement: CliRenderer SHALL register resize callback in constructor

The `CliRenderer` constructor SHALL call `api.events.createResizeCallback(handler)` to create a native resize callback trampoline and register it via `api.events.setResizeCallback(ptr, callback.ptr)`.

#### Scenario: Constructor registers resize callback
- **WHEN** `new CliRenderer()` is called
- **THEN** a resize callback SHALL be registered on the native renderer
- **AND** the callback SHALL be stored as `_resizeCallback` for cleanup in `destroy()`

#### Scenario: Resize callback updates internal dimensions
- **WHEN** the native resize callback fires with (120, 40)
- **THEN** `_width` SHALL be updated to 120
- **AND** `_height` SHALL be updated to 40

#### Scenario: Resize callback emits via queueMicrotask
- **WHEN** the native resize callback fires
- **THEN** the `"resize"` event SHALL be dispatched via `queueMicrotask`
- **AND** the event object SHALL be `{ type: "resize", width: number, height: number }`

### Requirement: CliRenderer destroy SHALL clean up resize callback

`destroy()` SHALL close the resize callback alongside the key callback to prevent dangling FFI pointers.

#### Scenario: Destroy closes both callbacks
- **WHEN** `renderer.destroy()` is called
- **THEN** `api.events.setResizeCallback(ptr, null)` SHALL be called
- **AND** `resizeCallback.close()` SHALL be called

### Requirement: CliRenderer SHALL register mouse callback in constructor

The `CliRenderer` constructor SHALL call `api.events.createMouseCallback(handler)` to create a native mouse callback trampoline and register it via `api.events.setMouseCallback(ptr, callback.ptr)` when `useMouse` is true.

#### Scenario: Constructor registers mouse callback
- **WHEN** `new CliRenderer({ useMouse: true })` is called
- **THEN** a mouse callback SHALL be registered on the native renderer
- **AND** the callback SHALL be stored as `_mouseCallback` for cleanup in `destroy()`

#### Scenario: No mouse callback when useMouse is false
- **WHEN** `new CliRenderer({ useMouse: false })` is called
- **THEN** no mouse callback SHALL be registered

#### Scenario: Mouse callback decodes raw event data
- **WHEN** the native mouse callback fires with (type_ptr, type_len, kind_ptr, kind_len, button, x, y, ctrl, shift, alt, scroll_dir)
- **THEN** the strings SHALL be decoded from raw pointers
- **AND** a `MouseEvent` instance SHALL be created and emitted via `queueMicrotask`

### Requirement: CliRenderer destroy SHALL clean up mouse callback

`destroy()` SHALL close the mouse callback alongside the key callback to prevent dangling FFI pointers.

#### Scenario: Destroy closes both callbacks
- **WHEN** `renderer.destroy()` is called
- **THEN** `api.events.setMouseCallback(ptr, null)` SHALL be called
- **AND** `mouseCallback.close()` SHALL be called
- **AND** `api.events.setEventCallback(ptr, null)` SHALL be called
- **AND** `eventCallback.close()` SHALL be called

### Requirement: Renderer event callbacks are scheduled exactly once
Native event callbacks SHALL cross into TypeScript through one async scheduling boundary, not nested `queueMicrotask` calls in both generated FFI and `CliRenderer`.

#### Scenario: Key callback dispatch
- **WHEN** a native key callback fires
- **THEN** the key event handler SHALL be queued exactly once before user handlers run
- **AND** generated FFI and `CliRenderer` SHALL NOT both queue the same event

#### Scenario: Resize callback dispatch
- **WHEN** a native resize callback fires
- **THEN** the resize event handler SHALL be queued exactly once before user handlers run
- **AND** internal renderer dimensions SHALL be updated before the user resize event is emitted

### Requirement: Native mouse event kinds are validated
The TypeScript renderer SHALL parse native mouse event kind strings through an explicit validator before constructing public `MouseEvent` instances.

#### Scenario: Known native mouse kind
- **WHEN** the native callback provides a supported kind string
- **THEN** `CliRenderer` SHALL construct a `MouseEvent` with the corresponding typed kind

#### Scenario: Unknown native mouse kind
- **WHEN** the native callback provides an unsupported kind string
- **THEN** `CliRenderer` SHALL drop the event or surface a clear error according to the documented policy
- **AND** it SHALL NOT cast the string into `RawMouseEvent["kind"]`

### Requirement: Constructor options are effective or removed
Public `RendererOptions` fields SHALL either affect renderer behavior or be removed from the public type.

#### Scenario: useAlternateScreen is configured in constructor
- **WHEN** `new CliRenderer({ useAlternateScreen: false })` is created and `setupTerminal()` is called without an override
- **THEN** setup SHALL use the constructor value
- **OR** `useAlternateScreen` SHALL not be present in `RendererOptions`

### Requirement: Current buffer wrapper is read-only
The TypeScript API SHALL prevent drawing through a buffer returned by `getCurrentBuffer()`.

#### Scenario: Current buffer has no mutating methods
- **WHEN** TypeScript code calls `renderer.getCurrentBuffer()`
- **THEN** the returned wrapper SHALL expose inspection methods only
- **AND** it SHALL NOT expose `clear`, `drawText`, `drawChar`, `drawBox`, or `fillRect`

#### Scenario: Next buffer remains drawable
- **WHEN** TypeScript code calls `renderer.getNextBuffer()`
- **THEN** the returned wrapper SHALL expose drawing methods for the next frame

### Requirement: CliRenderer exposes root renderable
The `CliRenderer` class SHALL expose a public `root` property that owns the renderer's renderable tree.

#### Scenario: Root is available after construction
- **WHEN** `new CliRenderer({ width: 40, height: 10 })` is called
- **THEN** `renderer.root` SHALL be defined
- **AND** `renderer.root.width` SHALL be `40`
- **AND** `renderer.root.height` SHALL be `10`

### Requirement: CliRenderer renders root before native flush
The `CliRenderer` render methods SHALL render the root tree into the next buffer before calling the native renderer flush.

#### Scenario: Render draws root tree
- **WHEN** a text renderable is added to `renderer.root`
- **AND** `renderer.render()` is called
- **THEN** the captured frame SHALL include the text renderable output

#### Scenario: Forced render draws root tree
- **WHEN** a text renderable is added to `renderer.root`
- **AND** `renderer.renderForce()` is called
- **THEN** the captured frame SHALL include the text renderable output

### Requirement: Renderer computes layout before root render
The TypeScript renderer SHALL compute root renderable layout through the internal layout engine boundary before drawing the root into the next buffer when layout is dirty.

#### Scenario: Render invokes dirty layout pass
- **WHEN** `CliRenderer.render()` is called after a layout prop changed
- **THEN** the renderer SHALL compute layout for the root renderable before calling native render
- **AND** renderables SHALL draw using the updated computed rectangles

#### Scenario: Render skips clean layout pass
- **WHEN** `CliRenderer.render()` is called and layout is not dirty
- **THEN** the renderer SHALL skip layout recomputation
- **AND** it SHALL render using cached computed rectangles

#### Scenario: Renderer uses configured layout engine
- **WHEN** the root layout is dirty
- **THEN** the renderer SHALL invoke the configured internal layout engine
- **AND** it SHALL NOT call backend-specific layout code from public renderable APIs

### Requirement: Direct buffer rendering remains available
The `CliRenderer` class SHALL preserve the existing `getNextBuffer()` workflow for users who draw directly into `MoonBuffer`.

#### Scenario: Existing buffer-first render still works
- **WHEN** user code calls `renderer.getNextBuffer().drawText(...)`
- **AND** no children are added to `renderer.root`
- **THEN** `renderer.render()` SHALL preserve the existing direct-buffer output behavior

### Requirement: Renderer preserves direct buffer workflow
The renderer SHALL preserve direct `MoonBuffer` drawing behavior while layout engine indirection is introduced.

#### Scenario: Empty root keeps direct buffer output
- **WHEN** user code draws directly into `renderer.getNextBuffer()`
- **AND** no root children draw over that region
- **THEN** the next render SHALL preserve the direct-buffer output behavior

### Requirement: Root dimensions track terminal size
The `CliRenderer` class SHALL keep `renderer.root` dimensions synchronized with renderer width and height.

#### Scenario: Resize callback updates root dimensions
- **WHEN** the renderer receives a resize event with width `120` and height `40`
- **THEN** `renderer.root.width` SHALL be `120`
- **AND** `renderer.root.height` SHALL be `40`

### Requirement: Resize invalidates root layout
The TypeScript renderer SHALL mark root layout dirty when the renderer dimensions change.

#### Scenario: Resize recomputes responsive layout
- **WHEN** a resize event updates the renderer size from 80 by 24 to 100 by 30
- **THEN** the root renderable dimensions SHALL update
- **AND** the next render SHALL recompute layout using 100 by 30

### Requirement: CliRenderer exposes focus control API
The TypeScript renderer SHALL expose a small public API for focus management.

#### Scenario: Public focus methods exist
- **WHEN** a consumer uses `CliRenderer`
- **THEN** it SHALL provide `focus(renderable)`, `blur()`, `focusNext()`, `focusPrevious()`, and `focused`

#### Scenario: Focus rejects non-focusable renderable
- **WHEN** `renderer.focus(renderable)` is called with a non-focusable renderable
- **THEN** the renderer SHALL NOT focus that renderable
- **AND** the current focused renderable SHALL remain unchanged

### Requirement: CliRenderer routes key events through focus manager
The TypeScript renderer SHALL route native key events through the focus manager before emitting global key events.

#### Scenario: Native key dispatches to focused renderable first
- **WHEN** the native key callback fires and a renderable is focused
- **THEN** the focus manager SHALL dispatch the key event to the focused renderable before `renderer.on("key")` handlers run

#### Scenario: Unfocused key still emits globally
- **WHEN** the native key callback fires and no renderable is focused
- **THEN** `renderer.on("key")` handlers SHALL receive the key event

#### Scenario: Stopped key is not emitted globally
- **WHEN** focused key handling calls `stopPropagation()`
- **THEN** `renderer.on("key")` handlers SHALL NOT receive the key event

### Requirement: CliRenderer autoFocus option drives initial focus
The TypeScript renderer SHALL use `RendererOptions.autoFocus` to decide whether the first focusable renderable can be focused automatically.

#### Scenario: Auto focus true focuses first focusable
- **WHEN** `autoFocus` is true and a focusable renderable exists in the root tree
- **THEN** the renderer SHALL focus the first focusable renderable before focused key dispatch is needed

#### Scenario: Auto focus false leaves focus empty
- **WHEN** `autoFocus` is false
- **THEN** the renderer SHALL leave `focused` as `null` until focus is set explicitly

### Requirement: Renderer cursor reflects focused input render state
The TypeScript renderer SHALL allow a focused input renderable to update the renderer cursor position during a render frame.

#### Scenario: Focused input updates cursor before native render
- **WHEN** `CliRenderer.render()` renders a focused input with cursor position inside its layout rectangle
- **THEN** the renderer SHALL call `setCursorPosition` with the input cursor coordinates before native render output is flushed

#### Scenario: No focused input leaves cursor under existing renderer control
- **WHEN** no focused input requests cursor placement during render
- **THEN** the renderer SHALL preserve existing cursor behavior

### Requirement: Renderer uses native custom layout by default
The TypeScript renderer SHALL use native custom layout by default.

#### Scenario: Renderer computes dirty root layout
- **WHEN** `CliRenderer.render()` computes dirty root layout without an explicit internal layout override
- **THEN** it SHALL compute layout through native custom

#### Scenario: Renderer preserves explicit internal fallback
- **WHEN** tests create a renderer with an internal TypeScript fallback layout engine
- **THEN** the renderer SHALL use that supplied fallback engine instead of the default

### Requirement: Renderer behavior remains stable after backend promotion
Changing the default layout backend SHALL NOT change non-layout renderer behavior.

#### Scenario: Direct buffer workflow remains available
- **WHEN** user code draws directly into `renderer.getNextBuffer()`
- **THEN** the direct-buffer workflow SHALL continue to behave as before promotion

#### Scenario: Render flush semantics remain unchanged
- **WHEN** `renderer.render()` flushes a frame after promotion
- **THEN** native buffer diffing, frame stats, and output error behavior SHALL remain governed by the renderer contract

<!-- Preserved from openspec/specs/rendering-diff-engine/spec.md. -->

### Requirement: Reset-then-rebuild style emission
The diff renderer SHALL emit a single SGR reset (`\x1B[0m`) before re-emitting all cell style properties when any property changes. The emission order SHALL be: reset, foreground color, background color, text attributes.

#### Scenario: Style change triggers full reset
- **WHEN** a cell has different foreground color from the previous emitted cell
- **THEN** the renderer emits `\x1B[0m` followed by `\x1B[38;2;R;G;Bm` (new fg), then `\x1B[48;2;R;G;Bm` (new bg), then any active attribute SGR codes

#### Scenario: Attribute-only change emits full style
- **WHEN** a cell has the same fg and bg as the previous cell but different text attributes (e.g., bold vs normal)
- **THEN** the renderer emits `\x1B[0m` followed by the fg color, bg color, and new attribute SGR codes

#### Scenario: No change emits nothing
- **WHEN** a cell has identical fg, bg, and attributes to the previously emitted cell
- **THEN** the renderer emits no SGR sequences and only writes the character

### Requirement: Atomic style state tracking
The diff renderer SHALL track fg, bg, and attributes as a single combined style state. When any component changes, the entire state SHALL be re-emitted.

#### Scenario: Combined state change detection
- **WHEN** the diff renderer compares consecutive cells
- **THEN** it considers the cells to have different styles if ANY of fg, bg, or attributes differ

#### Scenario: State reset at frame start
- **WHEN** a new render frame begins
- **THEN** the tracked style state is reset to empty (no colors or attributes assumed)

### Requirement: Style reset at frame end
The diff renderer SHALL emit a final SGR reset at the end of each frame to restore the terminal to a clean state.

#### Scenario: Terminal state cleanup after frame
- **WHEN** the diff renderer finishes emitting all dirty cells for a frame
- **THEN** it emits `\x1B[0m` before any cursor positioning or frame-end sequences

<!-- Preserved from openspec/specs/renderer-guard/spec.md. -->

### Requirement: CliRenderer tracks destroyed state
The `CliRenderer` class SHALL maintain a private `_destroyed` boolean flag, initialized to `false` and set to `true` when `destroy()` is called.

#### Scenario: Initial state is not destroyed
- **WHEN** a new `CliRenderer` is constructed
- **THEN** the internal `_destroyed` flag SHALL be `false`

#### Scenario: destroy sets the flag
- **WHEN** `renderer.destroy()` is called
- **THEN** the internal `_destroyed` flag SHALL be set to `true` before any cleanup operations

### Requirement: CliRenderer guard method prevents use-after-destroy
The `CliRenderer` class SHALL have a private `guard()` method that throws an `Error` if `_destroyed` is `true`. Every public method SHALL call `guard()` as its first operation.

#### Scenario: Method call after destroy throws
- **WHEN** `renderer.destroy()` is called followed by `renderer.render()`
- **THEN** an `Error` SHALL be thrown with message `"CliRenderer used after destroy"`

#### Scenario: Method call before destroy succeeds
- **WHEN** `renderer.render()` is called on a non-destroyed renderer
- **THEN** the render SHALL proceed normally without throwing

#### Scenario: All public methods are guarded
- **WHEN** any public method is called on a destroyed renderer
- **THEN** an `Error` SHALL be thrown
- **AND** the following methods SHALL be guarded: `processEvents`, `setupTerminal`, `restoreTerminal`, `getCurrentBuffer`, `getNextBuffer`, `render`, `renderForce`, `getStats`, `setCursorPosition`, `terminalSize`, `emitKeyEvent`

### Requirement: destroy is idempotent
Calling `destroy()` multiple times SHALL NOT throw or cause double-free errors.

#### Scenario: Double destroy is safe
- **WHEN** `renderer.destroy()` is called twice
- **THEN** the second call SHALL be a no-op (guard check passes because cleanup is already done, or the method returns early)

<!-- Synced from openspec/changes/cleanup-openspec-specs/specs/rendering-pipeline/spec.md. -->

### Requirement: Rendering pipeline contract is consolidated
The rendering pipeline spec SHALL cover ANSI generation, renderer frame output, render diffing, frame timing, output capture, and renderer responsibility boundaries.

#### Scenario: Future rendering change selects one capability
- **WHEN** a future change modifies ANSI output, diff rendering, frame statistics, captured output, or renderer frame behavior
- **THEN** the change targets `rendering-pipeline` unless it only affects buffer storage or renderable tree semantics

### Requirement: Rendering behavior remains backend-consistent
Native and TypeScript renderer-related behavior SHALL preserve observable frame semantics across supported test paths.

#### Scenario: Renderer implementation changes
- **WHEN** renderer internals or diffing behavior changes
- **THEN** tests or specs verify the same visible frame result for affected scenarios

### Requirement: Output capture remains testable
Rendering output capture SHALL remain available for tests without requiring visible interactive terminal output.

#### Scenario: Test verifies rendered output
- **WHEN** a test needs to inspect terminal rendering behavior
- **THEN** it can capture frame content or ANSI output through the testing harness
