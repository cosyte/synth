---
"@cosyte/synth": patch
---

Phase 3 (SYNTH-3): FHIR R4 / US Core generation. A new `@cosyte/synth/fhir` subpath generating the US
Core clinical spine **through `@cosyte/fhir`'s own model constructors and serializer** — spec-clean by
construction, validating under `validateResource` and, against the real published US Core 6.1.0
`StructureDefinition`s (BYO — none bundled), conformant to US Core.

- New generators: `generatePatient` (base + `profile:"us-core"` with race/ethnicity/birthsex
  must-support extensions), `generateCondition` (US Core problem-list item), `generateObservationLab`
  (US Core Laboratory Result), `generateVitalSign` (US Core Vital Signs), `generateMedicationRequest`
  (US Core, satisfying the `us-core-21` requester invariant), and `generateBundle` (`collection` +
  `transaction`, wired by `urn:uuid:` references).
- `fhirCorpus(seed, count?, mix?)` builds a reproducible mixed corpus across the spine; `roundTrip` is
  the FHIR round-trip/validate harness (serialize → parse → validate(strict) → serialize) that accepts
  caller-supplied (BYO) US Core / vendor profiles.
- Model-construction helpers built through `@cosyte/fhir` (`prop`/`str`/`dec`/`bool`/`coding`/
  `codeableConcept`/`reference`/`narrative`/`meta`/`mrnIdentifier`/`fhirPatientIdentity`/`toFhirDate`);
  US Core canonical URLs + code-system identifiers as facts only (`US_CORE_PROFILE`, `SYSTEM`, the
  extension URLs); a license-clean FHIR example-code pool (public LOINC/SNOMED/RxNorm/OMB facts). No US
  Core IG or terminology content is bundled.
- US Core conformance validated firsthand against the committed real US Core 6.1.0 profiles
  (`test/us-core-profiles/`, BYO) — every US-Core generator validates zero-error across a 200-seed
  sweep. FHIR seed-determinism, synthetic-safety, and golden-fixture property/regression suites added;
  the repo `phi-scan` gains FHIR-aware structured detection (HumanName + phone `ContactPoint`).
- `@cosyte/fhir` vendored as an optional peer dep (`file:vendor/*.tgz`) — third-party runtime deps stay
  at zero. Deferred to SYNTH-4: `Encounter`, `DiagnosticReport`, `Immunization`, `AllergyIntolerance`,
  `Procedure`, the `document` Bundle shape, and quirk mode.
