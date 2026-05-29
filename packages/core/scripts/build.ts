#!/usr/bin/env bun
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const rootDir = join(import.meta.dir, "..", "..", "..");
const coreDir = join(rootDir, "packages", "core");
const nativeDir = join(coreDir, "native");

interface Platform {
  binaryName: string;
  cargoTarget: string;
  cpu: string;
  name: string;
  os: string;
  sourceName: string;
}

const PLATFORMS: Platform[] = [
  {
    name: "darwin-x64",
    os: "darwin",
    cpu: "x64",
    cargoTarget: "x86_64-apple-darwin",
    binaryName: "libmoontui_core.dylib",
    sourceName: "libmoontui_core.dylib",
  },
  {
    name: "darwin-arm64",
    os: "darwin",
    cpu: "arm64",
    cargoTarget: "aarch64-apple-darwin",
    binaryName: "libmoontui_core.dylib",
    sourceName: "libmoontui_core.dylib",
  },
  {
    name: "linux-x64",
    os: "linux",
    cpu: "x64",
    cargoTarget: "x86_64-unknown-linux-gnu",
    binaryName: "libmoontui_core.so",
    sourceName: "libmoontui_core.so",
  },
  {
    name: "linux-arm64",
    os: "linux",
    cpu: "arm64",
    cargoTarget: "aarch64-unknown-linux-gnu",
    binaryName: "libmoontui_core.so",
    sourceName: "libmoontui_core.so",
  },
  {
    name: "win32-x64",
    os: "win32",
    cpu: "x64",
    cargoTarget: "x86_64-pc-windows-msvc",
    binaryName: "moontui_core.dll",
    sourceName: "moontui_core.dll",
  },
];

const args = process.argv.slice(2);
const buildNative = args.includes("--native");
const buildLib = args.includes("--lib");
const buildDev = args.includes("--dev");
const buildAll = args.includes("--all");

if (!(buildNative || buildLib || buildAll)) {
  console.error("Usage: bun run build -- [--native] [--lib] [--dev] [--all]");
  process.exit(1);
}

const profile = buildDev ? "debug" : "release";
const cargoProfileFlag = buildDev ? "" : "--release";

interface PackageJson {
  description: string;
  engines: Record<string, string>;
  license: string;
  name: string;
  version: string;
}

async function getSourcePackageJson(): Promise<PackageJson> {
  const pkgPath = join(coreDir, "package.json");
  return JSON.parse(await Bun.file(pkgPath).text());
}

async function getVersion(): Promise<string> {
  return (await getSourcePackageJson()).version;
}

