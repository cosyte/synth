---
"@cosyte/synth": patch
---

Phase 8 (SYNTH-10): the `@cosyte/deid` pairing loop. A new `@cosyte/synth/deid` subpath — a
deterministic, seeded closed-loop co-validation harness for the `synth` ⇄ `deid` pair: generate a
spec-clean synthetic artifact, plant distinctive synthetic PHI sentinels at its patient loci,
de-identify through `@cosyte/deid`, and verify every sentinel is gone (a surviving sentinel is a hard
failure) while the clinical payload survives. Per-format loops for HL7 v2, FHIR, C-CDA, X12, and NCPDP
Telecom; the removal check is locus-scoped (it sweeps only the de-identified values remaining at the
former PHI loci) so provider identity a de-identifier legitimately retains never reads as a false
survivor. `@cosyte/deid` is an optional peer dependency (vendored, the `mllp`/`ncpdp` pattern);
third-party runtime deps stay at 0. A co-validation harness, not an independent audit of deid; NCPDP
SCRIPT, ASTM, and DICOM are skipped and named.
