import type { DrawBoxOptions, MoonBuffer } from "./buffer";
import type { RGBAInput } from "./rgba";
import { terminalDefault } from "./rgba";

export interface RenderableOptions {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
}

export class Renderable {
  height: number;
  width: number;
  x: number;
  y: number;
  private readonly _children: Renderable[] = [];

  constructor(options: RenderableOptions = {}) {
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 0;
    this.height = options.height ?? 0;
  }

  get children(): readonly Renderable[] {
    return this._children;
  }

  add(child: Renderable): this {
    this._children.push(child);
    return this;
  }

  remove(child: Renderable): this {
    const index = this._children.indexOf(child);
    if (index !== -1) {
      this._children.splice(index, 1);
    }
    return this;
  }

  render(buffer: MoonBuffer, offsetX = 0, offsetY = 0): void {
    const x = offsetX + this.x;
    const y = offsetY + this.y;
    this.renderSelf(buffer, x, y);
    this.renderChildren(buffer, x, y);
  }

  protected renderSelf(_buffer: MoonBuffer, _x: number, _y: number): void {
    return;
  }

  protected renderChildren(buffer: MoonBuffer, x: number, y: number): void {
    for (const child of this._children) {
      child.render(buffer, x, y);
    }
  }
}

export class RootRenderable extends Renderable {
  constructor(width: number, height: number) {
    super({ width, height });
  }
}

export interface TextRenderableOptions extends RenderableOptions {
  attributes?: number;
  backgroundColor?: RGBAInput;
  content: string;
  foregroundColor?: RGBAInput;
}

export class TextRenderable extends Renderable {
  attributes?: number;
  backgroundColor?: RGBAInput;
  content: string;
  foregroundColor: RGBAInput;

  constructor(options: TextRenderableOptions) {
    super({
      x: options.x,
      y: options.y,
      width: options.width ?? options.content.length,
      height: options.height ?? 1,
    });
    this.content = options.content;
    this.foregroundColor = options.foregroundColor ?? terminalDefault();
    this.backgroundColor = options.backgroundColor;
    this.attributes = options.attributes;
  }

  protected override renderSelf(
    buffer: MoonBuffer,
    x: number,
    y: number
  ): void {
    buffer.drawText(
      this.content,
      x,
      y,
      this.foregroundColor,
      this.backgroundColor,
      this.attributes
    );
  }
}

export interface BoxRenderableOptions extends RenderableOptions {
  backgroundColor?: RGBAInput;
  border?: DrawBoxOptions["border"];
  borderColor?: RGBAInput;
  title?: string;
}

export class BoxRenderable extends Renderable {
  backgroundColor: RGBAInput;
  border?: DrawBoxOptions["border"];
  borderColor: RGBAInput;
  title?: string;

  constructor(options: BoxRenderableOptions = {}) {
    super(options);
    this.border = options.border;
    this.borderColor = options.borderColor ?? terminalDefault();
    this.backgroundColor = options.backgroundColor ?? terminalDefault();
    this.title = options.title;
  }

  protected override renderSelf(
    buffer: MoonBuffer,
    x: number,
    y: number
  ): void {
    buffer.drawBox({
      x,
      y,
      width: this.width,
      height: this.height,
      border: this.border,
      borderColor: this.borderColor,
      backgroundColor: this.backgroundColor,
      title: this.title,
    });
  }
}

export function Text(options: TextRenderableOptions): TextRenderable {
  return new TextRenderable(options);
}

export function Box(
  options: BoxRenderableOptions,
  ...children: Renderable[]
): BoxRenderable {
  const box = new BoxRenderable(options);
  for (const child of children) {
    box.add(child);
  }
  return box;
}
