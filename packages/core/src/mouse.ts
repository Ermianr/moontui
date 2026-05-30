export type MouseButton = "left" | "middle" | "right";

export type MousePointerStyle =
  | "default"
  | "pointer"
  | "text"
  | "crosshair"
  | "move"
  | "not-allowed";

export type ScrollDirection = "up" | "down" | "left" | "right";

export interface ScrollInfo {
  direction: ScrollDirection;
}

export interface RawMouseEvent {
  alt: boolean;
  button: number;
  ctrl: boolean;
  kind: "down" | "up" | "drag" | "move" | "scroll";
  scrollDir: number;
  shift: boolean;
  x: number;
  y: number;
}

export class MouseEvent {
  readonly type = "mouse" as const;
  readonly kind:
    | "down"
    | "up"
    | "drag"
    | "drag-end"
    | "drop"
    | "move"
    | "over"
    | "out"
    | "scroll";
  readonly button: MouseButton;
  readonly x: number;
  readonly y: number;
  readonly modifiers: { ctrl: boolean; shift: boolean; alt: boolean };
  readonly scroll?: ScrollInfo;
  readonly target: unknown | null;
  readonly source?: unknown;
  readonly isDragging?: boolean;
  private _defaultPrevented = false;
  private _propagationStopped = false;

  constructor(options: {
    kind:
      | "down"
      | "up"
      | "drag"
      | "drag-end"
      | "drop"
      | "move"
      | "over"
      | "out"
      | "scroll";
    button: MouseButton;
    x: number;
    y: number;
    modifiers: { ctrl: boolean; shift: boolean; alt: boolean };
    scroll?: ScrollInfo;
    target?: unknown | null;
    source?: unknown;
    isDragging?: boolean;
  }) {
    this.kind = options.kind;
    this.button = options.button;
    this.x = options.x;
    this.y = options.y;
    this.modifiers = options.modifiers;
    this.scroll = options.scroll;
    this.target = options.target ?? null;
    this.source = options.source;
    this.isDragging = options.isDragging;
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

export function buttonFromNative(button: number): MouseButton {
  switch (button) {
    case 0:
      return "left";
    case 1:
      return "middle";
    case 2:
      return "right";
    default:
      return "left";
  }
}

export function buttonToNative(button: MouseButton): number {
  switch (button) {
    case "middle":
      return 1;
    case "right":
      return 2;
    default:
      return 0;
  }
}

export function scrollDirectionFromNative(dir: number): ScrollDirection {
  switch (dir) {
    case 1:
      return "up";
    case 2:
      return "down";
    case 3:
      return "left";
    case 4:
      return "right";
    default:
      return "up";
  }
}

export function scrollDirectionToNative(direction: ScrollDirection): number {
  switch (direction) {
    case "up":
      return 1;
    case "down":
      return 2;
    case "left":
      return 3;
    case "right":
      return 4;
    default:
      return 1;
  }
}

const MOUSE_POINTER_STYLE_NATIVE: Record<MousePointerStyle, number> = {
  default: 0,
  pointer: 1,
  text: 2,
  crosshair: 3,
  move: 4,
  "not-allowed": 5,
};

export function mousePointerStyleToNative(style: MousePointerStyle): number {
  return MOUSE_POINTER_STYLE_NATIVE[style];
}

const MOUSE_POINTER_STYLE_REVERSE: Record<number, MousePointerStyle> = {
  0: "default",
  1: "pointer",
  2: "text",
  3: "crosshair",
  4: "move",
  5: "not-allowed",
};

export function mousePointerStyleFromNative(native: number): MousePointerStyle {
  return MOUSE_POINTER_STYLE_REVERSE[native] ?? "default";
}
