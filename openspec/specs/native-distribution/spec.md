# native-distribution

## Purpose
Defines native package generation, platform package resolution, Bun-native publishing, release automation, and TypeScript build/package publication expectations.

## Requirements

<!-- Preserved from openspec/specs/npm-native-distribution/spec.md. -->

### Requirement: Platform-specific native packages are generated
The build script SHALL generate one npm package per supported platform inside `packages/core/node_modules/@moontui/core-<platform>-<arch>/`. Each package SHALL contain the native binary, a generated `package.json`, an `index.js`, and an `index.d.ts`.

#### Scenario: Building native packages for the host platform
- **WHEN** a developer runs `bun run build:native` from `packages/core/`
- **THEN** the script SHALL generate a directory at `node_modules/@moontui/core-<host-platform>-<host-arch>/`
- **AND** that directory SHALL contain the compiled native binary with the correct file extension (`.dylib`, `.so`, or `.dll`)
- **AND** it SHALL contain a `package.json` with `os` and `cpu` fields matching the platform

### Requirement: Platform packages export the binary path
Each platform package SHALL export the absolute filesystem path to its native binary via a default export in `index.js`, using `fileURLToPath` and `import.meta.url`.

#### Scenario: Importing a platform package
- **WHEN** the TypeScript loader executes `await import("@MoonTUI/core-darwin-arm64")`
- **THEN** the resolved module SHALL export a string that is the absolute path to the `.dylib` file
- **AND** the path SHALL be resolvable by `dlopen`

### Requirement: Main package uses optionalDependencies for platform packages
The main `@moontui/core` package SHALL list all platform packages as `optionalDependencies` in its published `package.json`, with version constraints matching the main package version.

#### Scenario: Installing the main package on a supported platform
- **WHEN** a user runs `bun install @moontui/core@1.0.0` on macOS ARM64
- **THEN** npm/bun SHALL install `@MoonTUI/core-darwin-arm64@1.0.0`
- **AND** it SHALL NOT attempt to install `@MoonTUI/core-linux-x64` or other non-matching platform packages

### Requirement: Platform loading fails gracefully
The TypeScript loader SHALL detect when the platform-specific package is unavailable and throw a descriptive error message indicating the unsupported platform.

#### Scenario: Unsupported platform
- **WHEN** MoonTUI is loaded on a platform for which no `@moontui/core-<platform>-<arch>` package exists
- **THEN** the loader SHALL throw an error with the message format: `moontui is not supported on the current platform: <platform>-<arch>`

### Requirement: No postinstall scripts
The distribution mechanism SHALL NOT rely on `postinstall`, `preinstall`, or any npm lifecycle scripts to download or compile native binaries.

#### Scenario: Installing in a restricted environment
- **WHEN** a user installs `@moontui/core` with `--ignore-scripts` or in an environment that blocks lifecycle scripts
- **THEN** the native binary SHALL still be available because it was installed as an `optionalDependency`

### Requirement: Platform artifacts are stored under platform-specific paths
Native build artifacts used for package generation SHALL be stored or referenced using platform-specific directories or filenames so architectures with the same binary filename cannot overwrite or reuse each other.

#### Scenario: Darwin artifacts for both architectures
- **WHEN** packages are generated for `darwin-x64` and `darwin-arm64`
- **THEN** each package SHALL read its binary from a distinct platform-specific path
- **AND** both packages SHALL NOT read the same `native/libmoontui_core.dylib` file

#### Scenario: Linux artifacts for both architectures
- **WHEN** packages are generated for `linux-x64` and `linux-arm64`
- **THEN** each package SHALL read its binary from a distinct platform-specific path
- **AND** both packages SHALL NOT read the same `native/libmoontui_core.so` file

### Requirement: All-platform package generation fails on missing required artifacts
The all-platform package generation command SHALL fail when required platform artifacts are missing unless a separate explicitly named package-existing command is used.

#### Scenario: Required artifact missing
- **WHEN** all-platform package generation runs and a supported platform artifact is absent
- **THEN** the command SHALL exit non-zero
- **AND** it SHALL identify the missing platform artifact

