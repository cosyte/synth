---
id: guides-deid
title: Check a de-identifier with the pairing loop
sidebar_label: The deid pairing loop
description: "Generate fixtures with planted synthetic identifiers, de-identify them with @cosyte/deid, and check every one is gone and the clinical content stays."
---

# Check a de-identifier with the pairing loop

`@cosyte/synth` makes data that looks like PHI and holds none; `@cosyte/deid` removes PHI. The
`@cosyte/synth/deid` subpath runs one through the other, deterministically, from a seed:

1. **Generate** an artifact with the `synth` generators.
2. **List** the synthetic identifiers `synth` planted at the patient fields (the sentinels).
3. **De-identify** the artifact with `@cosyte/deid`.
4. **Check** that no sentinel is left at those fields, and that the clinical codes are still there
   (the over-scrub check).

This shows the pair works on `synth`'s own output. It is not an independent check of
`@cosyte/deid` against real-world documents. A sentinel that `@cosyte/deid` blocks rather than
redacts counts as removed. The loop covers the five formats both packages support; NCPDP SCRIPT,
ASTM, and DICOM are skipped, and named.

Install `@cosyte/deid` with `@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`, `@cosyte/x12`, and
`@cosyte/ncpdp`: the subpath loads all five parsers when it is imported
([Installation](./installation.md)).

## Run one artifact through the loop

```ts runnable
import { hl7DeidLoop } from "@cosyte/synth/deid";

const r = hl7DeidLoop({ seed: 42, kind: "ORU^R01" });
r.pass; // => true
r.survivors; // => []
r.clinicalScrubbed; // => []
```

`kind` defaults to `"ORU^R01"`. `r.planted` lists the synthetic tokens `synth` placed at the identifier
fields, such as a name from the invented-name pool, an SSN with a 900-series area, a phone number
in `555-0100` to `555-0199`, a medical record number under the synthetic assigning authority, and
the order numbers.
`r.survivors` lists the ones still present at those fields after de-identification, and
`r.clinicalScrubbed` the clinical codes that went missing. Both are empty on a pass.

## Run every covered format and summarize

```ts runnable
import {
  hl7DeidLoop,
  fhirDeidLoop,
  x12DeidLoop,
  ncpdpTelecomDeidLoop,
  ccdaDeidLoop,
  summarizeDeidCoverage,
} from "@cosyte/synth/deid";

const summary = summarizeDeidCoverage([
  hl7DeidLoop({ seed: 1 }),
  fhirDeidLoop({ seed: 1 }),
  x12DeidLoop({ seed: 1, variant: "837P" }),
  ncpdpTelecomDeidLoop({ seed: 1, transaction: "B1" }),
  ccdaDeidLoop({ seed: 1 }),
]);
summary.allPass; // => true
summary.totalSurvivors; // => 0
summary.totalClinicalScrubbed; // => 0
```

## Why the check looks only at the patient fields

`synth` draws patient names, provider and organization names, addresses, and phone numbers from the
same synthetic pools, and a de-identifier may rightly keep a provider's identity. So the removal check
reads only the values left at the fields that held patient identifiers, not the whole document. A
provider name that the de-identifier keeps, and that happens to match a patient's, is not reported as
a survivor. The check reads the de-identifier's real serialized output, so a de-identifier that finds
a field and fails to clear it is still caught.

## The same seed gives the same result

The loop depends only on the seed: the same seed gives the same artifact, the same de-identified
output, and the same sentinels.

```ts runnable
import { fhirDeidLoop } from "@cosyte/synth/deid";

fhirDeidLoop({ seed: 7 }).deidentified === fhirDeidLoop({ seed: 7 }).deidentified; // => true
```

## See which formats are skipped

`DEID_LOOP_SKIPPED` names each format the loop does not cover, with the reason:

```ts runnable
import { DEID_LOOP_SKIPPED } from "@cosyte/synth/deid";

DEID_LOOP_SKIPPED.map((s) => s.format); // => ["ncpdp-script", "astm", "dicom"]
```

`@cosyte/deid` ships no NCPDP SCRIPT or ASTM adapter, and `synth` does not generate DICOM, so those
pairings wait for the adapters.

## Selectors the loops do not check yet

`x12DeidLoop({ variant })` and `ncpdpTelecomDeidLoop({ transaction })` throw a plain `TypeError` for a
value outside their union, rather than a `SynthError`, and `ccdaDeidLoop({ documentType })` treats any
value but `"ccd"` as a Referral Note. None of them quotes your value.

## Related

- Reference: [`hl7DeidLoop`](./api/src/deid.md#hl7deidloop),
  [`summarizeDeidCoverage`](./api/src/deid.md#summarizedeidcoverage),
  [`DeidLoopResult`](./api/src/deid.md#deidloopresult), and
  [`DEID_LOOP_SKIPPED`](./api/src/deid.md#deid_loop_skipped).
- [What it does and does not do](./limitations.md#coverage-and-what-is-deferred): coverage across
  the formats.
