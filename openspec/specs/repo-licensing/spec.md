## ADDED Requirements

### Requirement: MIT license file exists at repository root
The repository root SHALL contain a file named `LICENSE` containing the full text of the MIT License, with the copyright holder matching the repository author.

#### Scenario: LICENSE file is present
- **WHEN** the repository root is inspected
- **THEN** a file named `LICENSE` SHALL exist
- **AND** it SHALL contain the MIT License text
- **AND** it SHALL include a copyright notice with the current year and author name

### Requirement: MIT license file exists in npm package directory
The `packages/core/` directory SHALL contain a file named `LICENSE` with the same content as the root LICENSE file.

#### Scenario: npm package directory has LICENSE
- **WHEN** `packages/core/` is inspected
- **THEN** a file named `LICENSE` SHALL exist
- **AND** its content SHALL be identical to the root `LICENSE` file

### Requirement: README exists at repository root
The repository root SHALL contain a file named `README.md` describing the project, its purpose, installation instructions, and basic usage.

#### Scenario: README provides project overview
- **WHEN** a visitor opens the GitHub repository page
- **THEN** the README.md SHALL be displayed
- **AND** it SHALL contain a project description
- **AND** it SHALL contain installation instructions
- **AND** it SHALL contain a basic usage example

### Requirement: README exists in npm package directory
The `packages/core/` directory SHALL contain a file named `README.md` with npm-specific documentation including API reference or usage examples.

#### Scenario: npm package has README
- **WHEN** a user views `@moontui/core` on npmjs.com
- **THEN** the README.md from `packages/core/` SHALL be displayed
- **AND** it SHALL provide usage documentation for the npm package

### Requirement: npm package includes LICENSE and README
The `packages/core/package.json` `files` array SHALL include `"LICENSE"` and `"README.md"` to ensure they are included in the published npm tarball.

#### Scenario: npm publish includes license and readme
- **WHEN** `npm pack` is run in `packages/core/`
- **THEN** the resulting tarball SHALL contain `LICENSE`
- **AND** it SHALL contain `README.md`
