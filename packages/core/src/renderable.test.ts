import { expect, test } from "bun:test";
import { ATTR_BOLD, MoonBuffer } from "./buffer";
import { api } from "./ffi";
import {
  Box as PublicBox,
  BoxRenderable as PublicBoxRenderable,
  Button as PublicButton,
  ButtonRenderable as PublicButtonRenderable,
  type ButtonRenderableOptions as PublicButtonRenderableOptions,
  Checkbox as PublicCheckbox,
  CheckboxRenderable as PublicCheckboxRenderable,
  type CheckboxRenderableOptions as PublicCheckboxRenderableOptions,
  Input as PublicInput,
  InputRenderable as PublicInputRenderable,
  type InputRenderableOptions as PublicInputRenderableOptions,
  Renderable as PublicRenderable,
  RootRenderable as PublicRootRenderable,
  Text as PublicText,
  TextRenderable as PublicTextRenderable,
} from "./index";
import {
  Box,
  BoxRenderable,
  Button,
  ButtonRenderable,
  Checkbox,
  CheckboxRenderable,
  defaultLayoutEngine,
  Input,
  InputRenderable,
  nativeCustomLayoutEngine,
  Renderable,
  RootRenderable,
  Text,
  TextRenderable,
  TypeScriptLayoutEngine,
} from "./renderable";
import { KeyEvent } from "./renderer";
import {
  assertLayoutRect,
  createCountingLayoutEngine,
  createSpy,
  createTestRenderer,
  layoutBackendCases,
} from "./testing/index";

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

test("column layout assigns fixed header and flexible body", () => {
  const root = new RootRenderable(20, 10);
  const header = new BoxRenderable({ height: 2 });
  const body = new BoxRenderable({ flexGrow: 1 });

  root.setLayoutProps({ flexDirection: "column" });
  root.add(header).add(body);
  root.computeLayout(20, 10);

  expect(header.computedLayout.height).toBe(2);
  expect(body.computedLayout.y).toBe(2);
  expect(body.computedLayout.height).toBe(8);
});

test("row layout assigns fixed sidebar and flexible content", () => {
  const root = new RootRenderable(40, 8);
  const sidebar = new BoxRenderable({ width: 10 });
  const content = new BoxRenderable({ flexGrow: 1 });

  root.setLayoutProps({ flexDirection: "row" });
  root.add(sidebar).add(content);
  root.computeLayout(40, 8);

  expect(sidebar.computedLayout.width).toBe(10);
  expect(content.computedLayout.x).toBe(10);
  expect(content.computedLayout.width).toBe(30);
});

test("layout applies padding margin gap percentage sizes and flex remainder", () => {
  const root = new RootRenderable(11, 10);
  const half = new BoxRenderable({ width: "50%", height: 1, margin: 1 });
  const firstFlex = new BoxRenderable({ flexGrow: 1 });
  const secondFlex = new BoxRenderable({ flexGrow: 1 });

  root.setLayoutProps({ flexDirection: "column", padding: 1, gap: 1 });
  root.add(half).add(firstFlex).add(secondFlex);
  root.computeLayout(11, 10);

  expect(half.computedLayout).toEqual({ x: 2, y: 2, width: 4, height: 1 });
  expect(firstFlex.computedLayout).toEqual({ x: 1, y: 5, width: 9, height: 2 });
  expect(secondFlex.computedLayout).toEqual({
    x: 1,
    y: 8,
    width: 9,
    height: 1,
  });
});

