import type { CapturedFrame } from "../buffer";
import { api } from "../ffi";
import { buttonToNative, scrollDirectionToNative } from "../mouse";
import {
  defaultLayoutEngine,
  type LayoutEngine,
  type LayoutRect,
  type Renderable,
  type RootRenderable,
} from "../renderable";
import { CliRenderer, type RenderStats } from "../renderer";

export interface TestRendererOptions {
  autoFocus?: boolean;
  height?: number;
  kittyKeyboard?: boolean;
  layoutEngine?: LayoutEngine;
  useMouse?: boolean;
  width?: number;
}

export interface TestRendererSetup {
  captureCharFrame: () => string;
  captureSpans: () => CapturedFrame;
  getNativeStats: () => RenderStats;
  mockInput: MockKeys;
  mockMouse: MockMouse;
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

export interface MockMouse {
  click(
    x: number,
    y: number,
    options?: {
      button?: "left" | "middle" | "right";
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
    }
  ): void;
  down(
    x: number,
    y: number,
    options?: {
      button?: "left" | "middle" | "right";
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
    }
  ): void;
  drag(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    options?: {
      button?: "left";
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
    }
  ): void;
  move(
    x: number,
    y: number,
    options?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
  ): void;
  scroll(
    x: number,
    y: number,
    direction: "up" | "down" | "left" | "right"
  ): void;
  up(
    x: number,
    y: number,
    options?: {
      button?: "left" | "middle" | "right";
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
    }
  ): void;
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

export interface CountingLayoutEngine extends LayoutEngine {
  count(): number;
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

export function assertLayoutRect(
  renderable: Renderable,
  expected: LayoutRect
): void {
  const actual = renderable.computedLayout;
  if (
    actual.x !== expected.x ||
    actual.y !== expected.y ||
    actual.width !== expected.width ||
    actual.height !== expected.height
  ) {
    throw new Error(
      `Expected layout ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

export function createCountingLayoutEngine(
  engine: LayoutEngine = defaultLayoutEngine
): CountingLayoutEngine {
  let computeCount = 0;
  return {
    compute(root: RootRenderable, width: number, height: number) {
      computeCount++;
      engine.compute(root, width, height);
    },
    count() {
      return computeCount;
    },
  };
}

export function createTestRenderer(
  options: TestRendererOptions = {}
): TestRendererSetup {
  const width = options.width ?? 40;
  const height = options.height ?? 10;

  const renderer = new CliRenderer({
    test: true,
    width,
    autoFocus: options.autoFocus,
    height,
    layoutEngine: options.layoutEngine,
    useMouse: options.useMouse ?? true,
  });

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

  const mockMouse: MockMouse = {
    click(x, y, options = {}) {
      const btn = buttonToNative(options.button ?? "left");
      const ctrl = options.ctrl ?? false;
      const shift = options.shift ?? false;
      const alt = options.alt ?? false;
      renderer.injectMouseEvent("down", btn, x, y, ctrl, shift, alt, 0);
      renderer.injectMouseEvent("up", btn, x, y, ctrl, shift, alt, 0);
    },

    move(x, y, options = {}) {
      const ctrl = options.ctrl ?? false;
      const shift = options.shift ?? false;
      const alt = options.alt ?? false;
      renderer.injectMouseEvent("move", 3, x, y, ctrl, shift, alt, 0);
    },

    scroll(x, y, direction) {
      const scrollDir = scrollDirectionToNative(direction);
      renderer.injectMouseEvent(
        "scroll",
        3,
        x,
        y,
        false,
        false,
        false,
        scrollDir
      );
    },

    down(x, y, options = {}) {
      const btn = buttonToNative(options.button ?? "left");
      const ctrl = options.ctrl ?? false;
      const shift = options.shift ?? false;
      const alt = options.alt ?? false;
      renderer.injectMouseEvent("down", btn, x, y, ctrl, shift, alt, 0);
    },

    up(x, y, options = {}) {
      const btn = buttonToNative(options.button ?? "left");
      const ctrl = options.ctrl ?? false;
      const shift = options.shift ?? false;
      const alt = options.alt ?? false;
      renderer.injectMouseEvent("up", btn, x, y, ctrl, shift, alt, 0);
    },

    drag(fromX, fromY, toX, toY, options = {}) {
      const btn = buttonToNative(options.button ?? "left");
      const ctrl = options.ctrl ?? false;
      const shift = options.shift ?? false;
      const alt = options.alt ?? false;
      renderer.injectMouseEvent("down", btn, fromX, fromY, ctrl, shift, alt, 0);
      renderer.injectMouseEvent("drag", btn, toX, toY, ctrl, shift, alt, 0);
      renderer.injectMouseEvent("up", btn, toX, toY, ctrl, shift, alt, 0);
    },
  };

  return {
    renderer,
    mockInput,
    mockMouse,
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
      const size = renderer.terminalSize();
      return {
        cols: size.width,
        rows: size.height,
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
