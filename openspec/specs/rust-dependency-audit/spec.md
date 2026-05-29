## ADDED Requirements

### Requirement: cargo-deny configuration exists
The repository root SHALL contain a `deny.toml` file that configures `cargo-deny` for vulnerability auditing, license checking, and duplicate dependency detection.

#### Scenario: deny.toml is present
- **WHEN** the repository root is inspected
- **THEN** a file named `deny.toml` SHALL exist
- **AND** it SHALL configure advisory (vulnerability) checking
- **AND** it SHALL configure license checking with allowed licenses (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC0)
- **AND** it SHALL configure duplicate detection

### Requirement: CI runs cargo-deny on dependency changes
The CI workflow SHALL run `cargo deny check` as a step to audit Rust dependencies for vulnerabilities and license compliance.

#### Scenario: cargo-deny catches vulnerability
- **WHEN** a PR introduces a Rust dependency with a known vulnerability
- **THEN** `cargo deny check` SHALL fail in CI
- **AND** the PR status check SHALL be red

#### Scenario: cargo-deny passes on clean dependencies
- **WHEN** all Rust dependencies are free of known vulnerabilities and use allowed licenses
- **THEN** `cargo deny check` SHALL pass in CI
