import { MoonBuffer } from "./buffer";
import { TypedEmitter } from "./emitter";
import {
  api,
  type Buffer as FfiBuffer,
  type Pointer,
  type Renderer,
} from "./ffi";
import type { FFICallbackInstance } from "./platform/types";

export interface RendererOptions {
  fps?: number;
  height?: number;
  test?: boolean;
  useAlternateScreen?: boolean;
  width?: number;
}

export interface RenderStats {
  averageCellsUpdated: number;
  averageFrameTimeMs: number;
  cellsUpdated: number;
  frameCount: number;
  lastFrameTimeMs: number;
  renderTimeUs: number;
  stdoutWriteTimeUs: number;
}

export class KeyEvent {
  readonly type = "key" as const;
  readonly key: string;
  readonly modifiers: { ctrl: boolean; shift: boolean; alt: boolean };
  private _defaultPrevented = false;
  private _propagationStopped = false;

  constructor(
    key: string,
    modifiers: { ctrl: boolean; shift: boolean; alt: boolean }
  ) {
    this.key = key;
    this.modifiers = modifiers;
  }

  preventDefault(): void {
    this._defaultPrevented = true;
  }

  stopPropagation(): void {
    this._propagationStopped = true;
  }

  get defaultPrevented(): boolean {
    return this._defaultPrevented;
  }

  get propagationStopped(): boolean {
    return this._propagationStopped;
  }
}

export interface ResizeEvent {
  height: number;
  type: "resize";
  width: number;
}

export interface FrameEvent {
  stats: RenderStats;
  type: "frame";
}

export interface RendererEvents {
  frame: [FrameEvent];
  key: [KeyEvent];
  resize: [ResizeEvent];
}

export class CliRenderer {
  private readonly _ptr: Pointer<Renderer>;
  private _width: number;
  private _height: number;
  private readonly _emitter = new TypedEmitter<RendererEvents>();
  private readonly _eventCallback: FFICallbackInstance;
  private readonly _resizeCallback: FFICallbackInstance;
  private _cursorX = 0;
  private _cursorY = 0;
  private _cursorVisible = false;
  private _destroyed = false;

  constructor(options: RendererOptions = {}) {
    const size = api.terminal.getTerminalSize();
    this._width = options.width ?? size.width;
    this._height = options.height ?? size.height;
    this._ptr = api.renderer.createRenderer(
      this._width,
      this._height,
      options.test ?? false
    );

    this._eventCallback = api.events.createEventCallback(
      (event: { key: string; ctrl: boolean; shift: boolean; alt: boolean }) => {
        queueMicrotask(() => {
          this._emitter.emit(
            "key",
            new KeyEvent(event.key, {
              ctrl: event.ctrl,
              shift: event.shift,
              alt: event.alt,
            })
          );
        });
      }
    );

    api.events.setEventCallback(
      this._ptr,
      this._eventCallback.ptr as unknown as Pointer<Renderer>
    );

    this._resizeCallback = api.events.createResizeCallback(
      (event: { width: number; height: number }) => {
        this._width = event.width;
        this._height = event.height;
        queueMicrotask(() => {
          this._emitter.emit("resize", {
            type: "resize",
            width: event.width,
            height: event.height,
          });
        });
      }
    );

    api.events.setResizeCallback(
      this._ptr,
      this._resizeCallback.ptr as unknown as Pointer<Renderer>
    );
  }

  private guard(): void {
    if (this._destroyed) {
      throw new Error("CliRenderer used after destroy");
    }
  }

  /** @internal */
  get _unsafePtr(): Pointer<Renderer> {
    return this._ptr;
  }

  processEvents(): void {
    this.guard();
    api.renderer.processEvents(this._ptr);
  }

  setupTerminal(options: { useAlternateScreen?: boolean } = {}): void {
    this.guard();
    const result = api.terminal.setupTerminal(
      this._ptr,
      options.useAlternateScreen ?? true
    );
    if (result !== 0) {
      throw new Error("setupTerminal I/O error: failed to configure terminal");
    }
  }

  restoreTerminal(): void {
    this.guard();
    const result = api.terminal.restoreTerminal(this._ptr);
    if (result !== 0) {
      throw new Error("restoreTerminal I/O error: failed to restore terminal");
    }
  }

  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    api.events.setEventCallback(this._ptr, 0 as unknown as Pointer<Renderer>);
    this._eventCallback.close();
    api.events.setResizeCallback(this._ptr, 0 as unknown as Pointer<Renderer>);
    this._resizeCallback.close();
    const result = api.renderer.destroyRenderer(this._ptr);
    if (result !== 0) {
      throw new Error(
        "destroyRenderer I/O error: failed to restore terminal during cleanup"
      );
    }
  }

  private doRender(force: boolean): void {
    this.guard();
    const result = api.renderer.render(this._ptr, force);
    if (result !== 0) {
      throw new Error("render I/O error: stdout pipe closed");
    }
    const stats = this.getStats();
    this._emitter.emit("frame", { type: "frame", stats });
  }

  private getBuffer(getter: () => Pointer<Renderer>): MoonBuffer {
    this.guard();
    const bufPtr = getter();
    return new MoonBuffer(
      bufPtr as unknown as Pointer<FfiBuffer>,
      this._width,
      this._height
    );
  }

  getCurrentBuffer(): MoonBuffer {
    return this.getBuffer(() => api.renderer.getCurrentBuffer(this._ptr));
  }

  getNextBuffer(): MoonBuffer {
    return this.getBuffer(() => api.renderer.getNextBuffer(this._ptr));
  }

  render(): void {
    this.doRender(false);
  }

  renderForce(): void {
    this.doRender(true);
  }

  on<K extends keyof RendererEvents>(
    event: K,
    handler: (...args: RendererEvents[K]) => void
  ): void {
    this._emitter.on(event, handler);
  }

  getStats(): RenderStats {
    this.guard();
    return api.renderer.getRenderStats(this._ptr);
  }

  setCursorPosition(x: number, y: number, visible: boolean): void {
    this.guard();
    this._cursorX = x;
    this._cursorY = y;
    this._cursorVisible = visible;
    api.renderer.setCursorPosition(this._ptr, x, y, visible);
  }

  getCursorPosition(): { x: number; y: number; visible: boolean } {
    return { x: this._cursorX, y: this._cursorY, visible: this._cursorVisible };
  }

  terminalSize(): { width: number; height: number } {
    this.guard();
    return { width: this._width, height: this._height };
  }

  emitKeyEvent(key: string, ctrl: boolean, shift: boolean, alt: boolean): void {
    this.guard();
    this._emitter.emit("key", new KeyEvent(key, { ctrl, shift, alt }));
  }
}
