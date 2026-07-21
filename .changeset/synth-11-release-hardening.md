---
"@cosyte/synth": patch
---

Phase 9 (SYNTH-11): release hardening — the final roadmap phase. No new runtime API; the generator is
feature-complete across all six formats. Adds a **consolidated conformance property suite** that drives
every spec-clean format generator through the same three mandatory properties (round-trip spec-clean ·
seed-determinism · synthetic-safety), plus an intended-warning arm for the HL7 v2 / C-CDA / ASTM quirk
corpora, with non-vacuity asserted directly. Adds a **seed-sweep generation fuzz** (the inverted fuzz of
roadmap §6) proving generation is total over seed × count × format — never throwing outside the
sanctioned `SYNTH_FATAL_CODES` set, never hanging, every output still passing the gates — scaled by
`SYNTH_FUZZ_RUNS` with a `test:fuzz` script and a nightly `Fuzz` workflow. Adds a **dual ESM/CJS
release-shape smoke** (`scripts/smoke.mjs`, run by `verify.sh`) exercising all eight published subpaths
under both module systems. Publish dry-run proven (`attw` green across every subpath; a clean
`npm publish --dry-run` 58-file tarball); per-dir ≥90 coverage continues to gate. Ships the **honesty
doc** `docs-content/limitations.md` — the governing what-it-does/does-not sentence, the full
synthetic-safety posture (900-range SSN, invalid-Luhn NPI, invalid-checksum DEA, `555-01xx` phone,
`example.*` domain, TEST-NET IP, synthetic-assigning-authority MRN floors), the structural-not-clinical
/ not-Synthea scoping, and the deferred surfaces. The actual `npm publish` and the repo public-flip
remain the two standing founder gates and are not crossed here.