test("layout contract covers shrink basis min max alignment and display none", () => {
  const root = new RootRenderable(30, 6);
  const hidden = new BoxRenderable({ display: "none", width: 10, height: 3 });
  const first = new BoxRenderable({
    flexBasis: 12,
    flexShrink: 1,
    maxWidth: 8,
    height: 1,
    alignSelf: "center",
  });
  const second = new BoxRenderable({
    flexBasis: 12,
    flexShrink: 1,
    maxWidth: 7,
    minWidth: 7,
    height: 2,
    alignSelf: "end",
  });

  root.setLayoutProps({
    flexDirection: "row",
    alignItems: "start",
    justifyContent: "center",
  });
  root.add(hidden).add(first).add(second);
  root.computeLayout(30, 6);

  expect(hidden.layoutComputed).toBe(false);
  assertLayoutRect(first, { x: 7, y: 2, width: 8, height: 1 });
  assertLayoutRect(second, { x: 15, y: 4, width: 7, height: 2 });
});

test("display none renderables do not draw themselves or children", () => {
  const { buffer, destroy } = createBuffer();
  const hidden = new BoxRenderable({ display: "none", width: 10, height: 3 });
  hidden.add(Text({ content: "Hidden", foregroundColor: white }));

  hidden.render(buffer);

  expect(lineText(buffer, 0)).not.toContain("Hidden");
  destroy();
});

test("intrinsic measurement uses terminal cell width for text and input", () => {
  const ascii = Text({ content: "abc" });
  const cjk = Text({ content: "界" });
  const emoji = Text({ content: "🙂" });
  const input = Input({ value: "ab", placeholder: "界界" });

  expect(ascii._measureIntrinsicSize().width).toBe(3);
  expect(cjk._measureIntrinsicSize().width).toBe(2);
  expect(emoji._measureIntrinsicSize().width).toBe(2);
  expect(input._measureIntrinsicSize().width).toBe(4);
});

test("intrinsic content changes mark layout dirty only when width is implicit", () => {
  const root = new RootRenderable(20, 5);
  const text = Text({ content: "a" });
  const fixed = Text({ content: "a", width: 5 });
  const input = Input({ value: "a", placeholder: "Name" });

  root.setLayoutProps({ flexDirection: "column" });
  root.add(text).add(fixed).add(input);
  root.computeLayout(20, 5);

  text.content = "界";
  expect(root.layoutDirty).toBe(true);
  root.computeLayout(20, 5);

  fixed.content = "longer";
  expect(root.layoutDirty).toBe(false);

  input.value = "abcdef";
  expect(root.layoutDirty).toBe(true);
  root.computeLayout(20, 5);
  input.placeholder = "abcdefghi";
  expect(root.layoutDirty).toBe(true);
});

test("style and focus state changes do not mark clean layout dirty", () => {
  const root = new RootRenderable(20, 5);
  const text = Text({ content: "a", focusable: true, foregroundColor: white });

  root.setLayoutProps({ flexDirection: "column" });
  root.add(text);
  root.computeLayout(20, 5);

  text.foregroundColor = red;
  text.attributes = ATTR_BOLD;
  text._focus();

  expect(root.layoutDirty).toBe(false);
});

test("removed children stop participating in later layout", () => {
  const root = new RootRenderable(20, 5);
  const first = new BoxRenderable({ height: 1 });
  const second = new BoxRenderable({ height: 1 });

  root.setLayoutProps({ flexDirection: "column" });
  root.add(first).add(second);
  root.computeLayout(20, 5);
  root.remove(first);
  root.computeLayout(20, 5);

  expect(first.layoutComputed).toBe(false);
  expect(second.computedLayout.y).toBe(0);
});

test("clean and dirty frame layout recomputation is observable through harness", () => {
  const layoutEngine = createCountingLayoutEngine();
  const { renderer } = createTestRenderer({
    width: 20,
    height: 5,
    layoutEngine,
  });
  const text = Text({ content: "a" });

  renderer.root.setLayoutProps({ flexDirection: "column" });
  renderer.root.add(text);
  renderer.render();
  renderer.render();
  text.content = "abc";
  renderer.render();

  expect(layoutEngine.count()).toBe(2);
  renderer.destroy();
});

test("default layout engine is native custom", () => {
  expect(defaultLayoutEngine).toBe(nativeCustomLayoutEngine);
});

