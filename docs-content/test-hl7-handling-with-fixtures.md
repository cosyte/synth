---
id: test-hl7-handling-with-fixtures
title: Test your HL7 handling with generated fixtures
sidebar_label: Test HL7 handling
description: "A tutorial: write a small HL7 v2 reader, test it with a generated message, every message family, a pinned seed, and a vendor deviation."
---

# Test your HL7 handling with generated fixtures

In this tutorial we write a small piece of code that reads HL7 v2 admissions and test it with
fixtures from `@cosyte/synth`. We start from one generated message and end with a fixture that
carries a vendor deviation and the warning it should raise. Every message is synthetic, so the
tests can live in a public repository and print their input to a CI log.

You need `@cosyte/synth` and `@cosyte/hl7` installed ([Installation](./installation.md)). Each
step is a complete program you can run on its own.

## 1. Write the code under test

The code under test reads three things from a message with `@cosyte/hl7`: the message type, the
trigger event, and the patient's family name. Feed it a generated `ADT^A01`:

```ts runnable
import { parseHL7 } from "@cosyte/hl7";
import { generateAdt } from "@cosyte/synth/hl7";

function summarize(raw: string) {
  const msg = parseHL7(raw);
  return { type: msg.get("MSH.9.1"), trigger: msg.get("MSH.9.2"), family: msg.get("PID.5.1") };
}

const raw = generateAdt({ seed: 12345, trigger: "A01" }).toString();
const summary = summarize(raw);

summary.type; // => "ADT"
summary.trigger; // => "A01"
```

`generateAdt` returns `@cosyte/hl7`'s message model; `toString()` gives the wire text your code
would receive. Segments are separated by a carriage return, as HL7 v2 requires.

## 2. Check what the fixture carries

A generated value is not a value you typed, so assert on its kind rather than its spelling. The
family name comes from the shipped pool of invented names, and the medical record number sits
under the synthetic assigning authority `COSYTE-SYNTH`:

```ts runnable
import { parseHL7 } from "@cosyte/hl7";
import { SYNTHETIC_FAMILY_NAMES } from "@cosyte/synth";
import { generateAdt } from "@cosyte/synth/hl7";

const msg = parseHL7(generateAdt({ seed: 12345, trigger: "A01" }).toString());

SYNTHETIC_FAMILY_NAMES.includes(msg.get("PID.5.1") ?? ""); // => true
msg.get("PID.3.4"); // => "COSYTE-SYNTH"
msg.warnings.length; // => 0
```

## 3. Run every message family through it

By default `hl7Corpus` cycles through seven families: `ADT^A01`, `ADT^A04`, `ADT^A08`, `ORU^R01`,
`ORM^O01`, `SIU^S12`, and `VXU^V04`. With a count of 7 you get one of each, and each artifact's
`kind` says which (pass `mix: HL7_MESSAGE_KINDS` for every kind, discharges, transfers, documents,
charges and ACKs included):

```ts runnable
import { parseHL7 } from "@cosyte/hl7";
import { hl7Corpus } from "@cosyte/synth/hl7";

function summarize(raw: string) {
  const msg = parseHL7(raw);
  return { type: msg.get("MSH.9.1"), trigger: msg.get("MSH.9.2"), family: msg.get("PID.5.1") };
}

const corpus = hl7Corpus({ seed: 42, count: 7 });
const mismatched = corpus.artifacts.filter((artifact) => {
  const { type, trigger } = summarize(artifact.content);
  return `${type}^${trigger}` !== artifact.kind;
});

corpus.artifacts.length; // => 7
mismatched; // => []
```

## 4. Pin the seed

A test that regenerates its fixture from a seed needs no fixture file, and its input does not change
between runs, because the same seed gives the same bytes:

```ts runnable
import { generateAdt } from "@cosyte/synth/hl7";

const first = generateAdt({ seed: 12345, trigger: "A01" }).toString();
const again = generateAdt({ seed: 12345, trigger: "A01" }).toString();

first === again; // => true
```

The bytes come from `@cosyte/hl7`'s builder, so pin the versions of `@cosyte/synth` and
`@cosyte/hl7` in your lockfile as well as the seed. [Pin a golden fixture](./pin-a-golden-fixture.md)
covers writing a fixture to disk and checking it later.

## 5. Add a vendor deviation

Real feeds carry site-defined `Z` segments. `generateHl7Quirk` adds one to an otherwise clean
message, and checks before it returns that `@cosyte/hl7` raises exactly the warning the quirk is
meant to cause. Your code should still read the message, and the parser should flag the segment:

```ts runnable
import { parseHL7 } from "@cosyte/hl7";
import { generateHl7Quirk } from "@cosyte/synth/hl7";

const fixture = generateHl7Quirk({ seed: 12345, quirk: "unknown-zsegment" });
const msg = parseHL7(fixture.content);

fixture.intendedWarnings; // => ["UNKNOWN_SEGMENT"]
msg.warnings.map((w) => w.code); // => ["UNKNOWN_SEGMENT"]
msg.get("MSH.9.1"); // => "ORU"
```

## What you built

A reader for HL7 v2 messages, tested against a fixture of every family, regenerated from a seed,
plus a fixture with a known deviation and the warning it raises. None of it holds patient data.

## Where to go next

- [Generate HL7 v2 messages](./guides-hl7.md): every generator and option on the HL7 v2 subpath.
- [Generate vendor-quirk fixtures](./guides-quirks.md): the other quirks, and the parser profiles
  that tolerate them.
- [Quirk catalog](./quirk-catalog.md): every quirk and the warning it raises.
