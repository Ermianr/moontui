import type { DrawBoxOptions, MoonBuffer } from "./buffer";
import type { RGBAInput } from "./rgba";
import { terminalDefault } from "./rgba";

export type LayoutDirection = "column" | "row";
export type LayoutPosition = "absolute" | "relative";
export type LayoutSize = `${number}%` | number;

export interface LayoutEdges {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
}

export interface LayoutRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface LayoutProps {
  bottom?: number;
  flexDirection?: LayoutDirection;
  flexGrow?: number;
  gap?: number;
  height?: LayoutSize;
  left?: number;
  margin?: LayoutEdges | number;
  padding?: LayoutEdges | number;
  position?: LayoutPosition;
  right?: number;
  top?: number;
  width?: LayoutSize;
}

export interface RenderableOptions extends LayoutProps {
  x?: number;
  y?: number;
}

export class Renderable {
  private _layoutProps: LayoutProps = {};
  private _usesLayoutProps = false;
  private _x = 0;
  private _y = 0;
  // biome-ignore lint/style/useReadonlyClassProperties: parent changes when the tree is mutated.
  private _parent: Renderable | null = null;
  private _computedLayout: LayoutRect = { x: 0, y: 0, width: 0, height: 0 };
  private _hasComputedLayout = false;
  private _layoutDirty = true;
  private readonly _children: Renderable[] = [];

  constructor(options: RenderableOptions = {}) {
    this._x = options.x ?? 0;
    this._y = options.y ?? 0;
    this._layoutProps = {
      bottom: options.bottom,
      flexDirection: options.flexDirection,
      flexGrow: options.flexGrow,
      gap: options.gap,
      height: options.height ?? 0,
      left: options.left,
      margin: options.margin,
      padding: options.padding,
      position: options.position,
      right: options.right,
      top: options.top,
      width: options.width ?? 0,
    };
    this._usesLayoutProps = hasExplicitLayoutProps(options);
    this._computedLayout = {
      x: this._x,
      y: this._y,
      width: numericSize(this._layoutProps.width),
      height: numericSize(this._layoutProps.height),
    };
  }

  get computedLayout(): LayoutRect {
    return { ...this._computedLayout };
  }

  get height(): LayoutSize {
    return this._layoutProps.height ?? 0;
  }

  set height(value: LayoutSize) {
    this.setLayoutProps({ height: value });
  }

  get layoutDirty(): boolean {
    return this._layoutDirty;
  }

  get layoutProps(): Readonly<LayoutProps> {
    return this._layoutProps;
  }

  get layoutComputed(): boolean {
    return this._hasComputedLayout;
  }

  get usesLayoutProps(): boolean {
    return this._usesLayoutProps;
  }

  get width(): LayoutSize {
    return this._layoutProps.width ?? 0;
  }

  set width(value: LayoutSize) {
    this.setLayoutProps({ width: value });
  }

  get x(): number {
    return this._x;
  }

  set x(value: number) {
    if (value === this._x) {
      return;
    }
    this._x = value;
    this.markLayoutDirty();
  }

  get y(): number {
    return this._y;
  }

  set y(value: number) {
    if (value === this._y) {
      return;
    }
    this._y = value;
    this.markLayoutDirty();
  }

  get children(): readonly Renderable[] {
    return this._children;
  }

  add(child: Renderable): this {
    child._parent = this;
    this._children.push(child);
    this.markLayoutDirty();
    return this;
  }

  remove(child: Renderable): this {
    const index = this._children.indexOf(child);
    if (index !== -1) {
      child._parent = null;
      this._children.splice(index, 1);
      this.markLayoutDirty();
    }
    return this;
  }

  computeLayout(
    width = numericSize(this.width),
    height = numericSize(this.height)
  ): void {
    layoutTree(this, { x: 0, y: 0, width, height }, false);
    this._layoutDirty = false;
  }

