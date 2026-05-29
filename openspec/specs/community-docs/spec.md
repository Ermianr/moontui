## ADDED Requirements

### Requirement: Contributing guide exists
The repository root SHALL contain a file named `CONTRIBUTING.md` that describes how to set up the development environment, run tests, and submit contributions.

#### Scenario: CONTRIBUTING.md is present
- **WHEN** the repository root is inspected
- **THEN** a file named `CONTRIBUTING.md` SHALL exist
- **AND** it SHALL contain development setup instructions
- **AND** it SHALL contain instructions for running tests
- **AND** it SHALL contain guidelines for submitting pull requests

### Requirement: Bug report issue template exists
The repository SHALL contain `.github/ISSUE_TEMPLATE/bug_report.md` that provides a structured template for reporting bugs.

#### Scenario: Bug report template is available
- **WHEN** a user creates a new issue on GitHub
- **THEN** the bug report template SHALL be available as an option
- **AND** it SHALL include sections for description, steps to reproduce, expected behavior, and environment

### Requirement: Pull request template exists
The repository SHALL contain `.github/PULL_REQUEST_TEMPLATE.md` that provides a structured template for pull requests.

#### Scenario: PR template is auto-applied
- **WHEN** a contributor opens a new pull request
- **THEN** the PR description SHALL be pre-filled with the template
- **AND** it SHALL include sections for description, type of change, and checklist
