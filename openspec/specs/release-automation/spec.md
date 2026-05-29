## ADDED Requirements

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
