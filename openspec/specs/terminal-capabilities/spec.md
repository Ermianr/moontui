## ADDED Requirements

### Requirement: Capabilities struct
The system SHALL define a `Capabilities` struct with boolean fields: `rgb`, `ansi256`, `ansi16`.

#### Scenario: Default capabilities
- **WHEN** Capabilities is initialized with defaults
- **THEN** `rgb` SHALL be false
- **AND** `ansi256` SHALL be false
- **AND** `ansi16` SHALL be false

### Requirement: Environment variable detection
The system SHALL detect terminal capabilities from environment variables.

#### Scenario: COLORTERM truecolor
- **WHEN** the environment variable `COLORTERM` is set to "truecolor" or "24bit"
- **THEN** `capabilities.rgb` SHALL be true
- **AND** `capabilities.ansi256` SHALL be true

#### Scenario: WT_SESSION (Windows Terminal)
- **WHEN** the environment variable `WT_SESSION` is set
- **THEN** `capabilities.rgb` SHALL be true
- **AND** `capabilities.ansi256` SHALL be true

#### Scenario: TERM 256color
- **WHEN** the environment variable `TERM` contains "256color"
- **THEN** `capabilities.ansi256` SHALL be true

### Requirement: Windows defaults
The system SHALL apply Windows-specific capability defaults.

#### Scenario: Windows ConPTY
- **WHEN** the target platform is Windows
- **THEN** `capabilities.rgb` SHALL default to true
- **AND** `capabilities.ansi256` SHALL default to true

### Requirement: Fallback capabilities
The system SHALL provide safe fallback capabilities when detection fails.

#### Scenario: Unknown terminal
- **WHEN** no capability detection succeeds
- **THEN** `capabilities.ansi256` SHALL be true (minimum fallback)

### Requirement: Capability query
The system SHALL provide a `detect_capabilities()` function that returns the detected Capabilities.

#### Scenario: Detect capabilities with COLORTERM
- **WHEN** `detect_capabilities()` is called
- **AND** `COLORTERM=truecolor` is set
- **THEN** the returned Capabilities SHALL have rgb=true

#### Scenario: Detect capabilities on Windows
- **WHEN** `detect_capabilities()` is called on Windows
- **THEN** the returned Capabilities SHALL have rgb=true

### Requirement: Capability storage
The terminal struct SHALL store detected capabilities and provide access to them.

#### Scenario: Get capabilities
- **WHEN** `terminal.get_capabilities()` is called
- **THEN** it SHALL return the detected Capabilities