#### Scenario: Host native build remains simple
- **WHEN** a developer runs the host native build command
- **THEN** it SHALL build the host Rust artifact
- **AND** it SHALL copy it into the host platform-specific native artifact path

<!-- Preserved from openspec/specs/bun-native-tooling/spec.md. -->

### Requirement: Publish uses bun publish instead of npm publish
The publish scripts SHALL use `bun publish` instead of `npm publish` to publish packages to the npm registry.

#### Scenario: Publishing a package
- **WHEN** the publish script runs `bun publish --access=public`
- **THEN** the package SHALL be published to the npm registry
- **AND** the behavior SHALL be equivalent to `npm publish --access=public`

#### Scenario: Publishing with a tag
- **WHEN** the publish script runs `bun publish --tag snapshot`
- **THEN** the package SHALL be published with the `snapshot` dist-tag
- **AND** the `latest` tag SHALL NOT be updated

### Requirement: Pre-publish validation uses Bun-native APIs
The pre-publish validation script SHALL use Bun-native APIs or HTTP requests instead of `npm` CLI for registry checks.

#### Scenario: Checking npm authentication
- **WHEN** the pre-publish script verifies the user is authenticated
- **THEN** it SHALL use an HTTP request to the npm registry with the configured auth token
- **AND** it SHALL NOT invoke `npm whoami` as a child process

#### Scenario: Checking if version is already published
- **WHEN** the pre-publish script checks whether a version exists on the registry
- **THEN** it SHALL use an HTTP request to `https://registry.npmjs.org/<package>/<version>`
- **AND** it SHALL NOT invoke `npm view` as a child process

### Requirement: CI release workflow uses bun publish
The GitHub Actions release workflow SHALL use `bun publish` instead of `npm publish` for publishing packages.

#### Scenario: CI publishes without npm CLI
- **WHEN** the release workflow runs in GitHub Actions
- **THEN** it SHALL authenticate to the npm registry via `bunfig.toml` `[install.scopes]` or `NPM_CONFIG_TOKEN` environment variable
- **AND** it SHALL NOT require `npm` to be installed or `~/.npmrc` to be generated
- **AND** it SHALL invoke `bun run --cwd packages/core publish` which internally uses `bun publish`

#### Scenario: CI release produces identical results
- **WHEN** a release is published via `bun publish` in CI
- **THEN** the published package SHALL be identical to one published via `npm publish`
- **AND** all package metadata, files, and dist-tags SHALL be preserved

### Requirement: Scripts use Bun.spawnSync instead of execSync
All build, publish, and release scripts SHALL use `Bun.spawnSync` instead of `execSync` from `node:child_process` for executing child processes.

#### Scenario: Running cargo build via Bun.spawnSync
- **WHEN** the build script executes `cargo build`
- **THEN** it SHALL use `Bun.spawnSync(["cargo", "build", ...], { stdout: "inherit", stderr: "inherit" })`
- **AND** it SHALL NOT import `execSync` from `node:child_process`

#### Scenario: Running bun build via Bun.spawnSync
- **WHEN** the build script executes `bun build`
- **THEN** it SHALL use `Bun.spawnSync(["bun", "build", ...], { stdout: "inherit", stderr: "inherit" })`
- **AND** the exit code SHALL be checked via the `.exitCode` property of the returned `SyncSubprocess`

### Requirement: Scripts use Bun.file and Bun.write for file I/O
All scripts SHALL use `Bun.file().text()` for reading files and `Bun.write()` for writing files instead of `readFileSync` and `writeFileSync` from `node:fs`.

#### Scenario: Reading a JSON file
- **WHEN** a script reads a `package.json` file
- **THEN** it SHALL use `await Bun.file(path).text()` followed by `JSON.parse()`
- **AND** it SHALL NOT import `readFileSync` from `node:fs`

#### Scenario: Writing a file to disk
- **WHEN** a script writes content to a file
- **THEN** it SHALL use `await Bun.write(path, content)`
- **AND** it SHALL NOT import `writeFileSync` from `node:fs`

