---
id: guides-hl7
title: Generate HL7 v2 messages
sidebar_label: HL7 v2
description: "Generate ADT, ORU, ORM, SIU, VXU, MDM, DFT and OML messages and their ACKs with @cosyte/hl7's builder, and check each one reads back clean."
---

# Generate HL7 v2 messages

The `@cosyte/synth/hl7` subpath builds HL7 v2.5 messages through `@cosyte/hl7`'s `buildMessage`.
Install `@cosyte/hl7` alongside it ([Installation](./installation.md)).

| Generator     | Message                                                           | Segments                                    |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `generateAdt` | `ADT^A01`, `A02`, `A03`, `A04`, `A08`, `A11`, `A13`, `A28`, `A31` | `MSH`, `EVN`, `PID`, `PV1`                  |
| `generateOru` | `ORU^R01`, a lab result                                           | `MSH`, `PID`, `OBR`, `OBX`...               |
| `generateOrm` | `ORM^O01`, an order                                               | `MSH`, `PID`, `ORC`, `OBR`                  |
| `generateSiu` | `SIU^S12`, a new appointment                                      | `MSH`, `SCH`, `PID`, `RGS`, `AIL`           |
| `generateVxu` | `VXU^V04`, an immunization update                                 | `MSH`, `PID`, `ORC`, `RXA`, `RXR`           |
| `generateMdm` | `MDM^T02`, a document and its text                                | `MSH`, `EVN`, `PID`, `PV1`, `TXA`, `OBX`... |
| `generateDft` | `DFT^P03`, a posted charge                                        | `MSH`, `EVN`, `PID`, `PV1`, `FT1`           |
| `generateOml` | `OML^O21`, a laboratory order                                     | `MSH`, `PID`, `ORC`, `OBR`                  |
| `generateAck` | `ACK`, an acknowledgment of any message                           | `MSH`, `MSA`, and `ERR` on an error         |

The ADT triggers are admit (`A01`), transfer (`A02`), discharge (`A03`), register (`A04`), update
patient information (`A08`), cancel admit (`A11`), cancel discharge (`A13`), add person information
(`A28`) and update person information (`A31`). A transfer carries the prior location in `PV1-6`, a
discharge its admit and discharge times in `PV1-44` and `PV1-45`, and `A28` and `A31` the patient
class `N`, not applicable.

Each returns `@cosyte/hl7`'s `Hl7Message`; call `toString()` for the wire text. Each takes
`{ seed }`, and the seed defaults to `0`.

`generateAdt` and `generateOru` also take `subject: "animal"`, which writes a veterinary patient and
its owner instead of a person: see [Generate animal patients](./guides-animal-patients.md).

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

`HL7_MESSAGE_KINDS` lists every kind it accepts. A kind outside it throws a `SynthError` with the code
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
the corpus seed. With no `mix` it cycles through the first seven kinds, `ADT^A01` to `VXU^V04`, so a
seed's default corpus does not change as kinds are added; `count` defaults to `1`:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const corpus = hl7Corpus({ seed: 7, count: 4, mix: ["ORU^R01", "VXU^V04"] });

corpus.artifacts.map((a) => a.kind); // => ["ORU^R01", "VXU^V04", "ORU^R01", "VXU^V04"]
corpus.manifest.counts; // => { "ORU^R01": 2, "VXU^V04": 2 }
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

Every artifact in a corpus has been round-tripped, and its `warnings` holds what the parser
reported. The corpus, its manifest, and each artifact are frozen.

To include every kind, pass `HL7_MESSAGE_KINDS` as the mix:

```ts runnable
import { HL7_MESSAGE_KINDS, hl7Corpus } from "@cosyte/synth/hl7";

const corpus = hl7Corpus({ seed: 7, count: HL7_MESSAGE_KINDS.length, mix: HL7_MESSAGE_KINDS });

corpus.artifacts.length; // => 17
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

For an ADT-only corpus, `triggers` takes the trigger events and replaces `mix`:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

hl7Corpus({ seed: 7, count: 2, triggers: ["A08"] }).artifacts.map((a) => a.kind); // => ["ADT^A08", "ADT^A08"]
```

## Acknowledge a message

`generateAck` answers a message with an `ACK`. It swaps the sender and receiver, echoes the
message's control ID in `MSA-2` and its trigger event in `MSH-9`, and is sent one to fifty-nine
seconds after it. `code` is `AA` (the default), `AE` or `AR`; an error adds an `ERR` naming HL7 table
0357 condition `207`, application internal error.

```ts runnable
import { generateAck, generateOru } from "@cosyte/synth/hl7";

const result = generateOru({ seed: 4 });
const ack = generateAck({ seed: 4, inbound: result, code: "AE" });
const [msh, msa, err] = ack.toString().split("\r");

msh?.split("|")[8]; // => "ACK^R01^ACK"
msa === `MSA|AE|${result.toString().split("|")[9] ?? ""}`; // => true
err; // => "ERR|||207^Application internal error^HL70357|E"
```

The seed sets the ACK's own control ID and time, so the same seed and message give the same bytes.
With no `inbound` it acknowledges the `ADT^A01` `generateAdt` makes from the same seed, which is
also what the `ACK` corpus kind holds. A message with no `MSH-10` throws
[`SYNTH_ACK_UNCORRELATED`](./fatal-codes.md#synth_ack_uncorrelated).

## What a message holds

- `MSH-3` and `MSH-4` name the sender as `COSYTE-SYNTH` and `SYNTH-FAC` (an `ACK` swaps the sender
  and the receiver); the version is `2.5`. There is no option to stamp another version: `@cosyte/hl7` has no per-version structure check, so
  we would have no way to show a message stamped 2.3.1 or 2.8 is valid for it. An `ACK` echoes the
  version of the message it answers.
- The kinds added after the first seven name their message structure in `MSH-9.3`, for example
  `ADT^A28^ADT_A05`; the first seven keep the two-component `MSH-9` they have always had.
- `MSH-11`, the processing ID, is `T`, never `P` (production), so every message says it is test
  data.
- `MSH-7` and the other timestamps come from the seeded generator, never the clock. `MSH-10`, the
  control ID, is seeded too.
- `PID` carries a name from the invented-name pool, a medical record number under the assigning
  authority `COSYTE-SYNTH`, a seeded birth date, an address with the ZIP Code `00000`, a phone
  number in `555-0100` to `555-0199`, and an SSN with a 900-series area.
- Codes in `OBX`, `OBR`, and `RXA` come from the small example pools the subpath exports
  (`EXAMPLE_LAB_OBSERVATIONS`, `EXAMPLE_ORDER_SERVICES`, `EXAMPLE_VACCINES`). A `DFT^P03` charge
  code is a local `SYNTHCHG` code in the coding system `99SYN`, and an `MDM^T02` document's text is
  a sentence that says it is synthetic.

[What it does and does not do](./limitations.md#the-synthetic-safety-posture-the-floors) gives the
authority behind each of those sources.

## Related

- [Generate vendor-quirk fixtures](./guides-quirks.md): an HL7 v2 message with a site-defined `Z`
  segment or an unknown escape.
- Reference: [`generateAdt`](./api/src/hl7.md#generateadt), [`generateAck`](./api/src/hl7.md#generateack),
  [`generateHl7`](./api/src/hl7.md#generatehl7), [`HL7_MESSAGE_KINDS`](./api/src/hl7.md#hl7_message_kinds),
  [`hl7Corpus`](./api/src/hl7.md#hl7corpus), [`roundTrip`](./api/src/hl7.md#roundtrip), and
  [`Hl7MessageKind`](./api/src/hl7.md#hl7messagekind).
