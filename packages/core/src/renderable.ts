import type { DrawBoxOptions, MoonBuffer } from "./buffer";
import { api } from "./ffi";
import type { MouseEvent } from "./mouse";
import type { KeyEvent } from "./renderer";
import type { RGBAInput } from "./rgba";
import { terminalDefault } from "./rgba";

export interface RenderContext {
  addHitTarget(
    renderable: Renderable,
    x: number,
    y: number,
    width: number,
    height: number
  ): void;
  setCursorPosition(x: number, y: number, visible: boolean): void;
}

export type LayoutDirection = "column" | "row";
export type LayoutAlign = "center" | "end" | "start" | "stretch";
export type LayoutDisplay = "flex" | "none";
export type LayoutJustify = "center" | "end" | "space-between" | "start";
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
  alignItems?: LayoutAlign;
  alignSelf?: LayoutAlign;
  bottom?: number;
  display?: LayoutDisplay;
  flexBasis?: LayoutSize;
  flexDirection?: LayoutDirection;
  flexGrow?: number;
  flexShrink?: number;
  gap?: number;
  height?: LayoutSize;
  justifyContent?: LayoutJustify;
  left?: number;
  margin?: LayoutEdges | number;
  maxHeight?: number;
  maxWidth?: number;
  minHeight?: number;
  minWidth?: number;
  padding?: LayoutEdges | number;
  position?: LayoutPosition;
  right?: number;
  top?: number;
  width?: LayoutSize;
}

export interface RenderableOptions extends LayoutProps {
  disabled?: boolean;
  focusable?: boolean;
  onBlur?: (renderable: Renderable) => void;
  onFocus?: (renderable: Renderable) => void;
  onKey?: (event: KeyEvent, renderable: Renderable) => void;
  onMouse?: (event: MouseEvent, renderable: Renderable) => void;
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
  private _disabled = false;
  private _focusable = false;
  private _focused = false;
  private readonly _onBlur?: (renderable: Renderable) => void;
  private readonly _onFocus?: (renderable: Renderable) => void;
  private readonly _onKey?: (event: KeyEvent, renderable: Renderable) => void;
  private readonly _onMouse?: (
    event: MouseEvent,
    renderable: Renderable
  ) => void;
  private readonly _children: Renderable[] = [];

