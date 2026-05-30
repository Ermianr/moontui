import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBackend } from "./shared";
import type { PlatformBackend, Pointer } from "./types";

export function createNodeBackend(nodeFfi: unknown): PlatformBackend {
  const ffi = nodeFfi as {
    dlopen(
      path: string,
      defs: unknown
    ): {
      symbols: Record<string, (...args: unknown[]) => unknown>;
      close(): void;
    };
    ptr(view: ArrayBufferView): unknown;
    registerCallback(
      fn: (...args: unknown[]) => unknown,
      options: unknown
    ): { ptr: unknown; close(): void };
  };
  return createBackend({
    typeMap: {
      i8: "i8",
      u8: "u8",
      i16: "i16",
      u16: "u16",
      i32: "i32",
      u32: "u32",
      i64: "i64",
      u64: "u64",
      f32: "f32",
      f64: "f64",
      bool: "bool",
      ptr: "pointer",
      void: "void",
      cstring: "cstring",
      usize: "u64",
    },
    ptr(view) {
      return ffi.ptr(view) as unknown as Pointer<void>;
    },
    resolveLibraryPath() {
      const platform = process.platform;
      const arch = process.arch;
      const packageName = `@moontui/core-${platform}-${arch}`;
      try {
        const resolved = import.meta.resolve(`${packageName}/index.js`);
        return join(
          dirname(fileURLToPath(new URL(resolved))),
          libraryName(platform)
        );
      } catch {
        throw new Error(
          `moontui native package is unavailable for Node.js on ${platform}-${arch}. Node.js support is experimental.`
        );
      }
    },
    toArrayBuffer(_ptr, _offset, _length) {
      throw new Error("toArrayBuffer is not yet supported in Node.js backend");
    },
    // Node.js FFI represents pointers as bigint, so we convert number values
    // to bigint for compatibility with the FFI layer.
    toPointer(value) {
      if (typeof value === "number") {
        return BigInt(value) as unknown as Pointer<never>;
      }
      return value as unknown as Pointer<never>;
    },
    resolveURL(url) {
      return fileURLToPath(new URL(url));
    },
    dlopen(path, defs) {
      return ffi.dlopen(path, defs);
    },
    createCallbackImpl(fn, args, returns) {
      const cb = ffi.registerCallback(fn, { args, returns });
      return {
        ptr: cb.ptr as unknown as Pointer<void>,
        close() {
          cb.close();
        },
      };
    },
  });
}

function libraryName(platform: NodeJS.Platform): string {
  switch (platform) {
    case "win32":
      return "moontui_core.dll";
    case "darwin":
      return "libmoontui_core.dylib";
    case "linux":
      return "libmoontui_core.so";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
