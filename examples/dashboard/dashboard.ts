import {
  ATTR_BOLD,
  ATTR_ITALIC,
  ATTR_UNDERLINE,
  api,
  BoxRenderable,
  CliRenderer,
  type MoonBuffer,
  rgb,
  TextRenderable,
  terminalDefault,
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
  surfaceBg: terminalDefault(),
  panelBg: rgb(32, 32, 48),
  headerBg: rgb(0, 0, 96),
  statusBg: rgb(0, 96, 0),
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class Dashboard {
  private renderer!: CliRenderer;
  private systemPanel!: BoxRenderable;
  private stylePanel!: BoxRenderable;
  private colorPanel!: BoxRenderable;
  private statsPanel!: BoxRenderable;
  private systemLines: TextRenderable[] = [];
  private styleLines: TextRenderable[] = [];
  private colorSwatches: TextRenderable[] = [];
  private statsLines: TextRenderable[] = [];
  private running = false;
  private frameCount = 0;
  private toggleState = false;
  private spinnerIdx = 0;
  private timer = 0;

  start(): void {
    const { width, height } = api.terminal.getTerminalSize();
    this.renderer = new CliRenderer({ width, height });
    this.renderer.setupTerminal({ useAlternateScreen: true });
    this.setupRenderableTree();
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

  private setupRenderableTree(): void {
    this.systemPanel = new BoxRenderable({
      border: true,
      borderColor: COLOR.cyan,
      backgroundColor: COLOR.panelBg,
      title: " System Info ",
    });
    this.stylePanel = new BoxRenderable({
      border: true,
      borderColor: COLOR.yellow,
      backgroundColor: COLOR.panelBg,
      title: " Text Styles ",
    });
    this.colorPanel = new BoxRenderable({
      border: true,
      borderColor: COLOR.gray,
      backgroundColor: COLOR.panelBg,
      title: " Colors ",
    });
    this.statsPanel = new BoxRenderable({
      border: true,
      borderColor: COLOR.green,
      backgroundColor: COLOR.panelBg,
      title: " Render Stats ",
    });

    this.systemLines = Array.from(
      { length: 4 },
      () =>
        new TextRenderable({
          content: "",
          foregroundColor: COLOR.white,
          backgroundColor: COLOR.panelBg,
        })
    );

    this.styleLines = [
      new TextRenderable({
        content: "Bold text",
        foregroundColor: COLOR.white,
        backgroundColor: COLOR.panelBg,
        attributes: ATTR_BOLD,
      }),
      new TextRenderable({
        content: "Italic text",
        foregroundColor: COLOR.green,
        backgroundColor: COLOR.panelBg,
        attributes: ATTR_ITALIC,
      }),
      new TextRenderable({
        content: "Underline",
        foregroundColor: COLOR.yellow,
        backgroundColor: COLOR.panelBg,
        attributes: ATTR_UNDERLINE,
      }),
      new TextRenderable({
        content: "Bold+Italic",
        foregroundColor: COLOR.magenta,
        backgroundColor: COLOR.panelBg,
        // biome-ignore lint/suspicious/noBitwiseOperators: attribute flag combination
        attributes: ATTR_BOLD | ATTR_ITALIC,
      }),
    ];

    const swatchColors = [
      COLOR.red,
      COLOR.green,
      COLOR.blue,
      COLOR.yellow,
      COLOR.magenta,
      COLOR.cyan,
      COLOR.orange,
      COLOR.gray,
    ];
    this.colorSwatches = swatchColors.map(
      (color) =>
        new TextRenderable({
          content: "██",
          foregroundColor: color,
          backgroundColor: COLOR.panelBg,
        })
    );

    this.statsLines = Array.from(
      { length: 3 },
      () =>
        new TextRenderable({
          content: "",
          foregroundColor: COLOR.cyan,
          backgroundColor: COLOR.panelBg,
        })
    );

    for (const child of [
      ...this.systemLines,
      ...this.styleLines,
      ...this.colorSwatches,
      ...this.statsLines,
    ]) {
      if (this.systemLines.includes(child)) {
        this.systemPanel.add(child);
      } else if (this.styleLines.includes(child)) {
        this.stylePanel.add(child);
      } else if (this.colorSwatches.includes(child)) {
        this.colorPanel.add(child);
      } else {
        this.statsPanel.add(child);
      }
    }

    this.renderer.root
      .add(this.systemPanel)
      .add(this.stylePanel)
      .add(this.colorPanel)
      .add(this.statsPanel);
  }

  private shutdown(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.renderer.restoreTerminal();
    this.renderer.destroy();
    process.exit(0);
  }

  private loop(): void {
    if (!this.running) {
      return;
    }

    try {
      this.renderer.processEvents();

      const width = this.renderer.terminalSize().width;
      const height = this.renderer.terminalSize().height;

      const buf = this.renderer.getNextBuffer();
      this.drawFrame(buf, width, height);
      this.renderer.render();

      this.frameCount++;
      this.spinnerIdx = (this.spinnerIdx + 1) % SPINNER_FRAMES.length;
      this.timer++;

      setTimeout(() => this.loop(), 50);
    } catch (error) {
      this.shutdown();
      throw error;
    }
  }

  private drawFrame(buf: MoonBuffer, w: number, h: number): void {
    buf.clear(COLOR.surfaceBg);

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

    const p1x = 1;
    const p1y = contentY;
    this.systemPanel.x = p1x;
    this.systemPanel.y = p1y;
    this.systemPanel.width = leftColW;
    this.systemPanel.height = panelH;
    const uptime = Math.floor((this.timer * 50) / 1000);
    const lines = [
      `Uptime: ${uptime}s`,
      `Frames: ${this.frameCount}`,
      `Toggle: ${this.toggleState ? "ON " : "OFF"}`,
      `Size: ${w}x${h}`,
    ];
    lines.forEach((line, i) => {
      this.systemLines[i].content = line;
      this.systemLines[i].x = 2;
      this.systemLines[i].y = 2 + i;
    });

    const p2x = leftColW + gap + 1;
    const p2y = contentY;
    this.stylePanel.x = p2x;
    this.stylePanel.y = p2y;
    this.stylePanel.width = rightColW;
    this.stylePanel.height = panelH;
    this.styleLines.forEach((line, i) => {
      line.x = 2;
      line.y = 2 + i;
    });

    const bottomPanelY = contentY + panelH + gap;

    const p3x = 1;
    const p3y = bottomPanelY;
    const swatchCount = Math.min(this.colorSwatches.length, leftColW - 2);
    this.colorPanel.x = p3x;
    this.colorPanel.y = p3y;
    this.colorPanel.width = leftColW;
    this.colorPanel.height = 5;
    this.colorSwatches.forEach((swatch, i) => {
      swatch.x = 2 + i * 2;
      swatch.y = 2;
      swatch.content = i < swatchCount ? "██" : "";
    });

    const p4x = leftColW + gap + 1;
    const p4y = bottomPanelY;
    this.statsPanel.x = p4x;
    this.statsPanel.y = p4y;
    this.statsPanel.width = rightColW;
    this.statsPanel.height = 5;
    const stats = this.renderer.getStats();
    const statsLines = [
      `Frame time: ${stats.lastFrameTimeMs.toFixed(1)}ms`,
      `Cells/upd: ${stats.averageCellsUpdated}`,
      `Avg frame: ${stats.averageFrameTimeMs.toFixed(1)}ms`,
    ];
    statsLines.forEach((line, i) => {
      this.statsLines[i].content = line;
      this.statsLines[i].x = 2;
      this.statsLines[i].y = 2 + i;
    });

    // --- Animated progress bar ---
    const progY = bottomPanelY + 6;
    const progW = w - 4;
    if (progY < h - 2 && progW > 4) {
      buf.drawText(" Progress:", 2, progY, COLOR.gray, COLOR.surfaceBg);
      const barW = progW - 12;
      if (barW > 0) {
        const progress = (this.timer % 100) / 100;
        const filled = Math.floor(progress * barW);
        const empty = barW - filled;
        const barStr = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
        const pct = `${(progress * 100).toFixed(0)}%`;
        buf.drawText(barStr, 12, progY, COLOR.cyan, COLOR.surfaceBg);
        buf.drawText(pct, 12 + barW + 1, progY, COLOR.yellow, COLOR.surfaceBg);
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
