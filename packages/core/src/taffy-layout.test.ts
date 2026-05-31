import { expect, test } from "bun:test";

import { api } from "./ffi";
import {
  BoxRenderable,
  InputRenderable,
  type LayoutEngine,
  type LayoutRect,
  RootRenderable,
  TextRenderable,
  TypeScriptLayoutEngine,
  taffyLayoutEngine,
} from "./renderable";

test("taffy backend preserves core layout fixture parity", () => {
  const ts = runFixture(new TypeScriptLayoutEngine());
  const taffy = runFixture(taffyLayoutEngine);

  expect(taffy).toEqual(ts);
});

test("taffy backend handles display none and absolute positioning", () => {
  const ts = runAbsoluteFixture(new TypeScriptLayoutEngine());
  const taffy = runAbsoluteFixture(taffyLayoutEngine);

  expect(taffy.visible).toEqual(ts.visible);
  expect(taffy.absolute).toEqual(ts.absolute);
  expect(taffy.hiddenComputed).toBe(false);
});

test("taffy backend receives intrinsic text and input measurements", () => {
  const ts = runIntrinsicFixture(new TypeScriptLayoutEngine());
  const taffy = runIntrinsicFixture(taffyLayoutEngine);

  expect(taffy).toEqual(ts);
});

test("native taffy layout rejects invalid buffers", () => {
  const result = api.renderer.computeTaffyLayout(
    new Int32Array([0]),
    new Float32Array(1),
    new Float32Array(2),
    new Float32Array(4)
  );

  expect(result).not.toBe(0);
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
