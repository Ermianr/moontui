import { MoonBuffer, ReadonlyMoonBuffer } from "./buffer";
import { TypedEmitter } from "./emitter";
import {
  api,
  type Buffer as FfiBuffer,
  type MutablePointer,
  type Pointer,
  type ReadonlyPointer,
  type Renderer,
} from "./ffi";
import { FocusManager } from "./focus-manager";
import {
  buttonFromNative,
  MouseEvent as MoonMouseEvent,
  type MousePointerStyle,
  mousePointerStyleFromNative,
  mousePointerStyleToNative,
  parseMouseKind,
  scrollDirectionFromNative,
} from "./mouse";
import type { FFICallbackInstance } from "./platform/types";
import {
  defaultLayoutEngine,
  type LayoutEngine,
  type Renderable,
  type RenderContext,
  RootRenderable,
} from "./renderable";

export interface RendererOptions {
  autoFocus?: boolean;
  enableMouseMovement?: boolean;
  fps?: number;
  height?: number;
  test?: boolean;
  useAlternateScreen?: boolean;
  useMouse?: boolean;
  width?: number;
}

interface InternalRendererOptions extends RendererOptions {
  layoutEngine?: LayoutEngine;
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
  mouse: [MoonMouseEvent];
  resize: [ResizeEvent];
}

export class CliRenderer implements RenderContext {
  readonly root: RootRenderable;
  private readonly _ptr: Pointer<Renderer>;
  private _width: number;
  private _height: number;
  private readonly _emitter = new TypedEmitter<RendererEvents>();
  private readonly _eventCallback: FFICallbackInstance;
  private readonly _resizeCallback: FFICallbackInstance;
  private _mouseCallback: FFICallbackInstance | null = null;
  private _cursorX = 0;
  private _cursorY = 0;
  private _cursorVisible = false;
  private _destroyed = false;
  private _useMouse: boolean;
  private _enableMouseMovement: boolean;
  private _autoFocus: boolean;
  private readonly _focusManager: FocusManager;
  private readonly _useAlternateScreen: boolean;
  private readonly _layoutEngine: LayoutEngine;
  private readonly _hitIds = new WeakMap<Renderable, number>();
  private readonly _hitTargets = new Map<number, Renderable>();
  private _nextHitId = 1;

  constructor(options: InternalRendererOptions = {}) {
    const size = api.terminal.getTerminalSize();
    this._width = options.width ?? size.width;
    this._height = options.height ?? size.height;
    this._useMouse = options.useMouse ?? true;
    this._enableMouseMovement = options.enableMouseMovement ?? true;
    this._autoFocus = options.autoFocus ?? true;
    this._useAlternateScreen = options.useAlternateScreen ?? true;
    this._layoutEngine = options.layoutEngine ?? defaultLayoutEngine;
    this._ptr = api.renderer.createRenderer(
      this._width,
      this._height,
      options.test ?? false
    );
    this.root = new RootRenderable(this._width, this._height);
    this._focusManager = new FocusManager(this.root);

    this._eventCallback = api.events.createEventCallback(
      (event: { key: string; ctrl: boolean; shift: boolean; alt: boolean }) => {
        queueMicrotask(() => {
          this.dispatchKeyEvent(
            new KeyEvent(event.key, {
              ctrl: event.ctrl,
              shift: event.shift,
              alt: event.alt,
            })
          );
        });
      }
    );

    api.events.setEventCallback(this._ptr, this._eventCallback.ptr);

    this._resizeCallback = api.events.createResizeCallback(
      (event: { width: number; height: number }) => {
        this._width = event.width;
        this._height = event.height;
        this.root.width = event.width;
        this.root.height = event.height;
        queueMicrotask(() => {
          this._emitter.emit("resize", {
            type: "resize",
            width: event.width,
            height: event.height,
          });
        });
      }
    );

    api.events.setResizeCallback(this._ptr, this._resizeCallback.ptr);

    if (this._useMouse) {
      this._mouseCallback = api.events.createMouseCallback(
        (raw: {
          kind: string;
          button: number;
          x: number;
          y: number;
          ctrl: boolean;
          shift: boolean;
          alt: boolean;
          scrollDir: number;
        }) => {
          queueMicrotask(() => {
            const kind = parseMouseKind(raw.kind);
            if (!kind) {
              return;
            }
            this.dispatchMouseEvent(this.createMouseEvent(raw, kind));
          });
        }
      );

      api.events.setMouseCallback(this._ptr, this._mouseCallback?.ptr);
    }
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
      options.useAlternateScreen ?? this._useAlternateScreen,
      this._useMouse,
      this._enableMouseMovement
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
    if (this._mouseCallback) {
      api.events.setMouseCallback(this._ptr, 0);
      this._mouseCallback.close();
      this._mouseCallback = null;
    }
    api.events.setEventCallback(this._ptr, 0);
    this._eventCallback.close();
    api.events.setResizeCallback(this._ptr, 0);
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
    if (this.root.layoutDirty) {
      this._layoutEngine.compute(this.root, this._width, this._height);
    }
    api.renderer.hitGridClear(this._ptr);
    this._hitTargets.clear();
    this.setCursorPosition(0, 0, false);
    this.root.render(this.getNextBuffer(), 0, 0, this);
    const result = api.renderer.render(this._ptr, force);
    if (result !== 0) {
      throw new Error("render I/O error: stdout pipe closed");
    }
    const stats = this.getStats();
    this._emitter.emit("frame", { type: "frame", stats });
  }

