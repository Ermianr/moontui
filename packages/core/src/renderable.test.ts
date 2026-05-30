import { expect, test } from "bun:test";
import { ATTR_BOLD, MoonBuffer } from "./buffer";
import { api } from "./ffi";
import {
  Box as PublicBox,
  BoxRenderable as PublicBoxRenderable,
  Renderable as PublicRenderable,
  RootRenderable as PublicRootRenderable,
  Text as PublicText,
  TextRenderable as PublicTextRenderable,
} from "./index";
import {
  Box,
  BoxRenderable,
  Renderable,
  RootRenderable,
  Text,
  TextRenderable,
} from "./renderable";

const white = { r: 255, g: 255, b: 255, a: 255 };
const black = { r: 0, g: 0, b: 0, a: 255 };
const red = { r: 255, g: 0, b: 0, a: 255 };

function createBuffer(width = 20, height = 8) {
  const rendererPtr = api.renderer.createRenderer(width, height, true);
  const bufPtr = api.renderer.getNextBuffer(rendererPtr);
  return {
    buffer: new MoonBuffer(bufPtr, width, height),
    destroy: () => api.renderer.destroyRenderer(rendererPtr),
  };
}

function lineText(buffer: MoonBuffer, y: number) {
  return new TextDecoder().decode(buffer.getRealCharBytes(true)).split("\n")[y];
}

test("renderable adds, removes, and renders children in insertion order", () => {
  const { buffer, destroy } = createBuffer();
  const parent = new Renderable();
  const first = new TextRenderable({ content: "A", foregroundColor: white });
  const second = new TextRenderable({ content: "B", foregroundColor: white });

  parent.add(first).add(second);
  expect(parent.children).toEqual([first, second]);

  parent.render(buffer);
  expect(lineText(buffer, 0)?.startsWith("B")).toBe(true);

  parent.remove(second);
  expect(parent.children).toEqual([first]);

  buffer.clear(black);
  parent.render(buffer);
  expect(lineText(buffer, 0)?.startsWith("A")).toBe(true);
  destroy();
});

test("renderable renders nested children with accumulated offsets", () => {
  const { buffer, destroy } = createBuffer();
  const parent = new Renderable({ x: 2, y: 1 });
  const child = new TextRenderable({
    x: 3,
    y: 2,
    content: "Hello",
    foregroundColor: white,
  });

  parent.add(child);
  parent.render(buffer);

  expect(lineText(buffer, 3)?.slice(5, 10)).toBe("Hello");
  destroy();
});

test("text renderable draws text and style spans", () => {
  const { buffer, destroy } = createBuffer();
  const text = new TextRenderable({
    x: 2,
    y: 1,
    content: "Hi",
    foregroundColor: white,
    backgroundColor: red,
    attributes: ATTR_BOLD,
  });

  text.render(buffer);

  const span = buffer
    .getSpanLines()[1]
    ?.spans.find((item) => item.text === "Hi");
  expect(span?.fg.r).toBe(white.r);
  expect(span?.bg.r).toBe(red.r);
  expect(span?.attributes).toBe(ATTR_BOLD);
  destroy();
});

test("box renderable draws box before children", () => {
  const { buffer, destroy } = createBuffer();
  const box = new BoxRenderable({
    x: 1,
    y: 1,
    width: 8,
    height: 4,
    borderColor: white,
    backgroundColor: black,
  });
  box.add(
    new TextRenderable({
      x: 2,
      y: 1,
      content: "OK",
      foregroundColor: red,
      backgroundColor: black,
    })
  );

  box.render(buffer);

  expect(lineText(buffer, 1)?.at(1)).toBe("┌");
  expect(lineText(buffer, 2)?.slice(3, 5)).toBe("OK");
  destroy();
});

test("construct helpers create renderables and attach children in order", () => {
  const first = Text({ content: "A" });
  const second = Text({ content: "B" });
  const box = Box({ width: 10, height: 3 }, first, second);

  expect(first).toBeInstanceOf(TextRenderable);
  expect(box).toBeInstanceOf(BoxRenderable);
  expect(box.children).toEqual([first, second]);
});

test("root renderable keeps renderer-sized dimensions", () => {
  const root = new RootRenderable(40, 10);

  expect(root.width).toBe(40);
  expect(root.height).toBe(10);
});

test("public API exports renderable symbols", () => {
  expect(PublicRenderable).toBe(Renderable);
  expect(PublicRootRenderable).toBe(RootRenderable);
  expect(PublicTextRenderable).toBe(TextRenderable);
  expect(PublicBoxRenderable).toBe(BoxRenderable);
  expect(PublicText).toBe(Text);
  expect(PublicBox).toBe(Box);
});
