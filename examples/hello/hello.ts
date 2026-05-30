import { Box, CliRenderer, rgb, Text, terminalDefault } from "@moontui/core";

const white = rgb(255, 255, 255, 255);
const background = terminalDefault();

const renderer = new CliRenderer();
renderer.setupTerminal({ useAlternateScreen: true });
let running = true;

renderer.root.add(
  Box(
    {
      x: 1,
      y: 1,
      width: 32,
      height: 6,
      borderColor: white,
      backgroundColor: background,
      title: " MoonTUI ",
    },
    Text({
      x: 2,
      y: 2,
      content: "Hello from MoonTUI!",
      foregroundColor: white,
      backgroundColor: background,
    }),
    Text({
      x: 2,
      y: 4,
      content: "Press any key to exit...",
      foregroundColor: white,
      backgroundColor: background,
    })
  )
);

function shutdown() {
  running = false;
  renderer.restoreTerminal();
  renderer.destroy();
}

function draw() {
  const buffer = renderer.getNextBuffer();
  buffer.clear(background);
  renderer.render();
}

draw();

renderer.on("key", () => {
  shutdown();
  process.exit(0);
});

renderer.on("resize", () => draw());

function loop() {
  if (!running) {
    return;
  }
  try {
    renderer.processEvents();
    setTimeout(() => loop(), 16);
  } catch (error) {
    shutdown();
    throw error;
  }
}

loop();
