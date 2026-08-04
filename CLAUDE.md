# @cosyte/synth — Project Guide for Claude

> **The long-form record is `documentation/agent-notes.md`** — the shipped-phase histories, the
> per-incident narratives and the measured evidence behind every one-line rule here, **relocated
> verbatim, not deleted** (meta-repo ADR 0023, amendment 2026-08-04). This file is always-read and
> every worker pays for it; that one is read on demand. A pointer written `notes#<section>` below names
> that section — **read it before you touch the thing the rule guards**, and when you refute
> something, correct it _there_ and keep the one-line rule here pointing at it.

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

- **Phases 1–9 shipped (SYNTH-1 … SYNTH-11) — the roadmap is complete.** Pre-alpha `0.0.x`. All six
  formats have spec-clean generators built through their sibling parser's own builder (HL7 v2, FHIR
  R4/US Core, C-CDA R2.1, X12 005010, NCPDP SCRIPT + Telecom, ASTM E1394/E1381), plus vendor-quirk
  mode for HL7 v2/C-CDA/ASTM and the `@cosyte/deid` pairing loop. Per-format public surface, what
  each is built through, and **every DEFERRED item** (X12 270; SCRIPT lifecycle responses;
  FHIR/X12/NCPDP quirks; NCPDP-SCRIPT/ASTM/DICOM deid pairing; Synthea ingestion):
  `notes#status--the-shipped-roadmap-in-full` (per-format subsections `notes#hl7-v2` through
  `notes#astm-synth-8`).
- **Never quote a version here** — `npm view @cosyte/synth version` is the only source of truth; a
  number written into this file is stale on the next release.
- **ON THE REGISTRY BUT IT FAILS TO INSTALL.** `@cosyte/synth` is published and a consumer install
  still fails: **`npm error code ERESOLVE` on `peerOptional @cosyte/fhir`** — measured against the
  live registry, and it fails **despite the peer being declared optional**, so do not reason from
  `peerDependenciesMeta` that it cannot. The peer is unpublished because `@cosyte/fhir` itself hits
  `FHIR-NPM-NAME`, a persistent unexplained npm **E403 on publish** — **not missing work** (`fhir` is
  built and staged on `main`). **Two different codes: `ERESOLVE` is ours, `E403` is `fhir`'s; a
  sibling's note generalising `E404` is not this.** **The "name-similarity" reading is RETRACTED**:
  it implies a rename, and the error never asked for one. **Do not rename anything** to chase it, and
  never write this up as resolved.
- The repo is **already public**, so flipping a repo public — still a non-waived act as **policy** —
  is not an outstanding item of **state** here; `npm publish` is covered by the standing waiver.
  **Publish state and visibility are independent: never infer one from the other, in either
  direction.**
- The six parsers **and `@cosyte/deid`** are **optional peer deps**, vendored for dev/test via the
  `mllp` pattern (`vendor/*.tgz`). **Third-party runtime deps stay at 0.** Refresh recipe, and the
  `peerDependencies` entry `pnpm remove` strips:
  `notes#optional-peer-deps-and-how-to-refresh-a-vendored-tarball`.

## Synthetic-safety and PHI discipline (why this package exists)

Correctness here is round-trip fidelity + seed-determinism + **synthetic-safety**. These are the
traps a fixture generator gets wrong exactly once.

- **No code path may emit a value not drawn from a reserved range or the shipped fake-name pool.**
  900-range SSNs, a **deliberately-invalid-Luhn** NPI (`safe.npi`), a **deliberately-invalid-checksum**
  DEA (`safe.dea`), `555-01xx` phones, `example.*` domains, TEST-NET addresses, synthetic-AA-scoped
  MRN/member/patient ids. Full posture: `docs-content/limitations.md`,
  `notes#shipped-phases-release-hardening-and-the-generator-core`.
- **A Luhn-valid NPI or a checksum-valid DEA in output is a HARD `phi-scan` hit** — never "fix" a
  synthetic identifier so it validates. Per-format scanner arms (X12 NM1/PER/REF; NCPDP SCRIPT
  `<NPI>`/`<DEANumber>` + Telecom CA/CB/CC/CD/CQ/CY/C2/DB; ASTM P-record fields 3/4/6):
  `notes#x12-005010-synth-6`, `notes#ncpdp-synth-7`, `notes#astm-synth-8`.
- **Never hand-write framing, checksums or envelopes — they are the parser's own, never faked.** The
  ASTM E1381 modulo-256 checksum and `0`–`7` frame numbers come from `composeAstmFrames`, the X12
  ISA/GS/ST…SE/GE/IEA envelope and HL spine from `@cosyte/x12`'s domain builders, and NCPDP goes
  through the public typed model + serializer, **never hand-written bytes**. `notes#astm-synth-8`,
  `notes#x12-005010-synth-6`, `notes#ncpdp-synth-7`.
