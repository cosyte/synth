# src/astm

`@cosyte/synth/astm`: the ASTM generation surface, exposed as its own subpath so importing the
package root does **not** pull `@cosyte/astm`. This is the **lazy, per-format** boundary: a consumer
who only needs ASTM fixtures imports `@cosyte/synth/astm`; one who needs only the core primitives
never loads a parser.
`@cosyte/astm` is an **optional peer dependency**, present only for this subpath.

This subpath ships spec-clean generation of the E1394 record report and its E1381 framed twin, each
built through `@cosyte/astm`'s own emit surface:

- **Records (E1394):** `generateAstmResult` (`H`/`P`/`O`/`R`…/`C`/`L`) and `generateAstmOrder`
  (`H`/`P`/`O`/`L`) via `buildAstmMessage`, each round-tripping through `parseAstmRecords` with zero
  warnings and byte-stable, and carrying a `P` record whose name / DOB / practice+lab IDs are all
  synthetic-by-construction. The practice- and laboratory-assigned patient IDs are
  minted independently, so they stay **distinct**.
- **Framing (E1381):** `generateAstmResultFramed` via `composeAstmFrames`, the modulo-256 checksum
  and the `0` to `7` frame number are **computed by the parser, never faked**, and the bytes round-trip
  through `parseFramedAstm` with zero frame **and** record warnings.

## Interfaces

### AstmCorpusOptions