test("test harness exposes TypeScript layout only as fallback oracle", () => {
  expect(layoutBackendCases().map((item) => item.name)).toEqual([
    "native-custom",
    "typescript-fallback-oracle",
  ]);
});

test("renderer accepts explicit internal TypeScript fallback layout engine", () => {
  const layoutEngine = createCountingLayoutEngine(new TypeScriptLayoutEngine());
  const { renderer } = createTestRenderer({
    width: 20,
    height: 5,
    layoutEngine,
  });

  renderer.root.add(Text({ content: "a" }));
  renderer.render();

  expect(layoutEngine.count()).toBe(1);
  renderer.destroy();
});

test("absolute positioned children do not consume normal flow space", () => {
  const root = new RootRenderable(20, 5);
  const absolute = new TextRenderable({
    content: "A",
    position: "absolute",
    left: 5,
    top: 1,
  });
  const flow = new TextRenderable({ content: "Flow" });

  root.setLayoutProps({ flexDirection: "column" });
  root.add(absolute).add(flow);
  root.computeLayout(20, 5);

  expect(absolute.computedLayout.x).toBe(5);
  expect(absolute.computedLayout.y).toBe(1);
  expect(flow.computedLayout.x).toBe(0);
  expect(flow.computedLayout.y).toBe(0);
});

test("layout-driven renderables draw from computed coordinates in insertion order", () => {
  const { buffer, destroy } = createBuffer();
  const root = new RootRenderable(20, 8);
  const first = new TextRenderable({ content: "A", foregroundColor: white });
  const second = new TextRenderable({ content: "B", foregroundColor: white });

  root.setLayoutProps({ flexDirection: "column" });
  root.add(first).add(second);
  root.computeLayout(20, 8);
  root.render(buffer);

  expect(lineText(buffer, 0)?.startsWith("A")).toBe(true);
  expect(lineText(buffer, 1)?.startsWith("B")).toBe(true);
  destroy();
});

test("public API exports renderable symbols", () => {
  expect(PublicRenderable).toBe(Renderable);
  expect(PublicRootRenderable).toBe(RootRenderable);
  expect(PublicTextRenderable).toBe(TextRenderable);
  expect(PublicBoxRenderable).toBe(BoxRenderable);
  expect(PublicInputRenderable).toBe(InputRenderable);
  expect(PublicButtonRenderable).toBe(ButtonRenderable);
  expect(PublicCheckboxRenderable).toBe(CheckboxRenderable);
  expect(PublicText).toBe(Text);
  expect(PublicBox).toBe(Box);
  expect(PublicInput).toBe(Input);
  expect(PublicButton).toBe(Button);
  expect(PublicCheckbox).toBe(Checkbox);
  const options: PublicInputRenderableOptions = { placeholder: "Name" };
  const buttonOptions: PublicButtonRenderableOptions = { label: "Save" };
  const checkboxOptions: PublicCheckboxRenderableOptions = { label: "Accept" };
  expect(options.placeholder).toBe("Name");
  expect(buttonOptions.label).toBe("Save");
  expect(checkboxOptions.label).toBe("Accept");
});

test("input helper creates a focusable input renderable", () => {
  const input = Input({ placeholder: "Name" });

  expect(input).toBeInstanceOf(InputRenderable);
  expect(input.focusable).toBe(true);
});

test("input participates in focus traversal by default", () => {
  const { renderer } = createTestRenderer({ autoFocus: false });
  const first = Text({ content: "A", focusable: true });
  const input = Input({ placeholder: "Name" });
  renderer.root.add(first).add(input);

  expect(renderer.focusNext()).toBe(first);
  expect(renderer.focusNext()).toBe(input);
  renderer.destroy();
});