- **Never let a builder default supply a wall-clock value.** `buildCcda`'s default
  `effectiveTime: new Date()` is **always overridden** with a synthetic date or the reproducibility
  contract silently breaks. `notes#c-cda-r21-synth-5`.
- **ASTM practice- and laboratory-assigned patient IDs are minted independently and must stay
  distinct** (`PRA`/`LAB`). `notes#astm-synth-8`.
- **Code/drug pools stay license-clean** — invented `00000`-labeler NDCs, public LOINC plus invented
  local codes, US Core validated against real profiles under `test/us-core-profiles/` (BYO, no IG
  bundled). **No NCPDP or terminology prose is ever bundled.**
  `notes#fhir-r4--us-core-synth-3--synth-4`.
- **A quirk deviates structure, never provenance** — `phi-scan` stays **zero** over quirk output.
  Every quirk is **publicly grounded** (ADR 0018), is a **post-serialize transform** (profile
  tolerance is parse-side) round-tripping to **exactly one intended warning**, and an unsupported one
  is a fatal `SYNTH_UNSUPPORTED_QUIRK`. `notes#vendor-quirk-mode-synth-9-phase-7`.
- **The `deid` pairing loop is CO-VALIDATION, not an independent audit of `@cosyte/deid`.** A
  surviving sentinel is a hard failure; the over-scrub guard is equally load-bearing. **Never widen
  the sweep past the former PHI loci** — provider/organization identity a de-identifier legitimately
  retains comes from the same synthetic pools and would read as a false survivor. It **consumes the
  shipped generators unchanged**, and `deidLoopPolicy` needs **no key context** — deliberately, so the
  loop stays a pure function of the seed. `notes#the-cosytedeid-pairing-loop-synth-10-phase-8`.
- **Never commit realistic PHI.** A vendor quirk is encoded only when a real de-identified document
  grounds it — never invented.

## Tech Stack (the shared `@cosyte/*` standard)

This repo inherits the canonical toolchain by depending on the published `@cosyte/*` config packages,
not by copying files. The source of truth is the meta-repo's `documentation/conventions.md` — this is
a summary.

- **Language:** TypeScript (strict, full rigor set incl. `noUncheckedIndexedAccess`) via
  `@cosyte/tsconfig`. **Target ES2023**, `NodeNext`. TypeScript 5.9.x, exact-pinned.
- **Build:** dual ESM + CJS + `.d.ts` via `tsup` (`@cosyte/tsup-config`); `attw` is a publish gate
  (per-condition types: `.d.ts` for `import`, `.d.cts` for `require`). The `attw` script is
  **`node scripts/attw.mjs --profile node16`, not the bare CLI** — see the guardrail below; the CLI
  reports a wholly-untyped pack as "does not contain types" and **exits 0**.
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

## Required checks on `main`

One ruleset protects `main`: **`required-checks`, id `19913330`**. **Read the live set back rather
than trusting any list written down** (`gh api "repos/cosyte/synth/rulesets?includes_parents=true"`) —
a hardcoded list goes stale and it is prose no test can check. Snapshot + why every context is pinned
to the GitHub Actions app: `notes#the-one-ruleset-that-protects-main`.

- **Extend that one ruleset in place; never add a second for the next gate.** An unpinned required
  context can be satisfied by any actor with write access posting a commit status of that name,
  without the workflow ever running. `notes#extend-that-one-ruleset-in-place`.
- **Never require a context before its workflow has completed on `main`** — every future PR goes
  PENDING and unmergeable with nothing saying why. `test-selection` and `smoke (22)`/`smoke (24)` are
  deliberately not required yet; read real names off a live check run, never off a workflow's
  `name:`. `notes#contexts-deliberately-not-required-yet`.
- **Never rename a required job, and never split a step out of one** — both silently un-require it
  and leave PRs pending rather than red (why `build` and `smoke` are one job in `smoke.yml`).
  `notes#things-that-silently-detach-or-hollow-out-a-required-check`.
- **Never narrow `include` in `vitest.config.ts`.** `pnpm test` takes no path arguments, so that one
  glob selects everything `ci / verify` runs, and **coverage does not backstop it** (measured over
  `src/**` only, so dropping every `synthetic-safety.property.test.ts` costs 0% and reds nothing).
  **For a synthetic-data generator that is the whole safety story.** Gated by
  `pnpm check:test-selection`. `notes#things-that-silently-detach-or-hollow-out-a-required-check`.
