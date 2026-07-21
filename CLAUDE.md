# @cosyte/synth — Project Guide for Claude

## Project

**`@cosyte/synth`** — a deterministic, seedable **synthetic healthcare-fixture generator** for
Node.js/TypeScript, published under the Cosyte brand. Open-source (MIT). It is a **consumer** of the
sibling `@cosyte/*` parsers, **not a parser** — it builds artifacts _through_ each parser's own
builder/serializer (spec-clean by construction) and draws every value from a guaranteed-non-colliding
synthetic source. See the roadmap `operations/roadmaps/synth.md` in the meta-repo.

**North star:** a developer writes `generateAdt({ seed: 12345 })` and gets a structurally-valid HL7 v2
message whose every identifier/name/date is provably synthetic and which round-trips through
`@cosyte/hl7` with zero warnings — and the _same seed_ on any machine yields the _byte-identical_
message. The central reflex is neither the parser's liberal parse nor a de-identifier's fail-closed —
it is **synthetic-by-construction**: no code path can emit a value not drawn from a reserved range or
the shipped fake-name pool. It borrows the archetype's _disciplines_ (immutability, stable typed codes,
the profile system) but its correctness is round-trip fidelity + seed-determinism + synthetic-safety,
not wire tolerance. **It is a format/conformance generator, NOT a clinical simulator (that is Synthea).**

## Status

- **Phase 1 shipped (SYNTH-1).** Pre-alpha `0.0.x`, not yet published to npm. The generator core is in
  place: the seeded PRNG (`createRng`, `src/rng/`), the synthetic-safety providers (`src/safe/`), the
  `Corpus` abstraction, `defineSynthProfile`, the `SYNTH_FATAL_CODES`/`SynthError`, and HL7 v2
  generation at the `@cosyte/synth/hl7` subpath (`generateAdt`/`roundTrip`/`hl7Corpus`), proving the
  round-trip harness + synthetic-safety CI gate end-to-end. `@cosyte/hl7` is an **optional peer dep**,
  vendored for dev/test (`vendor/cosyte-hl7-0.0.0.tgz`) via the `mllp` pattern; refresh it by re-running
  `pnpm -C ../hl7 build && pnpm -C ../hl7 pack --out ../synth/vendor/cosyte-hl7-0.0.0.tgz` then
  `pnpm add -D @cosyte/hl7@file:vendor/cosyte-hl7-0.0.0.tgz` (restore the `peerDependencies` entry after
  if `pnpm remove` stripped it). **Third-party runtime deps stay at 0.** The remaining formats (the
  rest of HL7, FHIR, C-CDA, X12, NCPDP, ASTM) and quirk generation are later phases.

## Tech Stack (the shared `@cosyte/*` standard)

This repo inherits the canonical toolchain by depending on the published `@cosyte/*` config packages,
not by copying files. The source of truth is the meta-repo's `documentation/conventions.md` — this is
a summary.

- **Language:** TypeScript (strict, full rigor set incl. `noUncheckedIndexedAccess`) via
  `@cosyte/tsconfig`. **Target ES2023**, `NodeNext`. TypeScript 5.9.x, exact-pinned.
- **Build:** dual ESM + CJS + `.d.ts` via `tsup` (`@cosyte/tsup-config`); `attw` is a publish gate
  (per-condition types: `.d.ts` for `import`, `.d.cts` for `require`).
- **Node:** **>= 22** (CI matrix 22 + 24).
- **Package manager:** `pnpm@10`.
- **Lint/format:** **ESLint 10** + unified `typescript-eslint` (type-checked) via
  `@cosyte/eslint-config`; Prettier via `@cosyte/prettier-config`. Lint at `--max-warnings=0`.
- **Testing:** **Vitest 4** + v8 coverage (`@cosyte/vitest-config`), per-directory >= 90 gates; the
  property-based conformance invariants come from `@cosyte/test-utils` (round-trip, lenient-mode,
  immutability, warning-code stability) — the format-specific arbitraries stay in this repo.
- **CI/CD:** thin callers of the reusable `cosyte/.github` workflows.
- **Runtime deps:** **Zero.** Node stdlib only.
- **License:** MIT.

## Engineering Guardrails

- No `any`. No unjustified `as` casts. Use `unknown` and narrow.
- JSDoc (with `@example`) on every public export — the JSDoc lint rule is an **error** on public
  exports, so this is enforced, not optional.
- Immutable by default. Mutation only via explicit methods.
- No `console.*` in library code. Throw typed errors or return results.
- Short, testable functions over big parsing blobs.
- Postel's Law: parser is liberal (lenient default + warnings), serializer is conservative (always
  emits spec-clean output).
- Fatal errors only for unrecoverable structural corruption (Tier-3 codes). Everything else is a
  warning with a stable code + positional context.
- Coverage: per-directory >= 90% (lines/branches/functions/statements), enforced by
  `pnpm test:coverage`.

## Standing disciplines (every change)

Mirrors the three disciplines in the meta-repo's `documentation/conventions.md` — they bind here too:

1. **Documentation follows code** — a change to the public surface/stack/status isn't done until the
   docs are: this repo's docs content (`README.md`, `docs-content/`), the meta-repo
   `documentation/repos/synth.md` (bump its "last verified" date), and the `ecosystem-map.md`
   status table.
2. **Version + changelog** — a Changeset (`patch` on the `0.0.x` ladder) + a `CHANGELOG.md`
   `[Unreleased]` entry per meaningful change. Renaming a stable warning code is a **breaking change**.
3. **Crew + knowledgebase loop** — if this parser's public API or warning codes change, flag/update
   the matching `crew` healthcare skill + the KB product doc.
