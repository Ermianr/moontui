## Purpose

Defines the frame timing and cell-count statistics tracking module for performance monitoring.

## Requirements

### Requirement: FrameStats SHALL record per-frame metrics

`FrameStats` SHALL provide a `record_frame(cells_updated, render_time_us, write_time_us)` method that updates frame count, running averages, and per-frame timings.

#### Scenario: First frame initializes averages
- **WHEN** `record_frame(25, 500.0, 200.0)` is called once
- **THEN** `frame_count` equals 1
- **THEN** `average_frame_time_ms` equals 0.7 (500+200 = 700us = 0.7ms)
- **THEN** `average_cells_updated` equals 25

#### Scenario: Multiple frames compute rolling averages
- **WHEN** `record_frame(25, 500, 200)` then `record_frame(50, 1000, 400)` are called
- **THEN** `frame_count` equals 2
- **THEN** `average_frame_time_ms` equals 1.05ms ((0.7 + 1.4) / 2)

#### Scenario: Frame count increments on each call
- **WHEN** `record_frame` is called 3 times
- **THEN** `frame_count` equals 3

### Requirement: FrameStats SHALL expose per-frame and average fields

All `FrameStats` fields SHALL be public for FFI access via `getRenderStats`.

#### Scenario: Stats are readable after record
- **WHEN** `record_frame(100, 2000.0, 500.0)` is called
- **THEN** `last_frame_time_ms` equals 2.5
- **THEN** `render_time_us` equals 2000.0
- **THEN** `stdout_write_time_us` equals 500.0
- **THEN** `cells_updated` equals 100
- **THEN** `render_time_valid` and `stdout_write_time_valid` are true
