---
"@cosyte/synth": patch
---

Phase 4 (SYNTH-4): the rest of the US Core clinical set. Extends the `@cosyte/synth/fhir` subpath from
the SYNTH-3 clinical spine to the full US Core clinical set — `Encounter`, `DiagnosticReport`
(Laboratory), `Immunization`, `AllergyIntolerance`, `Procedure` — plus the `document` Bundle shape, each
built **through `@cosyte/fhir`'s own model constructors** (spec-clean by construction) and validated
firsthand against the real published US Core 6.1.0 `StructureDefinition`s (BYO — none bundled).

- New generators: `generateEncounter`, `generateDiagnosticReport` (mandated `LAB` category slice +
  `effectiveDateTime`/`issued` for `us-core-8`/`us-core-9`, optional `result` wiring),
  `generateImmunization`, `generateAllergyIntolerance` (`clinicalStatus` + `verificationStatus` for
  `ait-1`/`ait-2`), and `generateProcedure` — each with a `subject`/`patient` reference and US Core
  `meta.profile` by default.
- `generateBundle({ type: "document" })` — a FHIR document Bundle leading with the mandated `Composition`
  (`bdl-11`) + a synthetic `Organization` author/custodian, with the required `identifier`/`timestamp`
  (`bdl-9`/`bdl-10`). `buildComposition` is exported. The shared spine assembles the full clinical set
  wired by `urn:uuid:` fullUrls so every reference resolves in-bundle.
- New license-clean example-code pools (`EXAMPLE_VACCINES`, `EXAMPLE_ALLERGENS`,
  `EXAMPLE_ALLERGY_MANIFESTATIONS`, `EXAMPLE_PROCEDURES`, `EXAMPLE_DIAGNOSTIC_REPORTS`,
  `EXAMPLE_ENCOUNTER_TYPES`, `EXAMPLE_ENCOUNTER_CLASSES`) — public code facts, no terminology bundled.
- Every new generator is covered by the round-trip, US-Core-conformance (200-seed sweep),
  seed-determinism, synthetic-safety, and golden-fixture suites; the five new US Core 6.1.0 profiles are
  committed under `test/us-core-profiles/`. Third-party runtime deps stay at zero. Deferred to SYNTH-5:
  C-CDA generation; quirk mode remains Phase 7.
