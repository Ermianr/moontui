import { expect, test } from "bun:test";
import type {
  FFICallbackInstance,
  FFIFunction,
  LoadedLibrary,
  PlatformBackend,
  Pointer,
} from "./platform/types";
import { FFIType } from "./platform/types";

function createMockBackend(): PlatformBackend & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    isAvailable: true,
    ptr(view: ArrayBufferView): Pointer<void> {
      calls.push(`ptr(${view.constructor.name})`);
      return 0 as unknown as Pointer<void>;
    },
    toArrayBuffer(
      _ptr: Pointer<void>,
      _offset: number,
      _length: number
    ): ArrayBuffer {
      calls.push("toArrayBuffer");
      return new ArrayBuffer(0);
    },
    toPointer<T>(value: number | bigint): Pointer<T> {
      calls.push(`toPointer(${value})`);
      return value as unknown as Pointer<T>;
    },
    resolveURL(url: string): string {
      calls.push(`resolveURL(${url})`);
      return url.replace("file://", "");
    },
    loadLibrary(
      _path: string,
      _definitions: Record<string, FFIFunction>
    ): LoadedLibrary {
      calls.push("loadLibrary");
      return {
        symbols: new Proxy({} as Record<string, (...args: any[]) => any>, {
          get(_target, prop: string) {
            return (...args: any[]) => {
              calls.push(`symbols.${prop}(${args.join(", ")})`);
              return 0;
            };
          },
        }),
        createCallback(
          _fn: (...args: any[]) => any,
          _options: { args: string[]; returns: string }
        ): FFICallbackInstance {
          calls.push("createCallback");
          return {
            ptr: 0 as unknown as Pointer<void>,
            close() {
              calls.push("callback.close");
            },
          };
        },
        close() {
          calls.push("lib.close");
        },
      };
    },
  };
}

test("mock backend records ptr calls", () => {
  const backend = createMockBackend();
  const view = new Uint8Array(4);
  backend.ptr(view);
  expect(backend.calls).toContain("ptr(Uint8Array)");
});

test("mock backend records toPointer calls", () => {
  const backend = createMockBackend();
  backend.toPointer(42);
  expect(backend.calls).toContain("toPointer(42)");
});

test("mock backend records toPointer with bigint", () => {
  const backend = createMockBackend();
  backend.toPointer(123n);
  expect(backend.calls).toContain("toPointer(123)");
});

test("mock backend loadLibrary returns callable symbols", () => {
  const backend = createMockBackend();
  const lib = backend.loadLibrary("test.dll", {
    testFunc: { args: [FFIType.u32], returns: FFIType.void },
  });
  lib.symbols.testFunc(42);
  expect(backend.calls).toContain("loadLibrary");
  expect(backend.calls).toContain("symbols.testFunc(42)");
});

test("mock backend createCallback returns instance with ptr and close", () => {
  const backend = createMockBackend();
  const lib = backend.loadLibrary("test.dll", {});
  const cb = lib.createCallback(
    // biome-ignore lint/suspicious/noEmptyBlockStatements: test callback
    () => {},
    {
      args: [FFIType.ptr],
      returns: FFIType.void,
    }
  );
  expect(backend.calls).toContain("createCallback");
  expect(typeof cb.ptr).toBe("number");
  cb.close();
  expect(backend.calls).toContain("callback.close");
});
