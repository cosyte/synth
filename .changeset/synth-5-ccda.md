---
"@cosyte/synth": patch
---

Phase 4 / SYNTH-5: C-CDA document generation. A new `@cosyte/synth/ccda` subpath generating spec-clean
Consolidated CDA R2.1 documents **through `@cosyte/ccda`'s `buildCcda`** — so template IDs, LOINC
section codes, and structured/narrative agreement are the builder's own, and each document round-trips
through `parseCcda` with **zero warnings** (spec-clean by construction), is seed-deterministic
(byte-identical for a seed), and is synthetic by construction.

- New generators: `generateCcd` (Continuity of Care Document), `generateReferralNote`, and the generic
  `generateCcda({ documentType })` — each populating the CCD SHALL sections (Problems, Allergies,
  Medications, Results, Vital Signs) plus Immunizations, Procedures, and Social History (Smoking
  Status) from the reused, license-clean example-code pools (LOINC/RxNorm/SNOMED/CVX). `ccdaCorpus`
  builds a reproducible mixed corpus (CCD + Referral Note); `roundTrip` is the C-CDA
  round-trip-through-the-parser harness (serialize → parse → serialize).
- Every `recordTarget` / clinical identity is drawn from the synthetic-safety providers (roadmap §4):
  the patient name from the shipped fake-name pool, the MRN under the synthetic assigning-authority OID
  (never a real facility namespace), and every date from the seeded generator (never wall-clock —
  `buildCcda`'s default `effectiveTime: new Date()` is always overridden with a synthetic date so the
  reproducibility contract holds). Seed-determinism and synthetic-safety property suites (250-seed
  sweeps) plus golden fixtures added; the repo `phi-scan` gains C-CDA-aware structured detection
  (recordTarget `name` + `telecom`).
- `@cosyte/ccda` vendored as an optional peer dep (`file:vendor/cosyte-ccda-0.0.1.tgz`), lazily loaded
  per format — importing the package root never pulls it. Third-party runtime deps stay at zero.
  Deferred to SYNTH-6: X12 generation; quirk mode remains Phase 7.