Options for [astmCorpus](#astmcorpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many messages to generate. Defaults to the length of the mix.

##### mix?

> `readonly` `optional` **mix?**: readonly [`AstmCorpusKind`](#astmcorpuskind)[]

The message kinds to cycle through. Defaults to one of each.

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

##### verify?

> `readonly` `optional` **verify?**: `boolean`

Whether each artifact is read back through its parser and the parser's findings recorded as its
`warnings`. Defaults to `true`. `false` skips the read, a large share of a corpus's time; every
artifact's `warnings` is then empty without having been checked.

***

### AstmExampleTest

One example laboratory analyte: its codes, units, reference range, and a seeded value window.

#### Properties

##### decimals

> `readonly` **decimals**: `number`

Number of decimal places to render the synthetic value with.

##### localCode

> `readonly` **localCode**: `string`

A local analyzer test code (invented, never a real vendor assay id).

##### loinc

> `readonly` **loinc**: `string`

The public LOINC identifier for the analyte (a fact, not bundled terminology prose).

##### name

> `readonly` **name**: `string`

The human-readable test name, emitted in the Universal Test ID name component.

##### referenceRange

> `readonly` **referenceRange**: `string`

The reference range text, emitted verbatim in `R`-field 6.

##### units

> `readonly` **units**: `string`

The units string, emitted verbatim in `R`-field 5 (never converted or guessed).

##### valueHigh

> `readonly` **valueHigh**: `number`

Inclusive integer high bound of the seeded synthetic value.

##### valueLow

> `readonly` **valueLow**: `number`

Inclusive integer low bound of the seeded synthetic value (structural, not clinical).

***

### AstmHeaderIdentity

A synthetic ASTM header identity: the sender name the `H` record carries in `H.5`, and an analyzer
string that no generator writes into a message.

#### Properties

##### analyzer

> `readonly` **analyzer**: `string`

An analyzer / instrument string (clearly synthetic). Drawn so a seed keeps its draw order; the
generators leave it out of the message.

##### sender

> `readonly` **sender**: `string`

The sending system's name, written to `H.5` (clearly synthetic).

***

### AstmOrder

A synthetic ASTM order identity: the specimen / accession id and priority.

#### Properties

##### priority

> `readonly` **priority**: `"R"` \| `"S"`

Priority code, emitted verbatim (`R` routine, `S` stat).

##### specimenId

> `readonly` **specimenId**: `string`

Specimen / accession id: synthetic-AA scoped (`ACC`-prefixed).

***

### AstmPatient

A synthetic ASTM patient: every field drawn from `../safe`.

#### Properties

##### birthDate

> `readonly` **birthDate**: `string`

Birthdate `YYYYMMDD`, from the seeded generator (no real event implied).

##### laboratoryAssignedId

> `readonly` **laboratoryAssignedId**: `string`

Laboratory-assigned patient ID, synthetic-AA scoped (`LAB`-prefixed). Distinct from the practice ID.

##### middle

> `readonly` **middle**: `string`

Middle initial (clearly synthetic).

##### person

> `readonly` **person**: [`SyntheticName`](../src.md#syntheticname)

Name from the shipped fake-name pool, plus a fictional middle initial.

##### practiceAssignedId

> `readonly` **practiceAssignedId**: `string`

Practice-assigned patient ID, synthetic-AA scoped (`PRA`-prefixed). Distinct from the lab ID.

##### sex

> `readonly` **sex**: `"M"` \| `"F"`

Sex code, emitted verbatim (`M` / `F`, structural, never defaulted by the builder).

***

### AstmQuirkCorpusOptions

Options for [astmQuirkCorpus](#astmquirkcorpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many quirk artifacts to generate. Defaults to the number of quirks.

##### profile?

> `readonly` `optional` **profile?**: [`SynthProfile`](../src.md#synthprofile)

A [SynthProfile](../src.md#synthprofile) whose `quirks` drive the corpus (validated). Takes precedence over `quirks`.

##### quirks?

> `readonly` `optional` **quirks?**: readonly [`AstmQuirkName`](#astmquirkname)[]

The quirk names to cycle through. Defaults to every ASTM quirk. Validated; unsupported ⇒ fatal.

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

***

### AstmRoundTripResult

The verdict of one round-trip through `@cosyte/astm`.

#### Properties

##### byteStable

> `readonly` **byteStable**: `boolean`

Whether re-serializing the re-parsed message is byte-identical to the input.

##### content

> `readonly` **content**: `string`

The serialized ASTM wire text (records: the `CR`-terminated stream; framed: the raw bytes as latin1).

##### specClean

> `readonly` **specClean**: `boolean`

`true` iff the artifact is spec-clean: zero warnings **and** byte-stable.

##### warnings

> `readonly` **warnings**: readonly `string`[]

The warning codes the parser emitted on re-parse (record + frame layers). Empty ⇒ spec-clean.

***

### GenerateAstmOptions

Options for the ASTM message generators.

#### Properties

##### comment?

> `readonly` `optional` **comment?**: `boolean`

Whether to append a `C` (comment) record after the results. Defaults to `true`.

##### resultCount?

> `readonly` `optional` **resultCount?**: `number`

How many `R` (result) records to emit. Defaults to a seeded 1 to 4.

##### seed

> `readonly` **seed**: `number`

The seed (deterministic: same seed yields a byte-identical message).

***

### GenerateAstmQuirkOptions

Options for [generateAstmQuirk](#generateastmquirk).

#### Properties

##### kind?

> `readonly` `optional` **kind?**: `"Result"`

The spec-clean base report kind. Always `"Result"` (see [AstmQuirkKind](#astmquirkkind)).

##### quirk

> `readonly` **quirk**: [`AstmQuirkName`](#astmquirkname)

The quirk to inject. Required.

##### seed?

> `readonly` `optional` **seed?**: `number`

The seed: the same seed + quirk yields a byte-identical record stream. Defaults to `0`.

## Type Aliases

### AstmCorpusKind

> **AstmCorpusKind** = `"Result"` \| `"Order"`

Every ASTM message kind [astmCorpus](#astmcorpus) generates: the label used as the corpus `kind`.

***

### AstmQuirkKind

> **AstmQuirkKind** = `"Result"`

Both shipped ASTM quirks are **result-report** deviations: `unknown-escape` targets an `R` record's
units field and `unknown-record-type` a `C` (comment) record, neither of which an *order* report
carries. So the quirk base is always a result report (`generateAstmResult`).

***

### AstmQuirkName

> **AstmQuirkName** = `"unknown-escape"` \| `"unknown-record-type"`

Every ASTM quirk this package ships.

## Variables

### ASTM\_ABNORMAL\_FLAGS

> `const` **ASTM\_ABNORMAL\_FLAGS**: readonly `string`[]

HL7 Table 0078 abnormal-flag codes `synth` draws from (emitted verbatim; never defaulted).

***

### ASTM\_COMMENT\_TEXT

> `const` **ASTM\_COMMENT\_TEXT**: readonly `string`[]

Free-text result comments: clearly synthetic, carry no PHI.

***

### ASTM\_QUIRKS

> `const` **ASTM\_QUIRKS**: `Readonly`\<`Record`\<[`AstmQuirkName`](#astmquirkname), [`QuirkDescriptor`](../src.md#quirkdescriptor)\>\>

The ASTM quirk registry: each recipe bound to the exact `@cosyte/astm` warning code it targets.

***

### ASTM\_RESULT\_STATUSES

> `const` **ASTM\_RESULT\_STATUSES**: readonly `string`[]

Result-status codes `synth` draws from (`F` final, `P` preliminary, `C` correction).

***

### astmQuirkProfile

> `const` **astmQuirkProfile**: [`SynthProfile`](../src.md#synthprofile)

A ready-made [SynthProfile](../src.md#synthprofile) requesting every built-in ASTM quirk.

***

### EXAMPLE\_ASTM\_TESTS

> `const` **EXAMPLE\_ASTM\_TESTS**: readonly [`AstmExampleTest`](#astmexampletest)[]

The example test pool. A handful of common chemistry/hematology analytes, each with a public LOINC
code, invented local code, units, and a value window the seeded generator samples. Frozen: the pool
is shared, immutable data.

#### Example

```ts
import { EXAMPLE_ASTM_TESTS } from "@cosyte/synth/astm";
EXAMPLE_ASTM_TESTS[0]?.name; // "Glucose"
```

## Functions

### astmCorpus()

> **astmCorpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of spec-clean ASTM messages. Each message is generated from a
distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped through
`@cosyte/astm`; the per-artifact `warnings` record the parser's verdict (empty ⇒ spec-clean).

#### Parameters

##### options

[`AstmCorpusOptions`](#astmcorpusoptions)

Seed, count, and the message mix. See [AstmCorpusOptions](#astmcorpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { astmCorpus } from "@cosyte/synth/astm";
const corpus = astmCorpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true, spec-clean
```

***

### astmFramedRoundTrip()

> **astmFramedRoundTrip**(`bytes`): [`AstmRoundTripResult`](#astmroundtripresult)

Round-trip a generated **framed** ASTM byte stream (E1381) through decode+parse → re-frame and report
the verdict. A spec-clean framed message re-parses with **zero record and zero frame warnings** (every
modulo-256 checksum verifies, no sequence gap, no unterminated/oversize frame) and re-frames
byte-identically.

#### Parameters

##### bytes

`Uint8Array`

The framed byte stream (typically from `generateAstmResultFramed`).

#### Returns

[`AstmRoundTripResult`](#astmroundtripresult)

The [AstmRoundTripResult](#astmroundtripresult): `content` holds the framed bytes decoded as latin1.

#### Example

```ts
import { generateAstmResultFramed, astmFramedRoundTrip } from "@cosyte/synth/astm";
const { specClean } = astmFramedRoundTrip(generateAstmResultFramed({ seed: 1 })); // true
```

***

### astmHeaderIdentity()

> **astmHeaderIdentity**(`rng`): [`AstmHeaderIdentity`](#astmheaderidentity)

Mint a synthetic header identity: a clearly-synthetic sender for the `H` record's `H.5`, and an
analyzer string, drawn after it, that the generators leave out of the message.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`AstmHeaderIdentity`](#astmheaderidentity)

A synthetic [AstmHeaderIdentity](#astmheaderidentity).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { astmHeaderIdentity } from "@cosyte/synth/astm";
const { sender } = astmHeaderIdentity(createRng(1));
```

***

### astmOrder()

> **astmOrder**(`rng`): [`AstmOrder`](#astmorder)

Mint a synthetic order identity for an `O` record: a synthetic-AA-scoped accession id and a priority.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`AstmOrder`](#astmorder)

A synthetic [AstmOrder](#astmorder).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { astmOrder } from "@cosyte/synth/astm";
const { specimenId } = astmOrder(createRng(1));
```

***

### astmPatient()

> **astmPatient**(`rng`): [`AstmPatient`](#astmpatient)

Mint a synthetic patient for a `P` record. Fixed draw order (name → middle → DOB → sex → practice id
→ lab id) so the same seed yields the same patient. The two patient IDs are minted from
**independent** synthetic-identifier draws, so they are distinct by construction.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`AstmPatient`](#astmpatient)

A synthetic [AstmPatient](#astmpatient).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { astmPatient } from "@cosyte/synth/astm";
const { person, practiceAssignedId, laboratoryAssignedId } = astmPatient(createRng(1));
```

***

### astmQuirkCorpus()

> **astmQuirkCorpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of ASTM quirk artifacts. Each artifact's `warnings` record the
intended code for its quirk; the manifest lists the applied quirk names.

#### Parameters

##### options

[`AstmQuirkCorpusOptions`](#astmquirkcorpusoptions)

Seed, count, and the quirk selection. See [AstmQuirkCorpusOptions](#astmquirkcorpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { astmQuirkCorpus } from "@cosyte/synth/astm";
astmQuirkCorpus({ seed: 42 }).manifest.quirks; // the applied quirk names
```

***

### astmQuirkRoundTrip()

> **astmQuirkRoundTrip**(`artifact`): [`QuirkRoundTripResult`](../src.md#quirkroundtripresult)

Round-trip an ASTM quirk artifact through `@cosyte/astm` and report the intended-warning verdict: a bare
parse must produce **exactly** the intended code, and, when a built-in public
profile tolerates the quirk, the profiled parse must re-badge it to `PROFILE_QUIRK_APPLIED`.

#### Parameters

##### artifact

[`QuirkArtifact`](../src.md#quirkartifact)

The quirk artifact (from [generateAstmQuirk](#generateastmquirk)).

#### Returns

[`QuirkRoundTripResult`](../src.md#quirkroundtripresult)

The [QuirkRoundTripResult](../src.md#quirkroundtripresult).

#### Example

```ts
import { generateAstmQuirk, astmQuirkRoundTrip } from "@cosyte/synth/astm";
astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-escape" })).intendedWarningHeld;
```

***

### astmRoundTrip()

> **astmRoundTrip**(`raw`): [`AstmRoundTripResult`](#astmroundtripresult)

Round-trip a generated ASTM **record** stream through parse → serialize and report the verdict. A
spec-clean message re-parses with **zero warnings** and re-serializes byte-identically.

#### Parameters

##### raw

`string`

The ASTM record stream (typically from `generateAstmResult` / `generateAstmOrder`).

#### Returns

[`AstmRoundTripResult`](#astmroundtripresult)

The [AstmRoundTripResult](#astmroundtripresult).

#### Example

```ts
import { generateAstmResult, astmRoundTrip } from "@cosyte/synth/astm";
const { specClean } = astmRoundTrip(generateAstmResult({ seed: 1 })); // specClean === true
```

***

### generateAstmOrder()

> **generateAstmOrder**(`options`): `string`

Generate a spec-clean ASTM **order message**: an `H`/`P`/`O`/`L` record stream with no results, for
the order side of the flow. Built through `buildAstmMessage`; synthetic-by-construction; round-trips
clean.

#### Parameters

##### options

[`GenerateAstmOptions`](#generateastmoptions)

The seed.

#### Returns

`string`

The `CR`-terminated ASTM record stream.

#### Example

```ts
import { generateAstmOrder } from "@cosyte/synth/astm";
const raw = generateAstmOrder({ seed: 7 });
```

***

### generateAstmQuirk()

> **generateAstmQuirk**(`options`): [`QuirkArtifact`](../src.md#quirkartifact)

Generate one ASTM **quirk** artifact: a spec-clean record report (built through `@cosyte/astm`) with
the requested vendor deviation injected post-serialize. Deterministic in `seed` + `quirk` + `kind`.

#### Parameters

##### options

[`GenerateAstmQuirkOptions`](#generateastmquirkoptions)

Seed, quirk, and base kind. See [GenerateAstmQuirkOptions](#generateastmquirkoptions).

#### Returns

[`QuirkArtifact`](../src.md#quirkartifact)

The [QuirkArtifact](../src.md#quirkartifact): its `content` round-trips to `intendedWarnings` exactly.

#### Throws

SynthError `SYNTH_UNSUPPORTED_QUIRK` if `quirk` is not a supported ASTM quirk.

#### Throws

Error if the base report does not contain the structural anchor the quirk targets.

#### Example

```ts
import { generateAstmQuirk, astmQuirkRoundTrip } from "@cosyte/synth/astm";
const rt = astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-escape" }));
rt.withProfile?.tolerated; // true, `referenceCorpus` re-badges ASTM_UNKNOWN_ESCAPE_SEQUENCE
```

***

### generateAstmResult()

> **generateAstmResult**(`options`): `string`

Generate a spec-clean ASTM **result message**: an `H`/`P`/`O`/`R`…/`C`/`L` record stream, built
through `@cosyte/astm`'s `buildAstmMessage`. Every identity value is synthetic-by-construction; the message
round-trips through `parseAstmRecords` with zero warnings and re-serializes
byte-identically (see `./round-trip`).

#### Parameters

##### options

[`GenerateAstmOptions`](#generateastmoptions)

The seed, optional result count, and whether to append a comment.

#### Returns

`string`

The `CR`-terminated ASTM record stream.

#### Example

```ts
import { generateAstmResult } from "@cosyte/synth/astm";
const raw = generateAstmResult({ seed: 42 });
```

***

### generateAstmResultFramed()

> **generateAstmResultFramed**(`options`): `Uint8Array`

Generate a spec-clean **framed** ASTM result message: the same `H`/`P`/`O`/`R`…/`C`/`L` records,
wrapped in the **E1381 / CLSI LIS01** frame envelope (`<STX> FN text <ETB|ETX> CS <CR><LF>`) via
`@cosyte/astm`'s `composeAstmFrames`. The **modulo-256 checksum and the `0` to `7` frame number are
computed by the parser** (never hand-written), and a record over 240 bytes is split across frames,
so the bytes round-trip through `parseFramedAstm` with zero frame **and** record warnings (see
`./round-trip`). Each record is framed independently (one `ETX`-closed run per record), mirroring what
`decodeAstmFrames` reassembles.

#### Parameters

##### options

[`GenerateAstmOptions`](#generateastmoptions)

The seed, optional result count, and whether to append a comment.

#### Returns

`Uint8Array`

The framed byte stream.

#### Example

```ts
import { generateAstmResultFramed } from "@cosyte/synth/astm";
const bytes = generateAstmResultFramed({ seed: 42 }); // Uint8Array, E1381 framed
```
