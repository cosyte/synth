# AGENTS.md

`@cosyte/synth` generates deterministic, seedable synthetic healthcare fixtures (HL7 v2, FHIR R4 and
US Core, C-CDA, X12, NCPDP, and ASTM) for Node.js and TypeScript, published to npm under MIT. It is
tooling, not a parser: each format is built through its sibling `@cosyte/*` parser's builder, so a
seed gives the same bytes on the same parser versions. It has zero runtime dependencies.

## Build and test

Use Node.js 22.22.2 or later (the floor `@cosyte/process` sets for the dev tools; the package itself
runs on Node 22.12 or later) and the pnpm version that `packageManager` in `package.json` pins: run
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
pnpm check:process                                 # ci.yml documents job
pnpm check:docs-reference                          # ci.yml documents job
pnpm run determinism:digest && pnpm run check:determinism-window   # ci.yml
pnpm run acquire:oracle && pnpm run oracle         # ci.yml (needs java and the network)
pnpm check:no-emdash && pnpm check:no-internal-refs
pnpm check:readme && pnpm check:claude-card && pnpm check:catalog   # ci.yml
```

A package change adds a changeset (`pnpm changeset`). A change to the bytes a seed produces is a
breaking change. A change to an export regenerates the API reference in `docs-content/api/` with
`pnpm docs:reference`; every export needs a TSDoc summary.

## The testing standard

`quality-floor.json` holds the coverage and the mutation score CI measures, and they only rise.
`pnpm quality:check` holds coverage to it (after `pnpm test:coverage`); with `--base origin/main`
every changed line coverage counts must also have run, and no floor may be lowered. On a pull
request CI's `mutation` job mutates the changed source files with `stryker.config.mjs`
(`pnpm mutate changed --base origin/main`, then `pnpm quality:mutation --base origin/main`) and
every mutant in the changed lines must be killed. `.github/workflows/weekly-mutation.yml` runs the
full run (`pnpm mutate:full`) twice a week, in eight shards, and holds its score to the floor. To
raise a floor, run `pnpm quality:raise` after a full run and open a pull request.

Every property test runs through `test/support/property.ts`: 100 cases a property on a pull
request (a sweep may name more, never fewer), and 10,000 each night
(`.github/workflows/nightly-properties.yml`, which runs `pnpm test:property`). Each property prints
its seed. Never call `fc.assert` directly: `test/quality-standard.test.ts` refuses it. The seed-sweep
fuzz target keeps its own nightly run, `pnpm fuzz`. CI runs the suite on Linux and macOS, on
Windows in the `windows` job (every step of `verify` but attw, which cannot start there yet), and
under Bun; not yet under Deno (see `ci.yml`). A test that cannot run on a system is skipped there
by name, with its reason beside it.

CI's `scaling-gate` job runs `pnpm test:perf`, the scaling gates in
`scripts/perf/scaling-gate.perf.ts`: they fail when a corpus generator's cost grows faster than the
number of artifacts it builds. They run apart from `pnpm test` and never under coverage.

## Benchmarks

`bench/synth.bench.mjs` measures the built package on the work callers ask of it: one artifact from
a seed, and corpora of a hundred to tens of thousands of artifacts in each format (HL7 v2, FHIR
resources, US Core Patients and document Bundles, C-CDA, X12, NCPDP, ASTM), the synthetic patient
identities underneath them, and the cost of a seed. Every input is a seed and a count, so every value
is synthetic.

```sh
pnpm build
pnpm bench:reading --out bench-results/reading.json --summary bench-results/reading.md
node bench/budgets.mjs bench-results/reading.json
pnpm bench:compare --base <base checkout>/dist/index.mjs --head dist/index.mjs
pnpm bench:profile --out bench-results/profile
```

A reading reports throughput, latency p50/p95/p99, allocations, peak heap, a long run for leaks,
and the cold import of the root entry with its gzip size. `pnpm bench:profile` adds the peak memory
and single-call time of every size of a thousand artifacts or more, the cold import of each subpath,
the cost of a seed, and a CPU and heap profile of the hottest paths. On a pull request CI compares
the base build with the head at each shape's first size, and `.github/workflows/bench.yml` takes a
reading and a profile on a hosted runner when `bench/` changes. Both are advisory.

## Data

Synthetic data only, and that is this package's whole purpose: every identifier comes from a
reserved range or the shipped name pool, and nothing it emits may be valid for a real person (no
Luhn-valid NPI, no checksum-valid DEA). Never put real patient data in a test, a fixture, an
example, an issue, or a log.

## Contributing

See [CONTRIBUTING.md](https://github.com/cosyte/.github/blob/main/CONTRIBUTING.md).
