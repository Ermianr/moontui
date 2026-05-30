/**
 * Platform facade entry point.
 *
 * Detects the active JavaScript runtime at module load time and selects
 * the appropriate FFI backend (Bun, Node.js, or Deno). All FFI operations
 * in library code should import from this module instead of runtime-specific
 * modules like `bun:ffi` or `node:ffi`.
 *
 * Usage:
 *   import { backend, FFIType } from "./platform/index";
 *   const lib = backend.loadLibrary(path, definitions);
 */

import type {
  FFIFunction,
  LoadedLibrary,
  PlatformBackend,
  Pointer,
} from "./types";

async function initBackend(): Promise<PlatformBackend> {
  if (typeof process !== "undefined" && process.versions?.bun) {
    const { createBunBackend } = await import("./bun");
    return createBunBackend();
  }

  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const nodeFfiSpecifier = "node:ffi";
      const [{ createNodeBackend }, nodeFfi] = await Promise.all([
        import("./node"),
        import(nodeFfiSpecifier),
      ]);
      return createNodeBackend(nodeFfi);
    } catch {
      // fall through
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Deno global may not be typed
  if (typeof (globalThis as any).Deno !== "undefined") {
    try {
      const { createDenoBackend } = await import("./deno");
      return createDenoBackend();
    } catch {
      // fall through
    }
  }

  throw new Error(
    "Unsupported runtime: no FFI backend available. " +
      "Supported runtimes: Bun, Node.js v26+ (experimental), Deno (experimental)."
  );
}

const activeBackend = await initBackend();

export const backend = {
  get isAvailable(): boolean {
    return activeBackend.isAvailable;
  },
  ptr(view: ArrayBufferView): Pointer<void> {
    return activeBackend.ptr(view);
  },
  toArrayBuffer(
    ptr: Pointer<void>,
    offset: number,
    length: number
  ): ArrayBuffer {
    return activeBackend.toArrayBuffer(ptr, offset, length);
  },
  toPointer<T>(value: number | bigint): Pointer<T> {
    return activeBackend.toPointer<T>(value);
  },
  loadLibrary(
    path: string,
    definitions: Record<string, FFIFunction>
  ): LoadedLibrary {
    return activeBackend.loadLibrary(path, definitions);
  },
  resolveLibraryPath(): string {
    return activeBackend.resolveLibraryPath();
  },
  resolveURL(url: string): string {
    return activeBackend.resolveURL(url);
  },
};

export function ptr(view: ArrayBufferView): Pointer<void> {
  return activeBackend.ptr(view);
}

export function ffiBool(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export {
  type FFICallbackInstance,
  type FFIFunction,
  FFIType,
  type LoadedLibrary,
  type MutablePointer,
  type PlatformBackend,
  type Pointer,
  type ReadonlyPointer,
} from "./types";
