import { expect, test } from "bun:test";
import { TypedEmitter } from "./emitter";

interface TestEvents {
  data: [string, number];
  empty: [];
  error: [Error];
}

test("TypedEmitter on/emit dispatches with correct args", () => {
  const emitter = new TypedEmitter<TestEvents>();
  let received = "";
  let count = 0;
  emitter.on("data", (str, num) => {
    received = str;
    count = num;
  });
  emitter.emit("data", "hello", 42);
  expect(received).toBe("hello");
  expect(count).toBe(42);
});

test("TypedEmitter off removes handler", () => {
  const emitter = new TypedEmitter<TestEvents>();
  let count = 0;
  const handler = () => {
    count++;
  };
  emitter.on("error", handler);
  emitter.emit("error", new Error("test"));
  expect(count).toBe(1);
  emitter.off("error", handler);
  emitter.emit("error", new Error("test2"));
  expect(count).toBe(1);
});

test("TypedEmitter multiple handlers", () => {
  const emitter = new TypedEmitter<TestEvents>();
  let a = 0;
  let b = 0;
  emitter.on("empty", () => {
    a++;
  });
  emitter.on("empty", () => {
    b++;
  });
  emitter.emit("empty");
  expect(a).toBe(1);
  expect(b).toBe(1);
});

test("TypedEmitter emit with no handlers is safe", () => {
  const emitter = new TypedEmitter<TestEvents>();
  emitter.emit("data", "x", 0);
});
