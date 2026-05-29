## Purpose

Ensure all developers and CI environments use a consistent, modern Rust toolchain with optimal Cargo workspace configuration. TBD.

## ADDED Requirements

### Requirement: Rust toolchain is pinned to 1.95.0
The `rust-toolchain.toml` file SHALL specify `channel = "1.95.0"`. All Rust compilation SHALL use this exact version.

#### Scenario: Developer builds the project
- **WHEN** a developer runs `cargo build -p moontui-core` from the repository root
- **THEN** rustup SHALL install toolchain 1.95.0 if not already present
- **AND** the build SHALL complete successfully

#### Scenario: CI runs tests
- **WHEN** the CI workflow runs `cargo test`
- **THEN** rustup SHALL use toolchain 1.95.0 as specified in `rust-toolchain.toml`

### Requirement: Cargo resolver is set to 3
The root `Cargo.toml` SHALL specify `resolver = "3"` in the `[workspace]` section.

#### Scenario: Cargo metadata reports resolver 3
- **WHEN** a developer runs `cargo metadata --format-version 1`
- **THEN** the output metadata SHALL include `"resolver": 3` in the workspace section

### Requirement: Workspace package metadata is centralized
The root `Cargo.toml` SHALL contain a `[workspace.package]` section defining `edition = "2021"`, `license`, and `repository`. Individual crate `Cargo.toml` files SHALL inherit these values via `edition.workspace = true`.

#### Scenario: Workspace package section exists
- **WHEN** inspecting the root `Cargo.toml`
- **THEN** a `[workspace.package]` section SHALL exist with at least `edition` and `license`

### Requirement: Workspace dependencies are centralized
The root `Cargo.toml` SHALL contain a `[workspace.dependencies]` section listing all external crate dependencies. Each crate's `Cargo.toml` SHALL reference shared dependencies via `crate-name.workspace = true` instead of specifying versions directly.

#### Scenario: crossterm is a workspace dependency
- **WHEN** inspecting `crates/moontui-core/Cargo.toml`
- **THEN** `crossterm` SHALL be declared as `crossterm.workspace = true`
- **AND** the version SHALL be defined only in `Cargo.toml` under `[workspace.dependencies]`

### Requirement: Dev profile is optimized for faster builds
The root `Cargo.toml` SHALL contain a `[profile.dev]` section with `debug = "line-tables-only"`.

#### Scenario: Dev profile is set
- **WHEN** a developer runs `cargo build` (debug mode)
- **THEN** the build SHALL use `line-tables-only` debug info
- **AND** compilation SHALL be faster than the default debug profile