### Requirement: Scripts use Bun.write for file copying
The build script SHALL use `Bun.write(dst, Bun.file(src))` instead of `copyFileSync` from `node:fs` for copying files.

#### Scenario: Copying a native binary
- **WHEN** the build script copies a native binary to a destination directory
- **THEN** it SHALL use `await Bun.write(dstPath, Bun.file(srcPath))`
- **AND** Bun SHALL use the optimal platform syscall (sendfile, clonefile, copy_file_range) for the copy

### Requirement: Scripts use import.meta.dir instead of dirname(fileURLToPath)
All scripts and runtime code SHALL use `import.meta.dir` instead of the `dirname(fileURLToPath(import.meta.url))` pattern to obtain the current module's directory.

#### Scenario: Getting the current module directory in a script
- **WHEN** a script needs to resolve paths relative to itself
- **THEN** it SHALL use `import.meta.dir` directly
- **AND** it SHALL NOT import `fileURLToPath` from `node:url` or `dirname` from `node:path` for this purpose

#### Scenario: Runtime ffi.ts resolves native library path
- **WHEN** `packages/core/src/ffi.ts` resolves the native library directory
- **THEN** it SHALL use `Bun.fileURLToPath()` instead of importing `fileURLToPath` from `node:url`

### Requirement: Generated platform package index.js uses import.meta.dir
The build script's generated `index.js` for platform packages SHALL use `import.meta.dir` instead of the `dirname(fileURLToPath(import.meta.url))` pattern.

#### Scenario: Generated index.js resolves binary path
- **WHEN** the build script generates `index.js` for a platform package
- **THEN** the generated code SHALL use `import.meta.dir` to resolve the native binary path
- **AND** it SHALL NOT contain `import { fileURLToPath } from "url"` or `import { dirname } from "path"`

### Requirement: Agent native rebuild instructions use canonical Bun workflow
`AGENTS.md` SHALL document the canonical native rebuild workflow using the Bun build script rather than manual platform-specific copy commands.

#### Scenario: Rust core change requires native rebuild
- **WHEN** `AGENTS.md` describes what to do after changing `crates/moontui-core/`
- **THEN** it SHALL instruct agents to run `bun run build:native`
- **AND** it SHALL NOT present manual `Copy-Item target\debug\moontui_core.dll ...` commands as the primary workflow

#### Scenario: Debug native rebuild is explicitly scoped
- **WHEN** `AGENTS.md` mentions debug native artifacts
- **THEN** it SHALL identify debug builds as an explicit development choice
- **AND** it SHALL keep the default native rebuild guidance aligned with the build script's default profile

### Requirement: Agent native artifact guidance reflects platform packages
`AGENTS.md` SHALL explain that native build output is distributed through platform-specific package directories generated by the build script.

#### Scenario: Native artifact destination is described
- **WHEN** `AGENTS.md` describes where TypeScript examples load native binaries from
- **THEN** it SHALL reference the platform package workflow generated under `packages/core/node_modules/@moontui/core-<platform>`
- **AND** it SHALL avoid implying that copying only to `packages/core/native/moontui_core.dll` is sufficient

<!-- Preserved from openspec/specs/release-automation/spec.md. -->

### Requirement: Lockstep version synchronization
The repository SHALL provide a script (`scripts/prepare-release.ts`) that bumps the version of all `@moontui/*` packages in lockstep, updating both the `version` field and any `optionalDependencies` version constraints.

#### Scenario: Preparing a patch release
- **WHEN** a maintainer runs `bun run prepare-release --patch`
- **THEN** all `package.json` files under workspace packages with names starting with `@moontui/` SHALL have their `version` incremented by one patch level
- **AND** the `optionalDependencies` inside `@moontui/core` SHALL be updated to match the new version

### Requirement: Pre-publish validation
The repository SHALL provide a script (`scripts/pre-publish.ts`) that validates the following before publishing:
- npm authentication is active
- The target version does not already exist on the npm registry
- The `dist/` directory exists and its `package.json` version matches the source `package.json`
- All platform packages in `node_modules/@moontui/core-*` have versions matching the main package

