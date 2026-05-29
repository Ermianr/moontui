#!/usr/bin/env bun
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const coreDir = join(import.meta.dir, "..");
const distDir = join(coreDir, "dist");
const platformPackagesDir = join(coreDir, "node_modules", "@moontui");

const args = process.argv.slice(2);
const tag = args.includes("--tag")
  ? args[args.indexOf("--tag") + 1]
  : undefined;

const SNAPSHOT_VERSION_RE = /^\d+\.\d+\.\d+-/;

function getTag(version: string): string {
  if (tag) {
    return tag;
  }
  if (version.includes("-snapshot") || SNAPSHOT_VERSION_RE.test(version)) {
    return "snapshot";
  }
  return "latest";
}

interface PackageJson {
  name: string;
  version: string;
}

async function getDistPackageJson(): Promise<PackageJson> {
  const pkgPath = join(distDir, "package.json");
  return JSON.parse(await Bun.file(pkgPath).text());
}

if (!existsSync(distDir)) {
  console.error(
    "dist/ directory not found. Please run 'bun run build -- --all && bun run build -- --lib' first."
  );
  process.exit(1);
}

const distPkg = await getDistPackageJson();
const publishTag = getTag(distPkg.version);
const tagArg = publishTag === "latest" ? "" : ` --tag ${publishTag}`;

// Publish platform packages first
if (existsSync(platformPackagesDir)) {
  const entries = readdirSync(platformPackagesDir);
  for (const entry of entries) {
    if (!entry.startsWith("core-")) {
      continue;
    }
    const pkgDir = join(platformPackagesDir, entry);
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) {
      continue;
    }

    console.log(`Publishing ${entry}...`);
    const result = Bun.spawnSync(
      `bun publish --access=public${tagArg}`.split(" "),
      {
        cwd: pkgDir,
        stdout: "inherit",
        stderr: "inherit",
      }
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `bun publish failed for ${entry} with exit code ${result.exitCode}`
      );
    }
  }
}

// Publish main package
console.log(`Publishing ${distPkg.name}...`);
const publishResult = Bun.spawnSync(
  `bun publish --access=public${tagArg}`.split(" "),
  {
    cwd: distDir,
    stdout: "inherit",
    stderr: "inherit",
  }
);
if (publishResult.exitCode !== 0) {
  throw new Error(
    `bun publish failed with exit code ${publishResult.exitCode}`
  );
}

console.log("Publish complete!");
