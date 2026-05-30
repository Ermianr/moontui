import { CliRenderer, rgb, terminalDefault } from "@moontui/core";

const white = rgb(255, 255, 255, 255);
const background = terminalDefault();

const renderer = new CliRenderer();
renderer.setupTerminal({ useAlternateScreen: true });

function draw() {
  const buffer = renderer.getNextBuffer();
  buffer.clear(background);
  buffer.drawText("Hello from MoonTUI!", 2, 2, white, background);
  buffer.drawText("Press any key to exit...", 2, 4, white, background);
  renderer.render();
}

draw();

renderer.on("key", () => {
  renderer.restoreTerminal();
  renderer.destroy();
  process.exit(0);
});

renderer.on("resize", () => draw());

function loop() {
  renderer.processEvents();
  setTimeout(() => loop(), 16);
}

loop();
