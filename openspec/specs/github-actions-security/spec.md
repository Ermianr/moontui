## ADDED Requirements

### Requirement: Workflows declare minimal permissions
All GitHub Actions workflows SHALL declare explicit `permissions` at the workflow level, setting `contents: read` as the default and only elevating permissions at the job level where needed.

#### Scenario: CI workflow has restricted permissions
- **WHEN** `.github/workflows/ci.yml` is read
- **THEN** it SHALL contain `permissions: contents: read` at the top level
- **AND** no job SHALL request broader permissions unless justified

#### Scenario: Release workflow has restricted base permissions
- **WHEN** `.github/workflows/release.yml` is read
- **THEN** it SHALL contain `permissions: contents: read` at the top level
- **AND** the publish job MAY elevate to `contents: write` if needed for release operations

### Requirement: Third-party actions are pinned to commit SHA
All third-party GitHub Actions (not owned by the repository owner) SHALL be pinned to a full commit SHA, with a version comment for readability.

#### Scenario: Actions use SHA pins
- **WHEN** a workflow file is read
- **THEN** every `uses:` directive for third-party actions SHALL reference a full 40-character commit SHA
- **AND** each SHA reference SHALL have a comment indicating the human-readable version (e.g., `# v4.2.2`)

#### Scenario: First-party actions may use tags
- **WHEN** a workflow uses an action owned by the repository's organization
- **THEN** it MAY use a version tag instead of a SHA

### Requirement: Dependency review blocks vulnerable PRs
The CI workflow SHALL include `actions/dependency-review-action` as a step on pull requests to detect and block PRs that introduce vulnerable dependencies.

#### Scenario: PR with vulnerable dependency is flagged
- **WHEN** a pull request introduces a dependency with a known vulnerability
- **THEN** the dependency review action SHALL fail
- **AND** the PR status check SHALL be red
- **AND** the PR SHALL NOT be mergeable (when branch protection requires status checks)

#### Scenario: PR with no new vulnerabilities passes
- **WHEN** a pull request does not introduce new vulnerable dependencies
- **THEN** the dependency review action SHALL pass
