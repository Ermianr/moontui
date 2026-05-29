## ADDED Requirements

### Requirement: Renovate configuration exists
The repository root SHALL contain a `renovate.json` file that configures the Renovate bot for automated dependency updates.

#### Scenario: renovate.json is present
- **WHEN** the repository root is inspected
- **THEN** a file named `renovate.json` SHALL exist
- **AND** it SHALL extend the `config:recommended` base configuration

### Requirement: Minor and patch updates are auto-merged
Renovate SHALL be configured to auto-merge minor and patch dependency updates when CI passes.

#### Scenario: Patch update is auto-merged
- **WHEN** a dependency releases a patch update (e.g., 1.2.3 -> 1.2.4)
- **AND** CI passes on the Renovate PR
- **THEN** Renovate SHALL auto-merge the PR

#### Scenario: Major update requires manual review
- **WHEN** a dependency releases a major update (e.g., 1.x -> 2.x)
- **THEN** Renovate SHALL create a PR but NOT auto-merge
- **AND** a maintainer SHALL review and merge manually

### Requirement: GitHub Actions SHA pins are updated by Renovate
Renovate SHALL be configured to update pinned GitHub Action SHAs, so action version bumps are automated.

#### Scenario: Action SHA is updated
- **WHEN** a pinned GitHub Action releases a new version
- **THEN** Renovate SHALL create a PR updating the SHA and version comment
