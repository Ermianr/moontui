## ADDED Requirements

### Requirement: CI workflow runs tests on PRs and pushes
The repository SHALL contain `.github/workflows/ci.yml` that triggers on every push and pull request to `main`, running Rust tests, building native artifacts, and running TypeScript tests. The workflow SHALL also declare explicit `permissions` and pin third-party actions to commit SHAs.

#### Scenario: Opening a pull request
- **WHEN** a contributor opens a pull request to `main`
- **THEN** GitHub Actions SHALL run `cargo test` for the Rust core
- **AND** it SHALL build native libraries for the host platform
- **AND** it SHALL run `bun test` for the TypeScript test suite
- **AND** the workflow SHALL have `permissions: contents: read`

#### Scenario: Dependency review runs on PR
- **WHEN** a pull request is opened that modifies dependency files
- **THEN** the CI workflow SHALL run `actions/dependency-review-action`
- **AND** it SHALL block the PR if vulnerable dependencies are introduced

### Requirement: Cross-platform artifact generation
The CI workflow SHALL build native binaries for all supported platforms using a matrix of GitHub-hosted runners. Supported platforms SHALL be: Darwin x64, Darwin ARM64, Linux x64, Linux ARM64, Windows x64.

#### Scenario: Building for all platforms in CI
- **WHEN** a release tag is pushed
- **THEN** GitHub Actions SHALL spawn jobs for each platform in the matrix
- **AND** each job SHALL compile the Rust core natively on its runner
- **AND** each job SHALL upload its binary as a GitHub Actions artifact

### Requirement: Artifact download for testing
The test job in CI SHALL download the prebuilt native artifacts for its platform before running TypeScript tests, so tests run against the actual compiled binary.

#### Scenario: Testing on Ubuntu
- **WHEN** the Ubuntu test job starts
- **THEN** it SHALL download the artifact produced by the Linux x64 build job
- **AND** place it at `packages/core/node_modules/@moontui/core-linux-x64/`
- **AND** then run `bun test` successfully

### Requirement: Release workflow publishes on git tags
The repository SHALL contain `.github/workflows/release.yml` that triggers only on git tags matching `v*`, performs cross-platform builds, generates npm packages, and publishes them to the npm registry. The workflow SHALL declare explicit `permissions` and pin third-party actions to commit SHAs.

#### Scenario: Tagging a release
- **WHEN** a maintainer pushes a tag `v1.0.0`
- **THEN** the release workflow SHALL build all platform binaries
- **AND** generate the platform npm packages
- **AND** generate the bundled `dist/` package
- **AND** publish all packages to npm using the `NPM_TOKEN` secret
- **AND** the workflow SHALL have `permissions: contents: read`

### Requirement: Rust toolchain version is pinned
The repository SHALL declare a `rust-toolchain.toml` file specifying channel `1.95.0` to ensure reproducible builds across CI runners and developer machines.

#### Scenario: CI runner has a different Rust version
- **WHEN** the CI workflow installs Rust via `rustup`
- **THEN** `rust-toolchain.toml` SHALL cause rustup to install toolchain 1.95.0
- **AND** `cargo build` SHALL use that toolchain consistently
