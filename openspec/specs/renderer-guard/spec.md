# renderer-guard

Use-after-destroy protection for `CliRenderer`.

## Overview

Guards all public methods of `CliRenderer` against use after `destroy()` has been called, preventing use-after-free errors at the TypeScript level.

## Requirements

### Requirement: CliRenderer tracks destroyed state
The `CliRenderer` class SHALL maintain a private `_destroyed` boolean flag, initialized to `false` and set to `true` when `destroy()` is called.

#### Scenario: Initial state is not destroyed
- **WHEN** a new `CliRenderer` is constructed
- **THEN** the internal `_destroyed` flag SHALL be `false`

#### Scenario: destroy sets the flag
- **WHEN** `renderer.destroy()` is called
- **THEN** the internal `_destroyed` flag SHALL be set to `true` before any cleanup operations

### Requirement: CliRenderer guard method prevents use-after-destroy
The `CliRenderer` class SHALL have a private `guard()` method that throws an `Error` if `_destroyed` is `true`. Every public method SHALL call `guard()` as its first operation.

#### Scenario: Method call after destroy throws
- **WHEN** `renderer.destroy()` is called followed by `renderer.render()`
- **THEN** an `Error` SHALL be thrown with message `"CliRenderer used after destroy"`

#### Scenario: Method call before destroy succeeds
- **WHEN** `renderer.render()` is called on a non-destroyed renderer
- **THEN** the render SHALL proceed normally without throwing

#### Scenario: All public methods are guarded
- **WHEN** any public method is called on a destroyed renderer
- **THEN** an `Error` SHALL be thrown
- **AND** the following methods SHALL be guarded: `processEvents`, `setupTerminal`, `restoreTerminal`, `getCurrentBuffer`, `getNextBuffer`, `render`, `renderForce`, `getStats`, `setCursorPosition`, `terminalSize`, `emitKeyEvent`

### Requirement: destroy is idempotent
Calling `destroy()` multiple times SHALL NOT throw or cause double-free errors.

#### Scenario: Double destroy is safe
- **WHEN** `renderer.destroy()` is called twice
- **THEN** the second call SHALL be a no-op (guard check passes because cleanup is already done, or the method returns early)
