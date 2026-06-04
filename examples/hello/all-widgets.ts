import {
  ATTR_BOLD,
  Box,
  Button,
  Checkbox,
  CliRenderer,
  Input,
  rgb,
  Text,
  terminalDefault,
} from "@moontui/core";

const COLOR = {
  background: terminalDefault(),
  border: rgb(90, 180, 255),
  dim: rgb(120, 120, 120),
  focus: rgb(32, 48, 72),
  green: rgb(90, 220, 130),
  red: rgb(255, 100, 100),
  text: rgb(235, 235, 235),
  yellow: rgb(255, 220, 100),
};

const renderer = new CliRenderer({ autoFocus: false });
renderer.setupTerminal({ useAlternateScreen: true });

let running = true;
let username = "";
let emailUpdates = false;
let telemetry = true;
let drawScheduled = false;

function scheduleDraw(): void {
  if (drawScheduled) {
    return;
  }
  drawScheduled = true;
  queueMicrotask(() => {
    drawScheduled = false;
    draw();
  });
}

const nameInput = Input({
  position: "absolute",
  left: 2,
  top: 5,
  width: 28,
  placeholder: "Your name",
  foregroundColor: COLOR.text,
  placeholderColor: COLOR.dim,
  backgroundColor: COLOR.background,
  focusedBackgroundColor: COLOR.focus,
  onBlur: scheduleDraw,
  onFocus: scheduleDraw,
  onInput: (value) => {
    username = value;
    updatePreview();
    draw();
  },
});

const emailCheckbox = Checkbox({
  position: "absolute",
  left: 2,
  top: 6,
  width: 20,
  label: "Email updates",
  foregroundColor: COLOR.text,
  backgroundColor: COLOR.background,
  focusedBackgroundColor: COLOR.focus,
  onBlur: scheduleDraw,
  onChange: (checked) => {
    emailUpdates = checked;
    updatePreview();
    draw();
  },
  onFocus: scheduleDraw,
});

const telemetryCheckbox = Checkbox({
  position: "absolute",
  left: 2,
  top: 7,
  width: 20,
  label: "Telemetry",
  checked: telemetry,
  foregroundColor: COLOR.text,
  backgroundColor: COLOR.background,
  focusedBackgroundColor: COLOR.focus,
  onBlur: scheduleDraw,
  onChange: (checked) => {
    telemetry = checked;
    updatePreview();
    draw();
  },
  onFocus: scheduleDraw,
});

const submitButton = Button({
  position: "absolute",
  left: 32,
  top: 5,
  width: 10,
  label: "Submit",
  foregroundColor: COLOR.text,
  backgroundColor: COLOR.background,
  focusedBackgroundColor: COLOR.focus,
  focusedForegroundColor: COLOR.green,
  onBlur: scheduleDraw,
  onFocus: scheduleDraw,
  onPress: () => {
    statusLine.content = username
      ? `Submitted profile for ${username}.`
      : "Name is required before submit.";
    statusLine.foregroundColor = username ? COLOR.green : COLOR.red;
    draw();
  },
});

const resetButton = Button({
  position: "absolute",
  left: 32,
  top: 7,
  width: 10,
  label: "Reset",
  foregroundColor: COLOR.text,
  backgroundColor: COLOR.background,
  focusedBackgroundColor: COLOR.focus,
  onBlur: scheduleDraw,
  onFocus: scheduleDraw,
  onPress: () => {
    username = "";
    emailUpdates = false;
    telemetry = true;
    nameInput.value = "";
    nameInput.cursorIndex = 0;
    emailCheckbox.checked = false;
    telemetryCheckbox.checked = true;
    statusLine.content = "Form reset.";
    statusLine.foregroundColor = COLOR.dim;
    updatePreview();
    draw();
  },
});

const statusLine = Text({
  position: "absolute",
  left: 2,
  top: 8,
  content: "Fill the form, then press Submit.",
  foregroundColor: COLOR.dim,
  backgroundColor: COLOR.background,
});

const namePreview = Text({
  position: "absolute",
  left: 2,
  top: 10,
  content: "Name: <empty>",
  foregroundColor: COLOR.text,
  backgroundColor: COLOR.background,
});

const preferencePreview = Text({
  position: "absolute",
  left: 2,
  top: 11,
  content: "Preferences: telemetry",
  foregroundColor: COLOR.text,
  backgroundColor: COLOR.background,
});

function updatePreview(): void {
  namePreview.content = `Name: ${username || "<empty>"}`;
  const preferences = [
    emailUpdates ? "email updates" : "",
    telemetry ? "telemetry" : "",
  ].filter(Boolean);
  preferencePreview.content = `Preferences: ${preferences.join(", ") || "none"}`;
}

renderer.root.add(
  Box(
    {
      position: "absolute",
      left: 1,
      top: 1,
      width: 48,
      height: 13,
      border: true,
      borderColor: COLOR.border,
      backgroundColor: COLOR.background,
      title: " All Widgets ",
    },
    Text({
      position: "absolute",
      left: 2,
      top: 2,
      content: "MoonTUI widget sampler",
      foregroundColor: COLOR.yellow,
      backgroundColor: COLOR.background,
      attributes: ATTR_BOLD,
    }),
    Text({
      position: "absolute",
      left: 2,
      top: 3,
      content: "Tab moves focus. Click outside clears focus.",
      foregroundColor: COLOR.dim,
      backgroundColor: COLOR.background,
    }),
    nameInput,
    emailCheckbox,
    telemetryCheckbox,
    submitButton,
    resetButton,
    statusLine,
    namePreview,
    preferencePreview
  )
);

function shutdown(): void {
  running = false;
  renderer.restoreTerminal();
  renderer.destroy();
}

function draw(): void {
  const buffer = renderer.getNextBuffer();
  buffer.clear(COLOR.background);
  renderer.render();
}

draw();

renderer.on("key", (event) => {
  const key = event.key.toLowerCase();
  if (key !== "esc" && key !== "escape") {
    return;
  }
  shutdown();
  process.exit(0);
});

renderer.on("resize", () => draw());
renderer.on("mouse", () => draw());

function loop(): void {
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
