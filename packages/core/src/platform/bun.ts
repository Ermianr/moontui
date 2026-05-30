import {
  FFIType as BunFFIType,
  ptr as bunPtr,
  dlopen,
  toArrayBuffer as ffiToArrayBuffer,
  JSCallback,
  // biome-ignore lint/correctness/noUnresolvedImports: bun:ffi is a Bun runtime built-in
} from "bun:ffi";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBackend } from "./shared";
import type { PlatformBackend, Pointer } from "./types";

export function createBunBackend(): PlatformBackend {
  return createBackend({
    typeMap: {
      i8: BunFFIType.i8,
      u8: BunFFIType.u8,
      i16: BunFFIType.i16,
      u16: BunFFIType.u16,
      i32: BunFFIType.i32,
      u32: BunFFIType.u32,
      i64: BunFFIType.i64,
      u64: BunFFIType.u64,
      f32: BunFFIType.f32,
      f64: BunFFIType.f64,
      bool: BunFFIType.bool,
      ptr: BunFFIType.ptr,
      void: BunFFIType.void,
      cstring: BunFFIType.cstring,
      usize: BunFFIType.u64,
    },
    ptr(view) {
      // biome-ignore lint/suspicious/noExplicitAny: bun:ffi ptr accepts typed arrays
      return bunPtr(view as any) as unknown as Pointer<void>;
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
          `moontui native package is unavailable for Bun on ${platform}-${arch}`
        );
      }
    },
    toArrayBuffer(ptr, offset, length) {
      // biome-ignore lint/suspicious/noExplicitAny: bun:ffi toArrayBuffer accepts raw pointer number
      return ffiToArrayBuffer(ptr as unknown as number as any, offset, length);
    },
    // Bun FFI represents pointers as `number` (not `bigint`), so we convert
    // bigint values to numbers. The safe integer check guards against precision
    // loss: 64-bit systems use only 48 bits for virtual addresses (ASLR limits),
    // well within Number.MAX_SAFE_INTEGER (2^53 - 1), so this is safe in practice.
    toPointer(value) {
      if (typeof value === "bigint") {
        const num = Number(value);
        if (!Number.isSafeInteger(num)) {
          throw new Error(
            `Pointer value ${value} exceeds safe integer range for Bun runtime`
          );
        }
        return num as unknown as Pointer<never>;
      }
      return value as unknown as Pointer<never>;
    },
    resolveURL(url) {
      return fileURLToPath(new URL(url));
    },
    dlopen(path, defs) {
      // biome-ignore lint/suspicious/noExplicitAny: bun:ffi dlopen requires any cast
      return dlopen(path, defs as any);
    },
    createCallbackImpl(fn, args, returns) {
      const cb = new JSCallback(fn, {
        // biome-ignore lint/suspicious/noExplicitAny: bun:ffi JSCallback accepts any FFI types
        args: args as any,
        // biome-ignore lint/suspicious/noExplicitAny: bun:ffi JSCallback accepts any FFI types
        returns: returns as any,
      });
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
