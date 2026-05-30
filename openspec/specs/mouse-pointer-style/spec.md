# mouse-pointer-style

Cursor shape control via DECSCUSR ANSI sequences.

## Overview

Provides an API to change the terminal mouse pointer shape (cursor icon) using DECSCUSR escape sequences. Supports six standard cursor shapes and tracks the current style in renderer state for clean terminal restore.

## Requirements

### Requirement: MousePointerStyle enum SHALL define cursor shapes

The `MousePointerStyle` enum SHALL define the following cursor shapes:

- `Default` (0) — platform default cursor
- `Pointer` (1) — pointing hand cursor
- `Text` (2) — text selection cursor (I-beam)
- `Crosshair` (3) — crosshair cursor
- `Move` (4) — move/grab cursor
- `NotAllowed` (5) — not-allowed/disabled cursor

#### Scenario: Enum values are contiguous
- **WHEN** `MousePointerStyle` is inspected
- **THEN** the enum SHALL have exactly 6 variants with values 0-5

### Requirement: CliRenderer SHALL set mouse pointer style via ANSI sequences

`CliRenderer` SHALL provide `set_mouse_pointer_style(style: MousePointerStyle)` that writes the appropriate DECSCUSR sequence to the terminal and stores the current style.

#### Scenario: Set pointer style to pointer
- **WHEN** `set_mouse_pointer_style(Pointer)` is called
- **THEN** `\x1b[0 q` (reset) followed by the appropriate DECSCUSR sequence SHALL be written to stdout
- **AND** `get_mouse_pointer_style()` SHALL return `Pointer`

#### Scenario: Set pointer style to text
- **WHEN** `set_mouse_pointer_style(Text)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Set pointer style to crosshair
- **WHEN** `set_mouse_pointer_style(Crosshair)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Set pointer style to move
- **WHEN** `set_mouse_pointer_style(Move)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Set pointer style to not-allowed
- **WHEN** `set_mouse_pointer_style(NotAllowed)` is called
- **THEN** the appropriate DECSCUSR sequence SHALL be written to stdout

#### Scenario: Reset to default
- **WHEN** `set_mouse_pointer_style(Default)` is called
- **THEN** `\x1b[0 q` SHALL be written to stdout

### Requirement: CliRenderer SHALL track current pointer style

`CliRenderer` SHALL store the current `MousePointerStyle` and provide `get_mouse_pointer_style()` to query it.

#### Scenario: Default pointer style
- **WHEN** a new `CliRenderer` is created
- **THEN** `get_mouse_pointer_style()` SHALL return `Default`

#### Scenario: Pointer style persists across calls
- **WHEN** `set_mouse_pointer_style(Pointer)` is called
- **THEN** `get_mouse_pointer_style()` SHALL return `Pointer` until changed

### Requirement: CliRenderer SHALL restore pointer style on terminal restore

`CliRenderer::restore_terminal()` SHALL reset the mouse pointer style to `Default` by writing the reset DECSCUSR sequence.

#### Scenario: Restore resets pointer style
- **WHEN** `restore_terminal()` is called after setting pointer to `Crosshair`
- **THEN** the reset DECSCUSR sequence SHALL be written
- **AND** the stored pointer style SHALL be `Default`

### Requirement: FFI exports for mouse pointer style

The following FFI functions SHALL be exported:

- `setMousePointerStyle(renderer, style: u32)` — set cursor shape
- `getMousePointerStyle(renderer) -> u32` — query current cursor shape

#### Scenario: FFI set pointer style
- **WHEN** `setMousePointerStyle(renderer_ptr, 1)` is called via FFI
- **THEN** the pointer style SHALL be set to `Pointer` (value 1)

#### Scenario: FFI get pointer style
- **WHEN** `getMousePointerStyle(renderer_ptr)` is called via FFI
- **AND** the current style is `Crosshair` (value 3)
- **THEN** the return value SHALL be `3`

### Requirement: TypeScript CliRenderer SHALL expose pointer style API

The TypeScript `CliRenderer` SHALL expose `setMousePointerStyle(style: MousePointerStyle)` and `getMousePointerStyle(): MousePointerStyle` that delegate to the native FFI calls.

#### Scenario: TS set pointer style
- **WHEN** `renderer.setMousePointerStyle("pointer")` is called
- **THEN** it SHALL call the native `setMousePointerStyle` with value `1`

#### Scenario: TS get pointer style
- **WHEN** `renderer.getMousePointerStyle()` is called
- **THEN** it SHALL return the current style as a string (`"default"`, `"pointer"`, `"text"`, `"crosshair"`, `"move"`, `"not-allowed"`)

## Invariants

- Mouse pointer style is a terminal-level setting — it affects the cursor for the entire terminal.
- The style is tracked in `CliRenderer` state so it can be restored after terminal mode changes.
- DECSCUSR sequences are widely supported but not universal. On unsupported terminals, the sequences are silently ignored.
- The `MousePointerStyle` enum uses `#[repr(C)]` for FFI safety.
