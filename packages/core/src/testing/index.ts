import type { CapturedFrame } from "../buffer";
import { api } from "../ffi";
import { CliRenderer, type RenderStats } from "../renderer";

export interface TestRendererOptions {
  height?: number;
  kittyKeyboard?: boolean;
  width?: number;
}

export interface TestRendererSetup {
  captureCharFrame: () => string;
  captureSpans: () => CapturedFrame;
  getNativeStats: () => RenderStats;
  mockInput: MockKeys;
  renderer: CliRenderer;
  renderOnce: () => Promise<void>;
  resize: (width: number, height: number) => void;
}

export interface MockKeys {
  pressArrow(
    direction: "up" | "down" | "left" | "right",
    modifiers?: { meta?: boolean }
  ): void;
  pressBackspace(): void;
  pressCtrlC(): void;
  pressEnter(): void;
  pressEscape(): void;
  pressKey(
    key: string,
    modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
  ): void;
  pressTab(): void;
  typeText(text: string, delayMs?: number): void;
}

export interface Spy {
  callCount(): number;
  calledWith(
    // biome-ignore lint/suspicious/noExplicitAny: spy captures arbitrary arguments
    ...args: any[]
  ): boolean;
  // biome-ignore lint/suspicious/noExplicitAny: spy captures arbitrary arguments
  calls: any[][];
  reset(): void;
  // biome-ignore lint/suspicious/noExplicitAny: spy captures arbitrary arguments
  (...args: any[]): void;
}

export function createSpy(): Spy {
  // biome-ignore lint/suspicious/noExplicitAny: spy captures arbitrary arguments
  const calls: any[][] = [];
  // biome-ignore lint/suspicious/noExplicitAny: spy captures arbitrary arguments
  const spy = ((...args: any[]) => {
    calls.push(args);
  }) as Spy;
  spy.callCount = () => calls.length;
  // biome-ignore lint/suspicious/noExplicitAny: spy captures arbitrary arguments
  spy.calledWith = (...args: any[]) =>
    calls.some((call) => {
      if (call.length !== args.length) {
        return false;
      }
      return call.every((arg, i) => arg === args[i]);
    });
  spy.calls = calls;
  spy.reset = () => {
    calls.length = 0;
  };
  return spy;
}

export function createTestRenderer(
  options: TestRendererOptions = {}
): TestRendererSetup {
  const width = options.width ?? 40;
  const height = options.height ?? 10;

  const renderer = new CliRenderer({ test: true, width, height });

  const mockInput: MockKeys = {
    pressKey(key, modifiers = {}) {
      renderer.emitKeyEvent(
        key,
        modifiers.ctrl ?? false,
        modifiers.shift ?? false,
        modifiers.alt ?? false
      );
    },

    typeText(text, _delayMs = 0) {
      for (const ch of text) {
        this.pressKey(ch);
      }
    },

    pressEnter() {
      this.pressKey("enter");
    },

    pressEscape() {
      this.pressKey("esc");
    },

    pressTab() {
      this.pressKey("tab");
    },

    pressBackspace() {
      this.pressKey("backspace");
    },

    pressArrow(direction, _modifiers = {}) {
      this.pressKey(direction);
    },

    pressCtrlC() {
      this.pressKey("c", { ctrl: true });
    },
  };

  return {
    renderer,
    mockInput,
    renderOnce: () => {
      renderer.render();
      return Promise.resolve();
    },
    captureCharFrame: () => {
      const buffer = renderer.getCurrentBuffer();
      const bytes = buffer.getRealCharBytes(true);
      return new TextDecoder().decode(bytes);
    },
    captureSpans: () => {
      const buffer = renderer.getCurrentBuffer();
      const lines = buffer.getSpanLines();
      const cursor = renderer.getCursorPosition();
      return {
        cols: width,
        rows: height,
        cursor: [cursor.x, cursor.y] as [number, number],
        lines,
      };
    },
    getNativeStats: () => renderer.getStats(),
    resize: (w, h) => {
      api.renderer.injectResizeEvent(renderer._unsafePtr, w, h);
    },
  };
}
