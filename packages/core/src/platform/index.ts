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

import { createBunBackend } from "./bun";
import type {
  FFIFunction,
  LoadedLibrary,
  PlatformBackend,
  Pointer,
} from "./types";

let _backend: PlatformBackend | null = null;

function initBackend(): PlatformBackend {
  if (typeof process !== "undefined" && process.versions?.bun) {
    return createBunBackend();
  }

  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: require may not be available in all environments
      const { createNodeBackend } = (globalThis as any).require("./node");
      return createNodeBackend();
    } catch {
      // fall through
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Deno global may not be typed
  if (typeof (globalThis as any).Deno !== "undefined") {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: require may not be available in all environments
      const { createDenoBackend } = (globalThis as any).require("./deno");
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

function getBackend(): PlatformBackend {
  if (!_backend) {
    _backend = initBackend();
  }
  return _backend;
}

export const backend = {
  get isAvailable(): boolean {
    return getBackend().isAvailable;
  },
  ptr(view: ArrayBufferView): Pointer<void> {
    return getBackend().ptr(view);
  },
  toArrayBuffer(
    ptr: Pointer<void>,
    offset: number,
    length: number
  ): ArrayBuffer {
    return getBackend().toArrayBuffer(ptr, offset, length);
  },
  toPointer<T>(value: number | bigint): Pointer<T> {
    return getBackend().toPointer<T>(value);
  },
  loadLibrary(
    path: string,
    definitions: Record<string, FFIFunction>
  ): LoadedLibrary {
    return getBackend().loadLibrary(path, definitions);
  },
  resolveURL(url: string): string {
    return getBackend().resolveURL(url);
  },
};

export function ptr(view: ArrayBufferView): Pointer<void> {
  return getBackend().ptr(view);
}

export function ffiBool(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export {
  type FFICallbackInstance,
  type FFIFunction,
  FFIType,
  type LoadedLibrary,
  type PlatformBackend,
  type Pointer,
} from "./types";
