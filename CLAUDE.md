# @cosyte/synth

A deterministic, seedable generator of synthetic healthcare fixtures (HL7 v2, FHIR R4 / US Core,
C-CDA, X12, NCPDP, and ASTM) for Node.js. Tooling, not a parser: each format is built through its
sibling `@cosyte/*` parser's builder (optional peers, `^0.1`, deid `^0.1.5 || ^0.2.0`, installed
from npm for the tests), so a seed gives the same bytes on the same parser versions. Public, MIT,
on npm, no runtime deps.

@AGENTS.md

## Gate

From the repo root, in order; comments name the workflow. pnpm 10 (`packageManager`) must be first
on PATH, as AGENTS.md says: tests call `pnpm build`, and pnpm 12 refuses this repo.

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check   # ci.yml, the shared cosyte/.github ci.yml
pnpm phi-scan                 # ci.yml; the pre-commit hook runs `pnpm phi-scan --staged`
pnpm test && pnpm test:coverage && pnpm build && pnpm attw   # ci.yml; coverage floor 100%
pnpm quality:check --base origin/main   # ci.yml coverage-ratchet; mutation job and weekly run in CI
pnpm examples && pnpm smoke   # ci.yml examples job, smoke.yml
pnpm check:install            # install.yml: packs this tree and installs it (needs the network)
pnpm check:test-selection     # test-selection.yml
pnpm run determinism:digest && pnpm run check:determinism-window   # ci.yml; digest on 22, 24, 26
pnpm run acquire:oracle && pnpm run oracle   # ci.yml oracle job: needs `java` and the network
pnpm check:no-emdash && pnpm check:no-internal-refs   # no-emdash.yml, no-internal-refs.yml
pnpm check:readme && pnpm check:claude-card && pnpm check:catalog && pnpm check:process
```

Only CI runs the shared prepublish checks, actionlint and CodeQL. `no-emdash.yml` also reads the PR
title, body and commits: check yours with `pnpm check:no-emdash --stdin pr < body.md` first.

## Hazard

Everything here is synthetic, so the risk is a value realistic enough to pass for real, or one a
real person holds. Identifiers come only from reserved ranges or the shipped name pool: NPIs failing
Luhn, DEAs failing their checksum, SSNs outside SSA and ITIN ranges (#52), `555-01xx` phones,
`example.*` domains, TEST-NET addresses. A Luhn-valid NPI or a valid DEA is a `pnpm phi-scan` hit.

## Rules (each cites the cosyte/synth PR that paid for it)

- A fatal is `SynthError(code)` with its text in `SYNTH_FATAL_MESSAGES`, never built from a value;
  resolve caller selectors with `resolveKind` / `resolveMix` first: one reached `err.message` (#29).
- A package change adds `.changeset/<slug>.md`. The release writes `CHANGELOG.md` and `VERSION` in
  `src/index.ts`: never edit either or add `[Unreleased]` (0.0.1 to 0.0.7 shipped one, #45, #39).
- `pnpm attw` is script-utils' `cosyte-attw`, its profile set by `scripts/attw.exclude`. Never use
  bare `attw`, which exits 0 on a pack with no types (#36).
- Never narrow `include` in `vitest.config.ts` or edit the `test` / `test:coverage` scripts: #25
  showed that drops the synthetic-safety suites with CI green. Stage a new test file before
  `pnpm check:test-selection`: it reads only tracked files.
- Clear a flagged synthetic name or address with one exact `scripts/phi-allow-list.txt` entry
  (`NAME`, `EMAIL`; `EMAILDOMAIN` only for a reserved domain, #49). `--allow-fixture` exits 2 (#61).
- A parser bump can change bytes with this package unchanged (#67): after moving a sibling, run
  `pnpm test` and `determinism:digest`. A moved baseline needs a major changeset or (D57,
  2026-11-07) an `Output change:` section naming every moved format; the window check refuses else.
- No item ids, phase names or internal paths in what a consumer reads: `README.md`, `docs-content/`,
  the npm `description`, `src/` doc comments and strings. Its gate sees ids, not prose (#18).
- Say a thing works or is covered only after running it or reading the workflow's steps, and
  re-measure claims ported from sibling repos: #25, #55 and #67 each corrected a reasoned claim.
