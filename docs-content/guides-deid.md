---
id: guides-deid
title: The @cosyte/deid pairing loop
sidebar_position: 9
---

# Co-validate with `@cosyte/deid`

A synthetic-fixture generator and a de-identifier are natural partners: `@cosyte/synth` produces data
that **looks like** PHI but contains none, and `@cosyte/deid` removes PHI. The `@cosyte/synth/deid`
subpath closes the loop between them — a deterministic, seeded **co-validation harness**:

1. **Generate** a spec-clean synthetic artifact through `synth`'s own generators.
2. **Enumerate** the distinctive synthetic PHI sentinels `synth` planted at the patient loci.
3. **De-identify** it through `@cosyte/deid`.
4. **Verify** every sentinel is gone from the de-identified output — a surviving sentinel is a hard
   failure — **and** that the clinical payload survives (the over-scrub guard).

> **Honest scope.** This proves *the pair works on `synth`'s own output* — it is **not** an independent
> audit of `@cosyte/deid` against real-world documents. A sentinel `deid` **blocks** rather than redacts
> still passes the removal check (blocked = gone). The loop covers the five formats both packages
> support; NCPDP **SCRIPT**, **ASTM**, and **DICOM** are skipped and named.

`@cosyte/deid` is an **optional peer dependency**, needed only for this subpath (alongside the parsers
for the formats you pair). The package core keeps **zero third-party runtime dependencies**.

## One artifact through the loop

```ts runnable
import { hl7DeidLoop } from "@cosyte/synth/deid";

const r = hl7DeidLoop({ seed: 42, kind: "ORU^R01" });
r.pass; // => true
r.survivors; // => []
r.clinicalScrubbed; // => []
```

`r.planted` lists the distinctive synthetic tokens `synth` placed at the patient loci (a fake-name-pool
name, a `900`-range SSN, a `555-01xx` phone, a synthetic-assigning-authority MRN); `r.survivors` is the
subset still present at those loci after de-identification — **empty** on a clean pass.

## Every covered format, one summary

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

## The removal check is locus-scoped

`synth` draws patient **and** provider/organization names, addresses, and phones from the same synthetic
pools, and a de-identifier legitimately **retains** provider identity. So the removal check sweeps only
the de-identified values that remain **at the former PHI loci** — not the whole document — so a provider
name that a de-identifier keeps (and that happens to match a patient token) never reads as a false
survivor. The check still reads the de-identifier's actual serialized output, so a de-identifier that
locates a locus but fails to strip it is still caught.

## Deterministic and seeded

The loop is a pure function of the seed: the same seed yields the byte-identical spec-clean artifact,
the byte-identical de-identified output, and the same sentinel set.

```ts runnable
import { fhirDeidLoop } from "@cosyte/synth/deid";

fhirDeidLoop({ seed: 7 }).deidentified === fhirDeidLoop({ seed: 7 }).deidentified; // => true
```

## Skipped formats, named

A coverage gap is always named, never silent:

```ts runnable
import { DEID_LOOP_SKIPPED } from "@cosyte/synth/deid";

DEID_LOOP_SKIPPED.map((s) => s.format); // => ["ncpdp-script", "astm", "dicom"]
```

`@cosyte/deid` ships no NCPDP **SCRIPT** or **ASTM** adapter, and `synth` does not generate **DICOM** —
so those pairings are deferred until the adapters exist. Optional **Synthea** clinical-content ingestion
(re-serializing Synthea's coherent records through the cosyte parsers) is a documented future concern.