- **Never replace that gate's exact-match script rule with a parser, and never answer a hole in it
  with one more spelling** — analysing a shell string is unbounded; this is the half a refuter broke
  **three times** in `ncpdp`, each time in the remedy for the last. Its four deliberate shapes
  (resolved selection not globs; exact-match invocations ported verbatim; **derived** subjects under
  a **deny-list** scope, because the allow-list version was broken by a refuter; and self-test C, the
  backstop — **do not delete it thinking self-test A covers the derived rules**):
  `notes#the-test-selection-gate-and-its-four-deliberate-shapes`.
- **READ THE COUNTS OFF THE GATE, NOT OFF PROSE, AND MOVE THEM WHEN YOU ADD A TEST FILE.**
  `pnpm check:test-selection` prints watched / name-only / unwatched every run; they have gone stale
  **twice**. The numbers, and what the gate does **not** reach:
  `notes#know-the-denominator-and-what-the-gate-does-not-reach`.
- **Deleting a subpath from `exports` shrinks that gate's headline subject and it stays green**
  (measured). Not a free escape: it is a breaking change, and `scripts/smoke.mjs` derives its subpath
  set from the same map and **refuses** on disagreement. Two gates on one map, on purpose.
  `notes#narrowing-the-published-surface`.
- **Never require a workflow with no `pull_request` trigger** (`fuzz`, `scorecard`, `release`) — it
  strands every PR forever. `notes#requiring-a-workflow-with-no-pull_request-trigger`.
- **RE-MEASURE EVERY PORTED SENTENCE AGAINST THIS REPO — the one failure that repeated.** Two of
  three refuter passes found a false number or a false claim of reach carried over from `ncpdp`/`deid`
  rather than a hole in the mechanism. **Where a number is asserted, name what produced it; where
  reach is asserted, bound it to a route actually seeded.**
  `notes#re-measure-every-ported-sentence-against-this-repo`.
- **Nothing inside this repository can observe its own ruleset.** Delete it and every test still
  passes, every gate still prints OK, and this file still says `main` is protected. A ruleset makes a
  red check block a merge; it does not make the check correct.
  `notes#nothing-inside-this-repository-can-observe-its-own-ruleset`.

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
- **No diagnostic takes a value parameter.** `SynthError(code)` is the only error `src/` constructs
  and its message is a fixed entry in the frozen `SYNTH_FATAL_MESSAGES` table, so a caller string has
  no position through which to reach `message`, `stack` or a thrown field. **Adding a fatal means
  adding a registry entry, never a template string.** `notes#no-diagnostic-takes-a-value-parameter`.
- **Resolve every caller-supplied selector against its closed set** (`resolveKind`/`resolveMix`,
  `src/select.ts`) at the entry point, before anything is generated. **Not a style rule**: an
  unresolved selector reached an `err.message`/`err.stack` via a peer builder's `TypeError`, became an
  `Artifact.kind` and a `manifest.counts` key, and fell out of an exhaustive `switch` as `undefined`.
  All three were live. `notes#resolve-every-caller-supplied-selector-against-its-closed-set`.
- **Never claim `SynthError` being the only constructor is the whole guarantee** — `src/` can still
  surface a runtime `TypeError` or a peer parser's fatal on forwarded input. Harnesses keep
  `String(w.code)`, never a `message` or snippet; `test/phi/diagnostic-surface.test.ts` carries the
  proof. `notes#syntherror-being-the-only-constructor-is-not-the-whole-guarantee`.
- **Read the meta-repo's `documentation/repos/phi-audit.md` before touching that.** "Warning messages
  are PHI-free by construction" spread across thirteen repos as prose rather than shared code, and
  this package used the inherited sentence as a reason to bound nothing. **A new safety sentence is
  worth nothing without a slot in that table behind it.** `notes#the-phi-free-diagnostics-claim`.
- **▶ `attw` SAYS "does not contain types" AND EXITS 0, SO THE `attw` SCRIPT IS A WRAPPER
  (`node scripts/attw.mjs --profile node16`), NOT THE BARE CLI.** For a package that ships types that
  sentence means the declarations were **not in the tarball** — a broken publish reported as a pass —
  and no `--profile`, `--ignore-rules` or config setting reaches that early return. **The race only
  supplies the condition**, so the answer is not a lock, a lease or a build queue: the gate must be
  able to say its own inputs were missing, whatever removed them. `notes#the-attw-false-green-and-why-the-script-is-a-wrapper`.
