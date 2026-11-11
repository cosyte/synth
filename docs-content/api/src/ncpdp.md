# src/ncpdp

`@cosyte/synth/ncpdp`: the NCPDP generation surface, exposed as its own subpath so importing the
package root does **not** pull `@cosyte/ncpdp`. This is the **lazy, per-format** boundary: a consumer
who only needs NCPDP fixtures imports `@cosyte/synth/ncpdp`; one who needs only the core primitives
never loads a parser.
`@cosyte/ncpdp` is an **optional peer dependency**, present only for this subpath.

This subpath ships spec-clean generation across both NCPDP standards, each built through
`@cosyte/ncpdp`'s own emit surface:

- **SCRIPT** ePrescribing (`@cosyte/ncpdp/script`): `generateNewRx` (via the validated `buildNewRx`
  builder), `generateRxRenewalRequest`, and `generateRxChangeRequest` (via the parser's public typed
  `ScriptMessage` model + `serializeScript`), each round-tripping through `parseScript` with zero
  warnings, and carrying a prescriber whose NPI is invalid-Luhn and whose **DEA is invalid-checksum**.
- **Telecom** claims (`@cosyte/ncpdp/telecom`): `generateB1` (billing), `generateB2` (reversal), and
  `generateB3` (rebill) via `buildTelecomRequest` + `serializeTelecom`, each round-tripping through
  `parseTelecom` with zero warnings, with patient / cardholder identity from the synthetic providers.

**Deferred:** **quirk mode**. SCRIPT is limited to the transactions `@cosyte/ncpdp` can *build*: NewRx
plus the
renewal/change **requests**; the renewal/change *responses* and the reversal cases beyond B2's
reference set track the parser's builder surface, never hand-written bytes.

## Interfaces

### GenerateScriptOptions

Options for the SCRIPT generators.

#### Properties

##### seed

> `readonly` **seed**: `number`

The seed (deterministic: same seed yields a byte-identical message).

***

### GenerateTelecomOptions

Options for the Telecom generators.

#### Properties

##### seed

> `readonly` **seed**: `number`

The seed (deterministic: same seed yields a byte-identical transaction).

***

### NcpdpCardholder

A synthetic cardholder / insurance identity: the covered person on a Telecom claim.

#### Properties

##### cardholderId

> `readonly` **cardholderId**: `string`

Cardholder / member id, synthetic-AA scoped (`MBR`-prefixed).

##### groupId

> `readonly` **groupId**: `string`

Group id, synthetic.

##### person

