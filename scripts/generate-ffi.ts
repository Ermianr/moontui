import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface SchemaParam {
  name: string;
  role: string;
  type: string;
}

interface SchemaFunction {
  ffi_name: string;
  manual?: boolean;
  params: SchemaParam[];
  receiver: string | null;
  returns: string;
  ts_args?: string;
  ts_body?: string;
  ts_returns?: string;
}

interface Schema {
  functions: Record<string, SchemaFunction>;
}

const FFI_TYPE_MAP: Record<string, string> = {
  void: "FFIType.void",
  bool: "FFIType.bool",
  u8: "FFIType.u8",
  i8: "FFIType.i8",
  u16: "FFIType.u16",
  i16: "FFIType.i16",
  u32: "FFIType.u32",
  i32: "FFIType.i32",
  u64: "FFIType.u64",
  i64: "FFIType.i64",
  f32: "FFIType.f32",
  f64: "FFIType.f64",
  ptr: "FFIType.ptr",
};

const TS_TYPE_MAP: Record<string, string> = {
  void: "void",
  bool: "boolean",
  u8: "number",
  i8: "number",
  u16: "number",
  i16: "number",
  u32: "number",
  i32: "number",
  u64: "number",
  i64: "number",
  f32: "number",
  f64: "number",
  ptr: "Pointer<void>",
};

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function resolveFfiType(type: string, context: string): string {
  const mapped = FFI_TYPE_MAP[type];
  if (!mapped) {
    throw new Error(`Unknown FFI type "${type}" in ${context}`);
  }
  return mapped;
}

function resolveTsType(type: string, context: string): string {
  const mapped = TS_TYPE_MAP[type];
  if (!mapped) {
    throw new Error(`Unknown TS type "${type}" in ${context}`);
  }
  return mapped;
}

interface CallbackDescriptor {
  ffiArgs: string[];
  handlerBody: string;
  handlerParams: string;
  typeGuard: string;
  typeScriptHandlerType: string;
}

function emitCallbackFactory(desc: CallbackDescriptor, indent: string): string {
  let content = "";
  content += `${indent}  handler: ${desc.typeScriptHandlerType}\n`;
  content += `${indent}): import("./platform/types").FFICallbackInstance {\n`;
  content += `${indent}  return lib.createCallback(\n`;
  content += `${indent}    (${desc.handlerParams}) => {\n`;
  for (const line of desc.handlerBody.split("\n")) {
    content += `${indent}      ${line}\n`;
  }
  content += `${indent}    },\n`;
  content += `${indent}    { args: [${desc.ffiArgs.join(", ")}], returns: FFIType.void }\n`;
  content += `${indent}  )\n`;
  content += `${indent}},\n`;
  return content;
}

const EVENT_CALLBACK_DESCRIPTOR: CallbackDescriptor = {
  ffiArgs: [
    "FFIType.ptr",
    "FFIType.u64",
    "FFIType.ptr",
    "FFIType.u64",
    "FFIType.bool",
    "FFIType.bool",
    "FFIType.bool",
  ],
  handlerParams:
    "typePtr: number, typeLen: bigint, keyPtr: number, keyLen: bigint,\n" +
    "          ctrl: boolean, shift: boolean, alt: boolean",
  handlerBody:
    "const tLen = Number(typeLen)\n" +
    "const kLen = Number(keyLen)\n" +
    "if (!typePtr || tLen === 0 || !keyPtr || kLen === 0) { return }\n" +
    "const type = decodeStringPointer(typePtr, tLen)\n" +
    "const key = decodeStringPointer(keyPtr, kLen)\n" +
    'if (type !== "key") { return }\n' +
    "queueMicrotask(() => { handler({ key, ctrl, shift, alt }) })",
  typeGuard: "type",
  typeScriptHandlerType:
    "(event: { key: string; ctrl: boolean; shift: boolean; alt: boolean }) => void",
};

