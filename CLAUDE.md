# @cosyte/synth

A deterministic, seedable generator of synthetic healthcare fixtures (HL7 v2, FHIR R4 / US Core,
C-CDA, X12, NCPDP, ASTM) for Node.js. Tooling, not a parser: each format is built through its
sibling `@cosyte/*` parser's builder (optional peers, vendored in `vendor/`), so a seed gives the
same bytes on the same parser versions. Public, MIT, on npm, zero runtime dependencies.

## Gate

From the repo root, in order; comments name the workflow. The `pnpm` on PATH must be pnpm 10
(`packageManager`): tests call `pnpm build`, and pnpm 12 refuses this repo. If `pnpm --version` is
not 10, run `corepack enable --install-directory <dir> pnpm` and put `<dir>` first on PATH.

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check   # ci.yml, the shared cosyte/.github ci.yml
pnpm phi-scan                 # ci.yml; the pre-commit hook runs `pnpm phi-scan --staged`
pnpm test && pnpm test:coverage && pnpm build && pnpm attw   # ci.yml; coverage floor 90%
pnpm examples && pnpm smoke   # ci.yml examples job, smoke.yml
pnpm check:install            # install.yml: packs this tree and installs it (needs the network)
pnpm check:test-selection     # test-selection.yml
pnpm run determinism:digest && pnpm run check:determinism-window   # ci.yml; digest on 22 and 24
pnpm run acquire:oracle && pnpm run oracle   # ci.yml oracle job: needs `java` and the network
pnpm check:no-emdash && pnpm check:no-internal-refs   # no-emdash.yml, no-internal-refs.yml
actionlint                    # on PATH here; CI runs it through reviewdog
```

Only CI runs the shared prepublish checks and CodeQL. `no-emdash.yml` also reads the PR title, body
and commits: check yours with `pnpm check:no-emdash --stdin pr < body.md` before pushing.

## Hazard

Everything here is synthetic, so the risk is not leaking PHI but emitting a value realistic enough
to pass for real, or one a real person holds. Identifiers come only from reserved ranges or the
shipped name pool: NPIs that fail Luhn, DEAs that fail their checksum, SSNs outside SSA-issued and
IRS ITIN ranges (#52), `555-01xx` phones, `example.*` domains, TEST-NET addresses. Never make one
valid: a Luhn-valid NPI or checksum-valid DEA in output is a `pnpm phi-scan` hit.

## Rules (each cites the cosyte/synth PR that paid for it)

- A fatal is `SynthError(code)` with its text in `SYNTH_FATAL_MESSAGES`, never built from a value;
  resolve caller selectors with `resolveKind` / `resolveMix` first: one reached `err.message` (#29).
- A package change adds `.changeset/<slug>.md`. Never edit `CHANGELOG.md` or add `[Unreleased]`:
  the release writes it, and 0.0.1 to 0.0.7 shipped one with no version headings (#45).
- Never hand-edit `VERSION` in `src/index.ts`: `scripts/sync-version.mjs` sets it at release (#39).
- `pnpm attw` is `scripts/attw.mjs`. Never use bare `attw` or add flags beyond `--profile` and
  `--no-definitely-typed`: bare attw exits 0 on a pack with no types (#36).
- Never narrow `include` in `vitest.config.ts` or edit the `test` / `test:coverage` scripts: #25
  showed that drops the synthetic-safety suites with CI green. Stage a new test file before
  `pnpm check:test-selection`: it reads only tracked files.
- Clear a flagged synthetic name or address with one exact `scripts/phi-allow-list.txt` entry
  (`NAME`, `EMAIL`; `EMAILDOMAIN` only for a reserved domain, #49). `--allow-fixture` exits 2 (#61).
- A parser bump can change bytes with this package unchanged (#67). After refreshing a vendored
  tarball, run `pnpm test` and `pnpm run determinism:digest`, and update `BINARY_EXEMPT_PATHS` in
  `scripts/phi-scan.ts`. A moved determinism baseline is a breaking change.
- No item ids, phase names or internal paths in what a consumer reads: `README.md`, `docs-content/`,
  the npm `description`, `src/` doc comments and strings. Its gate sees ids, not prose (#18).
- Say a thing works or is covered only after running it or reading the workflow's steps, and
  re-measure claims ported from sibling repos: #25, #55 and #67 each corrected a reasoned claim.