> `readonly` **person**: [`SyntheticName`](../src.md#syntheticname)

The cardholder name (may differ from the patient).

##### personCode

> `readonly` **personCode**: `string`

Person code (`01` = cardholder, `02` = spouse, `03` = child, structural).

***

### NcpdpCorpusOptions

Options for [ncpdpCorpus](#ncpdpcorpus).

#### Properties

##### count?

> `readonly` `optional` **count?**: `number`

How many transactions to generate. Defaults to the length of the mix.

##### mix?

> `readonly` `optional` **mix?**: readonly [`NcpdpCorpusKind`](#ncpdpcorpuskind)[]

The transaction kinds to cycle through. Defaults to one of each.

##### seed

> `readonly` **seed**: `number`

The seed for the whole corpus (deterministic).

##### verify?

> `readonly` `optional` **verify?**: `boolean`

Whether each artifact is read back through its parser and the parser's findings recorded as its
`warnings`. Defaults to `true`. `false` skips the read, a large share of a corpus's time; every
artifact's `warnings` is then empty without having been checked.

***

### NcpdpExampleDrug

One example drug: a widely-known generic description + an invented, clearly-example NDC.

#### Properties

##### description

> `readonly` **description**: `string`

A widely-known generic drug description (RxNorm-style; public knowledge, not NCPDP prose).

##### form

> `readonly` **form**: `string`

The dispense quantity unit-of-measure qualifier hint (structural only).

##### ndc

> `readonly` **ndc**: `string`

An invented 11-digit NDC (`5-4-2`, digits only), an example product code, never a real NDC.

***

### NcpdpPatient

A synthetic patient: every field from `../safe`.

#### Properties

##### address

> `readonly` **address**: [`SyntheticAddress`](../src.md#syntheticaddress)

Synthetic postal address (reserved non-real ZIP).

##### dob

> `readonly` **dob**: `string`

Date of birth `CCYYMMDD` from the seeded generator.

##### gender

> `readonly` **gender**: `"1"` \| `"2"`

Administrative gender code (`1` = male, `2` = female, NCPDP gender codes).

##### patientId

> `readonly` **patientId**: `string`

Patient id, synthetic-AA scoped (`MBR`-prefixed, never a bare SSN).

##### person

> `readonly` **person**: [`SyntheticName`](../src.md#syntheticname)

Name from the shipped fake-name pool.

##### phone

> `readonly` **phone**: `string`

Reserved `555-01xx` phone.

***

### NcpdpPharmacy

A synthetic dispensing pharmacy: business name + invalid-Luhn NPI + synthetic NCPDP id.

#### Properties

##### businessName

> `readonly` **businessName**: `string`

A clearly-fictional pharmacy business name.

##### ncpdpId

> `readonly` **ncpdpId**: `string`

A 7-digit NCPDP provider id (synthetic, an all-digit id under no real chain).

##### npi

> `readonly` **npi**: `string`

A 10-digit NPI with a deliberately-invalid Luhn check digit.

***

### NcpdpPrescriber

A synthetic prescriber: name + invalid-Luhn NPI + invalid-checksum DEA.

#### Properties

##### dea

> `readonly` **dea**: `string`

A DEA number with a deliberately-invalid checksum (never a real DEA registration).

##### npi

> `readonly` **npi**: `string`

A 10-digit NPI with a deliberately-invalid Luhn check digit (never a real NPI).

##### person

> `readonly` **person**: [`SyntheticName`](../src.md#syntheticname)

A clearly-fake prescriber name.

***

### NcpdpScriptRouting

A seeded SCRIPT routing/correlation bundle: message ids + timestamps, all reproducible.

#### Properties

##### date

> `readonly` **date**: `string`

A `CCYYMMDD` written / service date (seeded, recent window).

##### messageId

> `readonly` **messageId**: `string`

`<MessageID>`: a synthetic message id.

##### prescriberOrderNumber

> `readonly` **prescriberOrderNumber**: `string`

`<PrescriberOrderNumber>`, a synthetic order number.

##### sentTime

> `readonly` **sentTime**: `string`

`<SentTime>`, a seeded ISO-8601 timestamp (never wall-clock).

***

### RoundTripResult

The verdict of one round-trip through `@cosyte/ncpdp`.

#### Properties

##### byteStable

> `readonly` **byteStable**: `boolean`

Whether re-serializing the re-parsed message is byte-identical to `content`.

##### content

> `readonly` **content**: `string`

The serialized NCPDP wire text (the serializer's own conservative emit).

##### specClean

> `readonly` **specClean**: `boolean`

`true` iff the artifact is spec-clean: zero warnings **and** byte-stable.

##### warnings

> `readonly` **warnings**: readonly `string`[]

The warning codes the parser emitted on re-parse. Empty ⇒ spec-clean.

## Type Aliases

### NcpdpCorpusKind

> **NcpdpCorpusKind** = `"NewRx"` \| `"RxRenewalRequest"` \| `"RxChangeRequest"` \| `"B1"` \| `"B2"` \| `"B3"`

Every NCPDP transaction kind [ncpdpCorpus](#ncpdpcorpus) generates: the label used as the corpus `kind`.

***

### TelecomTransactionCode

> **TelecomTransactionCode** = `"B1"` \| `"B2"` \| `"B3"`

The Telecom transaction codes `synth` generates.

## Variables

### DAW\_CODES

> `const` **DAW\_CODES**: readonly `string`[]

Dispense-as-written / product-selection codes (single-digit, structural).

***

### EXAMPLE\_DRUGS

> `const` **EXAMPLE\_DRUGS**: readonly [`NcpdpExampleDrug`](#ncpdpexampledrug)[]

A small pool of license-clean example drugs. The NDCs use the invented labeler prefix `00000`
(never an FDA-assigned labeler), so they are transparently examples; the descriptions are common
generics anyone can name without a licensed database.

***

### EXAMPLE\_SIG\_TEXT

> `const` **EXAMPLE\_SIG\_TEXT**: readonly `string`[]

Example free-text SIG directions (public, common-sense dosing text, not NCPDP prose).

## Functions

### generateB1()

> **generateB1**(`options`): `string`

Generate a spec-clean Telecom **B1** billing claim.

#### Parameters

##### options

[`GenerateTelecomOptions`](#generatetelecomoptions)

The seed.

#### Returns

`string`

The serialized Telecom wire string.

#### Example

```ts
import { generateB1 } from "@cosyte/synth/ncpdp";
const wire = generateB1({ seed: 1 });
```

***

### generateB2()

> **generateB2**(`options`): `string`

Generate a spec-clean Telecom **B2** reversal.

#### Parameters

##### options

[`GenerateTelecomOptions`](#generatetelecomoptions)

The seed.

#### Returns

`string`

The serialized Telecom wire string.

#### Example

```ts
import { generateB2 } from "@cosyte/synth/ncpdp";
const wire = generateB2({ seed: 1 });
```

***

### generateB3()

> **generateB3**(`options`): `string`

Generate a spec-clean Telecom **B3** rebill.

#### Parameters

##### options

[`GenerateTelecomOptions`](#generatetelecomoptions)

The seed.

#### Returns

`string`

The serialized Telecom wire string.

#### Example

```ts
import { generateB3 } from "@cosyte/synth/ncpdp";
const wire = generateB3({ seed: 1 });
```

***

### generateNewRx()

> **generateNewRx**(`options`): `string`

Generate a spec-clean SCRIPT **NewRx** ePrescription, built through `@cosyte/ncpdp`'s validated
`buildNewRx` and serialized by `serializeScript`. Every identity value is synthetic-by-construction; the
message round-trips through `parseScript` with zero warnings.

#### Parameters

##### options

[`GenerateScriptOptions`](#generatescriptoptions)

The seed. See [GenerateScriptOptions](#generatescriptoptions).

#### Returns

`string`

The serialized SCRIPT XML.

#### Example

```ts
import { generateNewRx } from "@cosyte/synth/ncpdp";
const xml = generateNewRx({ seed: 42 });
```

***

### generateRxChangeRequest()

> **generateRxChangeRequest**(`options`): `string`

Generate a spec-clean SCRIPT **RxChangeRequest** (a pharmacy-initiated change request), built as
`@cosyte/ncpdp`'s public typed `ScriptMessage` model and serialized by `serializeScript`. Every
identity value is synthetic-by-construction; the message round-trips through `parseScript` with zero
warnings.

#### Parameters

##### options

[`GenerateScriptOptions`](#generatescriptoptions)

The seed. See [GenerateScriptOptions](#generatescriptoptions).

#### Returns

`string`

The serialized SCRIPT XML.

#### Example

```ts
import { generateRxChangeRequest } from "@cosyte/synth/ncpdp";
const xml = generateRxChangeRequest({ seed: 7 });
```

***

### generateRxRenewalRequest()

> **generateRxRenewalRequest**(`options`): `string`

Generate a spec-clean SCRIPT **RxRenewalRequest** (a pharmacy-initiated renewal), built as
`@cosyte/ncpdp`'s public typed `ScriptMessage` model and serialized by `serializeScript`. Every
identity value is synthetic-by-construction; the message round-trips through `parseScript` with zero
warnings (verified by ./round-trip.scriptRoundTrip).

#### Parameters

##### options

[`GenerateScriptOptions`](#generatescriptoptions)

The seed. See [GenerateScriptOptions](#generatescriptoptions).

#### Returns

`string`

The serialized SCRIPT XML.

#### Example

```ts
import { generateRxRenewalRequest } from "@cosyte/synth/ncpdp";
const xml = generateRxRenewalRequest({ seed: 7 });
```

***

### generateTelecom()

> **generateTelecom**(`code`, `options`): `string`

Generate a spec-clean Telecom transaction of the given code, built through
`@cosyte/ncpdp`'s `buildTelecomRequest` + `serializeTelecom`. `B1`/`B3` carry the full
patient / insurance / prescriber / claim segment set; `B2` (reversal) is the minimal
insurance + claim-reference set a reversal actually carries. Every identity value is
synthetic-by-construction; the transaction round-trips through `parseTelecom` with zero
warnings.

#### Parameters

##### code

[`TelecomTransactionCode`](#telecomtransactioncode)

`"B1"` billing, `"B2"` reversal, or `"B3"` rebill.

##### options

[`GenerateTelecomOptions`](#generatetelecomoptions)

The seed. See [GenerateTelecomOptions](#generatetelecomoptions).

#### Returns

`string`

The serialized Telecom wire string.

#### Example

```ts
import { generateTelecom } from "@cosyte/synth/ncpdp";
const wire = generateTelecom("B1", { seed: 42 });
```

***

### ncpdpCardholder()

> **ncpdpCardholder**(`rng`): [`NcpdpCardholder`](#ncpdpcardholder)

Mint a synthetic cardholder / insurance identity for a Telecom claim.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`NcpdpCardholder`](#ncpdpcardholder)

A synthetic [NcpdpCardholder](#ncpdpcardholder).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { ncpdpCardholder } from "@cosyte/synth/ncpdp";
const c = ncpdpCardholder(createRng(1));
```

***

### ncpdpCorpus()

> **ncpdpCorpus**(`options`): [`Corpus`](../src.md#corpus)

Build a reproducible [Corpus](../src.md#corpus) of spec-clean NCPDP transactions. Each transaction is generated
from a distinct sub-seed derived from the corpus seed (so the set is deterministic) and round-tripped
through `@cosyte/ncpdp`; the per-artifact `warnings` record the parser's verdict (empty ⇒ spec-clean).

#### Parameters

##### options

[`NcpdpCorpusOptions`](#ncpdpcorpusoptions)

Seed, count, and the transaction mix. See [NcpdpCorpusOptions](#ncpdpcorpusoptions).

#### Returns

[`Corpus`](../src.md#corpus)

A deep-frozen [Corpus](../src.md#corpus).

#### Example

```ts
import { ncpdpCorpus } from "@cosyte/synth/ncpdp";
const corpus = ncpdpCorpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true, spec-clean
```

***

### ncpdpPatient()

> **ncpdpPatient**(`rng`): [`NcpdpPatient`](#ncpdppatient)

Mint a synthetic patient. Fixed draw order (name → DOB → gender → id → phone → address) so the same
seed yields the same patient.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`NcpdpPatient`](#ncpdppatient)

A synthetic [NcpdpPatient](#ncpdppatient).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { ncpdpPatient } from "@cosyte/synth/ncpdp";
const { person, patientId } = ncpdpPatient(createRng(1));
```

***

### ncpdpPharmacy()

> **ncpdpPharmacy**(`rng`): [`NcpdpPharmacy`](#ncpdppharmacy)

Mint a synthetic dispensing pharmacy: a fictional business name, an invalid-Luhn NPI, and a 7-digit
synthetic NCPDP provider id.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`NcpdpPharmacy`](#ncpdppharmacy)

A synthetic [NcpdpPharmacy](#ncpdppharmacy).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { ncpdpPharmacy } from "@cosyte/synth/ncpdp";
const rx = ncpdpPharmacy(createRng(1));
```

***

### ncpdpPrescriber()

> **ncpdpPrescriber**(`rng`): [`NcpdpPrescriber`](#ncpdpprescriber)

Mint a synthetic prescriber: a person name, an invalid-Luhn NPI, and an invalid-checksum DEA (the
DEA's second letter is derived from the prescriber's family name so it reads plausibly).

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`NcpdpPrescriber`](#ncpdpprescriber)

A synthetic [NcpdpPrescriber](#ncpdpprescriber).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { ncpdpPrescriber } from "@cosyte/synth/ncpdp";
const p = ncpdpPrescriber(createRng(1)); // p.npi invalid-Luhn; p.dea invalid-checksum
```

***

### ncpdpScriptRouting()

> **ncpdpScriptRouting**(`rng`): [`NcpdpScriptRouting`](#ncpdpscriptrouting)

Mint a seeded SCRIPT routing bundle. The timestamp is drawn from the seeded generator in a recent
window (2024 to 2026) so a message reads current while staying byte-reproducible.

#### Parameters

##### rng

[`Rng`](../src.md#rng)

The seeded generator.

#### Returns

[`NcpdpScriptRouting`](#ncpdpscriptrouting)

A synthetic [NcpdpScriptRouting](#ncpdpscriptrouting).

#### Example

```ts
import { createRng } from "@cosyte/synth";
import { ncpdpScriptRouting } from "@cosyte/synth/ncpdp";
const r = ncpdpScriptRouting(createRng(1));
```

***

### scriptRoundTrip()

> **scriptRoundTrip**(`xml`): [`RoundTripResult`](#roundtripresult)

Round-trip a generated **SCRIPT** XML string through parse → serialize and report the verdict. A
spec-clean message re-parses with **zero warnings** and re-serializes byte-identically.

#### Parameters

##### xml

`string`

The SCRIPT XML (typically from `generateNewRx` / `generateRxRenewalRequest` / …).

#### Returns

[`RoundTripResult`](#roundtripresult)

The [RoundTripResult](#roundtripresult).

#### Example

```ts
import { generateNewRx, scriptRoundTrip } from "@cosyte/synth/ncpdp";
const { specClean } = scriptRoundTrip(generateNewRx({ seed: 1 })); // specClean === true
```

***

### telecomRoundTrip()

> **telecomRoundTrip**(`wire`): [`RoundTripResult`](#roundtripresult)

Round-trip a generated **Telecom** wire string through parse → serialize and report the verdict. A
spec-clean transaction re-parses with **zero warnings** and re-serializes byte-identically.

#### Parameters

##### wire

`string`

The Telecom wire string (typically from `generateB1` / `generateB2` / `generateB3`).

#### Returns

[`RoundTripResult`](#roundtripresult)

The [RoundTripResult](#roundtripresult).

#### Example

```ts
import { generateB1, telecomRoundTrip } from "@cosyte/synth/ncpdp";
const { specClean } = telecomRoundTrip(generateB1({ seed: 1 })); // specClean === true
```
