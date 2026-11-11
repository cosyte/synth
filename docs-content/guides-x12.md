---
id: guides-x12
title: Generate X12 transactions
sidebar_label: X12
description: "Generate X12 005010 claims (837P, 837I, 837D), remittances (835), and eligibility responses (271) through @cosyte/x12's builders."
---

# Generate X12 transactions

The `@cosyte/synth/x12` subpath builds X12 005010 transactions through `@cosyte/x12`'s builders
(`build837P`, `build837I`, `build837D`, `build835`, and `build271`), so the `ISA`, `GS`, and `ST`
envelope, the `HL` hierarchy, the control numbers, and every segment are the builder's own. Install
`@cosyte/x12` alongside it ([Installation](./installation.md)).

It generates:

- 837 claims: professional (`generate837P`), institutional (`generate837I`), and dental
  (`generate837D`), or `generate837("P" | "I" | "D", options)` when the variant is data;
- the 835 remittance (`generate835`), whose line, claim, and payment totals balance before the
  builder is called, so `build835` never refuses it;
- the 271 eligibility response (`generate271`).

Each returns `@cosyte/x12`'s interchange model.

## Generate a claim and check it reads back clean

`roundTrip` serializes the interchange, parses it with `@cosyte/x12`, and serializes it again:

```ts runnable
import { generate837P, roundTrip } from "@cosyte/synth/x12";

// The same seed gives the same EDI, on any machine and any run.
const result = roundTrip(generate837P({ seed: 12345 }));
result.warnings; // => []
result.byteStable; // => true
result.specClean; // => true
```

The remittance and the eligibility response work the same way:

```ts runnable
import { generate271, generate835, roundTrip } from "@cosyte/synth/x12";

roundTrip(generate835({ seed: 7 })).specClean; // => true
roundTrip(generate271({ seed: 3 })).specClean; // => true
```

## Build a corpus

`x12Corpus` generates one of each transaction by default, in this order:

```ts runnable
import { x12Corpus } from "@cosyte/synth/x12";

const corpus = x12Corpus({ seed: 42 });
corpus.artifacts.map((a) => a.kind); // => ["837P", "837I", "837D", "835", "271"]
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

`count` and `mix` change how many and which kinds it cycles through.

## What an 837 or a 271 carries

An 837 or a 271 carries subscriber and patient names, member IDs, provider NPIs, a provider tax ID,
birth dates, and addresses. Each comes from a source chosen so it cannot be real:

- **NPI** (`NM1*XX`): 10 digits with a check digit that fails the Luhn check the NPI rule requires,
  so it cannot be an issued NPI (`safe.npi`, `isSyntheticNpi`).
- **Provider tax ID** (`REF*SY`): an SSN with a 900-series area, which SSA lists as invalid.
- **Member ID** (`NM1*MI`): an ID under a synthetic assigning authority. No range of member IDs is
  reserved, so the namespace is what keeps it from colliding with a real one.
- **Names** come from the invented-name pool, **birth dates and other dates** from the seeded
  generator, and **addresses** use an invented street and the ZIP Code `00000`.

Every interchange, the 835 included, sets the usage indicator `ISA-15` to `T` (test), never `P`
(production).

The test suite's synthetic-safety properties check this for arbitrary seeds and every transaction:
a Luhn-valid NPI, a tax ID outside the 900 series, or an `NM1` with the SSN qualifier `34` fails the
suite. [What it does and does not do](./limitations.md#the-synthetic-safety-posture-the-floors)
cites the rule behind each source.

## Not generated yet

- The 270 eligibility request. `@cosyte/x12` has a `build270`, and we do not use it yet.
- Vendor-quirk fixtures for X12.

## Related

- Reference: [`generate837P`](./api/src/x12.md#generate837p),
  [`generate837`](./api/src/x12.md#generate837), [`generate835`](./api/src/x12.md#generate835),
  [`generate271`](./api/src/x12.md#generate271), [`x12Corpus`](./api/src/x12.md#x12corpus), and
  [`roundTrip`](./api/src/x12.md#roundtrip).