  private getReadonlyBuffer(
    getter: () => ReadonlyPointer<FfiBuffer>
  ): ReadonlyMoonBuffer {
    this.guard();
    const bufPtr = getter();
    return new ReadonlyMoonBuffer(bufPtr, this._width, this._height);
  }

  private getBuffer(getter: () => MutablePointer<FfiBuffer>): MoonBuffer {
    this.guard();
    const bufPtr = getter();
    return new MoonBuffer(bufPtr, this._width, this._height);
  }

  private dispatchKeyEvent(event: KeyEvent): void {
    this.ensureAutoFocus();
    this._focusManager.dispatchKey(event);
    if (!event.propagationStopped) {
      this._emitter.emit("key", event);
    }
  }

  private createMouseEvent(
    raw: {
      button: number;
      x: number;
      y: number;
      ctrl: boolean;
      shift: boolean;
      alt: boolean;
      scrollDir: number;
    },
    kind: Exclude<MoonMouseEvent["kind"], "drag-end" | "drop" | "over" | "out">
  ): MoonMouseEvent {
    const target = this.resolveMouseTarget(raw.x, raw.y);
    return new MoonMouseEvent({
      kind,
      button: buttonFromNative(raw.button),
      x: raw.x,
      y: raw.y,
      modifiers: {
        ctrl: raw.ctrl,
        shift: raw.shift,
        alt: raw.alt,
      },
      scroll:
        kind === "scroll"
          ? { direction: scrollDirectionFromNative(raw.scrollDir) }
          : undefined,
      target,
    });
  }

  private dispatchMouseEvent(event: MoonMouseEvent): void {
    if (event.kind === "down" && event.button === "left") {
      this.focusMouseTarget(event.target);
    }
    if (event.target && event.target instanceof RootRenderable === false) {
      const target = event.target as Renderable;
      target._handleMouse(event);
    }
    if (!event.propagationStopped) {
      this._emitter.emit("mouse", event);
    }
  }

  private focusMouseTarget(target: unknown | null): void {
    if (target instanceof RootRenderable || !target) {
      this._focusManager.blur();
      return;
    }
    const renderable = target as Renderable;
    if (renderable.focusable && !renderable.disabled) {
      this._focusManager.focus(renderable);
      return;
    }
    this._focusManager.blur();
  }

  private resolveMouseTarget(x: number, y: number): Renderable | null {
    const id = this.checkHit(x, y);
    return this._hitTargets.get(id) ?? null;
  }

  private ensureAutoFocus(): void {
    if (!this._autoFocus || this._focusManager.focused) {
      return;
    }
    const first = this._focusManager.firstFocusable();
    if (first) {
      this._focusManager.focus(first);
    }
  }

