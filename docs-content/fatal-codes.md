---
id: fatal-codes
title: Fatal codes
sidebar_label: Fatal codes
description: "Every code a SynthError carries: what each one means, what raises it, and the fixed message it comes with."
---

# Fatal codes

A generator has no input to tolerate, so every refusal is fatal: it throws a `SynthError` whose
`code` is one of the values below. Codes are part of the public contract, and `key === value` for
each one in `SYNTH_FATAL_CODES`. Branch on `err.code`, never on `err.message`.

Each message is a fixed string from the frozen `SYNTH_FATAL_MESSAGES` table, or, for a parser
that is not installed, from `SYNTH_PEER_MESSAGES`, which holds one fixed string for each parser
package. No message quotes a value you passed.

```ts runnable
import { SYNTH_FATAL_CODES, SYNTH_FATAL_MESSAGES, SynthError } from "@cosyte/synth";

const err = new SynthError(SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL);
err.name; // => "SynthError"
err.code; // => "SYNTH_EMPTY_POOL"
err.message === SYNTH_FATAL_MESSAGES.SYNTH_EMPTY_POOL; // => true
Object.keys(SYNTH_FATAL_CODES).length; // => 13
```

## The codes

### `SYNTH_UNSUPPORTED_KIND`

A selector you passed is not in the closed set that governs it: a message kind, a document type, a
corpus `mix` entry, an 837 variant, a Bundle type, an ADT trigger, or a US Core profile name the
guide does not publish. Raised before anything is generated, by every generator and corpus that
takes a selector, through `resolveKind` and `resolveMix`.

Message: "The requested kind, document type, corpus mix entry, variant or profile is not one this generator supports. The supported set is the exported union for that option."

### `SYNTH_PROFILE_NOT_GENERATED`

`generateUsCoreProfile` was asked for a profile the US Core 6.1.0 guide publishes and this build does
not generate. `usCoreCoverage()` says which profiles are generated. Raised before anything is
generated.

Message: "The requested profile is published by the adopted implementation guide, and this build does not generate it. The coverage surface reports, per adopted profile, whether it is generated."

### `SYNTH_UNSUPPORTED_QUIRK`

A quirk name is not in the target format's registry (`HL7_QUIRKS`, `CCDA_QUIRKS`, `ASTM_QUIRKS`).
Raised by the quirk generators and quirk corpora, and by `validateProfileQuirks` when a
`defineSynthProfile` profile names such a quirk. The [quirk catalog](./quirk-catalog.md) lists the
registries.

Message: "The requested vendor quirk is not in the target format's quirk registry. Compare the request against that format's exported registry (HL7_QUIRKS, CCDA_QUIRKS, ASTM_QUIRKS)."

### `SYNTH_INTENDED_WARNING_MISMATCH`

A quirk fixture, parsed with no profile, did not raise exactly the warning codes its quirk declares.
The quirk generators check this before they return, through `assertIntendedWarnings`, so a fixture
that would lie about its parser verdict is never returned. It can appear when a parser version
changes what it reports for a deviation.

Message: "A bare parse of the generated quirk artifact did not produce exactly the declared intended warning code(s). Refusing to emit a mislabeled fixture."

### `SYNTH_QUIRK_ANCHOR_ABSENT`

A quirk transform found nothing to change, so the fixture would not carry the deviation it is named
for. `injectCcdaQuirk` (`@cosyte/synth/ccda`) raises it when the XML you pass has nothing the quirk
can change. The C-CDA and ASTM quirk generators check for it too, but the clean documents they start
from always carry what each quirk changes.

Message: "The quirk transform found no structural anchor to mutate, so the fixture would not carry the deviation it is labelled with. Refusing to emit a mislabeled fixture."

### `SYNTH_INVALID_PROFILE`

`defineSynthProfile` was called without a `name`, or with one that is empty or only spaces.

Message: "defineSynthProfile requires a non-empty string name."

### `SYNTH_INVALID_RANGE`

The seeded generator's `int(min, max)` was called with `max` below `min`.

Message: "An integer range was requested with its maximum below its minimum."

### `SYNTH_EMPTY_POOL`

