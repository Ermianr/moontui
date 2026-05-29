## ADDED Requirements

### Requirement: Dual TypeScript configuration
The `packages/core/` directory SHALL contain two TypeScript configuration files: `tsconfig.json` for development and `tsconfig.build.json` for production builds. Both SHALL extend the root `tsconfig.json` base configuration.

#### Scenario: Development type-checking
- **WHEN** a developer runs `tsc --noEmit` or their IDE performs type-checking
- **THEN** `tsconfig.json` SHALL be used with `noEmit: true` and `moduleResolution: "bundler"`
- **AND** it SHALL extend the root `tsconfig.json` via `"extends": "../../tsconfig.json"`
- **AND** no JavaScript or declaration files SHALL be emitted

#### Scenario: Production declaration generation
- **WHEN** the build script runs `tsc -p tsconfig.build.json`
- **THEN** `tsconfig.build.json` SHALL emit only `.d.ts` files to the `dist/` directory
- **AND** it SHALL override `noEmit` to `false`, enable `declaration: true`, and set `emitDeclarationOnly: true`
- **AND** it SHALL extend the local `tsconfig.json` via `"extends": "./tsconfig.json"`

### Requirement: TypeScript source is bundled for runtime
The build script SHALL use `bun build` to produce the runtime JavaScript bundle from `src/` into `dist/`.

#### Scenario: Building the library
- **WHEN** the build script runs with the `--lib` flag
- **THEN** it SHALL execute `bun build --target=bun --splitting --outdir=dist` for all entry points
- **AND** the output in `dist/` SHALL be executable by Bun

### Requirement: Entry points are exported via package.json exports map
The published `@moontui/core` package SHALL declare its public API through a `package.json` `exports` map pointing to the bundled files in `dist/`.

#### Scenario: Importing the main module
- **WHEN** a consumer writes `import { CliRenderer } from "@moontui/core"`
- **THEN** Bun SHALL resolve the import to `dist/index.js` as specified in the `exports` map

### Requirement: Source map generation
The build pipeline SHALL generate source maps for the bundled JavaScript output.

#### Scenario: Debugging a built package
- **WHEN** an exception is thrown inside `@moontui/core`
- **THEN** the stack trace SHALL map back to the original TypeScript source files via the generated `.js.map` files

### Requirement: TypeScript version is 6.0.3
The root `package.json` and `packages/core/package.json` SHALL specify `"typescript": "^6.0.3"` in `devDependencies` and `peerDependencies`.

#### Scenario: TypeScript 6 is available
- **WHEN** a developer runs `bun install`
- **THEN** TypeScript 6.0.3 or a compatible 6.x version SHALL be installed

### Requirement: Root scripts use bun workspace delegation
The root `package.json` scripts SHALL use `bun --filter @moontui/core` or `bun run --cwd packages/core` instead of `cd packages/core && bun run build`.

#### Scenario: Running build from root
- **WHEN** a developer runs `bun run build` from the repository root
- **THEN** the build SHALL execute in `packages/core/` context
- **AND** it SHALL NOT use `cd` or `&&` chaining in the script definition