  markLayoutDirty(): void {
    if (this._layoutDirty && this._parent) {
      this._parent.markLayoutDirty();
      return;
    }
    this._layoutDirty = true;
    this._hasComputedLayout = false;
    this._parent?.markLayoutDirty();
  }

  setLayoutProps(props: LayoutProps): void {
    this._layoutProps = { ...this._layoutProps, ...props };
    this._usesLayoutProps =
      this._usesLayoutProps || hasExplicitLayoutProps(props);
    this.markLayoutDirty();
  }

  /** @internal */
  _setComputedLayout(rect: LayoutRect): void {
    this._computedLayout = rect;
    this._hasComputedLayout = true;
    this._layoutDirty = false;
  }

  /** @internal */
  _clearComputedLayout(): void {
    this._hasComputedLayout = false;
    for (const child of this._children) {
      child._clearComputedLayout();
    }
  }

  render(buffer: MoonBuffer, offsetX = 0, offsetY = 0): void {
    const x = this._hasComputedLayout
      ? this._computedLayout.x
      : offsetX + this.x;
    const y = this._hasComputedLayout
      ? this._computedLayout.y
      : offsetY + this.y;
    const childOffsetX = this._hasComputedLayout ? 0 : x;
    const childOffsetY = this._hasComputedLayout ? 0 : y;
    this.renderSelf(buffer, x, y);
    this.renderChildren(buffer, childOffsetX, childOffsetY);
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

function hasExplicitLayoutProps(props: Partial<LayoutProps>): boolean {
  return (
    props.flexDirection !== undefined ||
    props.flexGrow !== undefined ||
    props.gap !== undefined ||
    props.padding !== undefined ||
    props.margin !== undefined ||
    props.position !== undefined ||
    props.left !== undefined ||
    props.right !== undefined ||
    props.top !== undefined ||
    props.bottom !== undefined ||
    typeof props.width === "string" ||
    typeof props.height === "string"
  );
}

function numericSize(size: LayoutSize | undefined): number {
  return typeof size === "number" ? size : 0;
}

function resolveSize(size: LayoutSize | undefined, parentSize: number): number {
  if (typeof size === "number") {
    return Math.max(0, Math.floor(size));
  }
  if (typeof size === "string" && size.endsWith("%")) {
    const percentage = Number(size.slice(0, -1));
    if (Number.isFinite(percentage)) {
      return Math.max(0, Math.floor((parentSize * percentage) / 100));
    }
  }
  return 0;
}

function normalizeEdges(
  edges: LayoutEdges | number | undefined
): Required<LayoutEdges> {
  if (typeof edges === "number") {
    return { top: edges, right: edges, bottom: edges, left: edges };
  }
  return {
    top: edges?.top ?? 0,
    right: edges?.right ?? 0,
    bottom: edges?.bottom ?? 0,
    left: edges?.left ?? 0,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this keeps the small private layout pass local to renderables.
function layoutTree(
  node: Renderable,
  rect: LayoutRect,
  forceLayout: boolean
): void {
  node._setComputedLayout(rect);
  const explicitChildren = node.children.filter(
    (child) => child.usesLayoutProps
  );
  const shouldLayoutChildren =
    forceLayout || node.usesLayoutProps || explicitChildren.length > 0;
  if (!shouldLayoutChildren) {
    for (const child of node.children) {
      child._clearComputedLayout();
    }
    return;
  }

  const layoutChildren =
    forceLayout || node.usesLayoutProps ? [...node.children] : explicitChildren;
  const padding = normalizeEdges(node.layoutProps.padding);
  const content = {
    x: rect.x + padding.left,
    y: rect.y + padding.top,
    width: Math.max(0, rect.width - padding.left - padding.right),
    height: Math.max(0, rect.height - padding.top - padding.bottom),
  };
  const direction = node.layoutProps.flexDirection ?? "column";
  const gap = node.layoutProps.gap ?? 0;
  const flowChildren = layoutChildren.filter(
    (child) => child.layoutProps.position !== "absolute"
  );
  const absoluteChildren = layoutChildren.filter(
    (child) => child.layoutProps.position === "absolute"
  );
  const mainSize = direction === "row" ? content.width : content.height;
  const crossSize = direction === "row" ? content.height : content.width;
  const gapTotal = Math.max(0, flowChildren.length - 1) * gap;
  const fixedTotal = flowChildren.reduce((total, child) => {
    const margin = normalizeEdges(child.layoutProps.margin);
    const mainMargin =
      direction === "row"
        ? margin.left + margin.right
        : margin.top + margin.bottom;
    const size =
      direction === "row"
        ? resolveSize(child.layoutProps.width, content.width)
        : resolveSize(child.layoutProps.height, content.height);
    return child.layoutProps.flexGrow
      ? total + mainMargin
      : total + size + mainMargin;
  }, 0);
  const flexTotal = flowChildren.reduce(
    (total, child) => total + (child.layoutProps.flexGrow ?? 0),
    0
  );
  const remaining = Math.max(0, mainSize - fixedTotal - gapTotal);
  let cursor = direction === "row" ? content.x : content.y;
  let flexIndex = 0;
  const flexChildren = flowChildren.filter(
    (child) => child.layoutProps.flexGrow
  );

  for (const child of flowChildren) {
    const margin = normalizeEdges(child.layoutProps.margin);
    const flexGrow = child.layoutProps.flexGrow ?? 0;
    const mainMargin =
      direction === "row"
        ? margin.left + margin.right
        : margin.top + margin.bottom;
    const crossMargin =
      direction === "row"
        ? margin.top + margin.bottom
        : margin.left + margin.right;
    const flexBase =
      flexTotal > 0 ? Math.floor((remaining * flexGrow) / flexTotal) : 0;
    const remainder =
      flexGrow > 0 && flexIndex < remaining % Math.max(1, flexChildren.length)
        ? 1
        : 0;
    const fixedMain =
      direction === "row"
        ? resolveSize(child.layoutProps.width, content.width)
        : resolveSize(child.layoutProps.height, content.height);
    const main = flexGrow ? flexBase + remainder : fixedMain;
    const cross =
      direction === "row"
        ? resolveSize(child.layoutProps.height, content.height) ||
          crossSize - crossMargin
        : resolveSize(child.layoutProps.width, content.width) ||
          crossSize - crossMargin;
    const childRect =
      direction === "row"
        ? {
            x: cursor + margin.left,
            y: content.y + margin.top,
            width: Math.max(0, main),
            height: Math.max(0, cross),
          }
        : {
            x: content.x + margin.left,
            y: cursor + margin.top,
            width: Math.max(0, cross),
            height: Math.max(0, main),
          };
    layoutTree(child, childRect, true);
    cursor += main + mainMargin + gap;
    if (flexGrow > 0) {
      flexIndex++;
    }
  }

  for (const child of absoluteChildren) {
    const props = child.layoutProps;
    const margin = normalizeEdges(props.margin);
    const width = resolveSize(props.width, content.width);
    const height = resolveSize(props.height, content.height);
    const x =
      props.left === undefined
        ? content.x + content.width - width - (props.right ?? 0) - margin.right
        : content.x + props.left + margin.left;
    const y =
      props.top === undefined
        ? content.y +
          content.height -
          height -
          (props.bottom ?? 0) -
          margin.bottom
        : content.y + props.top + margin.top;
    layoutTree(child, { x, y, width, height }, true);
  }

  for (const child of node.children) {
    if (!layoutChildren.includes(child)) {
      child._clearComputedLayout();
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
      ...options,
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
    const layout = this.computedLayout;
    buffer.drawBox({
      x,
      y,
      width: this.layoutComputed ? layout.width : numericSize(this.width),
      height: this.layoutComputed ? layout.height : numericSize(this.height),
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