test("interactive widget helpers create focusable renderables", () => {
  const button = Button({ label: "Save" });
  const checkbox = Checkbox({ label: "Accept" });

  expect(button).toBeInstanceOf(ButtonRenderable);
  expect(button.focusable).toBe(true);
  expect(checkbox).toBeInstanceOf(CheckboxRenderable);
  expect(checkbox.focusable).toBe(true);
});

test("button renders normal focused and disabled styles", async () => {
  const { renderer, renderOnce, captureSpans } = createTestRenderer({
    autoFocus: false,
    width: 20,
    height: 3,
  });
  const normal = { r: 1, g: 0, b: 0, a: 255 };
  const focused = { r: 2, g: 0, b: 0, a: 255 };
  const disabled = { r: 3, g: 0, b: 0, a: 255 };
  const button = Button({
    label: "Save",
    foregroundColor: normal,
    focusedForegroundColor: focused,
    disabledForegroundColor: disabled,
  });
  renderer.root.add(button);

  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text === "[ Save ]")?.fg
      .r
  ).toBe(normal.r);

  renderer.focus(button);
  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text === "[ Save ]")?.fg
      .r
  ).toBe(focused.r);

  button.disabled = true;
  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text === "[ Save ]")?.fg
      .r
  ).toBe(disabled.r);
  renderer.destroy();
});

test("checkbox renders checked states and focused disabled styles", async () => {
  const { renderer, renderOnce, captureSpans } = createTestRenderer({
    autoFocus: false,
    width: 20,
    height: 3,
  });
  const normal = { r: 1, g: 0, b: 0, a: 255 };
  const focused = { r: 2, g: 0, b: 0, a: 255 };
  const disabled = { r: 3, g: 0, b: 0, a: 255 };
  const checkbox = Checkbox({
    label: "Accept",
    foregroundColor: normal,
    focusedForegroundColor: focused,
    disabledForegroundColor: disabled,
  });
  renderer.root.add(checkbox);

  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text === "[ ] Accept")
      ?.fg.r
  ).toBe(normal.r);

  checkbox.checked = true;
  renderer.focus(checkbox);
  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text === "[x] Accept")
      ?.fg.r
  ).toBe(focused.r);

  checkbox.disabled = true;
  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text === "[x] Accept")
      ?.fg.r
  ).toBe(disabled.r);
  renderer.destroy();
});

test("interactive widgets provide intrinsic measurements and invalidate on label changes", () => {
  const root = new RootRenderable(40, 5);
  const button = Button({ label: "Save" });
  const checkbox = Checkbox({ label: "Accept" });
  root.setLayoutProps({ flexDirection: "row", gap: 1, alignItems: "start" });
  root.add(button).add(checkbox);
  defaultLayoutEngine.compute(root, 40, 5);

  expect(button._measureIntrinsicSize().width).toBe(8);
  expect(checkbox._measureIntrinsicSize().width).toBe(10);
  expect(button.computedLayout.width).toBe(8);
  expect(checkbox.computedLayout.width).toBe(10);

  button.label = "Submit";
  expect(root.layoutDirty).toBe(true);
  root.computeLayout(40, 5);
  checkbox.label = "Terms";
  expect(root.layoutDirty).toBe(true);
});

test("focus traversal reaches enabled interactive widgets and skips disabled ones", () => {
  const { renderer } = createTestRenderer({ autoFocus: false });
  const first = Text({ content: "A", focusable: true });
  const disabledButton = Button({ label: "Disabled", disabled: true });
  const button = Button({ label: "Save" });
  const disabledCheckbox = Checkbox({ label: "Skip", disabled: true });
  const checkbox = Checkbox({ label: "Accept" });
  renderer.root
    .add(first)
    .add(disabledButton)
    .add(button)
    .add(disabledCheckbox)
    .add(checkbox);

  expect(renderer.focusNext()).toBe(first);
  expect(renderer.focusNext()).toBe(button);
  expect(renderer.focusNext()).toBe(checkbox);
  expect(renderer.focus(disabledButton)).toBe(false);
  expect(renderer.focus(disabledCheckbox)).toBe(false);
  renderer.destroy();
});

