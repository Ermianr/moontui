import { fileURLToPath } from "node:url";
import { createBackend } from "./shared";
import type { PlatformBackend, Pointer } from "./types";

export function createNodeBackend(): PlatformBackend {
  // biome-ignore lint/suspicious/noExplicitAny: node:ffi is experimental and may not be available
  // biome-ignore lint/correctness/noUnresolvedImports: node:ffi is a Node.js runtime built-in
  const nodeFfi = require("node:ffi") as any;

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
      return nodeFfi.ptr(view) as unknown as Pointer<void>;
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
      return nodeFfi.dlopen(path, defs);
    },
    createCallbackImpl(fn, args, returns) {
      const cb = nodeFfi.registerCallback(fn, { args, returns });
      return {
        ptr: cb.ptr as unknown as Pointer<void>,
        close() {
          cb.close();
        },
      };
    },
  });
}
