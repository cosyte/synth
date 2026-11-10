# src/deid

`@cosyte/synth/deid`, the **`@cosyte/deid` pairing loop**: a deterministic,
seeded **co-validation harness** for the `synth` ⇄ `deid` pair.

For each covered format it **generates** a spec-clean synthetic artifact through `@cosyte/synth`'s own
generators, **enumerates** the distinctive synthetic PHI sentinels planted at the patient loci,
**de-identifies** it through `@cosyte/deid`, and **verifies** that every planted sentinel is gone from
the de-identified output while the clinical payload survives. A surviving sentinel is a hard failure;
an over-scrubbed clinical value is a hard failure.

**Scope & honesty.** This proves *the pair works on `synth`'s own output*: it
is **not** an independent audit of `@cosyte/deid` against real-world documents. The sentinels are
synthetic-by-construction (never realistic); a sentinel `deid` **blocks** rather than redacts still
passes (blocked = gone). The loop covers the five formats both packages support
([DEID\_LOOP\_COVERED\_FORMATS](#deid_loop_covered_formats)); NCPDP **SCRIPT**, **ASTM**, and **DICOM** are **skipped and
named** ([DEID\_LOOP\_SKIPPED](#deid_loop_skipped)), never silently. `@cosyte/deid` is an **optional peer dependency**
(the `mllp`/`ncpdp` vendoring pattern); importing this subpath pulls it in.

## Interfaces

### CcdaDeidLoopOptions

Options accepted by [ccdaDeidLoop](#ccdadeidloop).

#### Properties

##### documentType?

> `readonly` `optional` **documentType?**: [`CcdaDeidDocumentType`](#ccdadeiddocumenttype)

The document type. Defaults to `"ccd"`.

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed. Defaults to `0`.

***

### DeidCoverageRow

A per-format row of a [DeidCoverageSummary](#deidcoveragesummary).

#### Properties

##### artifacts

> `readonly` **artifacts**: readonly `string`[]

The concrete artifacts run for this format.

##### clinicalProbed

> `readonly` **clinicalProbed**: `number`

Total clinical tokens probed for over-scrub.

##### clinicalScrubbed

> `readonly` **clinicalScrubbed**: `number`

Total clinical tokens over-scrubbed, **0** on a clean pass.

##### format

> `readonly` **format**: `string`

The covered format.

##### pass

> `readonly` **pass**: `boolean`

`true` iff every run for this format passed.

##### planted

> `readonly` **planted**: `number`

Total distinctive PHI sentinels planted across the runs.

##### survivors

> `readonly` **survivors**: `number`

Total surviving sentinels, **0** on a clean pass.

***

### DeidCoverageSummary

The aggregate coverage summary across a set of loop runs.

#### Properties

##### allPass

> `readonly` **allPass**: `boolean`

`true` iff every run passed.

##### byFormat

> `readonly` **byFormat**: readonly [`DeidCoverageRow`](#deidcoveragerow)[]

One row per format.

##### skipped

> `readonly` **skipped**: readonly \[`Readonly`\<\{ `format`: `"ncpdp-script"`; `reason`: `"@cosyte/deid ships no NCPDP SCRIPT locus map; synth generates SCRIPT but the loop cannot pair it."`; \}\>, `Readonly`\<\{ `format`: `"astm"`; `reason`: `"@cosyte/deid ships no ASTM adapter; synth generates ASTM but the loop cannot pair it."`; \}\>, `Readonly`\<\{ `format`: `"dicom"`; `reason`: `"@cosyte/synth does not generate DICOM, so there is nothing to pair."`; \}\>\]

The named, deliberately-skipped format paths (from [DEID\_LOOP\_SKIPPED](#deid_loop_skipped)).

##### totalClinicalScrubbed

> `readonly` **totalClinicalScrubbed**: `number`

Total clinical over-scrubs across every run, **0** on a clean pass.

##### totalPlanted

> `readonly` **totalPlanted**: `number`

Total sentinels planted across every run.

##### totalSurvivors

> `readonly` **totalSurvivors**: `number`

Total surviving sentinels across every run, **0** on a clean pass.

***

### DeidLoopResult

The verdict of one pass through the pairing loop for one artifact.

`pass` is `true` **iff** at least one sentinel was planted, **no** planted sentinel survived
de-identification, and **no** probed clinical value was over-scrubbed.

#### Example

```ts
import { hl7DeidLoop } from "@cosyte/synth/deid";
const r = hl7DeidLoop({ seed: 42 });
r.pass;            // => true
r.survivors.length; // => 0
```

#### Properties

##### artifact

> `readonly` **artifact**: `string`

The concrete artifact label (e.g. `"ORU^R01"`, `"837P"`, `"CCD"`).

##### clinicalProbed

> `readonly` **clinicalProbed**: readonly `string`[]

The non-PHI clinical code tokens probed for over-scrub (present in the spec-clean artifact).

##### clinicalScrubbed

> `readonly` **clinicalScrubbed**: readonly `string`[]

Probed clinical tokens missing after de-identification (over-scrub), **must be empty**.

##### deidentified

> `readonly` **deidentified**: `string`

The serialized de-identified artifact (`@cosyte/deid`'s output).

##### format

> `readonly` **format**: [`DeidLoopFormat`](#deidloopformat)

The covered format.

##### original

> `readonly` **original**: `string`

The spec-clean serialized artifact (before de-identification).

##### pass

> `readonly` **pass**: `boolean`

`true` iff sentinels were planted, none survived, and nothing clinical was over-scrubbed.

##### planted

> `readonly` **planted**: readonly [`DeidSentinel`](#deidsentinel)[]

Every distinctive synthetic PHI sentinel `synth` planted at a patient locus of the artifact.

##### seed

> `readonly` **seed**: `number`

The seed, the same seed yields the same artifact and the same verdict.

##### survivors

> `readonly` **survivors**: readonly [`DeidSentinel`](#deidsentinel)[]

Planted sentinels still present in the de-identified output, **must be empty**.

***

### DeidSentinel

A single **planted sentinel**: one distinctive, synthetic-by-construction PHI token that
`@cosyte/synth` placed at a patient locus of a generated artifact, tracked so the loop can prove
`@cosyte/deid` removed it. The token is always drawn from a synthetic-safety provider:
a fake-name-pool name, a `900`-range SSN, a `555-01xx` phone, a synthetic-assigning-authority
identifier, so a sentinel can never be, or collide with, a real person's PHI.

#### Example

```ts
const s: DeidSentinel = { token: "Examplewood", locus: "PID-5", category: "names" };
```

#### Properties

##### category?

> `readonly` `optional` **category?**: `string`

The Safe Harbor category `@cosyte/deid` assigned to the locus, when known.

##### locus

> `readonly` **locus**: `string`

Where it lives, a format-neutral path (e.g. `"PID-5"`, `"recordTarget"`, `"NM1[0]-3"`).

##### token

> `readonly` **token**: `string`

The exact synthetic token planted at the locus, a literal substring of the spec-clean artifact.

***

### FhirDeidLoopOptions

Options accepted by [fhirDeidLoop](#fhirdeidloop).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed. Defaults to `0`.

***

### Hl7DeidLoopOptions

Options accepted by [hl7DeidLoop](#hl7deidloop).

#### Properties

##### kind?

> `readonly` `optional` **kind?**: [`Hl7MessageKind`](hl7.md#hl7messagekind)

The HL7 v2 message family to generate. Defaults to `"ORU^R01"` (a PHI- and clinically-dense report).

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed yields the same artifact and the same verdict. Defaults to `0`.

***

### NcpdpTelecomDeidLoopOptions

Options accepted by [ncpdpTelecomDeidLoop](#ncpdptelecomdeidloop).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed. Defaults to `0`.

##### transaction?

> `readonly` `optional` **transaction?**: [`NcpdpTelecomVariant`](#ncpdptelecomvariant)

The Telecom transaction. Defaults to `"B1"` (a claim, the PHI- and clinically-densest).

***

### X12DeidLoopOptions

Options accepted by [x12DeidLoop](#x12deidloop).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed. Defaults to `0`.

##### variant?

> `readonly` `optional` **variant?**: [`X12DeidVariant`](#x12deidvariant)

The transaction family. Defaults to `"837P"`.

## Type Aliases

### CcdaDeidDocumentType

> **CcdaDeidDocumentType** = `"ccd"` \| `"referral"`

The C-CDA document types the loop can pair.

***

### DeidLoopFormat

> **DeidLoopFormat** = `"hl7"` \| `"fhir"` \| `"ccda"` \| `"x12"` \| `"ncpdp-telecom"`

The set of cosyte formats the loop covers: every format for which **both** `@cosyte/synth` generates
and `@cosyte/deid` ships an adapter.

***

### NcpdpTelecomVariant

> **NcpdpTelecomVariant** = `"B1"` \| `"B2"` \| `"B3"`

The NCPDP Telecom transactions the loop can pair.

***

### X12DeidVariant

> **X12DeidVariant** = `"837P"` \| `"837I"` \| `"837D"` \| `"271"` \| `"835"`

The X12 transaction families the loop can pair.

## Variables

### DEID\_LOOP\_COVERED\_FORMATS

> `const` **DEID\_LOOP\_COVERED\_FORMATS**: readonly \[`"hl7"`, `"fhir"`, `"ccda"`, `"x12"`, `"ncpdp-telecom"`\]

The cosyte formats the pairing loop covers: every format for which **both** `@cosyte/synth`
generates and `@cosyte/deid` ships an adapter.

#### Example

```ts
import { DEID_LOOP_COVERED_FORMATS } from "@cosyte/synth/deid";
DEID_LOOP_COVERED_FORMATS; // ["hl7","fhir","ccda","x12","ncpdp-telecom"]
```

***

### DEID\_LOOP\_POLICY\_NAME

> `const` **DEID\_LOOP\_POLICY\_NAME**: `"synth-deid-loop-removal"` = `"synth-deid-loop-removal"`

The name of the removal-oriented policy the loop runs `@cosyte/deid` under.

#### Example

```ts
import { DEID_LOOP_POLICY_NAME } from "@cosyte/synth/deid";
DEID_LOOP_POLICY_NAME; // => "synth-deid-loop-removal"
```

***

### DEID\_LOOP\_SKIPPED

> `const` **DEID\_LOOP\_SKIPPED**: readonly \[`Readonly`\<\{ `format`: `"ncpdp-script"`; `reason`: `"@cosyte/deid ships no NCPDP SCRIPT locus map; synth generates SCRIPT but the loop cannot pair it."`; \}\>, `Readonly`\<\{ `format`: `"astm"`; `reason`: `"@cosyte/deid ships no ASTM adapter; synth generates ASTM but the loop cannot pair it."`; \}\>, `Readonly`\<\{ `format`: `"dicom"`; `reason`: `"@cosyte/synth does not generate DICOM, so there is nothing to pair."`; \}\>\]

The format paths the loop **deliberately skips**, each with the honest reason, so a coverage gap is
named, never silent.

#### Example

```ts
import { DEID_LOOP_SKIPPED } from "@cosyte/synth/deid";
DEID_LOOP_SKIPPED.map((s) => s.format); // ["ncpdp-script","astm","dicom"]
```

## Functions

### assembleVerdict()

> **assembleVerdict**(`parts`): [`DeidLoopResult`](#deidloopresult)

Assemble a [DeidLoopResult](#deidloopresult) from the planted sentinels, the de-identified output, and the
clinical probe: computing the `pass` verdict (sentinels planted, none survived, nothing over-scrubbed).

#### Parameters

##### parts

The pieces gathered by a per-format loop.

###### artifact

`string`

###### clinicalCodes

readonly `string`[]

###### deidentified

`string`

###### format

[`DeidLoopFormat`](#deidloopformat)

###### original

`string`

###### phiResidue?

`string`

The de-identified values that remain at the former PHI loci, what the survivor sweep reads (see
[sweepSurvivors](#sweepsurvivors)). Defaults to `deidentified` when omitted (a whole-document sweep), but the
per-format loops supply the locus-scoped residue so provider/organization identity a de-identifier
legitimately retains never reads as a false survivor.

###### planted

readonly [`DeidSentinel`](#deidsentinel)[]

###### seed

`number`

#### Returns

[`DeidLoopResult`](#deidloopresult)

The immutable verdict.

#### Example

```ts
const result = assembleVerdict({
  format: "hl7", artifact: "ORU^R01", seed: 1,
  planted, original, deidentified, clinicalCodes,
});
```

***

### ccdaDeidLoop()

> **ccdaDeidLoop**(`options?`): [`DeidLoopResult`](#deidloopresult)

Run the pairing loop for **C-CDA R2.1**: generate a spec-clean document through `@cosyte/ccda`'s
`buildCcda`, plant PHI sentinels at the `recordTarget` patient participation, de-identify through
`@cosyte/deid/ccda`, and verify removal + clinical retention.

Sentinels are read from the `<recordTarget>` element of the serialized XML (not `@cosyte/deid`'s DOM
extractor) so that this zero-dependency subpath constructs no XML DOM; scoping to `recordTarget` keeps
the sentinels patient-PHI only (`author`/`custodian` provider identity is legitimately retained).

#### Parameters

##### options?

[`CcdaDeidLoopOptions`](#ccdadeidloopoptions) = `{}`

The seed and document type. See [CcdaDeidLoopOptions](#ccdadeidloopoptions).

#### Returns

[`DeidLoopResult`](#deidloopresult)

The [DeidLoopResult](#deidloopresult) for the document.

#### Example

```ts
import { ccdaDeidLoop } from "@cosyte/synth/deid";
ccdaDeidLoop({ seed: 5, documentType: "ccd" }).survivors; // => []
```

***

### clinicalRetention()

> **clinicalRetention**(`original`, `deidentified`, `clinicalCodes`): `object`

The over-scrub side of the loop: of the clinical (non-PHI) code tokens that appear in the spec-clean
artifact, which are **missing** after de-identification. A de-identifier must keep clinical content; a
non-empty result means it over-scrubbed. Only structured code tokens present before de-identification
are probed (a code that appears solely inside a free-text narrative a de-identifier legitimately blocks
is not a structured-content loss).

Only **distinctive** codes (four or more characters) are probed: a short 2- to 3-digit code (e.g. a CVX
vaccine code) can appear by coincidence *inside* a PHI value a de-identifier removes: a timestamp, an
SSN, and would read as a false over-scrub. Distinctive codes (LOINC `4548-4`, SNOMED `44054006`,
11-digit NDCs, CPT `99213`) do not collide this way. An artifact whose clinical codes are all short
simply yields an empty probe (the guard is skipped, never falsely tripped).

#### Parameters

##### original

`string`

The spec-clean serialized artifact.

##### deidentified

`string`

The serialized de-identified artifact.

##### clinicalCodes

readonly `string`[]

Candidate structured clinical code tokens (e.g. LOINC/ICD/NDC from the example
  pools) to probe.

#### Returns

`object`

`{ probed, scrubbed }`: the distinctive codes present before, and the subset absent after.

##### probed

> `readonly` **probed**: readonly `string`[]

##### scrubbed

> `readonly` **scrubbed**: readonly `string`[]

#### Example

```ts
const { probed, scrubbed } = clinicalRetention(before, after, ["4548-4", "44054006"]);
scrubbed; // => []  (clinical content retained)
```

***

### deidLoopPolicy()

> **deidLoopPolicy**(): `DeidPolicy`

Build the **removal-oriented** de-identification policy the loop runs `@cosyte/deid` under: HIPAA Safe
Harbor, but with the three keyed-by-default identifier categories (MRN, health-plan-beneficiary,
account) switched from `pseudonymize` to `redact`.

Two reasons this is the right policy for a co-validation loop: (1) it needs **no key context**, so the
loop is a pure function of the seed (the default Safe Harbor policy pseudonymizes those three
categories, which requires the consumer's HMAC key); and (2) it makes the removal contract crisp,
every PHI locus is **removed or generalized away**, never replaced by a surrogate that a naive sweep
might mistake for a survivor. `pseudonymize` also removes the original value, so this is a stricter,
not weaker, check.

#### Returns

`DeidPolicy`

A frozen DeidPolicy suitable for the `policy` option of any `@cosyte/deid` adapter.

#### Example

```ts
import { deidLoopPolicy } from "@cosyte/synth/deid";
import { deidentifyHl7 } from "@cosyte/deid/hl7";
const { document } = deidentifyHl7(msg, { policy: deidLoopPolicy() });
```

***

### fhirDeidLoop()

> **fhirDeidLoop**(`options?`): [`DeidLoopResult`](#deidloopresult)

Run the pairing loop for **FHIR R4**: generate a spec-clean `Bundle` (US-Core `Patient` + a clinical
spine) through `@cosyte/fhir`'s model, plant PHI sentinels at the `Patient` demographics, de-identify
through `@cosyte/deid/fhir`, and verify removal + clinical retention. A `Bundle` (not a bare
`Patient`) is used so there is clinical content to prove is **not** over-scrubbed.

#### Parameters

##### options?

[`FhirDeidLoopOptions`](#fhirdeidloopoptions) = `{}`

The seed. See [FhirDeidLoopOptions](#fhirdeidloopoptions).

#### Returns

[`DeidLoopResult`](#deidloopresult)

The [DeidLoopResult](#deidloopresult) for the bundle.

#### Example

```ts
import { fhirDeidLoop } from "@cosyte/synth/deid";
fhirDeidLoop({ seed: 7 }).pass; // => true
```

***

### hl7DeidLoop()

> **hl7DeidLoop**(`options?`): [`DeidLoopResult`](#deidloopresult)

Run the pairing loop for **HL7 v2**: generate a spec-clean message through `@cosyte/hl7`'s builder,
plant PHI sentinels at the `PID`, de-identify through `@cosyte/deid/hl7`, and verify removal +
clinical retention.

#### Parameters

##### options?

[`Hl7DeidLoopOptions`](#hl7deidloopoptions) = `{}`

The seed and message family. See [Hl7DeidLoopOptions](#hl7deidloopoptions).

#### Returns

[`DeidLoopResult`](#deidloopresult)

The [DeidLoopResult](#deidloopresult) for the message.

#### Example

```ts
import { hl7DeidLoop } from "@cosyte/synth/deid";
const { pass, survivors } = hl7DeidLoop({ seed: 42, kind: "ORU^R01" });
// pass === true, survivors.length === 0
```

***

### identifierSentinels()

> **identifierSentinels**(`loci`, `original`): readonly [`DeidSentinel`](#deidsentinel)[]

Enumerate the distinctive synthetic PHI sentinels from a de-identifier's **patient-scoped**
identifier loci, decomposed to **literal** tokens of the spec-clean artifact.

The loci come from `@cosyte/deid`'s own per-format extractor (`extractHl7Loci` / `extractFhirLoci` /
`extractX12Loci` / `extractTelecomLoci`), which locates PHI **structurally**, so provider and
organization names, which a de-identifier legitimately retains, are never extracted and never become
false sentinels. Only `identifier`-kind loci are used (names, SSNs, phones, emails, member/account
ids); dates (generalized to a year, not removed) and ZIPs (generalized to three digits) are handled by
the format's own contract, not asserted here.

Requiring each token to be a **literal substring of `original`** keeps the removal check non-vacuous:
a sentinel the sweep later looks for is one that is provably present before de-identification.

#### Parameters

##### loci

readonly `GenericLocus`[]

The located candidate values from a `@cosyte/deid` extractor.

##### original

`string`

The spec-clean serialized artifact the loci were extracted from.

#### Returns

readonly [`DeidSentinel`](#deidsentinel)[]

The distinctive, literal, synthetic PHI sentinels, de-duplicated by token.

#### Example

```ts
import { extractHl7Loci } from "@cosyte/deid/hl7";
const sentinels = identifierSentinels(extractHl7Loci(msg).loci, msg.toString());
```

***

### ncpdpTelecomDeidLoop()

> **ncpdpTelecomDeidLoop**(`options?`): [`DeidLoopResult`](#deidloopresult)

Run the pairing loop for **NCPDP Telecom** (pharmacy claims): generate a spec-clean transaction
through `@cosyte/ncpdp`, plant PHI sentinels at the patient/cardholder segments, de-identify through
`@cosyte/deid/ncpdp`, and verify removal + clinical retention. **NCPDP SCRIPT is out of scope**:
`@cosyte/deid` ships no SCRIPT adapter ([DEID\_LOOP\_SKIPPED](#deid_loop_skipped)).

#### Parameters

##### options?

[`NcpdpTelecomDeidLoopOptions`](#ncpdptelecomdeidloopoptions) = `{}`

The seed and transaction. See [NcpdpTelecomDeidLoopOptions](#ncpdptelecomdeidloopoptions).

#### Returns

[`DeidLoopResult`](#deidloopresult)

The [DeidLoopResult](#deidloopresult) for the transaction.

#### Example

```ts
import { ncpdpTelecomDeidLoop } from "@cosyte/synth/deid";
ncpdpTelecomDeidLoop({ seed: 3, transaction: "B1" }).pass; // => true
```

***

### recordTargetSentinels()

> **recordTargetSentinels**(`xml`): readonly [`DeidSentinel`](#deidsentinel)[]

Enumerate the patient sentinels of a **C-CDA** document by reading the `<recordTarget>` element of the
serialized XML: the patient participation. Scoping to `recordTarget` (rather than `author` /
`custodian`, which carry provider identity a de-identifier retains) is what keeps the sentinels
patient-PHI only. Used for C-CDA because `@cosyte/deid`'s C-CDA extractor operates on a raw DOM, which
this zero-dependency module does not construct.

#### Parameters

##### xml

`string`

The serialized spec-clean C-CDA document.

#### Returns

readonly [`DeidSentinel`](#deidsentinel)[]

The distinctive synthetic patient sentinels (given/family names, the patient id extensions).

#### Example

```ts
import { serializeCcda } from "@cosyte/ccda";
const sentinels = recordTargetSentinels(serializeCcda(generateCcd({ seed: 1 })));
```

***

### summarizeDeidCoverage()

> **summarizeDeidCoverage**(`results`): [`DeidCoverageSummary`](#deidcoveragesummary)

Summarize a set of loop runs into a per-format coverage report: the "coverage summary per format" the
harness reports.

#### Parameters

##### results

readonly [`DeidLoopResult`](#deidloopresult)[]

The loop results to aggregate.

#### Returns

[`DeidCoverageSummary`](#deidcoveragesummary)

The [DeidCoverageSummary](#deidcoveragesummary).

#### Example

```ts
import { hl7DeidLoop, fhirDeidLoop, summarizeDeidCoverage } from "@cosyte/synth/deid";
const summary = summarizeDeidCoverage([hl7DeidLoop(), fhirDeidLoop()]);
summary.allPass; // => true
```

***

### sweepSurvivors()

> **sweepSurvivors**(`phiResidue`, `sentinels`): readonly [`DeidSentinel`](#deidsentinel)[]

Sweep the **PHI-locus residue** of a de-identified artifact for **surviving** planted sentinels: the
heart of the removal check. A sentinel survives if its exact token still appears in the values that
remain at the (former) PHI loci after de-identification; a non-empty result is a **hard failure** (real
PHI-shaped data leaked through de-identification).

**Why the PHI-locus residue and not the whole document.** `@cosyte/synth` draws patient *and*
provider/organization names, addresses, and phones from the same synthetic pools, and a de-identifier
legitimately **retains** provider identity. So the same synthetic token can sit at both a patient locus
(removed) and a provider locus (retained); a whole-document sweep would read the retained provider copy
as a false survivor. Sweeping only the residue at the loci that were PHI, re-read from the
de-identifier's own output, is locus-scoped and collision-proof: a token still present *there* is a
genuine leak. It remains independent of the de-identifier's manifest: it reads the actual serialized
output, so a de-identifier that locates a locus but fails to strip it is still caught.

#### Parameters

##### phiResidue

`string`

The de-identified values that remain at the former PHI loci (for the model formats,
  the re-extracted identifier-locus values joined; for C-CDA, the de-identified `<recordTarget>` block).

##### sentinels

readonly [`DeidSentinel`](#deidsentinel)[]

The sentinels planted in the corresponding spec-clean artifact.

#### Returns

readonly [`DeidSentinel`](#deidsentinel)[]

The subset of `sentinels` still present in `phiResidue`, empty on a clean pass.

#### Example

```ts
sweepSurvivors(deidPhiResidue, planted); // => []  (all removed)
```

***

### x12DeidLoop()

> **x12DeidLoop**(`options?`): [`DeidLoopResult`](#deidloopresult)

Run the pairing loop for **X12 005010**: generate a spec-clean transaction through `@cosyte/x12`'s
builders, plant PHI sentinels across the subscriber/patient loops, de-identify through
`@cosyte/deid/x12`, and verify removal + clinical retention.

#### Parameters

##### options?

[`X12DeidLoopOptions`](#x12deidloopoptions) = `{}`

The seed and transaction family. See [X12DeidLoopOptions](#x12deidloopoptions).

#### Returns

[`DeidLoopResult`](#deidloopresult)

The [DeidLoopResult](#deidloopresult) for the transaction.

#### Example

```ts
import { x12DeidLoop } from "@cosyte/synth/deid";
x12DeidLoop({ seed: 1, variant: "837P" }).survivors; // => []
```
