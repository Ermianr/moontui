import { CliRenderer } from "@moontui/core";

const white = { r: 65_535, g: 65_535, b: 65_535, a: 65_535 };
const black = { r: 0, g: 0, b: 0, a: 65_535 };

const renderer = new CliRenderer();
renderer.setupTerminal({ useAlternateScreen: true });

const buffer = renderer.getNextBuffer();
buffer.clear(black);
buffer.drawText("Hello from MoonTUI!", 2, 2, white);
buffer.drawText("Press any key to exit...", 2, 4, white);

renderer.render();

renderer.on("key", () => {
  renderer.restoreTerminal();
  renderer.destroy();
  process.exit(0);
});

function loop() {
  renderer.processEvents();
  setTimeout(() => loop(), 16);
}

loop();
