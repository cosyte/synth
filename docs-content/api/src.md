# src

`@cosyte/synth`: a deterministic, seedable **synthetic-data / test-fixture generator** for the
cosyte healthcare formats. A *consumer* of the parsers, not a parser: it builds artifacts **through
each parser's own builder/serializer** (so output is spec-clean by construction) and draws every
value from a **guaranteed-non-colliding synthetic source** (so no output can be real or
plausibly-real PHI). It is a **format/conformance generator, not a clinical simulator**.

This root entry point exposes the **format-agnostic core**: the seeded PRNG, the synthetic-safety
providers, the `Corpus` abstraction, the profile skeleton, and the fatal codes. Per-format
generation lives behind its own subpath (`@cosyte/synth/hl7`) so importing the root never pulls a
parser: the lazy per-format boundary.

## Classes

### SynthError

The typed error every fatal `@cosyte/synth` condition throws. Carries a stable
[SynthFatalCode](#synthfatalcode) so callers branch on `err.code` without matching message text.

It takes **no value parameter**. The message is whatever [SYNTH\_FATAL\_MESSAGES](#synth_fatal_messages) holds for the
code, or for a missing parser whatever [SYNTH\_PEER\_MESSAGES](#synth_peer_messages) holds for that package, so no
caller-supplied string can reach a diagnostic surface by any route, not `message`, not `stack`,
not a field on the thrown object. The options carry only an error this package caught (`cause`)
and a package name from that closed set (`peer`).

#### Example

```ts
import { SynthError, SYNTH_FATAL_CODES } from "@cosyte/synth";
throw new SynthError(SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT);
```

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new SynthError**(`code`, `options?`): [`SynthError`](#syntherror)

###### Parameters

###### code

[`SynthFatalCode`](#synthfatalcode)

The stable [SynthFatalCode](#synthfatalcode). The message comes from the frozen registry.

###### options?

[`SynthErrorOptions`](#syntherroroptions) = `{}`

The error that caused this one, and for a missing parser its package.

###### Returns

[`SynthError`](#syntherror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: [`SynthFatalCode`](#synthfatalcode)

The stable fatal code.

##### peer?

> `readonly` `optional` **peer?**: `"@cosyte/hl7"` \| `"@cosyte/fhir"` \| `"@cosyte/ccda"` \| `"@cosyte/x12"` \| `"@cosyte/ncpdp"` \| `"@cosyte/astm"` \| `"@cosyte/deid"`

The missing parser package, on a SYNTH\_FATAL\_CODES.SYNTH\_PEER\_NOT\_INSTALLED error only.

## Interfaces

### Artifact

One generated artifact: the serialized wire text plus the metadata needed to reproduce and check
it. `warnings` records what the artifact's own parser reported on the round-trip (zero for a
spec-clean artifact).

#### Properties

##### content

> `readonly` **content**: `string`

The serialized wire text, produced by the parser's own conservative serializer.

##### format

> `readonly` **format**: [`SynthFormat`](#synthformat)

The format this artifact belongs to.

##### kind

> `readonly` **kind**: `string`

A format-specific kind label (e.g. `"ADT^A01"`).

##### warnings

> `readonly` **warnings**: readonly `string`[]

The warning codes the parser emitted when the artifact was round-tripped (empty = spec-clean).

***

### Corpus

A reproducible, self-describing set of generated artifacts.

#### Properties

##### artifacts

> `readonly` **artifacts**: readonly [`Artifact`](#artifact)[]

The generated artifacts, in generation order.

##### manifest

> `readonly` **manifest**: [`CorpusManifest`](#corpusmanifest-1)

The manifest describing what was generated.

##### seed

> `readonly` **seed**: `number`

The seed the corpus was generated from: regenerating from it yields byte-identical artifacts.

***

### CorpusManifest

A self-describing manifest of a [Corpus](#corpus).

#### Properties

##### counts

> `readonly` **counts**: `Readonly`\<`Record`\<`string`, `number`\>\>

Per-kind artifact counts (e.g. `{ "ADT^A01": 3 }`).

##### formats

> `readonly` **formats**: readonly [`SynthFormat`](#synthformat)[]

The formats present in the corpus.

##### quirks

> `readonly` **quirks**: readonly `string`[]

The quirk names applied.

***

### QuirkArtifact

One generated quirk artifact: the off-spec wire text plus the contract it is meant to satisfy.

#### Properties

##### content

> `readonly` **content**: `string`

The **quirked** wire text (deterministic in the seed + quirk).

##### format

> `readonly` **format**: [`SynthFormat`](#synthformat)

The format this artifact belongs to.

##### intendedWarnings

> `readonly` **intendedWarnings**: readonly `string`[]

The exact parser warning code(s) this artifact is meant to round-trip to.

##### kind

> `readonly` **kind**: `string`

The underlying spec-clean message kind the quirk was injected into (e.g. `"ORU^R01"`).

##### quirk

> `readonly` **quirk**: `string`

The quirk recipe applied.

***

### QuirkDescriptor

A public, grounded description of one vendor quirk: the metadata that binds a quirk recipe to a real
parser warning code and a **publicly-groundable** deviation (cited-public, never a private
vendor corpus).

#### Properties

##### disposition

> `readonly` **disposition**: [`QuirkProfileDisposition`](#quirkprofiledisposition)

How [toleratingProfile](#toleratingprofile) treats the quirk.

##### format

> `readonly` **format**: [`SynthFormat`](#synthformat)

The format this quirk applies to.

##### grounding

> `readonly` **grounding**: `string`

The **public** grounding for this quirk, the spec clause or the parser's public profile that
documents the tolerance. Never a private vendor-attributed corpus.

##### intendedWarnings

> `readonly` **intendedWarnings**: readonly `string`[]

The **exact** parser warning code(s) a bare parse (no profile) surfaces for this quirk, the
intended-warning contract. A quirk that produces any other code, or none, is a generation bug.

##### name

> `readonly` **name**: `string`

The quirk recipe name (e.g. `"unknown-zsegment"`). Stable; part of the public contract.

##### toleratingProfile?

> `readonly` `optional` **toleratingProfile?**: `string`

The parser profile that tolerates this quirk (when a built-in public one exists).

***

### QuirkProfiledVerdict

The verdict of a bare parse under the tolerating profile, if any.

#### Properties

##### disposition

> `readonly` **disposition**: [`QuirkProfileDisposition`](#quirkprofiledisposition)

How the profile treats the quirk.

##### profileName

> `readonly` **profileName**: `string`

The profile applied.

##### tolerated

> `readonly` **tolerated**: `boolean`

`true` iff the profile handled the quirk as its disposition declares: `"suppressed"` ⇒ the intended
code is gone; `"rebadged"` ⇒ the intended code is gone and `PROFILE_QUIRK_APPLIED` is present.

##### warnings

> `readonly` **warnings**: readonly `string`[]

The warning codes the parser emitted with the profile active.

***

### QuirkRoundTripResult

The verdict of round-tripping a quirk artifact through its parser.

#### Properties

##### content

> `readonly` **content**: `string`

The quirked wire text that was parsed.

##### intendedWarningHeld

> `readonly` **intendedWarningHeld**: `boolean`

`true` iff the bare parse produced **exactly** the intended code(s), the intended-warning contract.

##### intendedWarnings

> `readonly` **intendedWarnings**: readonly `string`[]

The exact code(s) the quirk is meant to produce.

##### warnings

> `readonly` **warnings**: readonly `string`[]

The warning codes a **bare** parse (no profile) emitted.

##### withProfile?

> `readonly` `optional` **withProfile?**: [`QuirkProfiledVerdict`](#quirkprofiledverdict)

The verdict under the tolerating profile, when a built-in public one exists.

***

### Rng

A seeded, deterministic random source. Created via [createRng](#createrng); passed explicitly to every
provider. All draw methods advance the internal state deterministically.

#### Properties

##### seed

> `readonly` **seed**: `number`

The integer seed this generator was created from (part of the `Corpus` manifest).

#### Methods

##### bool()

> **bool**(`p?`): `boolean`

`true` with probability `p` (default `0.5`).

###### Parameters

###### p?

`number`

###### Returns

`boolean`

##### digits()

> **digits**(`n`): `string`

A string of `n` decimal digits (`0` to `9`), each drawn uniformly.

###### Parameters

###### n

`number`

The number of digits (`>= 0`).

###### Returns

`string`

##### float()

> **float**(): `number`

The next float in `[0, 1)`.

###### Returns

`number`

##### int()

> **int**(`min`, `max`): `number`

A uniformly-distributed integer in the inclusive range `[min, max]`.

###### Parameters

###### min

`number`

Inclusive lower bound (integer).

###### max

`number`

Inclusive upper bound (integer, `>= min`).

###### Returns

`number`

##### nextUint32()

> **nextUint32**(): `number`

The next unsigned 32-bit integer.

###### Returns

`number`

##### pick()

> **pick**\<`T`\>(`items`): `T`

Pick one element from a non-empty array.

###### Type Parameters

###### T

`T`

###### Parameters

###### items

readonly `T`[]

A non-empty readonly array.

###### Returns

`T`

***

### Sfc32State

The mutable four-word `sfc32` state. Threaded explicitly (never global) by ../rng/rng.Rng.

#### Properties

##### a

> **a**: `number`

State word `a`.

##### b

> **b**: `number`

State word `b`.

##### c

> **c**: `number`

State word `c`.

##### d

> **d**: `number`

Counter word `d`.

***

### SynthErrorOptions

What a [SynthError](#syntherror) may carry beside its code.

#### Properties

##### cause?

> `readonly` `optional` **cause?**: `unknown`

The error that caused this one, kept on `cause`.

##### peer?

> `readonly` `optional` **peer?**: `"@cosyte/hl7"` \| `"@cosyte/fhir"` \| `"@cosyte/ccda"` \| `"@cosyte/x12"` \| `"@cosyte/ncpdp"` \| `"@cosyte/astm"` \| `"@cosyte/deid"`

For SYNTH\_FATAL\_CODES.SYNTH\_PEER\_NOT\_INSTALLED: the parser package that is missing. Its
message then comes from [SYNTH\_PEER\_MESSAGES](#synth_peer_messages).

***

### SyntheticAddress

A synthetic postal address: synthetic street + city, a fixed non-real ZIP.

#### Properties

##### city

> `readonly` **city**: `string`

A clearly-fake city.

##### state

> `readonly` **state**: `string`

A US state abbreviation (structural only; never combined with a real street + name + DOB).

##### street

> `readonly` **street**: `string`

A clearly-fake street line.

##### zip

> `readonly` **zip**: `string`

A reserved non-real ZIP (`00000`).

***

### SyntheticIdentifier

A synthetic identifier scoped to the synthetic assigning authority.

#### Properties

##### assigningAuthority

> `readonly` **assigningAuthority**: `string`

The synthetic assigning-authority namespace id.

##### assigningAuthorityOid

> `readonly` **assigningAuthorityOid**: `string`

The synthetic assigning-authority OID (HL7 example arc).

##### typeCode

> `readonly` **typeCode**: `"MR"` \| `"AN"` \| `"MB"`

HL7 identifier type code (`MR` = medical record, `AN` = account, `MB` = member).

##### value

> `readonly` **value**: `string`

The identifier value (digits): unique only within the synthetic namespace.

***

### SyntheticName

A synthetic person name drawn from the shipped fake-name pool.

#### Properties

##### family

> `readonly` **family**: `string`

A clearly-fake family name.

##### given

> `readonly` **given**: `string`

A clearly-fake given name.

***

### SynthProfile

A frozen, validated fixture recipe produced by [defineSynthProfile](#definesynthprofile).

#### Properties

##### familyNames?

> `readonly` `optional` **familyNames?**: readonly `string`[]

The family-name pool this profile draws from.

##### givenNames?

> `readonly` `optional` **givenNames?**: readonly `string`[]

The given-name pool this profile draws from (overrides or the built-in default).

##### name

> `readonly` **name**: `string`

The profile name.

##### quirks?

> `readonly` `optional` **quirks?**: readonly `string`[]

The requested quirk recipe names, or absent when the spec left `quirks` out. Absent is not an
empty list: absent leaves the quirk selection to the corpus, an empty list selects nothing.

***

### SynthProfileSpec

The user-authored spec passed to [defineSynthProfile](#definesynthprofile).

#### Properties

##### familyNames?

> `readonly` `optional` **familyNames?**: readonly `string`[]

Optional family-name pool override (clearly-synthetic names only).

##### givenNames?

> `readonly` `optional` **givenNames?**: readonly `string`[]

Optional given-name pool override (clearly-synthetic names only, see the safety invariant).

##### name

> `readonly` **name**: `string`

A stable, human-readable profile name (e.g. `"acme-hospital"`). Required, non-empty.

##### quirks?

> `readonly` `optional` **quirks?**: readonly `string`[]

The vendor quirk recipe names this profile requests. Validated against the target format's quirk
registry when the profile drives a quirk corpus (an unsupported quirk is a fatal
`SYNTH_UNSUPPORTED_QUIRK`, never a silent no-op). Leave it out to leave the quirk selection to
the corpus (every quirk by default); an empty list selects nothing, and a quirk corpus refuses it
with `SYNTH_EMPTY_POOL`.

## Type Aliases

### QuirkProfileDisposition

> **QuirkProfileDisposition** = `"suppressed"` \| `"rebadged"` \| `"bare"`

How the parser's matching profile treats a quirk once it is active: the three shapes the parsers'
profile systems actually exhibit (verified firsthand against each parser):

- `"suppressed"`, the profile makes the warning **disappear** (HL7 v2: a `defineProfile`
  `customSegments` claim suppresses `UNKNOWN_SEGMENT` for a declared Z-segment).
- `"rebadged"`, the profile **downgrades** the warning to the value-free `PROFILE_QUIRK_APPLIED`
  marker with `expected: true` (C-CDA `defineCcdaProfile` / ASTM `defineAstmProfile`
  `profileQuirkApplied`).
- `"bare"`, no shipped profile tolerates it; the quirk targets a real coded leniency a consumer can
  tolerate via their own `defineProfile`/`defineAstmProfile`, but no built-in re-badges it.

***

### SsnBlock

> **SsnBlock** = `"never-issued"` \| `"advertising"`

Which SSN reserved space to draw from.

***

### SynthFatalCode

> **SynthFatalCode** = *typeof* [`SYNTH_FATAL_CODES`](#synth_fatal_codes)\[keyof *typeof* [`SYNTH_FATAL_CODES`](#synth_fatal_codes)\]

A value from [SYNTH\_FATAL\_CODES](#synth_fatal_codes): the type carried by a thrown [SynthError](#syntherror).

***

### SynthFormat

> **SynthFormat** = `"hl7v2"` \| `"fhir"` \| `"ccda"` \| `"x12"` \| `"ncpdp"` \| `"astm"`

The format an artifact was generated for.

***

### SynthPeer

> **SynthPeer** = keyof *typeof* [`SYNTH_PEER_MESSAGES`](#synth_peer_messages)

A sibling parser package: a key of [SYNTH\_PEER\_MESSAGES](#synth_peer_messages).

## Variables

### DEA\_REGISTRANT\_TYPES

> `const` **DEA\_REGISTRANT\_TYPES**: readonly `string`[]

The DEA-registration prefix letters `@cosyte/synth` draws a synthetic DEA number's first character
from. A real DEA number is `<registrant-type><last-name-initial>` + 7 digits; the first letter is the
registrant type (A/B/F/G/M/P/R/X are the widely-published values; the second letter is the
registrant's last-name initial). These letters are a **fact** about the number's shape, not
copyrighted prose: they only shape the value; the synthetic guarantee is the deliberately-**invalid
checksum** (see [dea](#dea) / [isSyntheticDea](#issyntheticdea)).

***

### DOC\_V6\_PREFIX

> `const` **DOC\_V6\_PREFIX**: `"2001:db8"` = `"2001:db8"`

RFC 3849 IPv6 documentation prefix.

***

### ITIN\_GROUP\_RANGES

> `const` **ITIN\_GROUP\_RANGES**: readonly `Readonly`\<\{ `max`: `number`; `min`: `number`; \}\>[]

The published **IRS ITIN group ranges**, inclusive `[min, max]` bands over the two group digits
(positions 4 and 5) of a `9NN-GG-NNNN` value. An Individual Taxpayer Identification Number is an
SSN-format number that begins with `9` and carries a group inside one of these bands, so these
bands are what separates an SSN the SSA manual calls invalid from a validly formatted ITIN.

These are **facts** about the number's shape, not copyrighted prose (IRS Internal Revenue Manual
3.21.263). Group values `89` and `93` sit between the bands on purpose: the IRM records them as
reserved for other IRS programs rather than for ITINs, so a value carrying one is **not**
ITIN-formatted (see [isItinFormatted](#isitinformatted)).

***

### NPI\_LUHN\_PREFIX

> `const` **NPI\_LUHN\_PREFIX**: `"80840"` = `"80840"`

The `80840` prefix prepended to a 10-digit NPI before the Luhn check. A real NPI satisfies
`luhn("80840" + npi) ≡ 0 (mod 10)`.

The rule is **69 FR 3434**, the final rule adopting the NPI (FR Doc 04-1149, docket CMS-0045-F),
issued by the agency that document names as "Centers for Medicare & Medicaid Services, HHS": "the
NPI check digit calculation must always be performed as though the NPI is preceded by" `80840`.
The prefix itself is not that rule's: it credits the NCITS.284 standard health care identification
card, which "requires that the first five digits of the card issuer identifier be" `80840`, "where
the initial two digits, 80, signify health applications, the next three digits, 840, signify
United States". The rule cites no ISO document number for the prefix or for the check digit, and
neither does this module.
\<https://www.federalregister.gov/documents/full_text/text/2004/01/23/04-1149.txt\>

***

### PROFILE\_QUIRK\_APPLIED

> `const` **PROFILE\_QUIRK\_APPLIED**: `"PROFILE_QUIRK_APPLIED"` = `"PROFILE_QUIRK_APPLIED"`

The stable, value-free re-badge code the C-CDA and ASTM parsers emit when a profile tolerates a
quirk. HL7 v2 has no equivalent (it suppresses instead: see [QuirkProfileDisposition](#quirkprofiledisposition)).

***

### RESERVED\_EMAIL\_DOMAINS

> `const` **RESERVED\_EMAIL\_DOMAINS**: readonly `string`[]

RFC 2606 / 6761 reserved email domains `@cosyte/synth` draws from.

***

### safe

> `const` **safe**: `Readonly`\<\{ `address`: (`rng`) => [`SyntheticAddress`](#syntheticaddress); `dateYmd`: (`rng`, `minYear`, `maxYear`) => `string`; `dea`: (`rng`, `person?`) => `string`; `email`: (`rng`, `person?`) => `string`; `identifier`: (`rng`, `typeCode`) => [`SyntheticIdentifier`](#syntheticidentifier); `ipv4`: (`rng`) => `string`; `ipv6`: (`rng`) => `string`; `name`: (`rng`) => [`SyntheticName`](#syntheticname); `npi`: (`rng`) => `string`; `phone`: (`rng`) => `string`; `ssn`: (`rng`, `block?`) => `string`; `uuid`: (`rng`) => `string`; \}\>

The synthetic-safety provider namespace. Every function draws only from a reserved range or the
shipped fake-name pool, no value it returns can be real or plausibly-real PHI.

#### Example

```ts
import { createRng, safe } from "@cosyte/synth";
const rng = createRng(42);
safe.ssn(rng);   // never-issued SSN
safe.phone(rng); // reserved 555-01NN number
```

***

### SYNTH\_FATAL\_CODES

> `const` **SYNTH\_FATAL\_CODES**: `Readonly`\<\{ `SYNTH_EMPTY_POOL`: `"SYNTH_EMPTY_POOL"`; `SYNTH_INTENDED_WARNING_MISMATCH`: `"SYNTH_INTENDED_WARNING_MISMATCH"`; `SYNTH_INVALID_DECIMAL`: `"SYNTH_INVALID_DECIMAL"`; `SYNTH_INVALID_PROFILE`: `"SYNTH_INVALID_PROFILE"`; `SYNTH_INVALID_RANGE`: `"SYNTH_INVALID_RANGE"`; `SYNTH_PEER_NOT_INSTALLED`: `"SYNTH_PEER_NOT_INSTALLED"`; `SYNTH_PROFILE_NOT_GENERATED`: `"SYNTH_PROFILE_NOT_GENERATED"`; `SYNTH_QUIRK_ANCHOR_ABSENT`: `"SYNTH_QUIRK_ANCHOR_ABSENT"`; `SYNTH_UNMAPPED_CODE_SYSTEM`: `"SYNTH_UNMAPPED_CODE_SYSTEM"`; `SYNTH_UNSUPPORTED_FORMAT`: `"SYNTH_UNSUPPORTED_FORMAT"`; `SYNTH_UNSUPPORTED_KIND`: `"SYNTH_UNSUPPORTED_KIND"`; `SYNTH_UNSUPPORTED_QUIRK`: `"SYNTH_UNSUPPORTED_QUIRK"`; \}\>

The stable **fatal** code registry. Additions-only thereafter.

#### Example

```ts
import { SYNTH_FATAL_CODES, SynthError } from "@cosyte/synth";
try {
  // ...generate...
} catch (err) {
  if (err instanceof SynthError && err.code === SYNTH_FATAL_CODES.SYNTH_UNSUPPORTED_FORMAT) {
    // handle an unsupported format request
  }
}
```

***

### SYNTH\_FATAL\_MESSAGES

> `const` **SYNTH\_FATAL\_MESSAGES**: `Readonly`\<`Record`\<[`SynthFatalCode`](#synthfatalcode), `string`\>\>

The **frozen message registry**: the only place a [SynthError](#syntherror) message can come from.

A message here is a fixed string. It never quotes the request that produced it, and there is no
parameter through which it could: [SynthError](#syntherror) takes a code and nothing else. That is the
whole mechanism, and it is deliberately a mechanism rather than a habit. Every one of these
messages used to be assembled by interpolating the caller's value into a template, and the reason
that was safe was not the design: it was that the caller happened to be passing a quirk name.

The trade is real and is accepted: a fatal no longer tells you *which* value it rejected. It tells
you which rule refused, on `err.code`, and the stack frame tells you where. The caller already
holds the value it passed.

#### Example

```ts
import { SYNTH_FATAL_CODES, SYNTH_FATAL_MESSAGES } from "@cosyte/synth";
SYNTH_FATAL_MESSAGES[SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL]; // => "A value was drawn from an empty pool."
```

***

### SYNTH\_PEER\_MESSAGES

> `const` **SYNTH\_PEER\_MESSAGES**: `Readonly`\<\{ `@cosyte/astm`: `string`; `@cosyte/ccda`: `string`; `@cosyte/deid`: `string`; `@cosyte/fhir`: `string`; `@cosyte/hl7`: `string`; `@cosyte/ncpdp`: `string`; `@cosyte/x12`: `string`; \}\>

The message a SYNTH\_FATAL\_CODES.SYNTH\_PEER\_NOT\_INSTALLED error carries for each sibling
parser: which package is missing, and the command that installs it. Keyed by the closed set of
parser packages this package builds through, so like [SYNTH\_FATAL\_MESSAGES](#synth_fatal_messages) it is a table
of fixed strings, and no caller value can reach it.

#### Example

```ts
import { SYNTH_PEER_MESSAGES } from "@cosyte/synth";
SYNTH_PEER_MESSAGES["@cosyte/hl7"]; // => "@cosyte/hl7 is not installed, and this generator builds through it. Install it beside @cosyte/synth: npm install @cosyte/hl7"
```

***

### SYNTHETIC\_ASSIGNING\_AUTHORITY

> `const` **SYNTHETIC\_ASSIGNING\_AUTHORITY**: `Readonly`\<\{ `namespaceId`: `"COSYTE-SYNTH"`; `universalId`: `"2.16.840.1.113883.19.999"`; `universalIdType`: `"ISO"`; \}\>

The synthetic **assigning authority** `@cosyte/synth` mints MRNs / account / member identifiers
under.

**No authority reserves this locus.** An MRN is unique only within its assigning-authority / OID
namespace, no registry reserves a range of them, and none is cited here. What the floor rests on
instead is the *namespace*, as a documented design decision: every synthetic identifier is scoped
to a namespace that clearly cannot be a real facility's, a `SYNTH`-labelled authority this package
mints and no real facility uses. A value under this AA can never collide with a real record
whatever its digits are, because the namespace itself is synthetic.

The OID is **uncited for the same reason**. `2.16.840.1.113883.19.999` is a value this package
chose; no published text designating the root `2.16.840.1.113883.19` for example use could be
shown, so this module claims no such designation and the guarantee above does not rest on one.

***

### SYNTHETIC\_CITY\_NAMES

> `const` **SYNTHETIC\_CITY\_NAMES**: readonly `string`[]

Obviously-synthetic city names. Combined only ever with a synthetic street + a fake name (the
*combination* is what identifies, and the combination is always synthetic).

***

### SYNTHETIC\_FAMILY\_NAMES

> `const` **SYNTHETIC\_FAMILY\_NAMES**: readonly `string`[]

Obviously-synthetic family names. None is a plausible real surname at a real address.

***

### SYNTHETIC\_GIVEN\_NAMES

> `const` **SYNTHETIC\_GIVEN\_NAMES**: readonly `string`[]

Obviously-synthetic given names. None is a plausible real person's name.

***

### SYNTHETIC\_STREET\_NAMES

> `const` **SYNTHETIC\_STREET\_NAMES**: readonly `string`[]

Obviously-synthetic street names for structured address fields.

***

### TEST\_NET\_V4\_PREFIXES

> `const` **TEST\_NET\_V4\_PREFIXES**: readonly `string`[]

RFC 5737 IPv4 documentation (TEST-NET) `/24` network prefixes.

***

### VERSION

> `const` **VERSION**: `string` = `"0.1.9"`

Library version string, equal to this package's published `package.json#version`.

Changesets owns the bump and rewrites `package.json` only, so the release `version` script runs
`scripts/sync-version.mjs` to rewrite this declaration in the same commit, and
`test/sanity.test.ts` compares the two so a skipped sync goes red instead of shipping a version
string that lies.

The `: string` annotation is deliberate: without it the declaration's inferred type is the string
literal itself, which bakes the current release into the emitted declarations and narrows every
consumer's type on each bump.

#### Example

```ts
import { VERSION } from "@cosyte/synth";
console.log(VERSION);
```

## Functions

### address()

> **address**(`rng`): [`SyntheticAddress`](#syntheticaddress)

A **synthetic address**: a fake street + city, a reserved non-real ZIP (`00000`). A real state
abbreviation may appear (structural only) but is never combined with a real street + name + DOB.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

#### Returns

[`SyntheticAddress`](#syntheticaddress)

A [SyntheticAddress](#syntheticaddress).

#### Example

```ts
import { createRng, address } from "@cosyte/synth";
address(createRng(1)); // { street, city, state, zip: "00000" }
```

***

### assertIntendedWarnings()

> **assertIntendedWarnings**(`intendedWarnings`, `bareWarnings`): `void`

Assert a freshly-generated quirk artifact **actually** round-trips to its intended warning(s), or
**fail closed**. This is the generator's self-check on the intended-warning contract: a
fixture whose bare parse does not produce exactly the declared code(s) is a *mislabeled* fixture, a
golden file that lies about the parser verdict it anchors, and must never be emitted. It is a
stronger guard than "the transform changed some bytes": a transform can mutate the wrong element (a
template a given document type does not key its warning on) and still change bytes while producing no
warning. Every format's `generate*Quirk` calls this after transforming, so the contract is enforced at
generation time, not merely at round-trip time.

It no longer takes the quirk name. That parameter existed for one reason, to be interpolated into
the refusal, and a parameter whose only job is to reach a message is the exact shape this package
is removing, so it is gone rather than merely unused. The refusal names neither code list either;
both are caller-supplied, and the caller reads the comparison back off the arguments it holds.

#### Parameters

##### intendedWarnings

readonly `string`[]

The declared intended code(s).

##### bareWarnings

readonly `string`[]

The code(s) a bare parse of the generated artifact actually produced.

#### Returns

`void`

#### Throws

SynthError `SYNTH_INTENDED_WARNING_MISMATCH` when the bare parse did not produce exactly
  the intended code(s).

#### Example

```ts
import { assertIntendedWarnings } from "@cosyte/synth";
assertIntendedWarnings(["UNKNOWN_SEGMENT"], ["UNKNOWN_SEGMENT"]); // ok
```

***

### createRng()

> **createRng**(`seed`): [`Rng`](#rng)

Create a seeded, deterministic [Rng](#rng). The same `seed` yields the same sequence everywhere.

#### Parameters

##### seed

`number`

The integer seed. Coerced to a 32-bit integer.

#### Returns

[`Rng`](#rng)

A fresh, independent [Rng](#rng).

#### Example

```ts
import { createRng } from "@cosyte/synth";
const rng = createRng(12345);
rng.int(1, 6); // deterministic for seed 12345
```

***

### dateYmd()

> **dateYmd**(`rng`, `minYear?`, `maxYear?`): `string`

A **synthetic date** in HL7 `YYYYMMDD` form, drawn uniformly within an inclusive year range. Comes
from the seeded generator (never wall-clock), so it is reproducible and implies no real event.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

##### minYear?

`number` = `1930`

Inclusive lower year bound (default `1930`).

##### maxYear?

`number` = `2010`

Inclusive upper year bound (default `2010`).

#### Returns

`string`

An `YYYYMMDD` date string (always a valid calendar day).

#### Example

```ts
import { createRng, dateYmd } from "@cosyte/synth";
dateYmd(createRng(1), 1970, 2000); // "YYYYMMDD"
```

***

### dea()

> **dea**(`rng`, `person?`): `string`

A **synthetic DEA number**: `<registrant-type><initial>` + 7 digits with a **deliberately-invalid
checksum**, so it can never be a validly-issued DEA registration (a real DEA number's 7th digit
satisfies the published DEA checksum). The first letter is a registrant-type letter, the
second is derived from `person` (its family initial) when supplied so the number reads plausibly; the
6-digit base is seeded and the check digit is set to `(correct + 1) mod 10`, guaranteeing the value
fails validation. NCPDP carries prescriber DEA, and this is the identity locus a refuter attacks
hardest, so, like [npi](#npi), non-collision is a construction-level guarantee, not a heuristic.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

##### person?

[`SyntheticName`](#syntheticname)

Optional name whose family initial becomes the DEA's second letter.

#### Returns

`string`

A DEA-shaped string that is provably not a real DEA registration.

#### Example

```ts
import { createRng, dea, isSyntheticDea } from "@cosyte/synth";
isSyntheticDea(dea(createRng(1))); // true: invalid checksum by construction
```

***

### deaCheckDigit()

> **deaCheckDigit**(`base6`): `number`

The correct DEA check digit for a 7-digit numeric base. The checksum is
`(d1 + d3 + d5) + 2·(d2 + d4 + d6)`, whose **units digit** is the 7th (check) digit. A real DEA
number satisfies this; a number whose 7th digit differs cannot be a validly-issued DEA registration.

**NON-NORMATIVELY SOURCED, and this is the one locus in this module that is.** The formula above
is quoted from a pharmacy journal article, Gabay, "Federal Controlled Substances Act: Controlled
Substances Prescriptions", Hospital Pharmacy (PMC3847977): "add the sum of the first, third, and
fifth digits to twice the sum of the second, fourth, and sixth digits. The total should be a
number whose last digit is the same as the last digit of the DEA number."
\<https://pmc.ncbi.nlm.nih.gov/articles/PMC3847977/\>

**That article is not the DEA.** It is a secondary description of the agency's algorithm, not the
agency's own statement of it, and no DEA-published text stating the algorithm is cited here. The
consequence is stated rather than hidden: if the formula is wrong, a value this package builds to
fail it may in fact **pass** the real check, and the generator would then emit a checksum-valid
DEA number while [isSyntheticDea](#issyntheticdea) asserts the opposite. Every other entry in this module's
`Sources:` list names the issuing authority's own text; this one cannot.

#### Parameters

##### base6

`string`

The first 6 digits of the DEA number (positions 1 to 6).

#### Returns

`number`

The check digit (`0` to `9`) a real DEA number would carry for this base.

#### Example

```ts
import { deaCheckDigit } from "@cosyte/synth";
deaCheckDigit("123456"); // the units digit of (1+3+5) + 2·(2+4+6)
```

***

### defineSynthProfile()

> **defineSynthProfile**(`spec`): [`SynthProfile`](#synthprofile)

Define a reusable, frozen synthetic-fixture profile.

#### Parameters

##### spec

[`SynthProfileSpec`](#synthprofilespec)

The profile spec; `name` is required and non-empty.

#### Returns

[`SynthProfile`](#synthprofile)

A deep-frozen [SynthProfile](#synthprofile).

#### Throws

SynthError `SYNTH_INVALID_PROFILE` when `name` is missing or blank.

#### Example

```ts
import { defineSynthProfile } from "@cosyte/synth";
// Name pools only: `quirks` is left out, so a quirk corpus given this profile applies every quirk.
const acme = defineSynthProfile({
  name: "acme-hospital",
  givenNames: ["Testina"],
  familyNames: ["Testerson"],
});
```

***

### email()

> **email**(`rng`, `person?`): `string`

A **synthetic email** at an RFC 2606 / 6761 reserved domain: `<slug>@example.com`.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

##### person?

[`SyntheticName`](#syntheticname)

Optional name to derive the local-part slug from; otherwise a random slug is used.

#### Returns

`string`

A synthetic email address.

#### Example

```ts
import { createRng, email, name } from "@cosyte/synth";
email(createRng(1), name(createRng(1))); // "<given>.<family>@example.com"
```

***

### identifier()

> **identifier**(`rng`, `typeCode?`): [`SyntheticIdentifier`](#syntheticidentifier)

A **synthetic identifier** (MRN / account / member id) scoped to the synthetic assigning authority.
There is no reserved MRN range, so non-collision is guaranteed by the *namespace*, not the value: the
identifier lives under a `SYNTH` authority no real facility uses.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

##### typeCode?

`"MR"` \| `"AN"` \| `"MB"` = `"MR"`

The HL7 identifier type: `MR` (default), `AN`, or `MB`.

#### Returns

[`SyntheticIdentifier`](#syntheticidentifier)

A [SyntheticIdentifier](#syntheticidentifier).

#### Example

```ts
import { createRng, identifier } from "@cosyte/synth";
identifier(createRng(1), "MR"); // { value, typeCode: "MR", assigningAuthority: "COSYTE-SYNTH", ... }
```

***

### ipv4()

> **ipv4**(`rng`): `string`

A **synthetic IPv4** in an RFC 5737 TEST-NET block, never routable.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

#### Returns

`string`

A TEST-NET IPv4 address string.

#### Example

```ts
import { createRng, ipv4 } from "@cosyte/synth";
ipv4(createRng(1)); // e.g. "192.0.2.NN"
```

***

### ipv6()

> **ipv6**(`rng`): `string`

A **synthetic IPv6** in the RFC 3849 documentation prefix `2001:db8::/32`, never routable.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

#### Returns

`string`

A documentation-prefix IPv6 address string.

#### Example

```ts
import { createRng, ipv6 } from "@cosyte/synth";
ipv6(createRng(1)); // e.g. "2001:db8::NNNN"
```

***

### isItinFormatted()

> **isItinFormatted**(`value`): `boolean`

Whether a `ddd-dd-dddd` (or `ddddddddd`) value is a **validly formatted IRS ITIN**: it begins
with `9` and its group digits (positions 4 and 5) fall inside a published ITIN group range
([ITIN\_GROUP\_RANGES](#itin_group_ranges)). This is the second issuing authority sharing the SSN number space,
so `isSyntheticSsn(v) && !isItinFormatted(v)` is the full "cannot be a federally issued national
id" guarantee, of which the area rule alone is only half.

`true` means the value is ITIN-shaped and therefore **must not** be emitted at an SSN locus. A
value that is not exactly 9 digits once separators are stripped returns `false` (not an SSN/ITIN
shape) rather than throwing, as do the group values `89` and `93`, which the IRM reserves for
other IRS programs rather than for ITINs.

#### Parameters

##### value

`string`

The candidate national id (dashes and other separators optional).

#### Returns

`boolean`

`true` when the value is formatted as a valid ITIN.

#### Example

```ts
import { isItinFormatted } from "@cosyte/synth";
isItinFormatted("912-70-1234"); // true: group 70 is inside a published ITIN range
isItinFormatted("912-66-1234"); // false: group 66 is outside every published ITIN range
```

***

### isSyntheticDea()

> **isSyntheticDea**(`value`): `boolean`

Whether a DEA number (`XX` + 7 digits, case-insensitive) is **provably synthetic**: its check digit
(the 7th digit) does **not** match the checksum [deaCheckDigit](#deacheckdigit) computes, so it cannot be a
validly-issued DEA registration. A checksum-valid DEA number (which *could* denote a real
prescriber) returns `false`; a value that is not the DEA shape returns `false`.

**NON-NORMATIVELY SOURCED.** This predicate is only as strong as the algorithm it inverts, and
that algorithm is cited to a pharmacy journal article (PMC3847977), **not to the DEA**: no
DEA-published statement of it is cited anywhere in this package. Read `true` as "fails the
formula [deaCheckDigit](#deacheckdigit) implements", never as "the DEA could not have issued this". The
full citation and the consequence of the formula being wrong are on [deaCheckDigit](#deacheckdigit).

#### Parameters

##### value

`string`

The candidate DEA number (with or without incidental separators).

#### Returns

`boolean`

`true` when the DEA number's checksum is wrong (never a real DEA registration).

#### Example

```ts
import { isSyntheticDea } from "@cosyte/synth";
isSyntheticDea("AF1234561"); // depends on the base: true when the 7th digit is wrong
```

***

### isSyntheticEmail()

> **isSyntheticEmail**(`value`): `boolean`

Whether an email's domain is an RFC 2606 / 6761 reserved / test domain.

#### Parameters

##### value

`string`

The candidate email address.

#### Returns

`boolean`

`true` when the domain is reserved (never real).

#### Example

```ts
import { isSyntheticEmail } from "@cosyte/synth";
isSyntheticEmail("faux.testerson@example.com"); // true
```

***

### isSyntheticIp()

> **isSyntheticIp**(`value`): `boolean`

Whether an IP string is in an RFC 5737 (IPv4 TEST-NET) or RFC 3849 (IPv6 documentation) reserved
block. A real routable address returns `false`.

#### Parameters

##### value

`string`

The candidate IPv4 or IPv6 address.

#### Returns

`boolean`

`true` when the address is a reserved documentation address.

#### Example

```ts
import { isSyntheticIp } from "@cosyte/synth";
isSyntheticIp("192.0.2.44");  // true (TEST-NET-1)
isSyntheticIp("8.8.8.8");     // false (real)
```

***

### isSyntheticNpi()

> **isSyntheticNpi**(`value`): `boolean`

Whether a 10-digit NPI is **provably synthetic**, i.e. its check digit is invalid, so it cannot be
a validly issued NPI. A Luhn-valid 10-digit NPI (which *could* denote a real registered provider)
returns `false`; a non-10-digit value returns `false` (not an NPI shape).

The check this inverts is the one 69 FR 3434 (FR Doc 04-1149) requires: the Luhn check digit,
computed as though the NPI were preceded by [NPI\_LUHN\_PREFIX](#npi_luhn_prefix). Unlike the DEA locus, this
one cites the issuing rule itself.
\<https://www.federalregister.gov/documents/full_text/text/2004/01/23/04-1149.txt\>

#### Parameters

##### value

`string`

The candidate NPI (digits only, or with incidental separators).

#### Returns

`boolean`

`true` when the NPI's check digit is wrong (never a real NPI).

#### Example

```ts
import { isSyntheticNpi } from "@cosyte/synth";
isSyntheticNpi("1234567894"); // true: invalid check digit (valid would be 1234567893)
isSyntheticNpi("1234567893"); // false: Luhn-valid, could be a real NPI
```

***

### isSyntheticPhone()

> **isSyntheticPhone**(`value`): `boolean`

Whether a phone string contains the NANP `555-0100…555-0199` reserved fictional line range.

#### Parameters

##### value

`string`

The candidate phone (any formatting).

#### Returns

`boolean`

`true` when the number is in the reserved fictional block.

#### Example

```ts
import { isSyntheticPhone } from "@cosyte/synth";
isSyntheticPhone("(202) 555-0142"); // true
```

***

### isSyntheticSsn()

> **isSyntheticSsn**(`value`): `boolean`

Whether a `ddd-dd-dddd` (or `ddddddddd`) SSN string carries an area SSA's own manual identifies
as **invalid**: `000`, `666`, or "in the 900 series". A real, issuable SSN returns `false`.

The citable claim is SSA POMS RM 10201.035, which defines an invalid SSN as "one that we never
assigned" and lists those three areas as identifying one. The wording here says invalid rather
than never-issued because invalidity is what the manual states.
\<https://secure.ssa.gov/poms.nsf/lnx/0110201035\>

#### Parameters

##### value

`string`

The candidate SSN (dashes optional).

#### Returns

`boolean`

`true` when the SSN is provably synthetic.

#### Example

```ts
import { isSyntheticSsn } from "@cosyte/synth";
isSyntheticSsn("900-12-3456"); // true (the 900 series marks an invalid SSN)
isSyntheticSsn("123456789");   // false (issuable area 123)
```

***

### luhnMod10()

> **luhnMod10**(`digits`): `number`

The Luhn sum (mod 10) of a numeric string, doubling every second digit from the right. Used to
verify (or deliberately break) an NPI check digit.

#### Parameters

##### digits

`string`

A string of decimal digits.

#### Returns

`number`

The Luhn sum modulo 10 (0 ⇒ the string passes the Luhn check).

#### Example

```ts
import { luhnMod10 } from "@cosyte/synth";
luhnMod10("79927398713"); // 0, a string that passes the Luhn check
```

***

### makeCorpus()

> **makeCorpus**(`seed`, `artifacts`, `quirks?`): [`Corpus`](#corpus)

Assemble a deep-frozen [Corpus](#corpus) from a seed and its artifacts, deriving the manifest.

#### Parameters

##### seed

`number`

The seed the artifacts were generated from.

##### artifacts

readonly [`Artifact`](#artifact)[]

The generated artifacts, in order.

##### quirks?

readonly `string`[] = `[]`

The quirk names applied (default none).

#### Returns

[`Corpus`](#corpus)

A deep-frozen, self-describing [Corpus](#corpus).

#### Example

```ts
import { makeCorpus } from "@cosyte/synth";
const corpus = makeCorpus(1, [{ format: "hl7v2", kind: "ADT^A01", content, warnings: [] }]);
corpus.manifest.counts["ADT^A01"]; // 1
```

***

### name()

> **name**(`rng`): [`SyntheticName`](#syntheticname)

A **synthetic name** drawn from the shipped clearly-fake pool.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

#### Returns

[`SyntheticName`](#syntheticname)

A [SyntheticName](#syntheticname).

#### Example

```ts
import { createRng, name } from "@cosyte/synth";
const { given, family } = name(createRng(1));
```

***

### npi()

> **npi**(`rng`): `string`

A **synthetic NPI**: a 10-digit National Provider Identifier with a **deliberately-invalid Luhn
check digit**, so it can never be a NPPES-issued NPI (a real NPI must satisfy the `80840`-prefixed
Luhn check). The 9-digit base is drawn from the seeded generator; the check digit is
set to `(correct + 1) mod 10`, guaranteeing the full value fails validation.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

#### Returns

`string`

A 10-digit NPI-shaped string that is provably not a real NPI.

#### Example

```ts
import { createRng, npi, isSyntheticNpi } from "@cosyte/synth";
isSyntheticNpi(npi(createRng(1))); // true: invalid check digit by construction
```

***

### npiCheckDigit()

> **npiCheckDigit**(`base9`): `number`

The correct NPI check digit for a 9-digit base: the value that makes `80840` + base + check pass
the Luhn check.

The algorithm this inverts is cited: 69 FR 3434 (FR Doc 04-1149) requires the check digit to be
"calculated using the ISO standard Luhn check digit algorithm", a modulus 10 double-add-double
algorithm, performed as though the NPI were preceded by [NPI\_LUHN\_PREFIX](#npi_luhn_prefix). That rule names
the algorithm and its behaviour but no ISO document number, and points onward for the step-by-step
form: "The specification for calculation of the NPI check digit will be made available on the CMS
Web site". What this function implements is the rule's own description, modulus 10 Luhn over the
prefixed digits; no separate specification is cited for it.
\<https://www.federalregister.gov/documents/full_text/text/2004/01/23/04-1149.txt\>

#### Parameters

##### base9

`string`

The 9-digit NPI base (positions 1 to 9).

#### Returns

`number`

The check digit (`0` to `9`) a real NPI would carry for this base.

#### Example

```ts
import { npiCheckDigit } from "@cosyte/synth";
npiCheckDigit("123456789"); // 3, so 1234567893 is a Luhn-valid NPI shape
```

***

### phone()

> **phone**(`rng`): `string`

A **synthetic phone** in the NANP reserved fictional block: `(AAA) 555-01NN`. The reserved
guarantee is the `555-01NN` tail (exchange 555, line 0100 to 0199); the area code is any NANP-valid
`NXX`. Can never be a working number.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

#### Returns

`string`

A formatted synthetic phone string.

#### Example

```ts
import { createRng, phone } from "@cosyte/synth";
phone(createRng(1)); // e.g. "(2XX) 555-01NN"
```

***

### profileTolerated()

> **profileTolerated**(`disposition`, `intendedWarnings`, `warningsUnderProfile`): `boolean`

Evaluate whether a profiled parse tolerated a quirk as its disposition declares. Shared across the
formats so the "suppressed vs re-badged" logic lives in exactly one place.

#### Parameters

##### disposition

[`QuirkProfileDisposition`](#quirkprofiledisposition)

The quirk's declared profile disposition.

##### intendedWarnings

readonly `string`[]

The bare-parse intended code(s).

##### warningsUnderProfile

readonly `string`[]

The code(s) the parser emitted with the profile active.

#### Returns

`boolean`

`true` iff the profile handled the quirk correctly for its disposition.

#### Example

```ts
import { profileTolerated } from "@cosyte/synth";
profileTolerated("suppressed", ["UNKNOWN_SEGMENT"], []); // true: the profile suppressed it
```

***

### resolveKind()

> **resolveKind**\<`T`\>(`allowed`, `requested`): `T`

Resolve one caller-supplied selector against the closed set that governs it, or **fail closed**.

#### Type Parameters

##### T

`T` *extends* `string`

#### Parameters

##### allowed

readonly `T`[]

Every value the selector may take.

##### requested

`string`

The selector the caller supplied.

#### Returns

`T`

`requested`, narrowed to the union.

#### Throws

SynthError `SYNTH_UNSUPPORTED_KIND` when `requested` is not in `allowed`.

#### Example

```ts
import { resolveKind } from "@cosyte/synth";
resolveKind(["ccd", "referralNote"] as const, "ccd"); // "ccd"
```

***

### resolveMix()

> **resolveMix**\<`T`\>(`allowed`, `requested`, `fallback`): readonly `T`[]

Resolve every entry of a caller-supplied corpus mix, in order, or **fail closed** on the first
unrecognised one.

It substitutes the default **only** when the caller supplied nothing, which is exactly what the
`??` it replaced did. An empty array is a supplied mix and is returned as one. An earlier version
of this function also treated `[]` as "nothing supplied", on the stated grounds that it matched the
previous behaviour; it did not: `??` fires on `undefined` and never on `[]`, and it changed the
result of six published entry points, turning an explicit empty selection into "generate one of
everything". A convenience that fails open is not a convenience. Every corpus then refuses the empty
mix with `SYNTH_EMPTY_POOL`, before it generates anything.

#### Type Parameters

##### T

`T` *extends* `string`

#### Parameters

##### allowed

readonly `T`[]

Every kind the corpus may generate.

##### requested

readonly `string`[] \| `undefined`

The mix the caller supplied, or `undefined` for the default.

##### fallback

readonly `T`[]

The default mix, used only when `requested` is `undefined`.

#### Returns

readonly `T`[]

The resolved mix.

#### Throws

SynthError `SYNTH_UNSUPPORTED_KIND` on the first unrecognised entry.

#### Example

```ts
import { resolveMix } from "@cosyte/synth";
resolveMix(["Result", "Order"] as const, ["Order"], ["Result", "Order"]); // ["Order"]
```

***

### resolveQuirk()

> **resolveQuirk**(`registry`, `format`, `name`): [`QuirkDescriptor`](#quirkdescriptor)

Resolve a requested quirk name against a format's registry, or **fail closed**. A quirk the format's
profile system does not support is a fatal `SYNTH_UNSUPPORTED_QUIRK`, never a silent no-op and never
a fabricated quirk with a made-up warning.

The refusal names neither the request nor the registry. `registry`, `format` and `name` are all
caller-supplied, and a diagnostic that quotes its input is a diagnostic that can be made to carry
anything the caller was holding, which for a fixture generator wired into someone else's pipeline
is not a hypothetical. Branch on `err.code`; the supported set is the registry you passed
(`HL7_QUIRKS`, `CCDA_QUIRKS`, `ASTM_QUIRKS`), which you can enumerate directly.

#### Parameters

##### registry

`Readonly`\<`Record`\<`string`, [`QuirkDescriptor`](#quirkdescriptor)\>\>

The format's quirk descriptors, keyed by name.

##### format

[`SynthFormat`](#synthformat)

The format being generated.

##### name

`string`

The requested quirk name.

#### Returns

[`QuirkDescriptor`](#quirkdescriptor)

The matching [QuirkDescriptor](#quirkdescriptor).

#### Throws

SynthError with code `SYNTH_UNSUPPORTED_QUIRK` when `name` is not a supported quirk.

#### Example

```ts
import { resolveQuirk } from "@cosyte/synth";
import { HL7_QUIRKS } from "@cosyte/synth/hl7";
resolveQuirk(HL7_QUIRKS, "hl7v2", "unknown-zsegment").intendedWarnings; // ["UNKNOWN_SEGMENT"]
```

***

### sameCodeSet()

> **sameCodeSet**(`a`, `b`): `boolean`

Exact multiset (order-independent) equality of two code lists: the intended-warning comparison.

#### Parameters

##### a

readonly `string`[]

The first code list.

##### b

readonly `string`[]

The second code list.

#### Returns

`boolean`

`true` iff the two lists contain the same codes with the same multiplicities.

#### Example

```ts
import { sameCodeSet } from "@cosyte/synth";
sameCodeSet(["A", "B"], ["B", "A"]); // true
```

***

### sfc32Next()

> **sfc32Next**(`s`): `number`

Advance an [Sfc32State](#sfc32state) in place by one step and return the next unsigned 32-bit integer.

This is the canonical `sfc32` step. The state object is mutated (the counter `d` increments and the
mixing words rotate); callers that need reproducible independence hold their own state and never
share it: ../rng/rng.Rng creates a fresh state per seed so two runs from the same seed are
identical.

#### Parameters

##### s

[`Sfc32State`](#sfc32state)

The state to advance. Mutated in place.

#### Returns

`number`

The next `uint32` in the stream.

#### Example

```ts
import { sfc32Next, type Sfc32State } from "@cosyte/synth";
const s: Sfc32State = { a: 1, b: 2, c: 3, d: 4 };
const x = sfc32Next(s); // uint32
```

***

### splitmix32()

> **splitmix32**(`seed`): () => `number`

A stateful `splitmix32` step function. Each call advances the internal 32-bit state and returns the
next unsigned 32-bit integer. Deterministic for a given seed.

#### Parameters

##### seed

`number`

The 32-bit seed. Coerced to a 32-bit integer via `| 0`.

#### Returns

A nullary function returning the next `uint32` in the stream.

() => `number`

#### Example

```ts
import { splitmix32 } from "@cosyte/synth";
const next = splitmix32(12345);
const a = next(); // deterministic uint32
```

***

### ssn()

> **ssn**(`rng`, `block?`): `string`

A **synthetic SSN**: dashed `AAA-GG-SSSS`, drawn so it can be neither an SSA-assignable Social
Security number nor a validly formatted IRS ITIN. Two authorities share this number space: SSA
never issues area `900-999`, and the IRS issues ITINs *inside* that area, distinguished by the
group digits. So the area rule alone is only half the guarantee, and both blocks below also keep
the group outside every published ITIN group range (see [isItinFormatted](#isitinformatted)).

Default draws the never-issued area space (`900-999`) with a group from
SSN\_SYNTHETIC\_GROUPS; `block: "advertising"` returns the fixed display block
`987-00-4320` to `987-00-4329`, whose group `00` is one SSA never assigns and one no published
ITIN range contains.

**`"advertising"` no longer means SSA's own advertising block.** That published block is
`987-65-4320` to `987-65-4329`, and group `65` sits inside a published ITIN group range, so every
value in it is ITIN-formatted and none of them can be emitted here. The option keeps its name
(renaming it would break call sites for a property no test asserts) and keeps its purpose, a fixed
ten-value block safe to print on screen, but it is a display block of this package's choosing now,
not a citation of SSA's. Do not reintroduce the `65` group to recover the provenance.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

##### block?

[`SsnBlock`](#ssnblock)

Which reserved space to draw from. Defaults to `"never-issued"`.

#### Returns

`string`

A dashed synthetic SSN string.

#### Example

```ts
import { createRng, ssn } from "@cosyte/synth";
ssn(createRng(1)); // e.g. a 900-area, never-issued, never-ITIN-formatted SSN
```

***

### uuid()

> **uuid**(`rng`): `string`

A **deterministic UUIDv4-shaped** surrogate key from the seeded generator. Because it is seeded (not
from `node:crypto`, which is not reproducible), the cryptographic non-collision argument is weaker,
acceptable because the identifier namespace is synthetic anyway, and noted honestly.

#### Parameters

##### rng

[`Rng`](#rng)

The seeded generator.

#### Returns

`string`

A canonical `8-4-4-4-12` lowercase-hex UUID string with version `4` and RFC 4122 variant.

#### Example

```ts
import { createRng, uuid } from "@cosyte/synth";
uuid(createRng(1)); // "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
```

***

### validateProfileQuirks()

> **validateProfileQuirks**(`profile`, `registry`, `format`): readonly `string`[]

Validate the quirk names carried by a [SynthProfile](#synthprofile) against a format's registry, failing closed
on the first unsupported one. Lets a consumer author a fixture recipe with `defineSynthProfile` and
have its quirks checked against the *parser's* real tolerance before any fixture is generated.

#### Parameters

##### profile

[`SynthProfile`](#synthprofile)

The synth profile whose `quirks` to validate.

##### registry

`Readonly`\<`Record`\<`string`, [`QuirkDescriptor`](#quirkdescriptor)\>\>

The format's quirk descriptors.

##### format

[`SynthFormat`](#synthformat)

The format being generated.

#### Returns

readonly `string`[]

The validated quirk names: the profile's, in order, or every quirk in `registry` when the
profile leaves `quirks` out. An empty `quirks` list comes back empty.

#### Throws

SynthError `SYNTH_UNSUPPORTED_QUIRK` for the first unsupported quirk.

#### Example

```ts
import { validateProfileQuirks, defineSynthProfile } from "@cosyte/synth";
import { HL7_QUIRKS } from "@cosyte/synth/hl7";
const p = defineSynthProfile({ name: "site", quirks: ["unknown-zsegment"] });
validateProfileQuirks(p, HL7_QUIRKS, "hl7v2"); // ["unknown-zsegment"]
```
