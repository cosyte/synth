---
"@cosyte/synth": patch
---

Phase 1 (SYNTH-1): the generator core. Replace the parser scaffold with the seeded-PRNG +
synthetic-safety + round-trip foundation, proven end-to-end on HL7 v2.

- Hand-rolled, zero-dep seeded PRNG (`createRng` — `sfc32`/`splitmix32`); `Math.random` lint-banned in
  `src/`. Determinism is a tested invariant: a seed → byte-identical output.
- The synthetic-safety provider layer (`safe.*`, reserved-range predicates): every identifier, name,
  date, phone, email, IP, and MRN drawn from a guaranteed-non-colliding synthetic source — no
  generated value can be real or plausibly-real PHI.
- The deep-frozen `Corpus` abstraction (`makeCorpus`), the `defineSynthProfile` skeleton, and the
  stable `SYNTH_FATAL_CODES` + `SynthError`.
- HL7 v2 generation at the `@cosyte/synth/hl7` subpath (`generateAdt`, `roundTrip`, `hl7Corpus`) —
  built through `@cosyte/hl7`'s `buildMessage`, spec-clean by construction, round-tripping with zero
  warnings. `@cosyte/hl7` is an optional peer dep; third-party runtime deps stay at zero.
