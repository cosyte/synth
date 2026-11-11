# src/hl7

`@cosyte/synth/hl7`: the HL7 v2 generation surface, exposed as its own subpath so importing the
package root does **not** pull `@cosyte/hl7`. This is the **lazy, per-format** boundary: a consumer
who only needs HL7 fixtures imports `@cosyte/synth/hl7`; one who needs only the core primitives
never loads a parser.
`@cosyte/hl7` is an **optional peer dependency**, present only for this subpath.

The HL7 v2 message set is complete: `ADT` (A01/A04/A08), `ORU^R01`, `ORM^O01`, `SIU^S12`, and
`VXU^V04`, each built through `@cosyte/hl7`'s `buildMessage` and round-tripping with zero warnings.

## Interfaces

### ExampleCode

A coded concept: an identifier code, human-readable text, and its code system (HL7 `CE`/`CWE`).

#### Properties

##### code

> `readonly` **code**: `string`

The code value (component 1).

##### system

> `readonly` **system**: `string`

The coding-system id (component 3), e.g. `"LN"` (LOINC) or `"CVX"`.

##### text

> `readonly` **text**: `string`

The human-readable display text (component 2).

##### units?

> `readonly` `optional` **units?**: `string`

Reporting units (UCUM), where the concept is a measured quantity.

***

### GenerateAdtOptions

