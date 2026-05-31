# @moontui/core

Core TypeScript bindings for MoonTUI, a terminal UI library with a Rust backend.

## Installation

```bash
npm install @moontui/core
```

## Usage

```typescript
import { CliRenderer, rgb } from "@moontui/core"

const white = rgb(255, 255, 255, 255)
const black = rgb(0, 0, 0, 255)

const renderer = new CliRenderer()
renderer.setupTerminal({ useAlternateScreen: true })

const buffer = renderer.getNextBuffer()
buffer.clear(black)
buffer.drawText("Hello from MoonTUI!", 2, 2, white)
buffer.drawText("Press any key to exit...", 2, 4, white)

renderer.render()

renderer.on("key", () => {
  renderer.restoreTerminal()
  renderer.destroy()
  process.exit(0)
})

function loop() {
  renderer.processEvents()
  setTimeout(() => loop(), 16)
}

loop()
```

## API

### Layout Renderables

Use `Box` and `Text` on the renderer root for declarative row or column layouts:

```typescript
import { Box, CliRenderer, Text, rgb } from "@moontui/core"

const renderer = new CliRenderer({ width: 40, height: 10 })
const white = rgb(255, 255, 255)

renderer.root.setLayoutProps({ flexDirection: "column", gap: 1 })
renderer.root
  .add(Box({ height: 3, padding: 1 }, Text({ content: "Header", foregroundColor: white })))
  .add(Box({ flexGrow: 1, padding: 1 }, Text({ content: "Flexible body", foregroundColor: white })))

renderer.render()
```

### `CliRenderer`

The main entry point for terminal operations.

- `new CliRenderer(options?)` -- create a renderer instance
- `renderer.setupTerminal(options?)` -- initialize the terminal (enables raw mode, alternate screen)
- `renderer.restoreTerminal()` -- restore terminal to its original state
- `renderer.render()` -- render the current buffer to the terminal
- `renderer.processEvents()` -- poll for input events (keyboard, mouse, resize)
- `renderer.on(event, handler)` -- listen for events (`key`, `mouse`, `resize`, `frame`)
- `renderer.destroy()` -- clean up native resources
- `renderer.getNextBuffer()` -- get the back buffer for drawing
- `renderer.getCurrentBuffer()` -- get the front buffer (last rendered)
- `renderer.setCursorPosition(x, y, visible)` -- set cursor position and visibility
- `renderer.enableMouse(enableMovement?)` -- enable mouse input
- `renderer.disableMouse()` -- disable mouse input
- `renderer.setMousePointerStyle(style)` -- set cursor style (`default`, `pointer`, `text`, `crosshair`, `move`, `not-allowed`)

### `MoonBuffer`

Buffer for drawing operations.

- `buffer.clear(bgColor)` -- fill the buffer with a background color
- `buffer.drawText(text, x, y, fgColor, bgColor?, attributes?)` -- draw text at coordinates
- `buffer.drawChar(charCodepoint, x, y, fgColor, bgColor?, attributes?)` -- draw a single character
- `buffer.drawRect(x, y, width, height, fgColor, bgColor?, attributes?)` -- draw a rectangle
- `buffer.drawBox(options)` -- draw a box with optional borders and title

### `RGBA` / Color Helpers

- `rgb(r, g, b, a?)` -- create an RGB color
- `indexed(slot, r, g, b, a?)` -- create an indexed palette color
- `terminalDefault(r?, g?, b?, a?)` -- create a terminal default color

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
