# AGENTS.md

`@cosyte/synth` generates deterministic, seedable synthetic healthcare fixtures (HL7 v2, FHIR R4 and
US Core, C-CDA, X12, NCPDP, and ASTM) for Node.js and TypeScript, published to npm under MIT. It is
tooling, not a parser: each format is built through its sibling `@cosyte/*` parser's builder, so a
seed gives the same bytes on the same parser versions. It has zero runtime dependencies.

## Build and test

Use the pnpm version that `packageManager` in `package.json` pins: run
`corepack enable pnpm --install-directory <dir>` and put `<dir>` first on `PATH`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

## The gate

A pull request is ready when these pass. Comments name the workflow that runs each one.

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check   # ci.yml
pnpm phi-scan                                      # ci.yml
pnpm test && pnpm test:coverage && pnpm build && pnpm attw   # ci.yml
pnpm examples && pnpm smoke                        # ci.yml, smoke.yml
pnpm check:install                                 # install.yml (needs the network)
pnpm check:test-selection                          # test-selection.yml
pnpm run determinism:digest && pnpm run check:determinism-window   # ci.yml
pnpm run acquire:oracle && pnpm run oracle         # ci.yml (needs java and the network)
pnpm check:no-emdash && pnpm check:no-internal-refs
pnpm check:readme && pnpm check:claude-card && pnpm check:agent-notes   # ci.yml
pnpm check:catalog                                 # ci.yml
```

A package change adds a changeset (`pnpm changeset`). A change to the bytes a seed produces is a
breaking change.

## Data

Synthetic data only, and that is this package's whole purpose: every identifier comes from a
reserved range or the shipped name pool, and nothing it emits may be valid for a real person (no
Luhn-valid NPI, no checksum-valid DEA). Never put real patient data in a test, a fixture, an
example, an issue, or a log.

## Contributing

See [CONTRIBUTING.md](https://github.com/cosyte/.github/blob/main/CONTRIBUTING.md).