test("button keyboard activation consumes handled keys", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const onPress = createSpy();
  const globalKey = createSpy();
  const button = Button({ label: "Save", onPress });
  renderer.root.add(button);
  renderer.focus(button);
  renderer.on("key", globalKey);

  mockInput.pressEnter();
  mockInput.pressKey(" ");

  expect(onPress.callCount()).toBe(2);
  expect(globalKey.callCount()).toBe(0);
  renderer.destroy();
});

test("checkbox keyboard activation toggles and consumes handled keys", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const onChange = createSpy();
  const globalKey = createSpy();
  const checkbox = Checkbox({ label: "Accept", onChange });
  renderer.root.add(checkbox);
  renderer.focus(checkbox);
  renderer.on("key", globalKey);

  mockInput.pressEnter();
  expect(checkbox.checked).toBe(true);
  mockInput.pressKey(" ");

  expect(checkbox.checked).toBe(false);
  expect(onChange.calls).toEqual([[true], [false]]);
  expect(globalKey.callCount()).toBe(0);
  renderer.destroy();
});

test("interactive widgets activate through hit-tested mouse dispatch", async () => {
  const buttonPress = createSpy();
  const checkboxChange = createSpy();
  const { renderer, renderOnce, mockMouse } = createTestRenderer({
    autoFocus: false,
    width: 30,
    height: 4,
  });
  const button = Button({ label: "Save", onPress: buttonPress });
  const checkbox = Checkbox({ label: "Accept", onChange: checkboxChange });
  renderer.root.setLayoutProps({ flexDirection: "column" });
  renderer.root.add(button).add(checkbox);
  await renderOnce();

  mockMouse.click(1, 0);
  mockMouse.click(1, 1);
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(buttonPress.callCount()).toBe(1);
  expect(checkbox.checked).toBe(true);
  expect(checkboxChange.calledWith(true)).toBe(true);
  renderer.destroy();
});

test("disabled interactive widgets ignore keyboard and mouse activation", async () => {
  const buttonPress = createSpy();
  const checkboxChange = createSpy();
  const { renderer, renderOnce, mockInput, mockMouse } = createTestRenderer({
    autoFocus: false,
    width: 30,
    height: 4,
  });
  const button = Button({
    label: "Save",
    disabled: true,
    onPress: buttonPress,
  });
  const checkbox = Checkbox({
    label: "Accept",
    disabled: true,
    onChange: checkboxChange,
  });
  renderer.root.setLayoutProps({ flexDirection: "column" });
  renderer.root.add(button).add(checkbox);

  button._handleKey(
    new KeyEvent("enter", { ctrl: false, shift: false, alt: false })
  );
  checkbox._handleKey(
    new KeyEvent(" ", { ctrl: false, shift: false, alt: false })
  );
  await renderOnce();
  mockMouse.click(1, 0);
  mockMouse.click(1, 1);
  mockInput.pressEnter();
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(buttonPress.callCount()).toBe(0);
  expect(checkbox.checked).toBe(false);
  expect(checkboxChange.callCount()).toBe(0);
  renderer.destroy();
});

test("input stores initial value and cursor position", () => {
  const input = Input({ value: "abc" });

  expect(input.value).toBe("abc");
  expect(input.cursorIndex).toBe(3);
});

test("input renders placeholder and value", async () => {
  const empty = createTestRenderer({ width: 12, height: 2 });
  empty.renderer.root.add(Input({ placeholder: "Name", width: 8 }));
  await empty.renderOnce();
  expect(empty.captureCharFrame()).toContain("Name");
  empty.renderer.destroy();

  const filled = createTestRenderer({ width: 12, height: 2 });
  filled.renderer.root.add(Input({ value: "Kevin", width: 8 }));
  await filled.renderOnce();
  expect(filled.captureCharFrame()).toContain("Kevin");
  filled.renderer.destroy();
});

