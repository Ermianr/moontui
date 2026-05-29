import { CliRenderer, rgb } from "@moontui/core";

const white = rgb(255, 255, 255, 255);
const black = rgb(0, 0, 0, 255);

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
