---
id: guides-hl7
title: Generate HL7 v2 messages
sidebar_label: HL7 v2
description: "Generate ADT, ORU, ORM, SIU, and VXU messages through @cosyte/hl7's builder, choose a mix for a corpus, and check each message reads back clean."
---

# Generate HL7 v2 messages

The `@cosyte/synth/hl7` subpath builds HL7 v2.5 messages through `@cosyte/hl7`'s `buildMessage`.
Install `@cosyte/hl7` alongside it ([Installation](./installation.md)).

| Generator     | Message                                   | Segments                         |
| ------------- | ----------------------------------------- | -------------------------------- |
| `generateAdt` | `ADT^A01`, `ADT^A04`, or `ADT^A08`        | `MSH`, `EVN`, `PID`, `PV1`       |
| `generateOru` | `ORU^R01`, a lab result                   | `MSH`, `PID`, `OBR`, `OBX`...    |
| `generateOrm` | `ORM^O01`, an order                       | `MSH`, `PID`, `ORC`, `OBR`       |
| `generateSiu` | `SIU^S12`, a new appointment              | `MSH`, `SCH`, `PID`, `RGS`, `AIL` |
| `generateVxu` | `VXU^V04`, an immunization update         | `MSH`, `PID`, `ORC`, `RXA`, `RXR` |

Each returns `@cosyte/hl7`'s `Hl7Message`; call `toString()` for the wire text. Each takes
`{ seed }`, and the seed defaults to `0`.

## Generate one message

```ts runnable
import { generateAdt, generateVxu } from "@cosyte/synth/hl7";

const admit = generateAdt({ seed: 12345, trigger: "A04" });
const vaccine = generateVxu({ seed: 12345 });

admit.toString().split("\r")[0]?.includes("|ADT^A04|"); // => true
vaccine.toString().split("\r")[0]?.includes("|VXU^V04|"); // => true
```

`generateAdt`'s `trigger` defaults to `"A01"`.

## Generate a message when the type is data

`generateHl7` takes the message kind as a string, for a test table or a command-line option:

```ts runnable
import { generateHl7 } from "@cosyte/synth/hl7";

const kinds = ["ORU^R01", "SIU^S12"] as const;
const headers = kinds.map((kind) => generateHl7(kind, 7).toString().split("\r")[0]?.split("|")[8]);

headers; // => ["ORU^R01", "SIU^S12"]
```

A kind outside the seven it generates throws a `SynthError` with the code
[`SYNTH_UNSUPPORTED_KIND`](./fatal-codes.md#synth_unsupported_kind).

## Check a message reads back clean

`roundTrip` serializes the message, parses it again with `@cosyte/hl7`, and reports what the parser
said:

```ts runnable
import { generateOru, roundTrip } from "@cosyte/synth/hl7";

const result = roundTrip(generateOru({ seed: 3 }));

result.warnings; // => []
result.byteStable; // => true
result.specClean; // => true
```

`specClean` is true when there are no warnings and the parsed message serializes back to the same
bytes. `content` holds the wire text.

## Build a corpus with a chosen mix

`hl7Corpus` generates `count` messages, cycling through `mix`, each from its own seed derived from
the corpus seed. With no `mix` it cycles through all seven kinds, and `count` defaults to `1`:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const corpus = hl7Corpus({ seed: 7, count: 4, mix: ["ORU^R01", "VXU^V04"] });

corpus.artifacts.map((a) => a.kind); // => ["ORU^R01", "VXU^V04", "ORU^R01", "VXU^V04"]
corpus.manifest.counts; // => { "ORU^R01": 2, "VXU^V04": 2 }
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

Every artifact in a corpus has been round-tripped, and its `warnings` holds what the parser
reported. The corpus, its manifest, and each artifact are frozen.

For an ADT-only corpus, `triggers` takes the trigger events and replaces `mix`:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

hl7Corpus({ seed: 7, count: 2, triggers: ["A08"] }).artifacts.map((a) => a.kind); // => ["ADT^A08", "ADT^A08"]
```

## What a message holds

- `MSH-3` and `MSH-4` name the sender as `COSYTE-SYNTH` and `SYNTH-FAC`; the version is `2.5`.
- `MSH-11`, the processing ID, is `T`, never `P` (production), so every message says it is test
  data.
- `MSH-7` and the other timestamps come from the seeded generator, never the clock. `MSH-10`, the
  control ID, is seeded too.
- `PID` carries a name from the invented-name pool, a medical record number under the assigning
  authority `COSYTE-SYNTH`, a seeded birth date, an address with the ZIP Code `00000`, a phone
  number in `555-0100` to `555-0199`, and an SSN with a 900-series area.
- Codes in `OBX`, `OBR`, and `RXA` come from the small example pools the subpath exports
  (`EXAMPLE_LAB_OBSERVATIONS`, `EXAMPLE_ORDER_SERVICES`, `EXAMPLE_VACCINES`).

[What it does and does not do](./limitations.md#the-synthetic-safety-posture-the-floors) gives the
authority behind each of those sources.

## Related

- [Generate vendor-quirk fixtures](./guides-quirks.md): an HL7 v2 message with a site-defined `Z`
  segment or an unknown escape.
- Reference: [`generateAdt`](./api/src/hl7.md#generateadt), [`generateHl7`](./api/src/hl7.md#generatehl7),
  [`hl7Corpus`](./api/src/hl7.md#hl7corpus), [`roundTrip`](./api/src/hl7.md#roundtrip), and
  [`Hl7MessageKind`](./api/src/hl7.md#hl7messagekind).
