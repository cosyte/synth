---
id: limitations
title: What it does — and does not do
sidebar_position: 1
---

# What `@cosyte/synth` does — and does not do

`@cosyte/synth` is a **format/conformance generator, not a clinical simulator (not Synthea); every
value is synthetic-by-construction; output is deterministic per seed within a version window; no
terminology is bundled; and there is no DICOM in v1.**

That one sentence governs the whole library. This page is the honest, blunt shape of the promise and
its edges — read it before you rely on `synth`. The **API Reference** is always the exact truth of what
a given release ships; this page is the shape of the whole.

## The promise (narrow, on purpose)

`@cosyte/synth` emits **deterministic, seedable, spec-clean (and, in quirk mode, deliberately
off-spec) synthetic fixtures** across the six cosyte formats — and **every value it emits is drawn from
a guaranteed-non-colliding synthetic source.**

- **Spec-clean by construction.** Each artifact is built **through the parser's own
  builder/serializer** (`@cosyte/hl7`'s `buildMessage`, `@cosyte/fhir`'s model + serializer,
  `@cosyte/ccda`'s `buildCcda`, the X12/NCPDP/ASTM domain builders), so it is spec-clean by the same
  mechanism that makes the parser's emit side spec-clean — and it is proven by feeding the output
  straight back into that parser and asserting **zero warnings**. `synth` never hand-writes wire bytes
  around a builder.
- **Synthetic-by-construction.** There is no code path that can emit a name, identifier, date, phone,
  email, address, or IP not sourced from a reserved range or a shipped clearly-fake pool (see the
  posture below). This is the inverse of a de-identifier: `deid` proves real PHI is _gone_; `synth`
  proves plausibly-real PHI was _never generated_.
- **Deterministic.** The same seed yields **byte-identical** output on any machine, any run — the
  property every downstream regression and golden-file suite depends on. Determinism is threaded
  through a hand-rolled seeded PRNG (`splitmix32`/`sfc32`); `Math.random` is lint-banned in `src/`.

## What it does **not** do

These are **non-goals**, not missing features — named so nothing over-trusts the generator.

- **Not a clinical-simulation engine — this is the load-bearing boundary vs Synthea.** **Synthea**
  (MITRE) models each patient's disease progression and lifetime medical history and emits
  **clinically-coherent** records. `synth` is the opposite kind of tool: its randomness is
  **structural** (field shapes, delimiters, quirks, edge cases), not epidemiological. A `synth`-generated
  `ORU` may pair a diagnosis code and a result value that make no clinical sense — **and that is
  correct**, because its job is to exercise the _parser_, not to be a plausible patient. `synth` does
  **not** reimplement Synthea (optional Synthea-content ingestion is a documented future concern, below).
- **Not statistically-representative populations.** No claim is made that a generated cohort matches any
  real-world distribution of age, sex, condition prevalence, or geography. `synth` optimizes for
  **structural coverage** (every message type, every quirk, every edge case), not demographic fidelity.
- **Not a load / performance-test harness.** A seeded corpus is a fine throughput input, but `synth`
  ships no benchmark runner.
- **No bundled terminology.** Codes (LOINC/SNOMED/ICD/RxNorm/CVX/NDC) come from a small **curated,
  license-clean** example pool (spec-example codes, invented `00000`-labeler NDCs, `X`-prefixed local
  codes) or a consumer-supplied pool. `synth` **never** bundles SNOMED, CPT, or a full LOINC table.
- **No real-data ingestion as a value source.** `synth` never reads a real patient record to "learn"
  values. The only external content it may consume (later, optionally) is Synthea output, itself
  synthetic and PHI-free by construction.
- **No DICOM (or any format outside the six).** DICOM Part 10 is binary with a distinct pixel-data
  hazard surface; v1 scopes the six text/EDI formats (HL7 v2, FHIR, C-CDA, X12, NCPDP, ASTM). A format
  `synth` does not support is a typed `SYNTH_UNSUPPORTED_FORMAT`, never a hand-written byte fallback.

## The synthetic-safety posture (the floors)

Every PHI-bearing locus is filled from a source **provably incapable of denoting a real person or
resource.** The floors, each an authoritative never-collide range or a deliberately-invalid check value:

| Locus                        | Source                                                                   | Why it cannot be real                                                            |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **SSN**                      | area `900–999` (never issued) + the `987-65-432x` advertising block      | SSA never issues these areas                                                     |
| **NPI**                      | 10 digits with a **deliberately-invalid Luhn** check digit               | a real NPI must pass Luhn — `isSyntheticNpi` proves the failure                  |
| **DEA**                      | registrant letter + 7 digits with a **deliberately-invalid** check digit | a real DEA must pass its checksum — `isSyntheticDea` proves the failure          |
| **Phone**                    | NANP `555-0100 … 555-0199` only                                          | the reserved fictional block (not "any 555 number")                              |
| **Email / domain**           | `example.com/.net/.org`, `.test/.example/.invalid/.localhost`            | RFC 2606 / RFC 6761 special-use                                                  |
| **IP**                       | `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32`     | RFC 5737 / RFC 3849 documentation ranges                                         |
| **MRN / member / account**   | a clearly-synthetic **assigning-authority** namespace (`COSYTE-SYNTH`)   | there is no reserved MRN range — so the _namespace_ is synthetic, not the digits |
| **ZIP**                      | `00000`                                                                  | not an assignable ZIP                                                            |
| **Names / streets / cities** | a shipped, curated **clearly-fake pool**                                 | not a realistic-name corpus that could match a real person at a real address     |

The floors are enforced two ways: a **union `phi-scan`** (the parsers' own PHI scanners) sweeps a
representative generated corpus in CI and must report **zero** real-data hits, and a **property suite**
asserts, for arbitrary seeds and every format, that no emitted value escapes these sources. A quirk
fixture deviates _structure_, never _provenance_ — the safety floor holds over quirk output too.

```ts runnable
import { createRng, safe, isSyntheticSsn, isSyntheticNpi, isSyntheticDea } from "@cosyte/synth";

const rng = createRng(1);
// Every provider draws from a never-collide source — the checks below can never be false.
isSyntheticSsn(safe.ssn(rng)) && isSyntheticNpi(safe.npi(rng)) && isSyntheticDea(safe.dea(rng)); // => true
```

## Determinism holds within a version window

A seed maps to the same bytes **within a documented compatibility window** — not across _major_
`synth` versions. A version bump may change a value list or the algorithm and thus the seed→bytes
mapping; that is a **documented breaking change**. For a long-lived golden fixture, **pin the `synth`
version alongside the seed.** Cross-engine determinism assumes the pinned toolchain (Node ≥22, ES2019+
stable sort and spec key order); it is not promised on arbitrary old engines.

## Coverage, and what is deferred

The spec-clean generation core is **feature-complete across all six formats**. Quirk mode and the
`deid` pairing loop ship for a subset; the honest gaps:

- **Vendor-quirk mode** ships for the three richest profile systems — **HL7 v2, C-CDA, ASTM**. Quirk
  recipes for **FHIR / X12 / NCPDP are deferred**, as is any quirk needing a private vendor corpus
  (built-in quirks are grounded only on **public** vendor profiles — ADR 0018).
- **The `deid` pairing loop** ships for **HL7 v2, FHIR, C-CDA, X12, and NCPDP Telecom**. NCPDP
  **SCRIPT**, **ASTM**, and **DICOM** pairing are deferred (no adapter, or not generated —
  `DEID_LOOP_SKIPPED` names each).
- **Format-specific gaps flagged, never faked:** the X12 **270** request (no `build270` upstream) and
  NCPDP **SCRIPT lifecycle responses** are not generated — a gap is surfaced, never hand-written.
- **Built-in `synth` profiles.** `defineSynthProfile()` is the public growth-loop hook, and
  ready-made quirk profiles ship for the three quirk formats; broader **named site/vendor** recipes
  stay **consumer-authored** until a public spec grounds a built-in one (the same public-only
  discipline the parsers hold).
- **Optional Synthea clinical-content ingestion** (re-serialize Synthea's coherent records through the
  cosyte parsers) is a **documented future concern**, not a v1 promise.

## Licensing & PHI posture

- **The library is MIT.** Third-party **runtime** dependencies are **zero**; the parser and `deid`
  peers are first-party, optional, and lazily loaded per format.
- **HIPAA-capable, not HIPAA-compliant** — and here that framing is nearly vacuous, because there is no
  real PHI: `synth`'s entire output _looks like_ PHI and contains none, by construction. Its own
  fixtures and shipped value pools carry `# synthetic: true` and are drawn from the reserved sources
  above; a `phi-scan` gate proves it on every change. You can commit and log a generated corpus without
  a PHI review of its contents — that is the whole point.