const RESIZE_CALLBACK_DESCRIPTOR: CallbackDescriptor = {
  ffiArgs: ["FFIType.u32", "FFIType.u32"],
  handlerParams: "width: number, height: number",
  handlerBody: "queueMicrotask(() => { handler({ width, height }) })",
  typeGuard: "",
  typeScriptHandlerType: "(event: { width: number; height: number }) => void",
};

const MOUSE_CALLBACK_DESCRIPTOR: CallbackDescriptor = {
  ffiArgs: [
    "FFIType.ptr",
    "FFIType.u64",
    "FFIType.ptr",
    "FFIType.u64",
    "FFIType.u32",
    "FFIType.u32",
    "FFIType.u32",
    "FFIType.bool",
    "FFIType.bool",
    "FFIType.bool",
    "FFIType.u32",
  ],
  handlerParams:
    "typePtr: number, typeLen: bigint, kindPtr: number, kindLen: bigint,\n" +
    "         button: number, x: number, y: number, ctrl: boolean, shift: boolean, alt: boolean, scrollDir: number",
  handlerBody:
    "const tLen = Number(typeLen)\n" +
    "const kLen = Number(kindLen)\n" +
    "if (!typePtr || tLen === 0 || !kindPtr || kLen === 0) { return }\n" +
    "const type = decodeStringPointer(typePtr, tLen)\n" +
    "const kind = decodeStringPointer(kindPtr, kLen)\n" +
    'if (type !== "mouse") { return }\n' +
    "queueMicrotask(() => { handler({ kind, button, x, y, ctrl, shift, alt, scrollDir }) })",
  typeGuard: "type",
  typeScriptHandlerType:
    "(event: { kind: string; button: number; x: number; y: number; ctrl: boolean; shift: boolean; alt: boolean; scrollDir: number }) => void",
};

