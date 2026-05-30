#!/usr/bin/env bun
import { rm } from "node:fs/promises";
import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");

await Promise.all(
  [
    "target",
    join("packages", "core", "dist"),
    join("packages", "core", "native"),
  ].map((path) => rm(join(rootDir, path), { force: true, recursive: true }))
);