  getCurrentBuffer(): ReadonlyMoonBuffer {
    return this.getReadonlyBuffer(() =>
      api.renderer.getCurrentBuffer(this._ptr)
    );
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

  focus(renderable: Renderable): boolean {
    this.guard();
    return this._focusManager.focus(renderable);
  }

  blur(): void {
    this.guard();
    this._focusManager.blur();
  }

  focusNext(): Renderable | null {
    this.guard();
    return this._focusManager.focusNext();
  }

  focusPrevious(): Renderable | null {
    this.guard();
    return this._focusManager.focusPrevious();
  }

  get focused(): Renderable | null {
    this.guard();
    this.ensureAutoFocus();
    return this._focusManager.focused;
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
    this.dispatchKeyEvent(new KeyEvent(key, { ctrl, shift, alt }));
  }

  get useMouse(): boolean {
    return this._useMouse;
  }

  set useMouse(value: boolean) {
    this.guard();
    if (value === this._useMouse) {
      return;
    }
    if (value) {
      this.enableMouse(this._enableMouseMovement);
    } else {
      this.disableMouse();
    }
    this._useMouse = value;
  }

  get enableMouseMovement(): boolean {
    return this._enableMouseMovement;
  }

  set enableMouseMovement(value: boolean) {
    this.guard();
    this._enableMouseMovement = value;
    if (this._useMouse) {
      this.enableMouse(value);
    }
  }

  get autoFocus(): boolean {
    return this._autoFocus;
  }

  set autoFocus(value: boolean) {
    this._autoFocus = value;
  }

  enableMouse(enableMovement?: boolean): void {
    this.guard();
    this._useMouse = true;
    this._enableMouseMovement = enableMovement ?? true;
    if (!this._mouseCallback) {
      this._mouseCallback = api.events.createMouseCallback((raw) => {
        queueMicrotask(() => {
          const kind = parseMouseKind(raw.kind);
          if (!kind) {
            return;
          }
          this.dispatchMouseEvent(this.createMouseEvent(raw, kind));
        });
      });
      api.events.setMouseCallback(this._ptr, this._mouseCallback.ptr);
    }
    api.renderer.enableMouse(this._ptr, this._enableMouseMovement);
  }

  disableMouse(): void {
    this.guard();
    this._useMouse = false;
    api.renderer.disableMouse(this._ptr);
  }

  setMousePointerStyle(style: MousePointerStyle): void {
    this.guard();
    api.renderer.setMousePointerStyle(
      this._ptr,
      mousePointerStyleToNative(style)
    );
  }

  getMousePointerStyle(): MousePointerStyle {
    this.guard();
    const ptr = api.renderer.getMousePointerStyle(this._ptr);
    return mousePointerStyleFromNative(Number(ptr));
  }

  addToHitGrid(
    x: number,
    y: number,
    width: number,
    height: number,
    id: number
  ): void {
    this.guard();
    api.renderer.hitGridAdd(this._ptr, x, y, width, height, id);
  }

  addHitTarget(
    renderable: Renderable,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.guard();
    let id = this._hitIds.get(renderable);
    if (id === undefined) {
      id = this._nextHitId;
      this._nextHitId++;
      this._hitIds.set(renderable, id);
    }
    this._hitTargets.set(id, renderable);
    this.addToHitGrid(x, y, width, height, id);
  }

  checkHit(x: number, y: number): number {
    this.guard();
    return api.renderer.hitGridCheckHit(this._ptr, x, y);
  }

  pushHitGridScissorRect(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.guard();
    api.renderer.hitGridPushScissorRect(this._ptr, x, y, width, height);
  }

  popHitGridScissorRect(): void {
    this.guard();
    api.renderer.hitGridPopScissorRect(this._ptr);
  }

  clearHitGridScissorRects(): void {
    this.guard();
    api.renderer.hitGridClearScissorRects(this._ptr);
  }

  isHitGridDirty(): boolean {
    this.guard();
    return api.renderer.hitGridIsDirty(this._ptr);
  }

  injectMouseEvent(
    kind: string,
    button: number,
    x: number,
    y: number,
    ctrl: boolean,
    shift: boolean,
    alt: boolean,
    scrollDir: number
  ): void {
    this.guard();
    api.renderer.injectMouseEvent(
      this._ptr,
      kind,
      button,
      x,
      y,
      ctrl,
      shift,
      alt,
      scrollDir
    );
  }
}
