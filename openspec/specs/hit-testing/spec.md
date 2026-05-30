# hit-testing

Cell-granularity spatial index for mapping terminal coordinates to widget IDs.

## Overview

The `HitGrid` provides a cell-level spatial index that maps terminal cell positions to owning widget IDs. It supports rectangular widget registration, scissor rectangle clipping, and dirty-state tracking for efficient hover rechecks. The grid is rebuilt every frame during rendering.

## Requirements

### Requirement: HitGrid SHALL be a cell-granularity spatial index

The `HitGrid` struct SHALL maintain a `Vec<u32>` where each element corresponds to a terminal cell at position `(x, y)`. The value at index `y * width + x` is the widget ID that owns that cell. A value of `0` means no widget occupies that cell.

#### Scenario: Hit grid dimensions match terminal
- **WHEN** a `HitGrid` is created for a 80x24 terminal
- **THEN** the internal buffer SHALL contain 80 * 24 = 1920 `u32` elements
- **AND** all elements SHALL be initialized to `0`

#### Scenario: Hit grid covers full terminal area
- **WHEN** a widget is registered at position (10, 5) with size (5, 3)
- **THEN** cells (10,5), (11,5), ..., (14,5), (10,6), ..., (14,7) SHALL have the widget ID
- **AND** all other cells SHALL remain `0`

### Requirement: HitGrid SHALL support registration of rectangular regions

`HitGrid` SHALL provide `add(x, y, width, height, id)` that writes the widget ID to all cells in the specified rectangle.

#### Scenario: Add widget to hit grid
- **WHEN** `add(5, 3, 10, 4, 42)` is called on a 40x20 grid
- **THEN** cells from (5,3) to (14,6) SHALL contain `42`

#### Scenario: Add widget overlapping terminal bounds
- **WHEN** `add(35, 18, 10, 10, 1)` is called on a 40x20 grid
- **THEN** only cells within bounds (35,18) to (39,19) SHALL be written
- **AND** no out-of-bounds panic SHALL occur

#### Scenario: Add widget at zero size
- **WHEN** `add(5, 3, 0, 0, 1)` is called
- **THEN** no cells SHALL be modified

### Requirement: HitGrid SHALL support scissor rectangles

`HitGrid` SHALL support a stack of scissor rectangles that clip `add()` operations. When a scissor rect is active, `add()` SHALL only write to cells that fall within the intersection of the widget rectangle and the scissor rect.

#### Scenario: Scissor rect clips registration
- **WHEN** `push_scissor(10, 10, 20, 10)` is active
- **AND** `add(5, 5, 30, 20, 1)` is called
- **THEN** only cells in the intersection (10,10)-(29,19) SHALL be written

#### Scenario: Nested scissor rects
- **WHEN** `push_scissor(0, 0, 40, 20)` is active
- **AND** `push_scissor(10, 10, 20, 10)` is pushed
- **AND** `add(5, 5, 30, 20, 1)` is called
- **THEN** only cells in the intersection of both rects SHALL be written
- **AND** `pop_scissor()` restores the outer scissor

#### Scenario: Pop scissor without push
- **WHEN** `pop_scissor()` is called with an empty scissor stack
- **THEN** no panic SHALL occur
- **AND** subsequent `add()` operations SHALL write to the full grid

### Requirement: HitGrid SHALL support query by coordinates

`HitGrid` SHALL provide `check_hit(x, y) -> u32` that returns the widget ID at the given cell coordinates.

#### Scenario: Hit returns widget ID
- **WHEN** cell (10, 5) contains widget ID 42
- **AND** `check_hit(10, 5)` is called
- **THEN** the return value SHALL be `42`

#### Scenario: Hit returns 0 for empty cell
- **WHEN** cell (10, 5) contains `0`
- **AND** `check_hit(10, 5)` is called
- **THEN** the return value SHALL be `0`

#### Scenario: Hit out of bounds returns 0
- **WHEN** `check_hit(100, 100)` is called on a 40x20 grid
- **THEN** the return value SHALL be `0`
- **AND** no panic SHALL occur

### Requirement: HitGrid SHALL support clear and resize

`HitGrid` SHALL provide `clear()` that resets all cells to `0`. It SHALL also support `resize(new_width, new_height)` that reallocates the buffer and preserves existing registrations where possible.

#### Scenario: Clear resets all cells
- **WHEN** `clear()` is called
- **THEN** all cells SHALL be `0`

#### Scenario: Resize preserves overlapping registrations
- **WHEN** a 40x20 grid has widgets registered
- **AND** `resize(60, 30)` is called
- **THEN** widgets within the original 40x20 area SHALL retain their IDs
- **AND** new cells outside the original area SHALL be `0`

