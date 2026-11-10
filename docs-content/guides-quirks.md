---
id: guides-quirks
title: Generate vendor-quirk fixtures
sidebar_label: Vendor quirks
description: "Generate off-spec HL7 v2, C-CDA, and ASTM fixtures, each raising exactly the warning it is meant to, and check a parser profile tolerates it."
---

# Generate vendor-quirk fixtures

A spec-clean fixture shows that a parser reads a correct message. A quirk fixture shows how it
handles the deviations real vendor traffic carries: does it read the message, and does it raise the
right warning?

Each quirk changes the structure of a message that otherwise reads back with no warnings, so that a
parse with no profile raises exactly one intended warning code. The quirks are the ones the Cosyte
parsers' own profile systems (`defineProfile` in `@cosyte/hl7`, `defineCcdaProfile` in
`@cosyte/ccda`, `defineAstmProfile` in `@cosyte/astm`) describe as tolerable. Where a built-in public
profile claims the deviation, the round trip also parses under that profile and reports whether it
was suppressed or re-badged to `PROFILE_QUIRK_APPLIED`. Every quirk generator checks the intended
warning before it returns, so it never hands you a fixture that does not raise it.

A quirk changes the shape of a message, never where its values come from, so a quirk fixture is as
synthetic as any other. Quirks ship for HL7 v2, C-CDA, and ASTM; the
[quirk catalog](./quirk-catalog.md) lists every one.

## HL7 v2: a vendor Z segment

A site-defined `Z` segment is the usual HL7 v2 quirk. A parse with no profile flags it
`UNKNOWN_SEGMENT`; a profile that declares the segment suppresses it. Here that is
`@cosyte/hl7`'s public `visage` imaging profile, which declares `ZDS`:

```ts runnable
import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";

const rt = hl7QuirkRoundTrip(generateHl7Quirk({ seed: 12345, quirk: "unknown-zsegment" }));
rt.warnings; // => ["UNKNOWN_SEGMENT"]
rt.intendedWarningHeld; // => true
rt.withProfile?.tolerated; // => true
```

## C-CDA: a deprecated LOINC code

C-CDA profiles re-badge a tolerated deviation to `PROFILE_QUIRK_APPLIED`. A deprecated result LOINC
code raises `DEPRECATED_LOINC`, and `@cosyte/ccda`'s public `smartScorecard` profile re-badges it:

```ts runnable
import { generateCcdaQuirk, ccdaQuirkRoundTrip } from "@cosyte/synth/ccda";

const rt = ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 12345, quirk: "deprecated-loinc" }));
rt.warnings; // => ["DEPRECATED_LOINC"]
rt.withProfile?.warnings; // => ["PROFILE_QUIRK_APPLIED"]
rt.withProfile?.tolerated; // => true
```

## ASTM: a non-standard escape

An ASTM `&Z&` escape raises `ASTM_UNKNOWN_ESCAPE_SEQUENCE`, and `@cosyte/astm`'s public
`referenceCorpus` profile, grounded in the open-source python-astm and SENAITE corpora, re-badges it:

```ts runnable
import { generateAstmQuirk, astmQuirkRoundTrip } from "@cosyte/synth/astm";

const rt = astmQuirkRoundTrip(generateAstmQuirk({ seed: 12345, quirk: "unknown-escape" }));
rt.warnings; // => ["ASTM_UNKNOWN_ESCAPE_SEQUENCE"]
rt.withProfile?.tolerated; // => true
```

## An unknown quirk name throws

A quirk name outside the format's registry throws
[`SYNTH_UNSUPPORTED_QUIRK`](./fatal-codes.md#synth_unsupported_quirk). It is never ignored, and no
fixture is made up for it:

```ts runnable
import { generateHl7Quirk } from "@cosyte/synth/hl7";

let code = "";
try {
  generateHl7Quirk({ seed: 1, quirk: "no-such-quirk" as never });
} catch (err) {
  code = (err as { code?: string }).code ?? "";
}
code; // => "SYNTH_UNSUPPORTED_QUIRK"
```

Branch on `err.code`, never on `err.message`. The message is a fixed entry in the frozen
`SYNTH_FATAL_MESSAGES` table and does not name the quirk you asked for: `SynthError` takes a code
and no value, so nothing you pass reaches the thrown object. To see what a format accepts,
read its registry directly: `Object.keys(HL7_QUIRKS)`, `Object.keys(CCDA_QUIRKS)`,
`Object.keys(ASTM_QUIRKS)`.

## Build a quirk corpus

Each format has a quirk corpus that cycles through every quirk in its registry. Its manifest lists the
quirks applied, and each artifact's `warnings` holds the intended codes:

```ts runnable
import { ccdaQuirkCorpus } from "@cosyte/synth/ccda";

const corpus = ccdaQuirkCorpus({ seed: 42 });
[...corpus.manifest.quirks].sort(); // => ["deprecated-code-system", "deprecated-loinc", "template-extension-absent"]
```

## Choose the quirks with a profile

`defineSynthProfile` names a set of quirks once, and a quirk corpus takes it as `profile`. Each format
also exports a profile with every quirk it ships (`hl7QuirkProfile`, `ccdaQuirkProfile`,
`astmQuirkProfile`):

```ts runnable
import { defineSynthProfile } from "@cosyte/synth";
import { hl7QuirkCorpus } from "@cosyte/synth/hl7";

const labFeed = defineSynthProfile({ name: "lab-feed", quirks: ["unknown-escape"] });
const corpus = hl7QuirkCorpus({ seed: 1, count: 2, profile: labFeed });

corpus.manifest.quirks; // => ["unknown-escape"]
corpus.artifacts.map((a) => a.warnings); // => [["UNKNOWN_ESCAPE_SEQUENCE"], ["UNKNOWN_ESCAPE_SEQUENCE"]]
```

A profile that names a quirk outside the format's registry throws `SYNTH_UNSUPPORTED_QUIRK`.
`defineSynthProfile` also accepts `givenNames` and `familyNames` and stores them on the profile, but
no generator reads them in this release.

## Where each quirk comes from

Every quirk is grounded in a deviation that is documented in public, or in a parser's public
profile: a published implementation guide, a vendor interface specification, or an open-source
corpus that may be redistributed. A quirk that would need a private, vendor-attributed corpus is not
shipped. Quirks for FHIR, X12, and NCPDP are not generated yet.

## Related

- [Quirk catalog](./quirk-catalog.md): every quirk, its warning, and its profile.
- Reference: [`generateHl7Quirk`](./api/src/hl7.md#generatehl7quirk),
  [`hl7QuirkRoundTrip`](./api/src/hl7.md#hl7quirkroundtrip),
  [`generateCcdaQuirk`](./api/src/ccda.md#generateccdaquirk),
  [`generateAstmQuirk`](./api/src/astm.md#generateastmquirk),
  [`QuirkRoundTripResult`](./api/src.md#quirkroundtripresult), and
  [`defineSynthProfile`](./api/src.md#definesynthprofile).
