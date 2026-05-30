import { createBackend } from "./shared";
import type { PlatformBackend, Pointer } from "./types";

export function createDenoBackend(): PlatformBackend {
  // biome-ignore lint/suspicious/noExplicitAny: Deno is a global in Deno runtime
  const DenoFfi = (globalThis as any).Deno;

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
      usize: "usize",
    },
    ptr(view) {
      return DenoFfi.UnsafePointer.of(view) as unknown as Pointer<void>;
    },
    resolveLibraryPath() {
      const build = DenoFfi.build as { arch: string; os: string } | undefined;
      const platform = build ? `${build.os}-${build.arch}` : "unknown-platform";
      throw new Error(
        `moontui native package resolution is unavailable for Deno on ${platform}. Deno support is experimental.`
      );
    },
    toArrayBuffer(ptr, offset, length) {
      const buf = new DenoFfi.UnsafePointerView(
        ptr as unknown as bigint
      ).getArrayBuffer(offset + length);
      return buf.slice(offset, offset + length);
    },
    // Deno FFI represents pointers as bigint, so we convert number values
    // to bigint for compatibility with the FFI layer.
    toPointer(value) {
      if (typeof value === "number") {
        return BigInt(value) as unknown as Pointer<never>;
      }
      return value as unknown as Pointer<never>;
    },
    resolveURL(url) {
      return DenoFfi.urlToPath(new URL(url));
    },
    dlopen(path, defs) {
      return DenoFfi.dlopen(path, defs);
    },
    createCallbackImpl(fn, args, returns) {
      const cb = new DenoFfi.UnsafeCallback({ args, returns }, fn);
      return {
        ptr: cb.pointer as unknown as Pointer<void>,
        close() {
          cb.close();
        },
      };
    },
  });
}
