import type { FFIFunction, PlatformBackend, Pointer } from "./types";

export interface PlatformPrimitives {
  createCallbackImpl: (
    // biome-ignore lint/suspicious/noExplicitAny: native callback function signature
    fn: (...args: any[]) => any,
    args: unknown[],
    returns: unknown
  ) => { ptr: Pointer<void>; close(): void };
  dlopen: (
    path: string,
    defs: unknown
    // biome-ignore lint/suspicious/noExplicitAny: native library symbols accept any args
  ) => { symbols: Record<string, (...args: any[]) => any>; close(): void };
  ptr: (view: ArrayBufferView) => Pointer<void>;
  resolveURL: (url: string) => string;
  toArrayBuffer: (
    ptr: Pointer<void>,
    offset: number,
    length: number
  ) => ArrayBuffer;
  toPointer: <T>(value: number | bigint) => Pointer<T>;
  typeMap: Record<string, unknown>;
}

export function createBackend(p: PlatformPrimitives): PlatformBackend {
  return {
    isAvailable: true,
    ptr: p.ptr,
    toArrayBuffer: p.toArrayBuffer,
    toPointer: p.toPointer,
    resolveURL: p.resolveURL,
    loadLibrary(path, definitions) {
      const nativeDefs: Record<string, unknown> = {};
      for (const [name, def] of Object.entries(definitions)) {
        nativeDefs[name] = {
          args: def.args.map((t: FFIFunction["args"][number]) => p.typeMap[t]),
          returns: p.typeMap[def.returns],
        };
      }
      const lib = p.dlopen(path, nativeDefs);
      return {
        symbols: lib.symbols,
        createCallback(fn, options) {
          return p.createCallbackImpl(
            fn,
            options.args.map((t: FFIFunction["args"][number]) => p.typeMap[t]),
            p.typeMap[options.returns]
          );
        },
        close() {
          lib.close();
        },
      };
    },
  };
}
