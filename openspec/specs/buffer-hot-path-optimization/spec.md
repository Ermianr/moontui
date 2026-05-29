# buffer-hot-path-optimization

Optimized index computation and memory allocation in buffer and terminal operations.

## Purpose

Reduce heap allocations and CPU cycles in hot-path buffer operations by extracting row-start variables and consolidating ANSI sequence writes.

## Requirements

### Requirement: Buffer hot-path uses extracted row_start variable
The `OptimizedBuffer` methods `draw_text`, `write_resolved_chars`, and `real_char_size` SHALL compute the row start index once per row iteration instead of recomputing `y * width` on every cell.

#### Scenario: draw_text computes row_start once per row
- **WHEN** `draw_text` iterates over cells in a row
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once before the character loop
- **AND** cell access SHALL use `row_start + cx` instead of `(y as usize) * (self.width as usize) + (cx as usize)`

#### Scenario: write_resolved_chars computes row_start once per row
- **WHEN** `write_resolved_chars` iterates over cells in a row
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once before the column loop
- **AND** cell access SHALL use `row_start + x` instead of `(y as usize) * stride + (x as usize)`

#### Scenario: real_char_size computes row_start once per row
- **WHEN** `real_char_size` iterates over cells in a row
- **THEN** it SHALL compute `row_start = (y as usize) * stride` once before the column loop
- **AND** cell access SHALL use `row_start + x` instead of `(y as usize) * stride + (x as usize)`

### Requirement: ANSI writes use single buffer in terminal setup/teardown
The `setup_terminal` and `restore_terminal` methods SHALL use a single `Vec<u8>` buffer for all ANSI sequences instead of creating separate allocations per sequence.

#### Scenario: setup_terminal uses one buffer
- **WHEN** `setup_terminal` is called
- **THEN** it SHALL create one `Vec<u8>` buffer
- **AND** it SHALL write all ANSI sequences (alt screen, clear, hide cursor) into that buffer
- **AND** it SHALL flush the buffer once at the end

#### Scenario: restore_terminal uses one buffer
- **WHEN** `restore_terminal` is called
- **THEN** it SHALL create one `Vec<u8>` buffer
- **AND** it SHALL write all ANSI sequences (show cursor, exit alt screen) into that buffer
- **AND** it SHALL flush the buffer once at the end
