import { expect, test } from "bun:test";

import {
  BoxRenderable,
  ButtonRenderable,
  CheckboxRenderable,
  computeNativeCustomLayout,
  defaultLayoutEngine,
  InputRenderable,
  type LayoutEngine,
  type LayoutRect,
  nativeCustomLayoutEngine,
  RootRenderable,
  TextRenderable,
  TypeScriptLayoutEngine,
} from "./renderable";
import {
  createCountingLayoutEngine,
  createTestRenderer,
  layoutBackendCases,
} from "./testing";

test("native custom backend preserves core layout fixture parity", () => {
  const ts = runFixture(new TypeScriptLayoutEngine());
  const native = runFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom backend matches row, column, nested flow, spacing, and percentage parity", () => {
  const ts = runFlowFixture(new TypeScriptLayoutEngine());
  const native = runFlowFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom backend matches deep nested parity", () => {
  const ts = runDeepFixture(new TypeScriptLayoutEngine());
  const native = runDeepFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom backend matches balanced tree parity", () => {
  const ts = runBalancedFixture(new TypeScriptLayoutEngine());
  const native = runBalancedFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom backend matches flex sizing and alignment parity", () => {
  const ts = runFlexFixture(new TypeScriptLayoutEngine());
  const native = runFlexFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom backend handles display none and absolute positioning", () => {
  const ts = runAbsoluteFixture(new TypeScriptLayoutEngine());
  const native = runAbsoluteFixture(nativeCustomLayoutEngine);

  expect(native.visible).toEqual(ts.visible);
  expect(native.absolute).toEqual(ts.absolute);
  expect(native.hiddenComputed).toBe(false);
});

test("native custom backend receives intrinsic text and input measurements", () => {
  const ts = runIntrinsicFixture(new TypeScriptLayoutEngine());
  const native = runIntrinsicFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom backend receives intrinsic interactive widget measurements", () => {
  const ts = runInteractiveIntrinsicFixture(new TypeScriptLayoutEngine());
  const native = runInteractiveIntrinsicFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom backend clears direct render fallback children", () => {
  const ts = runDirectRenderFallbackFixture(new TypeScriptLayoutEngine());
  const native = runDirectRenderFallbackFixture(nativeCustomLayoutEngine);

  expect(native).toEqual(ts);
});

test("native custom layout rejects invalid buffers", () => {
  const result = computeNativeCustomLayout(
    new Int32Array([0]),
    new Float32Array(1),
    new Float32Array(2),
    new Float32Array(4)
  );

  expect(result).not.toBe(0);
});

test("native custom layout rejects out-of-range parent indices", () => {
  const parentIndices = new Int32Array([-1, 8]);
  const styles = new Float32Array(60);
  styles.fill(Number.NaN);
  styles[0] = 20;
  styles[1] = 10;
  const result = computeNativeCustomLayout(
    parentIndices,
    styles,
    new Float32Array(4),
    new Float32Array(8)
  );

  expect(result).not.toBe(0);
});

test("layout backend cases expose distinct backend identities", () => {
  const names = layoutBackendCases().map((backend) => backend.name);

  expect(names).toEqual(["native-custom", "typescript-fallback-oracle"]);
});

test("default layout engine uses native custom backend", () => {
  expect(defaultLayoutEngine).toBe(nativeCustomLayoutEngine);
});

test("test renderer can select TypeScript layout fallback", async () => {
  const fallback = createCountingLayoutEngine(new TypeScriptLayoutEngine());
  const { renderer, renderOnce } = createTestRenderer({
    autoFocus: false,
    layoutEngine: fallback,
  });
  renderer.root.add(new BoxRenderable({ flexGrow: 1 }));

  await renderOnce();

  expect(fallback.count()).toBe(1);
  renderer.destroy();
});

function runFixture(engine: LayoutEngine): Record<string, LayoutRect> {
  const root = new RootRenderable(30, 10);
  root.setLayoutProps({
    flexDirection: "row",
    gap: 1,
    padding: { top: 1, right: 2, bottom: 1, left: 2 },
    alignItems: "center",
  });
  const sidebar = new BoxRenderable({
    width: 5,
    margin: { right: 1 },
    minHeight: 2,
    maxHeight: 4,
  });
  const body = new BoxRenderable({ flexGrow: 1, flexShrink: 1 });
  const footer = new BoxRenderable({
    flexBasis: "20%",
    width: "10%",
    alignSelf: "end",
  });
  root.add(sidebar).add(body).add(footer);

  engine.compute(root, 30, 10);

  return {
    sidebar: sidebar.computedLayout,
    body: body.computedLayout,
    footer: footer.computedLayout,
  };
}

function runFlowFixture(engine: LayoutEngine): Record<string, LayoutRect> {
  const root = new RootRenderable(40, 12);
  root.setLayoutProps({
    flexDirection: "column",
    gap: 1,
    padding: { top: 1, right: 2, bottom: 1, left: 2 },
  });
  const header = new BoxRenderable({ height: 2, margin: { bottom: 1 } });
  const row = new BoxRenderable({
    flexDirection: "row",
    gap: 2,
    height: "50%",
    padding: { left: 1, right: 1 },
  });
  const first = new BoxRenderable({ width: "25%", margin: { right: 1 } });
  const second = new BoxRenderable({ flexGrow: 1 });
  row.add(first).add(second);
  root.add(header).add(row);

  engine.compute(root, 40, 12);

  return {
    header: header.computedLayout,
    row: row.computedLayout,
    first: first.computedLayout,
    second: second.computedLayout,
  };
}

