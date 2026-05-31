## ADDED Requirements

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
