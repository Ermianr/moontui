## Purpose

Defines the ANSI escape generation functions used by the renderer to produce terminal output. All functions SHALL write to a caller-provided buffer to avoid per-call heap allocations.

## Requirements

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