function main(): void {
  const schemaPath = join(
    import.meta.dirname,
    "..",
    "target",
    "moontui-schema.json"
  );
  if (!existsSync(schemaPath)) {
    console.error("Schema file not found. Run `cargo build` first.");
    process.exit(1);
  }
  const schema: Schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  generateFfiTs(schema);
  try {
    execSync("bun run fix --unsafe", {
      cwd: join(import.meta.dirname, ".."),
      stdio: "pipe",
    });
  } catch {
    // Ignore formatter errors
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: build script complexity is acceptable
function generateFfiTs(schema: Schema): void {
  const functions = Object.entries(schema.functions);
  const manualFns = functions.filter(([, fn]) => fn.manual);
  const generatedFns = functions.filter(([, fn]) => !fn.manual);

  const groups = new Map<string, [string, SchemaFunction][]>();
  for (const [name, fn] of generatedFns) {
    const key = fn.receiver ?? "Static";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push([name, fn]);
  }

  let ffiContent = `// AUTO-GENERATED by scripts/generate-ffi.ts — DO NOT EDIT
// Source: target/moontui-schema.json

import { dirname, join } from "node:path"
import { backend, FFIType, ffiBool, type Pointer } from "./platform/index"
import { type RGBAInput, toRGBA } from "./rgba"

export type { Pointer } from "./platform/index"

function getLibraryName(): string {
  const platform = process.platform
  switch (platform) {
    case "win32": return "moontui_core.dll"
    case "darwin": return "libmoontui_core.dylib"
    case "linux": return "libmoontui_core.so"
    default: throw new Error(\`Unsupported platform: \${platform}\`)
  }
}

function resolveLibPath(): string {
  const platform = process.platform
  const arch = process.arch
  const packageName = \`@moontui/core-\${platform}-\${arch}\`
  try {
    const resolved = import.meta.resolve(\`\${packageName}/index.js\`)
    const dir = dirname(backend.resolveURL(resolved))
    return join(dir, getLibraryName())
  } catch {
    throw new Error(
      \`moontui is not supported on the current platform: \${platform}-\${arch}. \` +
        "Please ensure you are using a supported platform (Darwin x64/arm64, Linux x64/arm64, Windows x64)."
    )
  }
}

const libPath = resolveLibPath()

// biome-ignore lint/complexity/noBannedTypes: opaque handle type for FFI branding
export type Renderer = {}
// biome-ignore lint/complexity/noBannedTypes: opaque handle type for FFI branding
export type Buffer = {}

function toPointer<T>(value: number | bigint): Pointer<T> {
  return backend.toPointer<T>(value)
}

function normalizeU64(value: number | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value)
}

const lib = backend.loadLibrary(libPath, {
`;

  // Add manual FFI function lib definitions from schema
  ffiContent += "  // --- Manual FFI functions (/// @ffi_manual) ---\n";
  for (const [, fn] of manualFns) {
    const args = fn.params.map((p) =>
      resolveFfiType(p.type, `${fn.ffi_name}:${p.name}`)
    );
    const returns = resolveFfiType(fn.returns, `${fn.ffi_name}:returns`);
    ffiContent += `  ${fn.ffi_name}: { args: [${args.join(", ")}], returns: ${returns} },\n`;
  }

  for (const [receiver, fns] of groups) {
    ffiContent += `  // --- ${receiver} ---\n`;
    for (const [, fn] of fns) {
      const args = fn.params.map((p) =>
        resolveFfiType(p.type, `${fn.ffi_name}:${p.name}`)
      );
      const returns = resolveFfiType(fn.returns, `${fn.ffi_name}:returns`);
      ffiContent += `  ${fn.ffi_name}: { args: [${args.join(", ")}], returns: ${returns} },\n`;
    }
    ffiContent += "\n";
  }

  ffiContent += `})

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function decodeStringPointer(ptr: number, len: number): string {
  return textDecoder.decode(backend.toArrayBuffer(backend.toPointer<void>(ptr), 0, len))
}

function rgbaPtr(color: RGBAInput): Pointer<void> {
  const rgba = toRGBA(color)
  return backend.ptr(rgba.buffer)
}

// Categorize functions into sub-groups
`;

  // Build sub-groups
  const bufferFns: SchemaFunction[] = [];
  const rendererFns: SchemaFunction[] = [];
  const terminalFns: SchemaFunction[] = [];

  for (const [receiver, fns] of groups) {
    for (const [, fn] of fns) {
      if (receiver === "OptimizedBuffer") {
        bufferFns.push(fn);
      } else if (receiver === "CliRenderer") {
        rendererFns.push(fn);
      }
    }
  }

  for (const [, fn] of manualFns) {
    if (fn.ffi_name.startsWith("buffer")) {
      bufferFns.push(fn);
    } else if (
      fn.ffi_name === "setupTerminal" ||
      fn.ffi_name === "restoreTerminal" ||
      fn.ffi_name === "getTerminalSize"
    ) {
      terminalFns.push(fn);
    } else {
      rendererFns.push(fn);
    }
  }

  ffiContent += "export const api = {\n";
  ffiContent += "  buffer: {\n";
  ffiContent += generateApiFunctions(bufferFns, "    ");
  ffiContent += "  },\n";
  ffiContent += "  renderer: {\n";
  ffiContent += generateApiFunctions(rendererFns, "    ");
  ffiContent += "  },\n";
  ffiContent += "  terminal: {\n";
  ffiContent += generateApiFunctions(terminalFns, "    ");
  ffiContent += "  },\n";
  ffiContent += "  events: {\n";
  ffiContent += "    setEventCallback(\n";
  ffiContent += "      p: Pointer<Renderer>,\n";
  ffiContent += "      callbackPtr: Pointer<void> | 0\n";
  ffiContent += "    ): void {\n";
  ffiContent += "      lib.symbols.setEventCallback(p, callbackPtr)\n";
  ffiContent += "    },\n";
  ffiContent += "    setResizeCallback(\n";
  ffiContent += "      p: Pointer<Renderer>,\n";
  ffiContent += "      callbackPtr: Pointer<void> | 0\n";
  ffiContent += "    ): void {\n";
  ffiContent += "      lib.symbols.setResizeCallback(p, callbackPtr)\n";
  ffiContent += "    },\n";
  ffiContent += "    createEventCallback(\n";
  ffiContent += emitCallbackFactory(EVENT_CALLBACK_DESCRIPTOR, "    ");
  ffiContent += "    createResizeCallback(\n";
  ffiContent += emitCallbackFactory(RESIZE_CALLBACK_DESCRIPTOR, "    ");
  ffiContent += "    createMouseCallback(\n";
  ffiContent += emitCallbackFactory(MOUSE_CALLBACK_DESCRIPTOR, "    ");
  ffiContent += "    setMouseCallback(\n";
  ffiContent += "      p: Pointer<Renderer>,\n";
  ffiContent += "      callbackPtr: Pointer<void> | 0\n";
  ffiContent += "    ): void {\n";
  ffiContent += "      lib.symbols.setMouseCallback(p, callbackPtr)\n";
  ffiContent += "    },\n";
  ffiContent += "  },\n";
  ffiContent += "}\n\n";
  ffiContent +=
    "// biome-ignore lint/suspicious/noExplicitAny: converts bun:ffi Pointer to branded Pointer<T>\n";
  ffiContent += "export function asPtr<T>(p: any): Pointer<T> {\n";
  ffiContent += "  return p as unknown as Pointer<T>\n";
  ffiContent += "}\n";

  const outputPath = join(
    import.meta.dirname,
    "..",
    "packages",
    "core",
    "src",
    "ffi.ts"
  );
  writeFileSync(outputPath, ffiContent, "utf8");
  console.log(`Generated ${outputPath}`);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: build script complexity is acceptable
function generateApiFunctions(fns: SchemaFunction[], indent: string): string {
  let content = "";
  for (const fn of fns) {
    if (fn.manual && fn.ts_body) {
      const tsArgs = fn.ts_args ?? "";
      const tsReturns = fn.ts_returns ?? "void";
      content += `${indent}${fn.ffi_name}(${tsArgs}): ${tsReturns} {\n`;
      const body = fn.ts_body.replace(/\\n/g, "\n");
      for (const line of body.split("\n")) {
        content += `${indent}  ${line}\n`;
      }
      content += `${indent}},\n`;
    } else {
      const nonSelfParams = fn.params.filter((p) => p.role !== "self");
      const paramList = nonSelfParams.map((p) => {
        const paramName = snakeToCamel(p.name);
        const paramType = resolveTsType(p.type, `${fn.ffi_name}:${p.name}`);
        return `${paramName}: ${paramType}`;
      });
      const returnType = resolveTsType(fn.returns, `${fn.ffi_name}:returns`);
      if (fn.receiver !== null) {
        const typeName =
          fn.receiver === "OptimizedBuffer" ? "Buffer" : "Renderer";
        paramList.unshift(`p: Pointer<${typeName}>`);
      }
      const callArgs = fn.params.map((p) => {
        if (p.role === "self") {
          return "p";
        }
        if (p.type === "bool") {
          return `ffiBool(${snakeToCamel(p.name)})`;
        }
        return snakeToCamel(p.name);
      });
      content += `${indent}${fn.ffi_name}(${paramList.join(", ")}): ${returnType} {\n`;
      if (fn.returns === "ptr") {
        content += `${indent}  return toPointer(lib.symbols.${fn.ffi_name}(${callArgs.join(", ")}))\n`;
      } else if (fn.returns === "void") {
        content += `${indent}  lib.symbols.${fn.ffi_name}(${callArgs.join(", ")});\n`;
      } else {
        content += `${indent}  return lib.symbols.${fn.ffi_name}(${callArgs.join(", ")})\n`;
      }
      content += `${indent}},\n`;
    }
  }
  return content;
}

main();
