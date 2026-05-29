# @moontui/core

Core TypeScript bindings for MoonTUI, a terminal UI library with a Rust backend.

## Installation

```bash
npm install @moontui/core
```

## Usage

```typescript
import { Terminal } from "@moontui/core"

const terminal = new Terminal()
terminal.init()

terminal.draw(0, 0, "Hello, MoonTUI!")
terminal.flush()

await terminal.waitForInput()
terminal.restore()
```

## API

### `Terminal`

The main entry point for terminal operations.

- `terminal.init()` -- initialize the terminal (enables raw mode, alternate screen)
- `terminal.restore()` -- restore terminal to its original state
- `terminal.draw(x, y, text)` -- draw text at the given position
- `terminal.flush()` -- flush the buffer to the terminal
- `terminal.waitForInput()` -- wait for user input (keyboard or mouse)

## Platform Support

| Platform | Architecture | Binary |
|----------|-------------|--------|
| macOS | x86_64 | `libmoontui_core.dylib` |
| macOS | aarch64 | `libmoontui_core.dylib` |
| Linux | x86_64 | `libmoontui_core.so` |
| Linux | aarch64 | `libmoontui_core.so` |
| Windows | x86_64 | `moontui_core.dll` |

## License

[MIT](LICENSE)
