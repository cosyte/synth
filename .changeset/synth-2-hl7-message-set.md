---
"@cosyte/synth": patch
---

Phase 2 (SYNTH-2): the rest of the HL7 v2 set. Extend HL7 v2 generation from `ADT` alone to
`ORU^R01`, `ORM^O01`, `SIU^S12`, and `VXU^V04` — each built through `@cosyte/hl7`'s `buildMessage`,
spec-clean by construction, round-tripping through the parser with zero warnings, seed-deterministic,
and synthetic-safe.

- New generators at the `@cosyte/synth/hl7` subpath: `generateOru`, `generateOrm`, `generateSiu`,
  `generateVxu`, plus a `generateHl7(kind, seed)` dispatch over every `Hl7MessageKind`. Each message
  emits exactly the segments the parser's structure net requires for its trigger (OBR/OBX for
  `ORU^R01`, ORC for `ORM^O01`, SCH for `SIU^S12`, PID for `VXU^V04`), so nothing warns.
- `hl7Corpus` now builds a mixed corpus across every family by default (`mix?` to choose; the SYNTH-1
  ADT-only `triggers?` knob is preserved for back-compat).
- Shared HL7 building blocks (`mshScaffold`, `patientIdentity`, `pidSegment`, `seededTimestamp`): every
  family mints identity from the same synthetic-safety providers in the same draw order (`ADT` output
  byte-identical). A small license-clean example-code pool (public LOINC/CVX facts) fills coded fields;
  no terminology is bundled.
- Synthetic-safety and seed-determinism property tests extended to sweep every family; Tier-1 fixtures
  added for the new message types.
