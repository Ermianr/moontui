# openspec-catalog-health

## Purpose
Defines the ongoing health contract for keeping the base OpenSpec catalog valid, live, non-duplicative, and free of archived delta documents stored as base specs.

## Requirements

### Requirement: Base OpenSpec catalog validates cleanly
The OpenSpec catalog SHALL validate with no invalid base specs after cleanup.

#### Scenario: Validate all specs
- **WHEN** `openspec validate --all` is run from the repository root
- **THEN** every base spec is valid

### Requirement: Base specs are live contracts
Base specs SHALL describe current product, architecture, or workflow contracts rather than archived change deltas.

#### Scenario: Archived delta heading is absent from base specs
- **WHEN** base specs under `openspec/specs/**/spec.md` are inspected
- **THEN** no base spec uses `## ADDED Requirements` as its top-level contract format

### Requirement: Repository housekeeping is not duplicated as product specs
OpenSpec SHALL NOT contain base specs whose only purpose is to restate repository configuration, policy, or metadata already owned by source files.

#### Scenario: Housekeeping-only specs are removed
- **WHEN** the cleaned catalog is inspected
- **THEN** specs for licensing, security policy, Renovate, Cargo workspace metadata, GitHub Actions security, and docs-template existence are absent unless they define product behavior

### Requirement: Historical decisions are preserved before deletion
The cleanup SHALL preserve current architectural decisions before deleting historical implementation-era specs.

#### Scenario: Retiring historical layout specs
- **WHEN** historical Taffy, Yoga, or layout-promotion specs are removed
- **THEN** the active layout contract records the native custom default backend and TypeScript fallback oracle decision

### Requirement: Evidence paths do not target inactive changes
Scripts SHALL NOT write generated evidence into an inactive or absent `openspec/changes/<name>` directory.

#### Scenario: Layout benchmark output path
- **WHEN** the layout benchmark script writes default evidence
- **THEN** the output path SHALL be `openspec/evidence/layout-benchmark-results.txt`
- **AND** the output path SHALL NOT be under an inactive change directory