#### Scenario: Resize to smaller dimensions truncates
- **WHEN** a 40x20 grid has widgets registered
- **AND** `resize(20, 10)` is called
- **THEN** only cells within (0,0)-(19,9) SHALL retain their IDs
- **AND** cells outside the new dimensions SHALL be dropped

### Requirement: HitGrid SHALL track dirty state

`HitGrid` SHALL provide `is_dirty() -> bool` that returns true if the grid contents changed since the last `clear_dirty()` call. This allows the renderer to skip hover rechecks when no widgets changed.

#### Scenario: Grid is dirty after add
- **WHEN** `add(5, 3, 10, 4, 1)` is called
- **AND** `is_dirty()` is called
- **THEN** the return value SHALL be `true`

#### Scenario: Grid is clean after clear_dirty
- **WHEN** `clear_dirty()` is called
- **AND** `is_dirty()` is called
- **THEN** the return value SHALL be `false`

### Requirement: FFI exports for HitGrid operations

The following FFI functions SHALL be exported via `#[moontui_export]`:

- `hitGridAdd(renderer, x, y, width, height, id)` — register a widget rectangle
- `hitGridCheckHit(renderer, x, y) -> u32` — query widget at coordinates
- `hitGridClear(renderer)` — reset all cells to 0
- `hitGridPushScissorRect(renderer, x, y, width, height)` — push scissor rect
- `hitGridPopScissorRect(renderer)` — pop scissor rect
- `hitGridClearScissorRects(renderer)` — clear scissor stack
- `hitGridIsDirty(renderer) -> bool` — check dirty state
- `hitGridClearDirty(renderer)` — clear dirty flag

#### Scenario: FFI add widget
- **WHEN** `hitGridAdd(renderer_ptr, 5, 3, 10, 4, 42)` is called via FFI
- **THEN** the hit grid SHALL have widget 42 registered at (5,3) with size (10,4)

#### Scenario: FFI check hit
- **WHEN** `hitGridCheckHit(renderer_ptr, 10, 5)` is called via FFI
- **AND** cell (10,5) contains widget 42
- **THEN** the return value SHALL be `42`

### Requirement: CliRenderer SHALL rebuild hit grid each frame

During `render()`, `CliRenderer` SHALL clear the hit grid, then call `hitGridClearDirty()` to reset the dirty flag. The TypeScript side SHALL re-register all widget rectangles after render.

#### Scenario: Hit grid cleared on render
- **WHEN** `render(false)` is called
- **THEN** the hit grid SHALL be cleared
- **AND** `hitGridClearDirty()` SHALL be called

### Requirement: TypeScript HitGrid wrapper SHALL provide ergonomic API

The TypeScript `CliRenderer` SHALL expose `addToHitGrid(x, y, width, height, id)`, `checkHit(x, y)`, `pushHitGridScissorRect(x, y, width, height)`, `popHitGridScissorRect()`, `clearHitGridScissorRects()`, and `isHitGridDirty()` methods that delegate to the native FFI calls.

#### Scenario: TS addToHitGrid calls native
- **WHEN** `renderer.addToHitGrid(5, 3, 10, 4, 42)` is called
- **THEN** it SHALL call `lib.symbols.hitGridAdd(renderer._unsafePtr, 5, 3, 10, 4, 42)`

#### Scenario: TS checkHit returns widget ID
- **WHEN** `renderer.checkHit(10, 5)` is called
- **THEN** it SHALL return the widget ID at cell (10, 5)

### Requirement: CliRenderer SHALL recheck hover state after render

After each render frame, if `isHitGridDirty()` returns true, `CliRenderer` SHALL call `recheckHoverState()` which re-evaluates the widget under the cursor and fires over/out events if the widget changed.

#### Scenario: Hover recheck after render
- **WHEN** a render completes and the hit grid is dirty
- **AND** the cursor is over widget A (previously over widget B)
- **THEN** an `out` event SHALL be dispatched to widget B
- **AND** an `over` event SHALL be dispatched to widget A

#### Scenario: No hover recheck when clean
- **WHEN** a render completes and the hit grid is not dirty
- **THEN** `recheckHoverState()` SHALL NOT be called

## Invariants

- The hit grid is owned by the Rust core and accessed only through FFI.
- The hit grid is rebuilt every frame — widgets register their positions during the render pass.
- Scissor rects are a stack — push/pop must be balanced per frame.
- The hit grid is not thread-safe — all operations happen on the main thread.
- Widget ID `0` is reserved for "no widget" and SHALL never be assigned to a real widget.