Options for [generateAdt](#generateadt).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed yields a byte-identical message. Defaults to `0`.

##### trigger?

> `readonly` `optional` **trigger?**: [`AdtTrigger`](#adttrigger)

The ADT trigger event. Defaults to `"A01"`.

***

### GenerateHl7QuirkOptions

Options for [generateHl7Quirk](#generatehl7quirk).

#### Properties

##### kind?

> `readonly` `optional` **kind?**: [`Hl7QuirkKind`](#hl7quirkkind)

The spec-clean base message family. Defaults to `"ORU^R01"`.

##### quirk

> `readonly` **quirk**: [`Hl7QuirkName`](#hl7quirkname)

The quirk to inject. Required.

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed + quirk yields a byte-identical message. Defaults to `0`.

***

### GenerateOrmOptions

Options for [generateOrm](#generateorm).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed yields a byte-identical message. Defaults to `0`.

***

### GenerateOruOptions

Options for [generateOru](#generateoru).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed yields a byte-identical message. Defaults to `0`.

***

### GenerateSiuOptions

Options for [generateSiu](#generatesiu).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed yields a byte-identical message. Defaults to `0`.

***

### GenerateVxuOptions

Options for [generateVxu](#generatevxu).

#### Properties

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed yields a byte-identical message. Defaults to `0`.

***

### Hl7CorpusOptions

Options for [hl7Corpus](#hl7corpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many messages to generate. Defaults to `1`.

##### mix?

> `readonly` `optional` **mix?**: readonly [`Hl7MessageKind`](#hl7messagekind)[]

The message kinds to cycle through. Defaults to one of every family
(`ADT^A01/A04/A08`, `ORU^R01`, `ORM^O01`, `SIU^S12`, `VXU^V04`).

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

##### triggers?

> `readonly` `optional` **triggers?**: readonly [`AdtTrigger`](#adttrigger)[]

ADT-only convenience: the triggers to cycle through, kept for back-compat. When
supplied it takes precedence over `mix` and restricts the corpus to `ADT` messages.

##### verify?

> `readonly` `optional` **verify?**: `boolean`

Whether each artifact is read back through its parser and the parser's findings recorded as its
`warnings`. Defaults to `true`. `false` skips the read, a large share of a corpus's time; every
artifact's `warnings` is then empty without having been checked.

***

### Hl7QuirkCorpusOptions

Options for [hl7QuirkCorpus](#hl7quirkcorpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many quirk artifacts to generate. Defaults to the number of quirks.

##### kind?

> `readonly` `optional` **kind?**: [`Hl7QuirkKind`](#hl7quirkkind)

The base message family each quirk is injected into. Defaults to `"ORU^R01"`.

##### profile?

> `readonly` `optional` **profile?**: [`SynthProfile`](../src.md#synthprofile)

A [SynthProfile](../src.md#synthprofile) whose `quirks` drive the corpus (validated). Takes precedence over `quirks`.

##### quirks?

> `readonly` `optional` **quirks?**: readonly [`Hl7QuirkName`](#hl7quirkname)[]

The quirk names to cycle through. Defaults to every HL7 quirk. Validated; unsupported ⇒ fatal.

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

***

### MessageScaffold

The MSH scaffold shared by every generated message: the built message plus its seeded MSH values.

#### Properties

##### controlId

> `readonly` **controlId**: `string`

The seeded message control id (MSH-10).

##### message

> `readonly` **message**: `Hl7Message`

The `Hl7Message` with a complete MSH: chain `.addSegment(...)` to append the payload.

##### timestamp

> `readonly` **timestamp**: `string`

The seeded `YYYYMMDDHHMMSS` message timestamp (MSH-7), reused for event/observation times.

***

### PatientIdentity

A complete synthetic patient identity: every field drawn from `../safe`.

#### Properties

##### address

> `readonly` **address**: [`SyntheticAddress`](../src.md#syntheticaddress)

Synthetic postal address (reserved non-real ZIP).

##### dob

> `readonly` **dob**: `string`

Date of birth (`YYYYMMDD`) from the seeded generator.

##### mrn

> `readonly` **mrn**: [`SyntheticIdentifier`](../src.md#syntheticidentifier)

Medical-record identifier scoped to the synthetic assigning authority.

##### person

> `readonly` **person**: [`SyntheticName`](../src.md#syntheticname)

Name from the shipped fake-name pool.

##### phone

> `readonly` **phone**: `string`

Reserved `555-01xx` phone number.

##### sex

> `readonly` **sex**: `"M"` \| `"F"`

Administrative sex.

##### ssnDigits

> `readonly` **ssnDigits**: `string`

Never-issued SSN as 9 digits (no dashes), for `PID-19`.

***

### RoundTripResult

The verdict of one round-trip through `@cosyte/hl7`.

#### Properties

##### byteStable

> `readonly` **byteStable**: `boolean`

Whether re-serializing the re-parsed message is byte-identical to `content`.

##### content

> `readonly` **content**: `string`

The serialized wire text (the parser's own conservative emit).

##### specClean

> `readonly` **specClean**: `boolean`

`true` iff the artifact is spec-clean: zero warnings **and** byte-stable.

##### warnings

> `readonly` **warnings**: readonly `string`[]

The warning codes the parser emitted on re-parse. Empty ⇒ spec-clean.

## Type Aliases

### AdtTrigger

> **AdtTrigger** = `"A01"` \| `"A04"` \| `"A08"`

The ADT trigger events this generator produces (all require the PID + PV1 groups).

***

### Hl7MessageKind

> **Hl7MessageKind** = `"ADT^A01"` \| `"ADT^A04"` \| `"ADT^A08"` \| `"ORU^R01"` \| `"ORM^O01"` \| `"SIU^S12"` \| `"VXU^V04"`

Every HL7 v2 message kind this subpath generates: the `MSH-9` label used as the corpus `kind`. `ADT`
carries its trigger; the other families have a single generated trigger each.

***

### Hl7QuirkKind

> **Hl7QuirkKind** = `"ADT^A01"` \| `"ADT^A04"` \| `"ADT^A08"` \| `"ORU^R01"` \| `"ORM^O01"` \| `"SIU^S12"` \| `"VXU^V04"`

The HL7 v2 message families a quirk can be injected into (the spec-clean base).

***

### Hl7QuirkName

> **Hl7QuirkName** = `"unknown-zsegment"` \| `"unknown-escape"`

Every HL7 v2 quirk this package ships.

## Variables

### EXAMPLE\_LAB\_OBSERVATIONS

> `const` **EXAMPLE\_LAB\_OBSERVATIONS**: readonly [`ExampleCode`](#examplecode)[]

A handful of common LOINC laboratory-observation example codes (for `OBX`). Public LOINC identifiers
used purely as illustrative structural fillers.

***

### EXAMPLE\_ORDER\_SERVICES

> `const` **EXAMPLE\_ORDER\_SERVICES**: readonly [`ExampleCode`](#examplecode)[]

A handful of LOINC panel/service example codes (for the `OBR`/`ORC` universal service id). Public
identifiers used as structural fillers.

***

### EXAMPLE\_VACCINES

> `const` **EXAMPLE\_VACCINES**: readonly [`ExampleCode`](#examplecode)[]

A handful of CDC CVX vaccine example codes (for `RXA-5`). Public CVX identifiers used as structural
fillers; `@cosyte/synth` bundles no vaccine terminology.

***

### HL7\_QUIRKS

> `const` **HL7\_QUIRKS**: `Readonly`\<`Record`\<[`Hl7QuirkName`](#hl7quirkname), [`QuirkDescriptor`](../src.md#quirkdescriptor)\>\>

The HL7 v2 quirk registry: each recipe bound to the exact `@cosyte/hl7` warning code it targets and
its public grounding.

***

### hl7QuirkProfile

> `const` **hl7QuirkProfile**: [`SynthProfile`](../src.md#synthprofile)

A ready-made [SynthProfile](../src.md#synthprofile) that requests every built-in HL7 quirk: a convenience for wiring
`defineSynthProfile`'s quirk list to the parser's real tolerance.

#### Example

```ts
import { hl7QuirkProfile, hl7QuirkCorpus } from "@cosyte/synth/hl7";
hl7QuirkCorpus({ seed: 1, profile: hl7QuirkProfile });
```

## Functions

### componentsField()

> **componentsField**(`components`): `RawField`

Build a `RawField` from a flat list of component strings (single repetition, single subcomponent
per component). Empty strings become empty components (absent at the wire level).

#### Parameters

##### components

readonly `string`[]

The component values, in HL7 component order.

#### Returns

`RawField`

A `RawField` the hl7 serializer lays out with `^` separators.

#### Example

```ts
import { componentsField } from "@cosyte/synth/hl7";
componentsField(["Testerson", "Quilliam"]); // family^given
```

***

### generateAdt()

> **generateAdt**(`options?`): `Hl7Message`

Generate a spec-clean `ADT` Hl7Message through `@cosyte/hl7`. Deterministic in `seed`.

The message carries a complete MSH (seeded control id + timestamp, so the bytes are reproducible),
`EVN`, a fully-populated `PID` (identity from the synthetic providers), and `PV1` (the visit group),
so it parses back through `@cosyte/hl7` with **zero warnings** (proven by ./round-trip).

#### Parameters

##### options?

[`GenerateAdtOptions`](#generateadtoptions) = `{}`

Seed + trigger. See [GenerateAdtOptions](#generateadtoptions).

#### Returns

`Hl7Message`

A spec-clean `ADT` `Hl7Message`.

#### Example

```ts
import { generateAdt } from "@cosyte/synth/hl7";
const msg = generateAdt({ seed: 12345, trigger: "A01" });
console.log(msg.toString());
```

***

### generateHl7()

> **generateHl7**(`kind`, `seed`): `Hl7Message`

Generate one message of the given [Hl7MessageKind](#hl7messagekind) from a seed, dispatching to the right
family generator. Every kind builds through `@cosyte/hl7` and is deterministic in `seed`.

#### Parameters

##### kind

[`Hl7MessageKind`](#hl7messagekind)

The message kind to generate.

##### seed

`number`

The seed.

#### Returns

`Hl7Message`

The generated `Hl7Message`.

#### Example

```ts
import { generateHl7 } from "@cosyte/synth/hl7";
generateHl7("ORU^R01", 42).toString();
```

***

### generateHl7Quirk()

> **generateHl7Quirk**(`options`): [`QuirkArtifact`](../src.md#quirkartifact)

Generate one HL7 v2 **quirk** artifact: a spec-clean message (built through `@cosyte/hl7`) with the
requested vendor deviation injected post-serialize. Deterministic in `seed` + `quirk` + `kind`.

#### Parameters

##### options

[`GenerateHl7QuirkOptions`](#generatehl7quirkoptions)

Seed, quirk, and base kind. See [GenerateHl7QuirkOptions](#generatehl7quirkoptions).

#### Returns

[`QuirkArtifact`](../src.md#quirkartifact)

The [QuirkArtifact](../src.md#quirkartifact): its `content` round-trips to `intendedWarnings` exactly.

#### Throws

SynthError `SYNTH_UNSUPPORTED_QUIRK` if `quirk` is not a supported HL7 quirk.

#### Example

```ts
import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";
const artifact = generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" });
hl7QuirkRoundTrip(artifact).intendedWarningHeld; // true, exactly UNKNOWN_SEGMENT
```

***

### generateOrm()

> **generateOrm**(`options?`): `Hl7Message`

Generate a spec-clean `ORM^O01` Hl7Message through `@cosyte/hl7`. Deterministic in `seed`.

Layout: MSH, `PID` (synthetic identity), `ORC` (common order, control `NW`, new order), and a
matching `OBR` (order detail). The `ORC` satisfies the parser's `ORM^O01` structure net, so the
message re-parses with **zero warnings** (proven by ./round-trip).

#### Parameters

##### options?

[`GenerateOrmOptions`](#generateormoptions) = `{}`

Seed. See [GenerateOrmOptions](#generateormoptions).

#### Returns

`Hl7Message`

A spec-clean `ORM^O01` `Hl7Message`.

#### Example

```ts
import { generateOrm } from "@cosyte/synth/hl7";
const msg = generateOrm({ seed: 12345 });
console.log(msg.toString());
```

***

### generateOru()

> **generateOru**(`options?`): `Hl7Message`

Generate a spec-clean `ORU^R01` Hl7Message through `@cosyte/hl7`. Deterministic in `seed`.

Layout: MSH, `PID` (synthetic identity), `OBR` (order/observation request), and 1 to 3 `OBX` result
rows. The `OBR`/`OBX` result group satisfies the parser's `ORU^R01` structure net, so the message
re-parses with **zero warnings** (proven by ./round-trip).

#### Parameters

##### options?

[`GenerateOruOptions`](#generateoruoptions) = `{}`

Seed. See [GenerateOruOptions](#generateoruoptions).

#### Returns

`Hl7Message`

A spec-clean `ORU^R01` `Hl7Message`.

#### Example

```ts
import { generateOru } from "@cosyte/synth/hl7";
const msg = generateOru({ seed: 12345 });
console.log(msg.toString());
```

***

### generateSiu()

> **generateSiu**(`options?`): `Hl7Message`

Generate a spec-clean `SIU^S12` Hl7Message through `@cosyte/hl7`. Deterministic in `seed`.

Layout: MSH, `SCH` (schedule activity, the required group), `PID` (synthetic identity), `RGS`
(resource group), `AIL` (location resource). The `SCH` satisfies the parser's `SIU^S12` structure
net, so the message re-parses with **zero warnings** (proven by ./round-trip).

#### Parameters

##### options?

[`GenerateSiuOptions`](#generatesiuoptions) = `{}`

Seed. See [GenerateSiuOptions](#generatesiuoptions).

#### Returns

`Hl7Message`

A spec-clean `SIU^S12` `Hl7Message`.

#### Example

```ts
import { generateSiu } from "@cosyte/synth/hl7";
const msg = generateSiu({ seed: 12345 });
console.log(msg.toString());
```

***

### generateVxu()

> **generateVxu**(`options?`): `Hl7Message`

Generate a spec-clean `VXU^V04` Hl7Message through `@cosyte/hl7`. Deterministic in `seed`.

Layout: MSH, `PID` (synthetic identity, the required group), `ORC` (common order), `RXA` (vaccine
administration, CVX example code), `RXR` (route). The `PID` satisfies the parser's `VXU^V04`
structure net, so the message re-parses with **zero warnings** (proven by ./round-trip).

#### Parameters

##### options?

[`GenerateVxuOptions`](#generatevxuoptions) = `{}`

Seed. See [GenerateVxuOptions](#generatevxuoptions).

#### Returns

`Hl7Message`

A spec-clean `VXU^V04` `Hl7Message`.

#### Example

```ts
import { generateVxu } from "@cosyte/synth/hl7";
const msg = generateVxu({ seed: 12345 });
console.log(msg.toString());
```

***

### hl7Corpus()

> **hl7Corpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of spec-clean HL7 messages across the families. Each
message is generated from a distinct sub-seed derived from the corpus seed (so the set is
deterministic) and round-tripped through `@cosyte/hl7`; the per-artifact `warnings` record the
parser's verdict (empty ⇒ spec-clean).

#### Parameters

##### options

[`Hl7CorpusOptions`](#hl7corpusoptions)

Seed, count, and the message mix. See [Hl7CorpusOptions](#hl7corpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { hl7Corpus } from "@cosyte/synth/hl7";
const corpus = hl7Corpus({ seed: 42, count: 7 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true, spec-clean
```

***

### hl7QuirkCorpus()

> **hl7QuirkCorpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of HL7 v2 quirk artifacts. Each artifact's `warnings` record the
parser's verdict: the intended code(s) for its quirk (not empty: a quirk corpus is deliberately
off-spec), and the manifest lists the applied quirk names.

#### Parameters

##### options

[`Hl7QuirkCorpusOptions`](#hl7quirkcorpusoptions)

Seed, count, and the quirk selection. See [Hl7QuirkCorpusOptions](#hl7quirkcorpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { hl7QuirkCorpus } from "@cosyte/synth/hl7";
const corpus = hl7QuirkCorpus({ seed: 42 });
corpus.manifest.quirks; // ["unknown-zsegment", "unknown-escape"]
```

***

### hl7QuirkRoundTrip()

> **hl7QuirkRoundTrip**(`artifact`): [`QuirkRoundTripResult`](../src.md#quirkroundtripresult)

Round-trip an HL7 v2 quirk artifact through `@cosyte/hl7` and report the intended-warning verdict: a bare
parse must produce **exactly** the intended code(s), and, when a built-in public
profile tolerates the quirk, the profiled parse must suppress it.

#### Parameters

##### artifact

[`QuirkArtifact`](../src.md#quirkartifact)

The quirk artifact (from [generateHl7Quirk](#generatehl7quirk)).

#### Returns

[`QuirkRoundTripResult`](../src.md#quirkroundtripresult)

The [QuirkRoundTripResult](../src.md#quirkroundtripresult).

#### Example

```ts
import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";
const rt = hl7QuirkRoundTrip(generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" }));
rt.withProfile?.tolerated; // true, the `visage` profile suppresses UNKNOWN_SEGMENT
```

***

### mshScaffold()

> **mshScaffold**(`rng`, `type`): [`MessageScaffold`](#messagescaffold)

Build the MSH scaffold for a message of the given `MSH-9` type through `@cosyte/hl7`'s `buildMessage`,
so the delimiters, control id, and header layout are the parser's own conservative emit. Draws the
timestamp then the control id from `rng` (a fixed order: the reproducibility contract).

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

##### type

`string`

The `MSH-9` message type, e.g. `"ORU^R01"`.

#### Returns

[`MessageScaffold`](#messagescaffold)

The [MessageScaffold](#messagescaffold).

#### Example

```ts
import { createRng } from "@cosyte/synth";
// mshScaffold(createRng(1), "ORU^R01").message.addSegment("PID", […]);
```

***

### patientIdentity()

> **patientIdentity**(`rng`): [`PatientIdentity`](#patientidentity)

Mint a complete synthetic [PatientIdentity](#patientidentity). Every value comes from a synthetic-safety provider,
so no code path here can return a real or plausibly-real identifier. The draw order is
fixed (name → MRN → DOB → sex → address → phone → SSN) so the same seed yields the same identity.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`PatientIdentity`](#patientidentity)

A synthetic [PatientIdentity](#patientidentity).

#### Example

```ts
import { createRng } from "@cosyte/synth";
// const id = patientIdentity(createRng(1)); // id.person, id.mrn, …
```

***

### pidSegment()

> **pidSegment**(`id`): readonly (`string` \| `RawField`)[]

Lay out a fully-populated `PID` segment from a [PatientIdentity](#patientidentity) as `addSegment` fields: the
PHI-dense segment shared by every family. Components go through [componentsField](#componentsfield) so the parser
lays out the `^` separators (building *through* the parser).

#### Parameters

##### id

[`PatientIdentity`](#patientidentity)

The synthetic identity to render.

#### Returns

readonly (`string` \| `RawField`)[]

The `PID` field list for `Hl7Message.addSegment("PID", …)`.

#### Example

```ts
// msg.addSegment("PID", pidSegment(patientIdentity(createRng(1))));
```

***

### roundTrip()

> **roundTrip**(`message`): [`RoundTripResult`](#roundtripresult)

Round-trip an `@cosyte/hl7` `Hl7Message` through serialize → parse → serialize and report the
verdict. A spec-clean artifact re-parses with **zero warnings** and re-serializes byte-identically.

#### Parameters

##### message

`Hl7Message`

The message to check (typically from `generateAdt`).

#### Returns

[`RoundTripResult`](#roundtripresult)

The [RoundTripResult](#roundtripresult).

#### Example

```ts
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";
const { specClean, warnings } = roundTrip(generateAdt({ seed: 1 }));
// specClean === true, warnings.length === 0
```

***

### seededTimestamp()

> **seededTimestamp**(`rng`): `string`

A seeded HL7 `YYYYMMDDHHMMSS` timestamp (message/event time; recent-year range). Strict HL7 DTM, so
`@cosyte/hl7` parses it back with no `TIMESTAMP_FALLBACK_FORMAT` warning.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

`string`

A 14-digit `YYYYMMDDHHMMSS` timestamp string.

#### Example

```ts
import { createRng } from "@cosyte/synth";
// "20230714…"
```
