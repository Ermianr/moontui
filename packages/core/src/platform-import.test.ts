import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const STATIC_BUN_FFI_IMPORT_RE = /from\s+["']bun:ffi["']/;

test("platform facade does not statically resolve Bun FFI", async () => {
  const source = await readFile(
    join(import.meta.dir, "platform", "index.ts"),
    "utf8"
  );

  expect(source).not.toContain('from "./bun"');
  expect(source).not.toMatch(STATIC_BUN_FFI_IMPORT_RE);
});

test("platform facade does not use global require for backend loading", async () => {
  const source = await readFile(
    join(import.meta.dir, "platform", "index.ts"),
    "utf8"
  );

  expect(source).not.toContain("globalThis as any).require");
  expect(source).not.toContain("globalThis.require");
});
