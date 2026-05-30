## Purpose

Define how native buffer cells initialize and clear foreground/background color state so rendering preserves terminal defaults unless an explicit color is requested.

## Requirements

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
