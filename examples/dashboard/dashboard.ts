import {
  ATTR_BOLD,
  ATTR_ITALIC,
  ATTR_UNDERLINE,
  api,
  CliRenderer,
  type MoonBuffer,
  rgb,
} from "@moontui/core";

const COLOR = {
  white: rgb(255, 255, 255),
  black: rgb(0, 0, 0),
  red: rgb(255, 0, 0),
  green: rgb(0, 255, 0),
  blue: rgb(0, 0, 255),
  cyan: rgb(0, 255, 255),
  yellow: rgb(255, 255, 0),
  magenta: rgb(255, 0, 255),
  gray: rgb(128, 128, 128),
  darkGray: rgb(64, 64, 64),
  darkBlue: rgb(0, 0, 128),
  darkGreen: rgb(0, 128, 0),
  orange: rgb(255, 128, 0),
  panelBg: rgb(32, 32, 48),
  headerBg: rgb(0, 0, 96),
  statusBg: rgb(0, 96, 0),
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class Dashboard {
  private renderer!: CliRenderer;
  private running = false;
  private frameCount = 0;
  private toggleState = false;
  private spinnerIdx = 0;
  private timer = 0;

  start(): void {
    const { width, height } = api.terminal.getTerminalSize();
    this.renderer = new CliRenderer({ width, height });
    this.renderer.setupTerminal({ useAlternateScreen: true });
    this.running = true;

    this.renderer.on("key", (e) => {
      if (e.key === "q" || e.key === "esc") {
        this.shutdown();
      }
      if (e.key === " ") {
        this.toggleState = !this.toggleState;
      }
    });

    // biome-ignore lint/suspicious/noEmptyBlockStatements: placeholder
    this.renderer.on("resize", () => {});

    this.loop();
  }

  private shutdown(): void {
    this.running = false;
    this.renderer.restoreTerminal();
    this.renderer.destroy();
    process.exit(0);
  }

  private loop(): void {
    if (!this.running) {
      return;
    }

    const width = this.renderer.terminalSize().width;
    const height = this.renderer.terminalSize().height;

    this.renderer.processEvents();

    const buf = this.renderer.getNextBuffer();
    this.drawFrame(buf, width, height);
    this.renderer.render();

    this.frameCount++;
    this.spinnerIdx = (this.spinnerIdx + 1) % SPINNER_FRAMES.length;
    this.timer++;

    setTimeout(() => this.loop(), 50);
  }

  private drawFrame(buf: MoonBuffer, w: number, h: number): void {
    buf.clear(COLOR.black);

    // --- Header bar ---
    const headerBg = this.toggleState ? COLOR.darkGreen : COLOR.headerBg;
    buf.fillRect(0, 0, w, 3, headerBg);
    const title = " MoonTUI Dashboard ";
    const titleX = Math.floor((w - title.length) / 2);
    const titleColor = this.toggleState ? COLOR.yellow : COLOR.cyan;
    buf.drawText(title, titleX, 1, titleColor, headerBg, ATTR_BOLD);

    // --- Status bar ---
    const statusY = h - 1;
    buf.fillRect(0, statusY, w, 1, COLOR.statusBg);
    const statusLeft = ` SPACE:toggle  Q/ESC:quit  Frame:${this.frameCount} `;
    buf.drawText(statusLeft, 0, statusY, COLOR.white, COLOR.statusBg);
    const spinner = SPINNER_FRAMES[this.spinnerIdx];
    buf.drawText(spinner, w - 2, statusY, COLOR.yellow, COLOR.statusBg);
    this.renderer.setCursorPosition(0, 0, false);

    // --- Layout constants ---
    const contentY = 4;
    const panelH = Math.min(8, Math.floor((h - contentY - 2) / 2));
    const gap = 1;
    const leftColW = Math.floor(w * 0.45);
    const rightColW = w - leftColW - gap - 2;

    // --- Panel 1: System Info (left column) ---
    const p1x = 1;
    const p1y = contentY;
    buf.drawBox({
      x: p1x,
      y: p1y,
      width: leftColW,
      height: panelH,
      border: true,
      borderColor: COLOR.cyan,
      backgroundColor: COLOR.panelBg,
      title: " System Info ",
    });
    const uptime = Math.floor((this.timer * 50) / 1000);
    const lines = [
      `Uptime: ${uptime}s`,
      `Frames: ${this.frameCount}`,
      `Toggle: ${this.toggleState ? "ON " : "OFF"}`,
      `Size: ${w}x${h}`,
    ];
    for (let i = 0; i < lines.length; i++) {
      buf.drawText(lines[i], p1x + 2, p1y + 2 + i, COLOR.white, COLOR.panelBg);
    }

    // --- Panel 2: Style Demo (right column) ---
    const p2x = leftColW + gap + 1;
    const p2y = contentY;
    buf.drawBox({
      x: p2x,
      y: p2y,
      width: rightColW,
      height: panelH,
      border: true,
      borderColor: COLOR.yellow,
      backgroundColor: COLOR.panelBg,
      title: " Text Styles ",
    });
    buf.drawText(
      "Bold text",
      p2x + 2,
      p2y + 2,
      COLOR.white,
      COLOR.panelBg,
      ATTR_BOLD
    );
    buf.drawText(
      "Italic text",
      p2x + 2,
      p2y + 3,
      COLOR.green,
      COLOR.panelBg,
      ATTR_ITALIC
    );
    buf.drawText(
      "Underline",
      p2x + 2,
      p2y + 4,
      COLOR.yellow,
      COLOR.panelBg,
      ATTR_UNDERLINE
    );
    buf.drawText(
      "Bold+Italic",
      p2x + 2,
      p2y + 5,
      COLOR.magenta,
      COLOR.panelBg,
      // biome-ignore lint/suspicious/noBitwiseOperators: attribute flag combination
      ATTR_BOLD | ATTR_ITALIC
    );

    const bottomPanelY = contentY + panelH + gap;

    // --- Panel 3: Color Palette (left column) ---
    const p3x = 1;
    const p3y = bottomPanelY;
    const colors = [
      COLOR.red,
      COLOR.green,
      COLOR.blue,
      COLOR.yellow,
      COLOR.magenta,
      COLOR.cyan,
      COLOR.orange,
      COLOR.gray,
    ];
    const swatchCount = Math.min(colors.length, leftColW - 2);
    buf.drawBox({
      x: p3x,
      y: p3y,
      width: leftColW,
      height: 5,
      border: true,
      borderColor: COLOR.gray,
      backgroundColor: COLOR.panelBg,
      title: " Colors ",
    });
    for (let i = 0; i < swatchCount; i++) {
      buf.fillRect(p3x + 2 + i, p3y + 2, 1, 2, colors[i]);
    }

    // --- Panel 4: Stats (right column) ---
    const p4x = leftColW + gap + 1;
    const p4y = bottomPanelY;
    buf.drawBox({
      x: p4x,
      y: p4y,
      width: rightColW,
      height: 5,
      border: true,
      borderColor: COLOR.green,
      backgroundColor: COLOR.panelBg,
      title: " Render Stats ",
    });
    const stats = this.renderer.getStats();
    const statsLines = [
      `Frame time: ${stats.lastFrameTimeMs.toFixed(1)}ms`,
      `Cells/upd: ${stats.averageCellsUpdated}`,
      `Avg frame: ${stats.averageFrameTimeMs.toFixed(1)}ms`,
    ];
    for (let i = 0; i < statsLines.length; i++) {
      buf.drawText(
        statsLines[i],
        p4x + 2,
        p4y + 2 + i,
        COLOR.cyan,
        COLOR.panelBg
      );
    }

    // --- Animated progress bar ---
    const progY = bottomPanelY + 6;
    const progW = w - 4;
    if (progY < h - 2 && progW > 4) {
      buf.drawText(" Progress:", 2, progY, COLOR.gray, COLOR.black);
      const barW = progW - 12;
      if (barW > 0) {
        const progress = (this.timer % 100) / 100;
        const filled = Math.floor(progress * barW);
        const empty = barW - filled;
        const barStr = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
        const pct = `${(progress * 100).toFixed(0)}%`;
        buf.drawText(barStr, 12, progY, COLOR.cyan, COLOR.black);
        buf.drawText(pct, 12 + barW + 1, progY, COLOR.yellow, COLOR.black);
      }
    }

    // -- Toggle indicator in status bar ---
    if (this.toggleState) {
      const indicator = " [ACTIVE] ";
      buf.drawText(
        indicator,
        w - indicator.length - 6,
        statusY,
        COLOR.green,
        COLOR.statusBg,
        ATTR_BOLD
      );
    }
  }
}

const dashboard = new Dashboard();
dashboard.start();
