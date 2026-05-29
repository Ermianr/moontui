## ADDED Requirements

### Requirement: Renderer lifecycle is fully testable
The integration test suite SHALL be able to create, configure, render, and destroy a `CliRenderer` without interacting with a real terminal or FFI layer.

#### Scenario: Full lifecycle without terminal
- **WHEN** a test creates a `CliRenderer`, sets up terminal (alternate screen), draws to `get_next_buffer`, calls `render`, and destroys
- **THEN** the renderer completes all operations without panicking or leaking resources

### Requirement: Terminal setup produces correct ANSI sequences
The integration tests SHALL verify that `setup_terminal` emits the correct escape sequences for raw mode, alternate screen entry, cursor hide, and initial clear.

#### Scenario: Alternate screen setup
- **WHEN** `setup_terminal(use_alternate_screen: true)` is called
- **THEN** the captured stdout contains `\x1b[?1049h` (enter alt screen), `\x1b[2J\x1b[H` (clear), and `\x1b[?25l` (hide cursor)

#### Scenario: Non-alternate screen setup
- **WHEN** `setup_terminal(use_alternate_screen: false)` is called
- **THEN** the captured stdout contains `\x1b[2J\x1b[H` and `\x1b[?25l` but NOT `\x1b[?1049h`

### Requirement: Terminal restore produces correct ANSI sequences
The integration tests SHALL verify that `restore_terminal` returns the terminal to its original state.

#### Scenario: Restore after alternate screen
- **WHEN** `restore_terminal()` is called after alternate screen setup
- **THEN** the captured stdout contains `\x1b[?25h` (show cursor) and `\x1b[?1049l` (exit alt screen)

### Requirement: Double-buffering works correctly
The integration tests SHALL verify that `render()` swaps buffers and only renders changes from the back buffer.

#### Scenario: Drawing on front buffer does not render
- **WHEN** text is drawn to `get_current_buffer` and `render` is called
- **THEN** the rendered output contains only empty cells (spaces) or previously back-buffer content, NOT the newly drawn text

#### Scenario: Drawing on back buffer renders correctly
- **WHEN** text is drawn to `get_next_buffer` and `render` is called
- **THEN** the rendered output contains the drawn text at the correct position

#### Scenario: Second render with no changes produces minimal output
- **WHEN** `render` is called twice in a row with no buffer changes between calls
- **THEN** the second render produces zero cell updates (dirty rect optimization)

### Requirement: Buffer text operations produce correct cell content
The integration tests SHALL verify that all buffer drawing functions correctly modify cell data.

#### Scenario: draw_text with ASCII
- **WHEN** `draw_text("Hello", 0, 0, fg, bg)` is called on a cleared buffer
- **THEN** cells at (0..4, 0) contain characters H, e, l, l, o with the specified colors

#### Scenario: draw_text with Unicode
- **WHEN** `draw_text("あい", 0, 0, fg, bg)` is called
- **THEN** cell (0, 0) contains "あ" and cell (0, 1) is marked as continuation

#### Scenario: draw_text with empty string
- **WHEN** `draw_text("", 0, 0, fg, bg)` is called
- **THEN** no cells are modified

#### Scenario: clear fills all cells with background
- **WHEN** `clear(bg_color)` is called
- **THEN** all cells have `char_code: 0` and the specified background color

### Requirement: Render output contains correct ANSI for text
The integration tests SHALL verify that `render()` generates the correct ANSI escape sequences for drawn content.

#### Scenario: Single text cell renders with color
- **WHEN** one cell is set to character 'X' with foreground `[65535, 0, 0, 65535]` (red) and background `[0, 0, 0, 65535]` (black)
- **THEN** the rendered ANSI contains `\x1b[38;2;255;0;0m\x1b[48;2;0;0;0mX`

#### Scenario: Multiple identical cells batch color changes
- **WHEN** a run of 5 identical cells is rendered
- **THEN** the color escape sequences appear only once at the start of the run, not per-cell

### Requirement: Input event reading handles platform edge cases
The integration tests SHALL verify that `readEvents` correctly processes and filters input events.

#### Scenario: Press events are returned
- **WHEN** a `KeyEventKind::Press` is simulated
- **THEN** `readEvents` returns the event in the JSON array

#### Scenario: Release events are filtered on Windows
- **WHEN** a `KeyEventKind::Release` is simulated (as Windows crossterm generates)
- **THEN** `readEvents` does NOT return the event

#### Scenario: Repeat events are returned
- **WHEN** a `KeyEventKind::Repeat` is simulated
- **THEN** `readEvents` returns the event

#### Scenario: Empty buffer returns zero length
- **WHEN** `readEvents` is called with no pending events
- **THEN** it returns 0

### Requirement: FFI boundary is verified
The integration tests SHALL call the C ABI exports directly from Rust to verify the FFI contract.

#### Scenario: C createRenderer returns non-null pointer
- **WHEN** `createRenderer(80, 24)` is called via C ABI
- **THEN** it returns a non-null pointer

#### Scenario: C render does not crash with valid pointer
- **WHEN** `render(renderer_ptr, false)` is called via C ABI on a properly set up renderer
- **THEN** it completes without panicking

#### Scenario: C bufferDrawText passes text correctly
- **WHEN** `bufferDrawText(buf_ptr, "Test", 4, 0, 0, fg_ptr, bg_ptr, 0)` is called via C ABI
- **THEN** the buffer contains the text "Test" at position (0, 0)

### Requirement: Regression tests prevent reintroducing fixed bugs
The integration tests SHALL include explicit regression tests for each bug recently fixed.

#### Scenario: Regression — getCurrentBuffer + render produces no output
- **WHEN** text is drawn to `get_current_buffer` and `render` is called
- **THEN** the rendered output does NOT contain the drawn text (verifies front buffer is not rendered)

#### Scenario: Regression — crossterm 0.28 Windows input blocking
- **WHEN** the test suite runs with crossterm 0.27 (or later fixed version)
- **THEN** input events are correctly read without blocking on Windows

#### Scenario: Regression — KeyRelease phantom events
- **WHEN** a `KeyRelease` event is injected immediately after terminal setup (simulating Windows behavior)
- **THEN** no key handler is triggered and the application continues running

### Requirement: Render stats are accurate
The integration tests SHALL verify that `RenderStats` reflects actual rendering activity.

#### Scenario: Stats after single render
- **WHEN** `render` is called once after drawing 5 cells
- **THEN** `stats.cells_updated` equals 5 and `stats.frame_count` equals 1

#### Scenario: Stats after force render
- **WHEN** `render(true)` (force) is called on a 10x5 renderer
- **THEN** `stats.cells_updated` equals 50 (all cells)
