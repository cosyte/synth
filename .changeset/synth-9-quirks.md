---
"@cosyte/synth": patch
---

Phase 7 (SYNTH-9): vendor-quirk generation — the differentiator. Profile-driven **off-spec** fixtures
whose vocabulary **is the parsers' own profile systems**: a quirk deviates message *structure*
(post-serialize, since profile tolerance is parse-side) so it round-trips to **exactly one intended,
stable parser warning** — the **intended-warning contract** — and where a **public** built-in parser
profile claims the deviation, it round-trips cleanly under it (suppressed, or re-badged to
`PROFILE_QUIRK_APPLIED`). Shipped for the three richest profile systems: **HL7 v2, C-CDA, ASTM**.

- Format-agnostic quirk core (root subpath): `QuirkDescriptor` / `QuirkArtifact` / `QuirkRoundTripResult`
  / `QuirkProfiledVerdict` / `QuirkProfileDisposition`, `resolveQuirk` (fail-closed
  `SYNTH_UNSUPPORTED_QUIRK`), `sameCodeSet`, `profileTolerated`, `validateProfileQuirks`, and the
  `PROFILE_QUIRK_APPLIED` marker.
- HL7 v2 (`@cosyte/synth/hl7`): `generateHl7Quirk` / `hl7QuirkRoundTrip` / `hl7QuirkCorpus` /
  `hl7QuirkProfile` / `HL7_QUIRKS` — `unknown-zsegment` → `UNKNOWN_SEGMENT` (suppressed by the public
  `visage` profile) and `unknown-escape` → `UNKNOWN_ESCAPE_SEQUENCE`.
- C-CDA (`@cosyte/synth/ccda`): `generateCcdaQuirk` / `injectCcdaQuirk` / `ccdaQuirkRoundTrip` /
  `ccdaQuirkCorpus` / `ccdaQuirkProfile` / `CCDA_QUIRKS` — `template-extension-absent` →
  `TEMPLATE_EXTENSION_ABSENT` (`legacyR11`), `deprecated-loinc` → `DEPRECATED_LOINC` and
  `deprecated-code-system` → `DEPRECATED_CODE_SYSTEM` (`smartScorecard`), each re-badged.
- ASTM (`@cosyte/synth/astm`): `generateAstmQuirk` / `astmQuirkRoundTrip` / `astmQuirkCorpus` /
  `astmQuirkProfile` / `ASTM_QUIRKS` — `unknown-escape` → `ASTM_UNKNOWN_ESCAPE_SEQUENCE` (`referenceCorpus`
  re-badge) and `unknown-record-type` → `ASTM_RECORD_UNKNOWN_TYPE`.
- Synthetic-safety still holds in quirk mode — a quirk changes shape, never provenance, so the `phi-scan`
  gate stays zero over quirk output. Mandatory property suites (intended-warning, seed-determinism,
  synthetic-safety) plus committed quirk fixtures under `test/fixtures/{hl7,ccda,astm}/quirk/`.
- Every quirk is **publicly grounded** (ADR 0018), never a private vendor corpus. Deferred: quirk recipes
  for FHIR / X12 / NCPDP, and any quirk that would need a private vendor-attributed corpus.