  constructor(options: RenderableOptions = {}) {
    this._x = options.x ?? 0;
    this._y = options.y ?? 0;
    this._disabled = options.disabled ?? false;
    this._focusable = options.focusable ?? false;
    this._onBlur = options.onBlur;
    this._onFocus = options.onFocus;
    this._onKey = options.onKey;
    this._onMouse = options.onMouse;
    this._layoutProps = {
      alignItems: options.alignItems,
      alignSelf: options.alignSelf,
      bottom: options.bottom,
      display: options.display,
      flexBasis: options.flexBasis,
      flexDirection: options.flexDirection,
      flexGrow: options.flexGrow,
      flexShrink: options.flexShrink,
      gap: options.gap,
      height: options.height,
      left: options.left,
      margin: options.margin,
      maxHeight: options.maxHeight,
      maxWidth: options.maxWidth,
      minHeight: options.minHeight,
      minWidth: options.minWidth,
      padding: options.padding,
      position: options.position,
      justifyContent: options.justifyContent,
      right: options.right,
      top: options.top,
      width: options.width,
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

  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(value: boolean) {
    this._disabled = value;
    if (value) {
      this._clearFocusedDeep();
    }
  }

  get focusable(): boolean {
    return this._focusable;
  }

  set focusable(value: boolean) {
    this._focusable = value;
    if (!value) {
      this._clearFocusedDeep();
    }
  }

  get focused(): boolean {
    return this._focused;
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

  get parent(): Renderable | null {
    return this._parent;
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
      child._clearFocusedDeep();
      child._parent = null;
      this._children.splice(index, 1);
      child._clearComputedLayout();
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

  /** @internal */
  _setLayoutDirty(value: boolean): void {
    this._layoutDirty = value;
  }

  /** @internal */
  _focus(): void {
    if (this._focused) {
      return;
    }
    this._focused = true;
    this._onFocus?.(this);
  }

  /** @internal */
  _blur(): void {
    if (!this._focused) {
      return;
    }
    this._focused = false;
    this._onBlur?.(this);
  }

  /** @internal */
  _handleKey(event: KeyEvent): void {
    this._onKey?.(event, this);
  }

  /** @internal */
  _handleMouse(event: MouseEvent): void {
    this._onMouse?.(event, this);
  }

  /** @internal */
  _clearFocusedDeep(): void {
    this._blur();
    for (const child of this._children) {
      child._clearFocusedDeep();
    }
  }

  render(
    buffer: MoonBuffer,
    offsetX = 0,
    offsetY = 0,
    context?: RenderContext
  ): void {
    if (this._layoutProps.display === "none") {
      return;
    }
    const x = this._hasComputedLayout
      ? this._computedLayout.x
      : offsetX + this.x;
    const y = this._hasComputedLayout
      ? this._computedLayout.y
      : offsetY + this.y;
    const childOffsetX = this._hasComputedLayout ? 0 : x;
    const childOffsetY = this._hasComputedLayout ? 0 : y;
    this.renderSelf(buffer, x, y, context);
    const hitRect = this.hitRect();
    if (hitRect.width > 0 && hitRect.height > 0) {
      context?.addHitTarget(this, x, y, hitRect.width, hitRect.height);
    }
    this.renderChildren(buffer, childOffsetX, childOffsetY, context);
  }

  /** @internal */
  _measureIntrinsicSize(): LayoutRect {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  protected renderSelf(
    _buffer: MoonBuffer,
    _x: number,
    _y: number,
    _context?: RenderContext
  ): void {
    return;
  }

  protected renderChildren(
    buffer: MoonBuffer,
    x: number,
    y: number,
    context?: RenderContext
  ): void {
    for (const child of this._children) {
      child.render(buffer, x, y, context);
    }
  }

  private hitRect(): { width: number; height: number } {
    if (this._hasComputedLayout) {
      return {
        width: this._computedLayout.width,
        height: this._computedLayout.height,
      };
    }
    const intrinsic = this._measureIntrinsicSize();
    return {
      width: numericSize(this.width) || intrinsic.width,
      height: numericSize(this.height) || intrinsic.height,
    };
  }
}

function hasExplicitLayoutProps(props: Partial<LayoutProps>): boolean {
  return (
    props.alignItems !== undefined ||
    props.alignSelf !== undefined ||
    props.display !== undefined ||
    props.flexBasis !== undefined ||
    props.flexDirection !== undefined ||
    props.flexGrow !== undefined ||
    props.flexShrink !== undefined ||
    props.gap !== undefined ||
    props.minWidth !== undefined ||
    props.minHeight !== undefined ||
    props.maxWidth !== undefined ||
    props.maxHeight !== undefined ||
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

function clampSize(size: number, min?: number, max?: number): number {
  const minClamped = min === undefined ? size : Math.max(size, min);
  return max === undefined ? minClamped : Math.min(minClamped, max);
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

function flattenLayoutTree(
  root: RootRenderable
): { node: Renderable; parentIndex: number }[] {
  const items: { node: Renderable; parentIndex: number }[] = [];
  const visit = (node: Renderable, parentIndex: number) => {
    const index = items.length;
    items.push({ node, parentIndex });
    for (const child of node.children) {
      visit(child, index);
    }
  };
  visit(root, -1);
  return items;
}

function writeLayoutStyle(
  styles: Float32Array,
  nodeIndex: number,
  node: Renderable,
  isRoot: boolean,
  rootWidth: number,
  rootHeight: number
): void {
  const offset = nodeIndex * STYLE_STRIDE;
  styles.fill(NAN, offset, offset + STYLE_STRIDE);
  const props = node.layoutProps;
  styles[offset] = isRoot ? rootWidth : scalarSize(props.width);
  styles[offset + 1] = isRoot ? rootHeight : scalarSize(props.height);
  styles[offset + 2] = scalarSize(props.flexBasis);
  styles[offset + 3] = props.minWidth ?? NAN;
  styles[offset + 4] = props.minHeight ?? NAN;
  styles[offset + 5] = props.maxWidth ?? NAN;
  styles[offset + 6] = props.maxHeight ?? NAN;
  styles[offset + 7] = props.flexGrow ?? 0;
  styles[offset + 8] = props.flexShrink ?? 1;
  styles[offset + 9] = props.flexDirection === "row" ? 1 : 0;
  styles[offset + 10] = alignToNative(props.alignItems);
  styles[offset + 11] = alignToNative(props.alignSelf);
  styles[offset + 12] = justifyToNative(props.justifyContent);
  styles[offset + 13] = props.display === "none" ? 1 : 0;
  styles[offset + 14] = props.position === "absolute" ? 1 : 0;
  styles[offset + 15] = props.gap ?? 0;
  writeEdges(styles, offset + 16, props.padding);
  writeEdges(styles, offset + 20, props.margin);
  styles[offset + 24] = props.left ?? NAN;
  styles[offset + 25] = props.right ?? NAN;
  styles[offset + 26] = props.top ?? NAN;
  styles[offset + 27] = props.bottom ?? NAN;
  styles[offset + 28] = node.usesLayoutProps ? 1 : 0;
  styles[offset + 29] = 0;
}

function scalarSize(size: LayoutSize | undefined): number {
  if (typeof size === "number") {
    return size;
  }
  if (typeof size === "string" && size.endsWith("%")) {
    const percentage = Number(size.slice(0, -1));
    if (Number.isFinite(percentage)) {
      return -percentage;
    }
  }
  return NAN;
}

function writeEdges(
  styles: Float32Array,
  offset: number,
  edges: LayoutEdges | number | undefined
): void {
  const normalized = normalizeEdges(edges);
  styles[offset] = normalized.top;
  styles[offset + 1] = normalized.right;
  styles[offset + 2] = normalized.bottom;
  styles[offset + 3] = normalized.left;
}

function alignToNative(align: LayoutAlign | undefined): number {
  if (align === "center") {
    return 1;
  }
  if (align === "end") {
    return 2;
  }
  if (align === "start") {
    return 3;
  }
  if (align === "stretch") {
    return 0;
  }
  return -1;
}

function justifyToNative(justify: LayoutJustify | undefined): number {
  if (justify === "center") {
    return 1;
  }
  if (justify === "end") {
    return 2;
  }
  if (justify === "space-between") {
    return 3;
  }
  return 0;
}

export interface LayoutEngine {
  compute(root: RootRenderable, width: number, height: number): void;
}

export interface LayoutComputeTimings {
  ffiInputMs: number;
  ffiOutputMs: number;
  flatteningMs: number;
  nativeComputeMs: number;
  rectangleApplicationMs: number;
  relationshipConstructionMs: number;
  totalBackendMs: number;
}

export interface LayoutInstrumentationCounters {
  computeCalls: number;
  readbackCount: number;
  rectangleApplications: number;
  relationshipUpdates: number;
  styleUpdates: number;
  touchedNodes: number;
}

export interface InstrumentedLayoutEngine extends LayoutEngine {
  getInstrumentationCounters(): LayoutInstrumentationCounters;
}

export class TypeScriptLayoutEngine implements LayoutEngine {
  private counters: LayoutInstrumentationCounters = emptyLayoutCounters();

  compute(root: RootRenderable, width: number, height: number): void {
    this.counters = {
      computeCalls: this.counters.computeCalls + 1,
      readbackCount: 0,
      rectangleApplications: countLayoutNodes(root),
      relationshipUpdates: 0,
      styleUpdates: countLayoutNodes(root),
      touchedNodes: countLayoutNodes(root),
    };
    layoutTree(root, { x: 0, y: 0, width, height }, false);
    root._markLayoutClean();
  }

  getInstrumentationCounters(): LayoutInstrumentationCounters {
    return { ...this.counters };
  }
}

const STYLE_STRIDE = 30;
const MEASURE_STRIDE = 2;
const RECT_STRIDE = 4;
const NAN = Number.NaN;

export function computeNativeCustomLayout(
  parentIndices: Int32Array,
  styles: Float32Array,
  measurements: Float32Array,
  outRects: Float32Array
): number {
  return api.renderer.computeNativeCustomLayout(
    parentIndices,
    styles,
    measurements,
    outRects
  );
}

type NativeLayoutCompute = (
  parentIndices: Int32Array,
  styles: Float32Array,
  measurements: Float32Array,
  outRects: Float32Array
) => number;

abstract class BatchNativeLayoutEngine implements LayoutEngine {
  protected abstract readonly failureLabel: string;
  protected abstract readonly computeNativeLayout: NativeLayoutCompute;
  private counters: LayoutInstrumentationCounters = emptyLayoutCounters();

  compute(root: RootRenderable, width: number, height: number): void {
    this.computeWithTimings(root, width, height);
  }

  computeWithTimings(
    root: RootRenderable,
    width: number,
    height: number
  ): LayoutComputeTimings {
    const totalStart = performance.now();
    const flatteningStart = performance.now();
    const nodes = flattenLayoutTree(root);
    const flatteningMs = performance.now() - flatteningStart;
    const relationshipStart = performance.now();
    const parentIndices = new Int32Array(nodes.length);
    const relationshipConstructionMs = performance.now() - relationshipStart;
    const ffiInputStart = performance.now();
    const styles = new Float32Array(nodes.length * STYLE_STRIDE);
    const measurements = new Float32Array(nodes.length * MEASURE_STRIDE);
    const outRects = new Float32Array(nodes.length * RECT_STRIDE);

    for (const [index, item] of nodes.entries()) {
      parentIndices[index] = item.parentIndex;
      writeLayoutStyle(styles, index, item.node, index === 0, width, height);
      const intrinsic = item.node._measureIntrinsicSize();
      measurements[index * MEASURE_STRIDE] = intrinsic.width;
      measurements[index * MEASURE_STRIDE + 1] = intrinsic.height;
    }
    const ffiInputMs = performance.now() - ffiInputStart;

    const nativeComputeStart = performance.now();
    const result = this.computeNativeLayout(
      parentIndices,
      styles,
      measurements,
      outRects
    );
    const nativeComputeMs = performance.now() - nativeComputeStart;
    if (result !== 0) {
      throw new Error(`${this.failureLabel} failed with error code ${result}`);
    }

    const ffiOutputStart = performance.now();
    const ffiOutputMs = performance.now() - ffiOutputStart;
    const rectangleApplicationStart = performance.now();
    let rectangleApplications = 0;
    for (const [index, item] of nodes.entries()) {
      if (item.node.layoutProps.display === "none") {
        item.node._clearComputedLayout();
        continue;
      }
      const rectOffset = index * RECT_STRIDE;
      if (Number.isNaN(outRects[rectOffset] ?? Number.NaN)) {
        item.node._clearComputedLayout();
        continue;
      }
      item.node._setComputedLayout({
        x: outRects[rectOffset] ?? 0,
        y: outRects[rectOffset + 1] ?? 0,
        width: outRects[rectOffset + 2] ?? 0,
        height: outRects[rectOffset + 3] ?? 0,
      });
      rectangleApplications++;
    }
    root._markLayoutClean();
    const rectangleApplicationMs =
      performance.now() - rectangleApplicationStart;
    this.counters = {
      computeCalls: this.counters.computeCalls + 1,
      readbackCount: nodes.length,
      rectangleApplications,
      relationshipUpdates: nodes.length,
      styleUpdates: nodes.length,
      touchedNodes: nodes.length,
    };
    return {
      ffiInputMs,
      ffiOutputMs,
      flatteningMs,
      nativeComputeMs,
      rectangleApplicationMs,
      relationshipConstructionMs,
      totalBackendMs: performance.now() - totalStart,
    };
  }

  getInstrumentationCounters(): LayoutInstrumentationCounters {
    return { ...this.counters };
  }
}

export class NativeCustomLayoutEngine extends BatchNativeLayoutEngine {
  protected readonly computeNativeLayout = computeNativeCustomLayout;
  protected readonly failureLabel = "Native custom layout";
}

export const nativeCustomLayoutEngine = new NativeCustomLayoutEngine();
export const defaultLayoutEngine = nativeCustomLayoutEngine;

export function emptyLayoutCounters(): LayoutInstrumentationCounters {
  return {
    computeCalls: 0,
    readbackCount: 0,
    rectangleApplications: 0,
    relationshipUpdates: 0,
    styleUpdates: 0,
    touchedNodes: 0,
  };
}

function countLayoutNodes(root: Renderable): number {
  let count = 0;
  const visit = (node: Renderable): void => {
    count++;
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return count;
}

// Unsupported layout domains are intentionally absent from LayoutProps:
// grid, transforms, wrapping, z-index layout semantics, and percentage margins.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this small private pass defines the current TypeScript backend.
export function layoutTree(
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

  const layoutChildren = (
    forceLayout || node.usesLayoutProps ? [...node.children] : explicitChildren
  ).filter((child) => child.layoutProps.display !== "none");
  const padding = normalizeEdges(node.layoutProps.padding);
  const content = {
    x: rect.x + padding.left,
    y: rect.y + padding.top,
    width: Math.max(0, rect.width - padding.left - padding.right),
    height: Math.max(0, rect.height - padding.top - padding.bottom),
  };
  const direction = node.layoutProps.flexDirection ?? "column";
  const gap = node.layoutProps.gap ?? 0;
  const justifyContent = node.layoutProps.justifyContent ?? "start";
  const flowChildren = layoutChildren.filter(
    (child) => child.layoutProps.position !== "absolute"
  );
  const absoluteChildren = layoutChildren.filter(
    (child) => child.layoutProps.position === "absolute"
  );
  const mainSize = direction === "row" ? content.width : content.height;
  const crossSize = direction === "row" ? content.height : content.width;
  const gapTotal =
    justifyContent === "space-between" && flowChildren.length > 1
      ? 0
      : Math.max(0, flowChildren.length - 1) * gap;
  const baseSizes = flowChildren.map((child) => {
    const intrinsic = child._measureIntrinsicSize();
    const props = child.layoutProps;
    const parentMain = direction === "row" ? content.width : content.height;
    const intrinsicMain =
      direction === "row" ? intrinsic.width : intrinsic.height;
    const explicitMain =
      direction === "row"
        ? resolveSize(props.width, content.width)
        : resolveSize(props.height, content.height);
    const basis = resolveSize(props.flexBasis, parentMain);
    return clampSize(
      basis || explicitMain || intrinsicMain,
      direction === "row" ? props.minWidth : props.minHeight,
      direction === "row" ? props.maxWidth : props.maxHeight
    );
  });
  const fixedTotal = flowChildren.reduce((total, child, index) => {
    const margin = normalizeEdges(child.layoutProps.margin);
    const mainMargin =
      direction === "row"
        ? margin.left + margin.right
        : margin.top + margin.bottom;
    return child.layoutProps.flexGrow
      ? total + mainMargin
      : total + baseSizes[index] + mainMargin;
  }, 0);
  const baseTotal = flowChildren.reduce((total, child, index) => {
    const margin = normalizeEdges(child.layoutProps.margin);
    const mainMargin =
      direction === "row"
        ? margin.left + margin.right
        : margin.top + margin.bottom;
    return total + baseSizes[index] + mainMargin;
  }, 0);
  const flexTotal = flowChildren.reduce(
    (total, child) => total + (child.layoutProps.flexGrow ?? 0),
    0
  );
  const shrinkTotal = flowChildren.reduce(
    (total, child) => total + (child.layoutProps.flexShrink ?? 1),
    0
  );
  const freeSpace = mainSize - baseTotal - gapTotal;
  const growRemaining = Math.max(0, mainSize - fixedTotal - gapTotal);
  const usedSpace =
    freeSpace < 0 ? mainSize : Math.min(mainSize, baseTotal + gapTotal);
  let justifyOffset = 0;
  if (justifyContent === "center") {
    justifyOffset = Math.floor(Math.max(0, mainSize - usedSpace) / 2);
  } else if (justifyContent === "end") {
    justifyOffset = Math.max(0, mainSize - usedSpace);
  }
  const dynamicGap =
    justifyContent === "space-between" && flowChildren.length > 1
      ? Math.floor(
          Math.max(0, mainSize - baseTotal) / (flowChildren.length - 1)
        )
      : gap;
  let gapRemainder =
    justifyContent === "space-between" && flowChildren.length > 1
      ? Math.max(0, mainSize - baseTotal) % (flowChildren.length - 1)
      : 0;
  let cursor = (direction === "row" ? content.x : content.y) + justifyOffset;
  let flexIndex = 0;
  const flexChildren = flowChildren.filter(
    (child) => child.layoutProps.flexGrow
  );

  for (const [index, child] of flowChildren.entries()) {
    const margin = normalizeEdges(child.layoutProps.margin);
    const flexGrow = child.layoutProps.flexGrow ?? 0;
    const flexShrink = child.layoutProps.flexShrink ?? 1;
    const mainMargin =
      direction === "row"
        ? margin.left + margin.right
        : margin.top + margin.bottom;
    const crossMargin =
      direction === "row"
        ? margin.top + margin.bottom
        : margin.left + margin.right;
    const flexBase =
      flexTotal > 0 ? Math.floor((growRemaining * flexGrow) / flexTotal) : 0;
    const remainder =
      flexGrow > 0 &&
      flexIndex < growRemaining % Math.max(1, flexChildren.length)
        ? 1
        : 0;
    const shrink =
      freeSpace < 0 && shrinkTotal > 0
        ? Math.ceil((Math.abs(freeSpace) * flexShrink) / shrinkTotal)
        : 0;
    const main = clampSize(
      flexGrow ? flexBase + remainder : baseSizes[index] - shrink,
      direction === "row"
        ? child.layoutProps.minWidth
        : child.layoutProps.minHeight,
      direction === "row"
        ? child.layoutProps.maxWidth
        : child.layoutProps.maxHeight
    );
    const intrinsic = child._measureIntrinsicSize();
    const explicitCross =
      direction === "row"
        ? resolveSize(child.layoutProps.height, content.height)
        : resolveSize(child.layoutProps.width, content.width);
    const intrinsicCross =
      direction === "row" ? intrinsic.height : intrinsic.width;
    const align =
      child.layoutProps.alignSelf ?? node.layoutProps.alignItems ?? "stretch";
    const cross =
      explicitCross ||
      (align === "stretch"
        ? crossSize - crossMargin
        : intrinsicCross || crossSize - crossMargin);
    let crossOffset = 0;
    if (align === "center") {
      crossOffset = Math.floor(
        Math.max(0, crossSize - cross - crossMargin) / 2
      );
    } else if (align === "end") {
      crossOffset = Math.max(0, crossSize - cross - crossMargin);
    }
    const childRect =
      direction === "row"
        ? {
            x: cursor + margin.left,
            y: content.y + margin.top + crossOffset,
            width: Math.max(0, main),
            height: Math.max(0, cross),
          }
        : {
            x: content.x + margin.left + crossOffset,
            y: cursor + margin.top,
            width: Math.max(0, cross),
            height: Math.max(0, main),
          };
    layoutTree(child, childRect, true);
    const nextGap = dynamicGap + (gapRemainder > 0 ? 1 : 0);
    gapRemainder = Math.max(0, gapRemainder - 1);
    cursor += main + mainMargin + nextGap;
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

  override computeLayout(
    width = numericSize(this.width),
    height = numericSize(this.height)
  ): void {
    defaultLayoutEngine.compute(this, width, height);
  }

  /** @internal */
  _markLayoutClean(): void {
    this._setLayoutDirty(false);
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
  foregroundColor: RGBAInput;
  private _content: string;

  constructor(options: TextRenderableOptions) {
    super({
      ...options,
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height ?? 1,
    });
    this._content = options.content;
    this.foregroundColor = options.foregroundColor ?? terminalDefault();
    this.backgroundColor = options.backgroundColor;
    this.attributes = options.attributes;
  }

  get content(): string {
    return this._content;
  }

  set content(value: string) {
    if (value === this._content) {
      return;
    }
    this._content = value;
    if (this.layoutProps.width === undefined) {
      this.markLayoutDirty();
    }
  }

  override _measureIntrinsicSize(): LayoutRect {
    return { x: 0, y: 0, width: terminalCellWidth(this._content), height: 1 };
  }

  protected override renderSelf(
    buffer: MoonBuffer,
    x: number,
    y: number,
    _context?: RenderContext
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
    y: number,
    _context?: RenderContext
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

export interface InputRenderableOptions extends RenderableOptions {
  attributes?: number;
  backgroundColor?: RGBAInput;
  cursorColor?: RGBAInput;
  cursorIndex?: number;
  focusedBackgroundColor?: RGBAInput;
  foregroundColor?: RGBAInput;
  maxLength?: number;
  onChange?: (value: string) => void;
  onInput?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  placeholderColor?: RGBAInput;
  value?: string;
}

export class InputRenderable extends Renderable {
  attributes?: number;
  backgroundColor?: RGBAInput;
  cursorColor?: RGBAInput;
  focusedBackgroundColor?: RGBAInput;
  foregroundColor: RGBAInput;
  maxLength?: number;
  private _placeholder: string;
  placeholderColor: RGBAInput;
  private _value: string;
  private _cursorIndex: number;
  private _valueAtFocus: string;
  private readonly _onChange?: (value: string) => void;
  private readonly _onInput?: (value: string) => void;
  private readonly _onSubmit?: (value: string) => void;

  constructor(options: InputRenderableOptions = {}) {
    const value = options.value ?? "";
    super({
      ...options,
      focusable: options.focusable ?? true,
      height: options.height ?? 1,
      width: options.width,
    });
    this._value = value;
    this._placeholder = options.placeholder ?? "";
    this.maxLength = options.maxLength;
    this.foregroundColor = options.foregroundColor ?? terminalDefault();
    this.placeholderColor = options.placeholderColor ?? terminalDefault();
    this.backgroundColor = options.backgroundColor;
    this.focusedBackgroundColor = options.focusedBackgroundColor;
    this.cursorColor = options.cursorColor;
    this.attributes = options.attributes;
    this._cursorIndex = clampIndex(options.cursorIndex ?? value.length, value);
    this._valueAtFocus = value;
    this._onChange = options.onChange;
    this._onInput = options.onInput;
    this._onSubmit = options.onSubmit;
  }

  get placeholder(): string {
    return this._placeholder;
  }

  set placeholder(value: string) {
    if (value === this._placeholder) {
      return;
    }
    this._placeholder = value;
    if (this.layoutProps.width === undefined) {
      this.markLayoutDirty();
    }
  }

  get value(): string {
    return this._value;
  }

  set value(value: string) {
    if (value === this._value) {
      return;
    }
    this._value = value;
    if (this.layoutProps.width === undefined) {
      this.markLayoutDirty();
    }
  }

  override _measureIntrinsicSize(): LayoutRect {
    return {
      x: 0,
      y: 0,
      width: Math.max(
        terminalCellWidth(this._value),
        terminalCellWidth(this._placeholder)
      ),
      height: 1,
    };
  }

  get cursorIndex(): number {
    return this._cursorIndex;
  }

  set cursorIndex(value: number) {
    this._cursorIndex = clampIndex(value, this.value);
  }

  /** @internal */
  override _focus(): void {
    if (this.focused) {
      return;
    }
    this._valueAtFocus = this.value;
    super._focus();
  }

  /** @internal */
  override _blur(): void {
    if (!this.focused) {
      return;
    }
    this.commitChangedValue();
    super._blur();
  }

  /** @internal */
  override _handleKey(event: KeyEvent): void {
    if (this.handleInputKey(event)) {
      event.stopPropagation();
      return;
    }
    super._handleKey(event);
  }

  protected override renderSelf(
    buffer: MoonBuffer,
    x: number,
    y: number,
    context?: RenderContext
  ): void {
    const layout = this.computedLayout;
    const width = this.layoutComputed
      ? layout.width
      : numericSize(this.width) || this._measureIntrinsicSize().width;
    const height = this.layoutComputed
      ? layout.height
      : numericSize(this.height);
    const backgroundColor = this.focused
      ? (this.focusedBackgroundColor ?? this.backgroundColor)
      : this.backgroundColor;
    if (backgroundColor && width > 0 && height > 0) {
      buffer.fillRect(x, y, width, height, backgroundColor);
    }

    const content = this.value || this.placeholder;
    if (content) {
      buffer.drawText(
        [...content].slice(0, width).join(""),
        x,
        y,
        this.value ? this.foregroundColor : this.placeholderColor,
        backgroundColor,
        this.attributes
      );
    }

    if (this.focused) {
      context?.setCursorPosition(
        x + Math.min(this._cursorIndex, width),
        y,
        true
      );
    }
  }

  private handleInputKey(event: KeyEvent): boolean {
    const key = event.key.toLowerCase();
    if (key === "enter") {
      this._onSubmit?.(this.value);
      this.commitChangedValue();
      return true;
    }
    if (key === "backspace") {
      this.deleteBeforeCursor();
      return true;
    }
    if (key === "arrowleft" || key === "left") {
      this.cursorIndex = this._cursorIndex - 1;
      return true;
    }
    if (key === "arrowright" || key === "right") {
      this.cursorIndex = this._cursorIndex + 1;
      return true;
    }
    if (isPrintableKey(event)) {
      this.insertAtCursor(event.key);
      return true;
    }
    return false;
  }

  private insertAtCursor(text: string): void {
    const chars = [...this.value];
    if (this.maxLength !== undefined && chars.length >= this.maxLength) {
      return;
    }
    chars.splice(this._cursorIndex, 0, text);
    this.value = chars.join("");
    this._cursorIndex += 1;
    this._onInput?.(this.value);
  }

  private deleteBeforeCursor(): void {
    if (this._cursorIndex === 0) {
      return;
    }
    const chars = [...this.value];
    chars.splice(this._cursorIndex - 1, 1);
    this.value = chars.join("");
    this._cursorIndex -= 1;
    this._onInput?.(this.value);
  }

  private commitChangedValue(): void {
    if (this.value === this._valueAtFocus) {
      return;
    }
    this._valueAtFocus = this.value;
    this._onChange?.(this.value);
  }
}

export interface ButtonRenderableOptions extends RenderableOptions {
  attributes?: number;
  backgroundColor?: RGBAInput;
  disabledBackgroundColor?: RGBAInput;
  disabledForegroundColor?: RGBAInput;
  focusedBackgroundColor?: RGBAInput;
  focusedForegroundColor?: RGBAInput;
  foregroundColor?: RGBAInput;
  label: string;
  onPress?: () => void;
}

export class ButtonRenderable extends Renderable {
  attributes?: number;
  backgroundColor?: RGBAInput;
  disabledBackgroundColor?: RGBAInput;
  disabledForegroundColor: RGBAInput;
  focusedBackgroundColor?: RGBAInput;
  focusedForegroundColor?: RGBAInput;
  foregroundColor: RGBAInput;
  private _label: string;
  private readonly _onPress?: () => void;

  constructor(options: ButtonRenderableOptions) {
    super({
      ...options,
      focusable: options.focusable ?? !options.disabled,
      height: options.height ?? 1,
      width: options.width,
    });
    this._label = options.label;
    this.foregroundColor = options.foregroundColor ?? terminalDefault();
    this.backgroundColor = options.backgroundColor;
    this.focusedForegroundColor = options.focusedForegroundColor;
    this.focusedBackgroundColor = options.focusedBackgroundColor;
    this.disabledForegroundColor =
      options.disabledForegroundColor ?? this.foregroundColor;
    this.disabledBackgroundColor = options.disabledBackgroundColor;
    this.attributes = options.attributes;
    this._onPress = options.onPress;
  }

  get label(): string {
    return this._label;
  }

  set label(value: string) {
    if (value === this._label) {
      return;
    }
    this._label = value;
    if (this.layoutProps.width === undefined) {
      this.markLayoutDirty();
    }
  }

  override _measureIntrinsicSize(): LayoutRect {
    return {
      x: 0,
      y: 0,
      width: terminalCellWidth(this.visibleLabel()),
      height: 1,
    };
  }

  /** @internal */
  override _handleKey(event: KeyEvent): void {
    if (this.isActivationKey(event)) {
      this.press();
      event.stopPropagation();
      return;
    }
    super._handleKey(event);
  }

  /** @internal */
  override _handleMouse(event: MouseEvent): void {
    if (event.kind === "down" && event.button === "left") {
      this.press();
      event.stopPropagation();
      return;
    }
    super._handleMouse(event);
  }

  protected override renderSelf(
    buffer: MoonBuffer,
    x: number,
    y: number
  ): void {
    const layout = this.computedLayout;
    const width = this.layoutComputed
      ? layout.width
      : numericSize(this.width) || this._measureIntrinsicSize().width;
    const height = this.layoutComputed
      ? layout.height
      : numericSize(this.height) || this._measureIntrinsicSize().height;
    const style = this.currentStyle();
    if (style.backgroundColor && width > 0 && height > 0) {
      buffer.fillRect(x, y, width, height, style.backgroundColor);
    }
    if (width <= 0) {
      return;
    }
    buffer.drawText(
      [...this.visibleLabel()].slice(0, width).join(""),
      x,
      y,
      style.foregroundColor,
      style.backgroundColor,
      this.attributes
    );
  }

  private currentStyle(): {
    backgroundColor?: RGBAInput;
    foregroundColor: RGBAInput;
  } {
    if (this.disabled) {
      return {
        foregroundColor: this.disabledForegroundColor,
        backgroundColor: this.disabledBackgroundColor ?? this.backgroundColor,
      };
    }
    if (this.focused) {
      return {
        foregroundColor: this.focusedForegroundColor ?? this.foregroundColor,
        backgroundColor: this.focusedBackgroundColor ?? this.backgroundColor,
      };
    }
    return {
      foregroundColor: this.foregroundColor,
      backgroundColor: this.backgroundColor,
    };
  }

  private isActivationKey(event: KeyEvent): boolean {
    const key = event.key.toLowerCase();
    return key === "enter" || event.key === " ";
  }

  private press(): void {
    if (this.disabled) {
      return;
    }
    this._onPress?.();
  }

  private visibleLabel(): string {
    return `[ ${this._label} ]`;
  }
}

export interface CheckboxRenderableOptions extends RenderableOptions {
  attributes?: number;
  backgroundColor?: RGBAInput;
  checked?: boolean;
  disabledBackgroundColor?: RGBAInput;
  disabledForegroundColor?: RGBAInput;
  focusedBackgroundColor?: RGBAInput;
  focusedForegroundColor?: RGBAInput;
  foregroundColor?: RGBAInput;
  label: string;
  onChange?: (checked: boolean) => void;
}

export class CheckboxRenderable extends Renderable {
  attributes?: number;
  backgroundColor?: RGBAInput;
  disabledBackgroundColor?: RGBAInput;
  disabledForegroundColor: RGBAInput;
  focusedBackgroundColor?: RGBAInput;
  focusedForegroundColor?: RGBAInput;
  foregroundColor: RGBAInput;
  private _checked: boolean;
  private _label: string;
  private readonly _onChange?: (checked: boolean) => void;

  constructor(options: CheckboxRenderableOptions) {
    super({
      ...options,
      focusable: options.focusable ?? !options.disabled,
      height: options.height ?? 1,
      width: options.width,
    });
    this._checked = options.checked ?? false;
    this._label = options.label;
    this.foregroundColor = options.foregroundColor ?? terminalDefault();
    this.backgroundColor = options.backgroundColor;
    this.focusedForegroundColor = options.focusedForegroundColor;
    this.focusedBackgroundColor = options.focusedBackgroundColor;
    this.disabledForegroundColor =
      options.disabledForegroundColor ?? this.foregroundColor;
    this.disabledBackgroundColor = options.disabledBackgroundColor;
    this.attributes = options.attributes;
    this._onChange = options.onChange;
  }

  get checked(): boolean {
    return this._checked;
  }

  set checked(value: boolean) {
    this._checked = value;
  }

  get label(): string {
    return this._label;
  }

  set label(value: string) {
    if (value === this._label) {
      return;
    }
    this._label = value;
    if (this.layoutProps.width === undefined) {
      this.markLayoutDirty();
    }
  }

  override _measureIntrinsicSize(): LayoutRect {
    return {
      x: 0,
      y: 0,
      width: terminalCellWidth(this.visibleLabel()),
      height: 1,
    };
  }

  /** @internal */
  override _handleKey(event: KeyEvent): void {
    if (this.isActivationKey(event)) {
      this.toggle();
      event.stopPropagation();
      return;
    }
    super._handleKey(event);
  }

  /** @internal */
  override _handleMouse(event: MouseEvent): void {
    if (event.kind === "down" && event.button === "left") {
      this.toggle();
      event.stopPropagation();
      return;
    }
    super._handleMouse(event);
  }

  protected override renderSelf(
    buffer: MoonBuffer,
    x: number,
    y: number
  ): void {
    const layout = this.computedLayout;
    const width = this.layoutComputed
      ? layout.width
      : numericSize(this.width) || this._measureIntrinsicSize().width;
    const height = this.layoutComputed
      ? layout.height
      : numericSize(this.height) || this._measureIntrinsicSize().height;
    const style = this.currentStyle();
    if (style.backgroundColor && width > 0 && height > 0) {
      buffer.fillRect(x, y, width, height, style.backgroundColor);
    }
    if (width <= 0) {
      return;
    }
    buffer.drawText(
      [...this.visibleLabel()].slice(0, width).join(""),
      x,
      y,
      style.foregroundColor,
      style.backgroundColor,
      this.attributes
    );
  }

  private currentStyle(): {
    backgroundColor?: RGBAInput;
    foregroundColor: RGBAInput;
  } {
    if (this.disabled) {
      return {
        foregroundColor: this.disabledForegroundColor,
        backgroundColor: this.disabledBackgroundColor ?? this.backgroundColor,
      };
    }
    if (this.focused) {
      return {
        foregroundColor: this.focusedForegroundColor ?? this.foregroundColor,
        backgroundColor: this.focusedBackgroundColor ?? this.backgroundColor,
      };
    }
    return {
      foregroundColor: this.foregroundColor,
      backgroundColor: this.backgroundColor,
    };
  }

  private isActivationKey(event: KeyEvent): boolean {
    const key = event.key.toLowerCase();
    return key === "enter" || event.key === " ";
  }

  private toggle(): void {
    if (this.disabled) {
      return;
    }
    this._checked = !this._checked;
    this._onChange?.(this._checked);
  }

  private visibleLabel(): string {
    return `${this._checked ? "[x]" : "[ ]"} ${this._label}`;
  }
}

function clampIndex(index: number, value: string): number {
  return Math.max(0, Math.min(Math.floor(index), [...value].length));
}

function isPrintableKey(event: KeyEvent): boolean {
  return (
    !(event.modifiers.ctrl || event.modifiers.alt) &&
    [...event.key].length === 1
  );
}

export function terminalCellWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || codePoint === 0) {
      continue;
    }
    if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) {
      continue;
    }
    width += isWideCodePoint(codePoint) ? 2 : 1;
  }
  return width;
}

function isWideCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x11_00 && codePoint <= 0x11_5f) ||
    codePoint === 0x23_29 ||
    codePoint === 0x23_2a ||
    (codePoint >= 0x2e_80 && codePoint <= 0xa4_cf) ||
    (codePoint >= 0xac_00 && codePoint <= 0xd7_a3) ||
    (codePoint >= 0xf9_00 && codePoint <= 0xfa_ff) ||
    (codePoint >= 0xfe_10 && codePoint <= 0xfe_19) ||
    (codePoint >= 0xfe_30 && codePoint <= 0xfe_6f) ||
    (codePoint >= 0xff_00 && codePoint <= 0xff_60) ||
    (codePoint >= 0xff_e0 && codePoint <= 0xff_e6) ||
    (codePoint >= 0x1_f3_00 && codePoint <= 0x1_fa_ff)
  );
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

export function Input(options: InputRenderableOptions = {}): InputRenderable {
  return new InputRenderable(options);
}

export function Button(options: ButtonRenderableOptions): ButtonRenderable {
  return new ButtonRenderable(options);
}

export function Checkbox(
  options: CheckboxRenderableOptions
): CheckboxRenderable {
  return new CheckboxRenderable(options);
}