test("input clips rendered content to its width", async () => {
  const { renderer, renderOnce, captureSpans } = createTestRenderer({
    width: 8,
    height: 2,
  });
  renderer.root.add(Input({ value: "abcdef", width: 3 }));

  await renderOnce();

  const line = captureSpans()
    .lines[0]?.spans.map((span) => span.text)
    .join("");
  expect(line?.slice(0, 3)).toBe("abc");
  expect(line?.slice(0, 4)).not.toBe("abcd");
  renderer.destroy();
});

test("input inserts printable keys at the cursor", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const input = Input({ value: "ac" });
  input.cursorIndex = 1;
  renderer.root.add(input);
  renderer.focus(input);

  mockInput.pressKey("b");

  expect(input.value).toBe("abc");
  expect(input.cursorIndex).toBe(2);
  renderer.destroy();
});

test("input can be focused by left mouse click before typing", async () => {
  const { renderer, renderOnce, mockInput, mockMouse } = createTestRenderer({
    autoFocus: false,
    width: 20,
    height: 4,
  });
  const input = Input({ value: "", x: 2, y: 1, width: 8 });
  renderer.root.add(input);
  await renderOnce();

  mockMouse.click(3, 1);
  await new Promise((resolve) => setTimeout(resolve, 30));
  mockInput.pressKey("K");

  expect(renderer.focused).toBe(input);
  expect(input.value).toBe("K");
  renderer.destroy();
});

test("mouse click outside focusable targets clears focus", async () => {
  const { renderer, renderOnce, mockMouse } = createTestRenderer({
    autoFocus: false,
    width: 20,
    height: 4,
  });
  const enabled = Input({ value: "", x: 2, y: 1, width: 8 });
  const box = Box({ x: 2, y: 2, width: 8, height: 1 });
  renderer.root.add(enabled).add(box);
  renderer.focus(enabled);
  await renderOnce();

  mockMouse.click(3, 2);
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(renderer.focused).toBeNull();
  renderer.destroy();
});

test("mouse click on disabled focusable target clears focus", async () => {
  const { renderer, renderOnce, mockMouse } = createTestRenderer({
    autoFocus: false,
    width: 20,
    height: 4,
  });
  const enabled = Input({ value: "", x: 2, y: 1, width: 8 });
  const disabled = Input({ value: "", x: 2, y: 2, width: 8, disabled: true });
  renderer.root.add(enabled).add(disabled);
  renderer.focus(enabled);
  await renderOnce();

  mockMouse.click(3, 2);
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(renderer.focused).toBeNull();
  renderer.destroy();
});

test("mouse click focuses button before activation", async () => {
  const onPress = createSpy();
  const { renderer, renderOnce, mockMouse } = createTestRenderer({
    autoFocus: false,
    width: 20,
    height: 4,
  });
  const button = Button({ label: "Save", x: 2, y: 1, onPress });
  renderer.root.add(button);
  await renderOnce();

  mockMouse.click(3, 1);
  await new Promise((resolve) => setTimeout(resolve, 30));

  expect(renderer.focused).toBe(button);
  expect(onPress.callCount()).toBe(1);
  renderer.destroy();
});

test("input enforces maxLength during insertion", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const input = Input({ value: "abc", maxLength: 3 });
  renderer.root.add(input);
  renderer.focus(input);

  mockInput.pressKey("d");

  expect(input.value).toBe("abc");
  renderer.destroy();
});

test("input handles backspace and horizontal cursor movement", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const input = Input({ value: "abc" });
  renderer.root.add(input);
  renderer.focus(input);
  input.cursorIndex = 2;

  mockInput.pressArrow("left");
  expect(input.cursorIndex).toBe(1);
  mockInput.pressArrow("right");
  expect(input.cursorIndex).toBe(2);
  mockInput.pressBackspace();

  expect(input.value).toBe("ac");
  expect(input.cursorIndex).toBe(1);
  renderer.destroy();
});

