import {
  Box,
  Button,
  Checkbox,
  CliRenderer,
  Input,
  rgb,
  Text,
  terminalDefault,
} from "@moontui/core";

const white = rgb(255, 255, 255, 255);
const dim = rgb(120, 120, 120, 255);
const focused = rgb(24, 32, 48, 255);
const background = terminalDefault();

const renderer = new CliRenderer();
renderer.setupTerminal({ useAlternateScreen: true });
let running = true;
let accepted = false;
let submitted = "Not submitted";
const statusLine = Text({
  x: 2,
  y: 6,
  content: submitted,
  foregroundColor: white,
  backgroundColor: background,
});

renderer.root.add(
  Box(
    {
      x: 1,
      y: 1,
      width: 32,
      height: 8,
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
    Input({
      x: 2,
      y: 3,
      width: 24,
      placeholder: "Type your name",
      foregroundColor: white,
      placeholderColor: dim,
      backgroundColor: background,
      focusedBackgroundColor: focused,
      onInput: () => draw(),
    }),
    Checkbox({
      x: 2,
      y: 4,
      label: "Accept terms",
      foregroundColor: white,
      backgroundColor: background,
      focusedBackgroundColor: focused,
      onChange: (checked) => {
        accepted = checked;
        submitted = checked ? "Ready to submit" : "Not submitted";
        statusLine.content = submitted;
        draw();
      },
    }),
    Button({
      x: 2,
      y: 5,
      label: "Submit",
      foregroundColor: white,
      backgroundColor: background,
      focusedBackgroundColor: focused,
      disabledForegroundColor: dim,
      onPress: () => {
        submitted = accepted ? "Submitted" : "Accept terms first";
        statusLine.content = submitted;
        draw();
      },
    }),
    statusLine
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

renderer.on("key", (event) => {
  if (event.key !== "esc") {
    return;
  }
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
