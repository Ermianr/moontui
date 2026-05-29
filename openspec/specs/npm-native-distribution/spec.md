## ADDED Requirements

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
