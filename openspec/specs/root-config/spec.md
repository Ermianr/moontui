## ADDED Requirements

### Requirement: Root tsconfig.json base configuration
The repository root SHALL contain a `tsconfig.json` file that defines shared compiler options for all TypeScript packages in the monorepo.

#### Scenario: Base compiler options are defined
- **WHEN** the root `tsconfig.json` is read
- **THEN** it SHALL define `compilerOptions` with `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, and `types: ["bun"]`
- **AND** it SHALL NOT define `include`, `exclude`, or `outDir` (those are package-specific)

#### Scenario: Package extends root tsconfig
- **WHEN** a package's `tsconfig.json` uses `"extends": "../../tsconfig.json"`
- **THEN** the package SHALL inherit all root `compilerOptions`
- **AND** the package SHALL be able to override any inherited option

### Requirement: Root bunfig.toml configuration
The repository root SHALL contain a `bunfig.toml` file that configures Bun's package manager behavior for the entire workspace.

#### Scenario: Isolated linker is configured
- **WHEN** `bunfig.toml` is read
- **THEN** it SHALL set `[install]` section with `linker = "isolated"` to prevent phantom dependencies
- **AND** it SHALL set `exact = true` to pin exact dependency versions

#### Scenario: Workspace packages are linked
- **WHEN** `bun install` is run from any workspace directory
- **THEN** workspace packages SHALL be symlinked via `linkWorkspacePackages = true`
- **AND** Bun SHALL discover the root `bunfig.toml` by walking up ancestor directories

### Requirement: Package manager version pinning
The root `package.json` SHALL declare a `packageManager` field to pin the Bun version used for the project.

#### Scenario: Package manager is declared
- **WHEN** the root `package.json` is read
- **THEN** it SHALL contain `"packageManager": "bun@<version>"` where `<version>` is a specific Bun version >= 1.3.0
- **AND** tools like Corepack SHALL use this to enforce the correct Bun version

### Requirement: Example projects have tsconfig.json
Each example project under `examples/*/` SHALL contain a `tsconfig.json` for type-checking and IDE support.

#### Scenario: Example tsconfig extends root
- **WHEN** an example's `tsconfig.json` is read
- **THEN** it SHALL extend the root tsconfig via `"extends": "../../tsconfig.json"`
- **AND** it SHALL set `noEmit: true` since examples are not published
- **AND** it SHALL include its own source files via `"include": ["*.ts"]` or similar

#### Scenario: IDE type-checking works in examples
- **WHEN** a developer opens an example `.ts` file in their IDE
- **THEN** the IDE SHALL provide type-checking using the example's `tsconfig.json`
- **AND** types from `@moontui/core` SHALL be resolved via workspace linking

### Requirement: Trusted dependencies are declared
The root `package.json` SHALL declare `trustedDependencies` for any packages that require lifecycle scripts (postinstall, etc.).

#### Scenario: Trusted dependencies allow lifecycle scripts
- **WHEN** `bun install` is run
- **THEN** packages listed in `trustedDependencies` SHALL be allowed to run their lifecycle scripts
- **AND** all other packages SHALL have their lifecycle scripts blocked for security
