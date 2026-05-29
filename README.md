# MoonTUI

A terminal UI library with a Rust core and TypeScript bindings, built on top of crossterm.

## Features

- Cross-platform terminal manipulation (Windows, macOS, Linux)
- Buffer-based rendering with diffing
- Input handling (keyboard, mouse)
- TypeScript-first API via FFI bindings
- Works with Bun, Node.js, and Deno

## Installation

```bash
npm install @moontui/core
```

## Quick Start

```typescript
import { Terminal } from "@moontui/core"

const terminal = new Terminal()
terminal.init()

terminal.draw(0, 0, "Hello, MoonTUI!")
terminal.flush()

await terminal.waitForInput()
terminal.restore()
```

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Bun](https://bun.sh/) >= 1.3.0

### Setup

```bash
git clone https://github.com/Ermianr/moontui.git
cd moontui
bun install
cargo build
```

### Running Tests

```bash
# Rust tests
cargo test

# TypeScript tests
bun test --cwd packages/core
```

### Building

```bash
# Build native binary + TypeScript library
bun run build

# Build native binary only
bun run build:native

# Build TypeScript library only
bun run build:lib
```

## Project Structure

```
moontui/
  crates/
    moontui-core/       # Rust core: terminal, buffer, rendering, input
    moontui-macros/     # Proc macros for FFI codegen
  packages/
    core/               # TypeScript bindings and npm package
    config/             # Shared TypeScript configuration
  examples/             # Demo applications
  scripts/              # Build and codegen scripts
```

## License

[MIT](LICENSE)
