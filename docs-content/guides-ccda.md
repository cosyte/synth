---
id: guides-ccda
title: C-CDA (CCD / Referral Note)
sidebar_position: 4
---

# Generate C-CDA documents

The `@cosyte/synth/ccda` subpath builds Consolidated CDA R2.1 documents **through `@cosyte/ccda`'s
`buildCcda`**, so template IDs, LOINC section codes, and structured/narrative agreement are the
builder's own — every document is **spec-clean by construction** and round-trips through `parseCcda`
with **zero warnings**. `@cosyte/ccda` is an **optional peer dependency**, needed only for this subpath.

The C-CDA surface emits a **Continuity of Care Document (CCD)** (`generateCcd`) or a **Referral Note**
(`generateReferralNote`), each populating the CCD sections — Problems, Allergies, Medications, Results,
Vital Signs, Immunizations, Procedures, and Social History (Smoking Status) — from the reused,
license-clean example-code pools. Every `recordTarget` identity is drawn from the synthetic-safety
providers: the patient name from the shipped fake-name pool, the MRN under a synthetic
assigning-authority OID, and every date from the seeded generator.

## A CCD, spec-clean by construction

The round-trip harness proves spec-cleanliness by `@cosyte/ccda`'s own judgment — a spec-clean document
re-parses with zero warnings and re-serializes byte-identically:

```ts runnable
import { generateCcd, roundTrip } from "@cosyte/synth/ccda";

// Same seed → byte-identical document, on any machine, any run.
const { warnings, byteStable } = roundTrip(generateCcd({ seed: 12345 }));

[warnings.length, byteStable]; // => [0, true]
```

## A Referral Note

`generateReferralNote` emits the second document type `buildCcda` supports — its own US Realm Header
specialization plus the Reason-for-Referral and Assessment narrative sections:

```ts runnable
import { generateReferralNote } from "@cosyte/synth/ccda";

const note = generateReferralNote({ seed: 7 });

note.documentType; // => "referralNote"
```

## A reproducible mixed corpus

`ccdaCorpus` builds a deep-frozen, self-describing corpus (one CCD and one Referral Note by default),
each document round-tripped through the parser so its `warnings` record the verdict:

```ts runnable
import { ccdaCorpus } from "@cosyte/synth/ccda";

const corpus = ccdaCorpus({ seed: 1867, count: 4 });

corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```