#### Scenario: Attempting to publish without building
- **WHEN** a maintainer runs `bun run pre-publish` before running the build script
- **THEN** the script SHALL exit with code 1 and print an error: `dist directory not found: ... Please run 'bun run build' first`

#### Scenario: Version mismatch between source and dist
- **WHEN** the `dist/package.json` version differs from `packages/core/package.json`
- **THEN** the script SHALL exit with code 1 and print an error indicating the mismatch

### Requirement: Platform packages are published before the main package
The publish script (`packages/core/scripts/publish.ts`) SHALL publish all native platform packages before publishing the main `@moontui/core` package from `dist/`.

#### Scenario: Publishing a release
- **WHEN** the publish script runs
- **THEN** it SHALL iterate over all `@moontui/core-<platform>-<arch>` directories in `node_modules/@moontui/`
- **AND** publish each one with `npm publish --access=public`
- **AND** only after all platform packages are published, it SHALL publish `dist/` as `@moontui/core`

### Requirement: Snapshot releases are tagged separately
If the version contains `-snapshot` or matches a snapshot pattern (`0.0.0-<date>-<hash>`), the publish script SHALL publish with `--tag snapshot` instead of `latest`.

#### Scenario: Publishing a snapshot
- **WHEN** the version is `0.2.16-snapshot.20260526`
- **THEN** the publish command SHALL include `--tag snapshot`
- **AND** consumers SHALL NOT receive it by default when running `bun install @moontui/core`

### Requirement: Release workflow runs tests before publishing
The release workflow (`.github/workflows/release.yml`) SHALL run the test suite before publishing packages to npm.

#### Scenario: Tests run after build and before publish
- **WHEN** a release tag is pushed
- **THEN** the workflow SHALL execute a `test` job after the `build` job completes
- **AND** the `test` job SHALL run `cargo test` for Rust code
- **AND** the `test` job SHALL run `bun test --cwd packages/core` for TypeScript code
- **AND** the `publish` job SHALL depend on both `build` and `test` jobs

#### Scenario: Test failure prevents publish
- **WHEN** either `cargo test` or `bun test` fails in the `test` job
- **THEN** the `publish` job SHALL NOT execute
- **AND** the workflow SHALL report the failure

#### Scenario: Tests run on ubuntu-latest
- **WHEN** the `test` job executes
- **THEN** it SHALL run on `ubuntu-latest`
- **AND** it SHALL install Rust and Bun toolchains
- **AND** it SHALL install dependencies with `bun install`

### Requirement: Package publish script uses the platform-aware publisher
The package publish script for `@moontui/core` SHALL invoke the repository's platform-aware publish script rather than plain `bun publish` from the source package directory.

#### Scenario: Root publish command
- **WHEN** `bun run publish` is executed from the repository root
- **THEN** it SHALL run pre-publish validation
- **AND** it SHALL publish platform packages before the main package through `packages/core/scripts/publish.ts`

#### Scenario: Core package publish command
- **WHEN** `bun run publish` is executed from `packages/core`
- **THEN** it SHALL publish from generated package directories and `dist/`
- **AND** it SHALL NOT publish the source `packages/core/package.json` directly

### Requirement: Release prep only bumps publishable versioned packages
Release preparation SHALL only update packages that are intended to be published and already declare a valid semver `version`.

#### Scenario: Private example package
- **WHEN** release prep scans `examples/hello/package.json` or `examples/dashboard/package.json`
- **THEN** it SHALL skip the package because it is private
- **AND** it SHALL NOT update its version field

#### Scenario: Private config package without version
- **WHEN** release prep scans `packages/config/package.json`
- **THEN** it SHALL skip the package because it is private and has no version
- **AND** it SHALL NOT crash trying to bump an undefined version

### Requirement: Cleanup script is portable across supported development hosts
Repository cleanup SHALL use a Bun or Node script rather than shell-specific `rm -rf`.

#### Scenario: Cleanup on Windows
- **WHEN** `bun run clean` is executed on Windows
- **THEN** it SHALL remove build artifacts without requiring a Unix shell

<!-- Preserved from openspec/specs/ts-build-pipeline/spec.md. -->

