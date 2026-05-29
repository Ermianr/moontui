/**
 * Portable FFI type definitions for cross-runtime support.
 *
 * This module defines string-based FFI type constants that all backends
 * (Bun, Node.js, Deno) map to their native representations at load time.
 * This avoids importing runtime-specific FFIType enums in shared code.
 */

export declare const pointerBrand: unique symbol;

export type Pointer<T = void> = (number | bigint) & {
  readonly [pointerBrand]: T;
};

export type FFITypeString =
  | "i8"
  | "u8"
  | "i16"
  | "u16"
  | "i32"
  | "u32"
  | "i64"
  | "u64"
  | "f32"
  | "f64"
  | "bool"
  | "ptr"
  | "void"
  | "cstring"
  | "usize";

export const FFIType = {
  i8: "i8" as const,
  u8: "u8" as const,
  i16: "i16" as const,
  u16: "u16" as const,
  i32: "i32" as const,
  u32: "u32" as const,
  i64: "i64" as const,
  u64: "u64" as const,
  f32: "f32" as const,
  f64: "f64" as const,
  bool: "bool" as const,
  ptr: "ptr" as const,
  void: "void" as const,
  cstring: "cstring" as const,
  usize: "usize" as const,
} satisfies Record<string, FFITypeString>;

export interface FFIFunction {
  args: FFITypeString[];
  returns: FFITypeString;
}

export interface FFICallbackInstance {
  close(): void;
  ptr: Pointer<void>;
}

export interface LoadedLibrary {
  close(): void;
  createCallback(
    // biome-ignore lint/suspicious/noExplicitAny: native callback function signature
    fn: (...args: any[]) => any,
    options: { args: FFITypeString[]; returns: FFITypeString }
  ): FFICallbackInstance;
  // biome-ignore lint/suspicious/noExplicitAny: native library symbols accept any args
  symbols: Record<string, (...args: any[]) => any>;
}

export interface PlatformBackend {
  isAvailable: boolean;
  loadLibrary(
    path: string,
    definitions: Record<string, FFIFunction>
  ): LoadedLibrary;
  ptr(view: ArrayBufferView): Pointer<void>;
  resolveURL(url: string): string;
  toArrayBuffer(
    ptr: Pointer<void>,
    offset: number,
    length: number
  ): ArrayBuffer;
  toPointer<T>(value: number | bigint): Pointer<T>;
}
