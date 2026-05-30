## Purpose

Define ANSI style emission semantics for the diff renderer so foreground color, background color, and text attributes remain visually consistent across frames.

## Requirements

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