test("input emits input submit and change callbacks", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const onInput = createSpy();
  const onSubmit = createSpy();
  const onChange = createSpy();
  const input = Input({ onInput, onSubmit, onChange });
  renderer.root.add(input);
  renderer.focus(input);

  mockInput.pressKey("x");
  mockInput.pressEnter();

  expect(onInput.calledWith("x")).toBe(true);
  expect(onSubmit.calledWith("x")).toBe(true);
  expect(onChange.calledWith("x")).toBe(true);
  renderer.destroy();
});

test("input commits changed value on blur", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const onChange = createSpy();
  const input = Input({ onChange });
  const next = Text({ content: "Next", focusable: true });
  renderer.root.add(input).add(next);
  renderer.focus(input);

  mockInput.pressKey("x");
  renderer.focus(next);

  expect(onChange.calledWith("x")).toBe(true);
  renderer.destroy();
});

test("input consumes handled editing keys and lets unhandled keys propagate", () => {
  const { renderer, mockInput } = createTestRenderer({ autoFocus: false });
  const globalKey = createSpy();
  const input = Input();
  renderer.root.add(input);
  renderer.focus(input);
  renderer.on("key", globalKey);

  mockInput.pressKey("x");
  mockInput.pressEscape();

  expect(globalKey.callCount()).toBe(1);
  expect(globalKey.calls[0]?.[0]?.key).toBe("esc");
  renderer.destroy();
});

test("input renders focused and unfocused background styles", async () => {
  const { renderer, renderOnce, captureSpans } = createTestRenderer({
    autoFocus: false,
    width: 16,
    height: 2,
  });
  const focusedBackgroundColor = { r: 1, g: 2, b: 3, a: 255 };
  const backgroundColor = { r: 4, g: 5, b: 6, a: 255 };
  const input = Input({
    value: "x",
    width: 3,
    backgroundColor,
    focusedBackgroundColor,
  });
  renderer.root.add(input);

  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text.includes("x"))?.bg.r
  ).toBe(backgroundColor.r);
  renderer.focus(input);
  await renderOnce();
  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text.includes("x"))?.bg.r
  ).toBe(focusedBackgroundColor.r);
  renderer.destroy();
});

test("input renders placeholder style", async () => {
  const { renderer, renderOnce, captureSpans } = createTestRenderer({
    width: 16,
    height: 2,
  });
  const placeholderColor = { r: 9, g: 8, b: 7, a: 255 };
  renderer.root.add(Input({ placeholder: "Name", width: 6, placeholderColor }));

  await renderOnce();

  expect(
    captureSpans().lines[0]?.spans.find((span) => span.text === "Name")?.fg.r
  ).toBe(placeholderColor.r);
  renderer.destroy();
});

test("focused input sets captured cursor position", async () => {
  const { renderer, renderOnce, captureSpans } = createTestRenderer({
    autoFocus: false,
    width: 16,
    height: 4,
  });
  const input = Input({ value: "abc", x: 4, y: 2, width: 8 });
  input.cursorIndex = 3;
  renderer.root.add(input);
  renderer.focus(input);

  await renderOnce();

  expect(captureSpans().cursor).toEqual([7, 2]);
  renderer.destroy();
});

test("blurred input clears captured cursor visibility on next render", async () => {
  const { renderer, renderOnce, captureSpans } = createTestRenderer({
    autoFocus: false,
    width: 16,
    height: 4,
  });
  const input = Input({ value: "abc", x: 4, y: 2, width: 8 });
  renderer.root.add(input);
  renderer.focus(input);
  await renderOnce();
  expect(captureSpans().cursor).toEqual([7, 2]);

  renderer.blur();
  await renderOnce();

  expect(captureSpans().cursor).toEqual([0, 0]);
  renderer.destroy();
});
