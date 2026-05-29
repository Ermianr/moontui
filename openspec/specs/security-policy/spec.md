## ADDED Requirements

### Requirement: Security policy file exists
The repository root SHALL contain a file named `SECURITY.md` that describes how to report security vulnerabilities.

#### Scenario: SECURITY.md is present
- **WHEN** the repository root is inspected
- **THEN** a file named `SECURITY.md` SHALL exist
- **AND** it SHALL contain instructions for reporting vulnerabilities

### Requirement: Vulnerability reporting process is defined
The `SECURITY.md` SHALL specify a process for reporting security vulnerabilities, including whether to use GitHub's private vulnerability reporting or email.

#### Scenario: Reporter knows how to disclose
- **WHEN** a security researcher reads `SECURITY.md`
- **THEN** they SHALL find a clear channel for private disclosure (GitHub advisory or email)
- **AND** they SHALL find guidance on what information to include
- **AND** they SHALL find an expected response timeframe
