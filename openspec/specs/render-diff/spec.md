## Purpose

Defines the dirty-rect computation and ANSI rendering module that extracts diff logic from CliRenderer into an independently testable component.

## Requirements

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

The `DiffRenderer::render()` method SHALL take a list of `DirtyRect`s, a back buffer, cursor state, and an output buffer reference, and append ANSI escape sequences and characters to the output buffer.

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