function buildCargoForHost(): void {
  console.log(
    `Building moontui-core for host (${process.platform}-${process.arch})...`
  );
  const cargoArgs = ["cargo", "build", "-p", "moontui-core"];
  if (cargoProfileFlag) {
    cargoArgs.push(cargoProfileFlag);
  }
  const result = Bun.spawnSync(cargoArgs, {
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(`cargo build failed with exit code ${result.exitCode}`);
  }
}

function getArtifactPath(): string {
  const hostPlatform = findHostPlatform();
  if (!hostPlatform) {
    throw new Error(
      `Unsupported host platform: ${process.platform}-${process.arch}`
    );
  }
  return join(rootDir, "target", profile, hostPlatform.binaryName);
}

async function copyArtifactToNative(): Promise<void> {
  if (!existsSync(nativeDir)) {
    mkdirSync(nativeDir, { recursive: true });
  }

  const srcPath = getArtifactPath();
  const hostPlatform = findHostPlatform();
  if (!hostPlatform) {
    throw new Error(
      `Unsupported host platform: ${process.platform}-${process.arch}`
    );
  }
  const dstPath = join(nativeDir, hostPlatform.binaryName);

  if (!existsSync(srcPath)) {
    throw new Error(`Build artifact not found: ${srcPath}`);
  }

  await Bun.write(dstPath, Bun.file(srcPath));
  console.log(`Copied ${srcPath} -> ${dstPath}`);
}

function findHostPlatform(): Platform | undefined {
  return PLATFORMS.find(
    (p) => p.os === process.platform && p.cpu === process.arch
  );
}

async function generatePlatformPackage(
  platform: Platform,
  binarySrcPath: string
): Promise<void> {
  const pkgDir = join(
    coreDir,
    "node_modules",
    "@moontui",
    `core-${platform.name}`
  );
  if (!existsSync(pkgDir)) {
    mkdirSync(pkgDir, { recursive: true });
  }

  const binaryDstPath = join(pkgDir, platform.binaryName);
  await Bun.write(binaryDstPath, Bun.file(binarySrcPath));

  const pkgJson = {
    name: `@moontui/core-${platform.name}`,
    version: await getVersion(),
    description: `Native binary for MoonTUI on ${platform.os} ${platform.cpu}`,
    os: [platform.os],
    cpu: [platform.cpu],
    main: "index.js",
    types: "index.d.ts",
    files: [platform.binaryName, "index.js", "index.d.ts"],
    license: "MIT",
  };

  await Bun.write(
    join(pkgDir, "package.json"),
    `${JSON.stringify(pkgJson, null, 2)}\n`
  );

  const indexJs = `import { join } from "path";

export default join(import.meta.dir, "${platform.binaryName}");
`;

  await Bun.write(join(pkgDir, "index.js"), indexJs);

  const indexDts = `declare const path: string;
export default path;
`;

  await Bun.write(join(pkgDir, "index.d.ts"), indexDts);

  console.log(`Generated platform package: ${pkgDir}`);
}

async function generateHostPlatformPackage(): Promise<void> {
  const hostPlatform = findHostPlatform();
  if (!hostPlatform) {
    throw new Error(
      `Unsupported host platform: ${process.platform}-${process.arch}`
    );
  }

  const binaryPath = join(nativeDir, hostPlatform.binaryName);
  if (!existsSync(binaryPath)) {
    throw new Error(
      `Native binary not found at ${binaryPath}. Run with --native first.`
    );
  }

  await generatePlatformPackage(hostPlatform, binaryPath);
}

async function generateAllPlatformPackages(): Promise<void> {
  for (const platform of PLATFORMS) {
    const binaryPath = join(nativeDir, `${platform.sourceName}`);
    if (!existsSync(binaryPath)) {
      console.warn(
        `Skipping ${platform.name}: binary not found at ${binaryPath}`
      );
      continue;
    }
    await generatePlatformPackage(platform, binaryPath);
  }
}

function buildTypeScript(): void {
  console.log("Bundling TypeScript with bun build...");
  const buildResult = Bun.spawnSync(
    [
      "bun",
      "build",
      "--target=bun",
      "--splitting",
      "--outdir=dist",
      "src/index.ts",
      "src/testing/index.ts",
    ],
    {
      cwd: coreDir,
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  if (buildResult.exitCode !== 0) {
    throw new Error(`bun build failed with exit code ${buildResult.exitCode}`);
  }

  console.log("Generating declaration files...");
  const tscResult = Bun.spawnSync(
    ["bunx", "tsc", "-p", "tsconfig.build.json"],
    {
      cwd: coreDir,
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  if (tscResult.exitCode !== 0) {
    throw new Error(`tsc failed with exit code ${tscResult.exitCode}`);
  }
}

async function generateDistPackageJson(): Promise<void> {
  const sourcePkg = await getSourcePackageJson();
  const distPkgDir = join(coreDir, "dist");
  if (!existsSync(distPkgDir)) {
    mkdirSync(distPkgDir, { recursive: true });
  }

  const optionalDependencies: Record<string, string> = {};
  for (const platform of PLATFORMS) {
    optionalDependencies[`@moontui/core-${platform.name}`] = sourcePkg.version;
  }

  const distPkg = {
    name: sourcePkg.name,
    version: sourcePkg.version,
    description: sourcePkg.description,
    main: "index.js",
    module: "index.js",
    types: "index.d.ts",
    exports: {
      ".": {
        import: "./index.js",
        types: "./index.d.ts",
      },
      "./testing": {
        import: "./testing/index.js",
        types: "./testing/index.d.ts",
      },
    },
    optionalDependencies,
    engines: sourcePkg.engines,
    license: sourcePkg.license || "MIT",
    files: ["**/*"],
  };

  await Bun.write(
    join(distPkgDir, "package.json"),
    `${JSON.stringify(distPkg, null, 2)}\n`
  );
  console.log("Generated dist/package.json");
}

// Main execution
if (buildNative || buildAll) {
  if (buildAll) {
    console.log("Generating platform packages for all platforms...");
    await generateAllPlatformPackages();
  } else {
    buildCargoForHost();
    await copyArtifactToNative();
    await generateHostPlatformPackage();
  }
}

if (buildLib || buildAll) {
  buildTypeScript();
  await generateDistPackageJson();
}

console.log("Build complete!");
