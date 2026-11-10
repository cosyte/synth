---
id: guides-ncpdp
title: Generate NCPDP messages
sidebar_label: NCPDP
description: "Generate NCPDP SCRIPT prescriptions and Telecom pharmacy claims (B1, B2, B3) through @cosyte/ncpdp's builders and serializers."
---

# Generate NCPDP messages

The `@cosyte/synth/ncpdp` subpath builds both NCPDP standards through `@cosyte/ncpdp`'s own builders
and serializers. Install `@cosyte/ncpdp` alongside it ([Installation](./installation.md)).

NCPDP is two unrelated standards under one name, and the subpath covers both:

- **SCRIPT** (XML ePrescribing): `generateNewRx` is built through `buildNewRx`;
  `generateRxRenewalRequest` and `generateRxChangeRequest` are built as `@cosyte/ncpdp`'s typed
  `ScriptMessage` model and serialized by `serializeScript`.
- **Telecom** (vD.0 pharmacy claims): `generateB1` (billing), `generateB2` (reversal), and
  `generateB3` (rebill), built through `buildTelecomRequest` and `serializeTelecom`, or
  `generateTelecom("B1" | "B2" | "B3", options)` when the transaction code is data.

Each returns the serialized message as a string.

## Generate a NewRx and check it reads back clean

`scriptRoundTrip` parses the SCRIPT XML with `@cosyte/ncpdp` and serializes it again:

```ts runnable
import { generateNewRx, scriptRoundTrip } from "@cosyte/synth/ncpdp";

// The same seed gives the same SCRIPT XML, on any machine and any run.
const result = scriptRoundTrip(generateNewRx({ seed: 12345 }));
result.warnings; // => []
result.byteStable; // => true
result.specClean; // => true
```

## Generate a Telecom claim

`telecomRoundTrip` does the same for a Telecom transaction:

```ts runnable
import { generateB1, generateTelecom, telecomRoundTrip } from "@cosyte/synth/ncpdp";

telecomRoundTrip(generateB1({ seed: 777 })).specClean; // => true
telecomRoundTrip(generateTelecom("B2", { seed: 777 })).specClean; // => true
```

## Build a corpus

`ncpdpCorpus` generates one of each transaction by default, in this order:

```ts runnable
import { ncpdpCorpus } from "@cosyte/synth/ncpdp";

const corpus = ncpdpCorpus({ seed: 42 });
corpus.artifacts.map((a) => a.kind); // => ["NewRx", "RxRenewalRequest", "RxChangeRequest", "B1", "B2", "B3"]
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

## What a message carries

NCPDP carries the patient's identity and the prescriber's, including a DEA number, which the other
formats do not have. Each value comes from a source chosen so it cannot be real:

- **Prescriber NPI**: 10 digits with a check digit that fails the Luhn check the NPI rule requires
  (`safe.npi`, `isSyntheticNpi`).
- **Prescriber DEA number**: two letters and seven digits whose last digit fails the published DEA
  checksum (`safe.dea`, `isSyntheticDea`). The checksum's source is a pharmacy journal, not the
  DEA; [the floor table](./limitations.md#the-synthetic-safety-posture-the-floors) says what that
  means.
- **Patient, cardholder, and member IDs**: under a synthetic assigning authority, with an `MBR`
  prefix. No range of these IDs is reserved, so the namespace is what keeps them from colliding.
- **Names** come from the invented-name pool, **phone numbers** from `555-0100` to `555-0199`, and
  **dates**, including the SCRIPT `SentTime`, from the seeded generator, never the clock.
- **Drugs** come from a small example pool whose NDCs use the labeler prefix `00000`, which we
  invented. No NCPDP text is bundled.

```ts runnable
import { createRng, isSyntheticDea, isSyntheticNpi } from "@cosyte/synth";
import { ncpdpPrescriber } from "@cosyte/synth/ncpdp";

const prescriber = ncpdpPrescriber(createRng(1));
isSyntheticNpi(prescriber.npi); // => true
isSyntheticDea(prescriber.dea); // => true
```

The test suite's synthetic-safety properties check these for arbitrary seeds and every transaction:
a Luhn-valid NPI or a checksum-valid DEA number fails the suite.

## Not generated yet

- SCRIPT responses to a renewal or change request, and the other SCRIPT transactions. They follow
  `@cosyte/ncpdp`'s builders, and we do not write bytes around a missing builder.
- Vendor-quirk fixtures for NCPDP.

## Related

- [Check a de-identifier with the pairing loop](./guides-deid.md): Telecom claims through
  `@cosyte/deid`.
- Reference: [`generateNewRx`](./api/src/ncpdp.md#generatenewrx),
  [`generateTelecom`](./api/src/ncpdp.md#generatetelecom),
  [`scriptRoundTrip`](./api/src/ncpdp.md#scriptroundtrip),
  [`telecomRoundTrip`](./api/src/ncpdp.md#telecomroundtrip), and
  [`ncpdpCorpus`](./api/src/ncpdp.md#ncpdpcorpus).