function runDeepFixture(engine: LayoutEngine): Record<string, LayoutRect> {
  const root = new RootRenderable(12, 12);
  root.setLayoutProps({ flexDirection: "column" });
  const first = new BoxRenderable({ flexGrow: 1, flexDirection: "row" });
  const second = new BoxRenderable({ flexGrow: 1, flexDirection: "column" });
  const third = new BoxRenderable({ flexGrow: 1, padding: 1 });
  const leaf = new TextRenderable({ content: "leaf" });
  root.add(first);
  first.add(second);
  second.add(third);
  third.add(leaf);

  engine.compute(root, 12, 12);

  return {
    first: first.computedLayout,
    second: second.computedLayout,
    third: third.computedLayout,
    leaf: leaf.computedLayout,
  };
}

function runBalancedFixture(engine: LayoutEngine): Record<string, LayoutRect> {
  const root = new RootRenderable(30, 12);
  root.setLayoutProps({ flexDirection: "column", gap: 1 });
  const top = new BoxRenderable({ height: 4, flexDirection: "row", gap: 1 });
  const bottom = new BoxRenderable({ flexGrow: 1, flexDirection: "row" });
  const left = new BoxRenderable({ flexGrow: 1 });
  const right = new BoxRenderable({ width: 8 });
  const bottomLeft = new BoxRenderable({ flexGrow: 1 });
  const bottomRight = new BoxRenderable({ flexGrow: 1 });
  root.add(top).add(bottom);
  top.add(left).add(right);
  bottom.add(bottomLeft).add(bottomRight);

  engine.compute(root, 30, 12);

  return {
    top: top.computedLayout,
    bottom: bottom.computedLayout,
    left: left.computedLayout,
    right: right.computedLayout,
    bottomLeft: bottomLeft.computedLayout,
    bottomRight: bottomRight.computedLayout,
  };
}

function runFlexFixture(engine: LayoutEngine): Record<string, LayoutRect> {
  const root = new RootRenderable(32, 8);
  root.setLayoutProps({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  });
  const grow = new BoxRenderable({
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 6,
    minWidth: 4,
    maxWidth: 10,
    height: 2,
  });
  const fixed = new BoxRenderable({
    width: 8,
    height: 2,
    alignSelf: "end",
  });
  const shrink = new BoxRenderable({
    flexBasis: 20,
    flexShrink: 2,
    minWidth: 5,
    maxWidth: 12,
    height: 1,
  });
  root.add(grow).add(fixed).add(shrink);

  engine.compute(root, 32, 8);

  return {
    grow: grow.computedLayout,
    fixed: fixed.computedLayout,
    shrink: shrink.computedLayout,
  };
}

function runAbsoluteFixture(engine: LayoutEngine): {
  absolute: LayoutRect;
  hiddenComputed: boolean;
  visible: LayoutRect;
} {
  const root = new RootRenderable(20, 8);
  root.setLayoutProps({ flexDirection: "column", gap: 1 });
  const visible = new BoxRenderable({ height: 2 });
  const absolute = new BoxRenderable({
    position: "absolute",
    width: 3,
    height: 2,
    right: 1,
    bottom: 1,
  });
  const hidden = new BoxRenderable({ display: "none", height: 4 });
  root.add(visible).add(absolute).add(hidden);

  engine.compute(root, 20, 8);

  return {
    visible: visible.computedLayout,
    absolute: absolute.computedLayout,
    hiddenComputed: hidden.layoutComputed,
  };
}

function runIntrinsicFixture(engine: LayoutEngine): Record<string, LayoutRect> {
  const root = new RootRenderable(20, 5);
  root.setLayoutProps({ flexDirection: "row", gap: 1, alignItems: "start" });
  const text = new TextRenderable({ content: "wide" });
  const input = new InputRenderable({ value: "x", placeholder: "placeholder" });
  root.add(text).add(input);

  engine.compute(root, 20, 5);

  return {
    text: text.computedLayout,
    input: input.computedLayout,
  };
}

function runInteractiveIntrinsicFixture(
  engine: LayoutEngine
): Record<string, LayoutRect> {
  const root = new RootRenderable(40, 5);
  root.setLayoutProps({ flexDirection: "row", gap: 1, alignItems: "start" });
  const button = new ButtonRenderable({ label: "Save" });
  const checkbox = new CheckboxRenderable({ label: "Accept" });
  root.add(button).add(checkbox);

  engine.compute(root, 40, 5);

  return {
    button: button.computedLayout,
    checkbox: checkbox.computedLayout,
  };
}

function runDirectRenderFallbackFixture(engine: LayoutEngine): {
  inputComputed: boolean;
  inputLayout: LayoutRect;
} {
  const root = new RootRenderable(16, 4);
  const input = new InputRenderable({ value: "abc", x: 4, y: 2, width: 8 });
  root.add(input);

  engine.compute(root, 16, 4);

  return {
    inputComputed: input.layoutComputed,
    inputLayout: input.computedLayout,
  };
}