The seeded generator's `pick` was called with an empty list, or a corpus was given an empty list to
cycle through: an empty `mix` in any of the six corpora, an empty `triggers` list in `hl7Corpus`,
or an empty `quirks` list (or a `profile` whose `quirks` is an empty list) in `hl7QuirkCorpus`,
`ccdaQuirkCorpus` or `astmQuirkCorpus`. The corpus throws before it generates anything, whatever
the `count`. A `profile` that leaves `quirks` out is not an empty list: the corpus uses its
`quirks` option, or every quirk.

Message: "A value was drawn from an empty pool."

### `SYNTH_ACK_UNCORRELATED`

`generateAck` (`@cosyte/synth/hl7`) was given an inbound message with no MSH-10 message control id.
An ACK echoes that id in MSA-2, the field a receiver matches it on, so with no id there is nothing
to acknowledge. Raised before anything is generated. Every message this package generates carries
an MSH-10, so it is raised only for a message you build or parse yourself.

Message: "The inbound HL7 v2 message has no MSH-10 message control id, so an ACK could not echo it in MSA-2 and would answer no message."

### `SYNTH_UNMAPPED_CODE_SYSTEM`

`toBuildCode` (`@cosyte/synth/ccda`) was given a concept whose code-system URI has no OID in the
C-CDA example-code table.

Message: "The concept's code-system URI has no OID mapping in the C-CDA example-code table."

### `SYNTH_INVALID_DECIMAL`

`dec` (`@cosyte/synth/x12`) was given a string that is not an X12 decimal. The generators pass it
only whole numbers, so they never raise it.

Message: "The value could not be read as an X12 decimal."

### `SYNTH_PEER_NOT_INSTALLED`

A generator needs a sibling parser that is not installed: `@cosyte/synth/hl7` needs `@cosyte/hl7`,
and so on. Raised on the first call that needs the parser, the same way from the ES module build and
the CommonJS build. The error's `peer` is the missing package, its message names the package and
the command that installs it, and its `cause` is the error Node.js raised (`ERR_MODULE_NOT_FOUND`
from the ES module build, `MODULE_NOT_FOUND` from the CommonJS build). It is raised only when the
missing package is the parser itself: if the parser is installed and one of its own dependencies
is missing, that error reaches you unchanged.

```ts runnable
import { SYNTH_FATAL_CODES, SYNTH_PEER_MESSAGES, SynthError } from "@cosyte/synth";

const err = new SynthError(SYNTH_FATAL_CODES.SYNTH_PEER_NOT_INSTALLED, { peer: "@cosyte/hl7" });
err.peer; // => "@cosyte/hl7"
err.message === SYNTH_PEER_MESSAGES["@cosyte/hl7"]; // => true
err.message.endsWith("npm install @cosyte/hl7"); // => true
```

With a parser named, the message is "`<package>` is not installed, and this generator builds through
it. Install it beside @cosyte/synth: npm install `<package>`". Without one:

Message: "A sibling @cosyte parser this generator builds through is not installed. Install it beside @cosyte/synth."

### `SYNTH_UNSUPPORTED_FORMAT`

Reserved. No code path in this build raises it: all six formats generate, and an unknown kind within
a format is `SYNTH_UNSUPPORTED_KIND`. It is kept because removing a published code is a breaking
change.

Message: "The requested format is not generable by this build. A generator has no byte fallback: it builds through a parser's own serializer or it refuses."

## Errors that are not a `SynthError`

- A round-trip helper parses the document you pass it with the sibling parser. If that parser
  cannot read it, the parser's own fatal error reaches you unchanged.
- In the `@cosyte/synth/deid` pairing loops, `x12DeidLoop({ variant })` and
  `ncpdpTelecomDeidLoop({ transaction })` throw a plain `TypeError` for a value outside their
  union, and `ccdaDeidLoop({ documentType })` treats anything but `"ccd"` as a Referral Note.
  Neither quotes your value.

## Related

- [Troubleshooting](./troubleshooting.md#an-unsupported-request-threw): what to do when one is
  thrown.
- Reference: [`SynthError`](./api/src.md#syntherror),
  [`SYNTH_FATAL_CODES`](./api/src.md#synth_fatal_codes), and
  [`SYNTH_FATAL_MESSAGES`](./api/src.md#synth_fatal_messages).
- [Troubleshooting](./troubleshooting.md#a-parser-is-not-installed): a parser that is not
  installed.
