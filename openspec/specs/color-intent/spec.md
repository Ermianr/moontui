## ADDED Requirements

### Requirement: Color intent enum
The system SHALL define a `ColorIntent` enum with three variants: `Rgb`, `Indexed`, and `Default`.

#### Scenario: Color intent values
- **WHEN** a ColorIntent is created
- **THEN** it SHALL be one of: Rgb (0), Indexed (1), Default (2)

### Requirement: RGB color constructor
The system SHALL provide an `rgb_color(r, g, b, a)` function that creates an RGBA value with `ColorIntent::Rgb`.

#### Scenario: Create RGB color
- **WHEN** `rgb_color(255, 0, 0, 255)` is called
- **THEN** the returned RGBA SHALL have intent = Rgb
- **AND** the channel values SHALL be (255, 0, 0, 255)

### Requirement: Indexed color constructor
The system SHALL provide an `indexed_color(index, r, g, b)` function that creates an RGBA value with `ColorIntent::Indexed`.

#### Scenario: Create indexed color
- **WHEN** `indexed_color(9, 255, 0, 0)` is called
- **THEN** the returned RGBA SHALL have intent = Indexed
- **AND** the slot SHALL be 9
- **AND** the RGB snapshot SHALL be (255, 0, 0)

### Requirement: Default color constructor
The system SHALL provide a `default_color(r, g, b, a)` function that creates an RGBA value with `ColorIntent::Default`.

#### Scenario: Create default color
- **WHEN** `default_color(0, 0, 0, 255)` is called
- **THEN** the returned RGBA SHALL have intent = Default

### Requirement: Color intent accessor
The system SHALL provide an `intent(color)` function that extracts the ColorIntent from an RGBA value.

#### Scenario: Extract RGB intent
- **WHEN** an RGBA value with Rgb intent is created
- **AND** `intent(color)` is called
- **THEN** the result SHALL be ColorIntent::Rgb

#### Scenario: Extract indexed intent
- **WHEN** an RGBA value with Indexed intent is created
- **AND** `intent(color)` is called
- **THEN** the result SHALL be ColorIntent::Indexed

### Requirement: Palette slot accessor
The system SHALL provide a `slot(color)` function that extracts the palette slot from an indexed RGBA value.

#### Scenario: Extract palette slot
- **WHEN** `indexed_color(9, 255, 0, 0)` is created
- **AND** `slot(color)` is called
- **THEN** the result SHALL be 9

### Requirement: Channel accessors
The system SHALL provide `red(color)`, `green(color)`, `blue(color)`, and `alpha(color)` functions that extract 8-bit channel values.

#### Scenario: Extract red channel
- **WHEN** `rgb_color(255, 128, 0, 255)` is created
- **AND** `red(color)` is called
- **THEN** the result SHALL be 255

#### Scenario: Extract green channel
- **WHEN** `rgb_color(255, 128, 0, 255)` is created
- **AND** `green(color)` is called
- **THEN** the result SHALL be 128

### Requirement: ANSI 256-color palette
The system SHALL provide a `fallback_ansi256_color(index)` function that converts an ANSI 256-color index to an RGB color.

#### Scenario: Base 16 colors
- **WHEN** `fallback_ansi256_color(9)` is called
- **THEN** the result SHALL be (255, 0, 0, 255) with intent Rgb

#### Scenario: 6x6x6 color cube
- **WHEN** `fallback_ansi256_color(21)` is called
- **THEN** the result SHALL be (0, 0, 255, 255) with intent Rgb

#### Scenario: Grayscale ramp
- **WHEN** `fallback_ansi256_color(232)` is called
- **THEN** the result SHALL be approximately (8, 8, 8, 255) with intent Rgb

### Requirement: Color equality comparison
Two RGBA values SHALL be considered equal if and only if all four components are bitwise identical (including metadata).

#### Scenario: Same color same intent
- **WHEN** two RGBA values are created with the same channels and intent
- **THEN** they SHALL be equal

#### Scenario: Same channels different intent
- **WHEN** two RGBA values have the same channels but different intents
- **THEN** they SHALL NOT be equal