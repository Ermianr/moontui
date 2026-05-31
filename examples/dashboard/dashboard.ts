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
  private leftColumn!: BoxRenderable;
  private rightColumn!: BoxRenderable;
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
    this.renderer.root.setLayoutProps({
      flexDirection: "row",
      padding: { top: 4, right: 1, bottom: 2, left: 1 },
      gap: 1,
    });
    this.leftColumn = new BoxRenderable({
      flexGrow: 1,
      flexDirection: "column",
      gap: 1,
      backgroundColor: COLOR.surfaceBg,
    });
    this.rightColumn = new BoxRenderable({
      flexGrow: 1,
      flexDirection: "column",
      gap: 1,
      backgroundColor: COLOR.surfaceBg,
    });
    this.systemPanel = new BoxRenderable({
      height: 8,
      border: true,
      borderColor: COLOR.cyan,
      backgroundColor: COLOR.panelBg,
      title: " System Info ",
    });
    this.stylePanel = new BoxRenderable({
      height: 8,
      border: true,
      borderColor: COLOR.yellow,
      backgroundColor: COLOR.panelBg,
      title: " Text Styles ",
    });
    this.colorPanel = new BoxRenderable({
      flexGrow: 1,
      border: true,
      borderColor: COLOR.gray,
      backgroundColor: COLOR.panelBg,
      title: " Colors ",
    });
    this.statsPanel = new BoxRenderable({
      flexGrow: 1,
      border: true,
      borderColor: COLOR.green,
      backgroundColor: COLOR.panelBg,
      title: " Render Stats ",
    });

    this.systemLines = Array.from(
      { length: 4 },
      (_, i) =>
        new TextRenderable({
          content: "",
          position: "absolute",
          left: 2,
          top: 2 + i,
          foregroundColor: COLOR.white,
          backgroundColor: COLOR.panelBg,
        })
    );

    this.styleLines = [
      new TextRenderable({
        content: "Bold text",
        position: "absolute",
        left: 2,
        top: 2,
        foregroundColor: COLOR.white,
        backgroundColor: COLOR.panelBg,
        attributes: ATTR_BOLD,
      }),
      new TextRenderable({
        content: "Italic text",
        position: "absolute",
        left: 2,
        top: 3,
        foregroundColor: COLOR.green,
        backgroundColor: COLOR.panelBg,
        attributes: ATTR_ITALIC,
      }),
      new TextRenderable({
        content: "Underline",
        position: "absolute",
        left: 2,
        top: 4,
        foregroundColor: COLOR.yellow,
        backgroundColor: COLOR.panelBg,
        attributes: ATTR_UNDERLINE,
      }),
      new TextRenderable({
        content: "Bold+Italic",
        position: "absolute",
        left: 2,
        top: 5,
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
      (color, i) =>
        new TextRenderable({
          content: "██",
          position: "absolute",
          left: 2 + i * 2,
          top: 2,
          foregroundColor: color,
          backgroundColor: COLOR.panelBg,
        })
    );

    this.statsLines = Array.from(
      { length: 3 },
      (_, i) =>
        new TextRenderable({
          content: "",
          position: "absolute",
          left: 2,
          top: 2 + i,
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

    this.leftColumn.add(this.systemPanel).add(this.colorPanel);
    this.rightColumn.add(this.stylePanel).add(this.statsPanel);
    this.renderer.root.add(this.leftColumn).add(this.rightColumn);
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

    const uptime = Math.floor((this.timer * 50) / 1000);
    const lines = [
      `Uptime: ${uptime}s`,
      `Frames: ${this.frameCount}`,
      `Toggle: ${this.toggleState ? "ON " : "OFF"}`,
      `Size: ${w}x${h}`,
    ];
    lines.forEach((line, i) => {
      this.systemLines[i].content = line;
    });

    const swatchCount = Math.min(
      this.colorSwatches.length,
      Math.max(0, this.colorPanel.computedLayout.width - 2)
    );
    this.colorSwatches.forEach((swatch, i) => {
      swatch.content = i < swatchCount ? "██" : "";
    });

    const stats = this.renderer.getStats();
    const statsLines = [
      `Frame time: ${stats.lastFrameTimeMs.toFixed(1)}ms`,
      `Cells/upd: ${stats.averageCellsUpdated}`,
      `Avg frame: ${stats.averageFrameTimeMs.toFixed(1)}ms`,
    ];
    statsLines.forEach((line, i) => {
      this.statsLines[i].content = line;
    });

    // --- Animated progress bar ---
    const progY = h - 3;
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
