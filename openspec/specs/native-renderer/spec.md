# native-renderer

Per-instance terminal renderer with double buffering, dirty-region diffing, and ANSI output.

## Overview

A `CliRenderer` owns two `OptimizedBuffer` instances (`front` and `back`), terminal state (raw mode, cursor, capabilities), and render statistics. On `render()`, it diffs `back` against `front`, emits ANSI sequences for changed cells, swaps the buffers, and updates statistics.

## Requirements

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
`createTestRenderer(width, height)` allocates a renderer with `output = Box::new(Vec::<u8>::new())` for captured ANSI output. The captured output is readable via `getTestOutput(renderer)`.

### Requirement: getCurrentBuffer returns front buffer
`getCurrentBuffer(ptr)` returns the `front` buffer (what was last rendered).

### Requirement: getNextBuffer returns back buffer
`getNextBuffer(ptr)` returns the `back` buffer (where the next frame should be drawn).

### Requirement: getRenderStats writes stats to output
`getRenderStats(ptr, out_ptr)` writes `RenderStats` to the provided memory.

### Requirement: setCursorPosition updates cursor
`setCursorPosition(ptr, x, y, visible)` updates the desired cursor position and visibility for the next render.

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

### Requirement: Native core exposes experimental Taffy layout computation
The native core SHALL expose an internal FFI entry point for computing layout with Taffy without coupling it to terminal rendering.

#### Scenario: Native layout computation is independent of render flush
- **WHEN** TypeScript requests Taffy layout computation
- **THEN** native code SHALL compute layout rectangles without writing ANSI output
- **AND** it SHALL NOT mutate renderer front or back buffers

#### Scenario: Native layout returns error code
- **WHEN** native Taffy layout computation cannot process the provided input
- **THEN** it SHALL return an error code that TypeScript can detect

### Requirement: Native Taffy integration does not change render semantics
Adding Taffy layout support SHALL NOT change native buffer diffing or terminal output behavior.

#### Scenario: Render output path remains unchanged
- **WHEN** the TypeScript backend is selected
- **THEN** native render behavior SHALL remain the existing buffer diff and ANSI output path

#### Scenario: Taffy only affects computed rectangles
- **WHEN** the Taffy backend is selected
- **THEN** native Taffy computation SHALL only affect the computed rectangles used before drawing into the buffer

## Data Structures

### CliRenderer Fields (Encapsulated)

All `CliRenderer` fields are private (no `pub`). External access is through the following accessors:

- `get_stats()` → `&RenderStats`
- `width()` / `height()` → `u32`
- `cursor_position()` → `(i32, i32, bool)`
- `get_current_buffer()` / `get_next_buffer()` → `&OptimizedBuffer`

Field mutation is only possible through designated methods. The `output` field is `Box<dyn Write + Send>`, set at construction to either `io::stdout()` or `Vec::<u8>::new()`.

#### Scenario: Field access via getters
- **WHEN** external code needs renderer width
- **THEN** it calls `renderer.width()` instead of accessing `renderer.width`
- **AND** field mutation is only possible through designated methods

#### Scenario: Stats read via getter
- **WHEN** external code needs render statistics
- **THEN** it calls `renderer.get_stats()` which returns `&RenderStats`
- **AND** stats are read-only from outside the renderer

## Data Structures

```c
typedef struct {
    double last_frame_time_ms;
    double average_frame_time_ms;
    uint64_t frame_count;
    uint32_t cells_updated;
    uint32_t average_cells_updated;
    double render_time_us;
    double stdout_write_time_us;
    bool render_time_valid;
    bool stdout_write_time_valid;
} RenderStats;
```

## C ABI Exports

```c
CliRenderer* createRenderer(uint32_t width, uint32_t height);
CliRenderer* createTestRenderer(uint32_t width, uint32_t height);
int32_t destroyRenderer(CliRenderer* renderer);

int32_t setupTerminal(CliRenderer* renderer, bool use_alternate_screen);
int32_t restoreTerminal(CliRenderer* renderer);

int32_t render(CliRenderer* renderer, bool force);
void resizeRenderer(CliRenderer* renderer, uint32_t width, uint32_t height);

OptimizedBuffer* getCurrentBuffer(CliRenderer* renderer);
OptimizedBuffer* getNextBuffer(CliRenderer* renderer);

const uint8_t* getTestOutput(CliRenderer* renderer, size_t* out_len);
void resetTestOutput(CliRenderer* renderer);

void getRenderStats(CliRenderer* renderer, RenderStats* out);

void setCursorPosition(CliRenderer* renderer, int32_t x, int32_t y, bool visible);
```

## Invariants

- After `createRenderer`, the terminal is NOT in raw mode. `setupTerminal` must be called explicitly.
- `render` without `setupTerminal` writes ANSI sequences to the output target but does not enable raw mode.
- `front` and `back` are never null after successful creation.
- Stats are cumulative for the lifetime of the renderer instance; `frame_count` only increments.
- `render` is not reentrant. Concurrent calls from multiple threads are undefined behavior.
