# native-renderer

Per-instance terminal renderer with double buffering, dirty-region diffing, and ANSI output.

## Overview

A `CliRenderer` owns two `OptimizedBuffer` instances (`front` and `back`), terminal state (raw mode, cursor, capabilities), and render statistics. On `render()`, it diffs `back` against `front`, emits ANSI sequences for changed cells, swaps the buffers, and updates statistics.

## Requirements

### Requirement: render performs one render cycle
`render(ptr, force)` SHALL perform one render cycle and return `i32` (0 = success, 1 = I/O error).

#### Scenario: Successful render
- **WHEN** `render(ptr, false)` is called and all I/O operations succeed
- **THEN** the function SHALL return `0`
- **AND** dirty regions SHALL be computed, ANSI sequences emitted, buffers swapped, and stats recorded

#### Scenario: Render with I/O error
- **WHEN** `render(ptr, false)` is called and `write_all` or `flush` fails
- **THEN** the function SHALL return `1`
- **AND** the buffers SHALL still be swapped (consistent state)
- **AND** stats SHALL still be recorded

#### Scenario: Force render
- **WHEN** `render(ptr, true)` is called
- **THEN** the entire viewport SHALL be treated as dirty
- **AND** the same I/O error handling SHALL apply

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
`setupTerminal(ptr, use_alternate_screen)` SHALL return `i32` (0 = success, 1 = I/O error).

#### Scenario: Successful setup
- **WHEN** `setupTerminal` is called and all I/O operations succeed
- **THEN** the function SHALL return `0`
- **AND** the terminal SHALL be in raw mode with optional alternate screen

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
`createRenderer(width, height)` allocates a renderer with `output = Box::new(io::stdout())` and two empty buffers, and initializes terminal state to "not yet set up".

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
`resizeRenderer(ptr, width, height)` recreates both buffers with new dimensions and clears them.

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
