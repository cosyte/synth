---
"@cosyte/synth": minor
---

`0.1.0` is the first release of `@cosyte/synth` whose public API we ask you to build on.

**What is covered, and what you can depend on.** Seeded generation of spec-clean test fixtures in six formats, each built through that format's own `@cosyte/*` builder or serializer and read back by its parser with zero warnings: HL7 v2 (ADT, ORU, ORM, SIU and VXU), FHIR R4 and US Core (the clinical resources, fixtures requested by US Core 6.1.0 profile name, and `collection`, `transaction` and `document` Bundles), C-CDA R2.1 (CCD and Referral Note), X12 005010 (837P, 837I, 837D, 835 and 271), NCPDP SCRIPT (NewRx, RxRenewalRequest and RxChangeRequest) and Telecom (B1, B2 and B3), and ASTM E1394 records with E1381 framing. Every identifier, name, date, phone and address comes from a reserved range or the shipped fake-name pool, never from real data. Also covered: vendor-quirk fixtures for HL7 v2, C-CDA and ASTM, each round-tripping to exactly one intended warning; the pairing loop with `@cosyte/deid`; the `safe` value providers and their validators; and the stable `SYNTH_*` fatal codes. Node.js 22 and 24, ESM and CommonJS, with type declarations for both, and no third-party runtime dependency.

**What the version promises.** The same seed yields byte-identical output, verified across Node 22 and Node 24 on every change, and a change to what a seed maps to ships only in a release that declares a major version, so a golden fixture pinned to a `0.x` version keeps matching. For the rest of the API: until 1.0, a breaking change raises the minor version (0.1 to 0.2), and the changelog entry says what broke and what to change. A patch release (0.1.x) does not break you, so a `^0.1.0` range takes the patches and stops before 0.2.0.

**What is not covered yet.** Quirk recipes for FHIR, X12 and NCPDP; the X12 270 eligibility request and the NCPDP SCRIPT lifecycle responses, which wait on builders in the parsers; `@cosyte/deid` pairing for NCPDP SCRIPT, ASTM and DICOM; DICOM generation; and clinical realism, since this is a format and conformance generator rather than a clinical simulator. The pairing loop co-validates the two packages on this package's own output and is not an independent audit of `@cosyte/deid`. The documentation at https://docs.cosyte.com/synth lists the known limitations in full.

The repository now carries runnable examples under `examples/`, run against the built package on every change.
