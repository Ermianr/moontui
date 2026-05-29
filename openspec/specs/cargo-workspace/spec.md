## ADDED Requirements

### Requirement: Repository has a Cargo workspace root
The repository SHALL contain a `Cargo.toml` file at the root defining a `[workspace]` section with `members = ["crates/*"]` and `resolver = "3"`.

#### Scenario: Workspace is recognized by Cargo
- **WHEN** a developer runs `cargo metadata --format-version 1` from the repository root
- **THEN** Cargo SHALL recognize `moontui-core` as a workspace member

### Requirement: Rust target directory is global and shared
The workspace SHALL use a single global `target/` directory located at the repository root. The existing `crates/moontui-core/target/` directory SHALL be removed.

#### Scenario: Building a crate uses the global target
- **WHEN** a developer runs `cargo build -p moontui-core` from the repository root
- **THEN** Cargo SHALL place build artifacts in `target/debug/` or `target/release/` at the repository root
- **AND** there SHALL NOT be a `target/` directory inside `crates/moontui-core/`

### Requirement: Additional crates can be added without restructuring
The workspace structure SHALL support adding new crates under `crates/` by creating a new directory with a `Cargo.toml` and adding it to the workspace `members` array, without requiring changes to other build scripts.

#### Scenario: Adding a new crate
- **WHEN** a developer creates `crates/moontui-layout/` with a valid `Cargo.toml`
- **AND** adds `"crates/moontui-layout"` to the root `Cargo.toml` workspace members
- **THEN** `cargo build --workspace` SHALL compile both `moontui-core` and `moontui-layout` using the shared `target/` directory

### Requirement: Workspace package metadata is centralized
The root `Cargo.toml` SHALL contain a `[workspace.package]` section.

#### Scenario: Package metadata is inherited
- **WHEN** inspecting the crate `Cargo.toml`
- **THEN** it SHALL use `edition.workspace = true` instead of a hardcoded edition

### Requirement: Workspace dependencies are centralized
The root `Cargo.toml` SHALL contain a `[workspace.dependencies]` section defining versions for `crossterm` and `unicode-width`. Version strings SHALL use minor-compatible format (e.g., `"0.29"` not `"0.29.0"`).

#### Scenario: Crate uses workspace dependency versions
- **WHEN** a developer runs `cargo build -p moontui-core`
- **THEN** the build SHALL use the versions declared in `[workspace.dependencies]`

#### Scenario: Crossterm uses minor-compatible version format
- **WHEN** the root `Cargo.toml` declares the `crossterm` dependency
- **THEN** the version string SHALL be `"0.29"` (not `"0.29.0"`)
- **AND** `Cargo.lock` SHALL pin the exact patch version for reproducibility

### Requirement: Cargo.lock is committed for reproducibility
The `Cargo.lock` file SHALL be committed to version control. The `.gitignore` file SHALL NOT include `Cargo.lock`.

#### Scenario: Cargo.lock is in version control
- **WHEN** a developer clones the repository
- **THEN** `Cargo.lock` SHALL be present at the repository root
- **AND** `cargo build` SHALL use the exact dependency versions specified in `Cargo.lock`

#### Scenario: Cargo.lock is not gitignored
- **WHEN** `.gitignore` is inspected
- **THEN** it SHALL NOT contain an entry for `Cargo.lock`
