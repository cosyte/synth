# src/ccda

`@cosyte/synth/ccda`: the C-CDA generation surface, exposed as its own subpath so importing the
package root does **not** pull `@cosyte/ccda`. This is the **lazy, per-format** boundary: a consumer
who only needs C-CDA fixtures imports `@cosyte/synth/ccda`; one who needs only the core primitives
never loads a parser.
`@cosyte/ccda` is an **optional peer dependency**, present only for this subpath.

This subpath ships spec-clean C-CDA document generation via `@cosyte/ccda`'s
`buildCcda`: a **CCD** (`generateCcd`) and a **Referral Note** (`generateReferralNote`), each built
through the parser's own emitter so it round-trips through `parseCcda` with zero warnings, and each
drawing every identity value from the synthetic-safety providers.

## Interfaces

### CcdaCorpusOptions

Options for [ccdaCorpus](#ccdacorpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many documents to generate. Defaults to `1`.

##### mix?

> `readonly` `optional` **mix?**: readonly [`CcdaDocumentType`](#ccdadocumenttype)[]

The document types to cycle through. Defaults to one CCD + one Referral Note.

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

##### verify?

> `readonly` `optional` **verify?**: `boolean`

Whether each artifact is read back through its parser and the parser's findings recorded as its
`warnings`. Defaults to `true`. `false` skips the read, a large share of a corpus's time; every
artifact's `warnings` is then empty without having been checked.

***

### CcdaPatientIdentity

A synthetic C-CDA patient identity: the values threaded into a document's `recordTarget`.

#### Properties

##### mrn

> `readonly` **mrn**: [`SyntheticIdentifier`](../src.md#syntheticidentifier)

The medical-record identifier, scoped to the synthetic assigning authority.

##### patient

> `readonly` **patient**: `BuildCcdaPatient`

The `BuildCcdaPatient` `@cosyte/ccda` consumes for the single `recordTarget`.

##### person

> `readonly` **person**: [`SyntheticName`](../src.md#syntheticname)

The name from the shipped fake-name pool (also used to compose synthetic narrative/email).

***

### CcdaQuirkCorpusOptions

Options for [ccdaQuirkCorpus](#ccdaquirkcorpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many quirk artifacts to generate. Defaults to the number of quirks.

##### documentType?

> `readonly` `optional` **documentType?**: [`CcdaDocumentType`](#ccdadocumenttype)

The base document type each quirk is injected into. Defaults to `"ccd"`.

##### profile?

> `readonly` `optional` **profile?**: [`SynthProfile`](../src.md#synthprofile)

A [SynthProfile](../src.md#synthprofile) whose `quirks` drive the corpus (validated). Takes precedence over `quirks`.

##### quirks?

> `readonly` `optional` **quirks?**: readonly [`CcdaQuirkName`](#ccdaquirkname)[]

The quirk names to cycle through. Defaults to every C-CDA quirk. Validated; unsupported ⇒ fatal.

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

***

### GenerateCcdaOptions

Options common to every C-CDA generator.

#### Properties

##### documentType?

> `readonly` `optional` **documentType?**: [`CcdaDocumentType`](#ccdadocumenttype)

The document type to emit. Defaults to `"ccd"`.

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed (deterministic: same seed yields a byte-identical document). Defaults to `0`.

***

### GenerateCcdaQuirkOptions

Options for [generateCcdaQuirk](#generateccdaquirk).

#### Properties

##### documentType?

> `readonly` `optional` **documentType?**: [`CcdaDocumentType`](#ccdadocumenttype)

The spec-clean base document type. Defaults to `"ccd"`.

##### quirk

> `readonly` **quirk**: [`CcdaQuirkName`](#ccdaquirkname)

The quirk to inject. Required.

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed + quirk yields a byte-identical document. Defaults to `0`.

***

### RoundTripResult

The verdict of one round-trip through `@cosyte/ccda`.

#### Properties

##### byteStable

> `readonly` **byteStable**: `boolean`

Whether re-serializing the re-parsed document is byte-identical to `content`.

##### content

> `readonly` **content**: `string`

The serialized C-CDA XML (the builder/serializer's own conservative emit).

##### specClean

> `readonly` **specClean**: `boolean`

`true` iff the artifact is spec-clean: zero warnings **and** byte-stable.

##### warnings

> `readonly` **warnings**: readonly `string`[]

The warning codes the parser emitted on re-parse. Empty ⇒ spec-clean.

## Type Aliases

### CcdaCorpusKind

> **CcdaCorpusKind** = [`CcdaDocumentType`](#ccdadocumenttype)

Every C-CDA document kind [ccdaCorpus](#ccdacorpus) generates: the `documentType` used as the corpus `kind`.

***

### CcdaDocumentType

> **CcdaDocumentType** = `"ccd"` \| `"referralNote"`

The C-CDA document type a generator emits: the two `buildCcda` supports.

***

### CcdaQuirkName

> **CcdaQuirkName** = `"template-extension-absent"` \| `"deprecated-loinc"` \| `"deprecated-code-system"`

Every C-CDA quirk this package ships.

## Variables

### ALLERGENS

> `const` **ALLERGENS**: readonly [`CodeConcept`](fhir.md#codeconcept)[] = `EXAMPLE_ALLERGENS`

RxNorm / SNOMED CT allergen example codes (Allergies).

***

### ALLERGY\_REACTIONS

> `const` **ALLERGY\_REACTIONS**: readonly [`CodeConcept`](fhir.md#codeconcept)[] = `EXAMPLE_ALLERGY_MANIFESTATIONS`

SNOMED CT allergy-reaction manifestation example codes.

***

### CCDA\_QUIRKS

> `const` **CCDA\_QUIRKS**: `Readonly`\<`Record`\<[`CcdaQuirkName`](#ccdaquirkname), [`QuirkDescriptor`](../src.md#quirkdescriptor)\>\>

The C-CDA quirk registry: each recipe bound to the exact `@cosyte/ccda` warning code it targets.

***

### ccdaQuirkProfile

> `const` **ccdaQuirkProfile**: [`SynthProfile`](../src.md#synthprofile)

A ready-made [SynthProfile](../src.md#synthprofile) requesting every built-in C-CDA quirk.

***

### LAB\_RESULTS

> `const` **LAB\_RESULTS**: readonly [`QuantConcept`](fhir.md#quantconcept)[] = `EXAMPLE_LAB_OBSERVATIONS`

LOINC laboratory-result example codes with UCUM units + value bands (Results members).

***

### MEDICATIONS

> `const` **MEDICATIONS**: readonly [`CodeConcept`](fhir.md#codeconcept)[] = `EXAMPLE_MEDICATIONS`

RxNorm medication example codes (Medications).

***

### PROBLEMS

> `const` **PROBLEMS**: readonly [`CodeConcept`](fhir.md#codeconcept)[] = `EXAMPLE_CONDITIONS`

SNOMED CT problem/condition example codes (Problems / Past Medical History).

***

### PROCEDURES

> `const` **PROCEDURES**: readonly [`CodeConcept`](fhir.md#codeconcept)[] = `EXAMPLE_PROCEDURES`

SNOMED CT procedure example codes (Procedures).

***

### RESULT\_PANELS

> `const` **RESULT\_PANELS**: readonly [`CodeConcept`](fhir.md#codeconcept)[] = `EXAMPLE_DIAGNOSTIC_REPORTS`

LOINC panel example codes (the Result Organizer `code`).

***

### ROUTES

> `const` **ROUTES**: readonly `BuildCode`[]

NCI Thesaurus administration-route example codes (Medications / Immunizations `route`). Public NCI
concept ids used as structural fillers.

***

### SMOKING\_STATUSES

> `const` **SMOKING\_STATUSES**: readonly `BuildCode`[]

SNOMED CT Current Smoking Status value-set example codes (Social History). Public SNOMED CT
identifiers used as structural fillers; `@cosyte/synth` bundles no SNOMED content.

***

### VACCINES

> `const` **VACCINES**: readonly [`CodeConcept`](fhir.md#codeconcept)[] = `EXAMPLE_VACCINES`

CVX vaccine example codes (Immunizations).

***

### VITAL\_SIGNS

> `const` **VITAL\_SIGNS**: readonly [`QuantConcept`](fhir.md#quantconcept)[] = `EXAMPLE_VITAL_SIGNS`

LOINC vital-sign example codes with UCUM units + value bands (Vital Signs members).

## Functions

### ccdaCorpus()

> **ccdaCorpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of spec-clean C-CDA documents. Each document is generated from a
distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped through
`@cosyte/ccda`; the per-artifact `warnings` record the parser's verdict (empty ⇒ spec-clean).

#### Parameters

##### options

[`CcdaCorpusOptions`](#ccdacorpusoptions)

Seed, count, and the document mix. See [CcdaCorpusOptions](#ccdacorpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { ccdaCorpus } from "@cosyte/synth/ccda";
const corpus = ccdaCorpus({ seed: 42, count: 4 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true, spec-clean
```

***

### ccdaPatientIdentity()

> **ccdaPatientIdentity**(`rng`): [`CcdaPatientIdentity`](#ccdapatientidentity)

Mint a complete synthetic [CcdaPatientIdentity](#ccdapatientidentity). Every value comes from a synthetic-safety
provider, no code path here can return a real identifier. The MRN is scoped to the
synthetic assigning-authority OID (`mrnRoot`), so it is non-colliding by *namespace*, not by value.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`CcdaPatientIdentity`](#ccdapatientidentity)

A synthetic [CcdaPatientIdentity](#ccdapatientidentity).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { ccdaPatientIdentity } from "@cosyte/synth/ccda";
// const { patient } = ccdaPatientIdentity(createRng(1));
```

***

### ccdaQuirkCorpus()

> **ccdaQuirkCorpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of C-CDA quirk artifacts. Each artifact's `warnings` record the
intended code for its quirk; the manifest lists the applied quirk names.

#### Parameters

##### options

[`CcdaQuirkCorpusOptions`](#ccdaquirkcorpusoptions)

Seed, count, and the quirk selection. See [CcdaQuirkCorpusOptions](#ccdaquirkcorpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { ccdaQuirkCorpus } from "@cosyte/synth/ccda";
ccdaQuirkCorpus({ seed: 42 }).manifest.quirks; // the applied quirk names
```

***

### ccdaQuirkRoundTrip()

> **ccdaQuirkRoundTrip**(`artifact`): [`QuirkRoundTripResult`](../src.md#quirkroundtripresult)

Round-trip a C-CDA quirk artifact through `@cosyte/ccda` and report the intended-warning verdict: a bare
parse must produce **exactly** the intended code, and the matching public profile
must re-badge it to `PROFILE_QUIRK_APPLIED`.

#### Parameters

##### artifact

[`QuirkArtifact`](../src.md#quirkartifact)

The quirk artifact (from [generateCcdaQuirk](#generateccdaquirk)).

#### Returns

[`QuirkRoundTripResult`](../src.md#quirkroundtripresult)

The [QuirkRoundTripResult](../src.md#quirkroundtripresult).

#### Example

```ts
import { generateCcdaQuirk, ccdaQuirkRoundTrip } from "@cosyte/synth/ccda";
ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" })).intendedWarningHeld;
```

***

### generateCcd()

> **generateCcd**(`options?`): `CcdaDocument`

Generate a spec-clean synthetic **Continuity of Care Document (CCD)**.

#### Parameters

##### options?

`Omit`\<[`GenerateCcdaOptions`](#generateccdaoptions), `"documentType"`\> = `{}`

Seed (deterministic). See [GenerateCcdaOptions](#generateccdaoptions).

#### Returns

`CcdaDocument`

The `CcdaDocument`.

#### Example

```ts
import { generateCcd, roundTrip } from "@cosyte/synth/ccda";
roundTrip(generateCcd({ seed: 1 })).specClean; // true
```

***

### generateCcda()

> **generateCcda**(`options?`): `CcdaDocument`

Generate a spec-clean synthetic C-CDA document (CCD by default, or Referral Note), built through
`@cosyte/ccda`'s `buildCcda`. The returned CcdaDocument round-trips through `parseCcda` with
zero warnings, and the same seed yields a byte-identical document.

#### Parameters

##### options?

[`GenerateCcdaOptions`](#generateccdaoptions) = `{}`

Seed and document type. See [GenerateCcdaOptions](#generateccdaoptions).

#### Returns

`CcdaDocument`

The `@cosyte/ccda` `CcdaDocument` (serialize via `serializeCcda(doc)` or `doc.toString()`).

#### Example

```ts
import { generateCcda } from "@cosyte/synth/ccda";
import { serializeCcda } from "@cosyte/ccda";
const xml = serializeCcda(generateCcda({ seed: 42 }));
```

***

### generateCcdaQuirk()

> **generateCcdaQuirk**(`options`): [`QuirkArtifact`](../src.md#quirkartifact)

Generate one C-CDA **quirk** artifact: a spec-clean document (built through `@cosyte/ccda`'s
`buildCcda`) with the requested vendor deviation injected post-serialize. Deterministic in `seed` +
`quirk` + `documentType`.

#### Parameters

##### options

[`GenerateCcdaQuirkOptions`](#generateccdaquirkoptions)

Seed, quirk, and base document type. See [GenerateCcdaQuirkOptions](#generateccdaquirkoptions).

#### Returns

[`QuirkArtifact`](../src.md#quirkartifact)

The [QuirkArtifact](../src.md#quirkartifact): its `content` round-trips to `intendedWarnings` exactly.

#### Throws

SynthError `SYNTH_UNSUPPORTED_QUIRK` if `quirk` is not a supported C-CDA quirk.

#### Throws

Error if the base document does not contain the structural anchor the quirk targets.

#### Example

```ts
import { generateCcdaQuirk, ccdaQuirkRoundTrip } from "@cosyte/synth/ccda";
const rt = ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" }));
rt.withProfile?.tolerated; // true, `smartScorecard` re-badges DEPRECATED_LOINC
```

***

### generateReferralNote()

> **generateReferralNote**(`options?`): `CcdaDocument`

Generate a spec-clean synthetic **Referral Note**: the second document type `buildCcda` supports,
with its own US Realm Header specialization and Reason-for-Referral / Assessment narrative sections.

#### Parameters

##### options?

`Omit`\<[`GenerateCcdaOptions`](#generateccdaoptions), `"documentType"`\> = `{}`

Seed (deterministic). See [GenerateCcdaOptions](#generateccdaoptions).

#### Returns

`CcdaDocument`

The `CcdaDocument`.

#### Example

```ts
import { generateReferralNote } from "@cosyte/synth/ccda";
generateReferralNote({ seed: 1 }).documentType; // "referralNote"
```

***

### injectCcdaQuirk()

> **injectCcdaQuirk**(`quirk`, `cleanXml`): `string`

Apply a C-CDA quirk transform to a spec-clean document, or **fail closed**. Refuses to return a
document that does not carry the intended deviation (a quirk whose structural anchor is absent):
a fixture that silently lost its quirk would test the wrong thing.

#### Parameters

##### quirk

[`CcdaQuirkName`](#ccdaquirkname)

The quirk to inject.

##### cleanXml

`string`

The spec-clean C-CDA XML.

#### Returns

`string`

The quirked XML.

#### Throws

SynthError `SYNTH_UNSUPPORTED_QUIRK` when `quirk` is not a supported C-CDA quirk.

#### Throws

SynthError `SYNTH_QUIRK_ANCHOR_ABSENT` when the quirk found no structural anchor to mutate.

#### Example

```ts
import { injectCcdaQuirk } from "@cosyte/synth/ccda";
injectCcdaQuirk("template-extension-absent", cleanXml);
```

***

### quantityFor()

> **quantityFor**(`rng`, `concept`): `BuildQuantity`

Draw a synthetic-but-structurally-sane BuildQuantity for a quantitative concept: a value in
the concept's plausible band (from the seeded generator, so reproducible) rendered to the concept's
decimal precision, with its UCUM unit. The value implies **no** real measurement.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

##### concept

[`QuantConcept`](fhir.md#quantconcept)

The quantitative concept (LOINC code + UCUM unit + value band).

#### Returns

`BuildQuantity`

A `BuildQuantity` (`{ value, unit }`) for the C-CDA builder.

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { quantityFor, LAB_RESULTS } from "@cosyte/synth/ccda";
// quantityFor(createRng(1), LAB_RESULTS[0]);
```

***

### roundTrip()

> **roundTrip**(`doc`): [`RoundTripResult`](#roundtripresult)

Round-trip a generated `@cosyte/ccda` `CcdaDocument` through serialize → parse → serialize and report
the verdict. A spec-clean document re-parses with **zero warnings** and re-serializes byte-identically.

#### Parameters

##### doc

`CcdaDocument`

The document to check (typically from ./ccd.generateCcd).

#### Returns

[`RoundTripResult`](#roundtripresult)

The [RoundTripResult](#roundtripresult).

#### Example

```ts
import { generateCcd, roundTrip } from "@cosyte/synth/ccda";
const { specClean, warnings } = roundTrip(generateCcd({ seed: 1 }));
// specClean === true, warnings.length === 0
```

***

### toBuildCode()

> **toBuildCode**(`concept`): `BuildCode`

Adapt a FHIR [CodeConcept](fhir.md#codeconcept) to a `@cosyte/ccda` BuildCode, resolving its `system` URI to
the matching OID. The `codeSystem` is always set explicitly (never left to a per-slot default), so a
SNOMED allergen or a LOINC panel carries the right OID regardless of which builder slot consumes it.

#### Parameters

##### concept

[`CodeConcept`](fhir.md#codeconcept)

The FHIR-shaped `{ system, code, display }` concept.

#### Returns

`BuildCode`

The `@cosyte/ccda` `BuildCode`.

#### Throws

SynthError `SYNTH_UNMAPPED_CODE_SYSTEM` when the concept's `system` URI has no known OID
  mapping. The refusal does not quote the URI: `concept` is caller-supplied.

#### Example

```ts
import { toBuildCode } from "@cosyte/synth/ccda";
// toBuildCode({ system: "http://snomed.info/sct", code: "59621000", display: "Essential hypertension" });
```
