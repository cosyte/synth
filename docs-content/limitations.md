---
id: limitations
title: What it does and does not do
sidebar_position: 1
---

# What `@cosyte/synth` does and does not do

`@cosyte/synth` is a **format/conformance generator, not a clinical simulator (not Synthea); every
value is synthetic-by-construction; output is deterministic per seed within a version window; no
terminology is bundled; and there is no DICOM in v1.**

That one sentence governs the whole library. This page is the honest, blunt shape of the promise and
its edges, read it before you rely on `synth`. The **API Reference** is always the exact truth of what
a given release ships; this page is the shape of the whole.

## The promise (narrow, on purpose)

`@cosyte/synth` emits **deterministic, seedable, spec-clean (and, in quirk mode, deliberately
off-spec) synthetic fixtures** across the six cosyte formats, and **every value it emits is drawn from
a guaranteed-non-colliding synthetic source.**

- **Spec-clean by construction.** Each artifact is built **through the parser's own
  builder/serializer** (`@cosyte/hl7`'s `buildMessage`, `@cosyte/fhir`'s model + serializer,
  `@cosyte/ccda`'s `buildCcda`, the X12/NCPDP/ASTM domain builders), so it is spec-clean by the same
  mechanism that makes the parser's emit side spec-clean, and it is proven by feeding the output
  straight back into that parser and asserting **zero warnings**. `synth` never hand-writes wire bytes
  around a builder. **Who did the proving matters, and it is not the same answer for every format:
  see [Who checks the output, and who does not](#who-checks-the-output-and-who-does-not) below.**
- **Synthetic-by-construction.** There is no code path that can emit a name, identifier, date, phone,
  email, address, or IP not sourced from a reserved range or a shipped clearly-fake pool (see the
  posture below). This is the inverse of a de-identifier: `deid` proves real PHI is _gone_; `synth`
  proves plausibly-real PHI was _never generated_.
- **Deterministic.** The same seed yields **byte-identical** output on any machine, any run, the
  property every downstream regression and golden-file suite depends on. Determinism is threaded
  through a hand-rolled seeded PRNG (`splitmix32`/`sfc32`); `Math.random` is lint-banned in `src/`.

## Who checks the output, and who does not

**A round-trip is not an independent verdict.** Every artifact is built through a sibling parser's
own builder and then read straight back by that same parser, which reports zero warnings. That is a
real structural property and it is the one every format here carries. It is also **the same code
grading its own work**: where the builder and the reader share a misreading of a standard, the
round-trip cannot see it, because the misreading is on both sides of the check. So the round-trip is
the floor, not the ceiling, and it is worth exactly what it says and no more.

**One format is additionally graded by somebody who is not us.** On every change, the
HL7-maintained FHIR validator (the `validator_cli` tool published with FHIR itself, pinned by
version and by content digest so a verdict is attributable to a build) validates a seeded corpus of
generated FHIR R4 resources against **US Core 6.1.0**. **Any issue it reports at severity `error` or
`fatal` fails the build.** It is never recorded as a warning, never downgraded, and there is no
suppression list. If an artifact ever has to come out of the graded set, it is named, with its seed
and its reason, in the coverage declaration the run publishes alongside the verdict.

| Format               | Independent external verdict?                                       | Who grades it, or why nobody does                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FHIR R4**          | **Yes**, on every change                                             | The HL7-maintained FHIR validator, against US Core 6.1.0 on FHIR R4 4.0.1                                                                                                     |
| **HL7 v2**           | No: round-trip only                                                  | No public, file-based, offline HL7 v2 validator was found. The available conformance tooling is a hosted service with no documented command-line or file entry point           |
| **C-CDA R2.1**       | No: round-trip only                                                  | The public reference validator is server-shaped (a Java 8 web archive needing several gigabytes of memory, driven over an HTTP API) and ships none of the vocabulary it needs |
| **X12 005010**       | No: round-trip only                                                  | No public, file-based validator was found                                                                                                                                     |
| **NCPDP**            | No: round-trip only                                                  | No public, file-based validator was found                                                                                                                                     |
| **ASTM E1394/E1381** | No: round-trip only                                                  | No public, file-based validator was found                                                                                                                                     |

The table is **generated against the formats the library actually emits**, not maintained by hand: a
format that ships without an entry saying who grades it, or why nobody does, fails the run.

**What the FHIR verdict does not include.** The external run is configured with **no terminology
server**, deliberately: a verdict that depends on a live public service is reproducible by rerunning
a job rather than from a seed, and nothing generated here is sent to a third party for terminology
resolution. So the independent verdict covers structure and profile conformance against the pinned
package, and **terminology-bound checks (code membership in a value set) are not part of it**. Its
own record says so, alongside the exact list of endpoints the run contacted.

## What it does **not** do

These are **non-goals**, not missing features: named so nothing over-trusts the generator.

- **Not a clinical-simulation engine: this is the load-bearing boundary vs Synthea.** **Synthea**
  (MITRE) models each patient's disease progression and lifetime medical history and emits
  **clinically-coherent** records. `synth` is the opposite kind of tool: its randomness is
  **structural** (field shapes, delimiters, quirks, edge cases), not epidemiological. A `synth`-generated
  `ORU` may pair a diagnosis code and a result value that make no clinical sense, **and that is
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

Every PHI-bearing locus is filled from a source chosen so that it cannot denote a real person or
resource. Each row below names the authority that reserves the range or defines the check digit, **by
that authority's own published identifier**, so you can open the text and check the claim rather than
taking this page's word for it. Where a row draws an inference from its source instead of quoting
one, it says so. Two loci have **no** reserving authority at all and say that too, and one rests on a
source that is **not** the issuing agency and says what it is not.

| Locus | Source | Why it cannot be real, and the authority that says so |
| --- | --- | --- |
| **SSN** | area `900-999` with a group outside every published ITIN band, plus the fixed `987-00-432x` block | [SSA POMS RM 10201.035](https://secure.ssa.gov/poms.nsf/lnx/0110201035), Invalid Social Security Numbers (SSNs), defines an invalid SSN as "one that we never assigned" and identifies one by a first three digits (former area number) of `000`, `666`, or "in the 900 series", or a second group of two digits (former group number) of `00`. Both blocks above are invalid under that section. [IRS Internal Revenue Manual 3.21.263](https://www.irs.gov/irm/part3/irm_03-021-263r) adds the second authority sharing the number space: "An ITIN begins with a `9` and the 4th and 5th digits are 50-65, 70-88, 90-92 and 94-99", so a group outside those bands is not ITIN-formatted either. This replaces the earlier, uncited claim that SSA "never issues" these areas: what the manual states is invalidity, and that is what is cited. |
| **NPI** | 10 digits with a **deliberately-invalid Luhn** check digit | [69 FR 3434](https://www.federalregister.gov/documents/full_text/text/2004/01/23/04-1149.txt), the Department of Health and Human Services final rule adopting the NPI (FR Doc 04-1149), requires that "the NPI check digit calculation must always be performed as though the NPI is preceded by" `80840`, and that the check digit is "calculated using the ISO standard Luhn check digit algorithm", a modulus 10 double-add-double algorithm. A number whose check digit fails that calculation cannot be a validly issued NPI, and `isSyntheticNpi` proves the failure. This replaces the earlier attribution to a "CMS NPI check-digit rule, ISO 7812": the rule cited here is HHS's, and its text names neither ISO 7812 nor CMS as the rule's author. |
| **DEA** | registrant letter + last-name initial + 7 digits with a **deliberately-invalid** check digit | **Non-normatively sourced.** The formula this floor inverts is stated in a pharmacy journal article, [Gabay, Federal Controlled Substances Act: Controlled Substances Prescriptions, Hospital Pharmacy, PMC3847977](https://pmc.ncbi.nlm.nih.gov/articles/PMC3847977/): "add the sum of the first, third, and fifth digits to twice the sum of the second, fourth, and sixth digits. The total should be a number whose last digit is the same as the last digit of the DEA number". **That article is not the DEA**, and no DEA-published statement of the algorithm is cited here. `isSyntheticDea` proves the failure against that formula and nothing stronger, so if the formula is wrong this floor can emit a checksum-**valid** DEA number while asserting the opposite. |
| **Phone** | NANP `555-0100` through `555-0199` only | [NANPA, 555 Line Numbers](https://nanpa.com/numbering/555-line-numbers): "The fictitious, non-working numbers, 555-0100 through 555-0199, will remain reserved for entertainment/advertising." Not any 555 number: the same page lists `555-1212` and `555-4334` as still in use. |
| **Email / domain** | `example.com/.net/.org`, `.test/.example/.invalid/.localhost` | [RFC 2606](https://datatracker.ietf.org/doc/html/rfc2606), Reserved Top Level DNS Names: "To safely satisfy these needs, four domain names are reserved" (the four top-level names above), plus the second-level names `example.com`, `example.net` and `example.org`. [RFC 6761](https://datatracker.ietf.org/doc/html/rfc6761) section 6.5 carries them into the special-use registry: "The domains example., example.com., example.net., example.org., and any names falling within those domains, are special". |
| **IP** | `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32` | [RFC 5737](https://datatracker.ietf.org/doc/html/rfc5737): "The blocks 192.0.2.0/24 (TEST-NET-1), 198.51.100.0/24 (TEST-NET-2), and 203.0.113.0/24 (TEST-NET-3) are provided for use in documentation." [RFC 3849](https://datatracker.ietf.org/doc/html/rfc3849): "The prefix allocated for documentation purposes is 2001:DB8::/32". |
| **MRN / member / account** | a clearly-synthetic **assigning-authority** namespace (`COSYTE-SYNTH`) | **No authority reserves this locus.** An MRN is unique only inside its assigning authority and no registry reserves a range of them, so there is nothing external to cite and nothing is claimed. What the floor rests on instead is the _namespace_: every value is minted under an assigning authority this project invented and no real facility uses, so it cannot collide with a real record whatever its digits are. The OID `2.16.840.1.113883.19.999` is likewise a value this project chose, and no authority is cited for the root it sits under: no published text designating that root for example use could be shown, so no such designation is claimed here. |
| **ZIP** | `00000` | [USPS Postal Facts, Lowest ZIP Code number](https://facts.usps.com/lowest-zip-code/): "The lowest ZIP Code number is 00501, unique for the Internal Revenue Service in Holtsville, NY." `00000` is below `00501`, from which **this project infers** that it is not an assigned ZIP Code. The inference is ours, not the Postal Service's: USPS states the lowest assigned number and says nothing about `00000`. |
| **Names / streets / cities** | a shipped, curated **clearly-fake pool** | **No authority reserves this locus.** No registry reserves personal, street or city names, so there is nothing external to cite and nothing is claimed. What the floor rests on instead is the pool itself: every token is an invented, fixture-flavoured word (`Testina Testerson`, `Example Boulevard`, `Faketon`) that a reader can see at a glance names nobody, and no code path draws a name, street or city from anywhere else. |

The floors are enforced two ways: a **union `phi-scan`** (the parsers' own PHI scanners) sweeps a
representative generated corpus in CI and must report **zero** real-data hits, and a **property suite**
asserts, for arbitrary seeds and every format, that no emitted value escapes these sources. A quirk
fixture deviates _structure_, never _provenance_: the safety floor holds over quirk output too.

**The diagnostics have their own floor, and it is a different one.** The table above is about the
values `synth` emits. A separate guarantee covers what `synth` says about your call:

- A fatal message is a **fixed string from a frozen registry**. `SynthError` takes a code and no value
  parameter, so there is no position through which a value could reach `message`, `stack`, or a field
  on the thrown object.
- Caller-supplied **selectors** (a message kind, a document type, a corpus mix entry, a claim
  variant, a Bundle type, a resource profile, a quirk name) are resolved against their own closed set
  before anything is generated. An unrecognised one is a fatal `SYNTH_UNSUPPORTED_KIND` (or
  `SYNTH_UNSUPPORTED_QUIRK`), so it does not reach a peer builder that might quote it back and does
  not become an artifact `kind` or a manifest key.
- A round-trip result keeps only the sibling parser's warning **codes**, never the parser's message
  and never a snippet of the document.

Each of those is asserted per position, against a marker planted in each one, rather than argued from
the fact that a fixture generator's values are synthetic anyway. **The list of positions is an
enumeration, not a proof of exhaustiveness.** What holds generally is the mechanism: the error type
has no value parameter, and a selector is resolved against its closed set in one place, everywhere
except the `@cosyte/synth/deid` pairing loops. Those are the stated exception: `x12DeidLoop({ variant })`
and `ncpdpTelecomDeidLoop({ transaction })` still surface an uncoded `TypeError` for an unrecognised
value, and `ccdaDeidLoop({ documentType })` still generates a Referral Note for anything but `"ccd"`.
None echoes your value into a message, and all three are tracked separately.

**Three things it does not cover, stated rather than implied.** The **artifact** is not a diagnostic:
`content` is what you asked to be built and carries what you asked for, and the same goes for a name
pool or a profile name you supply and get handed back. A **document or model you pass to a round-trip
harness** is parsed by the sibling parser, and a fatal it raises on input it could not read is that
parser's diagnostic, not this one's. And a **caller-authored label** (a `SynthProfile` name, an
`Artifact` you construct yourself and hand to `makeCorpus`) is stored and returned verbatim, because
that is what you asked for; no `synth` code path derives anything from it.

```ts runnable
import {
  createRng,
  safe,
  isSyntheticSsn,
  isItinFormatted,
  isSyntheticNpi,
  isSyntheticDea,
} from "@cosyte/synth";

const rng = createRng(1);
// Every provider draws from a never-collide source: the checks below can never be false.
const nationalId = safe.ssn(rng);
// The SSN locus clears BOTH authorities that share its number space, not just SSA's.
const ssnOk = isSyntheticSsn(nationalId) && !isItinFormatted(nationalId);
ssnOk && isSyntheticNpi(safe.npi(rng)) && isSyntheticDea(safe.dea(rng)); // => true
```

## Determinism holds within a version window

A seed maps to the same bytes **within a documented compatibility window**, not across _major_
`synth` versions. A version bump may change a value list or the algorithm and thus the seed→bytes
mapping; that is a **documented breaking change**. For a long-lived golden fixture, **pin the `synth`
version alongside the seed.** Cross-engine determinism assumes the pinned toolchain (Node ≥22, ES2019+
stable sort and spec key order); it is not promised on arbitrary old engines.

## Coverage, and what is deferred

The spec-clean generation core is **feature-complete across all six formats**. Quirk mode and the
`deid` pairing loop ship for a subset; the honest gaps:

- **Vendor-quirk mode** ships for the three richest profile systems: **HL7 v2, C-CDA, ASTM**. Quirk
  recipes for **FHIR / X12 / NCPDP are deferred**, as is any quirk needing a private vendor corpus
  (built-in quirks are grounded only on **public** vendor profiles).
- **The `deid` pairing loop** ships for **HL7 v2, FHIR, C-CDA, X12, and NCPDP Telecom**. NCPDP
  **SCRIPT**, **ASTM**, and **DICOM** pairing are deferred (no adapter, or not generated:
  `DEID_LOOP_SKIPPED` names each).
- **Format-specific gaps flagged, never faked:** the X12 **270** request (no `build270` upstream) and
  NCPDP **SCRIPT lifecycle responses** are not generated, a gap is surfaced, never hand-written.
- **Built-in `synth` profiles.** `defineSynthProfile()` is the public growth-loop hook, and
  ready-made quirk profiles ship for the three quirk formats; broader **named site/vendor** recipes
  stay **consumer-authored** until a public spec grounds a built-in one (the same public-only
  discipline the parsers hold).
- **Optional Synthea clinical-content ingestion** (re-serialize Synthea's coherent records through the
  cosyte parsers) is a **documented future concern**, not a v1 promise.

## Licensing & PHI posture

- **The library is MIT.** Third-party **runtime** dependencies are **zero**; the parser and `deid`
  peers are first-party, optional, and lazily loaded per format.
- **HIPAA-capable, not HIPAA-compliant**, and here that framing is nearly vacuous, because there is no
  real PHI: `synth`'s entire output _looks like_ PHI and contains none, by construction. Every value
  it emits is drawn from the sources in the floor table above, and a `phi-scan` gate sweeps this project's own
  sources, fixtures and tooling on every change. You can commit and log a generated corpus without a
  PHI review of its contents: that is the whole point.
