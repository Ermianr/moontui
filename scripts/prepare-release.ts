#!/usr/bin/env bun
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");

function findPackageJsonFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (
        entry === "node_modules" ||
        entry === "target" ||
        entry === "dist" ||
        entry === ".git"
      ) {
        continue;
      }
      results.push(...findPackageJsonFiles(fullPath));
    } else if (entry === "package.json") {
      results.push(fullPath);
    }
  }

  return results;
}

function bumpVersion(version: string, type: string): string {
  const parts = version.split("-");
  const mainParts = parts[0].split(".").map(Number);

  if (type === "patch") {
    mainParts[2]++;
  } else if (type === "minor") {
    mainParts[1]++;
    mainParts[2] = 0;
  } else if (type === "major") {
    mainParts[0]++;
    mainParts[1] = 0;
    mainParts[2] = 0;
  } else {
    throw new Error(
      `Unknown bump type: ${type}. Use --patch, --minor, or --major.`
    );
  }

  const newMain = mainParts.join(".");
  return parts.length > 1 ? `${newMain}-${parts.slice(1).join("-")}` : newMain;
}

const args = process.argv.slice(2);
const bumpType =
  args.find((a) => a.startsWith("--"))?.replace("--", "") || "patch";

const allPackageJsonFiles = findPackageJsonFiles(rootDir);

const resolvedFiles: string[] = [];
for (const path of allPackageJsonFiles) {
  const pkg = JSON.parse(await Bun.file(path).text());
  if (pkg.name?.startsWith("@moontui/")) {
    resolvedFiles.push(path);
  }
}

if (resolvedFiles.length === 0) {
  console.error("No @moontui/ packages found.");
  process.exit(1);
}

let newVersion: string | null = null;

for (const path of resolvedFiles) {
  const pkg = JSON.parse(await Bun.file(path).text());
  const currentVersion = pkg.version;
  newVersion = newVersion || bumpVersion(currentVersion, bumpType);

  pkg.version = newVersion;

  if (pkg.name === "@moontui/core" && pkg.optionalDependencies) {
    for (const dep of Object.keys(pkg.optionalDependencies)) {
      if (dep.startsWith("@moontui/core-")) {
        pkg.optionalDependencies[dep] = newVersion;
      }
    }
  }

  await Bun.write(path, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Bumped ${pkg.name}: ${currentVersion} -> ${newVersion}`);
}

console.log(`\nAll packages bumped to ${newVersion}.`);
