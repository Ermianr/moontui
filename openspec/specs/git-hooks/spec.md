# Git Hooks

## Purpose

Define the configuration and behavior of Git hooks that enforce code quality and commit message standards across the MoonTUI project.

## Requirements

### Requirement: Pre-commit hook formats staged files
The pre-commit hook SHALL run lint-staged to format only staged files before allowing a commit.

#### Scenario: Staged Rust file is formatted
- **WHEN** a developer commits a staged `.rs` file that is not formatted
- **THEN** the pre-commit hook SHALL run `cargo fmt --all` to format it
- **AND** the formatted file SHALL be re-staged before the commit proceeds

#### Scenario: Staged TypeScript file is formatted
- **WHEN** a developer commits a staged `.ts` or `.tsx` file that has formatting issues
- **THEN** the pre-commit hook SHALL run `ultracite fix` to format it
- **AND** the formatted file SHALL be re-staged before the commit proceeds

#### Scenario: No staged files match configured patterns
- **WHEN** a developer commits with no staged `.rs` or `.ts` files
- **THEN** the pre-commit hook SHALL pass without running any formatters

### Requirement: Commit-msg hook enforces conventional commits
The commit-msg hook SHALL validate that commit messages follow the conventional commits format using commitlint.

#### Scenario: Valid conventional commit message
- **WHEN** a developer commits with message `feat(core): add new widget`
- **THEN** the commit-msg hook SHALL pass

#### Scenario: Invalid commit message is rejected
- **WHEN** a developer commits with message `fixed stuff`
- **AND** the message does not follow conventional commits format
- **THEN** the commit-msg hook SHALL reject the commit with an error message

#### Scenario: Scoped commit types are supported
- **WHEN** a developer commits with message `fix(ffi): resolve pointer leak`
- **THEN** the commit-msg hook SHALL accept the scoped format

### Requirement: Husky is installed and configured
Husky SHALL be installed as a devDependency and initialized via `bunx husky init`.

#### Scenario: Husky directory exists
- **WHEN** the project is cloned and `bun install` is run
- **THEN** the `.husky/` directory SHALL exist with pre-commit and commit-msg hooks

#### Scenario: prepare script runs husky
- **WHEN** `bun install` is run
- **THEN** husky SHALL be initialized via the `prepare` script