### Requirement: Dual TypeScript configuration
The `packages/core/` directory SHALL contain two TypeScript configuration files: `tsconfig.json` for development and `tsconfig.build.json` for production builds. Both SHALL extend the root `tsconfig.json` base configuration.

#### Scenario: Development type-checking
- **WHEN** a developer runs `tsc --noEmit` or their IDE performs type-checking
- **THEN** `tsconfig.json` SHALL be used with `noEmit: true` and `moduleResolution: "bundler"`
- **AND** it SHALL extend the root `tsconfig.json` via `"extends": "../../tsconfig.json"`
- **AND** no JavaScript or declaration files SHALL be emitted

#### Scenario: Production declaration generation
- **WHEN** the build script runs `tsc -p tsconfig.build.json`
- **THEN** `tsconfig.build.json` SHALL emit only `.d.ts` files to the `dist/` directory
- **AND** it SHALL override `noEmit` to `false`, enable `declaration: true`, and set `emitDeclarationOnly: true`
- **AND** it SHALL extend the local `tsconfig.json` via `"extends": "./tsconfig.json"`

### Requirement: TypeScript source is bundled for runtime
The build script SHALL use `bun build` to produce the runtime JavaScript bundle from `src/` into `dist/`.

#### Scenario: Building the library
- **WHEN** the build script runs with the `--lib` flag
- **THEN** it SHALL execute `bun build --target=bun --splitting --outdir=dist` for all entry points
- **AND** the output in `dist/` SHALL be executable by Bun

### Requirement: Entry points are exported via package.json exports map
The published `@moontui/core` package SHALL declare its public API through a `package.json` `exports` map pointing to the bundled files in `dist/`.

#### Scenario: Importing the main module
- **WHEN** a consumer writes `import { CliRenderer } from "@moontui/core"`
- **THEN** Bun SHALL resolve the import to `dist/index.js` as specified in the `exports` map

### Requirement: Source map generation
The build pipeline SHALL generate source maps for the bundled JavaScript output.

#### Scenario: Debugging a built package
- **WHEN** an exception is thrown inside `@moontui/core`
- **THEN** the stack trace SHALL map back to the original TypeScript source files via the generated `.js.map` files

### Requirement: TypeScript version is 6.0.3
The root `package.json` and `packages/core/package.json` SHALL specify `"typescript": "^6.0.3"` in `devDependencies` and `peerDependencies`.

#### Scenario: TypeScript 6 is available
- **WHEN** a developer runs `bun install`
- **THEN** TypeScript 6.0.3 or a compatible 6.x version SHALL be installed

### Requirement: Root scripts use bun workspace delegation
The root `package.json` scripts SHALL use `bun --filter @moontui/core` or `bun run --cwd packages/core` instead of `cd packages/core && bun run build`.

#### Scenario: Running build from root
- **WHEN** a developer runs `bun run build` from the repository root
- **THEN** the build SHALL execute in `packages/core/` context
- **AND** it SHALL NOT use `cd` or `&&` chaining in the script definition

<!-- Synced from openspec/changes/cleanup-openspec-specs/specs/native-distribution/spec.md. -->

### Requirement: Native distribution contract is consolidated
The native distribution spec SHALL cover platform package generation, native artifact placement, package resolution, Bun-native publish behavior, and release publication flow.

#### Scenario: Future native packaging change selects one capability
- **WHEN** a future change modifies native package generation, optional dependencies, platform binary resolution, publish scripts, or release publishing
- **THEN** the change targets `native-distribution`

### Requirement: Platform packages remain the package-resolution source
TypeScript package resolution SHALL use generated platform packages rather than direct `target/debug` or `target/release` paths.

#### Scenario: Native artifacts are rebuilt
- **WHEN** native artifacts are rebuilt for local package use
- **THEN** platform packages under the core package are regenerated or updated consistently

### Requirement: Publishing uses Bun-native workflow
Publication scripts SHALL use the Bun-native publish workflow established by repository scripts.

#### Scenario: Package publish runs
- **WHEN** the publish workflow publishes platform and main packages
- **THEN** it invokes Bun publish behavior through repository scripts
