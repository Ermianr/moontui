#!/usr/bin/env bun
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");
const coreDir = join(rootDir, "packages", "core");
const distDir = join(coreDir, "dist");

interface PackageJson {
  name: string;
  version: string;
}

async function getSourcePackageJson(): Promise<PackageJson> {
  const pkgPath = join(coreDir, "package.json");
  return JSON.parse(await Bun.file(pkgPath).text());
}

async function getDistPackageJson(): Promise<PackageJson> {
  const pkgPath = join(distDir, "package.json");
  return JSON.parse(await Bun.file(pkgPath).text());
}

function exit(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

// 1. Verify dist/ exists
if (!existsSync(distDir)) {
  exit("dist directory not found. Please run 'bun run build' first.");
}

// 2. Verify npm auth via HTTP request
const npmToken = process.env.NPM_TOKEN;
if (npmToken) {
  const whoamiRes = await fetch("https://registry.npmjs.org/-/whoami", {
    headers: { Authorization: `Bearer ${npmToken}` },
  });
  if (!whoamiRes.ok) {
    exit("npm authentication failed. Please verify your NPM_TOKEN.");
  }
} else {
  exit("NPM_TOKEN environment variable is not set.");
}

// 3. Verify source/dist version match
const sourcePkg = await getSourcePackageJson();
const distPkg = await getDistPackageJson();

if (sourcePkg.version !== distPkg.version) {
  exit(
    `Version mismatch: source package.json (${sourcePkg.version}) vs dist/package.json (${distPkg.version}).`
  );
}

// 4. Verify version is not already published
const registryRes = await fetch(
  `https://registry.npmjs.org/${sourcePkg.name}/${sourcePkg.version}`
);
if (registryRes.ok) {
  exit(`Version ${sourcePkg.version} already exists on the npm registry.`);
}

// 5. Verify platform package versions match
const platformPackagesDir = join(coreDir, "node_modules", "@moontui");
if (existsSync(platformPackagesDir)) {
  const entries = readdirSync(platformPackagesDir);
  for (const entry of entries) {
    if (!entry.startsWith("core-")) {
      continue;
    }
    const pkgPath = join(platformPackagesDir, entry, "package.json");
    if (!existsSync(pkgPath)) {
      continue;
    }

    const platformPkg = JSON.parse(await Bun.file(pkgPath).text());
    if (platformPkg.version !== sourcePkg.version) {
      exit(
        `Version mismatch: platform package ${platformPkg.name} (${platformPkg.version}) vs source (${sourcePkg.version}).`
      );
    }
  }
}

console.log("Pre-publish validation passed.");
