---
"@cosyte/synth": patch
---

Phase 6 (SYNTH-7): spec-clean NCPDP generation at the `@cosyte/synth/ncpdp` subpath, built **through
`@cosyte/ncpdp`'s own emit surface** — spec-clean by construction, round-tripping through the parser
with zero warnings, byte-stable, seed-deterministic, and synthetic by construction.

- New SCRIPT generators: `generateNewRx` (via the validated `buildNewRx` builder) and
  `generateRxRenewalRequest` / `generateRxChangeRequest` (via `@cosyte/ncpdp`'s public typed
  `ScriptMessage` model + `serializeScript`). New Telecom generators: `generateB1` / `generateB2` /
  `generateB3` (via `buildTelecomRequest` + `serializeTelecom`), plus `generateTelecom(code, …)`,
  `ncpdpCorpus`, the `scriptRoundTrip` / `telecomRoundTrip` harnesses, and the
  `ncpdpPatient`/`ncpdpPrescriber`/`ncpdpPharmacy`/`ncpdpCardholder`/`ncpdpScriptRouting` identity
  minters + a license-clean `EXAMPLE_DRUGS` pool (no NCPDP-copyrighted text bundled).
- Synthetic-safety gains the prescriber **DEA** locus: new `safe.dea` emits a `XX`+7-digit DEA with a
  deliberately-**invalid checksum** (never a validly-issued registration — `isSyntheticDea` /
  `deaCheckDigit` / `DEA_REGISTRANT_TYPES`). Prescriber NPIs stay invalid-Luhn; patient / cardholder
  ids are synthetic-AA-scoped; names from the fake-name pool; dates (incl. SCRIPT `SentTime`) seeded.
  The repo `phi-scan` gains an NCPDP arm (SCRIPT `<NPI>`/`<DEANumber>`/name tags; Telecom
  field-id-keyed CA/CB/CC/CD/CQ/CY/C2/DB) — a Luhn-valid NPI or checksum-valid DEA is a hard hit.
- `@cosyte/ncpdp` vendored as an optional peer dep, lazily loaded per format; third-party runtime deps
  stay at zero.
- Deferred: SCRIPT coverage tracks the parser's builder surface (lifecycle responses land as
  `@cosyte/ncpdp` grows builders); ASTM generation is gated on `ASTM-7` (SYNTH-8); vendor-quirk mode
  remains Phase 7.
