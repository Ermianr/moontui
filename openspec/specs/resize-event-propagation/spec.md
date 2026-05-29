# resize-event-propagation

Full resize event chain from EventBridge through FFI to TypeScript.

## Purpose

Defines how terminal resize events propagate from the native crossterm layer through the Rust EventBridge, across the FFI boundary, and into the TypeScript CliRenderer as typed events. Ensures buffer reallocation, force-rendering, and event emission happen atomically on resize.

## Requirements

### Requirement: EventBridge SHALL dispatch resize events via callback

`EventBridge` SHALL store an `Option<ResizeCallback>` and provide `set_resize_callback()` to set or clear it. When `process_events()` receives `Event::Resize(w, h)` from crossterm, it SHALL invoke the registered callback with the new dimensions.

#### Scenario: Resize callback fires on terminal resize
- **WHEN** a resize callback is registered and crossterm reports `Event::Resize(120, 40)`
- **THEN** the callback SHALL be invoked with width=120 and height=40

#### Scenario: No resize callback registered
- **WHEN** no resize callback is registered and crossterm reports `Event::Resize(120, 40)`
- **THEN** no callback SHALL be invoked and no panic SHALL occur

#### Scenario: Setting and clearing resize callback
- **WHEN** `set_resize_callback(Some(cb))` is called, then `set_resize_callback(None)` is called, then a resize event occurs
- **THEN** no callback SHALL be invoked after clearing

### Requirement: CliRenderer SHALL auto-reallocate buffers on resize

When `process_events()` detects a resize event, `CliRenderer` SHALL call `self.resize(new_w, new_h)` to reallocate both front and back buffers to the new dimensions, then call `self.render(true)` to force-repaint the entire viewport.

#### Scenario: Buffers reallocate to new size after resize
- **WHEN** a renderer at 80x24 receives a resize event to 120x40
- **THEN** `front_buffer.width` SHALL be 120 and `front_buffer.height` SHALL be 40
- **AND** `back_buffer.width` SHALL be 120 and `back_buffer.height` SHALL be 40

#### Scenario: Force-render happens after resize
- **WHEN** a renderer at 80x24 receives a resize event to 120x40
- **THEN** a force-render SHALL execute (frame_count incremented)
- **AND** the entire new viewport SHALL be painted

#### Scenario: Resize to smaller dimensions
- **WHEN** a renderer at 80x24 receives a resize event to 40x10
- **THEN** buffers SHALL be 40x10 with no leftover data from the old size

### Requirement: CliRenderer SHALL provide inject_resize_event for testing

`CliRenderer` SHALL provide `inject_resize_event(width, height)` that queues a resize through the same internal path as a real `Event::Resize` from crossterm: firing the resize callback and triggering buffer reallocation with force-render.

#### Scenario: inject_resize_event exercises full chain
- **WHEN** `inject_resize_event(120, 40)` is called on a renderer with a resize callback registered
- **THEN** the resize callback SHALL fire with (120, 40)
- **AND** buffers SHALL be reallocated to 120x40
- **AND** a force-render SHALL execute

#### Scenario: inject_resize_event with no callback
- **WHEN** `inject_resize_event(120, 40)` is called with no resize callback
- **THEN** no panic SHALL occur
- **AND** buffers SHALL still be reallocated to 120x40

### Requirement: TypeScript CliRenderer SHALL emit resize events

The TypeScript `CliRenderer` class SHALL register a resize callback via FFI in its constructor. When the callback fires, it SHALL update internal `_width` and `_height` properties and emit a `"resize"` event through the `TypedEmitter`.

#### Scenario: Resize event emits to subscribers
- **WHEN** `renderer.on("resize", handler)` is registered and a resize to 80x24 occurs
- **THEN** `handler` SHALL be called with `{ type: "resize", width: 80, height: 24 }`

#### Scenario: Renderer dimensions update on resize
- **WHEN** a resize to 80x24 occurs
- **THEN** `renderer.terminalSize()` SHALL return `{ width: 80, height: 24 }`

#### Scenario: Resize callback is cleaned up on destroy
- **WHEN** `renderer.destroy()` is called
- **THEN** the resize callback SHALL be closed alongside the key callback

### Requirement: Testing harness resize SHALL use event path

The `resize(width, height)` helper in the testing harness SHALL call `injectResizeEvent` on the native renderer instead of calling `resizeRenderer` directly, ensuring tests exercise the same codepath as real terminal resize.

#### Scenario: Test resize goes through event chain
- **WHEN** `testHarness.resize(80, 24)` is called
- **THEN** the resize callback SHALL fire
- **AND** buffers SHALL be reallocated
- **AND** a force-render SHALL execute
- **AND** the `"resize"` event SHALL emit to TS subscribers
