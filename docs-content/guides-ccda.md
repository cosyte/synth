---
id: guides-ccda
title: Generate C-CDA documents
sidebar_label: C-CDA
description: "Generate C-CDA R2.1 documents, a Continuity of Care Document or a Referral Note, through @cosyte/ccda's builder."
---

# Generate C-CDA documents

The `@cosyte/synth/ccda` subpath builds Consolidated CDA R2.1 documents through `@cosyte/ccda`'s
`buildCcda`, so the template IDs, the LOINC section codes, and the agreement between structured
entries and narrative are the builder's own. Install `@cosyte/ccda` alongside it
([Installation](./installation.md)).

It generates a Continuity of Care Document (`generateCcd`) or a Referral Note
(`generateReferralNote`). Both carry the CCD sections: Problems, Allergies, Medications, Results,
Vital Signs, Immunizations, Procedures, and Social History (smoking status), filled from small
example code pools. The `recordTarget` patient has a name from the invented-name pool, a medical
record number under a synthetic assigning-authority OID, and dates from the seeded generator.

## Generate a CCD and check it reads back clean

`roundTrip` serializes the document, parses it with `@cosyte/ccda`, and serializes it again. A
spec-clean document parses with no warnings and gives the same bytes:

```ts runnable
import { generateCcd, roundTrip } from "@cosyte/synth/ccda";

// The same seed gives the same document, on any machine and any run.
const { warnings, byteStable } = roundTrip(generateCcd({ seed: 12345 }));

[warnings.length, byteStable]; // => [0, true]
```

## Generate a Referral Note

`generateReferralNote` builds the second document type `buildCcda` supports, with its own US
Realm Header template and the Reason for Referral and Assessment sections:

```ts runnable
import { generateReferralNote } from "@cosyte/synth/ccda";

const note = generateReferralNote({ seed: 7 });

note.documentType; // => "referralNote"
```

To choose the type at run time, `generateCcda({ seed, documentType })` takes `"ccd"` or
`"referralNote"`.

## Build a corpus

`ccdaCorpus` alternates a CCD and a Referral Note, starting with a CCD; `count` defaults to `1`.
Each document is round-tripped, and its `warnings` holds what the parser reported:

```ts runnable
import { ccdaCorpus } from "@cosyte/synth/ccda";

const corpus = ccdaCorpus({ seed: 1867, count: 3 });

corpus.artifacts.map((a) => a.kind); // => ["ccd", "referralNote", "ccd"]
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

A `mix` option takes the document types to cycle through instead.

## Related

- [Generate vendor-quirk fixtures](./guides-quirks.md#c-cda-a-deprecated-loinc-code): C-CDA
  documents with a deprecated code or a missing template version.
- Reference: [`generateCcd`](./api/src/ccda.md#generateccd),
  [`generateReferralNote`](./api/src/ccda.md#generatereferralnote),
  [`ccdaCorpus`](./api/src/ccda.md#ccdacorpus), and [`roundTrip`](./api/src/ccda.md#roundtrip).