- **Do NOT re-derive the exit-0 condition from the shape of the code — three refuter passes corrected
  it, each in the same direction.** "attw misses subpaths" is the plausible, wrong story: a
  **partial** loss is attw's own catch (`UntypedResolution`, exit 1); a **zero-byte** `.d.ts` still
  resolves, so an empty-declaration casualty makes **no exit-code claim at all**; and "missing" is a
  **proxy, not the key**, since `containsTypes()` reads any declaration in the packed tarball and an
  undeclared chunk declaration defeats it — a **known limit, filed rather than fixed; if you take it
  up, weaken the sentence rather than adding a fifth arm.** **A gate that reds correctly and then
  explains itself with a falsehood teaches the next reader the wrong story**, and this script gets
  copied to sixteen more manifests. `notes#the-false-green-needs-every-entry-point-untyped-at-once`,
  `notes#the-first-correction-was-also-wrong-in-the-same-direction`,
  `notes#missing-is-a-proxy-not-the-key-a-known-limit`.
- **`scripts/attw.mjs` carries two nets that catch different things** — a preflight that every
  relative path `package.json` promises exists and is non-empty (catches the build window and _names_
  the missing file), and a post-check on the untyped sentence (catches declarations on disk but
  excluded from the tarball, which the preflight structurally cannot see).
  `test/scripts/attw-gate.test.ts` pins both against the real binary plus a negative control.
  `notes#the-two-nets-in-scriptsattwmjs`.
- **The post-check reads a string, so the argument guard is an ALLOW-LIST, NOT A DENY-LIST**:
  `--profile` and `--no-definitely-typed` forwarded, everything else refused, "harmless" included. A
  deny-list was the second thing a refuter broke here — commander fuses a value to a short flag, so
  `-fjson` is neither `-f` nor `--format` and walked through to exit 0 with the sentence gone. **Do
  not answer this with a seventh spelling.** The `.attw.json` refusal stays separate: no argument
  guard of any shape reaches a config applied after argv.
  `notes#the-argument-guard-is-an-allow-list-not-a-deny-list`.
- **The seven `file:vendor/*.tgz` devDeps are NOT part of the `attw` story** — `npm pack` emits no
  `vendor/` and attw does not resolve bare external specifiers. A **stale** vendored tarball makes
  this gate neither red nor green; a **missing** one is a different thing this sentence does not
  cover. `notes#the-vendored-tarballs-are-not-part-of-the-attw-story`.
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
4. **No internal project bookkeeping on a public surface** (founder directive, 2026-07-27). What a
   consumer reads (`README.md`, `docs-content/`, the npm `description`, a release body) says what the
   software does and what changed; identifiers, phase/wave language, ADR numbers, meta-repo paths and
   `roadmap §N` citations belong in the changeset, `CHANGELOG.md`, the commit, the PR and the
   roadmap. It is a **translation** at the boundary, not a deletion — **repair the head of a line you
   strip an identifier from**. Gated by `pnpm check:no-internal-refs`, which keys on known prefixes
   (**a new programme prefix must be added by hand**) and catches identifiers, not English sentences
   about our process, so the reviewer still owns half the rule.
   `notes#no-internal-project-bookkeeping-on-a-public-surface`.

   **`SYNTH` is BOTH our item prefix AND the marker this package writes into what it generates**
   (`SYNTH-FAC`, `SYNTH-LIS`, `SYNTH-ANALYZER`, the `SYNTH-`+10-digit NCPDP message id). The
   separation is the explicit `SYNTHETIC_FIXTURE_TOKEN` list in the gate, never a shape rule.
   **Never re-key the identifier rule on the `WORD-N` shape**, and never "resync" the prefix list
   with a sibling's copy without re-reading why `SYNTH` is PRESENT here and ABSENT from `ncpdp`'s.
   `notes#synth-is-both-our-item-prefix-and-a-marker-in-generated-output`.

   **Four surfaces, three different answers.** Browsable Markdown, npm metadata and `/** */` doc
   comments are **gated**; string literals are **gated too, and here they matter most — they are the
   bytes this package emits**; `//` and plain `/* */` comments are **not gated and identifiers are
   welcome in them**, because the convention says source comments are a place identifiers belong.
   **Do not justify this boundary from what reaches `dist/`** — effectively all of `src/` does, and
   two attempts to argue it that way in a sibling repo were false and both caught by a refuter. The
   line is not what reaches a consumer's disk but what a consumer is **shown**.
   `notes#four-surfaces-three-different-answers`.

   Two consequences: **removing a doc comment to satisfy the gate is a regression**, not a fix; and
   **when a stale claim is what carries the phase number, cut the sentence rather than reword it** —
   rewording leaves a falsehood standing in cleaner clothes. The gate cannot read `dist/`, so it
   gates the source of the published text, not the published text.
   `notes#two-consequences-doc-comments-and-stale-phase-claims`.
